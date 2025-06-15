# Getting Started with MCP Gateway & Registry

This guide walks you through setting up and using the MCP Gateway & Registry, from your first demo to production deployment.

## What You'll Learn

- How to run a 5-minute demo
- How to set up local development
- How to connect AI agents to the gateway
- How to register your own MCP servers
- How to configure authentication and permissions

## Prerequisites

Before you begin, ensure you have:

- **Docker Desktop** installed and running
- **Git** for cloning the repository
- **8GB RAM** available for running services
- **Basic terminal/command line** knowledge

Optional for production:
- **AWS Account** for Cognito authentication
- **Domain name** for HTTPS deployment

## Step 1: Quick Demo (5 minutes)

Let's start with a quick demo to see the system in action:

### 1.1 Clone and Start Demo

```bash
# Clone the repository
git clone https://github.com/agentic-community/mcp-gateway-registry.git
cd mcp-gateway-registry

# Start the demo (this may take a few minutes on first run)
./quick-demo.sh
```

### 1.2 Explore the Demo

Once the demo starts, you'll see:

```
🎉 Demo is ready!
==================

📱 Registry Web Interface:
   URL: http://localhost:7860
   Username: demo
   Password: demo123
```

**Try these steps:**

1. **Open the Registry**: Visit http://localhost:7860 in your browser
2. **Login**: Use username `demo` and password `demo123`
3. **Explore Servers**: You'll see 3 sample MCP servers:
   - **Current Time**: Get time for any timezone
   - **Financial Info**: Stock market data (demo mode)
   - **Demo Tools**: Sample tools for testing

4. **View Tools**: Click the tool count (🔧) on any server card to see available tools
5. **Test Health**: Click the refresh button (🔄) to check server health
6. **Search Tools**: Use the search feature to find tools by description

### 1.3 Understanding What You See

The demo shows you:
- **Server Registry**: Central catalog of all MCP servers
- **Tool Discovery**: How agents can find tools they need
- **Health Monitoring**: Real-time status of all servers
- **Access Control**: Different permission levels (admin vs user)

## Step 2: Connect an AI Agent

Now let's see how an AI agent connects to the gateway:

### 2.1 Test with curl

```bash
# List available tools from the time server
curl "http://localhost:8080/currenttime/sse" \
  -H "Accept: text/event-stream" \
  -H "Cache-Control: no-cache"

# This shows the raw MCP protocol communication
```

### 2.2 Python Agent Example

Create a simple Python agent:

```python
# save as test_agent.py
import asyncio
import json
from mcp.client.sse import sse_client
import mcp

async def test_agent():
    # Connect to the current time server through the gateway
    server_url = "http://localhost:8080/currenttime/sse"
    
    async with sse_client(server_url) as (read, write):
        async with mcp.ClientSession(read, write) as session:
            # Initialize the connection
            await session.initialize()
            print("✅ Connected to MCP server")
            
            # List available tools
            tools_result = await session.list_tools()
            print(f"📋 Available tools: {[tool.name for tool in tools_result.tools]}")
            
            # Call a tool
            result = await session.call_tool(
                "current_time_by_timezone", 
                arguments={"timezone": "America/New_York"}
            )
            
            print(f"🕐 Current time in NY: {result.content[0].text}")

# Run the agent
asyncio.run(test_agent())
```

Run it:
```bash
pip install mcp
python test_agent.py
```

### 2.3 What Just Happened?

Your agent:
1. **Connected** to the gateway at port 8080
2. **Discovered** available tools from the time server
3. **Called** a specific tool with parameters
4. **Received** the result

The gateway handled:
- **Routing** the request to the correct MCP server
- **Protocol** translation between agent and server
- **Authentication** (in demo mode, this is bypassed)

## Step 3: Local Development Setup

For ongoing development, set up a persistent local environment:

### 3.1 Create Local Configuration

```bash
# Copy the local development template
cp .env.local.template .env.local

# Edit the configuration
nano .env.local  # or use your preferred editor
```

**Key settings to configure:**
```bash
# Set a secure admin password
ADMIN_PASSWORD=your-secure-password-here

# Enable development mode
ENABLE_DEV_MODE=true

# Optional: Add external API keys
POLYGON_API_KEY=your-polygon-api-key  # for financial data
```

### 3.2 Start Development Environment

```bash
# Stop the demo if it's running
docker-compose -f docker-compose.yml -f docker-compose.demo.yml down

# Start development environment
./build_and_run.sh --env-file .env.local
```

### 3.3 Verify Setup

```bash
# Check all services are running
docker-compose ps

# Test the registry
curl http://localhost:7860/health

# Test the gateway
curl http://localhost:8080/health
```

## Step 4: Register Your Own MCP Server

