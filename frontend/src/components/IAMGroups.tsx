import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Download,
  FileUp,
  ChevronDown,
  ChevronRight,
  X,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  useIAMGroups,
  createGroup,
  deleteGroup,
  getGroup,
  updateGroup,
  CreateGroupPayload,
  GroupDetail,
  UpdateGroupPayload,
} from '../hooks/useIAM';
import { useServerList, useServerTools } from '../hooks/useToolCatalog';
import { useAgentList } from '../hooks/useAgentList';
import DeleteConfirmation from './DeleteConfirmation';
import SearchableSelect from './SearchableSelect';

interface IAMGroupsProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type View = 'list' | 'create' | 'edit';

// ─── Server access entry shape ──────────────────────────────────
interface ServerAccessEntry {
  server: string;
  methods: string[];
  tools: string[];  // array of selected tool names
}

// ─── Available ui_permissions keys from scopes.yml ──────────────
const UI_PERMISSION_KEYS = [
  { key: 'list_service', label: 'List Services' },
  { key: 'register_service', label: 'Register Service' },
  { key: 'health_check_service', label: 'Health Check Service' },
  { key: 'toggle_service', label: 'Toggle Service' },
  { key: 'modify_service', label: 'Modify Service' },
  { key: 'delete_service', label: 'Delete Service' },
  { key: 'list_agents', label: 'List Agents' },
  { key: 'get_agent', label: 'Get Agent' },
  { key: 'publish_agent', label: 'Publish Agent' },
  { key: 'modify_agent', label: 'Modify Agent' },
  { key: 'delete_agent', label: 'Delete Agent' },
];

const COMMON_METHODS = [
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/templates/list',
  'GET',
  'POST',
  'PUT',
  'DELETE',
];

// Example scope JSON matching the format from scripts/registry-admins.json
const EXAMPLE_SCOPE_JSON = {
  scope_name: 'currenttime-users',
  description: 'Users with access to currenttime server',
  server_access: [
    {
      server: 'currenttime',
      methods: ['initialize', 'tools/list', 'tools/call'],
      tools: ['current_time_by_timezone'],
    },
  ],
  group_mappings: ['currenttime-users'],
  ui_permissions: {
    list_service: ['currenttime'],
    health_check_service: ['currenttime'],
  },
  create_in_idp: true,
};

// Default entry has all methods selected
const EMPTY_SERVER_ENTRY: ServerAccessEntry = { server: '', methods: [...COMMON_METHODS], tools: [] };


/**
 * Sub-component for selecting tools for a specific server.
 * Uses useServerTools hook to fetch available tools and SearchableSelect for UI.
 */
interface ServerToolsSelectorProps {
  serverPath: string;
  selectedTools: string[];
  onChange: (tools: string[]) => void;
}

