import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
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
      // The pipeline name
      pipelineName: 'LambdaDeployDemo-Pipeline',
      cloudAssemblyArtifact,

      // Where the source can be found
      sourceAction: new codepipeline_actions.GitHubSourceAction({
        actionName: 'GitHub',
        output: sourceArtifact,
        owner: "BrianFarnhill",
        repo: "Demos.CDKApiPipeline",
        oauthToken: cdk.SecretValue.secretsManager("GitHubToken"),
        branch: "main",
      }),

       // How it will be built and synthesized
       synthAction: SimpleSynthAction.standardNpmSynth({
         sourceArtifact,
         cloudAssemblyArtifact,
         
         // We need a build step to compile the TypeScript Lambda
         buildCommand: 'npm run build && npm test',
         copyEnvironmentVariables: [ "DEV_ACCOUNT", "PROD_ACCOUNT" ],
       }),
    });

    // This is where we add the application stages
    // ...

    pipeline.addApplicationStage(new PipelineStage(this, 'PreProd', {
      env: { account: process.env.DEV_ACCOUNT, region: 'ap-southeast-2' }
    }));

    pipeline.addApplicationStage(new PipelineStage(this, 'Prod', {
      env: { account: process.env.PROD_ACCOUNT, region: 'ap-southeast-2' }
    }));

  }
}
