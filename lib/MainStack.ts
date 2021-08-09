import * as cdk from '@aws-cdk/core';
import * as apigw from '@aws-cdk/aws-apigateway';
import * as lambda from '@aws-cdk/aws-lambda';
import * as waf from '@aws-cdk/aws-wafv2';
import * as codedeploy from '@aws-cdk/aws-codedeploy';
import * as synth from '@aws-cdk/aws-synthetics';
import * as cw from '@aws-cdk/aws-cloudwatch';
import * as cloudfront from '@aws-cdk/aws-cloudfront';
import * as cforigins from '@aws-cdk/aws-cloudfront-origins';
import * as iam from '@aws-cdk/aws-iam';
import * as democonstruct from "@demos/sharedcdkconstruct";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3deploy from "@aws-cdk/aws-s3-deployment";
import rules from "./ApiRules";
import IncidentPlan from './IncidentPlan';
import * as path from "path";

export class DemosCdkApiPipelineStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // LAMBDA FUNCTION

    const demoFunciton = new democonstruct.DemoFunction(this, "DemoFunction", {});

    // Uncomment this line to cause the security tests to fail
    //demoFunciton.LambdaFunction.addToRolePolicy(new iam.PolicyStatement({ actions: [ "iam:CreateUser" ], resources: [ "*" ] }))

    const versionAlias = new lambda.Alias(this, 'alias', {
      aliasName: 'prod',
      version: demoFunciton.LambdaFunction.currentVersion,
    });


    // API GATEWAY

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

    // CW DASHBOARD
    
    new cw.Dashboard(this, "WAFMonitoring", {
      dashboardName: "LambdaAPI-WafMetrics",
      widgets: [
        [
          new cw.GraphWidget({ 
            height: 6, 
            width: 18, 
            left: [ new cw.Metric({ metricName: "BlockedRequests", namespace: "AWS/WAFV2", dimensionsMap: {
              WebACL: cdk.Fn.select(0, cdk.Fn.split("|", acl.ref)),
              Region: cdk.Aws.REGION,
              Rule: "ALL",
            }}),
          ]}),
        ],
        [
          new cw.GraphWidget({ 
            height: 6, 
            width: 18, 
            left: [ new cw.Metric({ metricName: "AllowedRequests", namespace: "AWS/WAFV2", dimensionsMap: {
              WebACL: cdk.Fn.select(0, cdk.Fn.split("|", acl.ref)),
              Region: cdk.Aws.REGION,
              Rule: "ALL",
            }}),
          ]}),
        ],
      ],
    })


    // CANARY

    const association = new waf.CfnWebACLAssociation(this, "ApiWafAssociation", {
      resourceArn: `arn:${cdk.Aws.PARTITION}:apigateway:${cdk.Aws.REGION}::/restapis/${api.restApiId}/stages/prod`,
      webAclArn: acl.attrArn,
    });
    association.node.addDependency(api);

    const canary = new synth.Canary(this, "WafSynethetics", {
      runtime: synth.Runtime.SYNTHETICS_NODEJS_PUPPETEER_3_1,
      test: synth.Test.custom({
        code: synth.Code.fromAsset(path.resolve(__dirname, "../canaries/waf")),
        handler: "index.handler",
      }),
      schedule: synth.Schedule.rate(cdk.Duration.minutes(1)),
      startAfterCreation: true,
      environmentVariables: {
        CANARY_HOSTNAME: `${api.restApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`,
      }
    });


    // CODE DEPLOY FOR API GATEWAY

    const application = new codedeploy.LambdaApplication(this, 'CodeDeployApplication', {
      applicationName: 'DemoLambdaApp', // optional property
    });

    new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
      application,
      alias: versionAlias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
      alarms: [
        new cw.Alarm(this, "MainLambdaErrorAlarm", {
          evaluationPeriods: 1,
          metric: versionAlias.metricErrors(),
          threshold: 1,
          treatMissingData: cw.TreatMissingData.NOT_BREACHING,
        }),
        new cw.Alarm(this, "MainLambdaLatencyAlarm", {
          evaluationPeriods: 1,
          metric: versionAlias.metricDuration(),
          threshold: 5000,
          treatMissingData: cw.TreatMissingData.NOT_BREACHING,
        }),
      ]
    });


    // FRONT END APP

    const sitebucket = new s3.Bucket(this, "SiteBucket", {
      blockPublicAccess: {
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
      }
    });
    const distro = new cloudfront.Distribution(this, "DemoSite", {
      defaultBehavior: { origin: new cforigins.S3Origin(sitebucket) },
      additionalBehaviors: {
        "/prod": {
          origin: new cforigins.HttpOrigin(`${api.restApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`),
        }
      }
    });
    new s3deploy.BucketDeployment(this, "SiteDeploy", {
      destinationBucket: sitebucket,
      sources: [
        s3deploy.Source.asset(path.resolve(__dirname, "../website")),
      ],
      distribution: distro,
    });

    // CODE DEPLOY STUB FOR STACK DEPLOYMENT
    const stubLambda = new lambda.Function(this, "StackDeployStub", {
      code: lambda.AssetCode.fromInline(`console.log("Stub last generated at ${Date.now().toString()}")`),
      handler: "index.handler",
      runtime: lambda.Runtime.NODEJS_12_X,
    });

    const stubAlias = new lambda.Alias(this, 'StubAlias', {
      aliasName: 'prod',
      version: stubLambda.currentVersion,
    });

    const wafSyntheticAlarm = new cw.Alarm(this, "SyntheticsFailureAlarm", {
      evaluationPeriods: 1,
      metric: canary.metricFailed(),
      threshold: 1,
      treatMissingData: cw.TreatMissingData.NOT_BREACHING,
    });

    IncidentPlan(this, wafSyntheticAlarm);

    new codedeploy.LambdaDeploymentGroup(this, 'StackDeployment', {
      application,
      alias: stubAlias,
      deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
      alarms: [ wafSyntheticAlarm ],
    });
  }
}
