#!/bin/bash
set -e

AWS_REGION="us-west-2"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO_NAME="mcp-gateway-auth-server"
ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO_NAME}"

echo "========================================"
echo "Building and Pushing Auth Server Container"
echo "========================================"
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "AWS Region: $AWS_REGION"
echo "ECR Repository: $ECR_REPO_URI"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo "Step 1: Building Docker image..."
docker build -f "$SCRIPT_DIR/docker/Dockerfile.auth" -t "${ECR_REPO_NAME}:latest" "$SCRIPT_DIR" || exit 1
echo "✓ Image built successfully"
echo ""

echo "Step 2: Tagging for ECR..."
docker tag "${ECR_REPO_NAME}:latest" "${ECR_REPO_URI}:latest" || exit 1
echo "✓ Image tagged: ${ECR_REPO_URI}:latest"
echo ""

echo "Step 3: Logging into Amazon ECR..."
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com" || exit 1
echo "✓ Successfully logged into ECR"
echo ""

echo "Step 4: Creating ECR repository if it doesn't exist..."
aws ecr describe-repositories --repository-names "$ECR_REPO_NAME" --region "$AWS_REGION" 2>/dev/null || {
    echo "  Repository doesn't exist, creating..."
    aws ecr create-repository --repository-name "$ECR_REPO_NAME" --region "$AWS_REGION"
}
echo "✓ Repository ready"
echo ""

echo "Step 5: Pushing image to ECR..."
docker push "${ECR_REPO_URI}:latest" || exit 1
echo "✓ Image pushed successfully"
echo ""

echo "========================================"
echo "SUCCESS!"
echo "========================================"
echo "ECR Image URI: ${ECR_REPO_URI}:latest"
echo ""
echo "Next steps:"
echo "1. Update terraform/aws-ecs/terraform.tfvars:"
echo "   auth_server_image_uri = \"${ECR_REPO_URI}:latest\""
echo "2. Run: cd terraform/aws-ecs && terraform apply"
echo "   OR force new deployment:"
echo "   aws ecs update-service --cluster mcp-gateway-ecs-cluster --service mcp-gateway-v2-auth --force-new-deployment --region $AWS_REGION"
echo ""
