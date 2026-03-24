import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Plus,
  Search,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import {
  useVirtualServers,
  useVirtualServer,
} from '../hooks/useVirtualServers';
import {
  VirtualServerInfo,
  CreateVirtualServerRequest,
  UpdateVirtualServerRequest,
} from '../types/virtualServer';
import VirtualServerForm from './VirtualServerForm';
import useEscapeKey from '../hooks/useEscapeKey';


/**
 * Props for VirtualServerList component.
 */
interface VirtualServerListProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}


/**
 * VirtualServerList displays a table of all virtual MCP servers
 * with search, create, edit, delete, and toggle functionality.
 */
const VirtualServerList: React.FC<VirtualServerListProps> = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    virtualServers,
    loading,
    error,
    refreshData,
    createVirtualServer,
    updateVirtualServer,
    deleteVirtualServer,
    toggleVirtualServer,
  } = useVirtualServers();

  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingPath, setEditingPath] = useState<string | undefined>(undefined);
  const [deleteTarget, setDeleteTarget] = useState<VirtualServerInfo | null>(null);
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  useEscapeKey(() => { setShowForm(false); setEditingPath(undefined); }, showForm);
  useEscapeKey(() => { setDeleteTarget(null); setTypedName(''); }, !!deleteTarget);

  const canModify = user?.can_modify_servers || user?.is_admin || false;

  // Fetch full config when editing
  const { virtualServer: editingServer, loading: editingServerLoading } = useVirtualServer(editingPath);

  // Handle ?edit=<path> query parameter from Dashboard navigation
  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam && !loading && virtualServers.length > 0) {
      const decodedPath = decodeURIComponent(editParam);
      const serverExists = virtualServers.some((s) => s.path === decodedPath);
      if (serverExists) {
        setEditingPath(decodedPath);
        setShowForm(true);
      }
      // Clear the query param so it doesn't re-trigger
      searchParams.delete('edit');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, loading, virtualServers]);

  // Filter servers by search
  const filteredServers = searchQuery
    ? virtualServers.filter(
        (s) =>
          s.server_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.path.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.tags?.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : virtualServers;

  const handleCreate = () => {
    setEditingPath(undefined);
    setShowForm(true);
  };

  const handleEdit = (server: VirtualServerInfo) => {
    setEditingPath(server.path);
    setShowForm(true);
  };

  const handleSave = async (
    data: CreateVirtualServerRequest | UpdateVirtualServerRequest,
  ) => {
    try {
      if (editingPath) {
        await updateVirtualServer(editingPath, data as UpdateVirtualServerRequest);
        toast.success('Virtual server updated successfully');
      } else {
        await createVirtualServer(data as CreateVirtualServerRequest);
        toast.success('Virtual server created successfully');
      }
      setShowForm(false);
      setEditingPath(undefined);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'An unexpected error occurred';
      toast.error(`Failed to save virtual server: ${message}`);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget || typedName !== deleteTarget.server_name) return;

    setIsDeleting(true);
    try {
      await deleteVirtualServer(deleteTarget.path);
      toast.success(`Virtual server "${deleteTarget.server_name}" deleted`);
      setDeleteTarget(null);
      setTypedName('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { detail?: string } }; message?: string };
      toast.error(
        axiosErr.response?.data?.detail || 'Failed to delete virtual server',
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggle = async (path: string, enabled: boolean) => {
    try {
      await toggleVirtualServer(path, enabled);
      toast.success(
        `Virtual server ${enabled ? 'enabled' : 'disabled'}`,
      );
    } catch {
      toast.error('Failed to toggle virtual server');
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-muted rounded animate-pulse" />
          <div className="h-10 w-40 bg-muted rounded animate-pulse" />
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
          Failed to Load Virtual Servers
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button
          onClick={refreshData}
          className="bg-primary hover:bg-primary/90 text-white"
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
            Virtual MCP Servers
          </h2>
          <p className="text-sm text-muted-foreground">
            Manage virtual servers that aggregate tools from multiple backends
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={refreshData}
            title="Refresh"
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
          {canModify && (
            <Button
              onClick={handleCreate}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Virtual Server
            </Button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search virtual servers..."
          className="pl-10"
        />
      </div>

      {/* Table */}
      {filteredServers.length === 0 ? (
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
              d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2"
            />
          </svg>
          <h3 className="text-lg font-medium text-foreground mb-2">
            {searchQuery ? 'No matching virtual servers' : 'No virtual servers configured'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery
              ? 'Try a different search term'
              : 'Create a virtual server to aggregate tools from multiple backends'}
          </p>
          {!searchQuery && canModify && (
            <Button
              onClick={handleCreate}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              Create First Virtual Server
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
                  Path
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Tools
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Backends
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-card divide-y divide-border">
              {filteredServers.map((server) => (
                <tr
                  key={server.path}
                  className="hover:bg-accent"
                >
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-foreground">
                        {server.server_name}
                      </span>
                      {server.description && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          {server.description}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <code className="text-sm text-muted-foreground font-mono">
                      {server.path}
                    </code>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-muted-foreground">
                    {server.tool_count}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex flex-wrap gap-1">
                      {server.backend_paths.slice(0, 2).map((bp) => (
                        <Badge
                          key={bp}
                          variant="outline"
                          className="font-mono text-xs"
                        >
                          {bp}
                        </Badge>
                      ))}
                      {server.backend_paths.length > 2 && (
                        <Badge variant="outline" className="text-xs">
                          +{server.backend_paths.length - 2}
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap">
                    <Badge
                      variant="outline"
                      className={
                        server.is_enabled
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-foreground'
                      }
                    >
                      {server.is_enabled ? 'Enabled' : 'Disabled'}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      {canModify && (
                        <>
                          <Switch
                            checked={server.is_enabled}
                            onCheckedChange={(checked) =>
                              handleToggle(server.path, checked)
                            }
                            aria-label={`Enable ${server.server_name}`}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(server)}
                            className="text-xs text-primary"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(server)}
                            className="text-xs"
                          >
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form modal */}
      {showForm && editingPath && editingServerLoading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card rounded-lg shadow-xl p-8 flex flex-col items-center">
            <RefreshCw className="h-8 w-8 text-primary animate-spin mb-3" />
            <p className="text-sm text-muted-foreground">Loading server data...</p>
          </div>
        </div>
      )}
      {showForm && (!editingPath || (editingPath && !editingServerLoading)) && (
        <VirtualServerForm
          virtualServer={editingPath ? editingServer : null}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditingPath(undefined);
          }}
        />
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          role="dialog"
          aria-modal="true"
          aria-label="Delete virtual server confirmation"
        >
          <div className="bg-card rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-semibold text-foreground mb-2">
              Delete Virtual Server
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              This action is irreversible. The virtual server and all its tool
              mappings will be permanently removed.
            </p>
            <p className="text-sm text-muted-foreground mb-3">
              Type <strong>{deleteTarget.server_name}</strong> to confirm:
            </p>
            <Input
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={deleteTarget.server_name}
              disabled={isDeleting}
              className="mb-4"
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  setDeleteTarget(null);
                  setTypedName('');
                }
              }}
              autoFocus
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
                disabled={typedName !== deleteTarget.server_name || isDeleting}
              >
                {isDeleting && (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                )}
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VirtualServerList;
