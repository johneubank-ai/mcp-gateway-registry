import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  RefreshCw,
  MoreVertical,
  Pencil,
  Trash2,
  Play,
  AlertCircle,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  useFederationPeers,
  PeerRegistry,
  PeerWithStatus,
  deletePeer,
  syncPeer,
} from '../hooks/useFederationPeers';


/**
 * Props for the FederationPeers component.
 */
interface FederationPeersProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}


/**
 * Health status type for peers.
 */
type PeerHealthStatus = 'healthy' | 'warning' | 'error' | 'unknown';


/**
 * Get health status color classes.
 */
function getHealthColorClasses(health: PeerHealthStatus): string {
  switch (health) {
    case 'healthy':
      return 'bg-green-500';
    case 'warning':
      return 'bg-yellow-500';
    case 'error':
      return 'bg-red-500';
    default:
      return 'bg-muted-foreground';
  }
}


/**
 * Format last sync time for display.
 */
function formatLastSync(dateString: string | null | undefined): string {
  if (!dateString) return 'Never';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString();
}


/**
 * Props for PeerActionMenu component.
 */
interface PeerActionMenuProps {
  peer: PeerRegistry;
  isSyncing: boolean;
  onSync: () => void;
  onEdit: () => void;
  onDelete: () => void;
}


/**
 * PeerActionMenu renders the action dropdown for a peer row.
 * Uses shadcn DropdownMenu with portal for proper z-index handling.
 */
const PeerActionMenu: React.FC<PeerActionMenuProps> = ({
  peer,
  isSyncing,
  onSync,
  onEdit,
  onDelete,
}) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="p-2 rounded-lg hover:bg-accent"
        >
          <MoreVertical className="h-5 w-5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={onSync}
          disabled={isSyncing || !peer.enabled}
          className="flex items-center text-sm text-foreground cursor-pointer"
        >
          {isSyncing ? (
            <RefreshCw className="h-4 w-4 mr-3 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-3" />
          )}
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={onEdit}
          className="flex items-center text-sm text-foreground cursor-pointer"
        >
          <Pencil className="h-4 w-4 mr-3" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={onDelete}
          variant="destructive"
          className="flex items-center text-sm cursor-pointer"
        >
          <Trash2 className="h-4 w-4 mr-3" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};


/**
 * FederationPeers component displays a list of configured peer registries.
 *
 * Provides functionality to view, search, sync, and delete peers.
 */
