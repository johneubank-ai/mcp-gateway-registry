# TODO: Gateway OAuth + Codex + Upstream OAuth Servers

Last updated: 2026-03-24

## What we are trying to do right now

Make this local MCP Gateway expose remote MCP servers behind gateway-managed auth, so a coding client like Codex can:

- connect to a gatewayed MCP endpoint
- detect OAuth automatically from the MCP endpoint
- run a normal OAuth 2.1 login flow
- store credentials locally in the client
- call tools through the gateway without any copied JWTs

The immediate target has been:

- local gateway ingress auth = Entra-backed login to the gateway
- remote upstream server = Context7, no upstream auth
- client = Codex CLI

The next target is:

- local gateway ingress auth = Entra-backed login to the gateway
- remote upstream server = Linear MCP, which has its own auth requirements
- client = Codex CLI

## Current status

### Gateway and OAuth status

- The Podman stack is up and healthy.
- The gateway exposes MCP OAuth discovery endpoints:
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/openid-configuration`
  - `/.well-known/oauth-protected-resource/...`
  - `/authorize`
  - `/token`
  - `/register`
  - `/jwks.json`
- The gateway returns OAuth-style `401` challenges from protected MCP endpoints.
- Context7 is registered in the live registry store and reachable through the gateway.

### Context7 status

- Discovery now shows Context7 at `http://localhost/context7/mcp` when queried through the gateway.
- The live MCP route at `http://localhost:8080/context7/mcp` now returns `401 Unauthorized`.
- The `WWW-Authenticate` header includes `resource_metadata="http://localhost/.well-known/oauth-protected-resource/context7/mcp"`.
- The gateway successfully health-checks Context7 upstream at `https://mcp.context7.com/mcp`.
- The gateway has fetched Context7 tools and shows:
  - `resolve-library-id`
  - `query-docs`

### Codex status

- The previous manual test used:
  - `codex mcp add context7 --url http://localhost/context7/mcp`
  - `codex mcp login context7`
- That did not trigger OAuth login.
- The first problem was the URL: the local gateway is actually on `http://localhost:8080`, not bare `http://localhost`.
- The deeper problem is that the gateway is still advertising OAuth metadata at `http://localhost` instead of `http://localhost:8080`.
- Because of that origin mismatch, Codex OAuth discovery is still not correct end to end.

### Why Codex did not login

Two issues are currently in play:

- The Codex server URL should have been `http://localhost:8080/context7/mcp`, not `http://localhost/context7/mcp`.
- The gateway is still emitting discovery/challenge URLs rooted at `http://localhost` because nginx is forwarding `$host` instead of the full host including port.

Concretely:

- `auth_server/server.py` builds issuer URLs from the incoming `Host` header.
- `registry/api/wellknown_routes.py` does the same for MCP discovery URLs.
- nginx currently forwards the host in a way that drops `:8080`.

Result:

- the client hits `http://localhost:8080/context7/mcp`
- the server tells the client to discover auth at `http://localhost/...`
- the MCP auth flow is no longer self-consistent

## What is missing versus an actually good OAuth 2.1 + dynamic registration flow

This repo is now in "phase A works in principle" territory, not "production-grade MCP OAuth" territory.

### Missing or incomplete gateway OAuth pieces

- Correct external origin propagation.
  - Discovery, issuer, authorization endpoint, token endpoint, registration endpoint, JWKS URI, and protected-resource metadata must all use the exact externally reachable origin.
  - Right now local testing shows `localhost` instead of `localhost:8080`.

- Stable signing and JWKS.
  - `auth_server/server.py` currently mints OAuth access tokens with `HS256`.
  - `jwks.json` currently returns an empty key set.
  - A real implementation should sign with asymmetric keys and publish a usable JWKS.

- Persistent client registration.
  - `/register` exists, but the client registration store is currently in-memory.
  - That means registered public clients disappear on restart.

- Persistent authorization codes and refresh tokens.
  - These are currently stored in memory too.
  - A real flow should persist them in a proper store with expiry and cleanup.

- Full client metadata support.
  - The current `/register` implementation is minimal.
  - It is enough to experiment with DCR, but it is not a complete or hardened client-registration implementation.

