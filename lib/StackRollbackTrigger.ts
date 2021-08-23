import {
    aws_lambda as lambda,
    aws_codedeploy as codedeploy,
    aws_cloudwatch as cw,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface StackRollbackTriggerProps {
    Alarms: cw.Alarm[];
}

export default class extends Construct {

    CanaryFailingAlarm: cw.Alarm;

    constructor(scope: Construct, id: string, props: StackRollbackTriggerProps) {
        super(scope, id);

        const stubLambda = new lambda.Function(this, "Stub", {
            code: lambda.AssetCode.fromInline(`console.log("Stub last generated at ${Date.now().toString()}")`),
            handler: "index.handler",
            runtime: lambda.Runtime.NODEJS_12_X,
        });

        const stubAlias = new lambda.Alias(this, 'StubAlias', {
            aliasName: 'prod',
            version: stubLambda.currentVersion,
        });

        new codedeploy.LambdaDeploymentGroup(this, 'StubDeployment', {
            application: new codedeploy.LambdaApplication(this, 'StackRollbackTriggerApplication'),
            autoRollback: {
                deploymentInAlarm: false,
                failedDeployment: false,
                stoppedDeployment: false,
            },
            alias: stubAlias,
            deploymentConfig: codedeploy.LambdaDeploymentConfig.LINEAR_10PERCENT_EVERY_1MINUTE,
            alarms: props.Alarms,
        });
    }
}
