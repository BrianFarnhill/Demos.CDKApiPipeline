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
        expect(assert.findResources('AWS::ApiGateway::RestApi').length).toBe(1); // Find the number of REST API endpoints
    });
    
    test('Check if CodeDeploy for Lambda exist', ()=> {
        assert.hasResource('AWS::CodeDeploy::Application', {
            Properties: {
                ComputePlatform: 'Lambda'    
            }
        });
    });
}); 

