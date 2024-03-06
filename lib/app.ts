#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { AWS_ENVIRONMENT, SERVICE_NAME } from "./config";
import { CdkPipelineStack } from "./cdk-pipeline-stack";

const app = new App();

new CdkPipelineStack({
  scope: app,
  id: `${SERVICE_NAME}-CdkPipelineStack`,
  env: AWS_ENVIRONMENT,
  description:
    "Defines the continuous deployment pipeline for the CDK-managed infrastructure. All infrastructure is created from within this pipeline stack.",
});