- Better token lifecycle management.
  - Refresh token rotation exists.
  - Storage, revocation, auditing, and session binding are not yet where they should be.

- HTTPS for real deployments.
  - Localhost HTTP is acceptable for local dev.
  - Any real deployment should terminate TLS end to end for auth endpoints and protected resources.

### Missing or incomplete gateway-to-upstream auth pieces

- The gateway does not yet implement a proper third-party delegated authorization bridge for upstream MCP servers.
- The gateway currently understands backend auth as:
  - `none`
  - `bearer`
  - `api_key`
- It does not yet have a complete "gateway is OAuth client to upstream SaaS, while also being OAuth authorization server to Codex" implementation.
- That means user-by-user upstream OAuth token storage and injection for remote MCP servers like Linear is not complete yet.

### Missing client-side validation work

- Codex has not yet been re-tested successfully against the fixed gateway origin.
- We have not yet completed a real `codex mcp login` against the gateway after fixing host/port propagation.
- We have not yet validated Codex credential persistence in keychain/keyring for this gateway.

## Sources checked on 2026-03-24

### Repo code and docs

- `auth_server/server.py`
- `registry/api/wellknown_routes.py`
- `registry/core/nginx_service.py`
- `registry/health/service.py`
- `registry/core/endpoint_utils.py`
- `docs/quickstart.md`
- `docs/auth-mgmt.md`
- `docs/ai-coding-assistants-setup.md`
- `docs/podman-entra-id-local-setup.md`

### External docs

- OpenAI Codex MCP docs:
  - https://developers.openai.com/codex/mcp
  - https://developers.openai.com/codex/config-reference
- MCP authorization spec:
  - https://modelcontextprotocol.io/specification/2025-03-26/basic/authorization
- Linear MCP docs:
  - https://linear.app/docs/mcp
- Linear OAuth docs:
  - https://linear.app/developers/oauth-2-0-authentication
  - https://linear.app/developers/oauth-actor-authorization
- Linear agent/app docs:
  - https://linear.app/developers/agents
- Linear Codex integration page:
  - https://linear.app/integrations/codex-mcp

## Important Linear findings

### What Linear supports now

Per Linear's docs as of 2026-03-24:

- Linear exposes a hosted remote MCP server at:
  - `https://mcp.linear.app/mcp`
- It also supports SSE at:
  - `https://mcp.linear.app/sse`
- The Linear MCP server follows the authenticated remote MCP spec.
- It uses OAuth 2.1 with dynamic client registration.
- For Codex, Linear documents:
  - `codex mcp add linear --url https://mcp.linear.app/mcp`
- Linear also documents that Codex may require:
  - `[features] experimental_use_rmcp_client = true`
- Linear's MCP server also supports directly passing:
  - `Authorization: Bearer <token>`
- That bearer can be:
  - a Linear OAuth access token
  - a Linear API key
- For a direct Codex-to-Linear test, we do not need to create our own Linear OAuth app first.
  - Linear's hosted MCP server already implements the remote MCP OAuth flow and dynamic client registration.

### What this means for us

There are two realistic ways to gateway Linear:

#### Option A: simple shared upstream credential

Use one Linear identity for the whole gatewayed server:

- create a Linear OAuth app or API key
- obtain a bearer token
- store that bearer token in the gateway as the upstream credential
- gate access to `/linear/mcp` with Entra at the gateway
- inject the upstream Linear bearer token on proxied requests

Pros:

- fastest path
- no per-user Linear token management
- easiest way to prove the gateway path works

Cons:

- all gateway users share one Linear identity upstream
- auditability in Linear is weaker
- not a fully delegated user OAuth model

#### Option B: proper delegated per-user upstream OAuth

Make the gateway do third-party authorization:

- Codex logs in to the gateway
- gateway authenticates user with Entra
- when Linear upstream access is needed, gateway redirects user to Linear OAuth
- gateway exchanges the Linear code for Linear access/refresh tokens
- gateway stores those Linear tokens per user and per workspace
- gateway issues its own MCP access token back to Codex
- later tool calls to `/linear/mcp` use the user's stored Linear token upstream

Pros:

- best security and user attribution model
- actions in Linear can map to individual users
- matches MCP third-party authorization guidance

Cons:

- materially more implementation work
- requires persistent token storage and token lifecycle management
- requires a full upstream token binding design