const FederationPeers: React.FC<FederationPeersProps> = ({ onShowToast }) => {
  const navigate = useNavigate();
  const { peers, isLoading, error, refetch } = useFederationPeers();

  const [searchQuery, setSearchQuery] = useState('');
  const [syncingPeers, setSyncingPeers] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<PeerWithStatus | null>(null);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Auto-refresh every 30 seconds for sync status updates
  useEffect(() => {
    const interval = setInterval(refetch, 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  // Filter peers by search query
  const filteredPeers = useMemo(() => {
    if (!searchQuery) return peers;
    const query = searchQuery.toLowerCase();
    return peers.filter(
      (peer) =>
        peer.peer_id.toLowerCase().includes(query) ||
        peer.name.toLowerCase().includes(query) ||
        peer.endpoint.toLowerCase().includes(query)
    );
  }, [peers, searchQuery]);

  /**
   * Calculate health status for a peer based on sync status.
   */
  const getPeerHealth = (peer: PeerWithStatus): PeerHealthStatus => {
    if (!peer.enabled) return 'unknown';
    if (!peer.syncStatus) return 'unknown';
    if (peer.syncStatus.consecutive_failures > 2) return 'error';
    if (peer.syncStatus.consecutive_failures > 0) return 'warning';
    if (peer.syncStatus.is_healthy) return 'healthy';
    return 'unknown';
  };

  /**
   * Handle manual sync for a peer.
   */
  const handleSync = async (peer: PeerRegistry) => {
    setSyncingPeers((prev) => new Set(prev).add(peer.peer_id));
    try {
      const result = await syncPeer(peer.peer_id);
      if (result.success) {
        onShowToast(
          `Synced ${result.servers_synced} servers and ${result.agents_synced} agents from "${peer.name}"`,
          'success'
        );
      } else {
        onShowToast(
          result.error_message || `Sync failed for "${peer.name}"`,
          'error'
        );
      }
      await refetch();
    } catch (err: any) {
      onShowToast(
        err.response?.data?.detail || `Failed to sync "${peer.name}"`,
        'error'
      );
    } finally {
      setSyncingPeers((prev) => {
        const next = new Set(prev);
        next.delete(peer.peer_id);
        return next;
      });
    }
  };

  /**
   * Handle peer deletion.
   */
  const handleDelete = async () => {
    if (!deleteTarget || typedName !== deleteTarget.name) return;

    setIsDeleting(true);
    try {
      await deletePeer(deleteTarget.peer_id);
      onShowToast(`Peer "${deleteTarget.name}" has been deleted`, 'success');
      setDeleteTarget(null);
      setTypedName('');
      await refetch();
    } catch (err: any) {
      onShowToast(
        err.response?.data?.detail || `Failed to delete peer`,
        'error'
      );
    } finally {
      setIsDeleting(false);
    }
  };

  /**
   * Get sync mode display text.
   */
  const getSyncModeLabel = (peer: PeerRegistry): string => {
    switch (peer.sync_mode) {
      case 'all':
        return 'All Public';
      case 'whitelist':
        return 'Whitelist';
      case 'tag_filter':
        return `Tags: ${peer.tag_filters?.join(', ') || 'None'}`;
      default:
        return peer.sync_mode;
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="h-10 w-64 bg-muted rounded animate-pulse" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-16 bg-muted rounded animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Failed to Load Peers
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button
          onClick={refetch}
          className="bg-primary text-white hover:bg-primary/90"
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Federation Peers
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage peer registries for cross-registry synchronization
          </p>
        </div>
        <Button
          onClick={() => navigate('/settings/federation/peers/add')}
          className="flex items-center bg-primary text-white hover:bg-primary/90"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Peer
        </Button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search peers..."
          className="w-full pl-10 pr-4 py-2"
        />
      </div>

      {/* Peers table */}
      {filteredPeers.length === 0 ? (
        <div className="text-center py-12 bg-muted rounded-lg">
          <svg
            className="h-12 w-12 mx-auto text-muted-foreground mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
            />
          </svg>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'No matching peers' : 'No peers configured'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try a different search term'
              : 'Add a peer registry to enable federation'}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => navigate('/settings/federation/peers/add')}
              className="bg-primary text-white hover:bg-primary/90"
            >
              Add First Peer
            </Button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-border">
            <thead className="bg-muted">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Endpoint
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Sync Mode
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Interval
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Last Sync
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredPeers.map((peer) => {
                const health = getPeerHealth(peer);
                const isSyncing = syncingPeers.has(peer.peer_id);

                return (
                  <tr key={peer.peer_id} className="hover:bg-accent">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-foreground">
                          {peer.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {peer.peer_id}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span
                        className="text-sm text-muted-foreground truncate block max-w-[200px]"
                        title={peer.endpoint}
                      >
                        {peer.endpoint}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <span
                          className={`h-2 w-2 rounded-full ${getHealthColorClasses(health)}`}
                        />
                        <span className="text-sm text-muted-foreground capitalize">
                          {peer.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-muted text-foreground">
                        {getSyncModeLabel(peer)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {peer.sync_interval_minutes}m
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      <span title={peer.syncStatus?.last_successful_sync || 'Never synced'}>
                        {formatLastSync(peer.syncStatus?.last_successful_sync)}
                      </span>
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-right">
                      <PeerActionMenu
                        peer={peer}
                        isSyncing={isSyncing}
                        onSync={() => handleSync(peer)}
                        onEdit={() => navigate(`/settings/federation/peers/${peer.peer_id}/edit`)}
                        onDelete={() => setDeleteTarget(peer)}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete confirmation modal */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null);
            setTypedName('');
          }
        }}
      >
        <DialogContent className="sm:max-w-md bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold text-foreground">
              Delete Peer
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            This action is irreversible. All servers and agents synced from this
            peer will be removed.
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Type <strong>{deleteTarget?.name}</strong> to confirm:
          </p>
          <Input
            type="text"
            value={typedName}
            onChange={(e) => setTypedName(e.target.value)}
            placeholder={deleteTarget?.name}
            disabled={isDeleting}
            className="w-full mb-4"
          />
          <div className="flex justify-end space-x-3">
            <Button
              variant="secondary"
              onClick={() => {
                setDeleteTarget(null);
                setTypedName('');
              }}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={typedName !== deleteTarget?.name || isDeleting}
              className="flex items-center"
            >
              {isDeleting && <RefreshCw className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FederationPeers;
