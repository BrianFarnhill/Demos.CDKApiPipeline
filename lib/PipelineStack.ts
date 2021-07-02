import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import * as iam from '@aws-cdk/aws-iam';
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
        installCommand: `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} && npm install`,
        buildCommand: 'npm run build && npm test',
        copyEnvironmentVariables: [ "DEV_ACCOUNT", "PROD_ACCOUNT", "REPO_NAME", "DOMAIN_NAME" ],
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
          new iam.PolicyStatement({ actions: [ "sts:GetServiceBearerToken" ], resources: [ "*" ] }),
        ]
      }),
    });

    pipeline.addApplicationStage(new PipelineStage(this, 'PreProd', {
      env: { account: process.env.DEV_ACCOUNT, region: 'ap-southeast-2' }
    }));

    pipeline.addApplicationStage(new PipelineStage(this, 'Prod', {
      env: { account: process.env.PROD_ACCOUNT, region: 'ap-southeast-2' }
    }));
  }
}
