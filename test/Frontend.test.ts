import { Template, Match } from '@aws-cdk/assertions';
import { 
    Stack,
    App,
    aws_apigateway as apigw,
} from 'aws-cdk-lib';
import FrontEnd from '../lib/FrontEnd';


describe('FrontEnd Test', () => {

    const app = new App();
    const stack = new Stack(app, 'MyTestStack');

    const mockApi = new apigw.RestApi(stack, 'TestApi', {});
    mockApi.root.addMethod('GET', new apigw.MockIntegration({}));

    new FrontEnd(stack, 'FrontEndTest', {
        ApiGateway: mockApi
    });

    const assert = Template.fromJSON(app.synth().getStackArtifact(stack.artifactId).template);

    test('CloudFront distribution count == 1', () => {
        assert.resourceCountIs('AWS::CloudFront::Distribution', 1);
    });
    
    test('S3 Bucket count == 1', () => {
        assert.resourceCountIs('AWS::S3::Bucket', 1);
    });
    
    test('Default Caching Policy == CachingOptimized', () => {
        const cachingOptimizedUuid = '658327ea-f89d-4fab-a63d-7e88639e58f6' // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html 

        assert.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                DefaultCacheBehavior: Match.objectLike({
                    CachePolicyId: cachingOptimizedUuid
                })
            }
        });
    });
    
    test('Caching Policy for API Gateway == CachingDisabled', () => {
        const cachingDisabledUuid = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad' // https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html 

        assert.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                CacheBehaviors: Match.arrayWith([
                    Match.objectLike({
                        PathPattern: '/prod',
                        CachePolicyId: cachingDisabledUuid
                    })]
                )}
        });
    });

    test('API Gateway path is set to /prod', ()=> {
        assert.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                CacheBehaviors: Match.arrayWith([
                    Match.objectLike({
                        PathPattern: '/prod'
                    })]
                )}
        });
    });
});