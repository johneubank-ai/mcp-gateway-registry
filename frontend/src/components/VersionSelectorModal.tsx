import React, { useState } from 'react';
import axios from 'axios';
import {
  CheckCircle,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';


interface ServerVersion {
  version: string;
  proxy_pass_url: string;
  status: string;
  is_default: boolean;
  released?: string;
  sunset_date?: string;
  description?: string;
}


interface VersionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  serverName: string;
  serverPath: string;
  versions: ServerVersion[];
  defaultVersion: string | null;
  onVersionChange?: (newDefaultVersion: string) => void;
  onRefreshServer?: () => void;
  onShowToast?: (message: string, type: 'success' | 'error') => void;
  authToken?: string | null;
  canModify?: boolean;
}


/**
 * VersionSelectorModal displays all versions of a server and allows
 * administrators to switch the default version.
 */
const VersionSelectorModal: React.FC<VersionSelectorModalProps> = ({
  isOpen,
  onClose,
  serverName,
  serverPath,
  versions,
  defaultVersion,
  onVersionChange,
  onRefreshServer,
  onShowToast,
  authToken,
  canModify = false,
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handleSetDefault = async (version: string) => {
    if (loading || version === defaultVersion) {
      return;
    }

    setLoading(version);
    try {
      const headers = authToken ? { Authorization: `Bearer ${authToken}` } : undefined;
      await axios.put(
        `/api/servers${serverPath}/versions/default`,
        { version },
        headers ? { headers } : undefined
      );

      if (onVersionChange) {
        onVersionChange(version);
      }

      if (onShowToast) {
        onShowToast(`Switched to ${version}`, 'success');
      }

      // Trigger a server refresh to get updated data
      if (onRefreshServer) {
        onRefreshServer();
      }

      onClose();
    } catch (error: any) {
      console.error('Failed to set default version:', error);
      if (onShowToast) {
        onShowToast(
          error.response?.data?.detail || 'Failed to switch version',
          'error'
        );
      }
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string, isDefault: boolean) => {
    if (isDefault) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-semibold bg-primary/10 text-primary rounded-full">
          <CheckCircle className="h-3 w-3" />
          ACTIVE
        </span>
      );
    }

    switch (status) {
      case 'deprecated':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
            <AlertTriangle className="h-3 w-3" />
            deprecated
          </span>
        );
      case 'beta':
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary dark:text-primary rounded-full">
            beta
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 text-xs font-medium bg-muted text-muted-foreground rounded-full">
            stable
          </span>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-auto bg-card p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            Select Version
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {serverName}
          </p>
        </DialogHeader>

        {/* Version Cards */}
        <div className="space-y-3">
          {versions.map((version) => {
            const isCurrentDefault = version.version === defaultVersion || version.is_default;
            const isLoading = loading === version.version;

            return (
              <div
                key={version.version}
                className={`
                  border rounded-lg p-4 transition-all
                  ${isCurrentDefault
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-border hover:border-border/80'
                  }
                `}
              >
                {/* Version Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      {version.version}
                    </span>
                    {getStatusBadge(version.status, isCurrentDefault)}
                  </div>

                  {canModify && !isCurrentDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(version.version)}
                      disabled={isLoading}
                      className="text-primary hover:text-primary hover:bg-primary/10 dark:text-primary dark:hover:text-primary dark:hover:bg-primary/10"
                    >
                      {isLoading ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        'Set Active'
                      )}
                    </Button>
                  )}
                </div>

                {/* Version Details */}
                <div className="space-y-1 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-medium">Backend:</span>{' '}
                    <code className="text-xs bg-muted px-1 py-0.5 rounded">
                      {version.proxy_pass_url}
                    </code>
                  </div>

                  {version.released && (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Released:</span> {version.released}
                    </div>
                  )}

                  {version.sunset_date && (
                    <div className="text-muted-foreground">
                      <span className="font-medium">Sunset:</span> {version.sunset_date}
                    </div>
                  )}

                  {version.description && (
                    <div className="text-muted-foreground mt-2">
                      {version.description}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Info Footer */}
        <div className="mt-6 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            Clients can request specific versions using the{' '}
            <code className="bg-muted px-1 py-0.5 rounded">
              X-MCP-Server-Version
            </code>{' '}
            header.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default VersionSelectorModal;