const ServerToolsSelector: React.FC<ServerToolsSelectorProps> = ({
  serverPath,
  selectedTools,
  onChange,
}) => {
  const { tools, isLoading } = useServerTools(serverPath);

  // Handle adding a tool
  const handleAddTool = (toolName: string) => {
    if (!toolName) return;

    // If selecting wildcard, replace all with just wildcard
    if (toolName === '*') {
      onChange(['*']);
      return;
    }

    // If wildcard is already selected, don't add specific tools
    if (selectedTools.includes('*')) {
      return;
    }

    // Add tool if not already selected
    if (!selectedTools.includes(toolName)) {
      onChange([...selectedTools, toolName]);
    }
  };

  // Handle removing a tool
  const handleRemoveTool = (toolName: string) => {
    onChange(selectedTools.filter((t) => t !== toolName));
  };

  // If server is wildcard, show message
  if (serverPath === '*') {
    return (
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Tools</label>
        <p className="text-xs text-muted-foreground italic">All tools on all servers</p>
      </div>
    );
  }

  // If no server selected, show disabled state
  if (!serverPath) {
    return (
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Tools</label>
        <p className="text-xs text-muted-foreground italic">Select a server first</p>
      </div>
    );
  }

  // If wildcard is selected, show that with remove option
  if (selectedTools.includes('*')) {
    return (
      <div>
        <label className="block text-xs text-muted-foreground mb-1">Tools</label>
        <div className="flex items-center gap-2">
          <Badge className="bg-primary/10 text-primary">
            * (All tools)
            <button
              type="button"
              onClick={() => handleRemoveTool('*')}
              className="ml-1 hover:text-primary"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        </div>
      </div>
    );
  }

  // Build options from available tools, excluding already selected
  const availableOptions = tools
    .filter((t) => !selectedTools.includes(t.name))
    .map((t) => ({
      value: t.name,
      label: t.name,
      description: t.description,
    }));

  return (
    <div>
      <label className="block text-xs text-muted-foreground mb-1">Tools</label>
      <div className="space-y-2">
        {/* Selected tools as removable tags */}
        {selectedTools.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedTools.map((toolName) => (
              <Badge
                key={toolName}
                className="bg-primary/10 text-primary"
              >
                {toolName}
                <button
                  type="button"
                  onClick={() => handleRemoveTool(toolName)}
                  className="ml-1 hover:text-primary"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        {/* Searchable tool selector */}
        <SearchableSelect
          options={availableOptions}
          value=""
          onChange={handleAddTool}
          placeholder="Search and add tools..."
          isLoading={isLoading}
          maxDescriptionWords={8}
          specialOptions={[
            { value: '*', label: '* (All tools)', description: 'Grant access to all tools on this server' },
          ]}
        />
      </div>
    </div>
  );
};


/**
 * Build the full scope JSON from form state for preview and API payload.
 */
function _buildScopeJson(
  name: string,
  description: string,
  serverAccess: ServerAccessEntry[],
  groupMappings: string,
  selectedAgents: string[],
  uiPermissions: Record<string, string>,
  createInIdp: boolean,
): Record<string, unknown> {
  const result: Record<string, unknown> = { scope_name: name };
  if (description) result.description = description;

  // Convert server access entries
  const access = serverAccess
    .filter((e) => e.server.trim())
    .map((e) => {
      const entry: Record<string, unknown> = {
        server: e.server.trim().replace(/^\/+|\/+$/g, ''),
        methods: e.methods.length > 0 ? e.methods : ['all'],
      };
      // Tools is now an array; check for wildcard or list
      if (e.tools.includes('*')) {
        entry.tools = '*';
      } else if (e.tools.length > 0) {
        entry.tools = e.tools;
      }
      return entry;
    });
  if (access.length > 0) result.server_access = access;

  // Group mappings (optional)
  const mappings = groupMappings
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean);
  if (mappings.length > 0) result.group_mappings = mappings;

  // Agent access (optional)
  if (selectedAgents.length > 0) result.agent_access = selectedAgents;

  // UI permissions -- only include keys that have a non-empty value
  const perms: Record<string, string[]> = {};
  for (const [key, val] of Object.entries(uiPermissions)) {
    const items = val.split(',').map((v) => v.trim()).filter(Boolean);
    if (items.length > 0) perms[key] = items;
  }

  // Auto-sync UI permissions with server_access entries.
  // Normalize server paths (strip slashes) for consistent matching.
  const serverPaths = serverAccess
    .filter((e) => e.server.trim())
    .map((e) => e.server.trim());

  // Separate virtual servers from regular MCP servers
  const virtualServerPaths = serverPaths.filter((p) => p.startsWith('/virtual/'));
  const mcpServerPaths = serverPaths
    .filter((p) => !p.startsWith('/virtual/'))
    .map((p) => p.replace(/^\/+|\/+$/g, ''));

  // Always sync MCP server UI permissions with current server_access
  if (mcpServerPaths.length > 0) {
    perms['list_service'] = mcpServerPaths;
    perms['health_check_service'] = mcpServerPaths;
    perms['get_service'] = mcpServerPaths;
    perms['list_tools'] = mcpServerPaths;
    perms['call_tool'] = mcpServerPaths;
  } else {
    delete perms['list_service'];
    delete perms['health_check_service'];
    delete perms['get_service'];
    delete perms['list_tools'];
    delete perms['call_tool'];
  }

  // Always sync list_virtual_server with selected virtual servers
  if (virtualServerPaths.length > 0) {
    perms['list_virtual_server'] = virtualServerPaths;
  }

  // Always sync list_agents and get_agent with selected agents
  // This ensures UI permissions match the agent_access selection
  if (selectedAgents.length > 0) {
    perms['list_agents'] = selectedAgents;
    perms['get_agent'] = selectedAgents;
  }

  if (Object.keys(perms).length > 0) result.ui_permissions = perms;

  result.create_in_idp = createInIdp;
  return result;
}


const IAMGroups: React.FC<IAMGroupsProps> = ({ onShowToast }) => {
  const { groups, isLoading, error, refetch } = useIAMGroups();
  const { servers: availableServers, isLoading: serversLoading } = useServerList();
  const { agents: availableAgents, isLoading: agentsLoading } = useAgentList();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>('list');

  // ─── Create form state ──────────────────────────────────────
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [serverAccess, setServerAccess] = useState<ServerAccessEntry[]>([{ ...EMPTY_SERVER_ENTRY }]);
  const [groupMappings, setGroupMappings] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [uiPermissions, setUiPermissions] = useState<Record<string, string>>({});
  const [createInIdp, setCreateInIdp] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showUiPermissions, setShowUiPermissions] = useState(false);

  // ─── Edit state ────────────────────────────────────────────
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<GroupDetail | null>(null);
  const [isLoadingGroup, setIsLoadingGroup] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Derived: read-only JSON preview
  const jsonPreview = useMemo(() => {
    if (!formName.trim()) return null;
    return JSON.stringify(
      _buildScopeJson(formName.trim(), formDescription.trim(), serverAccess, groupMappings, selectedAgents, uiPermissions, createInIdp),
      null,
      2,
    );
  }, [formName, formDescription, serverAccess, groupMappings, selectedAgents, uiPermissions, createInIdp]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groups;
    const q = searchQuery.toLowerCase();
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description || '').toLowerCase().includes(q)
    );
  }, [groups, searchQuery]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setServerAccess([{ ...EMPTY_SERVER_ENTRY }]);
    setGroupMappings('');
    setSelectedAgents([]);
    setUiPermissions({});
    setCreateInIdp(true);
  }, []);


  // ─── Handlers ─────────────────────────────────────────────────

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setIsCreating(true);
    try {
      // Build scope_config from form state.
      // The management API currently only processes name/description.
      // scope_config is included for future backend support.
      const scopeJson = _buildScopeJson(
        formName.trim(), formDescription.trim(),
        serverAccess, groupMappings, selectedAgents, uiPermissions, createInIdp,
      );
      const { scope_name, description, ...scopeConfig } = scopeJson;

      const payload: CreateGroupPayload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        scope_config: Object.keys(scopeConfig).length > 0 ? scopeConfig : undefined,
      };
      await createGroup(payload);
      toast.success(`Group "${formName}" created successfully`);
      resetForm();
      setView('list');
      await refetch();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to create group';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (name: string) => {
    await deleteGroup(name);
    toast.success(`Group "${name}" deleted`);
    setDeleteTarget(null);
    await refetch();
  };

  const handleEditClick = async (groupName: string) => {
    setIsLoadingGroup(true);
    setEditingGroup(groupName);
    try {
      const detail = await getGroup(groupName);
      setGroupDetail(detail);

      // Populate form fields with existing group data
      setFormName(detail.name);
      setFormDescription(detail.description || '');

      // Server access - only include entries with actual server values
      if (detail.server_access && detail.server_access.length > 0) {
        const entries: ServerAccessEntry[] = detail.server_access
          .filter((sa) => sa.server && sa.server.trim())
          .map((sa) => ({
            server: sa.server || '',
            methods: sa.methods || [],
            tools: sa.tools || [],
          }));
        setServerAccess(entries.length > 0 ? entries : [{ ...EMPTY_SERVER_ENTRY }]);
      } else {
        setServerAccess([{ ...EMPTY_SERVER_ENTRY }]);
      }

      // Group mappings
      if (detail.group_mappings && detail.group_mappings.length > 0) {
        setGroupMappings(detail.group_mappings.join(', '));
      } else {
        setGroupMappings('');
      }

      // Agent access
      if (detail.agent_access && detail.agent_access.length > 0) {
        setSelectedAgents(detail.agent_access);
      } else {
        setSelectedAgents([]);
      }

      // UI permissions
      if (detail.ui_permissions) {
        const perms: Record<string, string> = {};
        for (const [key, val] of Object.entries(detail.ui_permissions)) {
          perms[key] = Array.isArray(val) ? val.join(', ') : String(val);
        }
        setUiPermissions(perms);
      } else {
        setUiPermissions({});
      }

      setCreateInIdp(true);
      setView('edit');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = typeof detail === 'string' ? detail : 'Failed to load group details';
      toast.error(message);
      setEditingGroup(null);
    } finally {
      setIsLoadingGroup(false);
    }
  };

  const handleUpdate = async () => {
    if (!editingGroup) return;
    setIsSaving(true);
    try {
      // Build scope_config from form state
      const serverAccessPayload = serverAccess
        .filter((e) => e.server.trim())
        .map((e) => {
          // Normalize server path: strip leading/trailing slashes for consistency
          const normalizedServer = e.server.trim().replace(/^\/+|\/+$/g, '');
          const entry: {server: string; methods: string[]; tools?: string[]} = {
            server: normalizedServer,
            methods: e.methods.length > 0 ? e.methods : ['all'],
          };
          if (e.tools.length > 0) {
            entry.tools = e.tools;
          }
          return entry;
        });

      // Build UI permissions
      const perms: Record<string, string[]> = {};
      for (const [key, val] of Object.entries(uiPermissions)) {
        const items = val.split(',').map((v) => v.trim()).filter(Boolean);
        if (items.length > 0) perms[key] = items;
      }

      // Auto-sync UI permissions with server_access entries.
      // Normalize server paths (strip slashes) for consistent matching.
      const serverPaths = serverAccess
        .filter((e) => e.server.trim())
        .map((e) => e.server.trim());

      // Separate virtual servers from regular MCP servers
      const virtualServerPaths = serverPaths.filter((p) => p.startsWith('/virtual/'));
      const mcpServerPaths = serverPaths
        .filter((p) => !p.startsWith('/virtual/'))
        .map((p) => p.replace(/^\/+|\/+$/g, ''));

      // Always sync MCP server UI permissions with current server_access
      // (matches the virtual server sync pattern below)
      if (mcpServerPaths.length > 0) {
        perms['list_service'] = mcpServerPaths;
        perms['health_check_service'] = mcpServerPaths;
        perms['get_service'] = mcpServerPaths;
        perms['list_tools'] = mcpServerPaths;
        perms['call_tool'] = mcpServerPaths;
      } else {
        delete perms['list_service'];
        delete perms['health_check_service'];
        delete perms['get_service'];
        delete perms['list_tools'];
        delete perms['call_tool'];
      }

      // Always sync list_virtual_server with selected virtual servers
      if (virtualServerPaths.length > 0) {
        perms['list_virtual_server'] = virtualServerPaths;
      } else {
        // Remove virtual server permission if none selected
        delete perms['list_virtual_server'];
      }

      // Always sync list_agents and get_agent with selected agents
      // This ensures UI permissions match the agent_access selection
      if (selectedAgents.length > 0) {
        perms['list_agents'] = selectedAgents;
        perms['get_agent'] = selectedAgents;
      } else {
        // Remove agent permissions if no agents selected
        delete perms['list_agents'];
        delete perms['get_agent'];
      }

      const payload: UpdateGroupPayload = {
        description: formDescription.trim() || undefined,
        scope_config: {
          server_access: serverAccessPayload.length > 0 ? serverAccessPayload : undefined,
          ui_permissions: Object.keys(perms).length > 0 ? perms : undefined,
          agent_access: selectedAgents.length > 0 ? selectedAgents : undefined,
        },
      };

      await updateGroup(editingGroup, payload);
      toast.success(`Group "${editingGroup}" updated successfully`);
      resetForm();
      setEditingGroup(null);
      setGroupDetail(null);
      setView('list');
      await refetch();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to update group';
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  // ─── JSON upload sync ─────────────────────────────────────────

  const parseJsonContent = (content: string) => {
    try {
      const parsed = JSON.parse(content);

      // Sync all form fields from uploaded JSON
      if (parsed.scope_name) setFormName(parsed.scope_name);
      if (parsed.description) setFormDescription(parsed.description);
      if (parsed.create_in_idp !== undefined) setCreateInIdp(parsed.create_in_idp);

      // Group mappings (optional)
      if (Array.isArray(parsed.group_mappings)) {
        setGroupMappings(parsed.group_mappings.join(', '));
      }

      // Server access
      if (Array.isArray(parsed.server_access)) {
        const entries: ServerAccessEntry[] = parsed.server_access
          .filter((e: any) => e.server)
          .map((e: any) => ({
            server: e.server || '',
            methods: Array.isArray(e.methods) ? e.methods : [],
            tools: Array.isArray(e.tools) ? e.tools : (e.tools === '*' ? ['*'] : []),
          }));
        if (entries.length > 0) setServerAccess(entries);
      }

      // Agent access (optional)
      if (Array.isArray(parsed.agent_access)) {
        setSelectedAgents(parsed.agent_access);
      }

      // UI permissions
      if (parsed.ui_permissions && typeof parsed.ui_permissions === 'object') {
        const perms: Record<string, string> = {};
        for (const [key, val] of Object.entries(parsed.ui_permissions)) {
          perms[key] = Array.isArray(val) ? (val as string[]).join(', ') : String(val);
        }
        setUiPermissions(perms);
      }

      toast.success('JSON loaded');
    } catch {
      toast.error('Invalid JSON file');
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseJsonContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => parseJsonContent(ev.target?.result as string);
    reader.readAsText(file);
  };

  const downloadExampleJson = () => {
    const blob = new Blob([JSON.stringify(EXAMPLE_SCOPE_JSON, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'example-group-scope.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  // ─── Server access helpers ────────────────────────────────────

  const updateServerEntry = (idx: number, field: keyof ServerAccessEntry, value: any) => {
    setServerAccess((prev) => prev.map((e, i) => (i === idx ? { ...e, [field]: value } : e)));
  };

  const toggleMethod = (idx: number, method: string) => {
    setServerAccess((prev) =>
      prev.map((e, i) => {
        if (i !== idx) return e;
        const methods = e.methods.includes(method)
          ? e.methods.filter((m) => m !== method)
          : [...e.methods, method];
        return { ...e, methods };
      }),
    );
  };

  const addServerEntry = () => setServerAccess((prev) => [...prev, { ...EMPTY_SERVER_ENTRY }]);
  const removeServerEntry = (idx: number) => setServerAccess((prev) => prev.filter((_, i) => i !== idx));

  // ─── UI permission helpers ────────────────────────────────────

  const setPermValue = (key: string, value: string) => {
    setUiPermissions((prev) => {
      if (!value.trim()) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  // ─── Shared form sections ─────────────────────────────────────

  const renderServerAccessSection = () => (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">Server Access</p>
        <Button variant="link" size="sm" onClick={addServerEntry}>
          + Add Server
        </Button>
      </div>
      {serversLoading && (
        <p className="text-xs text-muted-foreground">Loading servers...</p>
      )}
      {serverAccess.map((entry, idx) => (
          <div key={idx} className="border border-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Server {idx + 1}
              </span>
              {serverAccess.length > 1 && (
                <Button variant="link" size="sm" onClick={() => removeServerEntry(idx)} className="text-red-500">
                  Remove
                </Button>
              )}
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Server</label>
              <SearchableSelect
                options={availableServers.map((s) => ({
                  value: s.path,
                  label: `${s.type === 'virtual' ? '[Virtual] ' : ''}${s.name} (${s.path})`,
                  description: s.description,
                }))}
                value={entry.server}
                onChange={(val) => {
                  updateServerEntry(idx, 'server', val);
                  // Reset tools when server changes
                  updateServerEntry(idx, 'tools', []);
                }}
                placeholder="Search servers..."
                isLoading={serversLoading}
                maxDescriptionWords={8}
                specialOptions={[
                  { value: '*', label: '* (All servers)', description: 'Grant access to all servers' },
                ]}
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Methods</label>
              <div className="flex flex-wrap gap-2">
                {COMMON_METHODS.map((method) => (
                  <label key={method} className="flex items-center space-x-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={entry.methods.includes(method)}
                      onChange={() => toggleMethod(idx, method)}
                      className="rounded border-border text-primary focus:ring-ring h-3 w-3"
                    />
                    <span className="text-xs text-muted-foreground">{method}</span>
                  </label>
                ))}
              </div>
            </div>
            <ServerToolsSelector
              serverPath={entry.server}
              selectedTools={entry.tools}
              onChange={(tools) => updateServerEntry(idx, 'tools', tools)}
            />
          </div>
      ))}
    </div>
  );

  const renderAgentAccessSection = () => (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">
        Agent Access
        <span className="text-xs text-muted-foreground ml-1">(optional)</span>
      </p>
      {/* Selected agents as removable tags */}
      {selectedAgents.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedAgents.map((agentName) => (
            <Badge
              key={agentName}
              className="bg-primary/10 text-primary"
            >
              {agentName}
              <button
                type="button"
                onClick={() => setSelectedAgents((prev) => prev.filter((a) => a !== agentName))}
                className="ml-1 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
      {/* Searchable agent selector */}
      <SearchableSelect
        options={availableAgents
          .filter((a) => !selectedAgents.includes(a.path))
          .map((a) => ({
            value: a.path,
            label: `${a.name} (${a.path})`,
            description: a.description,
          }))}
        value=""
        onChange={(val) => {
          if (val && !selectedAgents.includes(val)) {
            setSelectedAgents((prev) => [...prev, val]);
          }
        }}
        placeholder="Search and add agents..."
        isLoading={agentsLoading}
        maxDescriptionWords={8}
      />
    </div>
  );

  const renderUiPermissionsSection = () => (
    <div className="space-y-3">
      <button
        type="button"
        onClick={() => setShowUiPermissions(!showUiPermissions)}
        className="flex items-center space-x-2 text-sm font-medium text-foreground hover:text-foreground"
      >
        {showUiPermissions ? (
          <ChevronDown className="h-4 w-4" />
        ) : (
          <ChevronRight className="h-4 w-4" />
        )}
        <span>
          UI Permissions
          <span className="text-xs text-muted-foreground ml-1">(enter "all" or a comma-separated list of service/agent names)</span>
        </span>
      </button>
      {showUiPermissions && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pl-6">
          {UI_PERMISSION_KEYS.map(({ key, label }) => (
            <div key={key}>
              <label className="block text-xs text-muted-foreground mb-1">{label}</label>
              <Input
                type="text"
                value={uiPermissions[key] || ''}
                onChange={(e) => setPermValue(key, e.target.value)}
                placeholder="e.g. all or currenttime, mcpgw"
                className="text-sm"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // ─── Create View ──────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            IAM &gt; Groups &gt; Create
          </h2>
          <Button
            variant="ghost"
            onClick={() => { resetForm(); setView('list'); }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to List
          </Button>
        </div>

        {/* ── Basic Info ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Group Name *</label>
            <Input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="e.g. currenttime-users"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Description</label>
            <Input
              type="text"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              placeholder="Optional description"
            />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">
              Group Mappings
              <span className="text-xs text-muted-foreground ml-1">(optional, comma-separated)</span>
            </label>
            <Input
              type="text"
              value={groupMappings}
              onChange={(e) => setGroupMappings(e.target.value)}
              placeholder="e.g. currenttime-users, other-group"
            />
          </div>
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={createInIdp}
              onChange={(e) => setCreateInIdp(e.target.checked)}
              className="rounded border-border text-primary focus:ring-ring"
            />
            <label className="text-sm text-muted-foreground">
              Create in Identity Provider (Keycloak / Entra ID)
            </label>
          </div>
        </div>

        {/* ── Server Access ──────────────────────────────────── */}
        {renderServerAccessSection()}

        {/* ── Agent Access ──────────────────────────────────── */}
        {renderAgentAccessSection()}

        {/* ── UI Permissions (collapsible) ───────────────────── */}
        {renderUiPermissionsSection()}

        {/* ── JSON Upload / Preview ──────────────────────────── */}
        <div className="space-y-4">
          <p className="text-sm font-medium text-foreground">
            Or Upload JSON Configuration
          </p>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className="border-2 border-dashed border-border rounded-lg p-6
                       text-center hover:border-primary dark:hover:border-primary transition-colors"
          >
            <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground mb-1">
              Drag &amp; drop a scope JSON file here
            </p>
            <label className="cursor-pointer text-sm text-primary hover:underline">
              or click to browse
              <input type="file" accept=".json" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>

          {jsonPreview && (
            <div>
              <p className="text-sm font-medium text-foreground mb-2">
                JSON Preview (auto-generated from form):
              </p>
              <pre className="bg-muted border border-border
                              rounded-lg p-4 text-xs font-mono text-foreground
                              overflow-auto max-h-64">
                {jsonPreview}
              </pre>
            </div>
          )}

          <Button variant="link" onClick={downloadExampleJson}>
            <Download className="h-4 w-4 mr-1" />
            Download Example JSON
          </Button>
        </div>

        {/* ── Actions ────────────────────────────────────────── */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button
            variant="secondary"
            onClick={() => { resetForm(); setView('list'); }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!formName.trim() || isCreating}
          >
            {isCreating ? 'Creating...' : 'Create Group'}
          </Button>
        </div>
      </div>
    );
  }


  // ─── Edit View ───────────────────────────────────────────────
  if (view === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            IAM &gt; Groups &gt; Edit: {editingGroup}
          </h2>
          <Button
            variant="ghost"
            onClick={() => { resetForm(); setEditingGroup(null); setGroupDetail(null); setView('list'); }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to List
          </Button>
        </div>

        {isLoadingGroup && (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
          </div>
        )}

        {!isLoadingGroup && (
          <>
            {/* ── Basic Info ─────────────────────────────────────── */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Group Name</label>
                <Input
                  type="text"
                  value={formName}
                  disabled
                  className="bg-muted text-muted-foreground cursor-not-allowed"
                />
                <p className="text-xs text-muted-foreground mt-1">Group name cannot be changed</p>
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">Description</label>
                <Input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm text-muted-foreground mb-1">
                  Group Mappings
                  <span className="text-xs text-muted-foreground ml-1">(optional, comma-separated)</span>
                </label>
                <Input
                  type="text"
                  value={groupMappings}
                  onChange={(e) => setGroupMappings(e.target.value)}
                  placeholder="e.g. currenttime-users, other-group"
                />
              </div>
            </div>

            {/* ── Server Access ──────────────────────────────────── */}
            {renderServerAccessSection()}

            {/* ── Agent Access ──────────────────────────────────── */}
            {renderAgentAccessSection()}

            {/* ── UI Permissions (collapsible) ───────────────────── */}
            {renderUiPermissionsSection()}

            {/* ── JSON Preview ──────────────────────────────────────── */}
            {jsonPreview && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-foreground mb-2">
                    JSON Preview (auto-generated from form):
                  </p>
                  <pre className="bg-muted border border-border
                                  rounded-lg p-4 text-xs font-mono text-foreground
                                  overflow-auto max-h-64">
                    {jsonPreview}
                  </pre>
                </div>
              </div>
            )}

            {/* ── Actions ────────────────────────────────────────── */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-border">
              <Button
                variant="secondary"
                onClick={() => { resetForm(); setEditingGroup(null); setGroupDetail(null); setView('list'); }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpdate}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </>
        )}
      </div>
    );
  }


  // ─── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">
          IAM &gt; Groups
        </h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={refetch} title="Refresh">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button onClick={() => setView('create')}>
            <Plus className="h-4 w-4 mr-1" />
            Create Group
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search groups..."
          className="w-full pl-10 pr-4 text-sm"
        />
      </div>

      {/* Loading / Error / Empty states */}
      {isLoading && (
        <div className="flex justify-center py-12">
          <RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" />
        </div>
      )}

      {error && !isLoading && (
        <div className="text-center py-8 text-destructive text-sm">{error}</div>
      )}

      {!isLoading && !error && filteredGroups.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No groups match your search.' : 'No groups yet. Create your first group.'}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && filteredGroups.length > 0 && (
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Description</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Path</TableHead>
                <TableHead className="text-right py-3 px-4 font-medium text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGroups.map((group) => (
                <React.Fragment key={group.name}>
                  <TableRow className="border-b border-border hover:bg-accent">
                    <TableCell className="py-3 px-4 text-foreground font-medium">{group.name}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground">{group.description || '\u2014'}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground font-mono text-xs">{group.path || '\u2014'}</TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleEditClick(group.name)}
                        title="Edit group"
                        disabled={isLoadingGroup && editingGroup === group.name}
                        className="mr-1"
                      >
                        {isLoadingGroup && editingGroup === group.name ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pencil className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => setDeleteTarget(group.name)}
                        title="Delete group"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {deleteTarget === group.name && (
                    <TableRow>
                      <TableCell colSpan={4} className="p-2">
                        <DeleteConfirmation
                          entityType="group"
                          entityName={group.name}
                          entityPath={group.name}
                          onConfirm={handleDelete}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default IAMGroups;
