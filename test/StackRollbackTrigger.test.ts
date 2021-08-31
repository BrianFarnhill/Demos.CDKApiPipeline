import { Match, Template } from '@aws-cdk/assertions';
import { Stack, App, aws_apigateway as apigw }  from 'aws-cdk-lib';
import StackRollbackTrigger from '../lib/StackRollbackTrigger';

describe('Synthetics tests', () => {

    const app = new App();
    const stack = new Stack(app, 'MyTestStack');

    new StackRollbackTrigger(stack, 'SyntheticsTest', {
        Alarms: [],
    });

    const assert = Template.fromJSON(app.synth().getStackArtifact(stack.artifactId).template);

    test('Contains a single lambda funciton that is used as a mock target for CodeDeploy', () => {
        assert.resourceCountIs('AWS::Lambda::Function', 1);
    });

    test('Contains a single lambda funciton version for CodeDeploy', () => {
        assert.resourceCountIs('AWS::Lambda::Version', 1);
    });

    test('Contains a single CodeDeploy application', () => {
        assert.resourceCountIs('AWS::CodeDeploy::Application', 1);
    });
}); 
