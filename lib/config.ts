/******** TOP-LEVEL CONFIGURATION ********/
export const IS_OFFSEASON = false;
export const SERVICE_NAME = "ByteBracket";
export const AWS_ENVIRONMENT = { account: "312042277619", region: "us-east-1" };
export const SERVICE_DOMAIN = "bytebracket.io";
export const SERVICE_RECORD_NAME = "bytebracket.io.";

/******** INFRASTRUCTURE CONFIGURATION ********/
export const REDIS_NODE_TYPE = "cache.t2.micro";

/******** GITHUB CONFIGURATION ********/
export const FRONTEND_REPO = "ByteBracket";
export const BACKEND_REPO = "ByteBracket-Backend";
export const CDK_REPO = "ByteBracket-CDK";
export const GITHUB_TOKEN_ARN = "arn:aws:secretsmanager:us-east-1:312042277619:secret:Github/PAT-zO8Xmx";
export const GITHUB_USER = "jharring9";

/******** REDIS CONFIGURATION ********/
export const REDIS_PORT = 6379;
export const NUM_REDIS_NODES = 1;
export const CACHE_DNS_SUBDOMAIN = "redis";

/******** CERTIFICATE CONFIGURATION ********/
export const SSL_CERT_ARN = "arn:aws:acm:us-east-1:312042277619:certificate/9cf55acf-3454-4428-83ee-4286c7655ff2";
export const DOMAIN_NAMES = ["bytebracket.io"];

/******** ECS CONFIGURATION ********/
export const TASK_HEALTH_CHECK_PATH = "/health";
export const SERVICE_TASK_PORT = 80;
export const SERVICE_DESIRED_COUNT = 1;
export const SERVICE_CPU = 2048;
export const SERVICE_MEMORY_LIMIT = 4096;
export const SERVICE_MAX_CAPACITY_MULTIPLIER = 10;
export const TARGET_CPU_UTILIZATION = 50;
export const ALB_DNS_SUBDOMAIN = "backend-alb";
