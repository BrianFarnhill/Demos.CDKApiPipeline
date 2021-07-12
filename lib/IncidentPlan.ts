import * as cdk from "@aws-cdk/core";
import * as incidentmanager from "@aws-cdk/aws-ssmincidents";
import * as cw from "@aws-cdk/aws-cloudwatch";

export default function(scope: cdk.Construct, wafAlarm: cw.Alarm) {

    const chatChannel = process.env.SLACK_SNS_TOPIC_NAME ? {
        chatbotSns: [
            `arn:aws:sns:${cdk.Aws.REGION}:${cdk.Aws.ACCOUNT_ID}:${process.env.SLACK_SNS_TOPIC_NAME}`,
        ]
    } : undefined;

    const responsePlan = new incidentmanager.CfnResponsePlan(scope, "WAFResponsePlan", {
        name: "WAFAllowingBadTraffic",
        incidentTemplate: {
            title: "WAF allowing traffic that should be blocked",
            impact: 3,
            summary: `The WAF is allowing traffic that should be blocked (as tested by the canary).`,
        },
        displayName: "WAF allowing traffic that should be blocked",
        chatChannel,
    });

    const rawAlarm = wafAlarm.node.defaultChild as cw.CfnAlarm;
    rawAlarm.alarmActions = [ responsePlan.attrArn ];

}
