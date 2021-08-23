import * as cdk from "aws-cdk-lib";
import {
    aws_ssmincidents as incidentmanager,
    aws_cloudwatch as cw,
} from "aws-cdk-lib";
import { Construct } from "constructs";

interface IncidentResponseProps {
    SyntheticFailureAlarm: cw.Alarm;
}

export default class extends Construct {

    CanaryFailingAlarm: cw.Alarm;

    constructor(scope: Construct, id: string, props: IncidentResponseProps) {
        super(scope, id);

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
    
        const rawAlarm = props.SyntheticFailureAlarm.node.defaultChild as cw.CfnAlarm;
        rawAlarm.alarmActions = [ responsePlan.attrArn ];
    }
}
