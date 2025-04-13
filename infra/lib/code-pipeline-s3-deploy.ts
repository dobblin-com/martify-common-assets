import { Construct } from "constructs";
import { RemovalPolicy, SecretValue } from "aws-cdk-lib";
import * as secretsmanager from "aws-cdk-lib/aws-secretsmanager";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as iam from "aws-cdk-lib/aws-iam";

interface CodePipelineS3DeployProps {
  github: {
    connectionArn: string;
    orgOrUserName: string;
    repoName: string;
    branchName: string;
  };
  domain: string;
  pipelineName: string;
  artifactBucketName: string;
  deployBucketName: string;
  infraRuntime: { nodejs: number };
  infraStacks: string[];
}

export class CodePipelineS3DeployConstruct extends Construct {
  constructor(scope: Construct, id: string, props: CodePipelineS3DeployProps) {
    super(scope, id);

    const {
      github,
      pipelineName,
      artifactBucketName,
      domain,
      deployBucketName,
      infraRuntime,
      infraStacks,
    } = props;

    const role = new iam.Role(this, "CodePipelineRole", {
      roleName: `${pipelineName}-codepipeline-role`,
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("codebuild.amazonaws.com"),
        new iam.ServicePrincipal("codepipeline.amazonaws.com")
      ),
    });

    const artifactBucket = new s3.Bucket(this, "ArtifactBucket", {
      bucketName: artifactBucketName,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["sts:assumeRole"],
        resources: ["arn:aws:iam::*:role/cdk-*"],
      })
    );
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ],
        resources: [`arn:aws:s3:::${deployBucketName}`, `arn:aws:s3:::${deployBucketName}/*`],
      })
    );
    
    role.addToPolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:ListDistributions", "cloudfront:CreateInvalidation"],
        resources: ["*"],
      })
    );
    

    const sourceOutput = new codepipeline.Artifact();
    const pipeline = new codepipeline.Pipeline(this, "CodePipeline", {
      pipelineName,
      pipelineType: codepipeline.PipelineType.V2,
      restartExecutionOnUpdate: false,
      artifactBucket,
      role: role,
    });

    const sourceAction =
      new codepipeline_actions.CodeStarConnectionsSourceAction({
        actionName: "Source",
        connectionArn: github.connectionArn,
        output: sourceOutput,
        owner: github.orgOrUserName,
        repo: github.repoName,
        branch: github.branchName,
        role: role,
      });

    const deployInfraProject = new codebuild.Project(
      this,
      "DeployInfraProject",
      {
        projectName: `${pipelineName}-infra-deploy`,
        environment: {
          buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
        },
        environmentVariables: {
          STACK_NAME: { value: infraStacks.join(" ") },
        },
        buildSpec: codebuild.BuildSpec.fromObject({
          version: "0.2",
          phases: {
            install: {
              "runtime-versions": infraRuntime,
              commands: ["cd infra && npm install"],
            },
            build: {
              commands: [
                "npm run cdk -- deploy $STACK_NAME --require-approval never",
              ],
            },
          },
        }),
        role: role,
      }
    );

    const deployAppProject = new codebuild.Project(this, "DeployS3Project", {
      projectName: `${pipelineName}-app-deploy`,
      environment: {
        buildImage: codebuild.LinuxBuildImage.STANDARD_6_0,
      },
      environmentVariables: {
        S3_BUCKET: { value: deployBucketName },
        CUSTOM_DOMAIN: { value: domain },
      },
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: [
              "echo Deploying to S3 Bucket : $S3_BUCKET",
              "aws s3 sync ./ s3://$S3_BUCKET --delete",
              "echo Trying to find Cloudfront Distribution for domain $CUSTOM_DOMAIN",
              "DISTRIBUTION_ID=$(aws cloudfront list-distributions --query \"DistributionList.Items[?Aliases.Items[?@=='$CUSTOM_DOMAIN']].Id | [0]\" --output text)",
              "echo Found CloudFront Distribution: $DISTRIBUTION_ID",
              "aws cloudfront create-invalidation --distribution-id $DISTRIBUTION_ID --paths '/*'",
            ],
          },
        },
      }),
      role: role,
    });

    const deployInfraAction = new codepipeline_actions.CodeBuildAction({
      actionName: "DeployInfra",
      project: deployInfraProject,
      input: sourceOutput,
      runOrder: 1,
      role: role,
    });

    const deployAppAction = new codepipeline_actions.CodeBuildAction({
      actionName: "DeployApp",
      project: deployAppProject,
      input: sourceOutput,
      runOrder: 2,
      role: role,
    });

    pipeline.addStage({
      stageName: "Source",
      actions: [sourceAction],
    });
    pipeline.addStage({
      stageName: "Deploy",
      actions: [deployInfraAction, deployAppAction],
    });
  }
}
