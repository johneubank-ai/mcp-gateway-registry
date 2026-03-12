#
# ALB Access Logging with S3 Security Hardening
#

# S3 bucket for ALB access logs
resource "aws_s3_bucket" "alb_logs" {
  bucket = "${var.name}-${var.aws_region}-${data.aws_caller_identity.current.account_id}-alb-logs"

  tags = merge(
    local.common_tags,
    {
      Purpose   = "ALB access logs"
      Component = "logging"
    }
  )
}


# Block public access
resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}


# Enable versioning
resource "aws_s3_bucket_versioning" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  versioning_configuration {
    status = "Enabled"
  }
}


# Server-side encryption with KMS
resource "aws_kms_key" "alb_logs" {
  description             = "KMS key for ALB logs S3 bucket encryption"
  deletion_window_in_days = 10
  enable_key_rotation     = true

  tags = merge(
    local.common_tags,
    {
      Purpose   = "ALB logs encryption"
      Component = "security"
    }
  )
}


resource "aws_kms_alias" "alb_logs" {
  name          = "alias/${var.name}-alb-logs"
  target_key_id = aws_kms_key.alb_logs.key_id
}


resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.alb_logs.arn
    }
    bucket_key_enabled = true
  }
}


# Lifecycle policy - delete old logs after 90 days
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  rule {
    id     = "delete-old-logs"
    status = "Enabled"

    expiration {
      days = 90
    }
  }
}


# Bucket policy for ALB logging with TLS enforcement
resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "EnforceTLS"
        Effect    = "Deny"
        Principal = "*"
        Action    = "s3:*"
        Resource = [
          aws_s3_bucket.alb_logs.arn,
          "${aws_s3_bucket.alb_logs.arn}/*"
        ]
        Condition = {
          Bool = {
            "aws:SecureTransport" = "false"
          }
        }
      },
      {
        Sid    = "AWSLogDeliveryWrite"
        Effect = "Allow"
        Principal = {
          Service = "elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs.arn}/*"
      },
      {
        Sid    = "AWSLogDeliveryAclCheck"
        Effect = "Allow"
        Principal = {
          Service = "elasticloadbalancing.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs.arn
      }
    ]
  })
}


# Output for reference
output "alb_logs_bucket" {
  description = "S3 bucket for ALB access logs"
  value       = aws_s3_bucket.alb_logs.id
}


output "alb_logs_bucket_arn" {
  description = "ARN of S3 bucket for ALB access logs"
  value       = aws_s3_bucket.alb_logs.arn
}
