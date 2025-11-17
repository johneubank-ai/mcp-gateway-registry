#!/usr/bin/env python3
"""
MCP Gateway Registry Client - Standalone Pydantic-based client for the Registry API.

This client provides a type-safe interface to the MCP Gateway Registry API endpoints
documented in:
- /home/ubuntu/repos/mcp-gateway-registry/docs/api-specs/server-management.yaml (Server Management)
- /home/ubuntu/repos/mcp-gateway-registry/docs/api-specs/a2a-agent-management.yaml (Agent Management)

Authentication is handled via JWT tokens retrieved from AWS SSM Parameter Store using
the get-m2m-token.sh script.
"""

import json
import logging
import subprocess
from typing import Optional, List, Dict, Any
from enum import Enum
from datetime import datetime

import requests
from pydantic import BaseModel, Field, HttpUrl

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s,p%(process)s,{%(filename)s:%(lineno)d},%(levelname)s,%(message)s",
)
logger = logging.getLogger(__name__)


class HealthStatus(str, Enum):
    """Health status enumeration for servers."""
    HEALTHY = "healthy"
    UNHEALTHY = "unhealthy"
    UNKNOWN = "unknown"


class ServiceRegistration(BaseModel):
    """Service registration request model (UI-based registration)."""

    name: str = Field(..., description="Service name")
    description: str = Field(..., description="Service description")
    path: str = Field(..., description="Service path")
    proxy_pass_url: str = Field(..., description="Proxy pass URL")
    tags: Optional[str] = Field(None, description="Comma-separated tags")
    num_tools: Optional[int] = Field(None, description="Number of tools")
    num_stars: Optional[int] = Field(None, description="Number of stars")
    is_python: Optional[bool] = Field(None, description="Is Python server")
    license: Optional[str] = Field(None, description="License type")


class InternalServiceRegistration(BaseModel):
    """Internal service registration model (Admin/M2M registration)."""

    service_path: str = Field(..., description="Service path (e.g., /cloudflare-docs)")
    name: Optional[str] = Field(None, description="Service name")
    description: Optional[str] = Field(None, description="Service description")
    proxy_pass_url: Optional[str] = Field(None, description="Proxy pass URL")
    auth_provider: Optional[str] = Field(None, description="Authentication provider")
    auth_type: Optional[str] = Field(None, description="Authentication type")
    supported_transports: Optional[List[str]] = Field(None, description="Supported transports")
    headers: Optional[Dict[str, str]] = Field(None, description="Custom headers")
    tool_list_json: Optional[str] = Field(None, description="Tool list as JSON string")
    overwrite: Optional[bool] = Field(False, description="Overwrite if exists")


class Server(BaseModel):
    """Server information model."""

    path: str = Field(..., description="Service path")
    name: str = Field(..., description="Service name")
    description: str = Field(..., description="Service description")
    is_enabled: bool = Field(..., description="Whether service is enabled")
    health_status: HealthStatus = Field(..., description="Health status")


class ServerDetail(BaseModel):
    """Detailed server information model."""

    path: str = Field(..., description="Service path")
    name: str = Field(..., description="Service name")
    description: str = Field(..., description="Service description")
    url: str = Field(..., description="Service URL")
    is_enabled: bool = Field(..., description="Whether service is enabled")
    num_tools: int = Field(..., description="Number of tools")
    health_status: str = Field(..., description="Health status")
    last_health_check: Optional[datetime] = Field(None, description="Last health check timestamp")


class ServerListResponse(BaseModel):
    """Server list response model."""

    servers: List[Server] = Field(..., description="List of servers")


class ServiceResponse(BaseModel):
    """Service operation response model."""

    path: str = Field(..., description="Service path")
    name: str = Field(..., description="Service name")
    message: str = Field(..., description="Response message")


class ToggleResponse(BaseModel):
    """Toggle service response model."""

    path: str = Field(..., description="Service path")
    is_enabled: bool = Field(..., description="Current enabled status")
    message: str = Field(..., description="Response message")


