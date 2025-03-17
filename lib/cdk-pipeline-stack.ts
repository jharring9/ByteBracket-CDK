import { SecretValue, Stack, StackProps, Stage } from "aws-cdk-lib";
import { Construct } from "constructs";
import { CodePipeline, CodePipelineSource, ShellStep } from "aws-cdk-lib/pipelines";
import { AWS_ENVIRONMENT, CDK_REPO, GITHUB_TOKEN_ARN, GITHUB_USER, IS_OFFSEASON, SERVICE_NAME } from "./config";
import { EcsClusterStack } from "./ecs-cluster-stack";
import { BackendPipelineStack } from "./backend-pipeline-stack";
import { CloudfrontStack } from "./cloudfront-stack";
import { WebcontentPipelineStack } from "./webcontent-pipeline-stack";
import { RedisStack } from "./redis-stack";

type CdkPipelineStackProps = StackProps & {
  scope: Construct;
  id: string;
};

export class CdkPipelineStack extends Stack {
  constructor(props: CdkPipelineStackProps) {
    super(props.scope, props.id, props);

    const pipeline = new CodePipeline(this, `${SERVICE_NAME}-Cdk-Pipeline`, {
      pipelineName: `${SERVICE_NAME}-Cdk-Pipeline`,
      synth: new ShellStep("Synth", {
        input: CodePipelineSource.gitHub(`${GITHUB_USER}/${CDK_REPO}`, "main", {
          authentication: SecretValue.secretsManager(GITHUB_TOKEN_ARN),
        }),
        commands: ["npm ci", "npm run build", "npx cdk synth"],
      }),
    });

    pipeline.addStage(
      new CdkPipelineStage(this, SERVICE_NAME, {
        env: AWS_ENVIRONMENT,
      })
    );
  }
}

export class CdkPipelineStage extends Stage {
  private ecsClusterStack: EcsClusterStack;
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    if(!IS_OFFSEASON) {
      this.ecsClusterStack = new EcsClusterStack({
        scope: this,
        id: "EcsClusterStack",
        description: "Defines the ECS cluster and service for the backend service.",
      });

      new BackendPipelineStack({
        scope: this,
        id: "BackendPipelineStack",
        ecsService: this.ecsClusterStack.getService,
        ecrRepo: this.ecsClusterStack.getEcrRepo,
        description: "Defines the continuous deployment pipeline for the backend Fargate service.",
      });

      new RedisStack({
        scope: this,
        id: "RedisStack",
        vpc: this.ecsClusterStack.getVpc,
        description: "Defines the Redis cluster for the backend service.",
      });
    }

    const cloudfrontStack = new CloudfrontStack({
      scope: this,
      id: "CloudfrontStack",
      alb: this.ecsClusterStack ? this.ecsClusterStack.getLoadBalancer : null,
      description:
        "Defines the static website bucket and Cloudfront distribution, and sets up the DNS records for the website.",
    });

    new WebcontentPipelineStack({
      scope: this,
      id: "WebcontentPipelineStack",
      staticContentBucket: cloudfrontStack.staticBucket,
      distribution: cloudfrontStack.distributionName,
      description: "Defines the continuous deployment pipeline for the frontend content.",
    });
  }
}
