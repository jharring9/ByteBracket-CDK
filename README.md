# ByteBracket CDK

1. Make sure the github key is saved as plaintext in the AWS Secrets Manager as `github-token`
2. Change the fargate task definition image to `ContainerImage.fromRegistry("amazon/amazon-ecs-sample")`. This needs to be committed so the pipeline can build the image (it will fail if we use the newly created repository, because nothing will be in it yet).
3. Comment out the health check configuration. It will use a default health check of `/` which is needed for the sample ECS image.
4. Deploy _just_ the CDK pipeline stack: `cdk deploy ByteBracket-CdkPipelineStack`. Other stacks will be created by the pipeline.
5. Change the fargate task definition image back to `ContainerImage.fromEcrRepository(repository)`
6. Commit and push the changes to the repository. The pipeline will build the image and deploy the stack.

* `npm run build`   compile typescript to js
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template  
