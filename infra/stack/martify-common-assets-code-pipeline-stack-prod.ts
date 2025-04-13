import { Construct } from "constructs";
import { Stack, StackProps, Tags } from "aws-cdk-lib";

import variables from "./variables/prod.json";
import { CodePipelineS3DeployConstruct } from "../lib/code-pipeline-s3-deploy";

export class MartifyCommonAssetsCodePipelineStackProd extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    Tags.of(this).add("X:ENVIRONMENT", "PROD");

    new CodePipelineS3DeployConstruct(this, "AppCodePipeline", {
      pipelineName: variables.codePipelineName,
      artifactBucketName: `codepipeline-${variables.appDomain}`,
      domain: variables.appDomain,
      deployBucketName: variables.appDomain,
      github: {
        connectionArn: variables.githubConnectionArn,
        orgOrUserName: variables.githubOrg,
        repoName: variables.githubRepo,
        branchName: variables.githubBranch,
      },
      infraRuntime: variables.infraRuntime,
      infraStacks: variables.infraStacks,
    });
  }
}
