import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  CloudUpload,
  FileText,
  Server,
  Cpu,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';


type RegistrationType = 'server' | 'agent';
type RegistrationMode = 'form' | 'json';


interface ServerFormData {
  name: string;
  description: string;
  path: string;
  proxy_pass_url: string;
  tags: string;
  visibility: string;
  repository_url: string;
  mcp_endpoint: string;
  sse_endpoint: string;
  metadata: string;
  auth_scheme: string;
  auth_credential: string;
  auth_header_name: string;
  status: string;
  provider_organization: string;
  provider_url: string;
  source_created_at: string;
  source_updated_at: string;
}


interface AgentFormData {
  name: string;
  description: string;
  url: string;
  path: string;
  protocol_version: string;
  version: string;
  tags: string;
  capabilities: string;
  visibility: string;
  repository_url: string;
  streaming: boolean;
  status: string;
  provider_organization: string;
  provider_url: string;
  source_created_at: string;
  source_updated_at: string;
}


interface FormErrors {
  [key: string]: string;
}


const initialServerForm: ServerFormData = {
  name: '',
  description: '',
  path: '',
  proxy_pass_url: '',
  tags: '',
  visibility: 'public',
  repository_url: '',
  mcp_endpoint: '',
  sse_endpoint: '',
  metadata: '',
  auth_scheme: 'none',
  auth_credential: '',
  auth_header_name: 'X-API-Key',
  status: 'active',
  provider_organization: '',
  provider_url: '',
  source_created_at: '',
  source_updated_at: '',
};


const initialAgentForm: AgentFormData = {
  name: '',
  description: '',
  url: '',
  path: '',
  protocol_version: '1.0',
  version: '1.0.0',
  tags: '',
  capabilities: '',
  visibility: 'public',
  repository_url: '',
  streaming: false,
  status: 'active',
  provider_organization: '',
  provider_url: '',
  source_created_at: '',
  source_updated_at: '',
};


const RegisterPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [registrationType, setRegistrationType] = useState<RegistrationType>('server');
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>('form');
  const [serverForm, setServerForm] = useState<ServerFormData>(initialServerForm);
  const [agentForm, setAgentForm] = useState<AgentFormData>(initialAgentForm);
  const [jsonContent, setJsonContent] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(false);


  const generatePath = useCallback((name: string): string => {
    if (!name) return '';
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return `/${slug}`;
  }, []);


  const handleServerNameChange = useCallback((name: string) => {
    setServerForm(prev => ({
      ...prev,
      name,
      path: prev.path || generatePath(name),
    }));
  }, [generatePath]);


  const handleAgentNameChange = useCallback((name: string) => {
    setAgentForm(prev => ({
      ...prev,
      name,
      path: prev.path || generatePath(name),
    }));
  }, [generatePath]);


  const validateServerForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!serverForm.name.trim()) {
      newErrors.name = 'Server name is required';
    }

    if (!serverForm.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!serverForm.path.trim()) {
      newErrors.path = 'Path is required';
    } else if (!serverForm.path.startsWith('/')) {
      newErrors.path = 'Path must start with /';
    }

    if (!serverForm.proxy_pass_url.trim()) {
      newErrors.proxy_pass_url = 'Proxy URL is required';
    } else {
      try {
        new URL(serverForm.proxy_pass_url);
      } catch {
        newErrors.proxy_pass_url = 'Invalid URL format';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [serverForm]);


  const validateAgentForm = useCallback((): boolean => {
    const newErrors: FormErrors = {};

    if (!agentForm.name.trim()) {
      newErrors.name = 'Agent name is required';
    }

    if (!agentForm.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (!agentForm.url.trim()) {
      newErrors.url = 'Agent URL is required';
    } else {
      try {
        const url = new URL(agentForm.url);
        if (!['http:', 'https:'].includes(url.protocol)) {
          newErrors.url = 'URL must use HTTP or HTTPS protocol';
        }
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }

    if (agentForm.path && !agentForm.path.startsWith('/')) {
      newErrors.path = 'Path must start with /';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [agentForm]);


  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const parsed = JSON.parse(content);
        setJsonContent(JSON.stringify(parsed, null, 2));

        // Auto-populate form fields from JSON
        if (registrationType === 'server') {
          // Helper to convert ISO timestamp to datetime-local format
          const toDatetimeLocal = (isoString: string) => {
            if (!isoString) return '';
            try {
              const date = new Date(isoString);
              return date.toISOString().slice(0, 16);
            } catch {
              return '';
            }
          };

          setServerForm(prev => ({
            ...prev,
            name: parsed.server_name || parsed.name || prev.name,
            description: parsed.description || prev.description,
            path: parsed.path || prev.path,
            proxy_pass_url: parsed.proxy_pass_url || parsed.proxyPassUrl || prev.proxy_pass_url,
            tags: Array.isArray(parsed.tags) ? parsed.tags.join(',') : (parsed.tags || prev.tags),
            visibility: parsed.visibility || prev.visibility,
            repository_url: parsed.repository_url || parsed.repositoryUrl || prev.repository_url,
            mcp_endpoint: parsed.mcp_endpoint || parsed.mcpEndpoint || prev.mcp_endpoint,
            sse_endpoint: parsed.sse_endpoint || parsed.sseEndpoint || prev.sse_endpoint,
            metadata: parsed.metadata ? JSON.stringify(parsed.metadata, null, 2) : prev.metadata,
            status: parsed.status || prev.status,
            provider_organization: parsed.provider_organization || prev.provider_organization,
            provider_url: parsed.provider_url || prev.provider_url,
            source_created_at: toDatetimeLocal(parsed.source_created_at) || prev.source_created_at,
            source_updated_at: toDatetimeLocal(parsed.source_updated_at) || prev.source_updated_at,
          }));
        } else {
          // Helper to convert ISO timestamp to datetime-local format
          const toDatetimeLocal = (isoString: string) => {
            if (!isoString) return '';
            try {
              const date = new Date(isoString);
              return date.toISOString().slice(0, 16);
            } catch {
              return '';
            }
          };

          setAgentForm(prev => ({
            ...prev,
            name: parsed.name || prev.name,
            description: parsed.description || prev.description,
            url: parsed.url || prev.url,
            path: parsed.path || prev.path,
            protocol_version: parsed.protocol_version || parsed.protocolVersion || prev.protocol_version,
            version: parsed.version || prev.version,
            tags: Array.isArray(parsed.tags) ? parsed.tags.join(',') : (parsed.tags || prev.tags),
            capabilities: parsed.capabilities ? JSON.stringify(parsed.capabilities) : prev.capabilities,
            visibility: parsed.visibility || prev.visibility,
            repository_url: parsed.repository_url || parsed.repositoryUrl || prev.repository_url,
            streaming: parsed.streaming || parsed.capabilities?.streaming || prev.streaming,
            status: parsed.status || prev.status,
            provider_organization: parsed.provider?.organization || parsed.provider_organization || prev.provider_organization,
            provider_url: parsed.provider?.url || parsed.provider_url || prev.provider_url,
            source_created_at: toDatetimeLocal(parsed.source_created_at) || prev.source_created_at,
            source_updated_at: toDatetimeLocal(parsed.source_updated_at) || prev.source_updated_at,
          }));
        }

        toast.success('JSON file loaded successfully');
      } catch {
        toast.error('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, [registrationType]);


  const handleServerSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!validateServerForm()) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('name', serverForm.name);
      formData.append('description', serverForm.description);
      formData.append('path', serverForm.path);
      formData.append('proxy_pass_url', serverForm.proxy_pass_url);
      formData.append('tags', serverForm.tags);
      if (serverForm.mcp_endpoint) {
        formData.append('mcp_endpoint', serverForm.mcp_endpoint);
      }
      if (serverForm.sse_endpoint) {
        formData.append('sse_endpoint', serverForm.sse_endpoint);
      }
      if (serverForm.metadata) {
        formData.append('metadata', serverForm.metadata);
      }
      if (serverForm.auth_scheme !== 'none') {
        formData.append('auth_scheme', serverForm.auth_scheme);
        if (serverForm.auth_credential) {
          formData.append('auth_credential', serverForm.auth_credential);
        }
        if (serverForm.auth_scheme === 'api_key' && serverForm.auth_header_name) {
          formData.append('auth_header_name', serverForm.auth_header_name);
        }
      }

      // Add new lifecycle and federation fields
      if (serverForm.status) {
        formData.append('status', serverForm.status);
      }
      if (serverForm.provider_organization) {
        formData.append('provider_organization', serverForm.provider_organization);
      }
      if (serverForm.provider_url) {
        formData.append('provider_url', serverForm.provider_url);
      }
      if (serverForm.source_created_at) {
        formData.append('source_created_at', serverForm.source_created_at);
      }
      if (serverForm.source_updated_at) {
        formData.append('source_updated_at', serverForm.source_updated_at);
      }

      await axios.post('/api/register', formData, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });

      toast.success('Server registered successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string; error?: string; reason?: string } } };
      const message = axiosError.response?.data?.error
        || axiosError.response?.data?.reason
        || axiosError.response?.data?.detail
        || 'Failed to register server';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loading, serverForm, validateServerForm, navigate]);


  const handleAgentSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (!validateAgentForm()) return;

    setLoading(true);

    try {
      const payload = {
        name: agentForm.name,
        description: agentForm.description,
        url: agentForm.url,
        path: agentForm.path || undefined,
        protocolVersion: agentForm.protocol_version,
        version: agentForm.version,
        tags: agentForm.tags,
        visibility: agentForm.visibility,
        streaming: agentForm.streaming,
        status: agentForm.status || 'active',
        provider: agentForm.provider_organization ? {
          organization: agentForm.provider_organization,
          url: agentForm.provider_url || agentForm.url,
        } : undefined,
        source_created_at: agentForm.source_created_at || undefined,
        source_updated_at: agentForm.source_updated_at || undefined,
      };

      await axios.post('/api/agents/register', payload, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      toast.success('Agent registered successfully!');
      setTimeout(() => navigate('/'), 1500);
    } catch (error: unknown) {
      const axiosError = error as { response?: { data?: { detail?: string | { message?: string } } } };
      let message = 'Failed to register agent';
      if (axiosError.response?.data?.detail) {
        if (typeof axiosError.response.data.detail === 'string') {
          message = axiosError.response.data.detail;
        } else if (axiosError.response.data.detail.message) {
          message = axiosError.response.data.detail.message;
        }
      }
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, [loading, agentForm, validateAgentForm, navigate]);


  const inputClass = "block w-full px-3 py-2 border border-border rounded-md bg-card text-foreground focus:ring-ring focus:border-ring";
  const labelClass = "block text-sm font-medium text-foreground mb-1";
  const errorClass = "mt-1 text-sm text-destructive";


  const renderServerForm = () => (
    <form onSubmit={handleServerSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Required Fields */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs mr-2">Required</span>
            Basic Information
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Server Name *</Label>
          <Input
            type="text"
            required
            className={errors.name ? 'border-destructive' : ''}
            value={serverForm.name}
            onChange={(e) => handleServerNameChange(e.target.value)}
            placeholder="e.g., My Custom Server"
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <Label className={labelClass}>Path *</Label>
          <Input
            type="text"
            required
            className={errors.path ? 'border-destructive' : ''}
            value={serverForm.path}
            onChange={(e) => setServerForm(prev => ({ ...prev, path: e.target.value }))}
            placeholder="/my-server"
          />
          <p className="mt-1 text-xs text-muted-foreground">Auto-generated from name, but can be customized</p>
          {errors.path && <p className={errorClass}>{errors.path}</p>}
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Proxy URL *</Label>
          <Input
            type="url"
            required
            className={errors.proxy_pass_url ? 'border-destructive' : ''}
            value={serverForm.proxy_pass_url}
            onChange={(e) => setServerForm(prev => ({ ...prev, proxy_pass_url: e.target.value }))}
            placeholder="http://localhost:8080"
          />
          {errors.proxy_pass_url && <p className={errorClass}>{errors.proxy_pass_url}</p>}
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Description *</Label>
          <Textarea
            required
            className={errors.description ? 'border-destructive' : ''}
            rows={3}
            value={serverForm.description}
            onChange={(e) => setServerForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Brief description of the server and its capabilities"
          />
            {errors.description && <p className={errorClass}>{errors.description}</p>}
        </div>

        {/* Optional Fields */}
        <div className="md:col-span-2 mt-4">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-secondary text-muted-foreground px-2 py-1 rounded text-xs mr-2">Optional</span>
            Additional Settings
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Tags</Label>
          <Input
            type="text"
            value={serverForm.tags}
            onChange={(e) => setServerForm(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="tag1, tag2, tag3"
          />
          <p className="mt-1 text-xs text-muted-foreground">Comma-separated list</p>
        </div>

        <div>
          <Label className={labelClass}>Visibility</Label>
          <Select
            value={serverForm.visibility}
            onValueChange={(val) => setServerForm(prev => ({ ...prev, visibility: val }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="group-restricted">Group Restricted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Repository URL</Label>
          <Input
            type="url"
            value={serverForm.repository_url}
            onChange={(e) => setServerForm(prev => ({ ...prev, repository_url: e.target.value }))}
            placeholder="https://github.com/username/repo"
          />
        </div>

        {/* Backend Authentication */}
        <div className="md:col-span-2 mt-4">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs mr-2">Optional</span>
            Backend Authentication
          </h3>
          <p className="text-sm text-muted-foreground -mt-2 mb-4">
            Configure credentials the gateway will use when proxying requests to your backend MCP server.
          </p>
        </div>

        <div>
          <Label className={labelClass}>Authentication Scheme</Label>
          <Select
            value={serverForm.auth_scheme}
            onValueChange={(newScheme) => {
              setServerForm(prev => ({
                ...prev,
                auth_scheme: newScheme,
                auth_credential: newScheme === 'none' ? '' : prev.auth_credential,
                auth_header_name: newScheme === 'api_key' ? prev.auth_header_name : 'X-API-Key',
              }));
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="bearer">Bearer Token</SelectItem>
              <SelectItem value="api_key">API Key</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {serverForm.auth_scheme !== 'none' && (
          <div>
            <Label className={labelClass}>
              {serverForm.auth_scheme === 'bearer' ? 'Bearer Token' : 'API Key'} *
            </Label>
            <Input
              type="password"
              value={serverForm.auth_credential}
              onChange={(e) => setServerForm(prev => ({ ...prev, auth_credential: e.target.value }))}
              placeholder={serverForm.auth_scheme === 'bearer' ? 'Enter bearer token' : 'Enter API key'}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This credential is stored securely and never displayed after saving.
            </p>
          </div>
        )}

        {serverForm.auth_scheme === 'api_key' && (
          <div>
            <Label className={labelClass}>Header Name</Label>
            <Input
              type="text"
              value={serverForm.auth_header_name}
              onChange={(e) => setServerForm(prev => ({ ...prev, auth_header_name: e.target.value }))}
              placeholder="X-API-Key"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              The HTTP header name used to send the API key (default: X-API-Key)
            </p>
          </div>
        )}

        {/* Advanced Settings */}
        <div className="md:col-span-2 mt-4">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-secondary text-muted-foreground px-2 py-1 rounded text-xs mr-2">Advanced</span>
            Custom Endpoints & Metadata
          </h3>
        </div>

        <div>
          <Label className={labelClass}>MCP Endpoint (optional)</Label>
          <Input
            type="url"
            value={serverForm.mcp_endpoint}
            onChange={(e) => setServerForm(prev => ({ ...prev, mcp_endpoint: e.target.value }))}
            placeholder="http://server.com/custom-mcp-path"
          />
          <p className="mt-1 text-xs text-muted-foreground">Override default /mcp endpoint path</p>
        </div>

        <div>
          <Label className={labelClass}>SSE Endpoint (optional)</Label>
          <Input
            type="url"
            value={serverForm.sse_endpoint}
            onChange={(e) => setServerForm(prev => ({ ...prev, sse_endpoint: e.target.value }))}
            placeholder="http://server.com/custom-sse-path"
          />
          <p className="mt-1 text-xs text-muted-foreground">Override default /sse endpoint path</p>
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Metadata (optional, JSON)</Label>
          <Textarea
            rows={3}
            value={serverForm.metadata}
            onChange={(e) => setServerForm(prev => ({ ...prev, metadata: e.target.value }))}
            placeholder='{"team": "platform", "owner": "alice@example.com", "cost_center": "CC-1001"}'
          />
          <p className="mt-1 text-xs text-muted-foreground">Custom key-value pairs for organization, compliance, or integration purposes</p>
        </div>
      </div>

      {/* Lifecycle & Provider Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-foreground mb-4">
            Lifecycle & Provider Information
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Status</Label>
          <Select
            value={serverForm.status}
            onValueChange={(val) => setServerForm(prev => ({ ...prev, status: val }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Lifecycle status of this server</p>
        </div>

        <div>
          <Label className={labelClass}>Provider Organization</Label>
          <Input
            type="text"
            value={serverForm.provider_organization}
            onChange={(e) => setServerForm(prev => ({ ...prev, provider_organization: e.target.value }))}
            placeholder="ACME Inc."
          />
          <p className="mt-1 text-xs text-muted-foreground">Organization providing this server</p>
        </div>

        <div>
          <Label className={labelClass}>Provider URL</Label>
          <Input
            type="url"
            value={serverForm.provider_url}
            onChange={(e) => setServerForm(prev => ({ ...prev, provider_url: e.target.value }))}
            placeholder="https://example.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">Provider's website or documentation URL</p>
        </div>

      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register Server'}
        </Button>
      </div>
    </form>
  );


  const renderAgentForm = () => (
    <form onSubmit={handleAgentSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Required Fields */}
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded text-xs mr-2">Required</span>
            Basic Information
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Agent Name *</Label>
          <Input
            type="text"
            required
            className={errors.name ? 'border-destructive' : ''}
            value={agentForm.name}
            onChange={(e) => handleAgentNameChange(e.target.value)}
            placeholder="e.g., My AI Agent"
          />
          {errors.name && <p className={errorClass}>{errors.name}</p>}
        </div>

        <div>
          <Label className={labelClass}>Path (auto-generated)</Label>
          <Input
            type="text"
            className={errors.path ? 'border-destructive' : ''}
            value={agentForm.path}
            onChange={(e) => setAgentForm(prev => ({ ...prev, path: e.target.value }))}
            placeholder="/my-agent"
          />
          <p className="mt-1 text-xs text-muted-foreground">Leave empty to auto-generate from name</p>
          {errors.path && <p className={errorClass}>{errors.path}</p>}
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Agent URL *</Label>
          <Input
            type="url"
            required
            className={errors.url ? 'border-destructive' : ''}
            value={agentForm.url}
            onChange={(e) => setAgentForm(prev => ({ ...prev, url: e.target.value }))}
            placeholder="https://my-agent.example.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">The endpoint URL where the agent can be reached</p>
          {errors.url && <p className={errorClass}>{errors.url}</p>}
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Description *</Label>
          <Textarea
            required
            className={errors.description ? 'border-destructive' : ''}
            rows={3}
            value={agentForm.description}
            onChange={(e) => setAgentForm(prev => ({ ...prev, description: e.target.value }))}
            placeholder="Describe what your agent does and its capabilities"
          />
          {errors.description && <p className={errorClass}>{errors.description}</p>}
        </div>

        {/* Optional Fields */}
        <div className="md:col-span-2 mt-4">
          <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
            <span className="bg-secondary text-muted-foreground px-2 py-1 rounded text-xs mr-2">Optional</span>
            Additional Settings
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Protocol Version</Label>
          <Input
            type="text"
            value={agentForm.protocol_version}
            onChange={(e) => setAgentForm(prev => ({ ...prev, protocol_version: e.target.value }))}
            placeholder="1.0"
          />
        </div>

        <div>
          <Label className={labelClass}>Agent Version</Label>
          <Input
            type="text"
            value={agentForm.version}
            onChange={(e) => setAgentForm(prev => ({ ...prev, version: e.target.value }))}
            placeholder="1.0.0"
          />
        </div>

        <div>
          <Label className={labelClass}>Tags</Label>
          <Input
            type="text"
            value={agentForm.tags}
            onChange={(e) => setAgentForm(prev => ({ ...prev, tags: e.target.value }))}
            placeholder="ai, assistant, nlp"
          />
          <p className="mt-1 text-xs text-muted-foreground">Comma-separated list</p>
        </div>

        <div>
          <Label className={labelClass}>Visibility</Label>
          <Select
            value={agentForm.visibility}
            onValueChange={(val) => setAgentForm(prev => ({ ...prev, visibility: val }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="public">Public</SelectItem>
              <SelectItem value="private">Private</SelectItem>
              <SelectItem value="group-restricted">Group Restricted</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center">
          <label className="flex items-center">
            <input
              type="checkbox"
              className="h-4 w-4 text-primary focus:ring-ring border-border rounded"
              checked={agentForm.streaming}
              onChange={(e) => setAgentForm(prev => ({ ...prev, streaming: e.target.checked }))}
            />
            <span className="ml-2 text-sm text-foreground">Supports streaming responses</span>
          </label>
        </div>

        <div className="md:col-span-2">
          <Label className={labelClass}>Repository URL</Label>
          <Input
            type="url"
            value={agentForm.repository_url}
            onChange={(e) => setAgentForm(prev => ({ ...prev, repository_url: e.target.value }))}
            placeholder="https://github.com/username/repo"
          />
        </div>
      </div>

      {/* Lifecycle & Provider Information */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="md:col-span-2">
          <h3 className="text-lg font-medium text-foreground mb-4">
            Lifecycle & Provider Information
          </h3>
        </div>

        <div>
          <Label className={labelClass}>Status</Label>
          <Select
            value={agentForm.status}
            onValueChange={(val) => setAgentForm(prev => ({ ...prev, status: val }))}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="beta">Beta</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="deprecated">Deprecated</SelectItem>
            </SelectContent>
          </Select>
          <p className="mt-1 text-xs text-muted-foreground">Lifecycle status of this agent</p>
        </div>

        <div>
          <Label className={labelClass}>Provider Organization</Label>
          <Input
            type="text"
            value={agentForm.provider_organization}
            onChange={(e) => setAgentForm(prev => ({ ...prev, provider_organization: e.target.value }))}
            placeholder="ACME Inc."
          />
          <p className="mt-1 text-xs text-muted-foreground">Organization providing this agent</p>
        </div>

        <div>
          <Label className={labelClass}>Provider URL</Label>
          <Input
            type="url"
            value={agentForm.provider_url}
            onChange={(e) => setAgentForm(prev => ({ ...prev, provider_url: e.target.value }))}
            placeholder="https://example.com"
          />
          <p className="mt-1 text-xs text-muted-foreground">Provider's website or documentation URL</p>
        </div>

      </div>

      <div className="flex justify-end space-x-3 pt-6 border-t border-border">
        <Button
          type="button"
          variant="secondary"
          onClick={() => navigate('/')}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register Agent'}
        </Button>
      </div>
    </form>
  );


  const renderJsonUpload = () => (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
        <CloudUpload className="mx-auto h-12 w-12 text-muted-foreground" />
        <div className="mt-4">
          <label htmlFor="json-upload" className="cursor-pointer">
            <span className="text-primary hover:text-primary/80 font-medium">
              Upload a file
            </span>
            <span className="text-muted-foreground"> or drag and drop</span>
          </label>
          <input
            id="json-upload"
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {registrationType === 'server' ? 'modelcard.json' : 'agentcard.json'} (JSON format)
        </p>
      </div>

      {/* JSON Preview */}
      {jsonContent && (
        <div>
          <Label className={labelClass}>JSON Preview</Label>
          <div className="relative">
            <pre className="bg-muted border border-border rounded-lg p-4 overflow-auto max-h-64 text-sm text-foreground">
              {jsonContent}
            </pre>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
        <div className="flex">
          <Info className="h-5 w-5 text-primary flex-shrink-0" />
          <div className="ml-3">
            <h4 className="text-sm font-medium text-primary">
              About JSON Upload
            </h4>
            <p className="mt-1 text-sm text-primary">
              Upload a {registrationType === 'server' ? 'modelcard.json' : 'agentcard.json'} file to automatically populate the form fields.
              You can then review and modify the values before submitting.
            </p>
          </div>
        </div>
      </div>

      {/* Render the appropriate form below */}
      {jsonContent && (
        <div className="pt-6 border-t border-border">
          <h3 className="text-lg font-medium text-foreground mb-4">
            Review and Submit
          </h3>
          {registrationType === 'server' ? renderServerForm() : renderAgentForm()}
        </div>
      )}

      {/* Cancel button when no JSON loaded */}
      {!jsonContent && (
        <div className="flex justify-end pt-6 border-t border-border">
          <Button
            type="button"
            variant="secondary"
            onClick={() => navigate('/')}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  );


  // Check permissions
  const canRegisterServer = (user?.ui_permissions?.register_service?.length ?? 0) > 0;
  const canRegisterAgent = (user?.ui_permissions?.publish_agent?.length ?? 0) > 0;

  if (!canRegisterServer && !canRegisterAgent) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-muted border border-border rounded-lg p-6 text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground" />
          <h3 className="mt-4 text-lg font-medium text-muted-foreground">
            Permission Required
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            You do not have permission to register servers or agents.
            Please contact an administrator to request access.
          </p>
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            className="mt-4"
          >
            Return to Dashboard
          </Button>
        </div>
      </div>
    );
  }


  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          onClick={() => navigate('/')}
          className="flex items-center text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Dashboard
        </Button>
        <h1 className="text-2xl font-bold text-foreground">
          Register New Service
        </h1>
        <p className="mt-2 text-muted-foreground">
          Register a new MCP server or A2A agent to the gateway registry.
        </p>
      </div>

      {/* Registration Type Selector */}
      <div className="mb-8">
        <Label className="block text-sm font-medium text-foreground mb-3">
          What would you like to register?
        </Label>
        <ToggleGroup
          type="single"
          value={registrationType}
          onValueChange={(value) => { if (value) setRegistrationType(value as RegistrationType); }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
        >
          <ToggleGroupItem
            value="server"
            disabled={!canRegisterServer}
            className="relative flex items-center justify-start gap-4 p-4 h-auto rounded-lg data-[state=on]:bg-accent"
          >
            <Server className="h-8 w-8 shrink-0" />
            <div className="text-left">
              <p className="font-medium">MCP Server</p>
              <p className="text-sm text-muted-foreground font-normal">
                Model Context Protocol server
              </p>
            </div>
            {registrationType === 'server' && (
              <CheckCircle className="absolute top-3 right-3 h-5 w-5" />
            )}
          </ToggleGroupItem>

          <ToggleGroupItem
            value="agent"
            disabled={!canRegisterAgent}
            className="relative flex items-center justify-start gap-4 p-4 h-auto rounded-lg data-[state=on]:bg-accent"
          >
            <Cpu className="h-8 w-8 shrink-0" />
            <div className="text-left">
              <p className="font-medium">A2A Agent</p>
              <p className="text-sm text-muted-foreground font-normal">
                Agent-to-Agent protocol agent
              </p>
            </div>
            {registrationType === 'agent' && (
              <CheckCircle className="absolute top-3 right-3 h-5 w-5" />
            )}
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Registration Mode Selector */}
      <div className="mb-8">
        <Label className="block text-sm font-medium text-foreground mb-3">
          Registration Method
        </Label>
        <ToggleGroup
          type="single"
          value={registrationMode}
          onValueChange={(value) => { if (value) setRegistrationMode(value as 'form' | 'json'); }}
        >
          <ToggleGroupItem value="form">
            <FileText data-icon="inline-start" />
            Quick Form
          </ToggleGroupItem>
          <ToggleGroupItem value="json">
            <CloudUpload data-icon="inline-start" />
            JSON Upload
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Form Content */}
      <Card className="p-6">
        {registrationMode === 'form' ? (
          registrationType === 'server' ? renderServerForm() : renderAgentForm()
        ) : (
          renderJsonUpload()
        )}
      </Card>
    </div>
  );
};


export default RegisterPage;
