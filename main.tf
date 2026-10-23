variable "finnhub_api_key" {
  type      = string
  sensitive = true
}

variable "plaid_client_id" {
  type      = string
  sensitive = true
}

variable "plaid_secret" {
  type      = string
  sensitive = true
}

variable "plaid_token_secret" {
  description = "32-byte hex key that encrypts the Plaid access-token cookie (openssl rand -hex 32)"
  type        = string
  sensitive   = true
}

variable "stellar_network" {
  type    = string
  default = "testnet"
}

variable "audit_bucket" {
  type    = string
  default = "wall-street-tokenization-audit-logs-v2"
}

provider "aws" {
  region = "us-west-2"
}

provider "aws" {
  alias  = "us-east-1"
  region = "us-east-1"
}

resource "aws_kms_key" "ledgersync_key" {
  description             = "LedgerSync Master Encryption Key for Brokerage Tokens"
  deletion_window_in_days = 7
  enable_key_rotation     = true
}

output "kms_key_id" {
  value = aws_kms_key.ledgersync_key.id
}

# =========================================================
# 0. EXISTING IAM ROLES & DYNAMIC NETWORKING
# =========================================================
data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_iam_role" "ecs_execution_role" {
  name = "ecsTaskExecutionRole"
}

# Application secrets live in Secrets Manager, never in the task definition or image.
resource "aws_secretsmanager_secret" "app" {
  name        = "ledgersync/app"
  description = "LedgerSync dashboard server secrets"
  kms_key_id  = aws_kms_key.ledgersync_key.arn
}

resource "aws_secretsmanager_secret_version" "app" {
  secret_id = aws_secretsmanager_secret.app.id
  secret_string = jsonencode({
    PLAID_SECRET       = var.plaid_secret
    PLAID_TOKEN_SECRET = var.plaid_token_secret
    FINNHUB_API_KEY    = var.finnhub_api_key
  })
}

# The execution role pulls the image and injects secrets at container start.
resource "aws_iam_role_policy" "execution_read_secrets" {
  name = "ledgersync_read_app_secrets"
  role = data.aws_iam_role.ecs_execution_role.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      { Effect = "Allow", Action = ["secretsmanager:GetSecretValue"], Resource = aws_secretsmanager_secret.app.arn },
      { Effect = "Allow", Action = ["kms:Decrypt"], Resource = aws_kms_key.ledgersync_key.arn },
    ]
  })
}

# Least-privilege runtime role for the app: append-only access to its WORM audit prefix.
resource "aws_iam_role" "app_task" {
  name = "ledgersync-app-task"
  assume_role_policy = jsonencode({
    Version   = "2012-10-17"
    Statement = [{ Effect = "Allow", Principal = { Service = "ecs-tasks.amazonaws.com" }, Action = "sts:AssumeRole" }]
  })
}

resource "aws_iam_role_policy" "app_task_audit" {
  name = "ledgersync_worm_audit"
  role = aws_iam_role.app_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:PutObjectRetention", "s3:GetObject", "s3:GetObjectRetention"]
        Resource = "arn:aws:s3:::${var.audit_bucket}/ledgersync/*"
      },
      {
        Effect    = "Allow"
        Action    = ["s3:ListBucket"]
        Resource  = "arn:aws:s3:::${var.audit_bucket}"
        Condition = { StringLike = { "s3:prefix" = ["ledgersync/*"] } }
      },
    ]
  })
}

# =========================================================
# 1. APPLICATION LOAD BALANCER & SECURITY
# =========================================================
resource "aws_security_group" "alb_sg" {
  name        = "ledgersync-alb-sg"
  description = "Allow inbound traffic"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Containers accept traffic only from the load balancer (and therefore only via CloudFront/WAF).
resource "aws_security_group" "ecs_sg" {
  name        = "ledgersync-ecs-sg"
  description = "Next.js tasks: ingress from ALB only"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb_sg.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_lb" "ledgersync_alb" {
  name               = "ledgersync-dashboard-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb_sg.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "nextjs_tg" {
  name        = "ledgersync-nextjs-tg"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path                = "/"
    healthy_threshold   = 3
    unhealthy_threshold = 3
    timeout             = 5
    interval            = 30
  }
}

