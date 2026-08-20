# AWS zero-charge launch architecture

**Researched:** 2026-08-20  
**Decision ticket:** [#5](https://github.com/da5ater/dailyxp/issues/5)  
**Constraint:** AWS credits are not spending authorization. No AWS resource was
created, changed, or deleted during this research.

## Decision

DailyXP can run a small **public alpha** on Mohamed's current AWS Free Plan
without an out-of-pocket AWS bill, provided that the account remains on the
Free Plan and the architecture below is kept inside Always Free allowances.
It cannot honestly promise both unlimited public traffic and permanent
zero-cost availability.

The launch architecture is:

```text
Omarchy plugin
  |-- local SQLite/event log, timers, notifications, sounds, share cards
  |-- HTTPS sync and social reads
  v
CloudFront pay-as-you-go distribution (*.cloudfront.net)
  |-- origin access control; no direct public Lambda origin
  |-- country and first-level region headers only on location suggestion
  v
One Ruby Lambda function / API-only Rails application
  |-- Function URL, AWS_IAM, no API Gateway, no VPC
  |-- no provisioned concurrency; short timeout and low memory
  v
One DynamoDB Standard table, provisioned capacity
  |-- aggregate table + index capacity capped below 25 RCU / 25 WCU
  |-- no auto scaling, PITR, on-demand backup, DAX, exports, or paid CDC
```

The backend supports accounts, idempotent synchronization, the XP ledger,
goals, milestones, tasks, routines, sessions, habits, recovery events, groups,
seasons, rankings, congratulations, and aggregated statistics. Desktop
notifications and share-card rendering stay on the client. Social
notifications use a DynamoDB inbox fetched during ordinary sync; there is no
push-notification service in the zero-charge launch.

This is a launch constraint, not the final scale architecture. Throttling and
temporary social unavailability are preferable to consuming credits.

## What the Free Plan actually guarantees

AWS documents the Free Plan as a proof-of-concept plan with no charges until
the customer deliberately upgrades. It ends at the earlier of six months or
credit exhaustion; AWS then closes the account. AWS retains the data for 90
days, but downloading it during that window requires upgrading to a paid plan.
The account also upgrades automatically if it joins AWS Organizations or uses
several enterprise programs. Those operations are prohibited for DailyXP.
[AWS Free Tier FAQ](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier-FAQ.html)

Usage beyond an Always Free allowance still has a pay-as-you-go cost. On a Free
Plan account the cost consumes credits rather than appearing as an AWS bill.
That is economically safer, but it is not permission to consume the credits.
[Explore AWS services with AWS Free Tier](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/free-tier.html)

Consequently:

- **Hard out-of-pocket boundary:** never call `UpgradeAccountPlan`, never join
  or create an Organization, and never configure Control Tower or another
  operation AWS identifies as an automatic upgrade.
- **Credit-preservation boundary:** use only the documented Always Free usage
  types, fixed low quotas, and application admission controls.
- **Availability boundary:** when capacity is reached, return `429` or serve
  cached/read-only data. Do not scale into paid usage.

## Verified live account facts

Read-only AWS CLI calls on 2026-08-20 established:

| Fact | Result |
|---|---|
| Account state | Active |
| Account plan | `FREE`, `ACTIVE` |
| Remaining Free Plan credits | USD 158.07 |
| Free Plan expiration | 2027-01-28 17:56:34 UTC |
| Configured region | `us-east-1` |
| Lambda concurrency quota in `us-east-1` | 10 |
| Configured AWS Budgets | None |
| Cost Explorer | Not enabled for this IAM user/account |
| Intended application resources | No Lambda functions, DynamoDB tables, API Gateway APIs, S3 buckets, CloudFront distributions, or log groups found |
| Idle-charge audit | No EC2 instances, EBS volumes, Elastic IPs, NAT gateways, RDS instances, load balancers, Secrets Manager secrets, or DynamoDB/Lambda application resources found in enabled regions; no Route 53 hosted zones |

The account ID recorded in issue #5 was stale and did not match the live
credentials. This report intentionally omits the replacement account ID; all
future automation must resolve it with `aws sts get-caller-identity` rather
than hard-code it.

The Free Tier API currently reports only negligible Always Free Lambda and
CloudWatch usage. It confirms the account-specific monthly Lambda allowances
of 1,000,000 requests and 400,000 GB-seconds, matching the published
[Lambda pricing](https://aws.amazon.com/lambda/pricing/). It also reports the
CloudWatch allowances used by this account, including 5 GB of log data, ten
standard alarm metrics, three basic dashboards, and one million API requests;
the public pricing page documents the same boundaries.
[CloudWatch pricing](https://aws.amazon.com/cloudwatch/pricing/)

## Component choices and hard limits

### Local-first Omarchy client

The timer and current activity must never depend on AWS. The plugin records an
append-only local event first, updates local projections, then syncs with a
stable event ID. Retries are idempotent. Loss of connectivity affects social
freshness, not sessions, habits, recovery counters, XP already earned locally,
or the comeback story.

The client also owns sounds, desktop notifications, statistics that can be
computed from local history, and share-card generation. This avoids storage,
rendering, and notification charges and keeps sensitive recovery history
useful while offline.

### CloudFront pay-as-you-go, not a flat-rate plan

Use the generated `*.cloudfront.net` hostname. Do not purchase a domain or
create a Route 53 hosted zone. CloudFront's ordinary free tier currently
includes 1 TB of transfer out, 10 million HTTP/HTTPS requests, and two million
CloudFront Functions invocations per month, but usage beyond those allowances
uses pay-as-you-go pricing.
[CloudFront FAQ](https://aws.amazon.com/cloudfront/faqs/)

Do **not** select the newer `$0/month` CloudFront flat-rate plan. AWS explicitly
says Free Tier accounts cannot use CloudFront Flat-Rate Plans.
[Available flat-rate plans](https://docs.aws.amazon.com/PricingPlanManager/latest/UserGuide/plans.html)

CloudFront is still useful for two reasons:

1. Origin Access Control can make the Lambda Function URL `AWS_IAM`-only, so a
   caller cannot bypass CloudFront and invoke the origin directly. For POST and
   PUT requests, the Omarchy client must include the SHA-256 payload hash in
   `x-amz-content-sha256`, as AWS requires for this origin type.
   [Restrict access to a Lambda Function URL origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-lambda.html)
2. A narrowly scoped origin request policy can add
   `CloudFront-Viewer-Country` and `CloudFront-Viewer-Country-Region`. AWS
   derives them from the viewer IP and defines the region as the first-level
   ISO 3166-2 subdivision. The additional geolocation headers have no separate
   fee.
   [CloudFront request headers](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/adding-cloudfront-headers.html),
   [geolocation announcement](https://aws.amazon.com/about-aws/whats-new/2020/07/cloudfront-geolocation-headers/)

The `/location/suggestion` endpoint returns only country and region. The user
must confirm before either value is saved. Do not forward, return, log, or
persist address, ASN, city, postal code, latitude, longitude, or raw IP.
Manual country and region selection remains available.

Use no real-time logs, Origin Shield, Lambda@Edge, paid invalidations, custom
SSL certificate, or AWS WAF. Cache anonymous/public leaderboard reads briefly;
never cache private responses.

### One Lambda Function URL

Run one API-only Rails application on the managed Ruby Lambda runtime as a ZIP
package. Lambda Function URLs have no endpoint charge beyond ordinary Lambda
invocation and duration charges, so API Gateway is unnecessary.
[Choosing an HTTP invocation method](https://docs.aws.amazon.com/lambda/latest/dg/apig-http-invoke-decision.html)

Guardrails:

- package directly as a ZIP below 50 MB compressed and 250 MB uncompressed,
  avoiding ECR and S3 deployment storage;
- 128 or 256 MB memory, maximum ten-second request timeout;
- no provisioned concurrency, Lambda MicroVM, VPC, NAT gateway, EFS, X-Ray, or
  asynchronous retry chain;
- do not request a concurrency increase above the verified account quota of
  ten; attempt reserved concurrency of two at deployment, and if the Free Plan
  quota rules reject it, retain the account quota and enforce stricter
  application admission limits;
- cap request bodies and pagination, reject unauthenticated mutation traffic
  early, and use per-account operation quotas;
- emit compact structured error/audit logs with a one-day retention period and
  no request bodies, tokens, recovery labels, or location data.

AWS documents both the ZIP size limits and Linux-compatible Ruby packaging.
[Ruby ZIP deployment packages](https://docs.aws.amazon.com/lambda/latest/dg/ruby-package.html)
Reserved concurrency limits a function's maximum concurrent invocations, but
it does not cap monthly requests or cost, so it is only a damage limiter.
[Lambda resilience and reserved concurrency](https://docs.aws.amazon.com/lambda/latest/dg/security-resilience.html)

### One DynamoDB Standard table

Use a single-region, single-table model in `us-east-1`, with provisioned
capacity and the Standard table class. The Always Free allowance includes 25
GB storage and 25 provisioned RCUs plus 25 provisioned WCUs. On-demand mode is
pay per request and therefore fails the guardrail.
[DynamoDB pricing](https://aws.amazon.com/dynamodb/pricing/)

At launch, the sum of capacity across the table and all global secondary
indexes must be at most **10 RCU and 10 WCU**. That leaves margin below the
free allowance. Disable auto scaling explicitly; the console enables it by
default and it can raise provisioned throughput.
[DynamoDB provisioned capacity](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/provisioned-capacity-mode.html)

Use conditional writes for the XP ledger and idempotency keys, TTL for expired
sessions/inbox items where domain rules permit it, and bounded page sizes.
Throttle when provisioned capacity is exhausted. Do not enable:

- on-demand capacity or Standard-Infrequent Access;
- point-in-time recovery or on-demand/AWS Backup backups;
- DynamoDB Streams, global tables, DAX, Kinesis CDC, S3 export, table import,
  or pre-warming.

Those optional features have independent pricing; even an on-demand backup is
charged for the remaining portion of the month in which it is created.
[DynamoDB backup billing](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/backup-restore-billing.html)

### Authentication and secrets

Use GitHub OAuth for the first social identity provider. Exchange the
short-lived login response, read the stable GitHub user ID, then discard the
GitHub access token unless a later approved feature truly needs it. Issue
DailyXP sessions whose server-side tokens are stored only as hashes.

Keep the GitHub client secret and DailyXP signing secret in Lambda environment
variables encrypted with the AWS-owned key. Do not create a customer-managed
KMS key or a Secrets Manager secret: both introduce idle-priced resources.
Because CloudFront OAC owns the origin `Authorization` header, carry the
DailyXP session in a secure cookie or a dedicated application header rather
than an HTTP bearer `Authorization` header.
Limit deployment and runtime IAM roles to this function and table. Add an
explicit deny for Free Plan upgrade, Organizations, Control Tower, purchase and
commitment APIs, and resource creation outside the approved stack before any
application deployment.

## Budgets and alerts are alarms, not brakes

The account currently has no budget. Creating a monitoring-only budget and
email notifications is free; the first two action-enabled budgets are also
free, while further action-enabled budgets cost money.
[AWS Budgets pricing](https://aws.amazon.com/aws-cost-management/aws-budgets/pricing/)

Before any application resource is approved, create:

1. the AWS **Zero spend budget** template with actual and forecast email
   notifications;
2. usage budgets for Lambda requests, Lambda GB-seconds, DynamoDB provisioned
   capacity/storage, CloudFront requests/transfer, and CloudWatch logs, with
   warning thresholds below the free allowances;
3. Free Tier usage emails to the verified account email; AWS automatically
   alerts individual accounts at 85% of a tracked Free Tier limit.
   [Tracking Free Tier usage](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/tracking-free-tier-usage.html)

No alert is a hard stop. AWS warns that billing data and budget notifications
can be delayed and usage can continue increasing after a threshold is crossed.
Budget actions can apply IAM/SCP policies or target EC2/RDS; they do not provide
an atomic shutdown for this Lambda/DynamoDB/CloudFront path.
[Managing costs with AWS Budgets](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html),
[budget actions](https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-controls.html)

Therefore the Free Plan's no-charge boundary, fixed DynamoDB capacity, current
Lambda quota, application quotas, and a manual kill switch are the controls.
The kill switch must disable CloudFront and set Lambda reserved concurrency to
zero; it is an operator action, not an automatic budget guarantee.

## Prohibited idle-charge resources

The zero-charge launch must not create any resource in this list without a new
ticket, an official pricing review, and Mohamed's explicit spending approval:

- EC2, EBS volumes/snapshots, Elastic IP/public IPv4, NAT Gateway, load
  balancer, RDS/Aurora, ElastiCache, OpenSearch, EFS, or App Runner;
- Route 53 hosted zones or registered domains;
- Secrets Manager secrets or customer-managed KMS keys;
- API Gateway, Step Functions, EventBridge Scheduler, SQS/SNS delivery,
  Kinesis, SES, WAF, Shield Advanced, X-Ray, or paid CloudWatch features;
- ECR images, S3 deployment buckets, DynamoDB backups/exports/global tables,
  Lambda provisioned concurrency, Savings Plans, reservations, Marketplace
  products, or support-plan upgrades.

AWS notes that resources in disabled regions can continue producing charges
and calls out EC2, EBS, Elastic IP, and storage as common unexpected-charge
sources. Inventory must therefore remain account-wide, not just `us-east-1`.
[Understanding unexpected charges](https://docs.aws.amazon.com/awsaccountbilling/latest/aboutv2/checklistforunwantedcharges.html)

## Expiry, export, and recovery

The Free Plan expires on **2027-01-28**, or sooner if credits reach zero. Treat
**2026-12-14 (T-45 days)** as a hard product deadline:

- T-60: verify plan state, credits, Free Tier usage, budgets, and all-region
  inventory; stop adding cloud features.
- T-45: decide explicitly to migrate, accept paid AWS operation, or retire the
  hosted alpha. No decision means retire.
- T-30: freeze new social signups; run the local export tool and verify restore
  into DynamoDB Local.
- T-14: switch clients to the chosen replacement or read-only/local-only mode.
- T-7: take the final encrypted local export, verify counts/checksums, then
  remove hosted application resources before closure.

Do not rely on AWS's 90-day post-closure retention: AWS says an upgrade to the
Paid Plan is required to download data then. Every user also needs a portable
local JSON export of their own events and projections. Shared league and group
state is exported by an operator script through paginated DynamoDB reads to an
encrypted local archive; restoration is tested before deletion.

## Zero-cost local development

The default development and CI path makes no AWS API calls:

1. run the Rails API locally;
2. run AWS's DynamoDB Local Docker image with a disposable local volume;
3. point the Omarchy plugin at `http://127.0.0.1` and inject fixture
   `CloudFront-Viewer-Country`/`CloudFront-Viewer-Country-Region` headers only
   in the local test adapter;
4. use a local fake identity provider in automated tests and a GitHub OAuth
   development application only for manual identity checks;
5. use `sam local invoke` for Lambda event-shape checks, then run QML lint,
   domain tests, API tests, contract tests, and restore tests locally;
6. permit read-only AWS account/usage audits in CI only when credentials are
   deliberately supplied; never run deployment from an unapproved PR.

DynamoDB Local is specifically designed for development without accessing the
web service and avoids throughput, storage, and transfer fees.
[DynamoDB Local](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/DynamoDBLocal.html)
AWS SAM can build and invoke Lambda functions locally in Docker.
[Local invocation with SAM](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/using-sam-cli-local-invoke.html)

## Approval gates

This research authorizes no AWS mutation. Delivery tickets must preserve these
gates:

1. local application and infrastructure definitions;
2. policy/static checks proving only the approved services and settings;
3. separate ticket to create budgets and alert subscriptions;
4. Mohamed verifies alert email and explicitly approves that mutation;
5. separate ticket listing the exact Lambda, DynamoDB, CloudFront, IAM, and
   CloudWatch resources and their limits;
6. Mohamed explicitly approves provisioning those exact resources;
7. post-deploy read-only inventory, Free Tier usage snapshot, endpoint test,
   and tested kill switch.

Any need for a paid-plan upgrade, a service outside this document, higher
capacity, a custom domain, durable cloud backup, or richer push notifications
returns to product approval. It is never an implementation detail.
