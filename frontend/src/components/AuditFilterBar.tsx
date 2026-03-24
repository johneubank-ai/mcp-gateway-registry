import React, { useState, useEffect, useRef } from 'react';
import SearchableSelect, { SelectOption } from './SearchableSelect';
import axios from 'axios';
import {
  Filter,
  X,
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export interface AuditFilters {
  stream: 'registry_api' | 'mcp_access';
  from?: string;
  to?: string;
  username?: string;
  operation?: string;
  resourceType?: string;
  statusMin?: number;
  statusMax?: number;
}

interface AuditFilterBarProps {
  filters: AuditFilters;
  onFilterChange: (filters: AuditFilters) => void;
  onRefresh?: () => void;
  loading?: boolean;
}

const REGISTRY_OPERATION_OPTIONS = [
  { value: '', label: 'All Operations' },
  { value: 'create', label: 'Create' },
  { value: 'read', label: 'Read' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'list', label: 'List' },
  { value: 'toggle', label: 'Toggle' },
  { value: 'rate', label: 'Rate' },
  { value: 'login', label: 'Login' },
  { value: 'logout', label: 'Logout' },
  { value: 'search', label: 'Search' },
];

const MCP_OPERATION_OPTIONS = [
  { value: '', label: 'All Methods' },
  { value: 'initialize', label: 'Initialize' },
  { value: 'tools/list', label: 'Tools List' },
  { value: 'tools/call', label: 'Tools Call' },
  { value: 'resources/list', label: 'Resources List' },
  { value: 'resources/templates/list', label: 'Resource Templates' },
  { value: 'notifications/initialized', label: 'Notifications' },
];

const REGISTRY_RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All Resources' },
  { value: 'server', label: 'Server' },
  { value: 'agent', label: 'Agent' },
  { value: 'auth', label: 'Auth' },
  { value: 'federation', label: 'Federation' },
  { value: 'health', label: 'Health' },
  { value: 'search', label: 'Search' },
];

const MCP_RESOURCE_TYPE_OPTIONS = [
  { value: '', label: 'All Servers' },
];

const STATUS_PRESETS = [
  { value: '', label: 'All Status Codes' },
  { value: '2xx', label: '2xx Success' },
  { value: '4xx', label: '4xx Client Error' },
  { value: '5xx', label: '5xx Server Error' },
  { value: 'error', label: 'All Errors (4xx & 5xx)' },
];

interface FilterOptionsCache {
  registry_api?: { usernames: SelectOption[]; serverNames: SelectOption[] };
  mcp_access?: { usernames: SelectOption[]; serverNames: SelectOption[] };
}