class ErrorResponse(BaseModel):
    """Error response model."""

    detail: str = Field(..., description="Error detail message")
    error_code: Optional[str] = Field(None, description="Error code")
    request_id: Optional[str] = Field(None, description="Request ID")


class GroupListResponse(BaseModel):
    """Group list response model."""

    groups: List[Dict[str, Any]] = Field(..., description="List of groups")


# Agent Management Models


class AgentProvider(str, Enum):
    """Agent provider enumeration."""
    ANTHROPIC = "anthropic"
    CUSTOM = "custom"
    OTHER = "other"


class AgentVisibility(str, Enum):
    """Agent visibility enumeration."""
    PUBLIC = "public"
    PRIVATE = "private"
    INTERNAL = "internal"


class SecuritySchemeType(str, Enum):
    """Security scheme type enumeration (A2A spec values)."""
    API_KEY = "apiKey"
    HTTP = "http"
    OAUTH2 = "oauth2"
    OPENID_CONNECT = "openIdConnect"


class SecurityScheme(BaseModel):
    """Security scheme model."""

    type: SecuritySchemeType = Field(..., description="Security scheme type")
    scheme: Optional[str] = Field(
        None,
        description="HTTP auth scheme: basic, bearer, digest",
    )
    in_: Optional[str] = Field(
        None,
        alias="in",
        description="API key location: header, query, cookie",
    )
    name: Optional[str] = Field(
        None,
        description="Name of header/query/cookie for API key",
    )
    bearer_format: Optional[str] = Field(
        None,
        description="Bearer token format hint (e.g., JWT)",
    )
    flows: Optional[Dict[str, Any]] = Field(
        None,
        description="OAuth2 flows configuration",
    )
    openid_connect_url: Optional[str] = Field(
        None,
        description="OpenID Connect discovery URL",
    )
    description: Optional[str] = Field(None, description="Security scheme description")


class Skill(BaseModel):
    """Skill model for agent capabilities."""

    id: str = Field(..., description="Unique skill identifier")
    name: str = Field(..., description="Skill name")
    description: str = Field(..., description="Skill description")
    parameters: Optional[Dict[str, Any]] = Field(None, description="JSON schema for skill parameters")
    tags: List[str] = Field(default_factory=list, description="Skill categorization tags")


class AgentRegistration(BaseModel):
    """Agent registration request model."""

    name: str = Field(..., description="Display name of the agent")
    description: str = Field(..., description="Detailed description of the agent")
    path: str = Field(..., description="Unique path for the agent (e.g., /code-reviewer)")
    url: str = Field(..., description="URL where the agent is hosted")
    version: str = Field(..., description="Version string (e.g., 1.0.0)")
    provider: AgentProvider = Field(..., description="Agent provider")
    security_schemes: Optional[Dict[str, SecurityScheme]] = Field(
        None,
        description="Security schemes supported by the agent"
    )
    skills: List[Skill] = Field(..., description="Array of skills provided by the agent")
    tags: Optional[str] = Field(None, description="Comma-separated tags")
    visibility: Optional[AgentVisibility] = Field(
        AgentVisibility.PUBLIC,
        description="Visibility level"
    )
    license: Optional[str] = Field(None, description="License type (e.g., MIT, Apache-2.0)")


class AgentCard(BaseModel):
    """Agent card model (summary view)."""

    name: str = Field(..., description="Agent name")
    path: str = Field(..., description="Agent path")
    url: str = Field(..., description="Agent URL")
    num_skills: int = Field(..., description="Number of skills")
    registered_at: datetime = Field(..., description="Registration timestamp")
    is_enabled: bool = Field(..., description="Whether agent is enabled")


class AgentRegistrationResponse(BaseModel):
    """Agent registration response model."""

    message: str = Field(..., description="Response message")
    agent: AgentCard = Field(..., description="Registered agent card")


class SkillDetail(BaseModel):
    """Detailed skill model."""

    name: str = Field(..., description="Skill name")
    description: str = Field(..., description="Skill description")
    input_schema: Optional[Dict[str, Any]] = Field(None, description="JSON schema for skill input")


