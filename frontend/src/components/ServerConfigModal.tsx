import React, { useCallback, useState, useEffect } from 'react';
import { ClipboardList, Key } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import axios from 'axios';
import type { Server } from './ServerCard';
import { useRegistryConfig } from '../hooks/useRegistryConfig';

type IDE = 'cursor' | 'roo-code' | 'claude-code' | 'kiro';

interface ServerConfigModalProps {
  server: Server;
  isOpen: boolean;
  onClose: () => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
}

const ServerConfigModal: React.FC<ServerConfigModalProps> = ({
  server,
  isOpen,
  onClose,
  onShowToast,
}) => {
  const [selectedIDE, setSelectedIDE] = useState<IDE>('cursor');
  const [jwtToken, setJwtToken] = useState<string | null>(null);
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { config: registryConfig, loading: configLoading } = useRegistryConfig();

  // Determine if we're in registry-only mode
  // While config is loading, default to with-gateway behavior (safer default)
  const isRegistryOnly = !configLoading && registryConfig?.deployment_mode === 'registry-only';

  // Fetch JWT token when modal opens (only in gateway mode)
  // We intentionally only depend on isOpen and isRegistryOnly to fetch once per modal open
  useEffect(() => {
    if (isOpen && !isRegistryOnly) {
      // Reset token state when modal opens
      setJwtToken(null);
      setTokenError(null);
      fetchJwtToken();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, isRegistryOnly]);

  const fetchJwtToken = async () => {
    setTokenLoading(true);
    setTokenError(null);
    try {
      const response = await axios.post('/api/tokens/generate', {
        description: 'Generated for MCP configuration',
        expires_in_hours: 8,
      }, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        // Token can be in response.data.tokens.access_token or response.data.access_token
        const accessToken = response.data.tokens?.access_token || response.data.access_token;
        if (accessToken) {
          setJwtToken(accessToken);
        } else {
          setTokenError('Token not found in response');
        }
      } else {
        setTokenError('Token generation failed');
      }
    } catch (err: any) {
      const status = err.response?.status;
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to generate token';

      // Provide more helpful error messages based on status
      if (status === 401 || status === 403) {
        setTokenError('Authentication required. Please log in first.');
      } else {
        setTokenError(errorMessage);
      }
      console.error('Failed to fetch JWT token:', err);
    } finally {
      setTokenLoading(false);
    }
  };

  const generateMCPConfig = useCallback(() => {
    const serverName = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // URL determination with fallback chain:
    // 1. mcp_endpoint (custom override) - always takes precedence
    // 2. proxy_pass_url (in registry-only mode)
    // 3. Constructed gateway URL (default/fallback)
    let url: string;

    if (server.mcp_endpoint) {
      url = server.mcp_endpoint;
    } else if (isRegistryOnly && server.proxy_pass_url) {
      url = server.proxy_pass_url;
    } else {
      const currentUrl = new URL(window.location.origin);
      const baseUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
      const cleanPath = server.path.replace(/\/+$/, '').replace(/^\/+/, '/');
      url = `${baseUrl}${cleanPath}/mcp`;
    }

    // In registry-only mode, don't include gateway auth headers
    const includeAuthHeaders = !isRegistryOnly;

    // Use actual JWT token if available, otherwise show placeholder
    const authToken = jwtToken || '[YOUR_GATEWAY_AUTH_TOKEN]';

    // Build headers object with both gateway auth and server auth (if applicable)
    const buildHeaders = () => {
      const headers: Record<string, string> = {};

      // Add gateway authentication header
      headers['X-Authorization'] = `Bearer ${authToken}`;

      // Add server authentication headers if server requires auth
      if (server.auth_scheme && server.auth_scheme !== 'none') {
        if (server.auth_scheme === 'bearer') {
          headers['Authorization'] = 'Bearer [YOUR_SERVER_AUTH_TOKEN]';
        } else if (server.auth_scheme === 'api_key') {
          const headerName = server.auth_header_name || 'X-API-Key';
          headers[headerName] = '[YOUR_API_KEY]';
        }
      }

      return headers;
    };

    switch (selectedIDE) {
      case 'cursor':
        return {
          mcpServers: {
            [serverName]: {
              url,
              ...(includeAuthHeaders && {
                headers: buildHeaders(),
              }),
            },
          },
        };
      case 'roo-code':
        return {
          mcpServers: {
            [serverName]: {
              type: 'streamable-http',
              url,
              disabled: false,
              ...(includeAuthHeaders && {
                headers: buildHeaders(),
              }),
            },
          },
        };
      case 'claude-code':
        return {
          mcpServers: {
            [serverName]: {
              type: 'http',
              url,
              ...(includeAuthHeaders && {
                headers: buildHeaders(),
              }),
            },
          },
        };
      case 'kiro':
        return {
          mcpServers: {
            [serverName]: {
              url,
              ...(includeAuthHeaders && {
                headers: buildHeaders(),
              }),
              disabled: false,
              autoApprove: [],
            },
          },
        };
      default:
        return {
          mcpServers: {
            [serverName]: {
              url,
              ...(includeAuthHeaders && {
                headers: buildHeaders(),
              }),
            },
          },
        };
    }
  }, [server.name, server.path, server.proxy_pass_url, server.mcp_endpoint, server.auth_scheme, server.auth_header_name, selectedIDE, isRegistryOnly, jwtToken]);

  const generateClaudeCodeCommand = useCallback(() => {
    const serverName = server.name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    // URL determination (same logic as generateMCPConfig)
    let url: string;
    if (server.mcp_endpoint) {
      url = server.mcp_endpoint;
    } else if (isRegistryOnly && server.proxy_pass_url) {
      url = server.proxy_pass_url;
    } else {
      const currentUrl = new URL(window.location.origin);
      const baseUrl = `${currentUrl.protocol}//${currentUrl.hostname}`;
      const cleanPath = server.path.replace(/\/+$/, '').replace(/^\/+/, '/');
      url = `${baseUrl}${cleanPath}/mcp`;
    }

    const includeAuthHeaders = !isRegistryOnly;
    const authToken = jwtToken || '[YOUR_GATEWAY_AUTH_TOKEN]';

    // Build command with headers
    let command = `claude mcp add --transport http ${serverName} ${url}`;

    if (includeAuthHeaders) {
      // Add gateway auth header
      command += ` \\\n  --header "X-Authorization: Bearer ${authToken}"`;

      // Add server auth header if applicable
      if (server.auth_scheme && server.auth_scheme !== 'none') {
        if (server.auth_scheme === 'bearer') {
          command += ` \\\n  --header "Authorization: Bearer [YOUR_SERVER_AUTH_TOKEN]"`;
        } else if (server.auth_scheme === 'api_key') {
          const headerName = server.auth_header_name || 'X-API-Key';
          command += ` \\\n  --header "${headerName}: [YOUR_API_KEY]"`;
        }
      }
    }

    return command;
  }, [server.name, server.path, server.proxy_pass_url, server.mcp_endpoint, server.auth_scheme, server.auth_header_name, isRegistryOnly, jwtToken]);


  const copyConfigToClipboard = useCallback(async () => {
    try {
      const config = generateMCPConfig();
      const configText = JSON.stringify(config, null, 2);
      await navigator.clipboard.writeText(configText);

      // Show visual feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      onShowToast?.('Configuration copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      onShowToast?.('Failed to copy configuration', 'error');
    }
  }, [generateMCPConfig, onShowToast]);

  const copyCommandToClipboard = useCallback(async () => {
    try {
      const command = generateClaudeCodeCommand();
      await navigator.clipboard.writeText(command);

      // Show visual feedback
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);

      onShowToast?.('Command copied to clipboard!', 'success');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      onShowToast?.('Failed to copy command', 'error');
    }
  }, [generateClaudeCodeCommand, onShowToast]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[80vh] overflow-auto bg-card p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            MCP Configuration for {server.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <h4 className="font-medium text-primary mb-2">
              How to use this configuration:
            </h4>
            <ol className="text-sm text-primary space-y-1 list-decimal list-inside">
              <li>Copy the configuration below</li>
              <li>
                Paste it into your <code className="bg-primary/20 px-1 rounded">mcp.json</code> file
              </li>
              {!isRegistryOnly && !jwtToken && (
                <li>
                  Replace <code className="bg-primary/20 px-1 rounded">[YOUR_AUTH_TOKEN]</code> with your
                  gateway authentication token (or wait for auto-generation)
                </li>
              )}
              <li>Restart your AI coding assistant to load the new configuration</li>
            </ol>
          </div>

          {!isRegistryOnly ? (
            <div className={`border rounded-lg p-4 ${
              jwtToken
                ? 'bg-primary/10 border-primary/20'
                : tokenError
                ? 'bg-destructive/10 border-destructive/20'
                : 'bg-muted border-border'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <h4 className={`font-medium ${
                  jwtToken
                    ? 'text-primary'
                    : tokenError
                    ? 'text-destructive'
                    : 'text-muted-foreground'
                }`}>
                  {tokenLoading
                    ? 'Fetching Token...'
                    : jwtToken
                    ? 'Token Ready - Copy and Paste!'
                    : tokenError
                    ? 'Token Generation Failed'
                    : 'Authentication Required'}
                </h4>
                {!tokenLoading && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={fetchJwtToken}
                    className="flex items-center gap-1 bg-primary hover:bg-primary/90 text-white text-xs"
                    title="Generate new token"
                  >
                    <Key className="h-3 w-3" />
                    {jwtToken ? 'Refresh' : 'Get Token'}
                  </Button>
                )}
              </div>
              {tokenLoading ? (
                <p className="text-sm text-muted-foreground">
                  Generating JWT token for your configuration...
                </p>
              ) : jwtToken ? (
                <p className="text-sm text-primary">
                  JWT token has been automatically added to the configuration below. You can copy and paste it directly into your mcp.json file. Token expires in 8 hours.
                </p>
              ) : tokenError ? (
                <p className="text-sm text-destructive">
                  {tokenError}. Click &quot;Get Token&quot; to retry, or manually replace [YOUR_AUTH_TOKEN] with your gateway token.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This configuration requires gateway authentication tokens. The tokens authenticate your AI assistant with
                  the MCP Gateway, not the individual server.
                </p>
              )}
            </div>
          ) : (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-primary mb-2">Direct Connection Mode</h4>
              <p className="text-sm text-primary">
                This registry operates in catalog-only mode. The configuration connects directly to the MCP server
                endpoint without going through a gateway proxy.
              </p>
              <p className="text-sm text-primary mt-2">
                <strong>Note:</strong> The MCP server may still require authentication (API key, auth header, etc.).
                Check the server's documentation to determine if any credentials are needed.
              </p>
            </div>
          )}

          {server.mcp_endpoint && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
              <h4 className="font-medium text-primary mb-2">Custom Endpoint Configured</h4>
              <p className="text-sm text-primary">
                This server uses a custom MCP endpoint:{' '}
                <code className="bg-primary/20 px-1 rounded break-all">{server.mcp_endpoint}</code>
              </p>
            </div>
          )}

          <div className="bg-muted border border-border rounded-lg p-4">
            <h4 className="font-medium text-foreground mb-3">Select your IDE/Tool:</h4>
            <div className="flex flex-wrap gap-2">
              {(['cursor', 'roo-code', 'claude-code', 'kiro'] as IDE[]).map((ide) => (
                <button
                  key={ide}
                  onClick={() => setSelectedIDE(ide)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedIDE === ide
                      ? 'bg-primary text-white'
                      : 'bg-muted text-foreground hover:bg-accent'
                  }`}
                >
                  {ide === 'cursor'
                    ? 'Cursor'
                    : ide === 'roo-code'
                    ? 'Roo Code'
                    : ide === 'claude-code'
                    ? 'Claude Code'
                    : 'Kiro'}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Configuration format optimized for{' '}
              {selectedIDE === 'cursor'
                ? 'Cursor'
                : selectedIDE === 'roo-code'
                ? 'Roo Code'
                : selectedIDE === 'claude-code'
                ? 'Claude Code'
                : 'Kiro'}{' '}
              integration
            </p>
          </div>

          {selectedIDE === 'claude-code' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">CLI Command:</h4>
                <Button
                  onClick={copyCommandToClipboard}
                  className={`flex items-center gap-2 text-white ${
                    copied
                      ? 'bg-primary'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy Command'}
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-100 p-4 rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                {generateClaudeCodeCommand()}
              </pre>
              <p className="text-xs text-muted-foreground mt-2">
                Run this command in your terminal to add the MCP server to Claude Code.
              </p>
            </div>
          ) : selectedIDE === 'kiro' ? (
            <div className="space-y-2">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 mb-3">
                <h4 className="font-medium text-primary mb-2">Kiro Configuration:</h4>
                <p className="text-sm text-primary">
                  Copy the JSON below and paste it into{' '}
                  <code className="bg-primary/20 px-1 rounded">~/.kiro/settings/mcp.json</code>
                </p>
              </div>
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">Configuration JSON:</h4>
                <Button
                  onClick={copyConfigToClipboard}
                  className={`flex items-center gap-2 text-white ${
                    copied
                      ? 'bg-primary'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-100 p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(generateMCPConfig(), null, 2)}
              </pre>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-foreground">Configuration JSON:</h4>
                <Button
                  onClick={copyConfigToClipboard}
                  className={`flex items-center gap-2 text-white ${
                    copied
                      ? 'bg-primary'
                      : 'bg-primary hover:bg-primary/90'
                  }`}
                >
                  <ClipboardList className="h-4 w-4" />
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </Button>
              </div>
              <pre className="bg-gray-900 text-green-100 p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(generateMCPConfig(), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ServerConfigModal;