## Recommended Linear direction

### Recommendation

Implement this in phases:

1. Fix gateway origin propagation and get Codex OAuth login working for Context7.
2. Baseline-test Linear direct-to-Codex using Linear's own hosted MCP server.
3. Add a gatewayed Linear server using a shared upstream Linear credential.
4. Only after that, implement the fully delegated per-user Linear OAuth bridge.

This sequencing keeps the problems separate:

- first fix gateway OAuth correctness
- then prove Linear itself works in Codex
- then prove the gateway can proxy an upstream-authenticated MCP server
- then build the full third-party delegated auth chain

## How to set up a Linear app for the gateway

This depends on whether we want shared app auth or user-delegated auth.

### If we want the fastest useful path

Create a normal Linear OAuth2 application and use it as a shared app credential source.

Steps:

- Create a dedicated Linear workspace for managing the OAuth app if possible.
  - Linear recommends creating a dedicated workspace for managing OAuth applications.
- Create a new OAuth2 Application in Linear.
- Add exact redirect URIs for the gateway callback we will build.
  - local example: `http://localhost:8888/oauth2/callback/linear-upstream`
  - prod example: `https://gateway.example.com/oauth2/callback/linear-upstream`
- Choose the minimum scopes needed.
  - likely start with `read`
  - add `write`, `issues:create`, or `comments:create` only if needed
- Decide actor mode.
  - use `actor=user` if we eventually want user-delegated actions
  - use `actor=app` if we want the app itself to act as the Linear identity
- If we want server-to-server app tokens, enable client credentials tokens for the OAuth app.
- Linear documents a `client_credentials` grant for OAuth apps when that toggle is enabled.
  - The resulting token is an `app` actor token.
  - It is valid for 30 days.
  - There is only one active client-credentials token per app at a time.
- Store the Linear `client_id` and `client_secret` in gateway secrets, not in Codex config.

### If we want the best long-term delegated flow

Use a Linear OAuth app with per-user install/consent and let the gateway manage the upstream refresh tokens.

Steps:

- Create a Linear OAuth2 app.
- Register gateway callback URLs for local and prod.
- Use `actor=user` for user-attributed actions.
- Use PKCE if the gateway implementation chooses a public-client style flow.
- Otherwise use the standard confidential web app flow at the gateway.
- Persist the resulting Linear access token and refresh token keyed by:
  - gateway user identity
  - Linear workspace
  - MCP server path
- Inject `Authorization: Bearer <linear_access_token>` only on requests to the Linear upstream.

### If we want the gateway to appear as a real Linear app user

This is only needed if we want agent-like behavior inside Linear itself.

Use:

- `actor=app`
- optional scopes:
  - `app:assignable`
  - `app:mentionable`

This is more "Linear agent/app" than "plain MCP tool access". It is not required for basic MCP reads/writes through the Linear hosted MCP server.

## Granular to-do list

### Phase 0: capture current state

- [x] Get local Podman stack healthy.
- [x] Implement phase-A gateway OAuth endpoints and challenges.
- [x] Register Context7 in the live registry and get `/context7/mcp` returning OAuth `401`.
- [x] Confirm Context7 upstream health and tool discovery.
- [ ] Add a regression test for the exact localhost `:8080` discovery case.

### Phase 1: make Codex OAuth actually work against the gateway

- [ ] Fix nginx host forwarding so the auth server and well-known routes see the external host including port.
- [ ] Audit all places that derive external URLs from request headers.
- [ ] Ensure these endpoints all emit `http://localhost:8080` in local Podman mode:
  - `WWW-Authenticate resource_metadata`
  - `/.well-known/oauth-protected-resource/...`
  - `/.well-known/oauth-authorization-server`
  - `/.well-known/openid-configuration`
  - `authorization_endpoint`
  - `token_endpoint`
  - `registration_endpoint`
  - `jwks_uri`
- [ ] Re-test:
  - `codex mcp add context7 --url http://localhost:8080/context7/mcp`
  - `codex mcp login context7`
- [ ] Confirm whether Codex on this machine also needs:
  - `[features] experimental_use_rmcp_client = true`
- [ ] Confirm Codex stores gateway OAuth credentials successfully.
- [ ] Document the exact working Codex config in repo docs.

