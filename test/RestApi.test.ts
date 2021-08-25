import { Template } from '@aws-cdk/assertions';
import { Construct } from "constructs";
import * as cdk from 'aws-cdk-lib';
import MainApi from '../lib/RestApi';

class RestApiStack extends cdk.Stack {
      constructor(scope: Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);
    
        new MainApi(this, "MainAPI");
      }};

describe('REST API Test', () => {

    const app = new cdk.App();
    const stack = new RestApiStack(app, 'RestApiStack');
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
    
    test('Validate Lambda function Runtime', () => {
       assert.hasResourceProperties('AWS::Lambda::Function', {
          Runtime: 'nodejs14.x' 
       });
    });
    
    test('CodeDeploy Alarm count >= 1', () => {
        assert.findResources('AWS::CodeDeploy::DeploymentGroup').forEach( EachDeploymentGroup => {
            expect(EachDeploymentGroup.Properties.AlarmConfiguration.Alarms.length).toBeGreaterThanOrEqual(1);
        });
        
    })
    
    test('Check if auto rollback enabled', () => {
        assert.hasResourceProperties('AWS::CodeDeploy::DeploymentGroup', {
            AutoRollbackConfiguration: {
                Enabled: true,
            }
        })
    })

}); 
