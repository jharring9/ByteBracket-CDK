#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { AWS_ENVIRONMENT, SERVICE_NAME } from "./config";
import { CloudfrontStack } from "./cloudfront-stack";
import { WebcontentPipelineStack } from "./webcontent-pipeline-stack";
import { BackendPipelineStack } from "./backend-pipeline-stack";
import { EcsClusterStack } from "./ecs-cluster-stack";
import { RedisStack } from "./redis-stack";
import { CdkPipelineStack } from "./cdk-pipeline-stack";

const app = new App();

const cdkPipelineStack = new CdkPipelineStack({
  scope: app,
  id: `${SERVICE_NAME}-CdkPipelineStack`,
  env: AWS_ENVIRONMENT,
  description: "Defines the continuous deployment pipeline for the CDK-managed infrastructure.",
});

const ecsClusterStack = new EcsClusterStack({
  scope: app,
  id: `${SERVICE_NAME}-EcsClusterStack`,
  env: AWS_ENVIRONMENT,
  description: "Defines the ECS cluster and service for the backend service.",
});

const backendPipelineStack = new BackendPipelineStack({
  scope: app,
  id: `${SERVICE_NAME}-BackendPipelineStack`,
  ecsService: ecsClusterStack.getService,
  ecrRepo: ecsClusterStack.getEcrRepo,
  env: AWS_ENVIRONMENT,
  description: "Defines the continuous deployment pipeline for the backend Fargate service.",
});

const cloudfrontStack = new CloudfrontStack({
  scope: app,
  id: `${SERVICE_NAME}-CloudfrontStack`,
  alb: ecsClusterStack.getLoadBalancer,
  env: AWS_ENVIRONMENT,
  description:
    "Defines the static website bucket and Cloudfront distribution, and sets up the DNS records for the website.",
});

const webcontentPipelineStack = new WebcontentPipelineStack({
  scope: app,
  id: `${SERVICE_NAME}-WebcontentPipelineStack`,
  staticContentBucket: cloudfrontStack.staticBucket,
  distribution: cloudfrontStack.distributionName,
  env: AWS_ENVIRONMENT,
  description: "Defines the continuous deployment pipeline for the frontend content.",
});

const redisStack = new RedisStack({
  scope: app,
  id: `${SERVICE_NAME}-RedisStack`,
  vpc: ecsClusterStack.getVpc,
  env: AWS_ENVIRONMENT,
  description: "Defines the Redis cluster for the backend service.",
});

// TODO -- create DynamoDB stack
