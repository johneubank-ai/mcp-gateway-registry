# MCP Gateway Registry: Podman + Entra ID Local Setup Guide

Complete, step-by-step instructions for setting up the MCP Gateway Registry locally on macOS using **Podman (rootless)** with **Microsoft Entra ID** authentication. This guide is designed to be executed by a Claude Code instance from a fresh clone.

## Prerequisites

The operator must provide these values before starting:

| Variable | Description | Where to find |
|----------|-------------|---------------|
| `ENTRA_CLIENT_ID` | App Registration client ID (GUID) | Azure Portal > App registrations > Overview > Application (client) ID |
| `ENTRA_TENANT_ID` | Azure AD directory/tenant ID (GUID) | Azure Portal > App registrations > Overview > Directory (tenant) ID |
| `ENTRA_CLIENT_SECRET` | App Registration secret **Value** (NOT the Secret ID) | Azure Portal > App registrations > Certificates & secrets > Value column |
| `ENTRA_GROUP_ADMIN_ID` | Admin security group Object ID (GUID) | Azure Portal > Groups > [admin group] > Object Id |
| `ENTRA_GROUP_USERS_ID` | Users security group Object ID (GUID) | Azure Portal > Groups > [users group] > Object Id |
| `SECRET_KEY` | 64-char hex string for JWT signing | Generate with: `python3 -c "import secrets; print(secrets.token_hex(32))"` |

### Critical: Client Secret Value vs Secret ID

Azure Portal shows two columns for each secret:
- **Secret ID**: A UUID (e.g. `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`) -- this is NOT the credential
- **Value**: An opaque string (e.g. `6sF8Q~...`) -- this IS the credential you need

Using the Secret ID instead of the Value will cause `401 Unauthorized` during token exchange. The Value is only visible immediately after creation.

### Critical: Redirect URI Configuration

The Entra ID App Registration must have this exact redirect URI configured under **Authentication > Redirect URIs**:

```
http://localhost:8888/oauth2/callback/entra
```

The existing doc (`docs/entra-id-setup.md`) incorrectly states `http://localhost/auth/callback`. The actual callback URI is constructed by the auth server at `auth_server/server.py:2396-2402` which appends `:8888` when the host is `localhost`.

### Azure Portal App Registration Requirements

Before starting, verify the App Registration has:

1. **Redirect URI**: `http://localhost:8888/oauth2/callback/entra` (Platform: Web)
2. **API Permissions** (Delegated):
   - `User.Read`
   - `email`
   - `profile`
   - `GroupMember.Read.All`
3. **Admin consent granted** for the above permissions
4. **Optional Claims** on ID token: `email`, `preferred_username`, `groups`
5. **Groups claim**: Security groups with Group ID
6. **Security groups** created with users assigned

---

## Setup Steps

### Step 1: Install Podman CLI

```bash
# macOS via Homebrew
brew install podman
brew install podman-compose

# Verify
podman --version
podman compose version
```

### Step 2: Initialize Podman Machine

```bash
podman machine init --cpus 4 --memory 8192 --disk-size 50
podman machine start

# Verify
podman machine list
podman info --format '{{.Host.Arch}}'
```

On Apple Silicon, `arch` should be `arm64`. Do NOT use `--prebuilt` flag with Podman on ARM64.

### Step 3: Clone and Enter Repository

```bash
git clone https://github.com/johneubank-ai/mcp-gateway-registry.git
cd mcp-gateway-registry
```

### Step 4: Set Up Python Environment

```bash
uv sync
source .venv/bin/activate
```

### Step 5: Download Embeddings Model

```bash
mkdir -p ${HOME}/mcp-gateway/models
huggingface-cli download sentence-transformers/all-MiniLM-L6-v2 \
  --local-dir ${HOME}/mcp-gateway/models/all-MiniLM-L6-v2
```

### Step 6: Create and Configure .env

```bash
cp .env.example .env
```

Apply these changes to `.env` (use `sed` or edit manually). Replace placeholder values with actual credentials:

