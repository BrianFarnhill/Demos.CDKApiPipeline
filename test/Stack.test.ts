import { Match, Template } from '@aws-cdk/assertions';
import { Stack, App, aws_apigateway as apigw }  from 'aws-cdk-lib';
import Synthetics from '../lib/Synthetics';
import { DemosCdkApiPipelineStack } from '../lib/MainStack';

describe('Synthetics tests', () => {

    const app = new App();
    let stack:DemosCdkApiPipelineStack;
    
    test('Creates the stack without exceptions', () => {
        expect(() => { stack = new DemosCdkApiPipelineStack(app, 'TestStack') }).not.toThrow();
    });

    test('The app can synthesise fully', () => {
        expect(() => { app.synth() }).not.toThrow();
    })
}); 
