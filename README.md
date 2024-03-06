# ByteBracket CDK

1. Make sure the github key is saved as plaintext in the AWS Secrets Manager as `github-token`
2. Deploy _just_ the CDK pipeline stack: `cdk deploy ByteBracket-CdkPipelineStack`. Other stacks will be created by the pipeline.
3. Let the service create itself

* `npm run build`   compile typescript to js
* `cdk deploy`      deploy this stack to your default AWS account/region
* `cdk diff`        compare deployed stack with current state
* `cdk synth`       emits the synthesized CloudFormation template  
