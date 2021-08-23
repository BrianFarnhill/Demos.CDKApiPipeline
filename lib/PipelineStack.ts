import * as cdk from "aws-cdk-lib";
import {
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_events as events,
  aws_events_targets as events_targets,
  aws_iam as iam,
  aws_codestarnotifications as notifications,
  pipelines as pipelines,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import { DemosCdkApiPipelineStack } from './MainStack';


/**
 * Deployable unit of API application
 */
class PipelineStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props?: cdk.StageProps) {
    super(scope, id, props);
    new DemosCdkApiPipelineStack(this, 'LambdaDeployDemo');
  }
}

/**
 * The stack that defines the application pipeline
 */
export class CdkpipelinesDemoPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const repoProps = {
      owner: "BrianFarnhill",
      repo: "Demos.CDKApiPipeline",
    };

    const codeArtifactPolicyStatements = [
      new iam.PolicyStatement({
        actions: [
          "codeartifact:Get*",
          "codeartifact:List*",
          "codeartifact:Describe*",
          "codeartifact:ReadFromRepository",
        ],
        resources: [
          `arn:aws:codeartifact:ap-southeast-2:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}/${process.env.REPO_NAME}`,
          `arn:aws:codeartifact:ap-southeast-2:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}`,
          `arn:aws:codeartifact:ap-southeast-2:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}/${process.env.REPO_NAME}/*/*/*`,
        ],
      }),
      new iam.PolicyStatement({
        actions: [
          "codeartifact:GetAuthorizationToken",
        ],
        resources: [
          `arn:aws:codeartifact:ap-southeast-2:${process.env.DEVOPS_ACCOUNT}:domain/${process.env.DOMAIN_NAME}`,
        ],
      }),
      new iam.PolicyStatement({ actions: ["sts:GetServiceBearerToken"], resources: ["*"] }),
    ];


    const ciBuild = new codebuild.Project(this, "CIBuild", {
      source: codebuild.Source.gitHub({
        ...repoProps,
        webhook: true,
      }),
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            commands: [
              `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} --namespace demos && npm install`,
            ],
          },
          build: {
            commands: [
              "npm run build",
            ],
          },
          post_build: {
            commands: [
              "npm test",
            ]
          }
        }
      }),
      environmentVariables: {
        REPO_NAME: { value: process.env.REPO_NAME },
        DOMAIN_NAME: { value: process.env.DOMAIN_NAME },
        DEVOPS_ACCOUNT: { value: process.env.DEVOPS_ACCOUNT },
      },
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
      },
    });
    
    codeArtifactPolicyStatements.forEach((policy) => {
      ciBuild.addToRolePolicy(policy);
    });
    

    const pipeline = new pipelines.CdkPipeline(this, 'Pipeline', {
      pipelineName: 'LambdaDeployDemo-Pipeline',
      cloudAssemblyArtifact,
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        ...repoProps,
        oauthToken: cdk.SecretValue.secretsManager("GitHubToken"),
        branch: "main",
      }),
      synthAction: pipelines.SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        installCommand: `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} --namespace demos && npm install`,
        buildCommand: 'npm run build',
        testCommands: [
          "npm test",
          "npm audit",
        ],
        copyEnvironmentVariables: ["DEV_ACCOUNT", "PROD_ACCOUNT", "REPO_NAME", "DOMAIN_NAME", "DEVOPS_ACCOUNT", "SLACK_ARN", "SLACK_SNS_TOPIC_NAME"],
        rolePolicyStatements: codeArtifactPolicyStatements,
      }),
    });

    pipeline.addApplicationStage(new PipelineStage(this, 'PreProd', {
      env: { account: process.env.DEV_ACCOUNT, region: 'ap-southeast-2' }
    }));

    pipeline.addApplicationStage(new PipelineStage(this, 'Prod', {
      env: { account: process.env.PROD_ACCOUNT, region: 'ap-southeast-2' }
    }));


    // Auto trigger the ppipeline every week to ensure fresh dependency builds are pulled in
    const weeklyTrigger = new events.Rule(this, "WeeklyRelease", {
      description: "Force each pipeline to run once a week to ensure fresh dependencies are included and audited",
      enabled: true,
      schedule: events.Schedule.cron({
          minute: "0",
          hour: "14",
          month: "*",
          weekDay: "SUN",
          year: "*",
      }),
  });
  weeklyTrigger.addTarget(new events_targets.CodePipeline(pipeline.codePipeline));

    // Auto trigger pipeline when new shared package is deployed
    const packageUpdatedRule = new events.Rule(this, "CodeArtifactPublishes", {
      description: "Trigger the pipeline again when a specific package is updated",
      eventPattern: {
        source: ["aws.codeartifact"],
        detailType: ["CodeArtifact Package Version State Change"],
        detail: {
          domainName: [ process.env.DOMAIN_NAME ],
          domainOwner: [ process.env.DEVOPS_ACCOUNT ],
          repositoryName: [ process.env.REPO_NAME ],
          packageName: [ "sharedcdkconstruct" ],
          packageNamespace: [ "demos" ]
        }
      }
    });
    packageUpdatedRule.addTarget(new events_targets.CodePipeline(pipeline.codePipeline));

    if (process.env.SLACK_ARN !== undefined) {
      new notifications.CfnNotificationRule(this, "FailedPipelineStageNotifications", {
        name: "FailedPipelineActions",
        resource: pipeline.codePipeline.pipelineArn,
        detailType: 'FULL',
        eventTypeIds: ['codepipeline-pipeline-action-execution-failed'],
        targets: [{
          targetAddress: process.env.SLACK_ARN,
          targetType: 'AWSChatbotSlack'
        }],
      });

      new notifications.CfnNotificationRule(this, "FailedCIBuildNotifications", {
        name: "FailedCIBuilds",
        resource: ciBuild.projectArn,
        detailType: 'FULL',
        eventTypeIds: ['codebuild-project-build-state-failed', 'codebuild-project-build-state-succeeded'],
        targets: [{
          targetAddress: process.env.SLACK_ARN,
          targetType: 'AWSChatbotSlack'
        }],
      });
    }
  };
}
