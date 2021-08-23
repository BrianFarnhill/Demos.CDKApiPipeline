import {
    aws_apigateway as apigw,
    aws_wafv2 as waf,
    aws_cloudwatch as cw,
} from "aws-cdk-lib";
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";

interface RestApiWafProps {
    ApiGateway: apigw.IRestApi;
}

function GetApiRules(mode: "COUNT" | "BLOCK"): waf.CfnWebACL.RuleProperty[] {
    return [
        {
            name: "AWS-AWSManagedRulesCommonRuleSet",
            priority: 1,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesCommonRuleSet"
                }
            },
            overrideAction: mode === "BLOCK" ? { none: {} } : { count: {} },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesCommonRuleSet"
            }
        },
        {
            name: "AWS-AWSManagedRulesKnownBadInputsRuleSet",
            priority: 2,
            statement: {
                managedRuleGroupStatement: {
                    vendorName: "AWS",
                    name: "AWSManagedRulesKnownBadInputsRuleSet"
                }
            },
            overrideAction: mode === "BLOCK" ? { none: {} } : { count: {} },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "AWS-AWSManagedRulesKnownBadInputsRuleSet"
            }
        },
        {
            name: "DefaultRateLimit",
            action: { block: {} },
            priority: 3,
            statement: {
                rateBasedStatement: {
                    aggregateKeyType: "IP",
                    limit: 500,
                },
            },
            visibilityConfig: {
                sampledRequestsEnabled: true,
                cloudWatchMetricsEnabled: true,
                metricName: "RateLimits",
            },
        }
    ]
}

export default class extends Construct {

    constructor(scope: Construct, id: string, props: RestApiWafProps) {
        super(scope, id);

        const acl = new waf.CfnWebACL(this, "APIACL", {
            defaultAction: { allow: {} },
            scope: "REGIONAL",
            rules: GetApiRules("BLOCK"),
            visibilityConfig: {
                cloudWatchMetricsEnabled: true,
                metricName: "waf",
                sampledRequestsEnabled: true,
            },
        });

        const association = new waf.CfnWebACLAssociation(this, "ApiWafAssociation", {
            resourceArn: `arn:${cdk.Aws.PARTITION}:apigateway:${cdk.Aws.REGION}::/restapis/${props.ApiGateway.restApiId}/stages/prod`,
            webAclArn: acl.attrArn,
        });
        association.node.addDependency(props.ApiGateway);

        new cw.Dashboard(this, "WAFMonitoring", {
            dashboardName: "LambdaAPI-WafMetrics",
            widgets: [
                [
                    new cw.GraphWidget({
                        height: 6,
                        width: 18,
                        left: [new cw.Metric({
                            metricName: "BlockedRequests", namespace: "AWS/WAFV2", dimensionsMap: {
                                WebACL: cdk.Fn.select(0, cdk.Fn.split("|", acl.ref)),
                                Region: cdk.Aws.REGION,
                                Rule: "ALL",
                            }
                        }),
                        ]
                    }),
                ],
                [
                    new cw.GraphWidget({
                        height: 6,
                        width: 18,
                        left: [new cw.Metric({
                            metricName: "AllowedRequests", namespace: "AWS/WAFV2", dimensionsMap: {
                                WebACL: cdk.Fn.select(0, cdk.Fn.split("|", acl.ref)),
                                Region: cdk.Aws.REGION,
                                Rule: "ALL",
                            }
                        }),
                        ]
                    }),
                ],
            ],
        })
    }
}
