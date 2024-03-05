import { SecretValue } from "aws-cdk-lib";
import { Stack, StackProps } from "aws-cdk-lib";
import { Artifact, Pipeline } from "aws-cdk-lib/aws-codepipeline";
import { PipelineType } from "aws-cdk-lib/aws-codepipeline";
import { GitHubSourceAction, CodeBuildAction, EcsDeployAction } from "aws-cdk-lib/aws-codepipeline-actions";
import { LinuxBuildImage, PipelineProject } from "aws-cdk-lib/aws-codebuild";
import { BuildSpec, ComputeType } from "aws-cdk-lib/aws-codebuild";
import { BACKEND_REPO, GITHUB_TOKEN_ARN, GITHUB_USER, SERVICE_NAME } from "./config";
import { Construct } from "constructs";
import { FargateService } from "aws-cdk-lib/aws-ecs";
import { PolicyStatement } from "aws-cdk-lib/aws-iam";
import { Repository } from "aws-cdk-lib/aws-ecr";

type BackendPipelineStackProps = StackProps & {
  scope: Construct;
  id: string;
  ecsService: FargateService;
  ecrRepo: Repository;
};

export class BackendPipelineStack extends Stack {
  constructor(props: BackendPipelineStackProps) {
    super(props.scope, props.id, props);
    this.createPipeline(props.ecrRepo, props.ecsService);
  }

  private createPipeline(ecrRepo: Repository, ecsService: FargateService) {
    const buildProject = new PipelineProject(this, `${SERVICE_NAME}-Backend-Pipeline-CodeBuild`, {
      buildSpec: BuildSpec.fromSourceFilename("buildspec.yml"),
      environment: {
        buildImage: LinuxBuildImage.AMAZON_LINUX_2_5,
        computeType: ComputeType.SMALL,
      },
      environmentVariables: {
        AWS_DEFAULT_REGION: { value: this.region },
        AWS_ACCOUNT_ID: { value: this.account },
        IMAGE_REPO_NAME: { value: ecrRepo.repositoryName },
        IMAGE_REPO_URI: { value: ecrRepo.repositoryUri },
        IMAGE_TAG: { value: "latest" },
      },
    });

    buildProject.addToRolePolicy(
      new PolicyStatement({
        actions: [
          "ecr:CompleteLayerUpload",
          "ecr:GetAuthorizationToken",
          "ecr:UploadLayerPart",
          "ecr:InitiateLayerUpload",
          "ecr:BatchCheckLayerAvailability",
          "ecr:PutImage",
        ],
        resources: ["*"],
      })
    );

    // Source artifact
    const sourceOutput = new Artifact(`${SERVICE_NAME}-Backend-Source`);

    // Build artifact
    const buildOutput = new Artifact(`${SERVICE_NAME}-Backend-Build`);

    // Pipeline declaration
    const pipeline = new Pipeline(this, `${SERVICE_NAME}-Backend-Pipeline`, {
      pipelineName: `${SERVICE_NAME}-Backend-Pipeline`,
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
          repo: BACKEND_REPO,
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
        }),
      ],
    });

    // Deploy stage
    pipeline.addStage({
      stageName: "Deploy",
      actions: [
        new EcsDeployAction({
          actionName: "ECS_Deploy",
          service: ecsService,
          input: buildOutput,
        }),
      ],
    });
  }
}
