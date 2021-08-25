import { Template } from '@aws-cdk/assertions';
import * as cdk from 'aws-cdk-lib';
import * as MainStack from '../lib/MainStack';
import * as RestApi from '../lib/RestApi';
import { Stack } from '@aws-cdk/core';

describe('REST API Test', () => {

    const app = new cdk.App();
    const stack = new MainStack.DemosCdkApiPipelineStack(app, 'MyTestStack');
    const assert = Template.fromJSON(app.synth().getStackArtifact(stack.artifactId).template);

    test('REST API Endpoint == 1', () => {
        assert.resourceCountIs('AWS::ApiGateway::RestApi', 1);
    });
    
    test('Check if CodeDeploy for Lambda exist', ()=> {
        assert.hasResource('AWS::CodeDeploy::Application', {
            Properties: {
                ComputePlatform: 'Lambda'    
            }
        });
    });
    
    test('Validate CodeDeploy Deployment Config', () => {
       assert.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
           DeploymentConfigName: 'CodeDeployDefault.LambdaLinear10PercentEvery1Minute'
       }); 
    });
    
    test('Validate Lambda function Runtime == nodejs14.x', () => {
       assert.hasResourceProperties('AWS::Lambda::Function', {
          Runtime: 'nodejs14.x' 
       });
    });
}); 

