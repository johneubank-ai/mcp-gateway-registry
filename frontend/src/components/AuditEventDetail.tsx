import React, { useState } from 'react';
import {
  X,
  ClipboardCopy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { AuditEvent } from './AuditLogTable';

interface AuditEventDetailProps {
  event: AuditEvent;
  onClose: () => void;
}

const AuditEventDetail: React.FC<AuditEventDetailProps> = ({ event, onClose }) => {
  const [copied, setCopied] = useState(false);

  const isMcpEvent = event.log_type === 'mcp_server_access';

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(event, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatJson = (obj: unknown): string => {
    return JSON.stringify(obj, null, 2);
  };

  const getStatusColor = (statusCode: number): string => {
    if (statusCode >= 200 && statusCode < 300) return 'text-primary';
    if (statusCode >= 400 && statusCode < 500) return 'text-primary dark:text-primary';
    if (statusCode >= 500) return 'text-red-600 dark:text-red-400';
    return 'text-muted-foreground';
  };

  const getMcpStatusColor = (status: string): string => {
    switch (status?.toLowerCase()) {
      case 'success':
        return 'text-primary';
      case 'error':
        return 'text-red-600 dark:text-red-400';
      case 'timeout':
        return 'text-primary dark:text-primary';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-muted flex items-center justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <h3 className="text-sm font-medium text-foreground flex-shrink-0">
            Event Details
          </h3>
          <span
            className="text-xs text-muted-foreground font-mono truncate"
            title={event.request_id}
          >
            {event.request_id}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            title="Copy JSON to clipboard"
          >
            {copied ? (
              <>
                <Check className="h-4 w-4 text-green-500" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <ClipboardCopy className="h-4 w-4" />
                <span>Copy JSON</span>
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            title="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="px-4 py-3 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Timestamp
          </div>
          <div className="text-sm text-foreground truncate">
            {new Date(event.timestamp).toLocaleString()}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            User
          </div>
          <div className="text-sm text-foreground flex items-center gap-1 min-w-0">
            <span className="truncate" title={event.identity.username}>
              {event.identity.username}
            </span>
            {event.identity.is_admin && (
              <Badge className="bg-primary/10 text-primary">
                Admin
              </Badge>
            )}
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Status
          </div>
          {isMcpEvent ? (
            <div className={`text-sm font-medium ${getMcpStatusColor(event.mcp_response?.status || '')}`}>
              {event.mcp_response?.status || '-'}
            </div>
          ) : (
            <div className={`text-sm font-medium ${getStatusColor(event.response?.status_code || 0)}`}>
              {event.response?.status_code || '-'}
            </div>
          )}
        </div>
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
            Duration
          </div>
          <div className="text-sm text-foreground">
            {isMcpEvent
              ? `${(event.mcp_response?.duration_ms || 0).toFixed(2)} ms`
              : `${(event.response?.duration_ms || 0).toFixed(2)} ms`
            }
          </div>
        </div>
      </div>

      {/* MCP-specific summary row */}
      {isMcpEvent && (
        <div className="px-4 py-3 border-b border-border grid grid-cols-2 md:grid-cols-4 gap-2 bg-primary/5 dark:bg-primary/5">
          <div className="min-w-0 overflow-hidden">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 truncate" title="MCP Server">
              Server
            </div>
            <div
              className="text-sm text-foreground truncate"
              title={event.mcp_server?.name || '-'}
            >
              {event.mcp_server?.name || '-'}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 truncate" title="MCP Method">
              Method
            </div>
            <div
              className="text-sm font-mono text-foreground truncate"
              title={event.mcp_request?.method || '-'}
            >
              {event.mcp_request?.method || '-'}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 truncate" title="Tool/Resource">
              Tool
            </div>
            <div
              className="text-sm text-foreground truncate"
              title={event.mcp_request?.tool_name || event.mcp_request?.resource_uri || '-'}
            >
              {event.mcp_request?.tool_name || event.mcp_request?.resource_uri || '-'}
            </div>
          </div>
          <div className="min-w-0 overflow-hidden">
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1 truncate" title="Transport">
              Transport
            </div>
            <div
              className="text-sm text-foreground truncate"
              title={event.mcp_request?.transport || '-'}
            >
              {event.mcp_request?.transport || '-'}
            </div>
          </div>
        </div>
      )}

      {/* JSON Content */}
      <div className="p-4 max-h-[60vh] overflow-auto">
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap break-words bg-muted p-4 rounded-lg border border-border">
          {formatJson(event)}
        </pre>
      </div>
    </Card>
  );
};

export default AuditEventDetail;
