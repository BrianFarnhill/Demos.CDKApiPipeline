import * as cdk from "aws-cdk-lib";
import {
  aws_codebuild as codebuild,
  aws_codepipeline as codepipeline,
  aws_codepipeline_actions as codepipeline_actions,
  aws_events as events,
  aws_events_targets as events_targets,
  aws_codestarnotifications as notifications,
  pipelines as pipelines,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from 'constructs';
import CiBuild from "./CiBuild";
import CodeArtifactPermissions from "./CodeArtifactPermissions";
import { DemosCdkApiPipelineStack } from './MainStack';


/**
 * Deployable unit of API application
 */
class PipelineStage extends cdk.Stage {

  constructor(scope: Construct, id: string, props?: cdk.StageProps, customSynth?: cdk.IStackSynthesizer) {
    super(scope, id, props);
    new DemosCdkApiPipelineStack(this, 'LambdaDeployDemo', {
      synthesizer: customSynth || undefined,
    });
  }
}

/**
 * The stack that defines the application pipeline
 */
export class CdkpipelinesDemoPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const repoOwner = "BrianFarnhill";
    const repoName = "Demos.CDKApiPipeline";

    const testReports = new codebuild.ReportGroup(this, 'TestReports', {
      removalPolicy: RemovalPolicy.DESTROY,
    });

    CiBuild(this, repoOwner, repoName, testReports);

    const synthAction = new pipelines.CodeBuildStep("Synth", {
      input: pipelines.CodePipelineSource.gitHub(`${repoOwner}/${repoName}`, "main", {
        authentication: cdk.SecretValue.secretsManager("GitHubToken"),
      }),
      installCommands: [
        `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} --namespace demos`,
        'npm install',
      ],
      commands: [
        'npm run build',
        'npm test',
        'npm audit --audit-level=critical',
        'npx cdk synth',
      ],
      primaryOutputDirectory: 'cdk.out',
      partialBuildSpec: codebuild.BuildSpec.fromObject({
        reports: {
          [testReports.reportGroupArn]:{
              files: [
                  '**/test-report.xml',
              ],
              'discard-paths': true,
          }
        },
      }),
      env: {
        'DEV_ACCOUNT': process.env.DEV_ACCOUNT || '',
        'PROD_ACCOUNT': process.env.PROD_ACCOUNT || '', 
        'REPO_NAME': process.env.REPO_NAME || '',
        'DOMAIN_NAME': process.env.DOMAIN_NAME || '',
        'DEVOPS_ACCOUNT': process.env.DEVOPS_ACCOUNT || '',
        'SLACK_ARN': process.env.SLACK_ARN || '',
        'SLACK_SNS_TOPIC_NAME': process.env.SLACK_SNS_TOPIC_NAME || '',
      },
      rolePolicyStatements: CodeArtifactPermissions,
    });

    const pipeline = new pipelines.CodePipeline(this, 'Pipeline', {
      pipelineName: 'LambdaDeployDemo-Pipeline',
      synth: synthAction,
      publishAssetsInParallel: false,
      crossAccountKeys: true,
    });

    pipeline.addStage(new PipelineStage(this, 'PreProd', {
      env: { account: process.env.DEV_ACCOUNT, region: cdk.Aws.REGION }
    }, new cdk.DefaultStackSynthesizer({ qualifier: 'apidemo' })));

    pipeline.addStage(new PipelineStage(this, 'Prod', {
      env: { account: process.env.PROD_ACCOUNT, region: cdk.Aws.REGION }
    }, new cdk.DefaultStackSynthesizer({ qualifier: 'apidemo' })));

    pipeline.buildPipeline();

    testReports.grantWrite(synthAction.grantPrincipal);
    

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
  weeklyTrigger.addTarget(new events_targets.CodePipeline(pipeline.pipeline));

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
    packageUpdatedRule.addTarget(new events_targets.CodePipeline(pipeline.pipeline));

    if (process.env.SLACK_ARN !== undefined) {
      new notifications.CfnNotificationRule(this, "FailedPipelineStageNotifications", {
        name: "FailedPipelineActions",
        resource: pipeline.pipeline.pipelineArn,
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