```bash
# Auth provider
sed -i '' 's|^AUTH_PROVIDER=keycloak|AUTH_PROVIDER=entra|' .env

# Entra ID credentials (replace with actual values)
sed -i '' 's|^ENTRA_TENANT_ID=your-tenant-id-here|ENTRA_TENANT_ID=<YOUR_TENANT_ID>|' .env
sed -i '' 's|^ENTRA_CLIENT_ID=your-client-id-here|ENTRA_CLIENT_ID=<YOUR_CLIENT_ID>|' .env
sed -i '' 's|^ENTRA_CLIENT_SECRET=your-client-secret-here|ENTRA_CLIENT_SECRET=<YOUR_CLIENT_SECRET_VALUE>|' .env
sed -i '' 's|^ENTRA_ENABLED=false|ENTRA_ENABLED=true|' .env
sed -i '' 's|^ENTRA_GROUP_ADMIN_ID=your-admin-group-object-id-here|ENTRA_GROUP_ADMIN_ID=<YOUR_ADMIN_GROUP_ID>|' .env
sed -i '' 's|^ENTRA_GROUP_USERS_ID=your-users-group-object-id-here|ENTRA_GROUP_USERS_ID=<YOUR_USERS_GROUP_ID>|' .env

# Secret key (replace with actual value)
sed -i '' 's|^SECRET_KEY=CHANGE-THIS-IMMEDIATELY-use-a-strong-random-key-in-production|SECRET_KEY=<YOUR_SECRET_KEY>|' .env

# Disable Keycloak (using Entra ID instead)
sed -i '' 's|^KEYCLOAK_ENABLED=true|KEYCLOAK_ENABLED=false|' .env

# Keycloak still runs in compose -- set dummy passwords so it starts
sed -i '' 's|^KEYCLOAK_ADMIN_PASSWORD=your-secure-keycloak-admin-password|KEYCLOAK_ADMIN_PASSWORD=TempKc2024!|' .env
sed -i '' 's|^KEYCLOAK_DB_PASSWORD=your-secure-db-password|KEYCLOAK_DB_PASSWORD=TempKcDb2024!|' .env
sed -i '' 's|^INITIAL_ADMIN_PASSWORD=your-secure-keycloak-admin-password|INITIAL_ADMIN_PASSWORD=TempKc2024!|' .env
sed -i '' 's|^INITIAL_USER_PASSWORD=your-secure-keycloak-user-password|INITIAL_USER_PASSWORD=TempKcUser2024!|' .env

# Grafana password
sed -i '' 's|^GRAFANA_ADMIN_PASSWORD=CHANGE-ME-SET-STRONG-PASSWORD|GRAFANA_ADMIN_PASSWORD=GrafanaLocal2024!|' .env

# Use local embeddings (no API key needed)
sed -i '' 's|^EMBEDDINGS_PROVIDER=litellm|EMBEDDINGS_PROVIDER=sentence-transformers|' .env
sed -i '' 's|^EMBEDDINGS_MODEL_NAME=bedrock/amazon.titan-embed-text-v2:0|EMBEDDINGS_MODEL_NAME=all-MiniLM-L6-v2|' .env
sed -i '' 's|^EMBEDDINGS_MODEL_DIMENSIONS=1024|EMBEDDINGS_MODEL_DIMENSIONS=384|' .env

# MongoDB runs without auth locally
sed -i '' 's|^DOCUMENTDB_USERNAME=admin|DOCUMENTDB_USERNAME=|' .env
sed -i '' 's|^DOCUMENTDB_PASSWORD=admin|DOCUMENTDB_PASSWORD=|' .env
```

Quote any values with spaces so the file can be sourced by bash:

```bash
sed -i '' 's|^REGISTRY_NAME=AI Gateway Registry|REGISTRY_NAME="AI Gateway Registry"|' .env
sed -i '' 's|^REGISTRY_ORGANIZATION_NAME=ACME Inc.|REGISTRY_ORGANIZATION_NAME="ACME Inc."|' .env
sed -i '' 's|^REGISTRY_DESCRIPTION=Central registry for all your AI assets|REGISTRY_DESCRIPTION="Central registry for all your AI assets"|' .env
```

