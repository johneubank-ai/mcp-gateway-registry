#!/usr/bin/env python3
"""
MCP Registry CLI Tool

A command-line interface for registering and managing MCP servers in the MCP Gateway Registry.
This tool leverages the mcpgw server's register_service tool and provides comprehensive
validation and health checking capabilities.

Usage:
    mcp-registry register --config server.json
    mcp-registry validate --config server.json
    mcp-registry health-check --server-name "My Server"
    mcp-registry list
    mcp-registry test-search --query "find time tools"
"""

import argparse
import json
import logging
import os
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional

from rich.console import Console
from rich.table import Table
from rich.progress import Progress, SpinnerColumn, TextColumn

# Import shared MCP utility (now in same directory)
from mcp_utils import create_mcp_client

# Configure logging with basicConfig
logging.basicConfig(
    level=logging.INFO,  # Set the log level to INFO
    # Define log message format
    format="%(asctime)s,p%(process)s,{%(filename)s:%(lineno)d},%(levelname)s,%(message)s",
)

logger = logging.getLogger(__name__)

# Rich console for pretty output
console = Console()


class MCPRegistryCLI:
    """Main CLI class for MCP Registry operations."""

    def __init__(
        self,
        registry_url: str,
        mcpgw_url: Optional[str] = None,
        auth_token: Optional[str] = None,
    ):
        """
        Initialize the CLI client.

        Args:
            registry_url: Base URL of the MCP Gateway Registry
            mcpgw_url: URL of the mcpgw server (defaults to registry_url/mcpgw)
            auth_token: Optional authentication token
        """
        self.registry_url = registry_url.rstrip('/')
        self.mcpgw_url = mcpgw_url or f"{self.registry_url}/mcpgw"
        self.mcp_client = create_mcp_client(
            gateway_url=f"{self.mcpgw_url}/mcp",
            access_token=auth_token
        )

        logger.info(f"Registry URL: {self.registry_url}")
        logger.info(f"MCPGW URL: {self.mcpgw_url}")
        if self.mcp_client.access_token:
            logger.info("Authentication token loaded")
        else:
            logger.warning("No authentication token available")


    def _call_mcpgw_tool(
        self,
        tool_name: str,
        params: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Call a tool on the mcpgw server.

        Args:
            tool_name: Name of the tool to call
            params: Parameters for the tool

        Returns:
            Tool execution result
        """
        try:
            # Initialize MCP client if not already done
            if not self.mcp_client.session_id:
                logger.debug("Initializing MCP client session")
                self.mcp_client.initialize()
                logger.debug(f"MCP session initialized: {self.mcp_client.session_id}")

            logger.debug(f"Calling tool '{tool_name}' with params: {params}")

            # Call tool using mcpgw-specific parameter format
            result = self.mcp_client.call_mcpgw_tool(tool_name, params)
            logger.debug(f"Tool '{tool_name}' returned: {result}")

            return result

        except Exception as e:
            logger.error(f"Error calling {tool_name}: {e}")
            raise


    def register_server(
        self,
        config_file: Path,
        validate_health: bool = True,
        update_search: bool = True
    ) -> bool:
        """
        Register a new MCP server from configuration file.

        Args:
            config_file: Path to server configuration JSON file
            validate_health: Whether to perform health checks after registration
            update_search: Whether to verify FAISS search index update

        Returns:
            True if registration successful
        """
        # Load and validate configuration
        console.print(f"[blue]Loading configuration from {config_file}...")

        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
        except FileNotFoundError:
            console.print(f"[red]Error: Configuration file {config_file} not found")
            return False
        except json.JSONDecodeError as e:
            console.print(f"[red]Error: Invalid JSON in {config_file}: {e}")
            return False

        # Validate required fields
        required_fields = ["server_name", "path", "proxy_pass_url"]
        missing_fields = [f for f in required_fields if f not in config]

        if missing_fields:
            console.print(f"[red]Error: Missing required fields: {', '.join(missing_fields)}")
            return False

        # Ensure path starts with /
        if not config["path"].startswith("/"):
            config["path"] = "/" + config["path"]

        # Set defaults for optional fields
        config.setdefault("description", "")
        config.setdefault("tags", [])
        config.setdefault("is_python", False)
        config.setdefault("license", "N/A")

        # Register using mcpgw's register_service tool
        console.print(f"[yellow]Registering server '{config['server_name']}'...")

        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            console=console,
        ) as progress:
            task = progress.add_task("Calling register_service tool...", total=None)

            try:
                # Use direct tool call since register_service expects parameters directly
                if not self.mcp_client.session_id:
                    self.mcp_client.initialize()

                result = self.mcp_client.call_tool("register_service", config)
                progress.update(task, completed=100)

                # Check if the result indicates an error
                if isinstance(result, dict) and result.get('isError'):
                    error_text = result.get('content', [{}])[0].get('text', 'Unknown error')
                    console.print(f"[red]Registration failed: {error_text}")
                    return False

            except Exception as e:
                console.print(f"[red]Registration failed: {e}")
                return False

        console.print(f"[green]✓ Server '{config['server_name']}' registered successfully!")

        # Perform health checks if requested
        if validate_health:
            console.print("\n[yellow]Performing health validation...")
            health_result = self.health_check(config["path"])

            if not health_result.get("healthy"):
                console.print("[orange3]⚠ Warning: Server registered but health check failed")

        # Verify search index update if requested
        if update_search:
            console.print("\n[yellow]Verifying search index update...")
            search_result = self.test_search_index(config["server_name"])

            if search_result:
                console.print("[green]✓ Server is discoverable in search index")
            else:
                console.print("[orange3]⚠ Warning: Server not yet indexed (may take a moment)")

        return True


    def validate_config(self, config_file: Path) -> bool:
        """
        Validate a server configuration file without registering.

        Args:
            config_file: Path to configuration file

        Returns:
            True if configuration is valid
        """
        console.print(f"[blue]Validating configuration: {config_file}")

        try:
            with open(config_file, 'r') as f:
                config = json.load(f)
        except FileNotFoundError:
            console.print(f"[red]✗ Configuration file not found: {config_file}")
            return False
        except json.JSONDecodeError as e:
            console.print(f"[red]✗ Invalid JSON: {e}")
            return False

        # Check required fields
        required_fields = ["server_name", "path", "proxy_pass_url"]
        missing_fields = [f for f in required_fields if f not in config]

        if missing_fields:
            console.print(f"[red]✗ Missing required fields: {', '.join(missing_fields)}")
            return False

        # Validate field types and values
        errors = []

        if not isinstance(config.get("server_name"), str) or not config["server_name"].strip():
            errors.append("server_name must be a non-empty string")

        if not isinstance(config.get("path"), str) or not config["path"]:
            errors.append("path must be a non-empty string")

        if not isinstance(config.get("proxy_pass_url"), str) or not config["proxy_pass_url"]:
            errors.append("proxy_pass_url must be a non-empty string")

        # Validate optional fields if present
        if "tags" in config and not isinstance(config["tags"], list):
            errors.append("tags must be a list")

        if "is_python" in config and not isinstance(config["is_python"], bool):
            errors.append("is_python must be a boolean")

        if errors:
            console.print("[red]✗ Validation errors:")
            for error in errors:
                console.print(f"  • {error}")
            return False

        console.print("[green]✓ Configuration is valid")
        console.print(f"  Server: {config['server_name']}")
        console.print(f"  Path: {config['path']}")
        console.print(f"  URL: {config['proxy_pass_url']}")

        return True


    def health_check(self, server_path: str) -> Dict[str, Any]:
        """
        Perform comprehensive health check on a server.

        Args:
            server_path: Path of the server to check

        Returns:
            Health check results
        """
        console.print(f"[blue]Performing health check for: {server_path}")

        health_data = {
            "server_path": server_path,
            "healthy": False,
            "checks": {},
            "tools": [],
            "errors": []
        }

        try:
            # Get server details
            server_details = self._call_mcpgw_tool(
                "get_server_details",
                {"service_path": server_path}
            )

            health_data["checks"]["server_details"] = "✓ Server found and accessible"
            console.print(f"[green]✓ Server found: {server_details.get('server_name', 'Unknown')}")

            # Get tools for this service
            tools_result = self._call_mcpgw_tool(
                "get_service_tools",
                {"service_path": server_path}
            )

            if tools_result and "tools" in tools_result:
                tools = tools_result["tools"]
                health_data["tools"] = tools
                health_data["checks"]["tools_accessible"] = f"✓ {len(tools)} tools accessible"
                console.print(f"[green]✓ Found {len(tools)} tools")

                for tool in tools[:3]:  # Show first 3 tools
                    console.print(f"  • {tool.get('name', 'Unknown tool')}")
                if len(tools) > 3:
                    console.print(f"  ... and {len(tools) - 3} more")
            else:
                health_data["checks"]["tools_accessible"] = "⚠ No tools found"
                console.print("[orange3]⚠ No tools found or tools not accessible")

            # Refresh service to ensure latest state
            refresh_result = self._call_mcpgw_tool(
                "refresh_service",
                {"service_path": server_path}
            )

            health_data["checks"]["service_refresh"] = "✓ Service state refreshed"
            console.print("[green]✓ Service state refreshed")

            # Mark as healthy if all checks pass
            health_data["healthy"] = True

        except Exception as e:
            error_msg = f"Health check failed: {e}"
            health_data["errors"].append(error_msg)
            console.print(f"[red]✗ {error_msg}")

        return health_data


    def test_search_index(self, query: str) -> bool:
        """
        Test if tools are discoverable in the FAISS search index.

        Args:
            query: Search query to test

        Returns:
            True if search finds relevant results
        """
        console.print(f"[blue]Testing search index with query: '{query}'")

        try:
            # Initialize MCP client if not already done
            if not self.mcp_client.session_id:
                self.mcp_client.initialize()

            # Use direct tool call since intelligent_tool_finder expects parameters directly
            search_result = self.mcp_client.call_tool(
                "intelligent_tool_finder",
                {"natural_language_query": query}
            )

            if search_result and "tools" in search_result and search_result["tools"]:
                tools = search_result["tools"]
                console.print(f"[green]✓ Search found {len(tools)} relevant tools")

                for tool in tools[:3]:  # Show first 3 results
                    server_path = tool.get("server_path", "Unknown")
                    tool_name = tool.get("name", "Unknown")
                    console.print(f"  • {tool_name} (from {server_path})")

                return True
            else:
                console.print("[orange3]⚠ Search returned no results")
                return False

        except Exception as e:
            console.print(f"[red]✗ Search test failed: {e}")
            return False


    def list_servers(self) -> List[Dict[str, Any]]:
        """
        List all registered servers.

        Returns:
            List of server information
        """
        console.print("[blue]Fetching list of registered servers...")

        try:
            # Call the list_services tool through mcpgw
            result = self._call_mcpgw_tool("list_services", {})

            if "services" in result:
                servers = result["services"]
                console.print(f"[green]✓ Found {len(servers)} registered servers")
                return servers
            else:
                console.print("[orange3]⚠ No servers found or unexpected response format")
                return []

        except Exception as e:
            console.print(f"[red]✗ Failed to list servers: {e}")
            return []


    def remove_server(self, server_path: str) -> bool:
        """
        Remove a registered server.

        Args:
            server_path: Path of the server to remove (e.g., /minimal-server)

        Returns:
            True if removal was successful, False otherwise
        """
        console.print(f"[blue]Removing server: {server_path}")

        try:
            # Normalize path to ensure it starts with /
            if not server_path.startswith('/'):
                server_path = '/' + server_path

            # Call the remove_service tool through mcpgw
            result = self._call_mcpgw_tool("remove_service", {"service_path": server_path})

            if result.get("success", False):
                console.print(f"[green]✓ Successfully removed server: {server_path}")
                return True
            else:
                error_msg = result.get("error", "Unknown error occurred")
                console.print(f"[red]✗ Failed to remove server: {error_msg}")
                return False

        except Exception as e:
            console.print(f"[red]✗ Failed to remove server: {e}")
            logger.error(f"Error removing server {server_path}: {e}")
            return False


def _display_servers_table(servers: List[Dict[str, Any]]) -> None:
    """
    Display servers in a formatted table.

    Args:
        servers: List of server information
    """
    if not servers:
        console.print("[orange3]No servers to display")
        return

    table = Table(title="Registered MCP Servers")
    table.add_column("Server Name", style="cyan", no_wrap=True)
    table.add_column("Path", style="magenta")
    table.add_column("Status", style="green")
    table.add_column("Tools", style="blue")

    for server in servers:
        server_name = server.get("server_name", "Unknown")
        path = server.get("path", "N/A")
        status = server.get("status", "Unknown")
        tool_count = len(server.get("tools", []))

        table.add_row(
            server_name,
            path,
            status,
            str(tool_count)
        )

    console.print(table)


def _parse_args() -> argparse.Namespace:
    """
    Parse command line arguments.

    Returns:
        Parsed arguments
    """
    parser = argparse.ArgumentParser(
        description="MCP Registry CLI - Register and manage MCP servers",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Register a server
  uv run python mcp_registry_cli.py register --config examples/server-config.json

  # Validate configuration without registering
  uv run python mcp_registry_cli.py validate --config server.json

  # Check server health
  uv run python mcp_registry_cli.py health-check --server-path "/my-server"

  # List all servers
  uv run python mcp_registry_cli.py list

  # Test search functionality
  uv run python mcp_registry_cli.py test-search --query "time tools"

Environment Variables:
  MCP_REGISTRY_URL - Default registry URL
  MCP_AUTH_TOKEN   - Authentication token
  MCP_MCPGW_URL    - MCPGW service URL (optional)
        """
    )

    # Global options
    parser.add_argument(
        "--registry-url",
        default=os.getenv("MCP_REGISTRY_URL", "http://localhost"),
        help="Registry URL (default: %(default)s)"
    )
    parser.add_argument(
        "--mcpgw-url",
        default=os.getenv("MCP_MCPGW_URL"),
        help="MCPGW URL (default: registry-url/mcpgw)"
    )
    parser.add_argument(
        "--auth-token",
        default=os.getenv("MCP_AUTH_TOKEN"),
        help="Authentication token"
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # Subcommands
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Register command
    register_parser = subparsers.add_parser("register", help="Register a new server")
    register_parser.add_argument(
        "--config",
        required=True,
        help="Server configuration JSON file"
    )
    register_parser.add_argument(
        "--skip-health-check",
        action="store_true",
        help="Skip health check after registration"
    )
    register_parser.add_argument(
        "--skip-search-update",
        action="store_true",
        help="Skip search index verification"
    )
    register_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # Remove command
    remove_parser = subparsers.add_parser("remove", help="Remove a registered server")
    remove_parser.add_argument(
        "--path",
        required=True,
        help="Server path to remove (e.g., /minimal-server)"
    )
    remove_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # Validate command
    validate_parser = subparsers.add_parser("validate", help="Validate configuration")
    validate_parser.add_argument(
        "--config",
        required=True,
        help="Configuration file to validate"
    )
    validate_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # Health check command
    health_parser = subparsers.add_parser("health-check", help="Check server health")
    health_parser.add_argument(
        "--server-path",
        required=True,
        help="Server path to check"
    )
    health_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # List command
    list_parser = subparsers.add_parser("list", help="List registered servers")
    list_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    # Test search command
    search_parser = subparsers.add_parser("test-search", help="Test search functionality")
    search_parser.add_argument(
        "--query",
        required=True,
        help="Search query to test"
    )
    search_parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging"
    )

    return parser.parse_args()


