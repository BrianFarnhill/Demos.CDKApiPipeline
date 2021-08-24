import * as cdk from 'aws-cdk-lib';
import {
    aws_iam as iam,
} from "aws-cdk-lib";

export default [
    new iam.PolicyStatement({
        actions: ["codeartifact:Get*", "codeartifact:List*", "codeartifact:Describe*", "codeartifact:ReadFromRepository"],
        resources: [
            `arn:aws:codeartifact:${cdk.Aws.REGION}:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}/${process.env.REPO_NAME}`,
            `arn:aws:codeartifact:${cdk.Aws.REGION}:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}`,
            `arn:aws:codeartifact:${cdk.Aws.REGION}:${process.env.DEVOPS_ACCOUNT}:repository/${process.env.DOMAIN_NAME}/${process.env.REPO_NAME}/*/*/*`,
        ],
    }),
    new iam.PolicyStatement({
        actions: ["codeartifact:GetAuthorizationToken"],
        resources: [`arn:aws:codeartifact:${cdk.Aws.REGION}:${process.env.DEVOPS_ACCOUNT}:domain/${process.env.DOMAIN_NAME}`],
    }),
    new iam.PolicyStatement({ actions: ["sts:GetServiceBearerToken"], resources: ["*"] }),
];