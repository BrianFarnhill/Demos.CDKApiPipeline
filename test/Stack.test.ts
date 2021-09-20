import { App }  from 'aws-cdk-lib';
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
