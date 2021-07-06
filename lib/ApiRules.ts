import * as waf from '@aws-cdk/aws-wafv2';

export default [
    {
      name: "AWS-AWSManagedRulesCommonRuleSet",
      priority: 1,
      statement: {
        managedRuleGroupStatement: {
          vendorName: "AWS",
          name: "AWSManagedRulesCommonRuleSet"
        }
      },
      overrideAction: {
        none: {}
      },
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
      overrideAction: {
        none: {}
      },
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
          limit: 100,
        },
      },
      visibilityConfig: {
        sampledRequestsEnabled: true,
        cloudWatchMetricsEnabled: true,
        metricName: "RateLimits",
      },
    }
  ] as waf.CfnWebACL.RuleProperty[]