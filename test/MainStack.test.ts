import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as DemosCdkApiPipeline from '../lib/MainStack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new DemosCdkApiPipeline.DemosCdkApiPipelineStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
