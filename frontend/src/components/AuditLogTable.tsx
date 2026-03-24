import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AuditFilters } from './AuditFilterBar';

export interface AuditEvent {
  _id?: string;
  timestamp: string;
  request_id: string;
  log_type: string;
  version?: string;
  correlation_id?: string;
  identity: {
    username: string;
    auth_method: string;
    provider?: string;
    groups?: string[];
    scopes?: string[];
    is_admin: boolean;
    credential_type: string;
    credential_hint?: string;
  };
  request?: {
    method: string;
    path: string;
    query_params?: Record<string, unknown>;
    client_ip: string;
    forwarded_for?: string;
    user_agent?: string;
    content_length?: number;
  };
  response?: {
    status_code: number;
    duration_ms: number;
    content_length?: number;
  };
  action?: {
    operation: string;
    resource_type: string;
    resource_id?: string;
    description?: string;
  };
  authorization?: {
    decision: string;
    required_permission?: string;
    evaluated_scopes?: string[];
  };
  // MCP-specific fields
  mcp_server?: {
    name: string;
    path: string;
    version?: string;
    proxy_target: string;
  };
  mcp_request?: {
    method: string;
    tool_name?: string;
    resource_uri?: string;
    mcp_session_id?: string;
    transport: string;
    jsonrpc_id?: string;
  };
  mcp_response?: {
    status: string;
    duration_ms: number;
    error_code?: number;
    error_message?: string;
  };
}

interface AuditLogTableProps {
  filters: AuditFilters;
  onEventSelect?: (event: AuditEvent) => void;
  selectedEventId?: string;
}

interface PaginationState {
  total: number;
  limit: number;
  offset: number;
}

const getStatusColor = (statusCode: number): string => {
  if (statusCode >= 200 && statusCode < 300) {
    return 'bg-primary/10 text-primary';
  }
  if (statusCode >= 300 && statusCode < 400) {
    return 'bg-primary/10 text-primary';
  }
  if (statusCode >= 400 && statusCode < 500) {
    return 'bg-muted text-muted-foreground';
  }
  if (statusCode >= 500) {
    return 'bg-destructive/10 text-destructive';
  }
  return 'bg-muted text-foreground';
};

const getMethodColor = (method: string): string => {
  switch (method.toUpperCase()) {
    case 'GET':
      return 'text-primary';
    case 'POST':
      return 'text-primary';
    case 'PUT':
    case 'PATCH':
      return 'text-muted-foreground';
    case 'DELETE':
      return 'text-destructive';
    default:
      return 'text-muted-foreground';
  }
};

const getMcpStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'success':
      return 'bg-primary/10 text-primary';
    case 'error':
      return 'bg-destructive/10 text-destructive';
    case 'timeout':
      return 'bg-muted text-muted-foreground';
    default:
      return 'bg-muted text-foreground';
  }
};

const formatTimestamp = (timestamp: string): string => {
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
};

