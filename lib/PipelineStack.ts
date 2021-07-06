import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as events from '@aws-cdk/aws-events';
import * as events_targets from '@aws-cdk/aws-events-targets';
import * as iam from '@aws-cdk/aws-iam';
import * as notifications from '@aws-cdk/aws-codestarnotifications';
import { Construct, Stack, StackProps, Stage, StageProps } from '@aws-cdk/core';
import * as cdk from "@aws-cdk/core";
import { CdkPipeline, SimpleSynthAction } from "@aws-cdk/pipelines";
import { DemosCdkApiPipelineStack } from './MainStack';


/**
 * Deployable unit of API application
 */
class PipelineStage extends Stage {

  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);
    new DemosCdkApiPipelineStack(this, 'LambdaDeployDemo');
  }
}

/**
 * The stack that defines the application pipeline
 */
export class CdkpipelinesDemoPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceArtifact = new codepipeline.Artifact();
    const cloudAssemblyArtifact = new codepipeline.Artifact();

    const pipeline = new CdkPipeline(this, 'Pipeline', {
      pipelineName: 'LambdaDeployDemo-Pipeline',
      cloudAssemblyArtifact,
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        owner: "BrianFarnhill",
        repo: "Demos.CDKApiPipeline",
        oauthToken: cdk.SecretValue.secretsManager("GitHubToken"),
        branch: "main",
      }),
      synthAction: SimpleSynthAction.standardNpmSynth({
        sourceArtifact,
        cloudAssemblyArtifact,
        installCommand: `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} --namespace demos && npm install`,
        buildCommand: 'npm run build',
        testCommands: [
          "npm test",
          "npm audit",
        ],
        copyEnvironmentVariables: ["DEV_ACCOUNT", "PROD_ACCOUNT", "REPO_NAME", "DOMAIN_NAME", "DEVOPS_ACCOUNT", "SLACK_ARN"],
        rolePolicyStatements: [
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
        ]
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
    }
  };
}