class AgentDetail(BaseModel):
    """Detailed agent model."""

    name: str = Field(..., description="Agent name")
    path: str = Field(..., description="Agent path")
    description: str = Field(..., description="Agent description")
    url: str = Field(..., description="Agent URL")
    version: str = Field(..., description="Agent version")
    provider: str = Field(..., description="Agent provider")
    skills: List[SkillDetail] = Field(..., description="Agent skills")
    is_enabled: bool = Field(..., description="Whether agent is enabled")
    visibility: str = Field(..., description="Visibility level")
    security_schemes: Optional[Dict[str, Any]] = Field(None, description="Security schemes")


class AgentListItem(BaseModel):
    """Agent list item model (AgentInfo from server)."""

    name: str = Field(..., description="Agent name")
    description: str = Field(default="", description="Agent description")
    path: str = Field(..., description="Agent path")
    url: str = Field(..., description="Agent URL")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    skills: List[str] = Field(default_factory=list, description="Skill names")
    num_skills: int = Field(default=0, description="Number of skills")
    num_stars: int = Field(default=0, description="Community rating")
    is_enabled: bool = Field(default=False, description="Whether agent is enabled")
    provider: Optional[str] = Field(None, description="Agent provider")
    streaming: bool = Field(default=False, description="Supports streaming")
    trust_level: str = Field(default="unverified", description="Trust level")


class AgentListResponse(BaseModel):
    """Agent list response model."""

    agents: List[AgentListItem] = Field(..., description="List of agents")
    total_count: int = Field(..., description="Total count of agents")


class AgentToggleResponse(BaseModel):
    """Agent toggle response model."""

    path: str = Field(..., description="Agent path")
    is_enabled: bool = Field(..., description="Current enabled status")
    message: str = Field(..., description="Response message")


class SkillDiscoveryRequest(BaseModel):
    """Skill-based discovery request model."""

    skills: List[str] = Field(..., description="List of required skills")
    tags: Optional[List[str]] = Field(None, description="Optional tag filters")


class DiscoveredAgent(BaseModel):
    """Discovered agent model (skill-based)."""

    path: str = Field(..., description="Agent path")
    name: str = Field(..., description="Agent name")
    relevance_score: float = Field(..., description="Matching score (0.0 to 1.0)")
    matching_skills: List[str] = Field(..., description="Matching skills")


class AgentDiscoveryResponse(BaseModel):
    """Agent discovery response model (skill-based)."""

    agents: List[DiscoveredAgent] = Field(..., description="Discovered agents")


class SemanticDiscoveredAgent(BaseModel):
    """Semantically discovered agent model."""

    path: str = Field(..., description="Agent path")
    name: str = Field(..., description="Agent name")
    relevance_score: float = Field(..., description="Semantic similarity score (0.0 to 1.0)")
    description: str = Field(..., description="Agent description")


class AgentSemanticDiscoveryResponse(BaseModel):
    """Agent semantic discovery response model."""

    agents: List[SemanticDiscoveredAgent] = Field(..., description="Semantically discovered agents")