const AuditFilterBar: React.FC<AuditFilterBarProps> = ({
  filters,
  onFilterChange,
  onRefresh,
  loading = false,
}) => {
  const isMcpStream = filters.stream === 'mcp_access';
  const operationOptions = isMcpStream ? MCP_OPERATION_OPTIONS : REGISTRY_OPERATION_OPTIONS;
  const resourceTypeOptions = isMcpStream ? MCP_RESOURCE_TYPE_OPTIONS : REGISTRY_RESOURCE_TYPE_OPTIONS;

  const [usernameOptions, setUsernameOptions] = useState<SelectOption[]>([]);
  const [serverNameOptions, setServerNameOptions] = useState<SelectOption[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const optionsCacheRef = useRef<FilterOptionsCache>({});

  // Prefetch both streams' filter options on mount
  useEffect(() => {
    const fetchAllOptions = async () => {
      setOptionsLoading(true);
      try {
        const [registryRes, mcpRes] = await Promise.all([
          axios.get('/api/audit/filter-options', { params: { stream: 'registry_api' } }),
          axios.get('/api/audit/filter-options', { params: { stream: 'mcp_access' } }),
        ]);

        optionsCacheRef.current = {
          registry_api: {
            usernames: registryRes.data.usernames.map((u: string) => ({ value: u, label: u })),
            serverNames: [],
          },
          mcp_access: {
            usernames: mcpRes.data.usernames.map((u: string) => ({ value: u, label: u })),
            serverNames: mcpRes.data.server_names.map((s: string) => ({ value: s, label: s })),
          },
        };

        // Set current stream's options
        const current = optionsCacheRef.current[filters.stream];
        if (current) {
          setUsernameOptions(current.usernames);
          setServerNameOptions(current.serverNames);
        }
      } catch (error) {
        console.error('Failed to fetch filter options:', error);
      } finally {
        setOptionsLoading(false);
      }
    };
    fetchAllOptions();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When stream changes, serve from cache
  useEffect(() => {
    const cached = optionsCacheRef.current[filters.stream];
    if (cached) {
      setUsernameOptions(cached.usernames);
      setServerNameOptions(cached.serverNames);
    }
  }, [filters.stream]);

  const handleStreamChange = (value: string) => {
    // Clear operation and resource type filters when switching streams
    onFilterChange({
      ...filters,
      stream: value as 'registry_api' | 'mcp_access',
      operation: undefined,
      resourceType: undefined,
    });
  };

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      from: e.target.value || undefined,
    });
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFilterChange({
      ...filters,
      to: e.target.value || undefined,
    });
  };

  const handleUsernameSelect = (value: string) => {
    onFilterChange({
      ...filters,
      username: value || undefined,
    });
  };

  const handleOperationChange = (value: string) => {
    onFilterChange({
      ...filters,
      operation: value || undefined,
    });
  };

  const handleResourceTypeChange = (value: string) => {
    onFilterChange({
      ...filters,
      resourceType: value || undefined,
    });
  };

  const handleServerNameSelect = (value: string) => {
    onFilterChange({
      ...filters,
      resourceType: value || undefined,
    });
  };

  const handleStatusPresetChange = (value: string) => {
    let statusMin: number | undefined;
    let statusMax: number | undefined;

    switch (value) {
      case '2xx':
        statusMin = 200;
        statusMax = 299;
        break;
      case '4xx':
        statusMin = 400;
        statusMax = 499;
        break;
      case '5xx':
        statusMin = 500;
        statusMax = 599;
        break;
      case 'error':
        statusMin = 400;
        statusMax = 599;
        break;
      default:
        statusMin = undefined;
        statusMax = undefined;
    }

    onFilterChange({
      ...filters,
      statusMin,
      statusMax,
    });
  };

  const getStatusPresetValue = (): string => {
    const { statusMin, statusMax } = filters;
    if (statusMin === 200 && statusMax === 299) return '2xx';
    if (statusMin === 400 && statusMax === 499) return '4xx';
    if (statusMin === 500 && statusMax === 599) return '5xx';
    if (statusMin === 400 && statusMax === 599) return 'error';
    return '';
  };

  const handleClearFilters = () => {
    onFilterChange({
      stream: filters.stream,
      from: undefined,
      to: undefined,
      username: undefined,
      operation: undefined,
      resourceType: undefined,
      statusMin: undefined,
      statusMax: undefined,
    });
  };

  const hasActiveFilters = !!(
    filters.from ||
    filters.to ||
    filters.username ||
    filters.operation ||
    filters.resourceType ||
    filters.statusMin ||
    filters.statusMax
  );

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center gap-2 mb-4">
        <Filter className="h-5 w-5 text-muted-foreground" />
        <h3 className="text-sm font-medium text-foreground">
          Filters
        </h3>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="ml-auto"
          >
            <X className="h-4 w-4" />
            Clear filters
          </Button>
        )}
        {onRefresh && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="ml-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stream Selector */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Log Stream
          </label>
          <Select value={filters.stream} onValueChange={handleStreamChange}>
            <SelectTrigger>
              <SelectValue placeholder="Select stream" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="registry_api">Registry API</SelectItem>
              <SelectItem value="mcp_access">MCP Access</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date Range - From */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            From Date
          </label>
          <Input
            type="datetime-local"
            value={filters.from || ''}
            onChange={handleFromChange}
          />
        </div>

        {/* Date Range - To */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            To Date
          </label>
          <Input
            type="datetime-local"
            value={filters.to || ''}
            onChange={handleToChange}
          />
        </div>

        {/* Username Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Username
          </label>
          <SearchableSelect
            options={usernameOptions}
            value={filters.username || ''}
            onChange={handleUsernameSelect}
            placeholder="Search username..."
            isLoading={optionsLoading}
            allowCustom={true}
            specialOptions={[{ value: '', label: 'All Users' }]}
            focusColor="focus:ring-ring"
          />
        </div>

        {/* Operation / MCP Method Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {isMcpStream ? 'MCP Method' : 'Operation'}
          </label>
          <Select value={filters.operation || ''} onValueChange={handleOperationChange}>
            <SelectTrigger>
              <SelectValue placeholder={isMcpStream ? 'All Methods' : 'All Operations'} />
            </SelectTrigger>
            <SelectContent>
              {operationOptions.map((opt) => (
                <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Resource Type / Server Name Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            {isMcpStream ? 'Server Name' : 'Resource Type'}
          </label>
          {isMcpStream ? (
            <SearchableSelect
              options={serverNameOptions}
              value={filters.resourceType || ''}
              onChange={handleServerNameSelect}
              placeholder="Search server..."
              isLoading={optionsLoading}
              allowCustom={true}
              specialOptions={[{ value: '', label: 'All Servers' }]}
              focusColor="focus:ring-ring"
            />
          ) : (
            <Select value={filters.resourceType || ''} onValueChange={handleResourceTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="All Resources" />
              </SelectTrigger>
              <SelectContent>
                {resourceTypeOptions.map((opt) => (
                  <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Status Code Range Filter */}
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            Status Code
          </label>
          <Select value={getStatusPresetValue() || '__all__'} onValueChange={(v) => handleStatusPresetChange(v === '__all__' ? '' : v)}>
            <SelectTrigger>
              <SelectValue placeholder="All Status Codes" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_PRESETS.map((opt) => (
                <SelectItem key={opt.value || '__all__'} value={opt.value || '__all__'}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </Card>
  );
};

export default AuditFilterBar;
