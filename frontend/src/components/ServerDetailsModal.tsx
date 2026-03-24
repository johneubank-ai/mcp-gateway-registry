import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DetailsModal from './DetailsModal';

interface ServerDetailsModalProps {
  server: any;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  fullDetails?: any;
  onCopy?: (data: any) => Promise<void> | void;
}

/**
 * ServerDetailsModal displays the complete server JSON schema.
 *
 * Features:
 * - Uses shared DetailsModal component
 * - Copy to clipboard functionality
 * - Field reference documentation
 * - Loading and error states
 */
const ServerDetailsModal: React.FC<ServerDetailsModalProps> = ({
  server,
  isOpen,
  onClose,
  loading = false,
  error = null,
  fullDetails,
  onCopy,
}) => {
  const dataToCopy = fullDetails || server;

  const handleCopy = async () => {
    try {
      if (onCopy) {
        await onCopy(dataToCopy);
      } else {
        await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      }
    } catch (err) {
      console.error('Failed to copy server JSON:', err);
    }
  };

  return (
    <DetailsModal
      title={`${server?.name || 'Server'} - Full Details (JSON)`}
      isOpen={isOpen}
      onClose={onClose}
      loading={loading}
      error={error}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium text-primary mb-2">
            Complete Server Schema
          </h4>
          <p className="text-sm text-primary">
            This is the complete MCP server definition stored in the registry. It includes all
            metadata, tools, authentication configuration, and runtime details.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Server JSON Schema:</h4>
            <Button
              onClick={handleCopy}
              className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-white"
            >
              <ClipboardList className="h-4 w-4" />
              Copy JSON
            </Button>
          </div>

          <pre className="p-4 bg-muted border border-border rounded-lg overflow-x-auto text-xs text-foreground max-h-[30vh] overflow-y-auto">
            {JSON.stringify(dataToCopy, null, 2)}
          </pre>
        </div>

        <div className="bg-muted border border-border rounded-lg p-4">
          <h4 className="font-medium text-foreground mb-3">Field Reference</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium text-foreground mb-2">Core Fields</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <code className="bg-muted px-1 rounded">name</code> - Server
                  display name
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">path</code> - Registry
                  path
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">description</code> -
                  Server purpose
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">mcp_endpoint</code> -
                  MCP endpoint URL
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">status</code> -
                  Lifecycle status (active/deprecated/draft/beta)
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-foreground mb-2">Metadata Fields</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <code className="bg-muted px-1 rounded">enabled</code> -
                  Server enabled state
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">tags</code> -
                  Categorization tags
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">num_tools</code> -
                  Number of tools
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">provider</code> -
                  Source registry information
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">source_created_at</code>{' '}
                  - Creation timestamp
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DetailsModal>
  );
};

export default ServerDetailsModal;