def _main() -> None:
    """Main CLI entry point."""
    args = _parse_args()

    # Configure debug logging if requested
    if hasattr(args, 'debug') and args.debug:
        logging.getLogger().setLevel(logging.DEBUG)
        logger.debug("Debug logging enabled")

    # Validate required command
    if not args.command:
        console.print("[red]Error: No command specified. Use --help for usage information.")
        sys.exit(1)

    # Create CLI instance
    cli = MCPRegistryCLI(
        registry_url=args.registry_url,
        mcpgw_url=args.mcpgw_url,
        auth_token=args.auth_token
    )

    try:
        if args.command == "register":
            success = cli.register_server(
                config_file=Path(args.config),
                validate_health=not args.skip_health_check,
                update_search=not args.skip_search_update
            )
            sys.exit(0 if success else 1)

        elif args.command == "remove":
            success = cli.remove_server(args.path)
            sys.exit(0 if success else 1)

        elif args.command == "validate":
            success = cli.validate_config(Path(args.config))
            sys.exit(0 if success else 2)

        elif args.command == "health-check":
            result = cli.health_check(args.server_path)
            if result.get("healthy"):
                console.print("[green]✓ Server is healthy")
                sys.exit(0)
            else:
                console.print("[red]✗ Server health check failed")
                sys.exit(1)

        elif args.command == "list":
            servers = cli.list_servers()
            _display_servers_table(servers)

        elif args.command == "test-search":
            success = cli.test_search_index(args.query)
            if success:
                console.print("[green]✓ Search test successful")
            else:
                console.print("[orange3]⚠ Search test inconclusive")

    except Exception as e:
        logger.error(f"CLI operation failed: {e}")
        console.print(f"[red]Error: {e}")
        sys.exit(3)


def main() -> None:
    """Entry point for the CLI."""
    _main()


if __name__ == "__main__":
    main()