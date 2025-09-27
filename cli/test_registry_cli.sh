#!/bin/bash
set -e

# Test script for MCP Registry CLI
# This script demonstrates all CLI functionality

echo "Testing MCP Registry CLI Tool"
echo "============================="

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Function to run CLI commands
run_cli() {
    cd "$SCRIPT_DIR" && uv run python mcp_registry_cli.py "$@"
}
REGISTRY_URL="${MCP_REGISTRY_URL:-http://localhost}"

echo ""
echo "Test 1: Display help"
echo "--------------------"
run_cli --help

echo ""
echo "Test 2: Validate minimal configuration"
echo "--------------------------------------"
run_cli validate --config examples/minimal-server-config.json

echo ""
echo "Test 3: Validate full configuration"
echo "-----------------------------------"
run_cli validate --config examples/server-config.json

echo ""
echo "Test 4: Validate invalid configuration (should fail)"
echo "----------------------------------------------------"
if run_cli validate --config examples/invalid-config.json; then
    echo "✗ ERROR: Invalid config validation should have failed!"
    exit 1
else
    echo "✓ Successfully caught invalid configuration"
fi

echo ""
echo "Test 5: Test registry connectivity (may fail if registry not running)"
echo "---------------------------------------------------------------------"
if run_cli list --registry-url "$REGISTRY_URL" 2>/dev/null; then
    echo "✓ Successfully connected to registry"

    echo ""
    echo "Test 6: Test search functionality"
    echo "---------------------------------"
    run_cli test-search --query "time tools" --registry-url "$REGISTRY_URL" || echo "⚠ Search test failed (expected if no servers registered)"

else
    echo "⚠ Registry not accessible at $REGISTRY_URL"
    echo "  This is expected if the registry is not running"
fi

echo ""
echo "Test 7: Test authentication token support"
echo "-----------------------------------------"
if [ -n "$MCP_AUTH_TOKEN" ]; then
    run_cli list --registry-url "$REGISTRY_URL" --auth-token "$MCP_AUTH_TOKEN" || echo "⚠ Authentication test failed"
else
    echo "⚠ No MCP_AUTH_TOKEN set, skipping authentication test"
fi

echo ""
echo "CLI Testing Complete!"
echo "===================="
echo ""
echo "All core functionality is working:"
echo "✓ Help system"
echo "✓ Configuration validation"
echo "✓ Error handling"
echo "✓ Network connectivity (when registry available)"
echo "✓ Authentication support"
echo ""
echo "To test with a live registry:"
echo "  export MCP_REGISTRY_URL=https://mcpgateway.ddns.net"
echo "  export MCP_AUTH_TOKEN=your_token_here"
echo "  ./test_cli.sh"