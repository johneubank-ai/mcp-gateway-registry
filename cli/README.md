# MCP Registry CLI Tool

A command-line interface for registering and managing MCP servers in the MCP Gateway Registry. This tool provides comprehensive validation, health checking, and automation capabilities for MCP server registration.

## Features

- **Server Registration**: Register new MCP servers from JSON configuration files
- **Configuration Validation**: Validate server configurations without registering
- **Health Checks**: Comprehensive health validation including tool accessibility
- **Search Index Verification**: Verify servers are discoverable via FAISS search
- **Server Management**: List registered servers and check their status
- **Automation Ready**: Perfect for CI/CD pipelines and scripting

## Installation

### Quick Install

```bash
cd cli/
./install.sh
```

### Manual Install

```bash
# Install dependencies (from project root)
cd ..
pip3 install -e .

# Make CLI executable
cd cli/
chmod +x mcp_registry_cli.py

# Optional: Create global symlink
sudo ln -sf $(pwd)/mcp_registry_cli.py /usr/local/bin/mcp-registry
```

## Configuration

### Environment Variables

```bash
export MCP_REGISTRY_URL=https://mcpgateway.ddns.net
export MCP_AUTH_TOKEN=your_auth_token_here
export MCP_MCPGW_URL=https://mcpgateway.ddns.net/mcpgw  # Optional
```

### Authentication

The CLI supports authentication via multiple methods (in priority order):
1. **Command-line argument**: `--auth-token your_token`
2. **Environment variable**: `MCP_AUTH_TOKEN=your_token`
3. **Ingress token file**: Automatically loads from `.oauth-tokens/ingress.json` (recommended for local development)

The ingress token file is automatically created by the MCP Gateway authentication system and provides seamless authentication without manual token management.

## Usage

### Register a New Server

```bash
# Register server from configuration file (uses auto-detected auth)
uv run python mcp_registry_cli.py register --config examples/server-config.json

# Register with custom registry URL
uv run python mcp_registry_cli.py register \
  --config my-server.json \
  --registry-url https://gateway.company.com

# Register without health checks (faster)
uv run python mcp_registry_cli.py register \
  --config server.json \
  --skip-health-check \
  --skip-search-update
```

### Validate Configuration

```bash
# Validate configuration without registering
uv run python mcp_registry_cli.py validate --config server-config.json
```

### Health Checks

```bash
# Check health of a specific server
uv run python mcp_registry_cli.py health-check --server-path "/my-server"
```

### List Servers

```bash
# List all registered servers
mcp-registry list --registry-url https://mcpgateway.ddns.net
```

### Test Search

```bash
# Test if tools are discoverable
mcp-registry test-search --query "find time tools"
mcp-registry test-search --query "weather information"
```

## Server Configuration Format

### Minimal Configuration

```json
{
  "server_name": "My MCP Server",
  "description": "Description of what this server does",
  "path": "/my-server",
  "proxy_pass_url": "http://my-server:8000/"
}
```

### Complete Configuration

```json
{
  "server_name": "Advanced MCP Server",
  "description": "A server with all optional fields",
  "path": "/advanced-server",
  "proxy_pass_url": "http://advanced-server:8001/",
  "tags": ["productivity", "automation", "enterprise"],
  "is_python": true,
  "license": "MIT",
  "tool_list": [
    {
      "name": "my_tool",
      "parsed_description": {
        "main": "Description of what the tool does",
        "args": "tool_params: Parameters for the tool",
        "returns": "Dict[str, Any]: Tool execution result",
        "raises": "Exception: If the tool fails"
      },
      "schema": {
        "$defs": {
          "ToolParams": {
            "properties": {
              "input": {
                "description": "Input parameter",
                "type": "string"
              }
            },
            "required": ["input"],
            "title": "ToolParams",
            "type": "object"
          }
        },
        "properties": {
          "params": {
            "$ref": "#/$defs/ToolParams"
          }
        },
        "required": ["params"],
        "title": "my_toolArguments",
        "type": "object"
      }
    }
  ]
}
```

