import React, { useState, useMemo, useCallback } from 'react';
import {
  RefreshCw,
  Settings,
  Info,
  X,
  ExternalLink,
  ClipboardCopy,
  Download,
} from 'lucide-react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
  SemanticServerHit,
  SemanticToolHit,
  SemanticAgentHit,
  SemanticSkillHit,
  SemanticVirtualServerHit
} from '../hooks/useSemanticSearch';
import ServerConfigModal from './ServerConfigModal';
import AgentDetailsModal from './AgentDetailsModal';
import type { Server } from './ServerCard';
import type { Agent as AgentType } from './AgentCard';
import useEscapeKey from '../hooks/useEscapeKey';

interface SemanticSearchResultsProps {
  query: string;
  loading: boolean;
  error: string | null;
  servers: SemanticServerHit[];
  tools: SemanticToolHit[];
  agents: SemanticAgentHit[];
  skills: SemanticSkillHit[];
  virtualServers?: SemanticVirtualServerHit[];
}

interface ToolSchemaModalProps {
  toolName: string;
  serverName: string;
  schema: Record<string, any> | null;
  isOpen: boolean;
  onClose: () => void;
}

const ToolSchemaModal: React.FC<ToolSchemaModalProps> = ({
  toolName,
  serverName,
  schema,
  isOpen,
  onClose
}) => {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {toolName}
            </h3>
            <p className="text-sm text-muted-foreground">{serverName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Input Schema
          </p>
          {schema && Object.keys(schema).length > 0 ? (
            <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto text-foreground">
              {JSON.stringify(schema, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-muted-foreground italic">
              No input schema available for this tool.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

// Helper function to parse YAML frontmatter from markdown
const parseYamlFrontmatter = (content: string): { frontmatter: Record<string, string> | null; body: string } => {
  const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (match) {
    const yamlContent = match[1];
    const body = match[2];
    const frontmatter: Record<string, string> = {};
    const lines = yamlContent.split('\n');
    for (const line of lines) {
      const colonIndex = line.indexOf(':');
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        if (key && value) {
          frontmatter[key] = value;
        }
      }
    }
    return { frontmatter: Object.keys(frontmatter).length > 0 ? frontmatter : null, body };
  }
  return { frontmatter: null, body: content };
};


interface ServerDetailsModalProps {
  server: SemanticServerHit;
  isOpen: boolean;
  onClose: () => void;
}

const ServerDetailsModal: React.FC<ServerDetailsModalProps> = ({
  server,
  isOpen,
  onClose
}) => {
  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  const isFederatedServer = server.sync_metadata?.is_federated === true;
  const peerRegistryId = isFederatedServer && server.sync_metadata?.source_peer_id
    ? server.sync_metadata.source_peer_id.replace('peer-registry-', '').replace('peer-', '').toUpperCase()
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {server.server_name}
              </h3>
              {isFederatedServer && peerRegistryId && (
                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20">
                  {peerRegistryId}
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{server.path}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1 space-y-4">
          {/* Description */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Description
            </p>
            <p className="text-sm text-foreground">
              {server.description || 'No description available.'}
            </p>
          </div>

          {/* Tags */}
          {server.tags && server.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tags
              </p>
              <div className="flex flex-wrap gap-2">
                {server.tags.map((tag) => (
                  <span
                    key={tag}
                    className="px-2.5 py-1 text-xs rounded-full bg-muted text-foreground"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Tools */}
          {server.matching_tools && server.matching_tools.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tools ({server.matching_tools.length})
              </p>
              <ul className="space-y-2">
                {server.matching_tools.map((tool) => (
                  <li key={tool.tool_name} className="text-sm text-foreground bg-muted p-3 rounded-lg">
                    <span className="font-medium text-foreground">{tool.tool_name}</span>
                    {tool.description && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {tool.description}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Status */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Status
            </p>
            <div className="flex items-center gap-2">
              <div className={`w-3 h-3 rounded-full ${
                server.is_enabled
                  ? 'bg-green-400 shadow-lg shadow-green-400/30'
                  : 'bg-muted-foreground/50'
              }`} />
              <span className="text-sm text-foreground">
                {server.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Relevance Score */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Match Score
            </p>
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
              {Math.round(Math.min(server.relevance_score, 1) * 100)}% match
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


interface SkillContentModalProps {
  skill: SemanticSkillHit;
  isOpen: boolean;
  onClose: () => void;
}

const SkillContentModal: React.FC<SkillContentModalProps> = ({
  skill,
  isOpen,
  onClose
}) => {
  const [loading, setLoading] = useState(false);
  const [content, setContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEscapeKey(onClose, isOpen);

  // Fetch content when modal opens
  React.useEffect(() => {
    if (!isOpen) {
      setContent(null);
      setError(null);
      return;
    }

    const fetchContent = async () => {
      setLoading(true);
      setError(null);
      try {
        // skill.path is like "/skills/doc-coauthoring", need just "/doc-coauthoring"
        const apiPath = skill.path.startsWith('/skills/')
          ? skill.path.replace('/skills/', '/')
          : skill.path;
        const response = await axios.get(`/api/skills${apiPath}/content`);
        setContent(response.data.content);
      } catch (err: any) {
        console.error('Failed to fetch SKILL.md content:', err);
        setError(err.response?.data?.detail || 'Failed to load SKILL.md content');
      } finally {
        setLoading(false);
      }
    };

    fetchContent();
  }, [isOpen, skill.path]);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (content) {
      navigator.clipboard.writeText(content);
    }
  };

  const handleDownload = () => {
    if (content) {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${skill.skill_name || 'skill'}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  const { frontmatter, body } = content ? parseYamlFrontmatter(content) : { frontmatter: null, body: '' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-foreground">
              {skill.skill_name}
            </h3>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground border border-border">
              SKILL
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-4 px-4 py-3 border-b border-border bg-muted">
          {skill.skill_md_url && (
            <a
              href={skill.skill_md_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:underline"
            >
              <ExternalLink className="h-4 w-4" />
              View on GitHub
            </a>
          )}
          {content && (
            <>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                title="Copy to clipboard"
              >
                <ClipboardCopy className="h-4 w-4" />
                Copy
              </button>
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
                title="Download SKILL.md"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </>
          )}
        </div>

        <div className="p-4 overflow-auto flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-border"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-red-500">{error}</p>
              {skill.skill_md_url && (
                <p className="mt-2 text-sm">
                  Try visiting the{' '}
                  <a
                    href={skill.skill_md_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:underline"
                  >
                    source URL
                  </a>{' '}
                  directly.
                </p>
              )}
            </div>
          ) : content ? (
            <>
              {/* YAML Frontmatter Table */}
              {frontmatter && (
                <div className="mb-6 rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <tbody>
                      {Object.entries(frontmatter).map(([key, value]) => (
                        <tr key={key} className="border-b border-border last:border-b-0">
                          <td className="px-4 py-2 bg-muted font-medium text-foreground w-1/4">
                            {key}
                          </td>
                          <td className="px-4 py-2 text-foreground">
                            {value}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {/* Markdown Body */}
              <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:text-foreground prose-a:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-pre:bg-muted">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{body}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <p>Could not load SKILL.md content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};


interface VirtualServerDetailsModalProps {
  virtualServer: SemanticVirtualServerHit;
  isOpen: boolean;
  onClose: () => void;
}

const VirtualServerDetailsModal: React.FC<VirtualServerDetailsModalProps> = ({
  virtualServer,
  isOpen,
  onClose
}) => {
  const [copiedEndpoint, setCopiedEndpoint] = useState(false);
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());

  useEscapeKey(onClose, isOpen);
  if (!isOpen) return null;

  const tools = virtualServer.matching_tools || [];
  const backendPaths = virtualServer.backend_paths || [];

  const handleCopyEndpoint = () => {
    if (virtualServer.endpoint_url) {
      navigator.clipboard.writeText(virtualServer.endpoint_url);
      setCopiedEndpoint(true);
      setTimeout(() => setCopiedEndpoint(false), 2000);
    }
  };

  const toggleToolExpand = (toolName: string) => {
    setExpandedTools(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) {
        next.delete(toolName);
      } else {
        next.add(toolName);
      }
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-card rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-foreground">
                {virtualServer.server_name}
              </h3>
              <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20">
                VIRTUAL
              </span>
            </div>
            <p className="text-sm text-muted-foreground">{virtualServer.path}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-muted-foreground hover:text-foreground rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 overflow-auto flex-1 space-y-4">
          {/* Endpoint URL */}
          {virtualServer.endpoint_url && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Endpoint URL
              </p>
              <div className="flex items-center gap-2 bg-muted rounded-lg p-2">
                <code className="flex-1 text-sm text-primary font-mono break-all">
                  {virtualServer.endpoint_url}
                </code>
                <button
                  onClick={handleCopyEndpoint}
                  className="flex-shrink-0 p-2 text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                  title="Copy endpoint URL"
                >
                  {copiedEndpoint ? (
                    <span className="text-xs text-primary font-medium">Copied!</span>
                  ) : (
                    <ClipboardCopy className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
          )}

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
                    className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Backend Servers */}
          {backendPaths.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Backend Servers ({backendPaths.length})
              </p>
              <ul className="space-y-1">
                {backendPaths.map((path) => (
                  <li key={path} className="text-sm text-foreground font-mono bg-muted px-2 py-1 rounded">
                    {path}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Tools */}
          {tools.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                Tools ({tools.length})
              </p>
              <ul className="space-y-2">
                {tools.map((tool) => {
                  const isExpanded = expandedTools.has(tool.tool_name);
                  return (
                    <li key={tool.tool_name} className="text-sm text-foreground bg-muted rounded-lg overflow-hidden">
                      <button
                        type="button"
                        onClick={() => toggleToolExpand(tool.tool_name)}
                        className="w-full p-3 text-left hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-foreground">{tool.tool_name}</span>
                          <div className="flex items-center gap-2">
                            {tool.relevance_score !== undefined && (
                              <span className="text-xs text-primary">
                                {Math.round(tool.relevance_score * 100)}%
                              </span>
                            )}
                            <Info className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                          </div>
                        </div>
                        {(tool.description || tool.match_context) && (
                          <p className="text-muted-foreground mt-1 text-xs">
                            {tool.description || tool.match_context}
                          </p>
                        )}
                      </button>
                      {isExpanded && (
                        <div className="px-3 pb-3 border-t border-border pt-2">
                          {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 ? (
                            <>
                              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                                Input Schema
                              </p>
                              <pre className="text-xs bg-muted p-3 rounded-lg overflow-auto text-foreground max-h-48">
                                {JSON.stringify(tool.inputSchema, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <p className="text-xs text-muted-foreground italic">
                              No input schema available for this tool.
                            </p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
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
                  : 'bg-muted-foreground/50'
              }`} />
              <span className="text-sm text-foreground">
                {virtualServer.is_enabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
          </div>

          {/* Relevance Score */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Match Score
            </p>
            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
              {Math.round(Math.min(virtualServer.relevance_score, 1) * 100)}% match
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};


interface VirtualServerResultCardProps {
  virtualServer: SemanticVirtualServerHit;
  onViewDetails: () => void;
}

const VirtualServerResultCard: React.FC<VirtualServerResultCardProps> = ({
  virtualServer,
  onViewDetails
}) => {
  const [showAllTools, setShowAllTools] = useState(false);
  const tools = virtualServer.matching_tools || [];
  const visibleTools = showAllTools ? tools : tools.slice(0, 3);
  const hasMoreTools = tools.length > 3;

  return (
    <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-5 shadow-xs hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-base font-semibold text-foreground">
              {virtualServer.server_name}
            </p>
            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20">
              VIRTUAL
            </span>
          </div>
          <p className="text-sm text-muted-foreground">{virtualServer.path}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onViewDetails}
            className="p-2 text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
            title="View virtual server details"
          >
            <Info className="h-4 w-4" />
          </button>
          <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
            {Math.round(Math.min(virtualServer.relevance_score, 1) * 100)}% match
          </span>
        </div>
      </div>

      <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
        {virtualServer.description || virtualServer.match_context || 'No description available.'}
      </p>

      {virtualServer.tags && virtualServer.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {virtualServer.tags.slice(0, 6).map((tag) => (
            <span
              key={tag}
              className="px-2.5 py-1 text-[11px] rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tools Section */}
      {tools.length > 0 && (
        <div className="mt-4 border-t border-dashed border-primary/20 pt-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Tools ({tools.length})
          </p>
          <ul className="space-y-2">
            {visibleTools.map((tool) => (
              <li key={tool.tool_name} className="text-sm text-foreground flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <span className="font-medium text-foreground">{tool.tool_name}</span>
                  {tool.relevance_score !== undefined && (
                    <span className="ml-2 text-xs text-primary">
                      {Math.round(tool.relevance_score * 100)}%
                    </span>
                  )}
                  {(tool.description || tool.match_context) && (
                    <p className="text-muted-foreground text-xs mt-0.5 line-clamp-1">
                      {tool.description || tool.match_context}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {hasMoreTools && (
            <button
              type="button"
              onClick={() => setShowAllTools(!showAllTools)}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {showAllTools ? 'Show less' : `+${tools.length - 3} more tools...`}
            </button>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
        <span>{virtualServer.backend_count || 0} backends</span>
        <span>{virtualServer.is_enabled ? 'Enabled' : 'Disabled'}</span>
      </div>
    </div>
  );
};


const formatPercent = (value: number) => `${Math.round(Math.min(value, 1) * 100)}%`;

const SemanticSearchResults: React.FC<SemanticSearchResultsProps> = ({
  query,
  loading,
  error,
  servers,
  tools,
  agents,
  skills,
  virtualServers = []
}) => {
  const hasResults = servers.length > 0 || tools.length > 0 || agents.length > 0 || skills.length > 0 || virtualServers.length > 0;
  const [configServer, setConfigServer] = useState<SemanticServerHit | null>(null);
  const [detailsServer, setDetailsServer] = useState<SemanticServerHit | null>(null);
  const [detailsSkill, setDetailsSkill] = useState<SemanticSkillHit | null>(null);
  const [detailsAgent, setDetailsAgent] = useState<SemanticAgentHit | null>(null);
  const [detailsVirtualServer, setDetailsVirtualServer] = useState<SemanticVirtualServerHit | null>(null);
  const [agentDetailsData, setAgentDetailsData] = useState<any>(null);
  const [agentDetailsLoading, setAgentDetailsLoading] = useState(false);
  const [selectedToolSchema, setSelectedToolSchema] = useState<{
    toolName: string;
    serverName: string;
    schema: Record<string, any> | null;
  } | null>(null);

  // Build a lookup map from server_path + tool_name to inputSchema
  const toolSchemaMap = useMemo(() => {
    const map = new Map<string, Record<string, any>>();
    for (const tool of tools) {
      const key = `${tool.server_path}:${tool.tool_name}`;
      if (tool.inputSchema) {
        map.set(key, tool.inputSchema);
      }
    }
    return map;
  }, [tools]);

  const openToolSchema = (
    serverPath: string,
    serverName: string,
    toolName: string
  ) => {
    const key = `${serverPath}:${toolName}`;
    const schema = toolSchemaMap.get(key) || null;
    setSelectedToolSchema({ toolName, serverName, schema });
  };

  const openAgentDetails = async (agentHit: SemanticAgentHit) => {
    setDetailsAgent(agentHit);
    setAgentDetailsData(null);
    setAgentDetailsLoading(true);
    try {
      const response = await axios.get(`/api/agents${agentHit.path}`);
      setAgentDetailsData(response.data);
    } catch (error) {
      console.error('Failed to fetch agent details:', error);
    } finally {
      setAgentDetailsLoading(false);
    }
  };

  const mapHitToAgent = (hit: SemanticAgentHit): AgentType => {
    const card = hit.agent_card || {};
    return {
      name: card.name || hit.path.replace(/^\//, ''),
      path: hit.path,
      url: card.url,
      description: card.description,
      version: card.version,
      visibility: (card.visibility as AgentType['visibility']) ?? 'public',
      trust_level: (card.trust_level as AgentType['trust_level']) ?? 'unverified',
      enabled: card.is_enabled ?? true,
      tags: card.tags || [],
      status: 'unknown',
    };
  };

  return (
    <>
    <div className="space-y-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Semantic Search
          </p>
          <h3 className="text-xl font-semibold text-foreground">
            Results for <span className="text-primary">“{query}”</span>
          </h3>
        </div>
        {loading && (
          <div className="inline-flex items-center text-sm text-primary">
            <RefreshCw className="h-5 w-5 animate-spin mr-2" />
            Searching…
          </div>
        )}
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && !error && !hasResults && (
        <div className="text-center py-16 border border-dashed border-border rounded-xl">
          <p className="text-lg font-medium text-foreground mb-2">
            No semantic matches found
          </p>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Try refining your query or describing the tools or capabilities you need. Semantic
            search understands natural language — phrases like “servers that handle authentication”
            or “tools for syncing calendars” work great.
          </p>
        </div>
      )}

      {servers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-foreground">
              Matching Servers <span className="text-sm font-normal text-muted-foreground">({servers.length})</span>
            </h4>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}
          >
            {servers.map((server) => {
              // Detect if server is from a peer registry using sync_metadata
              const isFederatedServer = server.sync_metadata?.is_federated === true;
              const peerRegistryId = isFederatedServer && server.sync_metadata?.source_peer_id
                ? server.sync_metadata.source_peer_id.replace('peer-registry-', '').replace('peer-', '').toUpperCase()
                : null;
              const isOrphanedServer = server.sync_metadata?.is_orphaned === true;

              return (
              <div
                key={server.path}
                className="rounded-2xl border border-border bg-card p-5 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {server.server_name}
                      </p>
                      {/* Registry source badge - only show for federated (peer registry) items */}
                      {isFederatedServer && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20">
                          {peerRegistryId}
                        </span>
                      )}
                      {/* Orphaned badge */}
                      {isOrphanedServer && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-700" title="No longer exists on peer registry">
                          ORPHANED
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{server.path}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsServer(server)}
                      className="p-2 text-muted-foreground hover:text-primary dark:hover:text-primary hover:bg-primary/10 dark:hover:bg-primary/90/30 rounded-lg transition-colors"
                      title="View server details"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigServer(server)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Open MCP configuration"
                    >
                      <Settings className="h-4 w-4" />
                    </button>
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
                      {formatPercent(server.relevance_score)} match
                    </span>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {server.description || server.match_context || 'No description available.'}
                </p>

                {server.tags?.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {server.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-xs rounded-full bg-muted text-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {server.matching_tools?.length > 0 && (
                  <div className="mt-4 border-t border-dashed border-border pt-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                      Relevant tools
                    </p>
                    <ul className="space-y-2">
                      {server.matching_tools.slice(0, 3).map((tool) => (
                        <li key={tool.tool_name} className="text-sm text-foreground flex items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-foreground">{tool.tool_name}</span>
                            <span className="mx-2 text-muted-foreground">-</span>
                            <span className="text-muted-foreground line-clamp-1">
                              {tool.description || tool.match_context || 'No description'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => openToolSchema(server.path, server.server_name, tool.tool_name)}
                            className="flex-shrink-0 p-1 text-muted-foreground hover:text-primary rounded transition-colors"
                            title="View input schema"
                          >
                            <Info className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
            })}
          </div>
        </section>
      )}

      {tools.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-foreground">
              Matching Tools <span className="text-sm font-normal text-muted-foreground">({tools.length})</span>
            </h4>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {tools.map((tool) => (
              <div
                key={`${tool.server_path}-${tool.tool_name}`}
                className="rounded-xl border border-border bg-card p-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {tool.tool_name}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      ({tool.server_name})
                    </span>
                  </p>
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {tool.description || tool.match_context || 'No description available.'}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={() => setSelectedToolSchema({
                      toolName: tool.tool_name,
                      serverName: tool.server_name,
                      schema: tool.inputSchema || null
                    })}
                    className="p-1.5 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                    title="View input schema"
                  >
                    <Info className="h-4 w-4" />
                  </button>
                  <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
                    {formatPercent(tool.relevance_score)} match
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {agents.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-foreground">
              Matching Agents <span className="text-sm font-normal text-muted-foreground">({agents.length})</span>
            </h4>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {agents.map((agent) => {
              // Extract agent details from agent_card
              const card = agent.agent_card || {};
              const agentName = card.name || agent.path.replace(/^\//, '');
              const agentDescription = card.description;
              const agentTags = card.tags || [];
              const agentVisibility = card.visibility || 'public';
              const agentTrustLevel = card.trust_level || 'unverified';
              const agentIsEnabled = card.is_enabled ?? false;
              const syncMetadata = card.sync_metadata;

              // Extract skill names from agent_card.skills (array of skill objects)
              const rawSkills = card.skills || [];
              const skillNames = rawSkills.map((s: any) =>
                typeof s === 'string' ? s : s?.name || s?.id
              ).filter(Boolean);

              // Detect if agent is from a peer registry using sync_metadata
              const isFederatedAgent = syncMetadata?.is_federated === true;
              const peerRegistryId = isFederatedAgent && syncMetadata?.source_peer_id
                ? syncMetadata.source_peer_id.replace('peer-registry-', '').replace('peer-', '').toUpperCase()
                : null;
              const isOrphanedAgent = syncMetadata?.is_orphaned === true;

              return (
              <div
                key={agent.path}
                className="rounded-2xl border border-primary/20 dark:border-primary/20 bg-card p-5 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {agentName}
                      </p>
                      {/* Registry source badge - only show for federated (peer registry) items */}
                      {isFederatedAgent && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary border border-primary/20">
                          {peerRegistryId}
                        </span>
                      )}
                      {/* Orphaned badge */}
                      {isOrphanedAgent && (
                        <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-200 border border-red-200 dark:border-red-700" title="No longer exists on peer registry">
                          ORPHANED
                        </span>
                      )}
                    </div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {agentVisibility}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAgentDetails(agent)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="View full agent details"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    <span className="inline-flex items-center rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary px-3 py-1 text-xs font-semibold">
                      {formatPercent(agent.relevance_score)} match
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {agentDescription || agent.match_context || 'No description available.'}
                </p>

                {skillNames.length > 0 && (
                  <div className="mt-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                      Key Skills
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {skillNames.slice(0, 4).join(', ')}
                      {skillNames.length > 4 && '…'}
                    </p>
                  </div>
                )}

                {agentTags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {agentTags.slice(0, 6).map((tag: string) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[11px] rounded-full bg-primary/10 text-primary dark:bg-primary/10 dark:text-primary"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-semibold text-primary">
                    {agentTrustLevel}
                  </span>
                  <span>{agentIsEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            );
            })}
          </div>
        </section>
      )}

      {skills.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-foreground">
              Matching Skills <span className="text-sm font-normal text-muted-foreground">({skills.length})</span>
            </h4>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {skills.map((skill) => (
              <div
                key={skill.path}
                className="rounded-2xl border-2 border-border bg-muted p-5 shadow-xs hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-base font-semibold text-foreground">
                        {skill.skill_name}
                      </p>
                      <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground border border-border">
                        SKILL
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {skill.visibility || 'public'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailsSkill(skill)}
                      className="p-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="View SKILL.md content"
                    >
                      <Info className="h-4 w-4" />
                    </button>
                    <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground px-3 py-1 text-xs font-semibold">
                      {formatPercent(skill.relevance_score)} match
                    </span>
                  </div>
                </div>

                <p className="mt-3 text-sm text-muted-foreground line-clamp-3">
                  {skill.description || skill.match_context || 'No description available.'}
                </p>

                {skill.tags && skill.tags.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {skill.tags.slice(0, 6).map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 text-[11px] rounded-full bg-muted text-muted-foreground dark:bg-muted dark:text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {skill.author && (
                      <span>by {skill.author}</span>
                    )}
                    {skill.version && (
                      <span className="text-muted-foreground">v{skill.version}</span>
                    )}
                  </div>
                  <span>{skill.is_enabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {virtualServers.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-semibold text-foreground">
              Matching Virtual Servers <span className="text-sm font-normal text-muted-foreground">({virtualServers.length})</span>
            </h4>
          </div>
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.25rem' }}
          >
            {virtualServers.map((vs) => (
              <VirtualServerResultCard
                key={vs.path}
                virtualServer={vs}
                onViewDetails={() => setDetailsVirtualServer(vs)}
              />
            ))}
          </div>
        </section>
      )}
    </div>

    {configServer && (
      <ServerConfigModal
        server={
          {
            name: configServer.server_name,
            path: configServer.path,
            description: configServer.description,
            enabled: configServer.is_enabled ?? true,
            tags: configServer.tags,
            num_tools: configServer.num_tools,
          } as Server
        }
        isOpen
        onClose={() => setConfigServer(null)}
      />
    )}

    {detailsAgent && (
      <AgentDetailsModal
        agent={mapHitToAgent(detailsAgent)}
        isOpen
        onClose={() => setDetailsAgent(null)}
        loading={agentDetailsLoading}
        fullDetails={agentDetailsData}
      />
    )}

    {selectedToolSchema && (
      <ToolSchemaModal
        toolName={selectedToolSchema.toolName}
        serverName={selectedToolSchema.serverName}
        schema={selectedToolSchema.schema}
        isOpen
        onClose={() => setSelectedToolSchema(null)}
      />
    )}

    {detailsServer && (
      <ServerDetailsModal
        server={detailsServer}
        isOpen
        onClose={() => setDetailsServer(null)}
      />
    )}

    {detailsSkill && (
      <SkillContentModal
        skill={detailsSkill}
        isOpen
        onClose={() => setDetailsSkill(null)}
      />
    )}

    {detailsVirtualServer && (
      <VirtualServerDetailsModal
        virtualServer={detailsVirtualServer}
        isOpen
        onClose={() => setDetailsVirtualServer(null)}
      />
    )}
    </>
  );
};

export default SemanticSearchResults;
