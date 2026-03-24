import React, { useState, useCallback } from 'react';
import axios from 'axios';
import {
  Pencil,
  Trash2,
  Cog,
  Wrench,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { VirtualServerInfo, ResolvedTool } from '../types/virtualServer';
import ServerConfigModal from './ServerConfigModal';
import StarRatingWidget from './StarRatingWidget';
import useEscapeKey from '../hooks/useEscapeKey';


/**
 * Props for the VirtualServerCard component.
 */
interface VirtualServerCardProps {
  virtualServer: VirtualServerInfo;
  canModify: boolean;
  onToggle: (path: string, enabled: boolean) => void;
  onEdit: (server: VirtualServerInfo) => void;
  onDelete: (path: string) => void;
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
  onServerUpdate?: (path: string, updates: Partial<VirtualServerInfo>) => void;
  authToken?: string | null;
}


/**
 * VirtualServerCard renders a dashboard card for a virtual MCP server.
 *
 * Uses a teal/cyan gradient for visual distinction from regular ServerCard.
 * Matches the layout and UI elements of the regular ServerCard.
 */
const VirtualServerCard: React.FC<VirtualServerCardProps> = ({
  virtualServer: server,
  canModify,
  onToggle,
  onEdit,
  onDelete,
  onShowToast,
  onServerUpdate,
  authToken,
}) => {
  const [showTools, setShowTools] = useState(false);
  const [tools, setTools] = useState<ResolvedTool[]>([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [expandedBackends, setExpandedBackends] = useState<Record<string, boolean>>({});
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});
  const [showConfig, setShowConfig] = useState(false);

  useEscapeKey(() => setShowTools(false), showTools);

  const handleViewTools = useCallback(async () => {
    if (loadingTools) return;

    setShowTools(true);
    setLoadingTools(true);

    try {
      // Fetch resolved tools with full details (description, schema)
      const response = await axios.get<{ tools: ResolvedTool[] }>(
        `/api/virtual-servers${server.path}/tools`
      );
      const resolvedTools = response.data.tools || [];
      setTools(resolvedTools);

      // Group tools by backend to determine collapse state
      const toolsByBackend: Record<string, ResolvedTool[]> = {};
      for (const tool of resolvedTools) {
        const backend = tool.backend_server_path;
        if (!toolsByBackend[backend]) {
          toolsByBackend[backend] = [];
        }
        toolsByBackend[backend].push(tool);
      }

      // Auto-expand first backend, collapse tools if more than 3 in any backend
      const backends = Object.keys(toolsByBackend);
      if (backends.length > 0) {
        setExpandedBackends({ [backends[0]]: true });
      }

      // If any backend has more than 3 tools, collapse all tools by default
      // Otherwise expand all tools
      const hasLargeBackend = Object.values(toolsByBackend).some(t => t.length > 3);
      if (!hasLargeBackend) {
        // Expand all tools if small number of tools
        const allToolsExpanded: Record<string, boolean> = {};
        for (const tool of resolvedTools) {
          allToolsExpanded[tool.name] = true;
        }
        setExpandedTools(allToolsExpanded);
      } else {
        setExpandedTools({});
      }
    } catch (error) {
      console.error('Failed to fetch tools:', error);
      toast.error('Failed to load tools');
      setTools([]);
    } finally {
      setLoadingTools(false);
    }
  }, [server.path, loadingTools, onShowToast]);

  const toggleBackend = (backend: string) => {
    setExpandedBackends(prev => ({
      ...prev,
      [backend]: !prev[backend]
    }));
  };

  const toggleTool = (toolName: string) => {
    setExpandedTools(prev => ({
      ...prev,
      [toolName]: !prev[toolName]
    }));
  };

  // Group tools by backend server
  const toolsByBackend = tools.reduce<Record<string, ResolvedTool[]>>((acc, tool) => {
    const backend = tool.backend_server_path;
    if (!acc[backend]) {
      acc[backend] = [];
    }
    acc[backend].push(tool);
    return acc;
  }, {});

  const backendPaths = Object.keys(toolsByBackend);

  // Create a Server-like object for ServerConfigModal
  const serverForConfig = {
    name: server.server_name,
    path: server.path,
    description: server.description,
    enabled: server.is_enabled,
    tags: server.tags,
  };

  return (
    <>
      <Card className="group rounded-2xl shadow-xs hover:shadow-xl transition-all duration-300 h-full flex flex-col bg-primary/5 border-2 border-primary/20 hover:border-primary/30">
        {/* Header */}
        <div className="p-5 pb-4">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-lg font-bold text-foreground truncate">
                  {server.server_name}
                </h3>
                <Badge variant="outline" className="bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary flex-shrink-0 border-primary/20">
                  VIRTUAL
                </Badge>
              </div>

              <code className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded font-mono">
                {server.path}
              </code>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              {canModify && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => onEdit(server)}
                  title="Edit virtual server"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              )}

              {/* Configuration Generator Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowConfig(true)}
                className="text-muted-foreground hover:text-primary"
                title="Copy mcp.json configuration"
              >
                <Cog className="h-4 w-4" />
              </Button>

              {canModify && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(server.path)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete virtual server"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed line-clamp-2 mb-4">
            {server.description || 'No description available'}
          </p>

          {/* Tags */}
          {server.tags && server.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {server.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-1 text-xs font-medium bg-primary/10 text-primary rounded"
                >
                  #{tag}
                </span>
              ))}
              {server.tags.length > 3 && (
                <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded">
                  +{server.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Stats - 2-column layout */}
        <div className="px-5 pb-4">
          <div className="grid grid-cols-2 gap-4">
            {/* Rating */}
            <StarRatingWidget
              resourceType="virtual-servers"
              path={server.path}
              initialRating={server.num_stars || 0}
              initialCount={server.rating_details?.length || 0}
              authToken={authToken}
              onShowToast={onShowToast}
              onRatingUpdate={(newRating) => {
                onServerUpdate?.(server.path, { num_stars: newRating });
              }}
            />

            {/* Tools - clickable */}
            <div className="flex items-center gap-2">
              {server.tool_count > 0 ? (
                <button
                  onClick={handleViewTools}
                  disabled={loadingTools}
                  className="flex items-center gap-2 text-primary hover:text-primary dark:text-primary dark:hover:text-primary disabled:opacity-50 hover:bg-primary/10 dark:hover:bg-primary/10 px-2 py-1 -mx-2 -my-1 rounded transition-all"
                  title="View tools"
                >
                  <div className="p-1.5 bg-primary/10 rounded">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{server.tool_count}</div>
                    <div className="text-xs">Tools</div>
                  </div>
                </button>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="p-1.5 bg-muted rounded">
                    <Wrench className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold">0</div>
                    <div className="text-xs">Tools</div>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto px-5 py-4 border-t border-border bg-muted rounded-b-2xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                server.is_enabled
                  ? 'bg-green-400 shadow-lg shadow-green-400/30'
                  : 'bg-muted-foreground'
              }`} />
              <span className="text-sm font-medium text-foreground">
                {server.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>

            {/* Toggle Switch */}
            {canModify && (
              <Switch
                checked={server.is_enabled}
                onCheckedChange={(checked) => onToggle(server.path, checked)}
                aria-label={`Enable ${server.server_name}`}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Tools Modal */}
      {showTools && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-foreground">
                Tools for {server.server_name}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowTools(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {loadingTools ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                <span className="ml-3 text-muted-foreground">Loading tools...</span>
              </div>
            ) : tools.length > 0 ? (
              <div className="space-y-3">
                {backendPaths.map((backend) => {
                  const backendTools = toolsByBackend[backend];
                  const isBackendExpanded = expandedBackends[backend];

                  return (
                    <div key={backend} className="border border-border rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleBackend(backend)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-muted hover:bg-accent transition-colors text-left"
                      >
                        <div className="flex items-center gap-2">
                          {isBackendExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm font-mono text-foreground">
                            {backend}
                          </span>
                        </div>
                        <Badge variant="secondary" className="bg-primary/10 text-primary">
                          {backendTools.length} tool{backendTools.length !== 1 ? 's' : ''}
                        </Badge>
                      </button>

                      {isBackendExpanded && (
                        <ul className="border-t border-border divide-y divide-border">
                          {backendTools.map((tool) => {
                            const isToolExpanded = expandedTools[tool.name];
                            const hasDetails = tool.description || (tool.input_schema && Object.keys(tool.input_schema).length > 0);

                            return (
                              <li
                                key={tool.name}
                                className="bg-card"
                              >
                                {/* Tool header - clickable to expand */}
                                <button
                                  onClick={() => hasDetails && toggleTool(tool.name)}
                                  className={`w-full px-4 py-3 text-left ${hasDetails ? 'cursor-pointer hover:bg-accent' : 'cursor-default'}`}
                                  disabled={!hasDetails}
                                >
                                  <div className="flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {hasDetails && (
                                        isToolExpanded ? (
                                          <ChevronDown className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        ) : (
                                          <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                        )
                                      )}
                                      {!hasDetails && <div className="w-3" />}
                                      <span className="font-medium text-sm text-foreground">
                                        {tool.name}
                                      </span>
                                      {tool.original_name && tool.name !== tool.original_name && (
                                        <span className="text-xs text-muted-foreground">
                                          (original: {tool.original_name})
                                        </span>
                                      )}
                                    </div>
                                    {tool.backend_version && (
                                      <span className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-mono flex-shrink-0">
                                        v{tool.backend_version}
                                      </span>
                                    )}
                                  </div>
                                </button>

                                {/* Expanded tool details */}
                                {isToolExpanded && hasDetails && (
                                  <div className="px-4 pb-3 pt-0 space-y-3">
                                    {/* Description */}
                                    {tool.description && (
                                      <div className="ml-5">
                                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                                          {tool.description}
                                        </p>
                                      </div>
                                    )}

                                    {/* Schema */}
                                    {tool.input_schema && Object.keys(tool.input_schema).length > 0 && (
                                      <div className="ml-5">
                                        <details className="text-xs">
                                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-medium">
                                            View Schema
                                          </summary>
                                          <pre className="mt-2 p-3 bg-muted border border-border rounded overflow-x-auto text-foreground">
                                            {JSON.stringify(tool.input_schema, null, 2)}
                                          </pre>
                                        </details>
                                      </div>
                                    )}

                                    {/* Required scopes */}
                                    {tool.required_scopes && tool.required_scopes.length > 0 && (
                                      <div className="ml-5 flex flex-wrap gap-1">
                                        {tool.required_scopes.map((scope) => (
                                          <span
                                            key={scope}
                                            className="px-1.5 py-0.5 text-[10px] bg-muted text-muted-foreground rounded font-mono"
                                          >
                                            {scope}
                                          </span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                No tools available for this virtual server.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ServerConfigModal - reusing exact same component as ServerCard */}
      <ServerConfigModal
        server={serverForConfig as any}
        isOpen={showConfig}
        onClose={() => setShowConfig(false)}
        onShowToast={onShowToast}
      />
    </>
  );
};

export default VirtualServerCard;
