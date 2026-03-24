import React, { useState, useEffect, useMemo } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { VirtualServerInfo, VirtualServerConfig, ToolMapping } from '../types/virtualServer';
import axios from 'axios';


interface VirtualServerDetailsModalProps {
  virtualServer: VirtualServerInfo;
  isOpen: boolean;
  onClose: () => void;
}


const VirtualServerDetailsModal: React.FC<VirtualServerDetailsModalProps> = ({
  virtualServer,
  isOpen,
  onClose
}) => {
  const [fullConfig, setFullConfig] = useState<VirtualServerConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedBackends, setExpandedBackends] = useState<Record<string, boolean>>({});

  // Fetch full config when modal opens
  useEffect(() => {
    if (!isOpen || !virtualServer?.path) {
      setFullConfig(null);
      return;
    }

    const fetchConfig = async () => {
      setLoading(true);
      try {
        const response = await axios.get<VirtualServerConfig>(
          `/api/virtual-servers${virtualServer.path}`
        );
        setFullConfig(response.data);
        // Auto-expand first backend
        if (response.data.tool_mappings?.length > 0) {
          const firstBackend = response.data.tool_mappings[0].backend_server_path;
          setExpandedBackends({ [firstBackend]: true });
        }
      } catch (err) {
        console.error('Failed to fetch virtual server config:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, [isOpen, virtualServer?.path]);

  // Group tools by backend server
  const toolsByBackend = useMemo(() => {
    const tools = fullConfig?.tool_mappings || virtualServer.tool_mappings || [];
    const grouped: Record<string, ToolMapping[]> = {};

    for (const tool of tools) {
      const backend = tool.backend_server_path;
      if (!grouped[backend]) {
        grouped[backend] = [];
      }
      grouped[backend].push(tool);
    }

    return grouped;
  }, [fullConfig, virtualServer.tool_mappings]);

  const toggleBackend = (backend: string) => {
    setExpandedBackends(prev => ({
      ...prev,
      [backend]: !prev[backend]
    }));
  };

  const backendPaths = virtualServer.backend_paths || [];
  const hasToolDetails = Object.keys(toolsByBackend).length > 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] flex flex-col bg-card p-0">
        <DialogHeader className="p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <DialogTitle className="text-lg font-semibold text-foreground">
              {virtualServer.server_name}
            </DialogTitle>
            <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] font-semibold">
              VIRTUAL
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">{virtualServer.path}</p>
        </DialogHeader>
        <div className="p-4 overflow-auto flex-1 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Description
            </p>
            <p className="text-sm text-foreground">
              {virtualServer.description || 'No description available.'}
            </p>
          </div>

          {/* Tags */}
          {virtualServer.tags && virtualServer.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {virtualServer.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Backend Servers with Tools */}
          {backendPaths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Backend Servers ({backendPaths.length}) - Tools ({virtualServer.tool_count})
              </p>
              {loading ? (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  <span className="ml-2 text-sm text-muted-foreground">Loading tool details...</span>
                </div>
              ) : (
                <ul className="space-y-2">
                  {backendPaths.map((path) => {
                    const backendTools = toolsByBackend[path] || [];
                    const isExpanded = expandedBackends[path];
                    const toolCount = backendTools.length;

                    return (
                      <li key={path} className="border border-border rounded-lg overflow-hidden">
                        <button
                          onClick={() => toggleBackend(path)}
                          className="w-full flex items-center justify-between px-3 py-2 bg-muted hover:bg-accent transition-colors text-left"
                        >
                          <div className="flex items-center gap-2">
                            {hasToolDetails ? (
                              isExpanded ? (
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              )
                            ) : (
                              <div className="w-4" />
                            )}
                            <span className="text-sm font-mono text-foreground">
                              {path}
                            </span>
                          </div>
                          {hasToolDetails && (
                            <span className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                              {toolCount} tool{toolCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </button>

                        {/* Expanded tools list */}
                        {isExpanded && backendTools.length > 0 && (
                          <ul className="border-t border-border divide-y divide-border">
                            {backendTools.map((tool) => (
                              <li
                                key={tool.alias || tool.tool_name}
                                className="px-4 py-3 bg-card"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <span className="font-medium text-sm text-foreground">
                                      {tool.alias || tool.tool_name}
                                    </span>
                                    {tool.alias && tool.alias !== tool.tool_name && (
                                      <span className="ml-2 text-xs text-muted-foreground">
                                        (original: {tool.tool_name})
                                      </span>
                                    )}
                                  </div>
                                  {tool.backend_version && (
                                    <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-mono">
                                      v{tool.backend_version}
                                    </span>
                                  )}
                                </div>
                                {tool.description_override && (
                                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                                    {tool.description_override}
                                  </p>
                                )}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Status
            </p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                virtualServer.is_enabled
                  ? 'bg-green-400 shadow-lg shadow-green-400/30'
                  : 'bg-muted-foreground/40'
              }`} />
              <span className="text-sm text-foreground">
                {virtualServer.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Required Scopes */}
          {virtualServer.required_scopes && virtualServer.required_scopes.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Required Scopes
              </p>
              <div className="flex flex-wrap gap-2">
                {virtualServer.required_scopes.map((scope) => (
                  <span
                    key={scope}
                    className="px-2.5 py-1 text-xs rounded-full bg-muted text-foreground font-mono"
                  >
                    {scope}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Supported Transports */}
          {virtualServer.supported_transports && virtualServer.supported_transports.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Supported Transports
              </p>
              <div className="flex flex-wrap gap-2">
                {virtualServer.supported_transports.map((transport) => (
                  <span
                    key={transport}
                    className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary"
                  >
                    {transport}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default VirtualServerDetailsModal;
