# CDK API release pipeline demo

This is a demo of how to release a serverless Amazon API Gateway that deploys to multiple accounts.

## Solution Overview

This solution uses the AWS CDK to create an API Gateway that calls a lambda function to generate
the response. This stack is then deployed to a dev account, and a production account - using AWS
CodePipeline, configured in another CDK stack.

The lambda function is provided through a custom CDK construct, that is provided through a private
AWS CodeArtifact repository. See the [SharedCDKConstruct](https://github.com/BrianFarnhill/Demos.SharedCDKConstruct)
demo repo for instructions on how to deploy that. This is a dependency of this project, and you
won't be able to successfully build, test and deploy this solution without it.

## Deploying this solution

### Setup

Before deploying this solution, you need the following:

1. A CodeArtifact repo with the [SharedCDKConstruct](https://github.com/BrianFarnhill/Demos.SharedCDKConstruct)
   package deployed to it.
2. Three AWS accounts:
   * One for the CodePipeline to run from
   * One for the "dev" account to run the workload from
   * One for the "production" account to run the workload from
3. All three accounts should be [bootstrapped](https://docs.aws.amazon.com/cdk/latest/guide/cdk_pipeline.html#cdk_pipeline_bootstrap)
   to run AWS CDK projects

### Update your source repo

In the file `./lib/PipelineStack.ts` update the `GitHubSourceAction` class to specify your own
GitHub repo as the source. You will also need to create a secret in AWS Secrets Manager called
`GitHubToken`, with the value being a plain text string that contains a [Personal Access Token](https://docs.github.com/en/github/authenticating-to-github/keeping-your-account-and-data-secure/creating-a-personal-access-token)
with access to your repos. This is how CodePipeline access the source code to trigger when
commits are pushed to the main branch.

### Configure shell variables

The solution will be deployed from CodePipeline, but to deploy the initial pipeline a number
of environment variables must be set in your shell environment for the initial deployment:

``` bash
export DEVOPS_ACCOUNT=[AWS Account ID that the pipeline runs in, and that has your CodeArtifact repo]
export DEV_ACCOUNT=[AWS Account ID that is the dev workload account]
export PROD_ACCOUNT=[AWS Account ID that is the production workload account]
export DOMAIN_NAME=[Your CodeArtifact domain name]
export REPO_NAME=[Your CodeArtifact repository name]
```

### Deploying the pipeline

To deploy the pipeline to the devops account, execute this command:

``` bash
npx cdk deploy PipelineStack
```

Once this has completed, the solution will deploy new versions automatically when code is pushed
to your GitHub repo, including updates to the pipeline itself. You should only need to manually
deploy the pipeline like this one.


## Other notes

### Why is there no package-lock.json file in here?

Great question - the short version is that when you use AWS CodeArtifact the full URL that your
repository runs at includes your AWS Account ID. Since this is a service that is normally used
for repositories that are private this wouldn't be a concern, but for the purposes of this demo
and me putting the code on GitHub, I've chosen to omit it. This also means that my CodeBuild 
for the CDK project is doing a full `npm install` instead of `npm ci`. If you don't understand
the implications of what having a package lock file in your project does I suggest taking some
time to read up on it, and making your own informed decisions about using it - but typically
speaking I would normally include one. 
