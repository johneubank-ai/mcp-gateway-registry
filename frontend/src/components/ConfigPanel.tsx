import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import {
  Search,
  RefreshCw,
  Clipboard,
  ChevronDown,
  ChevronRight,
  Download,
  X,
  Check,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface ConfigField {
  key: string;
  label: string;
  value: string;
  raw_value: string | null;
  is_masked: boolean;
  unit: string | null;
}

interface ConfigGroup {
  id: string;
  title: string;
  order: number;
  fields: ConfigField[];
}

interface ConfigResponse {
  groups: ConfigGroup[];
  total_groups: number;
  is_local_dev: boolean;
}

type ExportFormat = 'env' | 'json' | 'tfvars' | 'yaml';

interface ConfigPanelProps {
  onError?: (error: string) => void;
  showToast?: (message: string, type: 'success' | 'error') => void;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const EXPORT_OPTIONS: { format: ExportFormat; label: string }[] = [
  { format: 'env', label: '.env' },
  { format: 'json', label: 'JSON' },
  { format: 'tfvars', label: 'Terraform (.tfvars)' },
  { format: 'yaml', label: 'YAML' },
];

const DEFAULT_EXPANDED: Set<string> = new Set(['deployment', 'storage']);

/**
 * Highlight occurrences of `term` inside `text` using <mark> tags.
 */
function highlightMatch(text: string, term: string): React.ReactNode {
  if (!term) return text;
  const idx = text.toLowerCase().indexOf(term.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-muted dark:bg-muted rounded px-0.5">{text.slice(idx, idx + term.length)}</mark>
      {text.slice(idx + term.length)}
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  ConfigGroupPanel sub-component                                     */
/* ------------------------------------------------------------------ */

interface ConfigGroupPanelProps {
  group: ConfigGroup;
  expanded: boolean;
  onToggle: () => void;
  searchTerm: string;
  copiedKey: string | null;
  onCopy: (key: string, value: string) => void;
}

const ConfigGroupPanel: React.FC<ConfigGroupPanelProps> = ({
  group,
  expanded,
  onToggle,
  searchTerm,
  copiedKey,
  onCopy,
}) => {
  const panelId = `config-group-${group.id}`;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        onClick={onToggle}
        aria-expanded={expanded}
        aria-controls={panelId}
        className="w-full flex items-center justify-between px-4 py-3
                   bg-muted hover:bg-accent
                   transition-colors text-left"
      >
        <div className="flex items-center space-x-2">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-medium text-foreground">
            {highlightMatch(group.title, searchTerm)}
          </span>
        </div>
        <Badge variant="secondary" className="bg-muted px-2 py-0.5 rounded-full">
          {group.fields.length} {group.fields.length === 1 ? 'field' : 'fields'}
        </Badge>
      </button>

      {/* Group fields */}
      {expanded && (
        <div id={panelId} role="region" className="divide-y divide-border">
          {group.fields.map((field) => (
            <div
              key={field.key}
              className="flex items-center justify-between px-4 py-2.5 hover:bg-accent"
            >
              <div className="flex-1 min-w-0 mr-4">
                <div className="text-xs text-muted-foreground font-mono truncate">
                  {highlightMatch(field.key, searchTerm)}
                </div>
                <div className="text-sm text-foreground">
                  {highlightMatch(field.label, searchTerm)}
                </div>
              </div>
              <div className="flex items-center space-x-2 flex-shrink-0">
                <span
                  className={`text-sm font-mono ${
                    field.is_masked
                      ? 'text-muted-foreground italic'
                      : 'text-foreground'
                  }`}
                >
                  {highlightMatch(field.value, searchTerm)}
                  {field.unit && !field.is_masked && (
                    <span className="text-xs text-muted-foreground ml-1">
                      {field.unit}
                    </span>
                  )}
                </span>
                {!field.is_masked && field.raw_value !== null && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => onCopy(field.key, String(field.raw_value))}
                    aria-label={`Copy ${field.label} value`}
                    title="Copy value"
                  >
                    {copiedKey === field.key ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Clipboard className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  ConfigPanel main component                                         */
/* ------------------------------------------------------------------ */

const ConfigPanel: React.FC<ConfigPanelProps> = ({ onError, showToast }) => {
  const [config, setConfig] = useState<ConfigResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(DEFAULT_EXPANDED));
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  /* ---- Data fetching ---- */

  const fetchConfig = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get<ConfigResponse>('/api/config/full');
      setConfig(res.data);
    } catch (err: any) {
      const msg = err.response?.data?.detail || 'Failed to load configuration';
      setError(msg);
      onError?.(msg);
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  /* ---- Filtering ---- */

  const filteredGroups = useMemo(() => {
    if (!config) return [];
    if (!searchTerm.trim()) return config.groups;

    const term = searchTerm.toLowerCase();
    return config.groups
      .map((group) => ({
        ...group,
        fields: group.fields.filter(
          (f) =>
            f.key.toLowerCase().includes(term) ||
            f.label.toLowerCase().includes(term) ||
            f.value.toLowerCase().includes(term)
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [config, searchTerm]);

  const totalMatchingFields = useMemo(
    () => filteredGroups.reduce((sum, g) => sum + g.fields.length, 0),
    [filteredGroups]
  );

  /* ---- Group expand/collapse ---- */

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    if (!config) return;
    setExpandedGroups(new Set(config.groups.map((g) => g.id)));
  }, [config]);

  const collapseAll = useCallback(() => {
    setExpandedGroups(new Set());
  }, []);

  /* ---- Clipboard ---- */

  const copyToClipboard = useCallback(
    async (key: string, value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        setCopiedKey(key);
        showToast?.('Copied to clipboard', 'success');
        setTimeout(() => setCopiedKey(null), 2000);
      } catch {
        showToast?.('Failed to copy', 'error');
      }
    },
    [showToast]
  );

  /* ---- Export ---- */

  const handleExport = useCallback(
    async (format: ExportFormat) => {
      setExportOpen(false);
      try {
        const res = await axios.get(`/api/config/export`, {
          params: { format },
          responseType: 'blob',
        });

        const disposition = res.headers['content-disposition'];
        let filename = `mcp-registry-config.${format}`;
        if (disposition) {
          const match = disposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }

        const url = window.URL.createObjectURL(new Blob([res.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } catch (err: any) {
        const msg = err.response?.data?.detail || 'Export failed';
        showToast?.(msg, 'error');
      }
    },
    [showToast]
  );

  /* ---- Skeleton loading ---- */

  if (loading) {
    return (
      <div className="space-y-4" data-testid="config-skeleton">
        <div className="flex items-center justify-between">
          <div className="h-7 w-56 bg-muted rounded animate-pulse" />
          <div className="flex space-x-2">
            <div className="h-9 w-24 bg-muted rounded animate-pulse" />
            <div className="h-9 w-9 bg-muted rounded animate-pulse" />
          </div>
        </div>
        <div className="h-10 w-full bg-muted rounded animate-pulse" />
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-14 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  /* ---- Error state ---- */

  if (error) {
    return (
      <div className="text-center py-12" data-testid="config-error">
        <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
        <h3 className="text-lg font-medium text-foreground mb-2">
          Failed to Load Configuration
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchConfig}>
          Retry
        </Button>
      </div>
    );
  }

  if (!config) return null;

  /* ---- Main render ---- */

  return (
    <div className="space-y-4">
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          <h2 className="text-lg font-semibold text-foreground">
            System Configuration
          </h2>
          {config.is_local_dev && (
            <Badge
              className="bg-muted text-muted-foreground"
              data-testid="local-dev-badge"
            >
              Local Development Mode
            </Badge>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {/* Export dropdown */}
          <div className="relative">
            <Button
              variant="outline"
              onClick={() => setExportOpen((o) => !o)}
              aria-label="Export configuration"
            >
              <Download className="h-4 w-4 mr-1.5" />
              Export
            </Button>
            {exportOpen && (
              <div className="absolute right-0 mt-1 w-48 bg-card border border-border rounded-lg shadow-lg z-10">
                {EXPORT_OPTIONS.map((opt) => (
                  <button
                    key={opt.format}
                    onClick={() => handleExport(opt.format)}
                    className="w-full text-left px-4 py-2 text-sm text-foreground
                               hover:bg-accent first:rounded-t-lg last:rounded-b-lg"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Expand / Collapse */}
          <Button variant="outline" onClick={expandAll}>
            Expand All
          </Button>
          <Button variant="outline" onClick={collapseAll}>
            Collapse All
          </Button>

          {/* Refresh */}
          <Button
            variant="outline"
            size="icon"
            onClick={fetchConfig}
            aria-label="Refresh configuration"
            title="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search configuration..."
          aria-label="Search configuration"
          className="w-full pl-10 pr-10"
        />
        {searchTerm && (
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setSearchTerm('')}
            className="absolute right-3 top-1/2 -translate-y-1/2"
            aria-label="Clear search"
          >
            <X className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Search results count */}
      {searchTerm.trim() && filteredGroups.length > 0 && (
        <p className="text-sm text-muted-foreground" data-testid="search-count">
          {totalMatchingFields} {totalMatchingFields === 1 ? 'field' : 'fields'} in{' '}
          {filteredGroups.length} {filteredGroups.length === 1 ? 'group' : 'groups'}
        </p>
      )}

      {/* No results */}
      {searchTerm.trim() && filteredGroups.length === 0 && (
        <div className="text-center py-8" data-testid="no-results">
          <p className="text-muted-foreground">
            No configuration fields match "<span className="font-medium">{searchTerm}</span>"
          </p>
        </div>
      )}

      {/* Config groups */}
      <div className="space-y-3">
        {filteredGroups.map((group) => (
          <ConfigGroupPanel
            key={group.id}
            group={group}
            expanded={expandedGroups.has(group.id)}
            onToggle={() => toggleGroup(group.id)}
            searchTerm={searchTerm}
            copiedKey={copiedKey}
            onCopy={copyToClipboard}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="flex items-center space-x-4 text-xs text-muted-foreground pt-2 border-t border-border">
        <span>
          <code className="bg-muted px-1 rounded">****</code> = masked sensitive value
        </span>
        <span>
          <code className="bg-muted px-1 rounded">(not set)</code> = not configured
        </span>
      </div>
    </div>
  );
};

export default ConfigPanel;
