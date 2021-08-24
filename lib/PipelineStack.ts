import * as cdk from "aws-cdk-lib";
import {
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_events as events,
  aws_events_targets as events_targets,
  aws_codestarnotifications as notifications,
  pipelines as pipelines,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import CiBuild from "./CiBuild";
import CodeArtifactPermissions from "./CodeArtifactPermissions";
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

    const repoOwner = "BrianFarnhill";
    const repoName = "Demos.CDKApiPipeline";

    CiBuild(this, repoOwner, repoName);

    const pipeline = new pipelines.CdkPipeline(this, 'Pipeline', {
      pipelineName: 'LambdaDeployDemo-Pipeline',
      cloudAssemblyArtifact,
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        owner: repoOwner,
        repo: repoName,
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
        rolePolicyStatements: CodeArtifactPermissions,
      }),
    });

    pipeline.addApplicationStage(new PipelineStage(this, 'PreProd', {
      env: { account: process.env.DEV_ACCOUNT, region: cdk.Aws.REGION }
    }));

    pipeline.addApplicationStage(new PipelineStage(this, 'Prod', {
      env: { account: process.env.PROD_ACCOUNT, region: cdk.Aws.REGION }
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
