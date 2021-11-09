import { Match, Template } from '@aws-cdk/assertions';
import { Stack, App, aws_apigateway as apigw }  from 'aws-cdk-lib';
import Synthetics from '../lib/Synthetics';

describe('Synthetics tests', () => {

    const app = new App();
    const stack = new Stack(app, 'MyTestStack');

    const mockApi = new apigw.RestApi(stack, 'TestApi', {});
    mockApi.root.addMethod('GET', new apigw.MockIntegration({}));

    new Synthetics(stack, 'SyntheticsTest', {
        ApiGateway: mockApi,
    });

    const assert = Template.fromJSON(app.synth().getStackArtifact(stack.artifactId).template);

    test('Contains a single synthetics canary', () => {
        assert.resourceCountIs('AWS::Synthetics::Canary', 1);
    });

    test('The canary runs with the Puppeteer 3.2 runtime', () => {
        assert.hasResourceProperties('AWS::Synthetics::Canary', {
            RuntimeVersion: 'syn-nodejs-puppeteer-3.2',
        });
    });

    test('The canary runs once a minute', () => {
        assert.hasResourceProperties('AWS::Synthetics::Canary', {
            Schedule: {
                Expression: 'rate(1 minute)',
            },
        });
    });

    test('The canary does not run inside a VPC', () => {
        assert.hasResourceProperties('AWS::Synthetics::Canary', {
            VPCConfig: Match.absent(), 
        });
    });

    test('Contains a single S3 bucket for storing canary results', () => {
        assert.resourceCountIs('AWS::S3::Bucket', 1);
    });

    test('The S3 bucket deletes items that are 7 days old', () => {
        assert.hasResourceProperties('AWS::S3::Bucket', {
            LifecycleConfiguration: {
                Rules: Match.arrayWith([
                  {
                    ExpirationInDays: 7,
                    Status: "Enabled"
                  }
                ]),
              }
        });
    });

    test('Contains a a CloudWatch alarm that is tied to failing CloudWatch synthetics', () => {
        assert.hasResourceProperties('AWS::CloudWatch::Alarm', {
            Dimensions: Match.arrayWith([
                {
                  Name: 'CanaryName',
                  Value: Match.objectLike({}),
                }
              ]),
              MetricName: 'SuccessPercent',
              Namespace: 'CloudWatchSynthetics',
        });
    });
}); 
