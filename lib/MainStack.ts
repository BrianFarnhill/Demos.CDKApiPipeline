import * as cdk from '@aws-cdk/core';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as waf from '@aws-cdk/aws-wafv2';
import * as codedeploy from '@aws-cdk/aws-codedeploy';
import * as democonstruct from "@demos/sharedcdkconstruct";
import rules from "./ApiRules";

export class DemosCdkApiPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const demoFunciton = new democonstruct.DemoFunction(this, "DemoFunction", {});

    // Uncomment this line to cause the security tests to fail
    //demoFunciton.LambdaFunction.addToRolePolicy(new iam.PolicyStatement({ actions: [ "iam:CreateUser" ], resources: [ "*" ] }))

    const application = new codedeploy.LambdaApplication(this, 'CodeDeployApplication', {
      applicationName: 'DemoLambdaApp', // optional property
    });
    
    const versionAlias = new lambda.Alias(this, 'alias', {
      aliasName: 'prod',
      version: demoFunciton.LambdaFunction.currentVersion,
    });

    // An API Gateway to make the Lambda web-accessible
    const api = new apigw.LambdaRestApi(this, 'Gateway', {
      description: 'Endpoint for a simple Lambda-powered web service',
      handler: versionAlias
    });

    const acl = new waf.CfnWebACL(this, "APIACL", {
      defaultAction: { allow: {} },
      scope: "REGIONAL",
      rules,
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "waf",
        sampledRequestsEnabled: true,
      },
    });

    const association = new waf.CfnWebACLAssociation(this, "ApiWafAssociation", {
      resourceArn: `arn:${cdk.Aws.PARTITION}:apigateway:${cdk.Aws.REGION}::/restapis/${api.restApiId}/stages/_api`,
        webAclArn: acl.attrArn,
    });
    association.node.addDependency(api);

    new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
      application, 
      alias: versionAlias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
    });
  }
}
