import {
    aws_codebuild as codebuild,
    aws_codestarnotifications as notifications,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import CodeArtifactPermissions from "./CodeArtifactPermissions";

const buildSpec = codebuild.BuildSpec.fromObject({
    version: "0.2",
    phases: {
        install: {
            commands: [
                `aws codeartifact login --tool npm --repository ${process.env.REPO_NAME} --domain ${process.env.DOMAIN_NAME} --domain-owner ${process.env.DEVOPS_ACCOUNT} --namespace demos && npm install`,
            ],
        },
        build: {
            commands: [
                "npm run build",
            ],
        },
        post_build: {
            commands: [
                "npm test",
            ]
        }
    }
});

export default function (PipelineStack: Construct, repoOwner: string, repoName: string) {

    const ciBuild = new codebuild.Project(PipelineStack, "CIBuild", {
        source: codebuild.Source.gitHub({
            owner: repoOwner,
            repo: repoName,
            webhook: true,
        }),
        buildSpec,
        environmentVariables: {
            REPO_NAME: { value: process.env.REPO_NAME },
            DOMAIN_NAME: { value: process.env.DOMAIN_NAME },
            DEVOPS_ACCOUNT: { value: process.env.DEVOPS_ACCOUNT },
        },
        environment: {
            buildImage: codebuild.LinuxBuildImage.STANDARD_5_0,
        },
    });

    CodeArtifactPermissions.forEach((policy) => {
        ciBuild.addToRolePolicy(policy);
    });

    if (process.env.SLACK_ARN !== undefined) {

        new notifications.CfnNotificationRule(PipelineStack, "FailedCIBuildNotifications", {
            name: "FailedCIBuilds",
            resource: ciBuild.projectArn,
            detailType: 'FULL',
            eventTypeIds: ['codebuild-project-build-state-failed', 'codebuild-project-build-state-succeeded'],
            targets: [{
                targetAddress: process.env.SLACK_ARN,
                targetType: 'AWSChatbotSlack'
            }],
        });
    }
}
