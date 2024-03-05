import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { Cluster, ContainerImage, FargateService, FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import {
  SERVICE_DESIRED_COUNT,
  SERVICE_MAX_CAPACITY_MULTIPLIER,
  SERVICE_NAME,
  SERVICE_TASK_PORT,
  SSL_CERT_ARN,
  TARGET_CPU_UTILIZATION,
  TASK_HEALTH_CHECK_PATH,
} from "./config";
import { ApplicationLoadBalancer, ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Role } from "aws-cdk-lib/aws-iam";

type EcsClusterStackProps = StackProps & {
  scope: Construct;
  id: string;
};

export class EcsClusterStack extends Stack {
  private vpc: Vpc;
  private service: FargateService;
  private alb: ApplicationLoadBalancer;
  private ecrRepo: Repository;
  constructor(props: EcsClusterStackProps) {
    super(props.scope, props.id, props);
    this.createSharedVpc();
    this.createFargateService();
    this.createLoadBalancer();
    this.createAutoScaling();
    // TODO -- enable logging for fargate tasks
  }

  get getVpc(): Vpc {
    return this.vpc;
  }

  get getLoadBalancer(): ApplicationLoadBalancer {
    return this.alb;
  }

  get getService(): FargateService {
    return this.service;
  }

  get getEcrRepo(): Repository {
    return this.ecrRepo;
  }

  private createSharedVpc() {
    this.vpc = new Vpc(this, `${SERVICE_NAME}-BackendVpc`, { maxAzs: 2 });
  }

  private createFargateService() {
    const cluster = new Cluster(this, `${SERVICE_NAME}-EcsCluster`, {
      vpc: this.vpc,
    });

    const fargateTaskDefinition = new FargateTaskDefinition(this, `${SERVICE_NAME}-FargateTaskDefinition`, {
      // TODO -- set memory and cpu limits higher
      executionRole: Role.fromRoleArn(
        this,
        `${SERVICE_NAME}-Backend-ExecutionRole`,
        "arn:aws:iam::312042277619:role/ecsTaskExecutionRole"
      ),
      taskRole: Role.fromRoleArn(
        this,
        `${SERVICE_NAME}-Backend-TaskRole`,
        "arn:aws:iam::312042277619:role/ECS-ByteBracket-Role"
      ),
    }); // TODO -- make roles from scratch, rather than importing from ARN, for reproducibility

    // Create managed ECR repository for fargate image:
    this.ecrRepo = new Repository(this, `${SERVICE_NAME}-Backend-EcrRepo`, {
      repositoryName: `${SERVICE_NAME}-Backend-EcrRepo`.toLowerCase(),
    });

    // Add container to fargate task definition:
    fargateTaskDefinition.addContainer(`${SERVICE_NAME}-Container`, {
      image: ContainerImage.fromEcrRepository(this.ecrRepo),
      portMappings: [{ containerPort: SERVICE_TASK_PORT }],
    });
    this.service = new FargateService(this, `${SERVICE_NAME}-FargateService`, {
      cluster: cluster,
      taskDefinition: fargateTaskDefinition,
    });
  }

  private createLoadBalancer() {
    this.alb = new ApplicationLoadBalancer(this, `${SERVICE_NAME}-Backend-ALB`, {
      vpc: this.vpc,
      internetFacing: true,
    });
    const listener = this.alb.addListener(`${SERVICE_NAME}-ALB-Listener`, {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [Certificate.fromCertificateArn(this, `${SERVICE_NAME}-Certificate`, SSL_CERT_ARN)],
    });
    listener.addTargets(`${SERVICE_NAME}-ALB-Targets`, {
      port: SERVICE_TASK_PORT,
      targets: [this.service],
      healthCheck: {
        path: TASK_HEALTH_CHECK_PATH,
      },
    });
  }

  private createAutoScaling() {
    const scalableTarget = this.service.autoScaleTaskCount({
      minCapacity: SERVICE_DESIRED_COUNT,
      maxCapacity: SERVICE_DESIRED_COUNT * SERVICE_MAX_CAPACITY_MULTIPLIER,
    });
    scalableTarget.scaleOnCpuUtilization(`${SERVICE_NAME}-CpuScaling`, {
      targetUtilizationPercent: TARGET_CPU_UTILIZATION,
    });
    // TODO -- create request count scaling? or latency scaling?
  }
}
