import { expect as expectCDK, haveResourceLike, arrayWith, objectLike } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
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

  let app = new cdk.App();
  let stack = new DemosCdkApiPipeline.DemosCdkApiPipelineStack(app, 'MyTestStack');

  beforeAll(() => {
    app = new cdk.App();
    stack = new DemosCdkApiPipeline.DemosCdkApiPipelineStack(app, 'MyTestStack');
  });

  describe("IAM mutation", () => {
      mutationPermissions.forEach((permission) => {
          test(`Does not have any IAM policy statements including ${permission}`, () => {
              expectCDK(stack).notTo(haveResourceLike("AWS::IAM::Policy", {
                  PolicyDocument: {
                      Statement: arrayWith(objectLike({
                          Action: arrayWith(permission),
                          Effect: "Allow",
                      })),
                  }
              }));
              expectCDK(stack).notTo(haveResourceLike("AWS::IAM::Policy", {
                  PolicyDocument: {
                      Statement: arrayWith(objectLike({
                          Action: permission,
                          Effect: "Allow",
                      })),
                  }
              }));
          });
      });
  });
});
