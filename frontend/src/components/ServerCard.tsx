import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Wrench,
  RefreshCw,
  Pencil,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  Cog,
  ShieldCheck,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import ServerConfigModal from './ServerConfigModal';
import SecurityScanModal from './SecurityScanModal';
import StarRatingWidget from './StarRatingWidget';
import VersionBadge from './VersionBadge';
import VersionSelectorModal from './VersionSelectorModal';
import DeleteConfirmation from './DeleteConfirmation';
import StatusBadge from './StatusBadge';
import ServerDetailsModal from './ServerDetailsModal';
import useEscapeKey from '../hooks/useEscapeKey';
import { formatRelativeTime } from '../utils/dateUtils';

interface ServerVersion {
  version: string;
  proxy_pass_url: string;
  status: string;
  is_default: boolean;
  released?: string;
  sunset_date?: string;
  description?: string;
}

interface SyncMetadata {
  is_federated?: boolean;
  source_peer_id?: string;
  upstream_path?: string;
  last_synced_at?: string;
  is_read_only?: boolean;
  is_orphaned?: boolean;
  orphaned_at?: string;
}

export interface Server {
  name: string;
  path: string;
  description?: string;
  official?: boolean;
  enabled: boolean;
  tags?: string[];
  last_checked_time?: string;
  usersCount?: number;
  rating_details?: Array<{ user: string; rating: number }>;
  status?: 'healthy' | 'healthy-auth-expired' | 'unhealthy' | 'unknown';
  num_tools?: number;
  proxy_pass_url?: string;
  mcp_endpoint?: string;
  // Version routing fields
  version?: string;  // Current active version
  versions?: ServerVersion[];
  default_version?: string;
  // MCP server info from initialize response
  mcp_server_version?: string;
  mcp_server_version_previous?: string;
  mcp_server_version_updated_at?: string;
  // Federation sync metadata
  sync_metadata?: SyncMetadata;
  // Backend authentication
  auth_scheme?: string;
  auth_header_name?: string;
  // Lifecycle status
  lifecycle_status?: 'active' | 'deprecated' | 'draft' | 'beta';
  source_created_at?: string;
  source_updated_at?: string;
}

interface ServerCardProps {
  server: Server;
  onToggle: (path: string, enabled: boolean) => void;
  onEdit?: (server: Server) => void;
  canModify?: boolean;
  canHealthCheck?: boolean;
  canToggle?: boolean;
  canDelete?: boolean;
  onRefreshSuccess?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onServerUpdate?: (path: string, updates: Partial<Server>) => void;
  onDelete?: (path: string) => Promise<void>;
  authToken?: string | null;
}

interface Tool {
  name: string;
  description?: string;
  schema?: any;
}

// Helper function to format time since last checked
const formatTimeSince = (timestamp: string | null | undefined): string | null => {
  if (!timestamp) {
    return null;
  }
  
  try {
    const now = new Date();
    const lastChecked = new Date(timestamp);
    
    // Check if the date is valid
    if (isNaN(lastChecked.getTime())) {
      return null;
    }
    
    const diffMs = now.getTime() - lastChecked.getTime();
    
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    let result;
    if (diffDays > 0) {
      result = `${diffDays}d ago`;
    } else if (diffHours > 0) {
      result = `${diffHours}h ago`;
    } else if (diffMinutes > 0) {
      result = `${diffMinutes}m ago`;
    } else {
      result = `${diffSeconds}s ago`;
    }
    
    return result;
  } catch (error) {
    console.error('formatTimeSince error:', error, 'for timestamp:', timestamp);
    return null;
  }
};

