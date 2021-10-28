import * as cdk from "aws-cdk-lib";
import {
    aws_apigateway as apigw,
    aws_synthetics as synth,
    aws_cloudwatch as cw,
    aws_s3 as s3,
    aws_iam as iam,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";
import * as fs from "fs";

interface SyntheticsProps {
    ApiGateway: apigw.IRestApi;
}

export default class extends Construct {

    CanaryFailingAlarm: cw.Alarm;

    constructor(scope: Construct, id: string, props: SyntheticsProps) {
        super(scope, id);

        const artifactBucket = new s3.Bucket(this, "SiteBucket", {
            blockPublicAccess: {
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true,
            },
            lifecycleRules: [{
                expiration: cdk.Duration.days(31),
            }],
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });

        const synthRole = new iam.Role(this, "SyntheticsRole", {
            assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
            inlinePolicies: {
                "Synethics": new iam.PolicyDocument({
                    statements: [
                        new iam.PolicyStatement({
                            actions: ["s3:GetBucketLocation"],
                            resources: [artifactBucket.bucketArn],
                        }),
                        new iam.PolicyStatement({
                            actions: ["logs:CreateLogStream", "logs:PutLogEvents", "logs:CreateLogGroup"],
                            resources: [`arn:aws:logs:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:log-group:/aws/lambda/cwsyn-test-*`],
                        }),
                        new iam.PolicyStatement({
                            actions: ["s3:ListAllMyBuckets", "xray:PutTraceSegments"],
                            resources: ["*"],
                        }),
                        new iam.PolicyStatement({
                            actions: ["cloudwatch:PutMetricData"],
                            resources: ["*"],
                            conditions: {
                                StringEquals: {
                                    "cloudwatch:namespace": "CloudWatchSynthetics"
                                }
                            }
                        }),
                    ],
                }),
            }
        });

        artifactBucket.grantWrite(synthRole);

        const canary = new synth.CfnCanary(this, "WafSynthetics", {
            artifactS3Location: `s3://${artifactBucket.bucketName}/`,
            code: {
                script: fs.readFileSync(path.resolve(__dirname, "../canaries/waf/index.js")).toString(),
                handler: "index.handler",
            },
            executionRoleArn: synthRole.roleArn,
            name: "waf-api-synthetic",
            runtimeVersion: "syn-nodejs-puppeteer-3.2",
            schedule: {
                expression: "rate(1 minute)",
            },
            startCanaryAfterCreation: true,
            runConfig: {
                environmentVariables: {
                    CANARY_HOSTNAME: `${props.ApiGateway.restApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`,
                },
            },
        });

        this.CanaryFailingAlarm = new cw.Alarm(this, "SyntheticsFailureAlarm", {
            evaluationPeriods: 1,
            metric: new cw.Metric({
                namespace: "CloudWatchSynthetics",
                metricName: "SuccessPercent",
                dimensionsMap: {
                    CanaryName: canary.ref,
                },
                period: cdk.Duration.minutes(1),
                statistic: "sum",
            }),
            threshold: 100,
            comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
            treatMissingData: cw.TreatMissingData.NOT_BREACHING,
        });
    }
}
