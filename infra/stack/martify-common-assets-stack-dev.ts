import { Construct } from "constructs";
import { Stack, StackProps, Tags } from "aws-cdk-lib";
import { S3HostingConstruct } from "../lib/s3-hosting";

import variables from "./variables/dev.json";

export class MartifyCommonAssetsStackDev extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("X:ENVIRONMENT", "DEV");

    const s3Hosting = new S3HostingConstruct(this, "AppHosting", {
      domain: variables.appDomain,
      hostedZoneDomain: variables.hostedZoneDomain,
      certificateArn: variables.cloudfrontCertificateArn,
      removeOnDestroy: true,
      wwwRedirect: true
    });
  }
}