### Step 7: Update scopes.yml with Entra Group IDs

Edit `auth_server/scopes.yml`. Find the `# ----- Entra ID Group Mappings` section and replace the placeholder Object IDs with your actual group IDs:

```yaml
  # ----- Entra ID Group Mappings (Azure AD Object IDs) -----
  # Admin group Object ID from Azure AD
  "<YOUR_ADMIN_GROUP_OBJECT_ID>":
  - registry-admins
  - mcp-servers-unrestricted/read
  - mcp-servers-unrestricted/execute

  # Users group Object ID from Azure AD
  "<YOUR_USERS_GROUP_OBJECT_ID>":
  - public-mcp-users
```

Remove or leave the old placeholder IDs (`4c46ec66-...` and `5f605d68-...`).

### Step 8: Build Frontend

The `build_and_run.sh` script builds the frontend on the host, but Node.js 25+ has a Corepack conflict with the `postinstall-postinstall` package. Build manually:

```bash
cd frontend
rm -rf node_modules
npm install --legacy-peer-deps --ignore-scripts
npx patch-package
npm run build
cd ..
```

Verify `frontend/build/index.html` exists. The build script will skip the frontend build if this file is present.

### Step 9: Build and Start Services

```bash
source .env
podman compose -f docker-compose.podman.yml build
```

This takes 10-15 minutes on first run (ARM64 local build).

Then start all services:

```bash
source .env
podman compose -f docker-compose.podman.yml up -d
```

### Step 10: Wait and Verify

Wait ~90 seconds for all services to initialize, then check:

```bash
# Check container status
podman ps -a --format "table {{.Names}}\t{{.Status}}"

# Expected: all containers "Up" except mongodb-init which should be "Exited (0)"
```

Verify health endpoints:

```bash
curl -sf http://localhost:7860/health   # Registry API
curl -sf http://localhost:8888/health   # Auth Server
curl -sf http://localhost:8080          # Main UI (nginx)
curl -sf http://localhost:8890/health   # Metrics Service
```

All should return HTTP 200.

### Step 11: Verify Entra ID Configuration

```bash
# Check auth provider is entra
curl -sf http://localhost:8888/oauth2/providers | python3 -m json.tool
# Should show: {"providers": [{"name": "entra", "display_name": "Microsoft Entra ID"}]}

# Check redirect URI
curl -sf -D - -o /dev/null http://localhost:8888/oauth2/login/entra 2>&1 | grep location
# Should contain: redirect_uri=http%3A%2F%2Flocalhost%3A8888%2Foauth2%2Fcallback%2Fentra
```

### Step 12: Verify MongoDB Initialization

```bash
podman logs mcp-mongodb-init 2>&1 | grep -E "Complete|Entra|group_mappings"
# Should show:
#   Added Entra admin group ID: <your-admin-group-id>
#   group_mappings: ['registry-admins', '<your-admin-group-id>']
#   MongoDB CE Initialization Complete!
```

### Step 13: Test Login

1. Open http://localhost:8080 in a browser
2. Click "Sign in with Microsoft Entra ID"
3. Sign in with a user in your admin or users security group
4. After successful auth, you should see the MCP Gateway Registry dashboard

---

## Service URLs (Podman)

| Service | URL | Description |
|---------|-----|-------------|
| Main UI | http://localhost:8080 | Web interface (nginx) |
| Registry API | http://localhost:7860 | FastAPI backend |
| Auth Server | http://localhost:8888 | OAuth2/authentication |
| Metrics | http://localhost:8890 | Metrics collection |
| Grafana | http://localhost:3000 | Dashboards |
| Prometheus | http://localhost:9090 | Metrics scraping |
| Keycloak | http://localhost:18080 | IdP (not used with Entra) |

---

## Known Issues and Fixes Applied

These fixes are already applied in this repository fork (branch `podman-rootless-fixes` merged to `main`):

