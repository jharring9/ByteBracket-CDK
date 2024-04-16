import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  AllowedMethods,
  CachePolicy,
  Distribution,
  OriginRequestPolicy,
  PriceClass,
  ViewerProtocolPolicy,
} from "aws-cdk-lib/aws-cloudfront";
import { LoadBalancerV2Origin, S3Origin } from "aws-cdk-lib/aws-cloudfront-origins";
import { IApplicationLoadBalancer } from "aws-cdk-lib/aws-elasticloadbalancingv2";
import { Certificate } from "aws-cdk-lib/aws-certificatemanager";
import { DOMAIN_NAMES, SERVICE_DOMAIN, SERVICE_RECORD_NAME, SSL_CERT_ARN } from "./config";
import { Bucket } from "aws-cdk-lib/aws-s3";
import { ARecord, HostedZone, RecordTarget } from "aws-cdk-lib/aws-route53";
import { CloudFrontTarget } from "aws-cdk-lib/aws-route53-targets";

type CloudfrontStackProps = StackProps & {
  scope: Construct;
  id: string;
  alb: IApplicationLoadBalancer | null;
};

export class CloudfrontStack extends Stack {
  private readonly staticContentBucket: Bucket;
  private distribution: Distribution;
  constructor(props: CloudfrontStackProps) {
    super(props.scope, props.id, props);
    this.staticContentBucket = new Bucket(this, "StaticContent-Bucket");
    this.createARecord("TLD-ARecord", SERVICE_RECORD_NAME);

    if(props.alb !== null) {
      this.createDistribution(props.alb);
    }
  }

  get staticBucket(): Bucket {
    return this.staticContentBucket;
  }

  get distributionName(): string {
    return this.distribution.distributionId;
  }

  private createDistribution(alb: IApplicationLoadBalancer | null) {
    this.distribution = new Distribution(this, "CDN", {
      defaultBehavior: {
        origin: new S3Origin(this.staticContentBucket),
        compress: true,
        viewerProtocolPolicy: ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: AllowedMethods.ALLOW_ALL,
        cachePolicy: CachePolicy.CACHING_DISABLED,
      },
      additionalBehaviors: alb ? {
        "/v1*": {
          origin: new LoadBalancerV2Origin(alb),
          compress: true,
          viewerProtocolPolicy: ViewerProtocolPolicy.HTTPS_ONLY,
          allowedMethods: AllowedMethods.ALLOW_ALL,
          cachePolicy: CachePolicy.CACHING_DISABLED,
          originRequestPolicy: OriginRequestPolicy.ALL_VIEWER,
        },
      } : undefined,
      certificate: Certificate.fromCertificateArn(this, "Certificate", SSL_CERT_ARN),
      defaultRootObject: "/index.html",
      domainNames: DOMAIN_NAMES,
      enableLogging: false,
      priceClass: PriceClass.PRICE_CLASS_100,
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: "/index.html",
        },
      ],
      comment: "Frontend CDN for ByteBracket. Serves static frontend content and proxies API requests to the backend.",
    });
  }

  private createARecord(id: string, name: string) {
    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: SERVICE_DOMAIN,
    });
    new ARecord(this, id, {
      zone: zone,
      target: RecordTarget.fromAlias(new CloudFrontTarget(this.distribution)),
      recordName: name,
    });
  }
}
