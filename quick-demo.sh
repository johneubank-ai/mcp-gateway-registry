#!/bin/bash

# MCP Gateway & Registry - Quick Demo Script
# This script starts a local demo with sample data and no authentication required

set -e

echo "🚀 Starting MCP Gateway & Registry Quick Demo..."
echo "================================================"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running. Please start Docker and try again."
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose > /dev/null 2>&1; then
    echo "❌ Error: docker-compose is not installed. Please install Docker Compose and try again."
    exit 1
fi

# Create demo environment file
echo "📝 Creating demo configuration..."
cat > .env.demo << EOF
# Demo Configuration - No real authentication required
ENABLE_DEV_MODE=true
ADMIN_USER=demo
ADMIN_PASSWORD=demo123
SECRET_KEY=demo-secret-key-not-for-production
POLYGON_API_KEY=demo

# Mock Cognito settings (not used in demo mode)
COGNITO_USER_POOL_ID=demo-pool
COGNITO_CLIENT_ID=demo-client
COGNITO_CLIENT_SECRET=demo-secret
AWS_REGION=us-east-1

# Demo mode flags
DEMO_MODE=true
SKIP_AUTH_VALIDATION=true
EOF

# Create demo docker-compose override
echo "🐳 Setting up demo services..."
cat > docker-compose.demo.yml << EOF
version: '3.8'

services:
  nginx:
    ports:
      - "8080:80"
      - "7860:7860"
    environment:
      - DEMO_MODE=true

  auth-server:
    environment:
      - DEMO_MODE=true
      - SKIP_AUTH_VALIDATION=true

  registry:
    environment:
      - DEMO_MODE=true
      - ENABLE_DEMO_DATA=true
    ports:
      - "7860:7860"

  # Sample MCP servers for demo
  currenttime:
    build: ./servers/currenttime
    ports:
      - "8000:8000"
    environment:
      - DEMO_MODE=true

  fininfo:
    build: ./servers/fininfo
    ports:
      - "8001:8001"
    environment:
      - DEMO_MODE=true
      - POLYGON_API_KEY=demo

  realserverfaketools:
    build: ./servers/realserverfaketools
    ports:
      - "8002:8002"
    environment:
      - DEMO_MODE=true
EOF

# Stop any existing services
echo "🛑 Stopping any existing services..."
docker-compose down > /dev/null 2>&1 || true

# Build and start demo services
echo "🔨 Building demo services..."
docker-compose -f docker-compose.yml -f docker-compose.demo.yml --env-file .env.demo build --quiet

echo "🚀 Starting demo services..."
docker-compose -f docker-compose.yml -f docker-compose.demo.yml --env-file .env.demo up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 10

# Check service health
echo "🔍 Checking service health..."
max_attempts=30
attempt=0

while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:7860/health > /dev/null 2>&1; then
        echo "✅ Registry is ready!"
        break
    fi
    
    attempt=$((attempt + 1))
    echo "   Waiting for registry... (attempt $attempt/$max_attempts)"
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    echo "❌ Registry failed to start. Check logs with: docker-compose logs"
    exit 1
fi

# Display demo information
echo ""
echo "🎉 Demo is ready!"
echo "=================="
echo ""
echo "📱 Registry Web Interface:"
echo "   URL: http://localhost:7860"
echo "   Username: demo"
echo "   Password: demo123"
echo ""
echo "🔧 Available MCP Servers:"
echo "   • Current Time: http://localhost:8080/currenttime/sse"
echo "   • Financial Info: http://localhost:8080/fininfo/sse"
echo "   • Demo Tools: http://localhost:8080/realserverfaketools/sse"
echo ""
echo "🧪 Try these examples:"
echo "   1. Open http://localhost:7860 in your browser"
echo "   2. Login with demo/demo123"
echo "   3. Explore the registered MCP servers"
echo "   4. Click on tool counts to see available tools"
echo "   5. Use the search feature to find tools"
echo ""
echo "📋 Useful Commands:"
echo "   • View logs: docker-compose -f docker-compose.yml -f docker-compose.demo.yml logs -f"
echo "   • Stop demo: docker-compose -f docker-compose.yml -f docker-compose.demo.yml down"
echo "   • Restart: ./quick-demo.sh"
echo ""
echo "🔗 Next Steps:"
echo "   • For production setup, see: README.md#production-deployment"
echo "   • For authentication setup, see: docs/auth.md"
echo "   • For agent integration, see: README.md#programmatic-access"
echo ""

# Open browser if possible
if command -v xdg-open > /dev/null 2>&1; then
    echo "🌐 Opening browser..."
    xdg-open http://localhost:7860 > /dev/null 2>&1 &
elif command -v open > /dev/null 2>&1; then
    echo "🌐 Opening browser..."
    open http://localhost:7860 > /dev/null 2>&1 &
fi

echo "✨ Demo setup complete! Press Ctrl+C to stop all services."