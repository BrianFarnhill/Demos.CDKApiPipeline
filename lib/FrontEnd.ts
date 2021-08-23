import * as cdk from "aws-cdk-lib";
import {
    aws_apigateway as apigw,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as cforigins,
    aws_s3 as s3,
    aws_s3_deployment as s3deploy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import * as path from "path";

interface FrontEndProps {
    ApiGateway: apigw.IRestApi;
}

export default class extends Construct {

    constructor(scope: Construct, id: string, props: FrontEndProps) {
        super(scope, id);

        const sitebucket = new s3.Bucket(this, "SiteBucket", {
            blockPublicAccess: {
                blockPublicAcls: true,
                blockPublicPolicy: true,
                ignorePublicAcls: true,
                restrictPublicBuckets: true,
            },
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        const distro = new cloudfront.Distribution(this, "DemoSite", {
            defaultBehavior: {
                origin: new cforigins.S3Origin(sitebucket),
            },
            additionalBehaviors: {
                "/prod": {
                    origin: new cforigins.HttpOrigin(`${props.ApiGateway.restApiId}.execute-api.${cdk.Aws.REGION}.amazonaws.com`),
                    cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                },
            },
            defaultRootObject: "index.html",
        });
        new s3deploy.BucketDeployment(this, "SiteDeploy", {
            destinationBucket: sitebucket,
            sources: [
                s3deploy.Source.asset(path.resolve(__dirname, "../website")),
            ],
            distribution: distro,
        });
    }
}
