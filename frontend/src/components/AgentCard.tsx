import React, { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import {
  Cpu,
  RefreshCw,
  Pencil,
  Clock,
  CheckCircle,
  XCircle,
  HelpCircle,
  ShieldCheck,
  ShieldAlert,
  Globe,
  Lock,
  Info,
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import AgentDetailsModal from './AgentDetailsModal';
import SecurityScanModal from './SecurityScanModal';
import StarRatingWidget from './StarRatingWidget';
import DeleteConfirmation from './DeleteConfirmation';
import StatusBadge from './StatusBadge';
import { formatRelativeTime } from '../utils/dateUtils';

interface SyncMetadata {
  is_federated?: boolean;
  source_peer_id?: string;
  upstream_path?: string;
  last_synced_at?: string;
  is_read_only?: boolean;
  is_orphaned?: boolean;
  orphaned_at?: string;
}

/**
 * Agent interface representing an A2A agent.
 */
export interface Agent {
  name: string;
  path: string;
  url?: string;
  description?: string;
  version?: string;
  visibility?: 'public' | 'private' | 'group-restricted';
  trust_level?: 'community' | 'verified' | 'trusted' | 'unverified';
  enabled: boolean;
  tags?: string[];
  last_checked_time?: string;
  usersCount?: number;
  rating?: number;
  rating_details?: Array<{ user: string; rating: number }>;
  status?: 'healthy' | 'healthy-auth-expired' | 'unhealthy' | 'unknown';
  // Federation sync metadata
  sync_metadata?: SyncMetadata;
  // Lifecycle status
  lifecycle_status?: 'active' | 'deprecated' | 'draft' | 'beta';
  source_created_at?: string;
  source_updated_at?: string;
}

/**
 * Props for the AgentCard component.
 */
interface AgentCardProps {
  agent: Agent & { [key: string]: any };  // Allow additional fields from full agent JSON
  onToggle: (path: string, enabled: boolean) => void;
  onEdit?: (agent: Agent) => void;
  canModify?: boolean;
  canHealthCheck?: boolean;  // Whether user can run health check on this agent
  canToggle?: boolean;       // Whether user can enable/disable this agent
  canDelete?: boolean;       // Whether user can delete this agent
  onDelete?: (path: string) => Promise<void>;  // Callback to delete the agent
  onRefreshSuccess?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  onAgentUpdate?: (path: string, updates: Partial<Agent>) => void;
  authToken?: string | null;
}

/**
 * Helper function to format time since last checked.
 */
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

const normalizeHealthStatus = (status?: string | null): Agent['status'] => {
  if (status === 'healthy' || status === 'healthy-auth-expired') {
    return status;
  }
  if (status === 'unhealthy') {
    return 'unhealthy';
  }
  return 'unknown';
};

/**
 * AgentCard component for displaying A2A agents.
 *
 * Displays agent information with a distinct visual style from MCP servers,
 * using blue/cyan tones and robot-themed icons.
 */
const AgentCard: React.FC<AgentCardProps> = React.memo(({
  agent,
  onToggle,
  onEdit,
  canModify,
  canHealthCheck = true,
  canToggle = true,
  canDelete,
  onDelete,
  onRefreshSuccess,
  onShowToast,
  onAgentUpdate,
  authToken
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [fullAgentDetails, setFullAgentDetails] = useState<any>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showSecurityScan, setShowSecurityScan] = useState(false);
  const [securityScanResult, setSecurityScanResult] = useState<any>(null);
  const [loadingSecurityScan, setLoadingSecurityScan] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Check if this is a federated agent from a peer registry using sync_metadata
  const isFederatedAgent = agent.sync_metadata?.is_federated === true;
  const peerRegistryId = isFederatedAgent && agent.sync_metadata?.source_peer_id
    ? agent.sync_metadata.source_peer_id
    : null;

  // Check if this agent is orphaned (no longer exists on peer registry)
  const isOrphanedAgent = agent.sync_metadata?.is_orphaned === true;

  // Fetch security scan status on mount to show correct icon color
  useEffect(() => {
    const fetchSecurityScan = async () => {
      try {
        const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
        const response = await axios.get(
          `/api/agents${agent.path}/security-scan`,
          headers ? { headers } : undefined
        );
        setSecurityScanResult(response.data);
      } catch {
        // Silently ignore - no scan result available
      }
    };
    fetchSecurityScan();
  }, [agent.path, authToken]);

  const getStatusIcon = () => {
    switch (agent.status) {
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

  const getTrustLevelColor = () => {
    switch (agent.trust_level) {
      case 'trusted':
        return 'bg-primary/10 text-primary border border-primary/20';
      case 'verified':
        return 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20';
      case 'community':
      default:
        return 'bg-muted text-foreground border border-border';
    }
  };

  const getTrustLevelIcon = () => {
    switch (agent.trust_level) {
      case 'trusted':
        return <ShieldCheck className="h-3 w-3" />;
      case 'verified':
        return <CheckCircle className="h-3 w-3" />;
      default:
        return null;
    }
  };

  const getVisibilityIcon = () => {
    return agent.visibility === 'public' ? (
      <Globe className="h-3 w-3" />
    ) : (
      <Lock className="h-3 w-3" />
    );
  };

  const handleRefreshHealth = useCallback(async () => {
    if (loadingRefresh) return;

    setLoadingRefresh(true);
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await axios.post(
        `/api/agents${agent.path}/health`,
        undefined,
        headers ? { headers } : undefined
      );

      // Update just this agent instead of triggering global refresh
      if (onAgentUpdate && response.data) {
        const updates: Partial<Agent> = {
          status: normalizeHealthStatus(response.data.status),
          last_checked_time: response.data.last_checked_iso
        };

        onAgentUpdate(agent.path, updates);
      } else if (onRefreshSuccess) {
        // Fallback to global refresh if onAgentUpdate is not provided
        onRefreshSuccess();
      }

      toast.success('Agent health status refreshed successfully');
    } catch (error: any) {
      console.error('Failed to refresh agent health:', error);
      toast.error(error.response?.data?.detail || 'Failed to refresh agent health status');
    } finally {
      setLoadingRefresh(false);
    }
  }, [agent.path, authToken, loadingRefresh, onRefreshSuccess, onAgentUpdate]);

  const handleCopyDetails = useCallback(
    async (data: any) => {
      try {
        await navigator.clipboard.writeText(JSON.stringify(data, null, 2));
        toast.success('Full agent JSON copied to clipboard!');
      } catch (error) {
        console.error('Failed to copy JSON:', error);
        toast.error('Failed to copy JSON');
      }
    },
    []
  );

  const handleViewSecurityScan = useCallback(async () => {
    if (loadingSecurityScan) return;

    setShowSecurityScan(true);
    setLoadingSecurityScan(true);
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      const response = await axios.get(
        `/api/agents${agent.path}/security-scan`,
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
  }, [agent.path, authToken, loadingSecurityScan]);

  const handleRescan = useCallback(async () => {
    const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
    const response = await axios.post(
      `/api/agents${agent.path}/rescan`,
      undefined,
      headers ? { headers } : undefined
    );
    setSecurityScanResult(response.data);
  }, [agent.path, authToken]);

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

  return (
    <>
      <Card className="group rounded-2xl shadow-xs hover:shadow-xl transition-all duration-300 h-full flex flex-col bg-primary/5 border-2 border-primary/20 hover:border-primary/30">
        {showDeleteConfirm ? (
          /* Delete Confirmation - replaces card content when active */
          <div className="p-5 h-full flex flex-col justify-center">
            <DeleteConfirmation
              entityType="agent"
              entityName={agent.name || agent.path.replace(/^\//, '')}
              entityPath={agent.path}
              onConfirm={onDelete!}
              onCancel={() => setShowDeleteConfirm(false)}
            />
          </div>
        ) : (
          /* Normal card content */
          <>
            {/* Header */}
            <div className="p-5 pb-4">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-3">
                    <h3 className="text-lg font-bold text-foreground truncate">
                      {agent.name}
                    </h3>
                    {agent.lifecycle_status && (
                      <StatusBadge status={agent.lifecycle_status} />
                    )}
                    <Badge variant="outline" className="bg-primary/5 text-primary flex-shrink-0 border-primary/20">
                      AGENT
                    </Badge>
                    {/* Check if this is an ASOR agent */}
                    {(agent.tags?.includes('asor') || (agent as any).provider === 'ASOR') && (
                      <Badge variant="outline" className="bg-muted text-muted-foreground flex-shrink-0 border-border">
                        ASOR
                      </Badge>
                    )}
                    {agent.trust_level && (
                      <Badge variant="outline" className={`flex-shrink-0 flex items-center gap-1 ${getTrustLevelColor()}`}>
                        {getTrustLevelIcon()}
                        {agent.trust_level.toUpperCase()}
                      </Badge>
                    )}
                    {agent.visibility && (
                      <Badge variant="outline" className={`flex-shrink-0 flex items-center gap-1 ${
                        agent.visibility === 'public'
                          ? 'bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border-primary/20'
                          : 'bg-muted text-foreground border-border'
                      }`}>
                        {getVisibilityIcon()}
                        {agent.visibility.toUpperCase()}
                      </Badge>
                    )}
                    {/* Registry source badge - only show for federated (peer registry) items */}
                    {isFederatedAgent && (
                      <Badge variant="outline" className="bg-primary/5 text-primary flex-shrink-0 border-primary/20" title={`Synced from ${peerRegistryId}`}>
                        {peerRegistryId?.toUpperCase().replace('PEER-REGISTRY-', '').replace('PEER-', '')}
                      </Badge>
                    )}
                    {/* Orphaned badge - agent no longer exists on peer registry */}
                    {isOrphanedAgent && (
                      <Badge variant="destructive" className="bg-gradient-to-r from-red-100 to-rose-100 text-red-700 dark:from-red-900/30 dark:to-rose-900/30 dark:text-red-300 flex-shrink-0 border-red-200 dark:border-red-600" title="No longer exists on peer registry">
                        ORPHANED
                      </Badge>
                    )}
                  </div>

                  <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                    {agent.path}
                  </code>
                  {agent.version && (
                    <span className="ml-2 text-xs text-muted-foreground">
                      v{agent.version}
                    </span>
                  )}
                  {agent.url && (
                    <a
                      href={agent.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary break-all hover:underline"
                    >
                      <span className="font-mono">{agent.url}</span>
                    </a>
                  )}
                </div>

                {canModify && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-foreground flex-shrink-0"
                    onClick={() => onEdit?.(agent)}
                    title="Edit agent"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}

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

                {/* Full Details Button */}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={async () => {
                    setShowDetails(true);
                    setLoadingDetails(true);
                    try {
                      const response = await axios.get(`/api/agents${agent.path}`);
                      setFullAgentDetails(response.data);
                    } catch (error) {
                      console.error('Failed to fetch agent details:', error);
                      toast.error('Failed to load full agent details');
                    } finally {
                      setLoadingDetails(false);
                    }
                  }}
                  className="text-muted-foreground hover:text-primary flex-shrink-0"
                  title="View full agent details (JSON)"
                >
                  <Info className="h-4 w-4" />
                </Button>

                {/* Delete Button */}
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowDeleteConfirm(true)}
                    className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    title="Delete agent"
                    aria-label={`Delete ${agent.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>

              {/* Description */}
              <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
                {agent.description || 'No description available'}
              </p>

              {/* Tags */}
              {agent.tags && agent.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {agent.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded"
                    >
                      #{tag}
                    </span>
                  ))}
                  {agent.tags.length > 3 && (
                    <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded">
                      +{agent.tags.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Stats */}
            <div className="px-5 pb-4">
              <div className="grid grid-cols-2 gap-4">
                <StarRatingWidget
                  resourceType="agents"
                  path={agent.path}
                  initialRating={agent.rating || 0}
                  initialCount={agent.rating_details?.length || 0}
                  authToken={authToken}
                  onShowToast={onShowToast}
                  onRatingUpdate={(newRating) => {
                    // Update local agent rating when user submits rating
                    if (onAgentUpdate) {
                      onAgentUpdate(agent.path, { rating: newRating });
                    }
                  }}
                />
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-primary/10 rounded">
                    <Cpu className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-foreground">{agent.usersCount || 0}</div>
                    <div className="text-xs text-muted-foreground">Users</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="mt-auto px-5 py-4 border-t border-border bg-muted rounded-b-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {/* Status Indicators */}
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      agent.enabled
                        ? 'bg-green-400 shadow-lg shadow-green-400/30'
                        : 'bg-muted-foreground'
                    }`} />
                    <span className="text-sm font-medium text-foreground">
                      {agent.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>

                  <div className="w-px h-4 bg-border" />

                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${
                      agent.status === 'healthy'
                        ? 'bg-emerald-400 shadow-lg shadow-emerald-400/30'
                        : agent.status === 'healthy-auth-expired'
                        ? 'bg-orange-400 shadow-lg shadow-orange-400/30'
                        : agent.status === 'unhealthy'
                        ? 'bg-red-400 shadow-lg shadow-red-400/30'
                        : 'bg-amber-400 shadow-lg shadow-amber-400/30'
                    }`} />
                    <span className="text-sm font-medium text-foreground">
                      {agent.status === 'healthy' ? 'Healthy' :
                       agent.status === 'healthy-auth-expired' ? 'Healthy (Auth Expired)' :
                       agent.status === 'unhealthy' ? 'Unhealthy' : 'Unknown'}
                    </span>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-3">
                  {/* Last Updated (source timestamp) */}
                  {agent.source_updated_at && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      <span title={new Date(agent.source_updated_at).toLocaleString()}>
                        {formatRelativeTime(agent.source_updated_at)}
                      </span>
                    </div>
                  )}

                  {/* Last Checked */}
                  {(() => {
                    const timeText = formatTimeSince(agent.last_checked_time);
                    return agent.last_checked_time && timeText && !agent.source_updated_at ? (
                      <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{timeText}</span>
                      </div>
                    ) : null;
                  })()}

                  {/* Refresh Button - only show if user has health_check_agent permission */}
                  {canHealthCheck && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleRefreshHealth}
                      disabled={loadingRefresh}
                      className="text-muted-foreground hover:text-primary"
                      title="Refresh agent health status"
                    >
                      <RefreshCw className={`h-4 w-4 ${loadingRefresh ? 'animate-spin' : ''}`} />
                    </Button>
                  )}

                  {/* Toggle Switch - only show if user has toggle_agent permission */}
                  {canToggle && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={agent.enabled}
                        onCheckedChange={(checked) => onToggle(agent.path, checked)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <AgentDetailsModal
        agent={agent}
        isOpen={showDetails}
        onClose={() => setShowDetails(false)}
        loading={loadingDetails}
        fullDetails={fullAgentDetails}
        onCopy={handleCopyDetails}
      />

      <SecurityScanModal
        resourceName={agent.name}
        resourceType="agent"
        isOpen={showSecurityScan}
        onClose={() => setShowSecurityScan(false)}
        loading={loadingSecurityScan}
        scanResult={securityScanResult}
        onRescan={canModify ? handleRescan : undefined}
        canRescan={canModify}
        onShowToast={onShowToast}
      />

    </>
  );
});

AgentCard.displayName = 'AgentCard';

export default AgentCard;
