#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DemosCdkApiPipelineStack } from '../lib/MainStack';
import { CdkpipelinesDemoPipelineStack } from "../lib/PipelineStack";

const app = new cdk.App();
new DemosCdkApiPipelineStack(app, 'MainStack', {});

new CdkpipelinesDemoPipelineStack(app, 'PipelineStack', {
  env: { account: process.env.DEVOPS_ACCOUNT, region: process.env.AWS_REGION },
});
