import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { Vpc } from "aws-cdk-lib/aws-ec2";
import { AwsLogDriver, Cluster, ContainerImage, FargateService, FargateTaskDefinition } from "aws-cdk-lib/aws-ecs";
import {
  ALB_DNS_SUBDOMAIN,
  SERVICE_DESIRED_COUNT,
  SERVICE_DOMAIN,
  SERVICE_MAX_CAPACITY_MULTIPLIER,
  SERVICE_TASK_PORT,
  SSL_CERT_ARN,
  TARGET_CPU_UTILIZATION,
  TASK_HEALTH_CHECK_PATH,
} from "./config";
import { ApplicationLoadBalancer, ApplicationProtocol } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { Repository } from "aws-cdk-lib/aws-ecr";
import { Role } from "aws-cdk-lib/aws-iam";
import { RetentionDays } from "aws-cdk-lib/aws-logs";
import { LoadBalancerTarget } from "aws-cdk-lib/aws-route53-targets";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";

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
    this.createARecord("Backend-ARecord", ALB_DNS_SUBDOMAIN);
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
    this.vpc = new Vpc(this, "BackendVpc", { maxAzs: 2 });
  }

  private createFargateService() {
    const cluster = new Cluster(this, "EcsCluster", {
      vpc: this.vpc,
    });

    const fargateTaskDefinition = new FargateTaskDefinition(this, "FargateTaskDefinition", {
      // TODO -- set memory and cpu limits higher
      executionRole: Role.fromRoleArn(
        this,
        "Backend-ExecutionRole",
        "arn:aws:iam::312042277619:role/ecsTaskExecutionRole"
      ),
      taskRole: Role.fromRoleArn(this, "Backend-TaskRole", "arn:aws:iam::312042277619:role/ECS-ByteBracket-Role"),
    }); // TODO -- make roles from scratch, rather than importing from ARN, for reproducibility

    // Create managed ECR repository for fargate image:
    this.ecrRepo = new Repository(this, "Backend-EcrRepo", {
      repositoryName: "Backend-EcrRepo".toLowerCase(),
    });

    // Add container to fargate task definition:
    fargateTaskDefinition.addContainer("Container", {
      image: ContainerImage.fromEcrRepository(this.ecrRepo),
      portMappings: [{ containerPort: SERVICE_TASK_PORT }],
      logging: new AwsLogDriver({
        streamPrefix: "Backend-Container",
        logRetention: RetentionDays.ONE_WEEK,
      }),
    });
    this.service = new FargateService(this, "FargateService", {
      cluster: cluster,
      taskDefinition: fargateTaskDefinition,
    });
  }

  private createLoadBalancer() {
    this.alb = new ApplicationLoadBalancer(this, "Backend-ALB", {
      vpc: this.vpc,
      internetFacing: true,
    });
    const listener = this.alb.addListener("ALB-Listener", {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      certificates: [Certificate.fromCertificateArn(this, "Certificate", SSL_CERT_ARN)],
    });
    listener.addTargets("ALB-Targets", {
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
    scalableTarget.scaleOnCpuUtilization("CpuScaling", {
      targetUtilizationPercent: TARGET_CPU_UTILIZATION,
    });
    // TODO -- create request count scaling? or latency scaling?
  }

  private createARecord(id: string, name: string) {
    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: SERVICE_DOMAIN,
    });
    new ARecord(this, id, {
      zone: zone,
      target: RecordTarget.fromAlias(new LoadBalancerTarget(this.alb)),
      recordName: name,
    });
  }
}
