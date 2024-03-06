import { Construct } from "constructs";
import { Stack, StackProps } from "aws-cdk-lib";
import { Peer, Port, SecurityGroup, Vpc } from "aws-cdk-lib/aws-ec2";
import { CfnCacheCluster, CfnParameterGroup, CfnSubnetGroup } from "aws-cdk-lib/aws-elasticache";
import { CACHE_DNS_SUBDOMAIN, NUM_REDIS_NODES, REDIS_NODE_TYPE, REDIS_PORT, SERVICE_DOMAIN } from "./config";
import { CnameRecord, HostedZone } from "aws-cdk-lib/aws-route53";

type RedisStackProps = StackProps & {
  scope: Construct;
  id: string;
  vpc: Vpc;
};

export class RedisStack extends Stack {
  private parameterGroup: CfnParameterGroup;
  private securityGroup: SecurityGroup;
  private subnetGroup: CfnSubnetGroup;
  private redisCluster: CfnCacheCluster;
  constructor(props: RedisStackProps) {
    super(props.scope, props.id, props);
    this.createParameterGroup();
    this.createNetworkScaffolding(props.vpc);
    this.createCluster();
    this.createCnameRecord();
  }

  private createParameterGroup() {
    this.parameterGroup = new CfnParameterGroup(this, "RedisParameterGroup", {
      cacheParameterGroupFamily: "redis7",
      description: "Redis parameter group with Active Defragmentation enabled",
      properties: {
        activedefrag: "yes",
      },
    });
  }

  private createNetworkScaffolding(vpc: Vpc) {
    this.securityGroup = new SecurityGroup(this, "RedisSecurityGroup", {
      vpc: vpc,
    });
    this.securityGroup.addIngressRule(
      Peer.ipv4(vpc.vpcCidrBlock),
      Port.tcp(REDIS_PORT),
      "Allow traffic from ECS tasks in VPC to access Redis cluster"
    );
    this.securityGroup.connections.allowInternally(Port.tcp(REDIS_PORT), "Allow traffic within Redis cluster");
    this.subnetGroup = new CfnSubnetGroup(this, "RedisSubnetGroup", {
      description: "Private subnet group for Redis cluter",
      subnetIds: vpc.privateSubnets.map((subnet) => subnet.subnetId),
    });
  }

  private createCluster() {
    this.redisCluster = new CfnCacheCluster(this, "RedisCluster", {
      clusterName: "RedisCluster",
      engine: "redis",
      cacheNodeType: REDIS_NODE_TYPE,
      numCacheNodes: NUM_REDIS_NODES,
      port: REDIS_PORT,
      vpcSecurityGroupIds: [this.securityGroup.securityGroupId],
      cacheSubnetGroupName: this.subnetGroup.ref,
      cacheParameterGroupName: this.parameterGroup.ref,
    });
  }

  private createCnameRecord() {
    const zone = HostedZone.fromLookup(this, "HostedZone", {
      domainName: SERVICE_DOMAIN,
    });
    new CnameRecord(this, "Redis-CnameRecord", {
      zone: zone,
      domainName: this.redisCluster.attrRedisEndpointAddress,
      recordName: CACHE_DNS_SUBDOMAIN,
    });
  }
}