resource "aws_lb_listener" "http_listener" {
  load_balancer_arn = aws_lb.ledgersync_alb.arn
  port              = "80"
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.nextjs_tg.arn
  }
}

# =========================================================
# 2. NEXT.JS ECS FARGATE CLUSTER
# =========================================================
resource "aws_ecr_repository" "nextjs_repo" {
  name                 = "ledgersync-nextjs-frontend"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }
}

resource "aws_ecs_cluster" "ledgersync_cluster" {
  name = "ledgersync-fargate-cluster"
}

resource "aws_ecs_task_definition" "nextjs_task" {
  family                   = "ledgersync-nextjs-task"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = data.aws_iam_role.ecs_execution_role.arn
  task_role_arn            = aws_iam_role.app_task.arn

  container_definitions = jsonencode([
    {
      name      = "nextjs-frontend"
      image     = "${aws_ecr_repository.nextjs_repo.repository_url}:latest"
      essential = true
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 3000
          protocol      = "tcp"
        }
      ]
      # Contract IDs ship inside the image (deployments/<network>.json); only runtime config here.
      environment = [
        { name = "NODE_ENV", value = "production" },
        { name = "NEXT_PUBLIC_STELLAR_NETWORK", value = var.stellar_network },
        { name = "PLAID_ENV", value = "sandbox" },
        { name = "PLAID_CLIENT_ID", value = var.plaid_client_id },
        { name = "AUDIT_BUCKET", value = var.audit_bucket },
        { name = "AUDIT_RETENTION_YEARS", value = "6" },
        { name = "AWS_REGION", value = "us-east-1" }
      ]
      secrets = [
        for k in ["PLAID_SECRET", "PLAID_TOKEN_SECRET", "FINNHUB_API_KEY"] :
        { name = k, valueFrom = "${aws_secretsmanager_secret.app.arn}:${k}::" }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = "/ecs/ledgersync-nextjs"
          "awslogs-region"        = "us-west-2"
          "awslogs-stream-prefix" = "ecs"
          "awslogs-create-group"  = "true"
        }
      }
    }
  ])
}

resource "aws_ecs_service" "nextjs_service" {
  name            = "ledgersync-nextjs-service"
  cluster         = aws_ecs_cluster.ledgersync_cluster.id
  task_definition = aws_ecs_task_definition.nextjs_task.arn
  launch_type     = "FARGATE"
  desired_count   = 2

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs_sg.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.nextjs_tg.arn
    container_name   = "nextjs-frontend"
    container_port   = 3000
  }
}

# =========================================================
# 3. DATABASE
# The unused Multi-AZ RDS instance was retired (final snapshot: ledgersync-db-final-2026-10-23).
# LedgerSync's system of record is the Stellar ledger plus the S3 WORM archive.
# =========================================================

# =========================================================
# 4. EDGE CACHING & DDOS PROTECTION (CloudFront + WAF)
# =========================================================
resource "aws_wafv2_web_acl" "ledgersync_waf" {
  provider    = aws.us-east-1
  name        = "ledgersync-global-waf"
  description = "Layer 7 DDoS and Exploit Protection"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ledgersync-waf-metrics"
    sampled_requests_enabled   = true
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }
}

resource "aws_cloudfront_distribution" "ledgersync_cdn" {
  enabled         = true
  is_ipv6_enabled = true
  web_acl_id      = aws_wafv2_web_acl.ledgersync_waf.arn

  origin {
    domain_name = aws_lb.ledgersync_alb.dns_name
    origin_id   = "ALB-Origin"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "ALB-Origin"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "Host"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}

# =========================================================
# 5. REGIONAL WAF (ALB-ATTACHED DDOS PROTECTION)
# =========================================================
resource "aws_wafv2_web_acl" "alb_regional_waf" {
  name        = "ledgersync-alb-regional-waf"
  description = "Layer 7 DDoS Protection attached directly to ALB"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }
    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSetMetric"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "ledgersync-alb-waf-metric"
    sampled_requests_enabled   = true
  }
}

resource "aws_wafv2_web_acl_association" "alb_waf_binding" {
  resource_arn = aws_lb.ledgersync_alb.arn
  web_acl_arn  = aws_wafv2_web_acl.alb_regional_waf.arn
}