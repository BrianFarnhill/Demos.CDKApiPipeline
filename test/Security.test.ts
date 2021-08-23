import { Template, Match } from '@aws-cdk/assertions';
import * as cdk from 'aws-cdk-lib';
import * as DemosCdkApiPipeline from '../lib/MainStack';

const mutationPermissions = [
    "iam:DeleteRole",
    "iam:ChangePassword",
    "iam:CreateUser",
    "iam:CreateRole",
    "iam:AddRoleToInstanceProfile",
    "iam:AttachRolePolicy",
    "iam:AttachUserPolicy",
    "iam:AttachGroupPolicy",
    "iam:UpdateGroup",
    "iam:RemoveUserFromGroup",
];

describe("IAM tests", () => {

    const app = new cdk.App();
    const stack = new DemosCdkApiPipeline.DemosCdkApiPipelineStack(app, 'MyTestStack');
    const assert = Template.fromJSON(app.synth().getStackArtifact(stack.artifactId).template);

    describe("IAM mutation", () => {
        mutationPermissions.forEach((permission) => {
            test(`Does not have any IAM policy statements including ${permission}`, () => {

                expect(assert.findResources("AWS::IAM::Policy", {
                    Properties: {
                        PolicyDocument: {
                            Statement: Match.arrayWith([Match.objectLike({
                                Action: permission,
                                Effect: "Allow"
                            })]),
                        },
                    },
                }).length).toBe(0);

                expect(assert.findResources("AWS::IAM::Policy", {
                    PolicyDoucment: {
                        Statement: Match.arrayWith([Match.objectLike({
                            Action: permission,
                            Effect: "Allow",
                        })]),
                    },
                }).length).toBe(0);
            });
        });
    });
});
