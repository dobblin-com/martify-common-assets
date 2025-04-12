import { Construct } from "constructs";
import { Duration, RemovalPolicy } from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import * as route53Targets from "aws-cdk-lib/aws-route53-targets";
import * as cloudfrontOrigins from "aws-cdk-lib/aws-cloudfront-origins";

interface S3HostingProps {
  domain: string;
  hostedZoneDomain: string;
  certificateArn: string;
  removeOnDestroy?: boolean;
  allowCors?: boolean;
  wwwRedirect?: boolean;
}

export class S3HostingConstruct extends Construct {
  constructor(scope: Construct, id: string, props: S3HostingProps) {
    super(scope, id);

    const {
      hostedZoneDomain,
      domain,
      certificateArn,
      removeOnDestroy,
      allowCors,
      wwwRedirect,
    } = props;

    // S3 Bucket for app hosting
    const bucket = new s3.Bucket(this, "Bucket", {
      bucketName: domain,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      accessControl: s3.BucketAccessControl.PRIVATE,
      enforceSSL: true,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html",
      removalPolicy: removeOnDestroy ? RemovalPolicy.DESTROY : undefined,
      cors: allowCors
        ? [
            {
              allowedOrigins: ["*"],
              allowedMethods: [s3.HttpMethods.GET],
              allowedHeaders: ["*"],
              exposedHeaders: [],
            },
          ]
        : undefined,
    });

    // Use the imported certificate ARN
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      "Certificate",
      certificateArn
    );

    // CloudFront distribution for the static site
    const distribution = new cloudfront.Distribution(this, "Distribution", {
      certificate: certificate,
      defaultRootObject: "index.html",
      domainNames: [domain],
      comment: domain,
      minimumProtocolVersion: cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(300),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
          ttl: Duration.seconds(300),
        },
      ],
      defaultBehavior: {
        origin:
          cloudfrontOrigins.S3BucketOrigin.withOriginAccessControl(bucket), // Using OAC for security
        compress: true,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
    });

    // Route53 Hosted Zone
    const hostedZone = route53.HostedZone.fromLookup(this, "HostedZone", {
      domainName: hostedZoneDomain,
    });

    // Route53 DNS Record for CloudFront
    new route53.ARecord(this, "A-Record", {
      zone: hostedZone,
      recordName: domain,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(distribution)
      ),
    });

    // Handle redirect if www is requested
    if (wwwRedirect) {
      const wwwDomain = `www.${domain}`;
      const wwwBucket = new s3.Bucket(this, "Bucket-WWW", {
        bucketName: wwwDomain,
        websiteRedirect: {
          hostName: domain,
        },
        publicReadAccess: true,
        blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS, // Block direct access via ACLs but allow redirects
        removalPolicy: removeOnDestroy ? RemovalPolicy.DESTROY : undefined,
      });

      // Create CloudFront for WWW redirect using OAC
      const redirectDistribution = new cloudfront.Distribution(
        this,
        "Distribution-WWW",
        {
          defaultRootObject: "index.html",
          domainNames: [wwwDomain],
          comment: wwwDomain,
          certificate: certificate,
          minimumProtocolVersion:
            cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
          defaultBehavior: {
            origin: new cloudfrontOrigins.S3StaticWebsiteOrigin(wwwBucket),
            compress: true,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
            viewerProtocolPolicy:
              cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          },
        }
      );

      new route53.ARecord(this, "A-Record-WWW", {
        zone: hostedZone,
        recordName: wwwDomain,
        target: route53.RecordTarget.fromAlias(
          new route53Targets.CloudFrontTarget(redirectDistribution)
        ),
      });
    }
  }
}
