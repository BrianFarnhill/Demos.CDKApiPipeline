import {
    aws_lambda as lambda,
    aws_apigateway as apigw,
    aws_iam as iam,
    aws_codedeploy as codedeploy,
    aws_cloudwatch as cw,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as democonstruct from "@demos/sharedcdkconstruct";

export default class extends Construct {

    ApiGateway: apigw.IRestApi

    constructor(scope: Construct, id: string) {
        super(scope, id);

        const demoFunciton = new democonstruct.DemoFunction(this, "DemoFunction", {});

        // Uncomment this line to cause the security tests to fail
        //demoFunciton.LambdaFunction.addToRolePolicy(new iam.PolicyStatement({ actions: [ "iam:CreateUser" ], resources: [ "*" ] }))

        const versionAlias = new lambda.Alias(this, 'alias', {
            aliasName: 'prod',
            version: demoFunciton.LambdaFunction.currentVersion,
        });

        this.ApiGateway = new apigw.LambdaRestApi(this, 'Gateway', {
            description: 'Endpoint for a simple Lambda-powered web service',
            handler: versionAlias
        });

        new codedeploy.LambdaDeploymentGroup(this, 'BlueGreenDeployment', {
            application: new codedeploy.LambdaApplication(this, 'CodeDeployApplication'),
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
    }
}
