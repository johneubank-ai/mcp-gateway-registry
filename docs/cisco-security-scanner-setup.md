# MCP Security Scanner Setup

## Overview

The MCP Security Scanner is integrated into the service management workflow to scan MCP servers for security vulnerabilities before deployment.

## Prerequisites

### Admin password
Make sure the ADMIN_USER, ADMIN_PASSWORD are set in .env file for disabling unhealthy servers

### Install mcp-scanner

```bash
# Install the scanner package
uv pip install cisco-ai-mcp-scanner
```

### Set OpenAI API Key (Optional)

If using OpenAI-based analyzers, set your API key:

```bash
export OPENAI_API_KEY=sk-proj-...
```

Or pass it directly via the command line:

```bash
./cli/service_mgmt.sh scan https://mcp.example.com/mcp yara,openai sk-proj-...
```

## Usage

### Scan a Single Server

```bash
# Basic scan with YARA analyzer (default)
./cli/service_mgmt.sh scan https://mcp.deepwki.com/mcp

# Scan with multiple analyzers
./cli/service_mgmt.sh scan https://mcp.deepwki.com/mcp yara,openai

# With API key
./cli/service_mgmt.sh scan https://mcp.deepwki.com/mcp yara,openai sk-proj-...
```

### Direct Python CLI Usage

```bash
# Basic scan
uv run cli/mcp_security_scanner.py --server-url https://mcp.deepwki.com/mcp

# With multiple analyzers
uv run cli/mcp_security_scanner.py --server-url https://mcp.deepwki.com/mcp --analyzers yara,openai

# With debug logging
uv run cli/mcp_security_scanner.py --server-url https://mcp.deepwki.com/mcp --debug
```

## Output

### Console Output

The scanner provides an executive summary:

```
============================================================
SECURITY SCAN SUMMARY
============================================================
Server URL: https://mcp.deepwki.com/mcp
Scan Time: 2025-10-16T10:30:45Z

EXECUTIVE SUMMARY OF ISSUES:
  Critical Issues: 0
  High Severity: 4
  Medium Severity: 0
  Low Severity: 2

Overall Assessment: UNSAFE ✗

Detailed output saved to: security_scans/scan_mcp.deepwki.com_mcp_20251016_103045.json
============================================================
```

### JSON Output Files

Detailed scan results are saved to the `security_scans/` directory:

```
security_scans/
├── scan_mcp.deepwki.com_mcp_20251016_103045.json
├── scan_example.com_mcp_20251016_104500.json
└── ...
```

Each file contains:
- Full scanner output
- Detailed findings for each analyzer
- Severity levels and descriptions
- Timestamps and metadata

## Security Assessment

### Safety Criteria

- **SAFE**: No critical or high severity issues found
- **UNSAFE**: One or more critical or high severity issues detected

### Exit Codes

- `0`: Scan completed successfully, server is SAFE
- `1`: Scan completed successfully, server is UNSAFE
- `2`: Scan failed with error

## Automatic Security Scanning

**NEW**: Security scanning is now **automatically integrated** into the service registration workflow!

When you run:
```bash
./cli/service_mgmt.sh add cli/examples/server-config.json
```

The system will:
1. Validate the configuration
2. **Automatically scan the server for security vulnerabilities** (using YARA analyzer)
3. Display security scan results (Critical, High, Medium, Low severity issues)
4. Register the server regardless of scan results
5. If `is_safe: false` (critical or high severity issues found):
   - Server is registered but flagged with security-pending status
   - Warning message displayed
   - Detailed security report saved to `security_scans/` directory
6. Complete normal registration verification and health checks

### Example Output - Safe Server

```
=== Security Scan ===
ℹ Scanning server for security vulnerabilities...
✓ Security scan passed - Server is SAFE

=== Adding Service: example-server ===
...
✓ Service example-server successfully added, verified, and passed security scan!
```

### Example Output - Unsafe Server

```
=== Security Scan ===
ℹ Scanning server for security vulnerabilities...
✗ Security scan failed - Server has critical or high severity issues
ℹ Server will be registered but marked as UNHEALTHY with security-pending status

Security Issues Found:
  Critical: 2
  High: 3
  Medium: 1
  Low: 0

Detailed report: security_scans/scan_example.com_mcp_20251016_103045.json

=== Security Status Update ===
ℹ Marking server as UNHEALTHY due to failed security scan...
ℹ Server registered but flagged as security-pending
ℹ Review the security scan report before enabling this server

✓ Service example-server successfully added and verified
✗ ⚠️  WARNING: Server failed security scan - Review required before use
```

## Manual Security Scanning

You can also manually scan servers without registering them:

```bash
# Scan a specific server URL
./cli/service_mgmt.sh scan https://mcp.deepwki.com/mcp

# Scan with multiple analyzers
./cli/service_mgmt.sh scan https://mcp.deepwki.com/mcp yara,openai sk-proj-...
```

## Disabling Automatic Scans

Currently, automatic security scanning is always enabled during `add` operations. If you need to skip scanning (not recommended), you can:

1. Manually register using the MCP client directly
2. Or modify the `add_service()` function in `cli/service_mgmt.sh` to comment out the security scan section

## Future Enhancements

Potential future improvements:

1. **Configurable Scan Policies**: Add flag to skip scans or use different analyzer configurations
2. **Batch Scanning**: Scan multiple servers from a list file
3. **Report Generation**: Aggregate security reports across all registered servers
4. **Automated Remediation**: Suggest fixes for common security issues

## Troubleshooting

### Scanner Not Found

```bash
# Install the scanner package
uv pip install cisco-ai-mcp-scanner
```

### API Key Issues

```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Or pass it explicitly
./cli/service_mgmt.sh scan https://example.com/mcp yara,openai your-api-key
```

### Permission Issues

Ensure the `security_scans/` directory is writable:

```bash
mkdir -p security_scans
chmod 755 security_scans
```

## Additional Resources

- MCP Scanner Documentation: https://github.com/cisco-ai/mcp-scanner
- Service Management Script: `cli/service_mgmt.sh`
- Security Scanner CLI: `cli/mcp_security_scanner.py`