### 1. build_and_run.sh: Docker-only checks break Podman

**Problem**: Script unconditionally checks `docker compose version` and uses `--parallel`, `--progress=auto`, `--remove-orphans` flags unsupported by podman-compose.

**Fix**: Wrapped Docker-specific checks and flags in `if [[ "$COMPOSE_CMD" == "docker compose" ]]` conditionals.

### 2. docker-compose.podman.yml: Privileged ports

**Problem**: Host ports 80 and 443 require root access, which rootless Podman cannot provide.

**Fix**: Remapped to `8080:8080` and `8443:8443`.

### 3. docker-compose.podman.yml: MongoDB cannot switch users

**Problem**: `security_opt: no-new-privileges:true` and `cap_drop: ALL` prevent MongoDB's entrypoint from switching to the `mongodb` user.

**Fix**: Removed these restrictions from the MongoDB service.

### 4. docker-compose.podman.yml: SQLite volume permissions

**Problem**: `metrics-db` container creates SQLite file as root; `metrics-service` runs as `appuser` and cannot write to it.

**Fix**: Added `chmod 666` on the database file and `chmod 777` on the directory in the metrics-db init command.

### 5. docker-compose.podman.yml: MongoDB auth defaults

**Problem**: `mongodb-init` defaults `DOCUMENTDB_USERNAME` and `DOCUMENTDB_PASSWORD` to `admin` via `${VAR:-admin}`, but MongoDB CE runs without authentication. The `:-` operator uses the default even when the .env value is empty.

**Fix**: Changed defaults to empty: `${DOCUMENTDB_USERNAME:-}` and `${DOCUMENTDB_PASSWORD:-}`.

### 6. Frontend build: Node.js 25+ Corepack conflict

**Problem**: `postinstall-postinstall` package runs `yarn run postinstall` which triggers a Corepack version conflict on Node.js 25+.

**Workaround**: Install with `--ignore-scripts`, then run `npx patch-package` and `npm run build` manually. The build script skips frontend build if `frontend/build/index.html` exists.

---

## Troubleshooting

### Login redirects to `http://localhost/login?error=oauth2_callback_failed`

Check auth server logs:

```bash
podman logs mcp-gateway-registry_auth-server_1 2>&1 | grep -i "error\|401\|callback" | tail -10
```

- **401 Unauthorized from token endpoint**: Wrong client secret. Verify you used the secret **Value**, not the **Secret ID**.
- **Redirect URI mismatch (AADSTS50011)**: The redirect URI in Azure Portal must be exactly `http://localhost:8888/oauth2/callback/entra`.

### MongoDB init fails with AuthenticationFailed

```bash
podman logs mcp-mongodb-init 2>&1 | tail -10
```

Ensure `DOCUMENTDB_USERNAME=` and `DOCUMENTDB_PASSWORD=` are empty in `.env` (MongoDB CE runs without auth).

### Containers stuck in "Created" state

Check if a dependency container failed:

```bash
podman ps -a --format "table {{.Names}}\t{{.Status}}"
podman logs <failed-container-name> 2>&1 | tail -20
```

Common cause: `mongodb-init` or `metrics-service` failing prevents downstream containers from starting.

### Port conflict errors

```bash
lsof -i :8080   # Check what's using the port
podman compose -f docker-compose.podman.yml down   # Stop everything
podman compose -f docker-compose.podman.yml up -d   # Restart
```

### Full reset

```bash
podman compose -f docker-compose.podman.yml down
podman volume prune -f
podman compose -f docker-compose.podman.yml up -d
```

---

## Skipped Steps (Not Needed for This Setup)

- **Keycloak initialization**: Not needed when using Entra ID (Keycloak runs but is unused)
- **M2M account setup**: Not needed for interactive user login
- **IAM API verification**: Not needed for basic auth testing
- **SSL/HTTPS configuration**: Not needed for localhost development
- **`bootstrap_user_and_m2m_setup.sh`**: Keycloak-specific, skip for Entra ID