const AuditLogTable: React.FC<AuditLogTableProps> = ({
  filters,
  onEventSelect,
  selectedEventId,
}) => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationState>({
    total: 0,
    limit: 50,
    offset: 0,
  });
  // Sort order: -1 = descending (newest first), 1 = ascending (oldest first)
  const [sortOrder, setSortOrder] = useState<-1 | 1>(-1);

  const fetchEvents = useCallback(async (offset: number = 0, currentSortOrder: -1 | 1 = sortOrder) => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set('stream', filters.stream);
      params.set('limit', pagination.limit.toString());
      params.set('offset', offset.toString());
      params.set('sort_order', currentSortOrder.toString());

      if (filters.from) {
        params.set('from', new Date(filters.from).toISOString());
      }
      if (filters.to) {
        params.set('to', new Date(filters.to).toISOString());
      }
      if (filters.username) {
        params.set('username', filters.username);
      }
      if (filters.operation) {
        params.set('operation', filters.operation);
      }
      if (filters.resourceType) {
        params.set('resource_type', filters.resourceType);
      }
      if (filters.statusMin !== undefined) {
        params.set('status_min', filters.statusMin.toString());
      }
      if (filters.statusMax !== undefined) {
        params.set('status_max', filters.statusMax.toString());
      }

      const response = await axios.get(`/api/audit/events?${params.toString()}`);
      const data = response.data;

      setEvents(data.events || []);
      setPagination({
        total: data.total || 0,
        limit: data.limit || 50,
        offset: data.offset || 0,
      });
    } catch (err: any) {
      console.error('Failed to fetch audit events:', err);
      if (err.response?.status === 403) {
        setError('Access denied. Admin permissions required.');
      } else {
        setError(err.response?.data?.detail || 'Failed to load audit events');
      }
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.limit, sortOrder]);

  useEffect(() => {
    fetchEvents(0, sortOrder);
  }, [filters, sortOrder]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePageChange = (newOffset: number) => {
    fetchEvents(newOffset, sortOrder);
  };

  const handleSortToggle = () => {
    const newSortOrder = sortOrder === -1 ? 1 : -1;
    setSortOrder(newSortOrder);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;

  const handleFirstPage = () => handlePageChange(0);
  const handlePrevPage = () => handlePageChange(Math.max(0, pagination.offset - pagination.limit));
  const handleNextPage = () => handlePageChange(pagination.offset + pagination.limit);
  const handleLastPage = () => handlePageChange((totalPages - 1) * pagination.limit);

  const isMcpStream = filters.stream === 'mcp_access';

  if (error) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4">
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="overflow-hidden">
      {/* Table */}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted border-b border-border">
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                <button
                  onClick={handleSortToggle}
                  className="flex items-center gap-1 hover:text-foreground transition-colors"
                  title={sortOrder === -1 ? "Sorted newest first - click for oldest first" : "Sorted oldest first - click for newest first"}
                >
                  Timestamp
                  {sortOrder === -1 ? (
                    <ChevronDown className="h-3 w-3" />
                  ) : (
                    <ChevronUp className="h-3 w-3" />
                  )}
                </button>
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                User
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isMcpStream ? 'MCP Method' : 'Method'}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isMcpStream ? 'Tool/Resource' : 'Operation'}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {isMcpStream ? 'MCP Server' : 'Resource'}
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Status
              </TableHead>
              <TableHead className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Duration
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {loading ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center">
                  <div className="flex items-center justify-center gap-2 text-muted-foreground">
                    <div className="animate-spin h-5 w-5 border-2 border-primary border-t-transparent rounded-full" />
                    <span>Loading events...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : events.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  No audit events found matching the current filters.
                </TableCell>
              </TableRow>
            ) : (
              events.map((event) => (
                <TableRow
                  key={event.request_id}
                  onClick={() => onEventSelect?.(event)}
                  className={`cursor-pointer transition-colors ${
                    selectedEventId === event.request_id
                      ? 'bg-primary/10'
                      : 'hover:bg-accent'
                  }`}
                >
                  <TableCell className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                    {formatTimestamp(event.timestamp)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-1">
                      <span className="text-foreground">
                        {event.identity.username}
                      </span>
                      {event.identity.is_admin && (
                        <Badge className="bg-primary/10 text-primary">
                          Admin
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {isMcpStream ? (
                      <span className="font-mono text-foreground">
                        {event.mcp_request?.method || '-'}
                      </span>
                    ) : (
                      <span className={`font-mono font-medium ${getMethodColor(event.request?.method || '')}`}>
                        {event.request?.method || '-'}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {isMcpStream ? (
                      event.mcp_request?.tool_name || event.mcp_request?.resource_uri || '-'
                    ) : (
                      event.action?.operation || '-'
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground">
                    {isMcpStream ? (
                      event.mcp_server?.name || '-'
                    ) : event.action ? (
                      <span>
                        {event.action.resource_type}
                        {event.action.resource_id && (
                          <span className="text-muted-foreground">
                            /{event.action.resource_id}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm">
                    {isMcpStream ? (
                      <Badge className={`${getMcpStatusColor(event.mcp_response?.status || '')}`}>
                        {event.mcp_response?.status || '-'}
                      </Badge>
                    ) : (
                      <Badge className={`${getStatusColor(event.response?.status_code || 0)}`}>
                        {event.response?.status_code || '-'}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                    {isMcpStream
                      ? `${(event.mcp_response?.duration_ms || 0).toFixed(1)} ms`
                      : `${(event.response?.duration_ms || 0).toFixed(1)} ms`
                    }
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {!loading && events.length > 0 && (
        <div className="px-4 py-3 border-t border-border bg-muted">
          <div className="flex items-center justify-between">
            <div className="text-sm text-foreground">
              Showing{' '}
              <span className="font-medium">{pagination.offset + 1}</span>
              {' '}-{' '}
              <span className="font-medium">
                {Math.min(pagination.offset + pagination.limit, pagination.total)}
              </span>
              {' '}of{' '}
              <span className="font-medium">{pagination.total}</span>
              {' '}events
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleFirstPage}
                disabled={currentPage === 1}
                title="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 text-sm text-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleLastPage}
                disabled={currentPage === totalPages}
                title="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

export default AuditLogTable;