const ServerCard: React.FC<ServerCardProps> = React.memo(({ server, onToggle, onEdit, canModify, canHealthCheck = true, canToggle = true, canDelete, onRefreshSuccess, onShowToast, onServerUpdate, onDelete, authToken }) => {
  const [tools, setTools] = useState<Tool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showConfig, setShowConfig] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [showSecurityScan, setShowSecurityScan] = useState(false);
  const [securityScanResult, setSecurityScanResult] = useState<any>(null);
  const [loadingSecurityScan, setLoadingSecurityScan] = useState(false);
  const [showVersionSelector, setShowVersionSelector] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState<Set<number>>(new Set());

  const closeToolsModal = useCallback(() => {
    setShowTools(false);
    setExpandedDescriptions(new Set());
  }, []);
  useEscapeKey(closeToolsModal, showTools);
  useEscapeKey(() => setShowDeleteConfirm(false), showDeleteConfirm);

  // Fetch security scan status on mount to show correct icon color
  useEffect(() => {
    const fetchSecurityScan = async () => {
      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const response = await axios.get(
          `/api/servers${server.path}/security-scan`,
          headers ? { headers } : undefined
        );
        setSecurityScanResult(response.data);
      } catch {
        // Silently ignore - no scan result available
      }
    };
    fetchSecurityScan();
  }, [server.path, authToken]);

  const getStatusIcon = () => {
    switch (server.status) {
      case 'healthy':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'healthy-auth-expired':
        return <CheckCircle className="h-4 w-4 text-orange-500" />;
      case 'unhealthy':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (server.status) {
      case 'healthy':
        return 'bg-primary/10 text-primary';
      case 'healthy-auth-expired':
        return 'bg-muted text-muted-foreground';
      case 'unhealthy':
        return 'bg-destructive/10 text-destructive';
      default:
        return 'bg-muted text-foreground';
    }
  };

  const handleViewTools = useCallback(async () => {
    if (loadingTools) return;
    
    setLoadingTools(true);
    try {
      const response = await axios.get(`/api/tools${server.path}`);
      setTools(response.data.tools || []);
      setShowTools(true);
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      toast.error('Failed to fetch tools');
    } finally {
      setLoadingTools(false);
    }
  }, [server.path, loadingTools]);

  const handleRefreshHealth = useCallback(async () => {
    if (loadingRefresh) return;
    
    setLoadingRefresh(true);
    try {
      // Extract service name from path (remove leading slash)
      const serviceName = server.path.replace(/^\//, '');
      
      const response = await axios.post(`/api/refresh/${serviceName}`);
      
      // Update just this server instead of triggering global refresh
      if (onServerUpdate && response.data) {
        const updates: Partial<Server> = {
          status: response.data.status === 'healthy' ? 'healthy' : 
                  response.data.status === 'healthy-auth-expired' ? 'healthy-auth-expired' :
                  response.data.status === 'unhealthy' ? 'unhealthy' : 'unknown',
          last_checked_time: response.data.last_checked_iso,
          num_tools: response.data.num_tools
        };
        
        onServerUpdate(server.path, updates);
      } else if (onRefreshSuccess) {
        // Fallback to global refresh if onServerUpdate is not provided
        onRefreshSuccess();
      }
      
      toast.success('Health status refreshed successfully');
    } catch (error: any) {
      console.error('Failed to refresh health:', error);
      toast.error(error.response?.data?.detail || 'Failed to refresh health status');
    } finally {
      setLoadingRefresh(false);
    }
  }, [server.path, loadingRefresh, onRefreshSuccess, onServerUpdate]);

  const handleViewSecurityScan = useCallback(async () => {
    if (loadingSecurityScan) return;

    setShowSecurityScan(true);
    setLoadingSecurityScan(true);
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await axios.get(
        `/api/servers${server.path}/security-scan`,
        headers ? { headers } : undefined
      );
      setSecurityScanResult(response.data);
    } catch (error: any) {
      if (error.response?.status !== 404) {
        console.error('Failed to fetch security scan:', error);
        toast.error('Failed to load security scan results');
      }
      setSecurityScanResult(null);
    } finally {
      setLoadingSecurityScan(false);
    }
  }, [server.path, authToken, loadingSecurityScan]);

  const handleRescan = useCallback(async () => {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
    const response = await axios.post(
      `/api/servers${server.path}/rescan`,
      undefined,
      headers ? { headers } : undefined
    );
    setSecurityScanResult(response.data);
  }, [server.path, authToken]);

  const handleRefreshServerData = useCallback(async () => {
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await axios.get(
        `/api/server_details${server.path}`,
        headers ? { headers } : undefined
      );

      if (onServerUpdate && response.data) {
        const serverData = response.data;
        const updates: Partial<Server> = {
          name: serverData.server_name,
          description: serverData.description,
          enabled: serverData.is_enabled,
          tags: serverData.tags,
          status: serverData.health_status === 'healthy' ? 'healthy' :
                  serverData.health_status === 'healthy-auth-expired' ? 'healthy-auth-expired' :
                  serverData.health_status === 'unhealthy' ? 'unhealthy' : 'unknown',
          last_checked_time: serverData.last_checked_iso,
          num_tools: serverData.num_tools,
          proxy_pass_url: serverData.proxy_pass_url,
          mcp_endpoint: serverData.mcp_endpoint,
          version: serverData.version,
          versions: serverData.versions,
          default_version: serverData.default_version,
          mcp_server_version: serverData.mcp_server_version,
          mcp_server_version_previous: serverData.mcp_server_version_previous,
          mcp_server_version_updated_at: serverData.mcp_server_version_updated_at,
        };
        onServerUpdate(server.path, updates);
      }
    } catch (error) {
      console.error('Failed to refresh server data:', error);
    }
  }, [server.path, authToken, onServerUpdate]);

  const getSecurityIconState = () => {
    // Gray: no scan result yet
    if (!securityScanResult) {
      return { Icon: ShieldCheck, color: 'text-muted-foreground', title: 'View security scan results' };
    }
    // Red: scan failed or any vulnerabilities found
    if (securityScanResult.scan_failed) {
      return { Icon: ShieldAlert, color: 'text-red-500 dark:text-red-400', title: 'Security scan failed' };
    }
    const hasVulnerabilities = securityScanResult.critical_issues > 0 ||
      securityScanResult.high_severity > 0 ||
      securityScanResult.medium_severity > 0 ||
      securityScanResult.low_severity > 0;
    if (hasVulnerabilities) {
      return { Icon: ShieldAlert, color: 'text-red-500 dark:text-red-400', title: 'Security issues found' };
    }
    // Green: scan passed with no vulnerabilities
    return { Icon: ShieldCheck, color: 'text-green-500 dark:text-green-400', title: 'Security scan passed' };
  };

  // Generate MCP configuration for the server
  // Check if this is an Anthropic registry server
  const isAnthropicServer = server.tags?.includes('anthropic-registry');

  // Check if this server has security pending
  const isSecurityPending = server.tags?.includes('security-pending');

  // Check if this is a federated server from a peer registry using sync_metadata
  const isFederatedServer = server.sync_metadata?.is_federated === true;
  const peerRegistryId = isFederatedServer && server.sync_metadata?.source_peer_id
    ? server.sync_metadata.source_peer_id
    : null;

  // Check if this server is orphaned (no longer exists on peer registry)
  const isOrphanedServer = server.sync_metadata?.is_orphaned === true;

  return (
    <>
      <Card className={`group rounded-2xl shadow-xs hover:shadow-xl transition-all duration-300 h-full flex flex-col ${
        isAnthropicServer
          ? 'bg-primary/5 border-2 border-primary/20 dark:border-primary/20 hover:border-primary/30'
          : 'bg-card border border-border hover:border-border'
      }`}>
        {/* Render DeleteConfirmation inline when showDeleteConfirm is true */}
        {showDeleteConfirm ? (
          <div className="p-5 h-full flex flex-col justify-center">
            <DeleteConfirmation
              entityType="server"
              entityName={server.name || server.path.replace(/^\//, '')}
              entityPath={server.path}
              onConfirm={onDelete!}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          </div>
        ) : (
        <>
        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-bold text-foreground truncate">
                  {server.name}
                </h3>
                {server.lifecycle_status && (
                  <StatusBadge status={server.lifecycle_status} />
                )}
                {server.official && (
                  <Badge variant="secondary" className="bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary flex-shrink-0">
                    OFFICIAL
                  </Badge>
                )}
                {isAnthropicServer && (
                  <Badge variant="outline" className="bg-primary/5 text-primary flex-shrink-0 border-primary/20 dark:border-primary">
                    ANTHROPIC
                  </Badge>
                )}
                {/* Check if this is an ASOR server */}
                {server.tags?.includes('asor') && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground flex-shrink-0 border-border">
                    ASOR
                  </Badge>
                )}
                {isSecurityPending && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground flex-shrink-0 border-border">
                    SECURITY PENDING
                  </Badge>
                )}
                {/* Registry source badge - only show for federated (peer registry) items */}
                {isFederatedServer && (
                  <Badge variant="outline" className="bg-primary/5 text-primary flex-shrink-0 border-primary/20" title={`Synced from ${peerRegistryId}`}>
                    {peerRegistryId?.toUpperCase().replace('PEER-REGISTRY-', '').replace('PEER-', '')}
                  </Badge>
                )}
                {/* Orphaned badge - server no longer exists on peer registry */}
                {isOrphanedServer && (
                  <Badge variant="destructive" className="bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/30 dark:to-rose-900/30 dark:text-red-300 flex-shrink-0 border-red-200 dark:border-red-600" title="No longer exists on peer registry">
                    ORPHANED
                  </Badge>
                )}
                {/* Backend auth scheme badge */}
                {server.auth_scheme && server.auth_scheme !== 'none' && server.auth_scheme === 'bearer' && (
                  <Badge variant="outline" className="bg-primary/5 text-primary flex-shrink-0 border-primary/20 dark:border-primary/20" title="Backend uses Bearer token authentication">
                    BEARER AUTH
                  </Badge>
                )}
                {server.auth_scheme && server.auth_scheme === 'api_key' && (
                  <Badge variant="outline" className="bg-muted text-muted-foreground flex-shrink-0 border-border" title={`Backend uses API Key authentication (header: ${server.auth_header_name || 'X-API-Key'})`}>
                    API KEY AUTH
                  </Badge>
                )}
              </div>
              
              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                {server.path}
              </code>
            </div>

            {canModify && (
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-foreground flex-shrink-0"
                onClick={() => onEdit?.(server)}
                title="Edit server"
                aria-label={`Edit ${server.name}`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
            )}

            {/* Configuration Generator Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowConfig(true)}
              className="text-muted-foreground hover:text-primary flex-shrink-0"
              title="Copy mcp.json configuration"
              aria-label="Generate MCP configuration"
            >
              <Cog className="h-4 w-4" />
            </Button>

            {/* Security Scan Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleViewSecurityScan}
              className={`flex-shrink-0 ${getSecurityIconState().color}`}
              title={getSecurityIconState().title}
              aria-label="View security scan results"
            >
              {React.createElement(getSecurityIconState().Icon, { className: "h-4 w-4" })}
            </Button>

            {/* Delete Button */}
            {canDelete && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDeleteConfirm(true)}
                className="text-muted-foreground hover:text-destructive flex-shrink-0"
                title="Delete server"
                aria-label={`Delete ${server.name}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
            {server.description || 'No description available'}
          </p>

          {/* Tags */}
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {server.tags.slice(0, 3).map((tag) => (
                <Badge key={tag} variant="outline">
                  #{tag}
                </Badge>
              ))}
              {server.tags.length > 3 && (
                <Badge variant="secondary">
                  +{server.tags.length - 3}
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-3 gap-4">
            <StarRatingWidget
              resourceType="servers"
              path={server.path}
              initialRating={0}
              initialCount={server.rating_details?.length || 0}
              authToken={authToken}
              onShowToast={onShowToast}
            />
            <div className="flex items-center gap-2">
              {(server.num_tools || 0) > 0 ? (
                <button
                  onClick={handleViewTools}
                  disabled={loadingTools}
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground disabled:opacity-50 hover:bg-accent px-2 py-1 -mx-2 -my-1 rounded transition-all"
                  title="View tools"
                >
                  <div className="p-1.5 bg-muted rounded">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{server.num_tools}</div>
                    <div className="text-xs">Tools</div>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="p-1.5 bg-muted rounded">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{server.num_tools || 0}</div>
                    <div className="text-xs">Tools</div>
                  </div>
                </div>
              )}
            </div>
            {/* Version display - user routing version and/or MCP server version */}
            <div className="flex flex-col items-end gap-1">
              {server.versions && server.versions.length > 1 && (
                <VersionBadge
                  versions={server.versions}
                  defaultVersion={server.default_version || server.version}
                  onClick={() => setShowVersionSelector(true)}
                />
              )}
              {server.mcp_server_version && (
                <span
                  className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded"
                  title={
                    server.mcp_server_version_previous
                      ? `MCP Server Version: ${server.mcp_server_version} (previously ${server.mcp_server_version_previous})`
                      : `MCP Server Version: ${server.mcp_server_version}`
                  }
                >
                  <span className="text-muted-foreground mr-1">srv</span>
                  {server.mcp_server_version}
                  {server.mcp_server_version_updated_at &&
                    (Date.now() - new Date(server.mcp_server_version_updated_at).getTime()) < 24 * 60 * 60 * 1000 && (
                    <span className="ml-1 h-1.5 w-1.5 rounded-full bg-green-500 inline-block" title="Recently updated" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-border bg-muted/50 rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Status Indicators */}
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  server.enabled 
                    ? 'bg-green-400 shadow-lg shadow-green-400/30' 
                    : 'bg-muted-foreground'
                }`} />
                <span className="text-sm font-medium text-foreground">
                  {server.enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="w-px h-4 bg-border" />
              
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${
                  server.status === 'healthy' 
                    ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30'
                    : server.status === 'healthy-auth-expired'
                    ? 'bg-orange-400 shadow-lg shadow-orange-400/30'
                    : server.status === 'unhealthy'
                    ? 'bg-red-400 shadow-lg shadow-red-400/30'
                    : 'bg-amber-400 shadow-lg shadow-amber-400/30'
                }`} />
                <span className="text-sm font-medium text-foreground">
                  {server.status === 'healthy' ? 'Healthy' :
                   server.status === 'healthy-auth-expired' ? 'Healthy (Auth Expired)' :
                   server.status === 'unhealthy' ? 'Unhealthy' : 'Unknown'}
                </span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {/* Last Updated (source timestamp) */}
              {server.source_updated_at && (
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  <span title={new Date(server.source_updated_at).toLocaleString()}>
                    {formatRelativeTime(server.source_updated_at)}
                  </span>
                </div>
              )}

              {/* Last Checked */}
              {(() => {
                const timeText = formatTimeSince(server.last_checked_time);
                return server.last_checked_time && timeText && !server.source_updated_at ? (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    <span>{timeText}</span>
                  </div>
                ) : null;
              })()}

              {/* Refresh Button - only show if user has health_check_service permission */}
              {canHealthCheck && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRefreshHealth}
                  disabled={loadingRefresh}
                  className="text-muted-foreground hover:text-primary"
                  title="Refresh health status"
                  aria-label={`Refresh health status for ${server.name}`}
                >
                  <RefreshCw className={`h-4 w-4 ${loadingRefresh ? 'animate-spin' : ''}`} />
                </Button>
              )}

              {/* Toggle Switch - only show if user has toggle_service permission */}
              {canToggle && (
                <Switch
                  checked={server.enabled}
                  onCheckedChange={(checked) => onToggle(server.path, checked)}
                  aria-label={`Enable ${server.name}`}
                />
              )}
            </div>
          </div>
        </div>
        </>
        )}
      </Card>

      {/* Tools Modal */}
      {showTools && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
          onClick={() => {
            setShowTools(false);
            setExpandedDescriptions(new Set());
          }}
        >
          <div
            className="bg-card rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Tools for {server.name}
              </h3>
              <button
                onClick={() => {
                  setShowTools(false);
                  setExpandedDescriptions(new Set());
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>
            
            <div className="space-y-4">
              {tools.length > 0 ? (
                tools.map((tool, index) => {
                  const isExpanded = expandedDescriptions.has(index);
                  const toggleExpand = () => {
                    const newExpanded = new Set(expandedDescriptions);
                    if (isExpanded) {
                      newExpanded.delete(index);
                    } else {
                      newExpanded.add(index);
                    }
                    setExpandedDescriptions(newExpanded);
                  };

                  return (
                    <div key={index} className="border border-border rounded-lg p-4">
                      <h4 className="font-medium text-foreground mb-2">
                        {tool.name}
                      </h4>
                      {tool.description && (
                        <div className="mb-2">
                          <p className={`text-sm text-muted-foreground ${!isExpanded ? 'line-clamp-2' : ''}`}>
                            {tool.description}
                          </p>
                          {tool.description.length > 150 && (
                            <button
                              onClick={toggleExpand}
                              className="text-xs text-primary hover:underline mt-1"
                            >
                              {isExpanded ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      )}
                      {tool.schema && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">
                            View Schema
                          </summary>
                          <pre className="mt-2 p-3 bg-muted border border-border rounded overflow-x-auto text-foreground">
                            {JSON.stringify(tool.schema, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-muted-foreground">No tools available for this server.</p>
              )}
            </div>
          </div>
        </div>
      )}

      <ServerConfigModal
        server={server}
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onShowToast={onShowToast}
      />

      <SecurityScanModal
        resourceName={server.name}
        resourceType="server"
        isOpen={showSecurityScan}
        onClose={() => setShowSecurityScan(false)}
        loading={loadingSecurityScan}
        scanResult={securityScanResult}
        onRescan={canModify ? handleRescan : undefined}
        canRescan={canModify}
        onShowToast={onShowToast}
      />

      <VersionSelectorModal
        isOpen={showVersionSelector}
        onClose={() => setShowVersionSelector(false)}
        serverName={server.name}
        serverPath={server.path}
        versions={server.versions || []}
        defaultVersion={server.default_version || null}
        onVersionChange={(newDefaultVersion) => {
          if (onServerUpdate) {
            // Update both default_version and versions array to reflect the change
            const updatedVersions = server.versions?.map(v => ({
              ...v,
              is_default: v.version === newDefaultVersion
            }));
            onServerUpdate(server.path, {
              default_version: newDefaultVersion,
              versions: updatedVersions
            });
          }
        }}
        onRefreshServer={handleRefreshServerData}
        onShowToast={onShowToast}
        authToken={authToken}
        canModify={canModify}
      />

      <ServerDetailsModal
        server={server}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        fullDetails={server}
      />

    </>
  );
});

ServerCard.displayName = 'ServerCard';

export default ServerCard;
