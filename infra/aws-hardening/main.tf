terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

variable "project_name" {
  type    = string
  default = "meetpoint"
}

variable "environment" {
  type    = string
  default = "production"
}

variable "vpc_cidr" {
  type    = string
  default = "10.80.0.0/16"
}

variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.10.0/24", "10.80.11.0/24"]
}

variable "database_subnet_cidrs" {
  type    = list(string)
  default = ["10.80.30.0/24", "10.80.31.0/24"]
}

variable "app_ingress_cidr_blocks" {
  type    = list(string)
  default = []
}

data "aws_availability_zones" "available" {
  state = "available"
}

locals {
  name = "${var.project_name}-${var.environment}"
  tags = {
    Project     = var.project_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}

resource "aws_kms_key" "application_data" {
  description             = "KMS key for application PII, S3 objects and RDS encryption"
  deletion_window_in_days = 30
  enable_key_rotation     = true

  tags = local.tags
}

resource "aws_kms_alias" "application_data" {
  name          = "alias/${local.name}-data"
  target_key_id = aws_kms_key.application_data.key_id
}

resource "aws_s3_bucket" "protected_media" {
  bucket = "${local.name}-protected-media"
  tags   = local.tags
}

resource "aws_s3_bucket_public_access_block" "protected_media" {
  bucket                  = aws_s3_bucket.protected_media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "protected_media" {
  bucket = aws_s3_bucket.protected_media.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "protected_media" {
  bucket = aws_s3_bucket.protected_media.id

  rule {
    apply_server_side_encryption_by_default {
      kms_master_key_id = aws_kms_key.application_data.arn
      sse_algorithm     = "aws:kms"
    }
    bucket_key_enabled = true
  }
}

resource "aws_s3_bucket_policy" "protected_media" {
  bucket = aws_s3_bucket.protected_media.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "DenyInsecureTransport"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.protected_media.arn,
          "${aws_s3_bucket.protected_media.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.protected_media]
}

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.tags, { Name = "${local.name}-vpc" })
}

resource "aws_subnet" "private_app" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, { Name = "${local.name}-private-app-${count.index}" })
}

resource "aws_subnet" "database" {
  count             = length(var.database_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = merge(local.tags, { Name = "${local.name}-database-${count.index}" })
}

resource "aws_security_group" "app" {
  name        = "${local.name}-app-sg"
  description = "Only trusted load balancer or VPN CIDRs can reach the application"
  vpc_id      = aws_vpc.main.id

  dynamic "ingress" {
    for_each = var.app_ingress_cidr_blocks
    content {
      description = "Trusted application ingress"
      from_port   = 443
      to_port     = 443
      protocol    = "tcp"
      cidr_blocks = [ingress.value]
    }
  }

  egress {
    description = "HTTPS egress for managed integrations"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.tags
}

resource "aws_security_group" "rds" {
  name        = "${local.name}-rds-sg"
  description = "PostgreSQL is reachable only from application security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from application"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app.id]
  }

  tags = local.tags
}

resource "aws_db_subnet_group" "postgres" {
  name       = "${local.name}-postgres"
  subnet_ids = aws_subnet.database[*].id
  tags       = local.tags
}

resource "aws_iam_policy" "app_runtime" {
  name        = "${local.name}-app-runtime"
  description = "Least-privilege runtime permissions for MeetPoint API"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "ReadAndWriteOnlyProtectedMediaPrefix"
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:AbortMultipartUpload"
        ]
        Resource = "${aws_s3_bucket.protected_media.arn}/tenant/*"
      },
      {
        Sid    = "UseKmsOnlyForApplicationData"
        Effect = "Allow"
        Action = [
          "kms:Decrypt",
          "kms:Encrypt",
          "kms:GenerateDataKey"
        ]
        Resource = aws_kms_key.application_data.arn
      }
    ]
  })
}

resource "aws_wafv2_web_acl" "api" {
  name        = "${local.name}-api-waf"
  description = "Managed OWASP protections, SQLi/XSS rules and rate limiting"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "rate-limit-by-ip"
    priority = 0

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitByIp"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-common-rule-set"
    priority = 10

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
      metric_name                = "CommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-known-bad-inputs"
    priority = 20

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "KnownBadInputs"
      sampled_requests_enabled   = true
    }
  }

  rule {
    name     = "aws-sqli-rule-set"
    priority = 30

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "SqlInjection"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${local.name}-api-waf"
    sampled_requests_enabled   = true
  }

  tags = local.tags
}
