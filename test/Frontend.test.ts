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
    
    test('CloudFront default behaviour == S3', () => {
        // We can use index 0 here because we have already tested above that there's only 1 CloudFront distribution.
        const defaultCacheId = assert.findResources('AWS::CloudFront::Distribution')[0].Properties.DistributionConfig.DefaultCacheBehavior.TargetOriginId

        assert.hasResourceProperties('AWS::CloudFront::Distribution', {
            DistributionConfig: {
                Origins: Match.arrayWith([
                    Match.objectLike({
                        Id: defaultCacheId,
                        S3OriginConfig: Match.objectLike({})
                    })
                ])}
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