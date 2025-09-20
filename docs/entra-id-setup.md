# Microsoft Entra ID Setup Guide for MCP Gateway

## Overview

This document provides comprehensive guidance for configuring Microsoft Entra ID (formerly Azure Active Directory) as an identity provider for the MCP Gateway. This setup enables enterprise-grade authentication with individual AI agent audit trails, group-based authorization, and seamless integration with existing Azure environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Azure Portal Configuration](#azure-portal-configuration)
3. [App Registration Setup](#app-registration-setup)
4. [Group Configuration](#group-configuration)
5. [Service Principal Setup](#service-principal-setup)
6. [API Permissions Configuration](#api-permissions-configuration)
7. [Certificate and Secrets](#certificate-and-secrets)
8. [Environment Configuration](#environment-configuration)
9. [Validation and Testing](#validation-and-testing)
10. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Azure Permissions
- **Application Administrator** or **Global Administrator** role in Entra ID
- Permission to create App Registrations
- Permission to create and manage Security Groups
- Permission to grant API permissions

### Required Information
- Azure Tenant ID
- Azure Subscription ID (if using managed identity)
- Domain name for redirect URIs (e.g., `mcpgateway.yourdomain.com`)
- List of AI agents that will need authentication

### Technical Requirements
- MCP Gateway deployment with Docker Compose
- SSL certificate for your domain
- Network access from MCP Gateway to `login.microsoftonline.com`

## Azure Portal Configuration

### Step 1: Access Azure Portal

1. Navigate to [Azure Portal](https://portal.azure.com)
2. Sign in with an account that has appropriate permissions
3. Navigate to **Azure Active Directory** (now called **Microsoft Entra ID**)

### Step 2: Tenant Information

1. In the Entra ID overview page, note down:
   - **Tenant ID** (Directory ID)
   - **Primary Domain** (e.g., `yourcompany.onmicrosoft.com`)

```bash
# Example values to collect
TENANT_ID="12345678-1234-1234-1234-123456789012"
PRIMARY_DOMAIN="yourcompany.onmicrosoft.com"
```

## App Registration Setup

### Step 1: Create App Registration

1. In Entra ID, navigate to **App registrations**
2. Click **New registration**
3. Configure the application:

```
Name: MCP Gateway Enterprise
Supported account types: Accounts in this organizational directory only (yourcompany only - Single tenant)
Redirect URI:
  - Type: Web
  - URI: https://mcpgateway.yourdomain.com/auth/callback
```

4. Click **Register**

### Step 2: Note Application Information

After registration, collect these values from the **Overview** page:
- **Application (client) ID**
- **Directory (tenant) ID**
- **Object ID**

```bash
# Example values
ENTRA_CLIENT_ID="87654321-4321-4321-4321-210987654321"
ENTRA_TENANT_ID="12345678-1234-1234-1234-123456789012"
ENTRA_OBJECT_ID="11111111-2222-3333-4444-555555555555"
```

### Step 3: Configure Authentication

1. Navigate to **Authentication** in the app registration
2. Add additional redirect URIs if needed:
   ```
   https://mcpgateway.yourdomain.com/auth/callback
   https://mcpgateway.yourdomain.com/auth/m2m/callback
   https://localhost:7860/auth/callback  # For development
   ```

3. Configure **Front-channel logout URL**:
   ```
   https://mcpgateway.yourdomain.com/auth/logout
   ```

4. Under **Advanced settings**:
   - **Allow public client flows**: No
   - **Live SDK support**: No

5. Click **Save**

### Step 4: Configure Token Configuration

1. Navigate to **Token configuration**
2. Add **Optional claims**:

   **ID tokens**:
   - `email`
   - `family_name`
   - `given_name`
   - `upn`

   **Access tokens**:
   - `email`
   - `groups`
   - `upn`

3. For **groups** claim, configure:
   - **Group types**: Security groups
   - **ID**: Group ID
   - **Access**: Group ID
   - **SAML**: Group ID

## Group Configuration

### Step 1: Create Security Groups

Create security groups for different access levels:

1. Navigate to **Groups** in Entra ID
2. Click **New group**

**Group 1: MCP Servers Unrestricted**
```
Group type: Security
Group name: mcp-servers-unrestricted
Group description: Full access to all MCP servers and tools
Membership type: Assigned
```

**Group 2: MCP Servers Restricted**
```
Group type: Security
Group name: mcp-servers-restricted
Group description: Limited access to approved MCP servers only
Membership type: Assigned
```

**Group 3: MCP Admins**
```
Group type: Security
Group name: mcp-admins
Group description: Administrative access to MCP Gateway configuration
Membership type: Assigned
```

### Step 2: Note Group Object IDs

For each group, note the **Object ID** from the group overview page:

```bash
# Example values
ENTRA_GROUP_UNRESTRICTED_ID="aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
ENTRA_GROUP_RESTRICTED_ID="ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj"
ENTRA_GROUP_ADMINS_ID="kkkkkkkk-llll-mmmm-nnnn-oooooooooooo"
```

## Service Principal Setup

### Step 1: Create Service Principals for AI Agents

For each AI agent, create a dedicated service principal:

1. Navigate to **App registrations**
2. Click **New registration**

**Example for SRE Agent:**
```
Name: MCP Agent - SRE Agent M2M
Supported account types: Accounts in this organizational directory only
Redirect URI: None (this is a daemon application)
```

### Step 2: Configure Service Principal

1. After creation, navigate to **Certificates & secrets**
2. Create a **Client secret**:
   - Description: `SRE Agent M2M Secret`
   - Expires: 24 months (recommended)
   - **Save the secret value immediately** - it won't be shown again

### Step 3: Grant API Permissions

1. Navigate to **API permissions**
2. Click **Add a permission**
3. Select **Microsoft Graph**
4. Choose **Application permissions**
5. Add these permissions:
   - `User.Read.All` (to read user information)
   - `Group.Read.All` (to read group memberships)
   - `Directory.Read.All` (to read directory information)

6. Click **Grant admin consent** for your tenant

### Step 4: Assign Service Principal to Groups

1. Navigate to **Groups**
2. Select the appropriate group (e.g., `mcp-servers-unrestricted`)
3. Click **Members**
4. Click **Add members**
5. Search for and select the service principal (e.g., "MCP Agent - SRE Agent M2M")
6. Click **Select**

## API Permissions Configuration

### Required Permissions for Web Application

Configure these permissions for the main MCP Gateway app registration:

#### Microsoft Graph (Application Permissions)
- `User.Read.All` - Read user profiles
- `Group.Read.All` - Read group information
- `Directory.Read.All` - Read directory data

#### Microsoft Graph (Delegated Permissions)
- `User.Read` - Sign in and read user profile
- `email` - View users' email address
- `openid` - Sign users in
- `profile` - View users' basic profile

### Required Permissions for Service Principals

Each AI agent service principal needs:

#### Microsoft Graph (Application Permissions)
- `User.Read.All` - Read user profiles (for audit trails)
- `Group.Read.All` - Read group memberships

### Granting Admin Consent

1. In each app registration, navigate to **API permissions**
2. Click **Grant admin consent for [tenant name]**
3. Confirm the consent

**Important**: Admin consent is required for application permissions.

## Certificate and Secrets

### Step 1: Client Secrets for Web Application

1. Navigate to your main app registration
2. Go to **Certificates & secrets**
3. Click **New client secret**
4. Configure:
   ```
   Description: MCP Gateway Web Client Secret
   Expires: 24 months
   ```
5. **Copy the secret value immediately**

### Step 2: Service Principal Secrets

For each AI agent service principal:

1. Navigate to the service principal app registration
2. Go to **Certificates & secrets**
3. Create client secret:
   ```
   Description: [Agent Name] M2M Client Secret
   Expires: 24 months
   ```

### Step 3: Certificate-Based Authentication (Optional)

For enhanced security in production:

1. Generate a certificate:
   ```bash
   # Generate private key
   openssl genrsa -out mcp-gateway.key 2048

   # Generate certificate signing request
   openssl req -new -key mcp-gateway.key -out mcp-gateway.csr

   # Generate self-signed certificate (or use CA-signed)
   openssl x509 -req -days 365 -in mcp-gateway.csr -signkey mcp-gateway.key -out mcp-gateway.crt
   ```

2. Upload certificate to app registration:
   - Go to **Certificates & secrets**
   - Click **Upload certificate**
   - Select the `.crt` file

## Environment Configuration

### Step 1: Main Environment Variables

Create or update your `.env` file:

```bash
# Authentication Provider
AUTH_PROVIDER=entra

# Microsoft Entra ID Configuration
ENTRA_TENANT_ID=12345678-1234-1234-1234-123456789012
ENTRA_CLIENT_ID=87654321-4321-4321-4321-210987654321
ENTRA_CLIENT_SECRET=your_client_secret_value_here

# Optional: Use specific Azure cloud (defaults to public cloud)
ENTRA_CLOUD_INSTANCE=https://login.microsoftonline.com
ENTRA_AUTHORITY=https://login.microsoftonline.com/12345678-1234-1234-1234-123456789012

# Group Configuration (Object IDs from Azure)
ENTRA_GROUP_UNRESTRICTED_ID=aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee
ENTRA_GROUP_RESTRICTED_ID=ffffffff-gggg-hhhh-iiii-jjjjjjjjjjjj
ENTRA_GROUP_ADMINS_ID=kkkkkkkk-llll-mmmm-nnnn-oooooooooooo

# M2M Configuration
ENTRA_M2M_CLIENT_ID=your_m2m_client_id_here
ENTRA_M2M_CLIENT_SECRET=your_m2m_client_secret_here

# Token Configuration
ENTRA_TOKEN_CACHE_TTL=300
ENTRA_JWKS_CACHE_TTL=3600
```

### Step 2: Agent-Specific Configuration

For each AI agent, create a configuration file in `.oauth-tokens/`:

**Example: `.oauth-tokens/agent-sre-agent-m2m.json`**
```json
{
  "client_id": "agent_service_principal_client_id",
  "client_secret": "agent_service_principal_secret",
  "tenant_id": "12345678-1234-1234-1234-123456789012",
  "scope": "https://graph.microsoft.com/.default",
  "grant_type": "client_credentials"
}
```

### Step 3: Docker Compose Configuration

Update your `docker-compose.yml` to include Entra ID environment variables:

```yaml
version: '3.8'

services:
  auth-server:
    image: mcp-auth-server
    environment:
      - AUTH_PROVIDER=entra
      - ENTRA_TENANT_ID=${ENTRA_TENANT_ID}
      - ENTRA_CLIENT_ID=${ENTRA_CLIENT_ID}
      - ENTRA_CLIENT_SECRET=${ENTRA_CLIENT_SECRET}
      - ENTRA_GROUP_UNRESTRICTED_ID=${ENTRA_GROUP_UNRESTRICTED_ID}
      - ENTRA_GROUP_RESTRICTED_ID=${ENTRA_GROUP_RESTRICTED_ID}
      - ENTRA_GROUP_ADMINS_ID=${ENTRA_GROUP_ADMINS_ID}
    ports:
      - "8000:8000"
    networks:
      - mcp-network

  mcpgw-server:
    image: mcp-gateway
    environment:
      - AUTH_PROVIDER=entra
      - ENTRA_TENANT_ID=${ENTRA_TENANT_ID}
    depends_on:
      - auth-server
    networks:
      - mcp-network

networks:
  mcp-network:
    driver: bridge
```

## Validation and Testing

### Step 1: Test App Registration

Use Azure CLI to validate the configuration:

```bash
# Login to Azure CLI
az login

# Test the app registration
az ad app show --id 87654321-4321-4321-4321-210987654321

# Test service principal
az ad sp show --id your_service_principal_object_id

# Test group membership
az ad group member list --group mcp-servers-unrestricted
```

### Step 2: Test Token Acquisition

Create a test script to validate token acquisition:

```python
# test_entra_auth.py
import requests
import json

# Configuration
tenant_id = "your_tenant_id"
client_id = "your_client_id"
client_secret = "your_client_secret"

# Get token
token_url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
token_data = {
    'grant_type': 'client_credentials',
    'client_id': client_id,
    'client_secret': client_secret,
    'scope': 'https://graph.microsoft.com/.default'
}

response = requests.post(token_url, data=token_data)
if response.status_code == 200:
    token = response.json()['access_token']
    print("✅ Token acquired successfully")
    print(f"Token: {token[:20]}...")
else:
    print("❌ Token acquisition failed")
    print(response.text)
```

### Step 3: Test MCP Gateway Integration

1. Start the MCP Gateway services:
   ```bash
   docker-compose up -d
   ```

2. Test authentication endpoint:
   ```bash
   curl -f http://localhost:8000/health
   ```

3. Test token validation:
   ```bash
   # Use a real Entra ID token
   curl -X POST http://localhost:8000/validate \
     -H "X-Authorization: Bearer your_entra_token_here" \
     -H "Content-Type: application/json"
   ```

### Step 4: Test AI Agent Authentication

1. Generate agent token:
   ```bash
   uv run python credentials-provider/entra/generate_tokens.py --agent-id sre-agent
   ```

2. Test agent authentication:
   ```bash
   ./test-entra-mcp.sh --agent-id sre-agent
   ```

## Troubleshooting

### Common Issues

#### Issue: "AADSTS50194: Application is not configured as a multi-tenant application"

**Solution**:
1. Go to app registration **Authentication**
2. Ensure **Supported account types** is set correctly
3. For single tenant: "Accounts in this organizational directory only"

#### Issue: "AADSTS65001: The user or administrator has not consented to use the application"

**Solution**:
1. Go to **API permissions**
2. Click **Grant admin consent for [tenant]**
3. Ensure all required permissions are granted

#### Issue: "Groups claim not present in token"

**Solution**:
1. Go to **Token configuration**
2. Add **groups** claim for both ID and access tokens
3. Configure group filtering if you have many groups

#### Issue: "AADSTS700016: Application with identifier was not found"

**Solution**:
1. Verify the `client_id` in your configuration
2. Ensure the app registration exists and is not deleted
3. Check the tenant ID is correct

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# In your .env file
LOG_LEVEL=DEBUG
ENTRA_DEBUG=true

# Restart services
docker-compose restart auth-server
```

### Log Analysis

Check logs for authentication issues:

```bash
# Auth server logs
docker-compose logs -f auth-server | grep -i entra

# Sample success pattern:
# ✅ Token validation successful using EntraIdProvider
# ✅ Mapped Entra groups ['mcp-servers-unrestricted'] to scopes

# Sample error pattern:
# ❌ Entra ID token validation failed: Invalid signature
```

### Network Connectivity

Test connectivity to Microsoft endpoints:

```bash
# Test Azure endpoints
curl -v https://login.microsoftonline.com/common/discovery/instance
curl -v https://graph.microsoft.com/v1.0

# Test from within container
docker-compose exec auth-server curl -v https://login.microsoftonline.com/common/discovery/instance
```

### Token Inspection

Decode JWT tokens for debugging:

```bash
# Decode token (header and payload only, signature verification separate)
echo "your_jwt_token" | cut -d. -f1 | base64 -d | jq '.'  # Header
echo "your_jwt_token" | cut -d. -f2 | base64 -d | jq '.'  # Payload
```

Expected token structure:
```json
{
  "aud": "your_client_id",
  "iss": "https://login.microsoftonline.com/tenant_id/v2.0",
  "iat": 1640995200,
  "nbf": 1640995200,
  "exp": 1640998800,
  "sub": "user_object_id",
  "groups": ["group_object_id_1", "group_object_id_2"],
  "upn": "user@company.com"
}
```

---

## Quick Reference

### Key Commands
```bash
# Setup
az ad app create --display-name "MCP Gateway Enterprise"
az ad group create --display-name "mcp-servers-unrestricted" --mail-nickname "mcp-unrestricted"

# Operations
uv run python credentials-provider/entra/generate_tokens.py --agent-id <id>
./test-entra-mcp.sh --agent-id <id>

# Health Checks
curl -f http://localhost:8000/health
az ad app show --id <client-id>

# Troubleshooting
docker-compose logs -f auth-server
az ad group member list --group <group-name>
```

### Important URLs
- **Azure Portal**: https://portal.azure.com
- **Entra ID Admin**: https://entra.microsoft.com
- **Graph Explorer**: https://developer.microsoft.com/en-us/graph/graph-explorer
- **Token Endpoint**: https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token

### Service Endpoints
- **Auth Server**: http://localhost:8000
- **OAuth Callback**: https://mcpgateway.yourdomain.com/auth/callback
- **Health Check**: http://localhost:8000/health

---

*This documentation is maintained as part of the MCP Gateway project. For updates and issues, please refer to the project repository.*