Let's add a custom MCP server to the registry:

### 4.1 Create a Simple MCP Server

First, let's create a basic MCP server:

```python
# save as my_server.py
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent
import asyncio

app = Server("my-custom-server")

@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="greet",
            description="Greet someone with a custom message",
            inputSchema={
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name to greet"}
                },
                "required": ["name"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "greet":
        person_name = arguments.get("name", "World")
        return [TextContent(type="text", text=f"Hello, {person_name}! 👋")]
    
    raise ValueError(f"Unknown tool: {name}")

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
```

### 4.2 Run Your Server

```bash
# Install MCP server dependencies
pip install mcp

# Run your server (in a separate terminal)
python my_server.py
```

### 4.3 Register in the Gateway

**Option 1: Via Web Interface**

1. Open http://localhost:7860
2. Login with your admin credentials
3. Click "Register Server" button
4. Fill in the details:
   - **Name**: My Custom Server
   - **Path**: `/my-server`
   - **Proxy Pass URL**: `http://host.docker.internal:8004`
   - **Description**: My first custom MCP server

**Option 2: Via Configuration File**

```bash
# Add to registry configuration
cat >> registry/servers.json << EOF
{
  "name": "my-custom-server",
  "path": "/my-server",
  "proxy_pass": "http://host.docker.internal:8004",
  "description": "My first custom MCP server",
  "enabled": true,
  "tags": ["custom", "demo"]
}
EOF

# Restart registry to load new configuration
docker-compose restart registry
```

### 4.4 Test Your Server

```bash
# Test through the gateway
curl "http://localhost:8080/my-server/sse" \
  -H "Accept: text/event-stream"

# Use with an agent
python -c "
import asyncio
from mcp.client.sse import sse_client
import mcp

async def test():
    async with sse_client('http://localhost:8080/my-server/sse') as (read, write):
        async with mcp.ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool('greet', {'name': 'Developer'})
            print(result.content[0].text)

asyncio.run(test())
"
```

## Step 5: Understanding Authentication

The system supports two authentication modes:

### 5.1 Development Mode (Current Setup)

- **Basic Authentication**: Simple username/password
- **No External Dependencies**: Works without AWS
- **Good For**: Development, testing, demos

### 5.2 Production Mode (Amazon Cognito)

- **Enterprise Authentication**: Integration with AWS Cognito
- **Fine-Grained Access Control**: User groups and permissions
- **Good For**: Production deployments, team environments

To set up Cognito authentication, see:
- [Authentication Guide](auth.md)
- [Cognito Setup Guide](cognito.md)
- [Access Control Configuration](scopes.md)

## Step 6: Next Steps

### For Developers

1. **Explore the API**: Check out the registry API endpoints
2. **Build Custom Servers**: Create MCP servers for your specific needs
3. **Integrate with Agents**: Connect your AI agents to the gateway
4. **Contribute**: Submit improvements or new features

### For Production Deployment

1. **Set up AWS Cognito**: Configure enterprise authentication
2. **Deploy to EC2/EKS**: Use production deployment guides
3. **Configure SSL**: Set up HTTPS for secure communication
4. **Monitor and Scale**: Implement monitoring and scaling strategies

### Useful Resources

- **[Architecture Guide](../README.md#architecture--design)**: Understand the system design
- **[Production Deployment](../README.md#production-deployment)**: Deploy to production
- **[Troubleshooting Guide](troubleshooting.md)**: Solve common issues
- **[API Documentation](api.md)**: Programmatic access details

## Common Next Questions

**Q: How do I add authentication to my MCP server?**
A: You don't! The gateway handles all authentication. Your MCP server just needs to implement the standard MCP protocol.

**Q: Can I use this with existing MCP servers?**
A: Yes! Any MCP server that supports SSE or HTTP transport can be registered with the gateway.

**Q: How do I control which users can access which tools?**
A: Use the fine-grained access control system. See the [scopes documentation](scopes.md) for details.

**Q: Can I run this in Kubernetes?**
A: Yes! See the [EKS deployment guide](https://github.com/aws-samples/amazon-eks-machine-learning-with-terraform-and-kubeflow/tree/master/examples/agentic/mcp-gateway-registry).

**Q: How do I backup my configuration?**
A: Key files to backup: `.env`, `auth_server/scopes.yml`, `registry/server_state.json`, and any custom server configurations.

## Getting Help

If you run into issues:

1. **Check the logs**: `docker-compose logs -f`
2. **Review troubleshooting**: [Troubleshooting Guide](troubleshooting.md)
3. **Search issues**: [GitHub Issues](https://github.com/agentic-community/mcp-gateway-registry/issues)
4. **Ask questions**: Create a new issue with details about your setup

Welcome to the MCP Gateway & Registry community! 🎉