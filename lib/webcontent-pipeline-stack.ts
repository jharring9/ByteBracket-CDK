import { SecretValue } from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { PipelineType } from "aws-cdk-lib/aws-codepipeline";
import { GitHubSourceAction, CodeBuildAction, S3DeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { BuildEnvironmentVariableType, LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import { BuildSpec, ComputeType } from "aws-cdk-lib/aws-codebuild";
import { FRONTEND_REPO, GITHUB_TOKEN_ARN, GITHUB_USER } from "./config";
import { Construct } from "constructs";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { Effect, PolicyStatement } from "aws-cdk-lib/aws-iam";

type PipelineProps = StackProps & {
  scope: Construct;
  id: string;
  staticContentBucket: Bucket;
  distribution: string;
};

export class WebcontentPipelineStack extends Stack {
  constructor(props: PipelineProps) {
    super(props.scope, props.id, props);
    this.createPipeline(props.distribution, props.staticContentBucket);
  }

  private createPipeline(distributionId: string, staticContentBucket: Bucket) {
    const buildProject = new PipelineProject(this, "Frontend-Pipeline-CodeBuild", {
      buildSpec: BuildSpec.fromSourceFilename("buildspec.yml"),
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
        computeType: ComputeType.SMALL,
      },
    });

    // Give CodeBuild permissions to invalidate CDN cache
    buildProject.addToRolePolicy(
      new PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        effect: Effect.ALLOW,
        resources: [`arn:aws:cloudfront::${this.account}:distribution/${distributionId}`],
      })
    );

    // Source artifact
    const sourceOutput = new Artifact("Frontend-Source");

    // Build artifact
    const buildOutput = new Artifact("Frontend-Build");

    // Pipeline declaration
    const pipeline = new Pipeline(this, "Frontend-Pipeline", {
      pipelineName: "Frontend-Pipeline",
      restartExecutionOnUpdate: true,
      pipelineType: PipelineType.V2,
    });

    // Source stage
    pipeline.addStage({
      stageName: "Source",
      actions: [
        new GitHubSourceAction({
          actionName: "GitHub_Source",
          owner: GITHUB_USER,
          repo: FRONTEND_REPO,
          oauthToken: SecretValue.secretsManager(GITHUB_TOKEN_ARN),
          output: sourceOutput,
          branch: "main",
        }),
      ],
    });

    // Build stage
    pipeline.addStage({
      stageName: "Build",
      actions: [
        new CodeBuildAction({
          actionName: "Build",
          project: buildProject,
          input: sourceOutput,
          outputs: [buildOutput],
          environmentVariables: {
            CLOUDFRONT_DISTRIBUTION_ID: {
              value: distributionId,
              type: BuildEnvironmentVariableType.PLAINTEXT,
            },
          },
        }),
      ],
    });

    // Deploy stage
    pipeline.addStage({
      stageName: "Deploy",
      actions: [
        new S3DeployAction({
          actionName: "S3_Deploy",
          bucket: staticContentBucket,
          input: buildOutput,
        }),
      ],
    });
  }
}
