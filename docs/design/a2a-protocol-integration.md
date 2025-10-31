# A2A Protocol Integration Design Document

**MCP Gateway Registry - Agent Discovery Support (Registry-Only)**

**Version:** 1.0
**Date:** 2025-10-30
**Status:** Active Design Document (GitHub Issue #195)
**Location:** `docs/design/a2a-protocol-integration.md`

> **Note**: This is the living design document for A2A protocol support. Updates to this document should be made as the design evolves during implementation.

---

## Executive Summary: Registry-Only Design

**This document describes A2A protocol integration for agent discovery and registration in the MCP Gateway Registry.**

**What This Design Includes**:
- ✅ Agent card storage and management in the registry
- ✅ Discovery APIs for agents to find other agents
- ✅ Semantic search and skill-based discovery
- ✅ Security and access controls for agent visibility
- ✅ Reuse of existing auth and storage infrastructure

**What This Design Does NOT Include**:
- ❌ Agent-to-agent request routing through the registry
- ❌ Gateway intermediation for agent communication
- ❌ Reverse proxy for agent invocations
- ❌ Changes to existing MCP gateway functionality

**How It Works**:
1. Agent A submits its card to the registry
2. Agent B queries the registry to discover agents
3. Registry returns Agent A's card (including its direct URL)
4. Agent B connects directly to Agent A using that URL
5. **Registry is out of the communication path**

---

## Table of Contents

1. [Vision & Objectives](#1-vision--objectives)
2. [Architecture Overview](#2-architecture-overview)
3. [Data Models](#3-data-models)
4. [API Specification](#4-api-specification)
5. [Discovery Mechanisms](#5-discovery-mechanisms)
6. [Security & Access Control](#6-security--access-control)
7. [Implementation Roadmap](#7-implementation-roadmap)
8. [Code Structure & Modules](#8-code-structure--modules)
9. [Integration Points](#9-integration-points)
10. [Example Workflows](#10-example-workflows)
11. [Backward Compatibility](#11-backward-compatibility)
12. [Open Questions & Future Considerations](#12-open-questions--future-considerations)

---

## 1. Vision & Objectives

### 1.1 Problem Statement

The MCP Gateway Registry currently manages Model Context Protocol (MCP) servers - tools and resources that AI agents can access. However, agents themselves cannot be discovered or invoked by other agents. The A2A (Agent-to-Agent) protocol provides a standard way for agents to:

- Advertise their capabilities through Agent Cards
- Discover other agents based on skills and requirements
- Establish secure communication channels
- Compose multi-agent workflows

### 1.2 Value Proposition

By integrating A2A protocol support into the MCP Gateway Registry, we enable:

1. **Unified Discovery**: Single registry for both MCP tools AND A2A agents
2. **Agent Marketplaces**: Curated collections of specialized agents with security vetting
3. **Agent-to-Agent Discovery**: Agents can dynamically discover other agents by capabilities
4. **Enterprise Agent Governance**: Same fine-grained access control and audit trails for agents
5. **Hybrid Workflows**: Seamless combination of tool invocation (MCP) and agent delegation (A2A)

**Important**: This design covers **registry-side discovery only**. Agents communicate directly with each other once discovered - the registry and gateway do NOT proxy or intermediary agent-to-agent communication.

### 1.3 Design Principles

1. **Simplicity**: Entry-level developers should understand the architecture
2. **No Breaking Changes**: Existing MCP functionality remains unchanged
3. **Reuse Infrastructure**: Leverage existing auth, discovery, storage, and monitoring
4. **Standards Compliance**: Follow A2A protocol specification where defined
5. **Extensibility**: Support future A2A protocol versions and extensions

---

## 2. Architecture Overview

### 2.1 Conceptual Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              MCP Gateway Registry (Discovery Only)               │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │             Unified Discovery Layer                       │  │
│  │  (FAISS Vector Search + Tag-based Filtering)             │  │
│  │  Returns: Agent Cards with direct URLs                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ▲                                       │
│                          │                                       │
│         ┌────────────────┴──────────────────┐                   │
│         │                                   │                   │
│  ┌──────▼───────┐                  ┌───────▼────────┐          │
│  │  MCP Server  │                  │  A2A Agent     │          │
│  │  Registry    │                  │  Registry      │          │
│  │              │                  │                │          │
│  │ - ServerInfo │                  │ - AgentCard    │          │
│  │ - Tools      │                  │ - Skills       │          │
│  │ - Endpoints  │                  │ - URLs         │          │
│  └──────────────┘                  └────────────────┘          │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │      Authentication & Authorization Layer                 │  │
│  │  (OAuth 2.0, Keycloak, Fine-grained Scopes)             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │         Storage Layer (JSON Files + FAISS)                │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘

                    Direct Communication
                    (NO Registry Intermediation)
                            │
                  ┌─────────┴─────────┐
                  │                   │
            ┌─────▼────┐        ┌─────▼────┐
            │ Agent A  │◄────►  │ Agent B  │
            │ URL:...  │        │ URL:...  │
            └──────────┘        └──────────┘
```

**Key Point**: The registry stores and helps discover agents. Once discovered, agents communicate directly with each other using the URLs returned by the registry. Neither the registry nor the gateway participate in agent-to-agent communication.

### 2.2 Coexistence Strategy

**Unified Entity Model**: Both MCP servers and A2A agents are stored as "entities" with:
- Common fields: name, description, tags, enabled/disabled state
- Type discriminator: `entity_type` = "mcp_server" | "a2a_agent"
- Type-specific extensions stored in dedicated fields

**Single Discovery Interface**: Agents and MCP servers share the same semantic search infrastructure, with optional filtering by entity type.

### 2.3 New Components

1. **Agent Card Schema** (registry/core/schemas.py): Pydantic model for A2A agent cards
2. **Agent Service** (registry/services/agent_service.py): CRUD operations for agent cards
3. **Agent Routes** (registry/api/agent_routes.py): REST API endpoints for agent operations
4. **Agent Validator** (registry/utils/agent_validator.py): Validation and security checks

### 2.4 Reused Components

- **FAISS Service**: Semantic search works for both MCP tools and agent skills
- **Server Service**: Pattern for state management and file-based storage
- **Auth System**: Same OAuth 2.0 and permission model
- **Health Service**: Monitor agent availability alongside MCP servers (optional, for discovery accuracy)
- **Metrics Service**: Track agent registrations and discoveries

---

## 3. Data Models

### 3.1 Agent Card Schema

Following the A2A specification with MCP Gateway extensions:

```python
from pydantic import BaseModel, Field, HttpUrl
from typing import List, Dict, Any, Optional
from datetime import datetime


class SecurityScheme(BaseModel):
    """Security scheme for agent authentication."""
    type: str = Field(..., description="Security type: apiKey, http, oauth2, openIdConnect")
    scheme: Optional[str] = Field(None, description="HTTP auth scheme: basic, bearer, digest")
    in_: Optional[str] = Field(None, alias="in", description="API key location: header, query, cookie")
    name: Optional[str] = Field(None, description="Name of header/query/cookie for API key")
    bearer_format: Optional[str] = Field(None, description="Bearer token format hint")
    flows: Optional[Dict[str, Any]] = Field(None, description="OAuth2 flows configuration")
    openid_connect_url: Optional[HttpUrl] = Field(None, description="OpenID Connect discovery URL")


class Skill(BaseModel):
    """Agent skill definition."""
    id: str = Field(..., description="Unique skill identifier")
    name: str = Field(..., description="Human-readable skill name")
    description: str = Field(..., description="Detailed skill description")
    parameters: Optional[Dict[str, Any]] = Field(None, description="JSON Schema for skill parameters")
    tags: List[str] = Field(default_factory=list, description="Skill categorization tags")


class AgentCard(BaseModel):
    """A2A Agent Card - machine-readable agent profile."""

    # Required A2A fields
    protocol_version: str = Field(..., description="A2A protocol version (e.g., '1.0')")
    name: str = Field(..., description="Agent name")
    description: str = Field(..., description="Agent description")
    url: HttpUrl = Field(..., description="Agent endpoint URL")

    # Optional A2A fields
    version: Optional[str] = Field(None, description="Agent version")
    provider: Optional[str] = Field(None, description="Agent provider/author")
    security_schemes: Dict[str, SecurityScheme] = Field(
        default_factory=dict,
        description="Supported authentication methods"
    )
    security: Optional[List[Dict[str, List[str]]]] = Field(
        None,
        description="Security requirements array"
    )
    skills: List[Skill] = Field(default_factory=list, description="Agent capabilities")
    streaming: bool = Field(False, description="Supports streaming responses")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")

    # MCP Gateway Registry extensions
    path: str = Field(..., description="Registry path (e.g., /agents/my-agent)")
    tags: List[str] = Field(default_factory=list, description="Categorization tags")
    is_enabled: bool = Field(False, description="Whether agent is enabled in registry")
    num_stars: int = Field(0, ge=0, description="Community rating")
    license: str = Field("N/A", description="License information")

    # Registry metadata
    registered_at: Optional[datetime] = Field(None, description="Registration timestamp")
    updated_at: Optional[datetime] = Field(None, description="Last update timestamp")
    registered_by: Optional[str] = Field(None, description="Username who registered agent")

    # Access control
    visibility: str = Field("public", description="public, private, or group-restricted")
    allowed_groups: List[str] = Field(default_factory=list, description="Groups with access")

    # Validation and trust
    signature: Optional[str] = Field(None, description="JWS signature for card integrity")
    trust_level: str = Field("unverified", description="unverified, community, verified, trusted")


class AgentInfo(BaseModel):
    """Simplified agent information for listing/search."""
    name: str
    description: str = ""
    path: str
    url: str
    tags: List[str] = Field(default_factory=list)
    skills: List[str] = Field(default_factory=list, description="Skill names only")
    num_skills: int = 0
    num_stars: int = 0
    is_enabled: bool = False
    provider: Optional[str] = None
    streaming: bool = False
    trust_level: str = "unverified"


class AgentRegistrationRequest(BaseModel):
    """API request model for agent registration."""
    name: str = Field(..., min_length=1)
    description: str = ""
    url: str = Field(..., min_length=1)
    path: str = Field(..., min_length=1)
    protocol_version: str = Field(default="1.0")
    version: Optional[str] = None
    provider: Optional[str] = None
    security_schemes: Optional[Dict[str, Dict[str, Any]]] = None
    skills: Optional[List[Dict[str, Any]]] = None
    streaming: bool = False
    tags: str = ""  # Comma-separated for form submission
    license: str = "N/A"
    visibility: str = "public"
```

### 3.2 Unified Storage Model

All entities (MCP servers and A2A agents) stored with discriminator:

```json
{
  "entity_type": "a2a_agent",
  "path": "/agents/code-reviewer",
  "agent_card": {
    "protocol_version": "1.0",
    "name": "Code Reviewer Agent",
    "description": "Analyzes code for bugs and style issues",
    "url": "https://agents.example.com/code-reviewer",
    "skills": [
      {
        "id": "analyze_code",
        "name": "Analyze Code",
        "description": "Performs static analysis on code",
        "parameters": {
          "type": "object",
          "properties": {
            "language": {"type": "string"},
            "code": {"type": "string"}
          }
        },
        "tags": ["code", "analysis", "review"]
      }
    ],
    "security_schemes": {
      "oauth2": {
        "type": "oauth2",
        "flows": {
          "clientCredentials": {
            "tokenUrl": "https://auth.example.com/token",
            "scopes": {"agent:invoke": "Invoke agent"}
          }
        }
      }
    },
    "tags": ["code-review", "static-analysis", "security"],
    "is_enabled": true,
    "trust_level": "community"
  }
}
```

### 3.3 FAISS Metadata Extension

Extend existing metadata to support both entity types:

```python
{
    "id": 42,
    "entity_type": "a2a_agent",  # or "mcp_server"
    "text_for_embedding": "Name: Code Reviewer Agent\nDescription: Analyzes code...\nSkills: analyze_code, suggest_fixes\nTags: code-review, security",
    "full_entity_info": {
        # Complete AgentCard or ServerInfo
    }
}
```

---

## 4. API Specification

### 4.1 Agent Card Submission

**POST /api/agents/register**

Register a new A2A agent in the registry.

**Request Body** (JSON):
```json
{
  "name": "Code Reviewer Agent",
  "description": "Analyzes code for bugs and style issues",
  "url": "https://agents.example.com/code-reviewer",
  "path": "/agents/code-reviewer",
  "protocol_version": "1.0",
  "version": "2.1.0",
  "provider": "Acme Corp",
  "skills": [
    {
      "id": "analyze_code",
      "name": "Analyze Code",
      "description": "Performs static analysis",
      "parameters": {
        "type": "object",
        "properties": {
          "language": {"type": "string", "enum": ["python", "javascript", "java"]},
          "code": {"type": "string"}
        },
        "required": ["language", "code"]
      },
      "tags": ["code", "analysis"]
    }
  ],
  "security_schemes": {
    "bearer": {
      "type": "http",
      "scheme": "bearer",
      "bearer_format": "JWT"
    }
  },
  "security": [{"bearer": []}],
  "streaming": false,
  "tags": "code-review,security,static-analysis",
  "license": "MIT",
  "visibility": "public"
}
```

**Response** (201 Created):
```json
{
  "message": "Agent registered successfully",
  "agent": {
    "name": "Code Reviewer Agent",
    "path": "/agents/code-reviewer",
    "url": "https://agents.example.com/code-reviewer",
    "num_skills": 1,
    "registered_at": "2025-10-30T10:00:00Z",
    "is_enabled": false
  }
}
```

**Validation Rules**:
- `path` must start with "/" and be unique
- `url` must be valid HTTP/HTTPS URL
- `protocol_version` must be supported version (start with "1.0")
- `skills` must have unique IDs within agent
- `security_schemes` keys referenced in `security` must exist

**Error Responses**:
- 400 Bad Request: Invalid agent card format
- 409 Conflict: Agent path already exists
- 422 Unprocessable Entity: Validation failed

### 4.2 Agent Card Retrieval

**GET /api/agents/{path}**

Retrieve complete agent card by path.

**Path Parameters**:
- `path`: Agent path (URL-encoded if needed)

**Response** (200 OK):
```json
{
  "protocol_version": "1.0",
  "name": "Code Reviewer Agent",
  "description": "Analyzes code for bugs and style issues",
  "url": "https://agents.example.com/code-reviewer",
  "version": "2.1.0",
  "provider": "Acme Corp",
  "skills": [...],
  "security_schemes": {...},
  "security": [...],
  "streaming": false,
  "path": "/agents/code-reviewer",
  "tags": ["code-review", "security"],
  "is_enabled": true,
  "num_stars": 42,
  "registered_at": "2025-10-30T10:00:00Z",
  "trust_level": "community"
}
```

**GET /api/agents**

List all agents (filtered by user permissions).

**Query Parameters**:
- `query`: Optional search query string
- `enabled_only`: Boolean (default: false)
- `visibility`: Filter by visibility (public, private, all)

**Response** (200 OK):
```json
{
  "agents": [
    {
      "name": "Code Reviewer Agent",
      "path": "/agents/code-reviewer",
      "url": "https://agents.example.com/code-reviewer",
      "description": "Analyzes code...",
      "skills": ["analyze_code", "suggest_fixes"],
      "num_skills": 2,
      "tags": ["code-review", "security"],
      "is_enabled": true,
      "num_stars": 42,
      "provider": "Acme Corp",
      "streaming": false,
      "trust_level": "community"
    }
  ],
  "total_count": 1
}
```

### 4.3 Agent Discovery

**POST /api/agents/discover**

Discover agents by skills, tags, and capabilities.

**Request Body** (JSON):
```json
{
  "skills": ["code-analysis", "security-review"],
  "tags": ["python", "security"],
  "provider": "Acme Corp",
  "streaming_required": false,
  "max_results": 10,
  "min_trust_level": "community"
}
```

**Response** (200 OK):
```json
{
  "agents": [
    {
      "name": "Code Reviewer Agent",
      "path": "/agents/code-reviewer",
      "url": "https://agents.example.com/code-reviewer",
      "skills": ["analyze_code", "suggest_fixes"],
      "relevance_score": 0.95,
      "tags": ["code-review", "security", "python"],
      "trust_level": "community"
    }
  ],
  "query": {
    "skills": ["code-analysis"],
    "tags": ["python", "security"]
  }
}
```

**POST /api/agents/discover/semantic**

Semantic discovery using natural language query.

**Request Body** (JSON):
```json
{
  "query": "I need an agent that can review Python code for security vulnerabilities",
  "max_results": 5,
  "entity_types": ["a2a_agent"]
}
```

**Response** (200 OK):
```json
{
  "entities": [
    {
      "entity_type": "a2a_agent",
      "name": "Code Reviewer Agent",
      "path": "/agents/code-reviewer",
      "description": "...",
      "relevance_score": 0.92,
      "skills": ["analyze_code", "suggest_fixes"]
    }
  ],
  "query": "I need an agent that can review Python code..."
}
```

### 4.4 Agent Management

**PUT /api/agents/{path}**

Update an existing agent card (requires modify_service permission).

**DELETE /api/agents/{path}**

Remove agent from registry (requires admin permission).

**POST /api/agents/{path}/toggle**

Enable or disable agent (requires toggle_service permission).

**POST /api/agents/{path}/verify**

Verify agent signature and update trust level (requires admin permission).

---

## 5. Discovery Mechanisms

### 5.1 Unified Semantic Search

**Extension to FAISS Service**:

```python
async def add_or_update_entity(
    self,
    entity_path: str,
    entity_info: Dict[str, Any],
    entity_type: str,  # "mcp_server" or "a2a_agent"
    is_enabled: bool = False
):
    """Add or update any entity (MCP server or A2A agent) in FAISS index."""

    # Generate embedding text based on entity type
    if entity_type == "a2a_agent":
        text_to_embed = self._get_agent_text_for_embedding(entity_info)
    else:
        text_to_embed = self._get_server_text_for_embedding(entity_info)

    # Rest of existing logic...


def _get_agent_text_for_embedding(self, agent_card: Dict[str, Any]) -> str:
    """Prepare text from agent card for embedding."""
    name = agent_card.get("name", "")
    description = agent_card.get("description", "")

    # Extract skill names and descriptions
    skills = agent_card.get("skills", [])
    skill_text = ", ".join([
        f"{s.get('name')}: {s.get('description', '')}"
        for s in skills
    ])

    # Tags from both agent and skills
    tags = agent_card.get("tags", [])
    skill_tags = []
    for skill in skills:
        skill_tags.extend(skill.get("tags", []))
    all_tags = ", ".join(set(tags + skill_tags))

    provider = agent_card.get("provider", "")

    return f"Name: {name}\nDescription: {description}\nProvider: {provider}\nSkills: {skill_text}\nTags: {all_tags}"
```

### 5.2 Skill-Based Discovery

Agents can query by specific skills:

```python
async def discover_agents_by_skills(
    self,
    required_skills: List[str],
    optional_skills: List[str] = None,
    max_results: int = 10
) -> List[AgentInfo]:
    """
    Discover agents that have required skills.

    Args:
        required_skills: Skills that must be present
        optional_skills: Skills that are nice to have (boost score)
        max_results: Maximum number of results

    Returns:
        List of matching agents ranked by skill coverage
    """
    # Implementation filters agents and ranks by skill match
```

### 5.3 Tag-Based Filtering

Extend existing tag filtering to work across entity types:

```python
async def search_entities(
    self,
    query: str,
    entity_types: List[str] = None,  # ["mcp_server", "a2a_agent", "both"]
    tags: List[str] = None,
    enabled_only: bool = False,
    max_results: int = 10
) -> List[Dict[str, Any]]:
    """Unified search across MCP servers and A2A agents."""
```

### 5.4 Ranking Algorithm

**Relevance Score Calculation** for agent discovery:

```
relevance_score = (
    0.5 * vector_similarity_score +
    0.3 * skill_match_score +
    0.1 * tag_match_score +
    0.1 * trust_level_boost
)

Where:
- vector_similarity_score: Cosine similarity from FAISS (0-1)
- skill_match_score: (matched_skills / required_skills) (0-1)
- tag_match_score: (matched_tags / requested_tags) (0-1)
- trust_level_boost: {"unverified": 0, "community": 0.2, "verified": 0.5, "trusted": 1.0}
```

---

## 6. Security & Access Control

### 6.1 Agent Card Validation

**Validation Pipeline**:

1. **Schema Validation**: Pydantic model validation (types, required fields)
2. **Skill Validation**: Unique skill IDs, valid JSON Schema for parameters
3. **URL Validation**: Reachable endpoint, SSL certificate check
4. **Security Scheme Validation**: Supported auth methods, proper OAuth2 configuration
5. **Signature Verification**: JWS signature if present

```python
class AgentValidator:
    """Validates agent cards for security and correctness."""

    async def validate_agent_card(
        self,
        agent_card: AgentCard,
        verify_endpoint: bool = True
    ) -> ValidationResult:
        """
        Validate agent card.

        Returns:
            ValidationResult with issues and warnings
        """
        result = ValidationResult()

        # Check endpoint reachability
        if verify_endpoint:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.get(
                        agent_card.url,
                        timeout=5.0,
                        follow_redirects=True
                    )
                    if response.status_code >= 500:
                        result.add_warning(f"Agent endpoint returned {response.status_code}")
            except Exception as e:
                result.add_error(f"Cannot reach agent endpoint: {e}")

        # Validate security schemes
        for scheme_name, scheme in agent_card.security_schemes.items():
            if scheme.type == "oauth2":
                if not scheme.flows:
                    result.add_error(f"OAuth2 scheme '{scheme_name}' missing flows")

        # Validate skills
        skill_ids = set()
        for skill in agent_card.skills:
            if skill.id in skill_ids:
                result.add_error(f"Duplicate skill ID: {skill.id}")
            skill_ids.add(skill.id)

            # Validate JSON Schema
            if skill.parameters:
                try:
                    # Ensure it's valid JSON Schema
                    jsonschema.Draft7Validator.check_schema(skill.parameters)
                except jsonschema.SchemaError as e:
                    result.add_warning(f"Skill '{skill.id}' has invalid schema: {e}")

        return result
```

### 6.2 Authentication for Agent Submission

**Reuse Existing Auth System**:

- Agent registration requires authentication (same as MCP server registration)
- User must have `register_agent` scope/permission
- Admin approval may be required based on policy

```python
@router.post("/agents/register")
async def register_agent(
    request: Request,
    user_context: Annotated[dict, Depends(enhanced_auth)] = None,
):
    """Register A2A agent (requires register_agent permission)."""

    # Check permissions
    if not user_has_permission('register_agent', user_context):
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to register agents"
        )

    # Validate and register agent...
```

### 6.3 Authorization for Agent Discovery

**Visibility Levels**:

1. **Public**: Discoverable by all authenticated users
2. **Private**: Only discoverable by owner and admins
3. **Group-Restricted**: Discoverable by members of specified groups

**Discovery Filtering**:

```python
def filter_agents_by_access(
    self,
    agents: List[AgentCard],
    user_context: Dict[str, Any]
) -> List[AgentCard]:
    """Filter agents based on user's access permissions."""

    accessible = []
    user_groups = set(user_context.get('groups', []))
    username = user_context['username']
    is_admin = user_context.get('is_admin', False)

    for agent in agents:
        # Admins see everything
        if is_admin:
            accessible.append(agent)
            continue

        # Public agents
        if agent.visibility == "public":
            accessible.append(agent)
            continue

        # Private agents (owner only)
        if agent.visibility == "private":
            if agent.registered_by == username:
                accessible.append(agent)
            continue

        # Group-restricted agents
        if agent.visibility == "group-restricted":
            agent_groups = set(agent.allowed_groups)
            if agent_groups & user_groups:  # Intersection
                accessible.append(agent)
            continue

    return accessible
```

### 6.4 Signature Verification (JWS)

**Agent Card Signing**:

Agents can sign their cards using JWS (JSON Web Signature) to prove authenticity:

```python
class AgentCardSigner:
    """Sign and verify agent cards using JWS."""

    def sign_agent_card(
        self,
        agent_card: Dict[str, Any],
        private_key: str,
        algorithm: str = "RS256"
    ) -> str:
        """
        Sign agent card and return JWS token.

        Args:
            agent_card: Agent card as dictionary
            private_key: RSA private key in PEM format
            algorithm: Signing algorithm (RS256, ES256, etc.)

        Returns:
            JWS compact serialization string
        """
        # Use python-jose or similar library
        token = jwt.encode(
            agent_card,
            private_key,
            algorithm=algorithm,
            headers={"typ": "agent-card+jwt"}
        )
        return token

    def verify_signature(
        self,
        jws_token: str,
        public_key: str
    ) -> Tuple[bool, Dict[str, Any]]:
        """
        Verify JWS signature and extract agent card.

        Returns:
            (is_valid, agent_card_dict)
        """
        try:
            payload = jwt.decode(
                jws_token,
                public_key,
                algorithms=["RS256", "ES256"]
            )
            return (True, payload)
        except jwt.JWTError as e:
            return (False, {})
```

**Trust Levels**:

- **Unverified**: No signature or signature not verified
- **Community**: Valid signature from known community member
- **Verified**: Signature verified by registry admin
- **Trusted**: Agent from verified enterprise provider

---

## 7. Implementation Roadmap

### Phase 1: Core Agent Card Storage and Retrieval (Week 1-2)

**Goal**: Store and retrieve agent cards without breaking existing MCP functionality.

**Tasks**:
1. Create `AgentCard` and related Pydantic models in `registry/core/schemas.py`
2. Implement `AgentService` in `registry/services/agent_service.py`:
   - File-based storage (JSON files like MCP servers)
   - CRUD operations (create, read, update, delete)
   - State management (enabled/disabled)
3. Add basic agent routes in `registry/api/agent_routes.py`:
   - `POST /api/agents/register`
   - `GET /api/agents/{path}`
   - `GET /api/agents` (list all)
4. Update UI templates to show agents alongside MCP servers
5. Write unit tests for agent storage and retrieval

**Success Criteria**:
- Can register agents via API
- Agents stored in separate files under `registry/servers/agents/`
- No impact on existing MCP server functionality
- Basic permission checks working

### Phase 2: Discovery and Search (Week 3-4)

**Goal**: Enable discovery of agents using semantic search and skill matching.

**Tasks**:
1. Extend `FaissService` to support agent cards:
   - Add `entity_type` field to metadata
   - Implement `_get_agent_text_for_embedding()`
   - Update `add_or_update_entity()` to handle both types
2. Implement agent discovery endpoints:
   - `POST /api/agents/discover` (skill-based)
   - `POST /api/agents/discover/semantic` (natural language)
3. Add unified search endpoint:
   - `POST /api/search` (searches both MCP servers and agents)
   - Support filtering by `entity_types`
4. Implement skill-based ranking algorithm
5. Update UI to support agent discovery

**Success Criteria**:
- Agents appear in semantic search results
- Skill-based discovery returns relevant agents
- Unified search works across MCP servers and agents
- Ranking algorithm prioritizes better matches

### Phase 3: Advanced Validation and Security (Week 5-6)

**Goal**: Add security features and trust mechanisms.

**Tasks**:
1. Implement `AgentValidator` in `registry/utils/agent_validator.py`:
   - Schema validation
   - Endpoint reachability checks
   - Security scheme validation
2. Add signature verification support:
   - JWS signing and verification utilities
   - Trust level assignment
   - Admin verification workflow
3. Implement visibility controls:
   - Public/private/group-restricted agents
   - Filter agents by user permissions
   - Group-based access control
4. Add security scanning integration:
   - Check agent endpoints for vulnerabilities
   - Automatic trust level downgrade for security issues
5. Comprehensive error handling and validation messages

**Success Criteria**:
- Invalid agent cards rejected with clear error messages
- Signature verification working
- Private agents only visible to authorized users
- Security scanning detects basic issues

### Phase 4: Webhook Notifications and Streaming (Week 7-8)

**Goal**: Add advanced features for agent interaction.

**Tasks**:
1. Implement webhook notifications:
   - Agent registration/update/deletion events
   - Discovery query notifications (for analytics)
   - Configurable webhook endpoints
2. Add streaming support indicators:
   - Mark agents supporting streaming
   - Document streaming protocol requirements
3. Implement agent health checks:
   - Periodic availability checks
   - Health status in discovery results
4. Add metrics and monitoring:
   - Track agent registration trends
   - Monitor discovery query patterns
   - Agent invocation metrics
5. Documentation and examples:
   - Agent registration guide
   - Discovery API examples
   - Security best practices

**Success Criteria**:
- Webhooks notify on agent lifecycle events
- Streaming agents properly identified
- Health checks detect unavailable agents
- Complete documentation published

---

## 8. Code Structure & Modules

### 8.1 New Modules

```
registry/
├── core/
│   └── schemas.py (MODIFIED)
│       - AgentCard
│       - SecurityScheme
│       - Skill
│       - AgentInfo
│       - AgentRegistrationRequest
│
├── services/
│   ├── agent_service.py (NEW)
│   │   - AgentService class
│   │   - load_agents_and_state()
│   │   - register_agent()
│   │   - update_agent()
│   │   - remove_agent()
│   │   - toggle_agent()
│   │   - discover_agents_by_skills()
│   │
│   └── server_service.py (MINIMAL CHANGES)
│       - Keep existing MCP server logic
│
├── api/
│   ├── agent_routes.py (NEW)
│   │   - POST /api/agents/register
│   │   - GET /api/agents
│   │   - GET /api/agents/{path}
│   │   - PUT /api/agents/{path}
│   │   - DELETE /api/agents/{path}
│   │   - POST /api/agents/{path}/toggle
│   │   - POST /api/agents/discover
│   │   - POST /api/agents/discover/semantic
│   │
│   └── server_routes.py (NO CHANGES)
│
├── utils/
│   ├── agent_validator.py (NEW)
│   │   - AgentValidator class
│   │   - validate_agent_card()
│   │   - verify_endpoint()
│   │   - validate_security_schemes()
│   │
│   └── agent_signer.py (NEW)
│       - AgentCardSigner class
│       - sign_agent_card()
│       - verify_signature()
│
└── search/
    └── service.py (MODIFIED)
        - Extend add_or_update_service() -> add_or_update_entity()
        - Add _get_agent_text_for_embedding()
        - Add entity_type support in metadata
```

### 8.2 Storage Structure

```
registry/servers/
├── agents/                          (NEW DIRECTORY)
│   ├── code-reviewer.json
│   ├── data-analyst.json
│   └── translation-agent.json
│
├── mcp-servers/                     (EXISTING, UNCHANGED)
│   ├── weather.json
│   ├── calculator.json
│   └── database.json
│
├── service_index.faiss              (MODIFIED - includes agents)
├── service_index_metadata.json      (MODIFIED - includes agents)
└── server_state.json                (UNCHANGED - MCP servers only)
```

**Note**: Agents have separate state file `agent_state.json` to avoid confusion.

### 8.3 Configuration Extensions

Add to `registry/core/config.py`:

```python
class Settings(BaseSettings):
    # ... existing settings ...

    # A2A Agent settings
    enable_a2a_agents: bool = True
    agent_verification_required: bool = False
    agent_signature_verification: bool = False
    default_agent_visibility: str = "public"

    @property
    def agents_dir(self) -> Path:
        """Directory for agent card storage."""
        return self.servers_dir / "agents"

    @property
    def agent_state_file_path(self) -> Path:
        return self.servers_dir / "agent_state.json"
```

---

## 9. Integration Points

### 9.1 Registry-Only Scope

**Critical Clarification**: This design is **registry-only**. The registry does NOT:
- Route agent-to-agent requests
- Act as an intermediary for agent communication
- Proxy agent invocations
- Participate in agent-to-agent message flow

**The Registry ONLY**:
- Stores agent card metadata
- Enables discovery of agents via APIs
- Validates agent credentials
- Returns agent URLs for direct communication

**Agent Communication**: Once an agent discovers another agent, they communicate directly using the URL returned by the registry. The registry is completely out of the communication path.

**Gateway Unchanged**: The MCP Gateway continues to proxy MCP server requests (existing functionality). A2A agent communication is peer-to-peer, not through the gateway.

### 9.2 API Compatibility

**Separate API Namespaces** for clarity:

- MCP Servers: `/api/servers/*` (existing - unchanged)
- A2A Agents: `/api/agents/*` (new - registry only)
- Unified Search: `/api/search` (new - registry only)

**Rationale**:
1. Clear separation of concerns
2. Different validation rules and schemas
3. Easier to version independently
4. No risk of breaking existing integrations

### 9.3 Shared Infrastructure

**Components that work for both**:

| Component | How It's Shared |
|-----------|----------------|
| FAISS Search | Same index, different `entity_type` in metadata |
| Authentication | Same OAuth 2.0 system and scopes |
| Permission Model | Extend scopes.yml to include agent permissions |
| UI Dashboard | Unified view with tabs or filters |
| Metrics Service | Same event emission, different event types |

**Explicitly NOT Shared**:
- **Reverse Proxy/Gateway**: Agents do not go through the gateway
- **MCP Server Routing**: Agent communication is direct peer-to-peer
- **Request Intermediation**: Registry returns URLs only, does not route requests

### 9.4 Potential Conflicts

**None Expected** if we follow separation of concerns:

1. **Storage**: Separate directories (`/agents/` vs `/mcp-servers/`)
2. **API Routes**: Different prefixes (`/api/agents/*` vs `/api/servers/*`)
3. **State Files**: Separate state tracking
4. **FAISS Metadata**: Discriminated by `entity_type` field
5. **Communication Paths**: MCP through gateway, A2A peer-to-peer (no overlap)

**Migration Path**: Existing MCP functionality completely unchanged. A2A is purely additive.

---

## 10. Example Workflows

### 10.1 Agent Registers Its Card

```python
# Agent self-registration workflow

import httpx

agent_card = {
    "name": "Code Review Agent",
    "description": "Automated code review with security focus",
    "url": "https://agents.example.com/code-review",
    "path": "/agents/code-review",
    "protocol_version": "1.0",
    "version": "1.0.0",
    "provider": "Acme Corp",
    "skills": [
        {
            "id": "review_python_code",
            "name": "Review Python Code",
            "description": "Analyzes Python code for bugs and style issues",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string"},
                    "strict": {"type": "boolean", "default": False}
                },
                "required": ["code"]
            },
            "tags": ["python", "code-review"]
        }
    ],
    "security_schemes": {
        "bearer": {
            "type": "http",
            "scheme": "bearer",
            "bearer_format": "JWT"
        }
    },
    "security": [{"bearer": []}],
    "tags": "code-review,python,security",
    "license": "MIT"
}

# Authenticate with registry
auth_response = httpx.post(
    "https://registry.example.com/auth/token",
    auth=("agent-user", "agent-password")
)
token = auth_response.json()["access_token"]

# Register agent
response = httpx.post(
    "https://registry.example.com/api/agents/register",
    json=agent_card,
    headers={"Authorization": f"Bearer {token}"}
)

if response.status_code == 201:
    print("Agent registered successfully!")
    agent_info = response.json()["agent"]
    print(f"Path: {agent_info['path']}")
else:
    print(f"Registration failed: {response.json()}")
```

### 10.2 Another Agent Discovers It

```python
# Agent discovery workflow

# Client agent needs code review capability
discovery_query = {
    "skills": ["review_python_code"],
    "tags": ["python"],
    "max_results": 5
}

response = httpx.post(
    "https://registry.example.com/api/agents/discover",
    json=discovery_query,
    headers={"Authorization": f"Bearer {client_token}"}
)

agents = response.json()["agents"]
for agent in agents:
    print(f"Found: {agent['name']} at {agent['url']}")
    print(f"  Skills: {', '.join(agent['skills'])}")
    print(f"  Relevance: {agent['relevance_score']}")

# Select best match
best_agent = agents[0]
agent_url = best_agent["url"]
```

### 10.3 Agents Establish Connection

```python
# Agent invocation workflow (outside registry scope, but shown for completeness)

# Get agent card for security requirements
agent_card_response = httpx.get(
    f"https://registry.example.com/api/agents{best_agent['path']}",
    headers={"Authorization": f"Bearer {client_token}"}
)
agent_card = agent_card_response.json()

# Authenticate with agent according to its security schemes
if "bearer" in agent_card["security_schemes"]:
    # Get token for agent (might involve OAuth flow)
    agent_auth_token = get_agent_token(agent_card)

    # Invoke agent skill
    skill_request = {
        "skill_id": "review_python_code",
        "parameters": {
            "code": "def foo():\n    pass",
            "strict": True
        }
    }

    agent_response = httpx.post(
        f"{agent_card['url']}/invoke",
        json=skill_request,
        headers={"Authorization": f"Bearer {agent_auth_token}"}
    )

    result = agent_response.json()
    print(f"Code review result: {result}")
```

### 10.4 Unified Discovery (MCP + A2A)

```python
# Discover both tools and agents with natural language

unified_query = {
    "query": "I need to analyze Python code for security issues and then deploy it",
    "entity_types": ["mcp_server", "a2a_agent"],
    "max_results": 10
}

response = httpx.post(
    "https://registry.example.com/api/search",
    json=unified_query,
    headers={"Authorization": f"Bearer {token}"}
)

entities = response.json()["entities"]

# Results might include:
# - MCP Server: Python Security Analyzer (tool)
# - A2A Agent: Code Review Agent (agent)
# - MCP Server: Deployment Tool (tool)
# - A2A Agent: DevOps Orchestrator (agent)

for entity in entities:
    entity_type = entity["entity_type"]
    if entity_type == "a2a_agent":
        print(f"Agent: {entity['name']} - Skills: {entity['skills']}")
    else:
        print(f"MCP Server: {entity['name']} - Tools: {entity.get('num_tools', 0)}")
```

---

## 11. Backward Compatibility

### 11.1 No Breaking Changes

**Guarantee**: All existing MCP server functionality remains unchanged.

**How**:
1. New code in separate modules (`agent_service.py`, `agent_routes.py`)
2. Existing routes unchanged (`/api/servers/*` paths)
3. Existing schemas unchanged (`ServerInfo`, `ToolInfo`)
4. Storage separation (agents in `/agents/` subdirectory)
5. FAISS backwards compatible (existing metadata still works)

### 11.2 Feature Flags

```python
# In config.py
enable_a2a_agents: bool = True  # Can be disabled via env var

# In main.py
if settings.enable_a2a_agents:
    app.include_router(agent_routes.router, prefix="/api", tags=["agents"])
```

If `enable_a2a_agents=False`, agent routes not loaded. Registry works exactly as before.

### 11.3 Migration Strategy

**No migration needed** - this is purely additive.

**For future changes**:
1. Add deprecation warnings to old endpoints (if any)
2. Support both old and new formats for 2+ versions
3. Provide migration scripts for data format changes
4. Document migration path in release notes

### 11.4 Versioning

**API Versioning**:
- Current: `/api/servers/*` (no version prefix - v1 implied)
- A2A: `/api/agents/*` (no version prefix - v1 implied)
- Future: `/v2/api/*` if breaking changes needed

**Agent Card Versioning**:
- `protocol_version` field tracks A2A protocol version
- Registry supports multiple versions simultaneously
- Validation rules specific to each version

---

## 12. Open Questions & Future Considerations

### 12.1 Private vs Public Registries

**Question**: Should there be separate registries for public vs enterprise agents?

**Options**:
1. **Single Registry with Visibility Controls** (Recommended)
   - Pro: Simpler architecture, one discovery interface
   - Pro: Users can discover both public and internal agents
   - Con: Requires careful permission management

2. **Separate Registry Instances**
   - Pro: Complete isolation between public and private
   - Con: More complex deployment and maintenance
   - Con: Can't discover across registries

**Recommendation**: Start with option 1, add federation (option 3) later if needed.

3. **Federation Protocol** (Future)
   - Multiple registries can reference each other
   - Discovery queries can span registries
   - Trust boundaries between registries

### 12.2 Multi-Registry Federation

**Use Case**: Enterprise wants to use public agents from Anthropic registry AND private internal agents.

**Approach**:
1. **Agent Card Import**: Import public agent cards into local registry (like MCP server import)
2. **Remote Registry References**: Store pointers to remote registries, query on-demand
3. **Federated Search**: Broadcast discovery queries to multiple registries

**Proposal for Phase 5**:
```python
# Registry federation configuration
federated_registries = [
    {
        "name": "Anthropic A2A Registry",
        "url": "https://a2a.anthropic.com",
        "trust_level": "trusted",
        "query_timeout_ms": 2000
    }
]

# Federated discovery
POST /api/agents/discover/federated
{
    "query": "code review agent",
    "include_remote": true,
    "remote_registries": ["anthropic"]
}
```

### 12.3 Agent Card Versioning and Updates

**Question**: How to handle agent updates without breaking clients?

**Considerations**:
1. **Semantic Versioning**: Agents use semver (`version` field)
2. **Capability Evolution**: New skills can be added (non-breaking)
3. **Breaking Changes**: Skill parameter changes require major version bump
4. **Deprecation**: Mark old skills as deprecated before removal

**Proposal**:
```python
class Skill(BaseModel):
    id: str
    version: str = "1.0"  # Skill-level versioning
    deprecated: bool = False
    deprecated_message: Optional[str] = None
    replaced_by: Optional[str] = None  # New skill ID
```

### 12.4 Rate Limiting for Discovery

**Question**: How to prevent abuse of discovery APIs?

**Options**:
1. **Per-User Limits**: Standard rate limiting (e.g., 100 queries/hour)
2. **Tiered Access**: Premium users get higher limits
3. **Cost-Based**: Complex queries cost more

**Recommendation**: Start with simple per-user rate limiting, add tiering later.

```python
# In config.py
discovery_rate_limit_per_hour: int = 100
discovery_cache_ttl_seconds: int = 60  # Cache repeated queries
```

### 12.5 Agent Metrics and Analytics

**Questions**:
- Track how often agents are discovered?
- Monitor agent invocation success rates?
- Provide analytics dashboard for agent owners?

**Proposal**: Extend existing metrics service to support agent events.

```python
# Agent-specific metrics
- agent.discovered (skill_query, tags)
- agent.invoked (skill_id, success)
- agent.failed (skill_id, error_type)
- agent.rating_updated (old_rating, new_rating)
```

### 12.6 Agent Composition and Workflows

**Question**: Should registry support multi-agent workflow definitions?

**Future Enhancement**: "Agent Workflows" as first-class entities.

```yaml
workflow_name: "Code Review and Deploy"
workflow_type: "sequential"
steps:
  - agent: "/agents/code-reviewer"
    skill: "review_python_code"
    inputs:
      code: "${input.code}"
  - agent: "/agents/deploy-agent"
    skill: "deploy_to_staging"
    inputs:
      code: "${steps[0].output.approved_code}"
    condition: "${steps[0].output.approved == true}"
```

This is a more advanced feature for Phase 5+.

### 12.7 Trust and Reputation System

**Question**: How to build trust in agent ecosystem?

**Considerations**:
1. **Community Ratings**: Users rate agents after use
2. **Usage Statistics**: Popular agents gain trust
3. **Certification**: Manual review by registry admins
4. **Audit Trails**: Track who invoked which agents when

**Proposal for Phase 4**:
```python
class AgentReputation(BaseModel):
    agent_path: str
    invocation_count: int = 0
    success_rate: float = 0.0
    average_rating: float = 0.0
    rating_count: int = 0
    trust_level: str = "unverified"
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
```

### 12.8 Well-Known Endpoint for A2A

**Question**: Should agents have `/.well-known/agent-card` endpoint?

**Proposal**: Yes, similar to MCP `.well-known/mcp-servers`.

```python
@router.get("/.well-known/agent-cards")
async def wellknown_agent_cards():
    """Discover all public agents via well-known endpoint."""
    agents = agent_service.get_public_agents()
    return {
        "registry": "MCP Gateway Registry",
        "agents": [
            {
                "name": agent.name,
                "url": agent.url,
                "path": agent.path,
                "skills": [s.name for s in agent.skills],
                "trust_level": agent.trust_level
            }
            for agent in agents
        ]
    }
```

---

## Appendix A: A2A Protocol Reference

### Key Concepts from A2A Specification

1. **Agent Card**: Machine-readable profile describing agent capabilities
2. **Skills**: Discrete capabilities an agent can perform
3. **Security Schemes**: Authentication methods agent supports
4. **Protocol Versions**: Specification version for compatibility

### Differences from MCP

| Aspect | MCP Servers | A2A Agents |
|--------|------------|------------|
| Primary Entity | Tools | Skills |
| Discovery Basis | Tool names, descriptions | Skills, capabilities |
| Invocation | Direct tool execution | Agent delegates to skills |
| Security | OAuth 2.0 for server access | Various schemes per agent |
| Metadata | Server-level only | Agent + skill-level |

---

## Appendix B: Implementation Checklist

### Phase 1: Core Storage
- [ ] Create AgentCard schema
- [ ] Implement AgentService
- [ ] Add agent routes (register, get, list)
- [ ] Update UI to display agents
- [ ] Write unit tests
- [ ] Document API endpoints

### Phase 2: Discovery
- [ ] Extend FaissService for agents
- [ ] Implement skill-based discovery
- [ ] Add semantic agent search
- [ ] Create unified search endpoint
- [ ] Update UI for agent discovery
- [ ] Performance testing

### Phase 3: Security
- [ ] Implement AgentValidator
- [ ] Add signature verification
- [ ] Visibility controls
- [ ] Group-based access
- [ ] Security scanning integration
- [ ] Audit logging

### Phase 4: Advanced Features
- [ ] Webhook notifications
- [ ] Streaming support
- [ ] Health checks for agents
- [ ] Metrics and analytics
- [ ] Complete documentation
- [ ] Example implementations

---

## Appendix C: Performance Considerations

### Expected Scale

- **Agents**: 100-10,000 agents per registry
- **Discovery Queries**: 1,000-10,000 per hour
- **FAISS Index**: Combined MCP servers + agents < 50,000 entities

### Optimization Strategies

1. **FAISS Index**: Batch updates, incremental indexing
2. **Discovery Cache**: Cache popular queries for 60 seconds
3. **Lazy Loading**: Don't load all agent cards into memory
4. **Connection Pooling**: Reuse HTTP connections for validation
5. **Async Operations**: All I/O operations async

### Monitoring Metrics

- Discovery query latency (p50, p95, p99)
- FAISS index size and query time
- Agent registration rate
- Cache hit ratio
- Validation failure rate

---

## Appendix D: Related Work

### References

1. **A2A Protocol Specification**: https://github.com/anthropics/agent-to-agent
2. **MCP Protocol**: https://modelcontextprotocol.io
3. **OpenAPI Security Schemes**: https://swagger.io/docs/specification/authentication/
4. **JSON Web Signature (JWS)**: https://datatracker.ietf.org/doc/html/rfc7515
5. **OAuth 2.0**: https://oauth.net/2/

### Similar Systems

- **npm Registry**: Package discovery and versioning
- **Docker Hub**: Container registry with public/private
- **GitHub Actions Marketplace**: Action discovery and ratings
- **Hugging Face Model Hub**: Model cards and discovery

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2025-10-30 | Claude | Initial design document |

---

**END OF DOCUMENT**