### Required Fields

- `server_name`: Display name for the server
- `path`: URL path prefix (must start with `/`)
- `proxy_pass_url`: Internal URL where the MCP server runs
- `description`: Brief description of server functionality

### Optional Fields

- `tags`: List of tags for categorization
- `is_python`: Whether server is implemented in Python
- `license`: License information
- `tool_list`: Detailed tool definitions (auto-discovered if not provided)

## Automation and CI/CD

### GitHub Actions Example

```yaml
name: Register MCP Server
on:
  push:
    paths: ['server-config.json']

jobs:
  register:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install CLI
        run: |
          cd cli/
          pip install -r requirements.txt

      - name: Validate Configuration
        run: |
          ./cli/mcp_registry_cli.py validate --config server-config.json

      - name: Register Server
        env:
          MCP_REGISTRY_URL: ${{ secrets.MCP_REGISTRY_URL }}
          MCP_AUTH_TOKEN: ${{ secrets.MCP_AUTH_TOKEN }}
        run: |
          ./cli/mcp_registry_cli.py register --config server-config.json
```

### Shell Script Example

```bash
#!/bin/bash
set -e

# Deployment script for MCP server registration

SERVER_CONFIG="production-server.json"
REGISTRY_URL="https://prod-gateway.company.com"

echo "Validating server configuration..."
mcp-registry validate --config "$SERVER_CONFIG"

echo "Registering server in production..."
mcp-registry register \
  --config "$SERVER_CONFIG" \
  --registry-url "$REGISTRY_URL"

echo "Verifying server health..."
SERVER_PATH=$(jq -r '.path' "$SERVER_CONFIG")
mcp-registry health-check --server-path "$SERVER_PATH"

echo "Testing search integration..."
SERVER_NAME=$(jq -r '.server_name' "$SERVER_CONFIG")
mcp-registry test-search --query "$SERVER_NAME tools"

echo "✓ Server deployment completed successfully!"
```

## Error Handling

The CLI provides detailed error messages and appropriate exit codes:

- `0`: Success
- `1`: General failure
- `2`: Configuration validation failed
- `3`: Network/authentication error

### Common Issues

#### Authentication Errors
```bash
# Ensure auth token is provided
export MCP_AUTH_TOKEN=your_token
mcp-registry register --config server.json
```

#### Network Connectivity
```bash
# Test registry connectivity
mcp-registry list --registry-url https://mcpgateway.ddns.net
```

#### Configuration Issues
```bash
# Validate configuration first
mcp-registry validate --config server.json
```

## Health Check Details

The health check performs comprehensive validation:

1. **Server Details**: Verifies server is registered and accessible
2. **Tool Accessibility**: Confirms tools can be enumerated
3. **Service Refresh**: Updates server state to latest version
4. **Search Integration**: Verifies tools are discoverable via search

## Integration with Existing Tools

The CLI leverages the existing mcpgw server's tools:

- `register_service`: For server registration
- `get_server_details`: For health checks
- `get_service_tools`: For tool validation
- `refresh_service`: For state updates
- `intelligent_tool_finder`: For search verification

## Troubleshooting

### Enable Debug Mode

```bash
mcp-registry register --config server.json --debug
```

### Check Server Logs

After registration, check the registry server logs for any issues:

```bash
docker logs mcpgateway-registry-1
```

### Verify Tool Discovery

```bash
# Test if your tools are discoverable
mcp-registry test-search --query "relevant keywords for your tools"
```

## Examples

See the `examples/` directory for:

- `server-config.json`: Complete configuration example
- `minimal-server-config.json`: Minimal required fields
- `advanced-server-config.json`: Enterprise configuration

## Contributing

To add new features or fix issues:

1. Follow the existing code style and patterns
2. Add appropriate error handling and logging
3. Update documentation and examples
4. Test with both successful and error scenarios

## License

This CLI tool is part of the MCP Gateway Registry project and follows the same license terms.