### Phase 2: harden gateway OAuth

- [ ] Replace HS256 gateway OAuth access tokens with asymmetric signing.
- [ ] Publish a real JWKS instead of an empty key set.
- [ ] Persist DCR client registrations.
- [ ] Persist auth codes, refresh tokens, and revocation state.
- [ ] Add cleanup/TTL handling for auth code and refresh token stores.
- [ ] Add audit logging for DCR and token issuance.
- [ ] Add explicit tests for:
  - DCR registration survives restart
  - refresh token rotation
  - issuer/resource/origin correctness
  - localhost callback handling

### Phase 3: prove Linear works directly in Codex first

- [ ] In a scratch environment, test Linear directly with Codex exactly per Linear docs:
  - `codex mcp add linear --url https://mcp.linear.app/mcp`
  - `codex mcp login linear`
- [ ] If needed, enable:
  - `[features] experimental_use_rmcp_client = true`
- [ ] Confirm direct Linear login succeeds before adding the gateway into the picture.
- [ ] Record what Codex stores locally after successful login.
- [ ] Record whether Linear DCR succeeds automatically with current Codex build.

### Phase 4: register Linear in the gateway with a shared upstream credential

- [ ] Create a Linear OAuth2 app.
- [ ] Decide whether to use:
  - OAuth access token obtained through the app
  - client credentials token
  - API key
- [ ] Start with the smallest useful Linear scope set.
- [ ] Register a new gateway server path, likely `/linear`.
- [ ] Use upstream base URL:
  - `https://mcp.linear.app/`
- [ ] Set transport:
  - `streamable-http`
- [ ] Store upstream credential in the gateway as encrypted bearer auth.
- [ ] Verify the gateway can:
  - health check Linear upstream
  - fetch Linear tools
  - proxy `/linear/mcp`
  - still require Entra at ingress
- [ ] Confirm Codex can use the gatewayed Linear endpoint after gateway login.

### Phase 5: implement proper delegated upstream Linear OAuth

- [ ] Design persistent storage for third-party upstream tokens.
- [ ] Add a token linkage model:
  - gateway user
  - upstream provider
  - workspace
  - server path
  - access token
  - refresh token
  - expiry
  - granted scopes
- [ ] Add a new upstream auth mode for delegated OAuth-backed bearer injection.
- [ ] Add a new callback route for Linear upstream OAuth at the gateway auth server.
- [ ] Implement redirect-to-Linear from the gateway auth layer when upstream grant is missing.
- [ ] Exchange Linear auth code for tokens at:
  - `https://api.linear.app/oauth/token`
- [ ] Refresh Linear tokens when needed.
- [ ] Revoke Linear tokens when disconnecting a user or uninstalling the app.
- [ ] Bind gateway-issued MCP tokens to the upstream Linear session state.
- [ ] Add UI/API to show:
  - Linear connected or not
  - which workspace is connected
  - scopes granted
  - reconnect / disconnect

### Phase 6: productionize the Linear path

- [ ] Add encrypted secret storage for Linear client credentials and refresh tokens.
- [ ] Add audit logs for upstream grant creation, refresh, and revocation.
- [ ] Add admin docs for creating and rotating the Linear OAuth app secret.
- [ ] Add user docs for connecting their Linear workspace through the gateway.
- [ ] Add integration tests covering:
  - Entra gateway login
  - Linear upstream consent
  - token refresh
  - Codex calling tools through `/linear/mcp`

## Repo files most likely to change next

- `registry/core/nginx_service.py`
- `auth_server/server.py`
- `registry/api/wellknown_routes.py`
- `registry/health/service.py`
- `registry/core/endpoint_utils.py`
- `registry/core/mcp_client.py`
- `registry/core/schemas.py`
- `docs/ai-coding-assistants-setup.md`
- `docs/auth.md`
- `docs/quickstart.md`
- new docs for upstream delegated OAuth provider handling

## Short recommendation

Do not jump straight into "gatewayed Linear with delegated upstream OAuth" before fixing the current gateway origin issue.

The right order is:

1. fix gateway origin and Codex OAuth for Context7
2. prove direct Linear works in Codex
3. gateway Linear with a shared upstream token
4. then build the fully delegated Linear OAuth bridge
