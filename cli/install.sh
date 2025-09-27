#!/bin/bash
set -e

# MCP Registry CLI Installation Script

echo "Installing MCP Registry CLI..."

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Check if Python 3.8+ is available
python3 --version >/dev/null 2>&1 || {
    echo "Error: Python 3 is required but not installed."
    exit 1
}

# Install CLI dependencies (from main project)
echo "Installing dependencies..."
PROJECT_ROOT="$( cd "$SCRIPT_DIR/.." && pwd )"
pip3 install -e "$PROJECT_ROOT"

# Make CLI executable
chmod +x "$SCRIPT_DIR/mcp_registry_cli.py"

# Create symlink to make the CLI available globally (optional)
if [ -w "/usr/local/bin" ]; then
    echo "Creating global symlink..."
    ln -sf "$SCRIPT_DIR/mcp_registry_cli.py" /usr/local/bin/mcp-registry
    echo "✓ CLI installed successfully!"
    echo "  You can now use: mcp-registry --help"
else
    echo "✓ CLI installed successfully!"
    echo "  Run directly: $SCRIPT_DIR/mcp_registry_cli.py --help"
    echo "  Or add to PATH: export PATH=\"$SCRIPT_DIR:\$PATH\""
fi

echo ""
echo "Example usage:"
echo "  mcp-registry register --config examples/server-config.json"
echo "  mcp-registry validate --config examples/minimal-server-config.json"
echo "  mcp-registry list --registry-url https://mcpgateway.ddns.net"
echo ""
echo "Environment variables:"
echo "  export MCP_REGISTRY_URL=https://mcpgateway.ddns.net"
echo "  export MCP_AUTH_TOKEN=your_auth_token"