class RegistryClient:
    """
    MCP Gateway Registry API client.

    Provides methods for interacting with the Registry API endpoints including:
    - Server Management: registration, removal, toggling, health checks
    - Group Management: create, delete, list groups
    - Agent Management: register, update, delete, discover agents (A2A)

    Authentication is handled via JWT tokens passed to the constructor.
    """

    def __init__(
        self,
        registry_url: str,
        token: str
    ):
        """
        Initialize the Registry Client.

        Args:
            registry_url: Base URL of the registry (e.g., https://registry.mycorp.click)
            token: JWT access token for authentication
        """
        self.registry_url = registry_url.rstrip('/')
        self._token = token

        # Redact token in logs - show only first 8 characters
        redacted_token = f"{token[:8]}..." if len(token) > 8 else "***"
        logger.info(f"Initialized RegistryClient for {self.registry_url} (token: {redacted_token})")

    def _get_headers(self) -> Dict[str, str]:
        """
        Get request headers with JWT token.

        Returns:
            Dictionary of HTTP headers
        """
        return {
            "Authorization": f"Bearer {self._token}",
            "Content-Type": "application/json"
        }

    def _make_request(
        self,
        method: str,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None
    ) -> requests.Response:
        """
        Make HTTP request to the Registry API.

        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint path
            data: Request body data
            params: Query parameters

        Returns:
            Response object

        Raises:
            requests.HTTPError: If request fails
        """
        url = f"{self.registry_url}{endpoint}"
        headers = self._get_headers()

        logger.debug(f"{method} {url}")

        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            json=data,
            params=params,
            timeout=30
        )

        response.raise_for_status()
        return response

    def register_service(
        self,
        registration: InternalServiceRegistration
    ) -> ServiceResponse:
        """
        Register a new service in the registry.

        Args:
            registration: Service registration data

        Returns:
            Service response with registration details

        Raises:
            requests.HTTPError: If registration fails
        """
        logger.info(f"Registering service: {registration.service_path}")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/register",
            data=registration.model_dump(exclude_none=True)
        )

        logger.info(f"Service registered successfully: {registration.service_path}")
        return ServiceResponse(**response.json())

    def remove_service(self, service_path: str) -> Dict[str, Any]:
        """
        Remove a service from the registry.

        Args:
            service_path: Path of service to remove

        Returns:
            Response data

        Raises:
            requests.HTTPError: If removal fails
        """
        logger.info(f"Removing service: {service_path}")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/remove",
            data={"service_path": service_path}
        )

        logger.info(f"Service removed successfully: {service_path}")
        return response.json()

    def toggle_service(self, service_path: str) -> ToggleResponse:
        """
        Toggle service enabled/disabled status.

        Args:
            service_path: Path of service to toggle

        Returns:
            Toggle response with current status

        Raises:
            requests.HTTPError: If toggle fails
        """
        logger.info(f"Toggling service: {service_path}")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/toggle",
            data={"service_path": service_path}
        )

        result = ToggleResponse(**response.json())
        logger.info(f"Service toggled: {service_path} -> enabled={result.is_enabled}")
        return result

    def list_services(self) -> ServerListResponse:
        """
        List all services in the registry.

        Returns:
            Server list response

        Raises:
            requests.HTTPError: If list operation fails
        """
        logger.info("Listing all services")

        response = self._make_request(
            method="GET",
            endpoint="/api/internal/list"
        )

        result = ServerListResponse(**response.json())
        logger.info(f"Retrieved {len(result.servers)} services")
        return result

    def healthcheck(self) -> Dict[str, Any]:
        """
        Perform health check on all services.

        Returns:
            Health check response with service statuses

        Raises:
            requests.HTTPError: If health check fails
        """
        logger.info("Performing health check on all services")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/healthcheck"
        )

        result = response.json()
        logger.info(f"Health check completed: {result.get('status', 'unknown')}")
        return result

    def add_server_to_groups(
        self,
        server_name: str,
        group_names: List[str]
    ) -> Dict[str, Any]:
        """
        Add a server to user groups.

        Args:
            server_name: Name of server
            group_names: List of group names

        Returns:
            Response data

        Raises:
            requests.HTTPError: If operation fails
        """
        logger.info(f"Adding server {server_name} to groups: {group_names}")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/add-to-groups",
            data={
                "server_name": server_name,
                "group_names": ",".join(group_names)
            }
        )

        logger.info(f"Server added to groups successfully")
        return response.json()

    def remove_server_from_groups(
        self,
        server_name: str,
        group_names: List[str]
    ) -> Dict[str, Any]:
        """
        Remove a server from user groups.

        Args:
            server_name: Name of server
            group_names: List of group names

        Returns:
            Response data

        Raises:
            requests.HTTPError: If operation fails
        """
        logger.info(f"Removing server {server_name} from groups: {group_names}")

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/remove-from-groups",
            data={
                "server_name": server_name,
                "group_names": ",".join(group_names)
            }
        )

        logger.info(f"Server removed from groups successfully")
        return response.json()

    def create_group(
        self,
        group_name: str,
        description: Optional[str] = None,
        create_in_keycloak: bool = False
    ) -> Dict[str, Any]:
        """
        Create a new user group.

        Args:
            group_name: Name of group
            description: Group description
            create_in_keycloak: Whether to create in Keycloak

        Returns:
            Response data

        Raises:
            requests.HTTPError: If creation fails
        """
        logger.info(f"Creating group: {group_name}")

        data = {"group_name": group_name}
        if description:
            data["description"] = description
        if create_in_keycloak:
            data["create_in_keycloak"] = True

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/create-group",
            data=data
        )

        logger.info(f"Group created successfully: {group_name}")
        return response.json()

    def delete_group(
        self,
        group_name: str,
        delete_from_keycloak: bool = False,
        force: bool = False
    ) -> Dict[str, Any]:
        """
        Delete a user group.

        Args:
            group_name: Name of group
            delete_from_keycloak: Whether to delete from Keycloak
            force: Force deletion of system groups

        Returns:
            Response data

        Raises:
            requests.HTTPError: If deletion fails
        """
        logger.info(f"Deleting group: {group_name}")

        data = {"group_name": group_name}
        if delete_from_keycloak:
            data["delete_from_keycloak"] = True
        if force:
            data["force"] = True

        response = self._make_request(
            method="POST",
            endpoint="/api/internal/delete-group",
            data=data
        )

        logger.info(f"Group deleted successfully: {group_name}")
        return response.json()

    def list_groups(
        self,
        include_keycloak: bool = True,
        include_scopes: bool = True
    ) -> GroupListResponse:
        """
        List all user groups.

        Args:
            include_keycloak: Include Keycloak information
            include_scopes: Include scope information

        Returns:
            Group list response

        Raises:
            requests.HTTPError: If list operation fails
        """
        logger.info("Listing all groups")

        params = {
            "include_keycloak": str(include_keycloak).lower(),
            "include_scopes": str(include_scopes).lower()
        }

        response = self._make_request(
            method="GET",
            endpoint="/api/internal/list-groups",
            params=params
        )

        result = GroupListResponse(**response.json())
        logger.info(f"Retrieved {len(result.groups)} groups")
        return result

    # Agent Management Methods

    def register_agent(
        self,
        agent: AgentRegistration
    ) -> AgentRegistrationResponse:
        """
        Register a new A2A agent.

        Args:
            agent: Agent registration data

        Returns:
            Agent registration response

        Raises:
            requests.HTTPError: If registration fails (409 for conflict, 422 for validation error, 403 for permission denied)
        """
        logger.info(f"Registering agent: {agent.path}")

        agent_data = agent.model_dump(exclude_none=True)
        logger.debug(f"Agent data being sent: {json.dumps(agent_data, indent=2, default=str)}")

        response = self._make_request(
            method="POST",
            endpoint="/api/agents/register",
            data=agent_data
        )

        result = AgentRegistrationResponse(**response.json())
        logger.info(f"Agent registered successfully: {agent.path}")
        return result

    def list_agents(
        self,
        query: Optional[str] = None,
        enabled_only: bool = False,
        visibility: Optional[str] = None
    ) -> AgentListResponse:
        """
        List all agents with optional filtering.

        Args:
            query: Search query string
            enabled_only: Show only enabled agents
            visibility: Filter by visibility level (public, private, internal)

        Returns:
            Agent list response

        Raises:
            requests.HTTPError: If list operation fails
        """
        logger.info("Listing agents")

        params = {}
        if query:
            params["query"] = query
        if enabled_only:
            params["enabled_only"] = "true"
        if visibility:
            params["visibility"] = visibility

        response = self._make_request(
            method="GET",
            endpoint="/api/agents",
            params=params
        )

        result = AgentListResponse(**response.json())
        logger.info(f"Retrieved {len(result.agents)} agents")
        return result

    def get_agent(
        self,
        path: str
    ) -> AgentDetail:
        """
        Get detailed information about a specific agent.

        Args:
            path: Agent path (e.g., /code-reviewer)

        Returns:
            Agent detail

        Raises:
            requests.HTTPError: If agent not found (404) or unauthorized (403)
        """
        logger.info(f"Getting agent details: {path}")

        response = self._make_request(
            method="GET",
            endpoint=f"/api/agents{path}"
        )

        result = AgentDetail(**response.json())
        logger.info(f"Retrieved agent details: {path}")
        return result

    def update_agent(
        self,
        path: str,
        agent: AgentRegistration
    ) -> AgentDetail:
        """
        Update an existing agent.

        Args:
            path: Agent path
            agent: Updated agent data

        Returns:
            Updated agent detail

        Raises:
            requests.HTTPError: If update fails (404 for not found, 403 for permission denied, 422 for validation error)
        """
        logger.info(f"Updating agent: {path}")

        response = self._make_request(
            method="PUT",
            endpoint=f"/api/agents{path}",
            data=agent.model_dump(exclude_none=True)
        )

        result = AgentDetail(**response.json())
        logger.info(f"Agent updated successfully: {path}")
        return result

    def delete_agent(
        self,
        path: str
    ) -> None:
        """
        Delete an agent from the registry.

        Args:
            path: Agent path

        Raises:
            requests.HTTPError: If deletion fails (404 for not found, 403 for permission denied)
        """
        logger.info(f"Deleting agent: {path}")

        self._make_request(
            method="DELETE",
            endpoint=f"/api/agents{path}"
        )

        logger.info(f"Agent deleted successfully: {path}")

    def toggle_agent(
        self,
        path: str,
        enabled: bool
    ) -> AgentToggleResponse:
        """
        Toggle agent enabled/disabled status.

        Args:
            path: Agent path
            enabled: True to enable, False to disable

        Returns:
            Agent toggle response

        Raises:
            requests.HTTPError: If toggle fails (404 for not found, 403 for permission denied)
        """
        logger.info(f"Toggling agent {path} to {'enabled' if enabled else 'disabled'}")

        params = {"enabled": str(enabled).lower()}

        response = self._make_request(
            method="POST",
            endpoint=f"/api/agents{path}/toggle",
            params=params
        )

        result = AgentToggleResponse(**response.json())
        logger.info(f"Agent toggled: {path} is now {'enabled' if result.is_enabled else 'disabled'}")
        return result

    def discover_agents_by_skills(
        self,
        skills: List[str],
        tags: Optional[List[str]] = None,
        max_results: int = 10
    ) -> AgentDiscoveryResponse:
        """
        Discover agents by required skills.

        Args:
            skills: List of required skills
            tags: Optional tag filters
            max_results: Maximum number of results (default: 10, max: 100)

        Returns:
            Agent discovery response

        Raises:
            requests.HTTPError: If discovery fails (400 for bad request)
        """
        logger.info(f"Discovering agents by skills: {skills}")

        request_data = SkillDiscoveryRequest(skills=skills, tags=tags)
        params = {"max_results": max_results}

        response = self._make_request(
            method="POST",
            endpoint="/api/agents/discover",
            data=request_data.model_dump(exclude_none=True),
            params=params
        )

        result = AgentDiscoveryResponse(**response.json())
        logger.info(f"Discovered {len(result.agents)} agents matching skills")
        return result

    def discover_agents_semantic(
        self,
        query: str,
        max_results: int = 10
    ) -> AgentSemanticDiscoveryResponse:
        """
        Discover agents using semantic search (FAISS vector search).

        Args:
            query: Natural language query (e.g., "Find agents that can analyze code")
            max_results: Maximum number of results (default: 10, max: 100)

        Returns:
            Agent semantic discovery response

        Raises:
            requests.HTTPError: If discovery fails (400 for bad request, 500 for search error)
        """
        logger.info(f"Discovering agents semantically: {query}")

        params = {
            "query": query,
            "max_results": max_results
        }

        response = self._make_request(
            method="POST",
            endpoint="/api/agents/discover/semantic",
            params=params
        )

        result = AgentSemanticDiscoveryResponse(**response.json())
        logger.info(f"Discovered {len(result.agents)} agents via semantic search")
        return result
