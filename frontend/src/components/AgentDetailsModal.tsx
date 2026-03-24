import React from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import DetailsModal from './DetailsModal';

interface AgentLike {
  name: string;
  path: string;
  description?: string;
  version?: string;
  visibility?: string;
  trust_level?: string;
  enabled: boolean;
  tags?: string[];
}

interface AgentDetailsModalProps {
  agent: AgentLike & { [key: string]: any };
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  fullDetails?: any;
  onCopy?: (data: any) => Promise<void> | void;
}

/**
 * AgentDetailsModal displays the complete agent JSON schema.
 *
 * Features:
 * - Uses shared DetailsModal component
 * - Copy to clipboard functionality
 * - Field reference documentation
 * - Loading states handled by parent DetailsModal
 */
const AgentDetailsModal: React.FC<AgentDetailsModalProps> = ({
  agent,
  isOpen,
  onClose,
  loading,
  fullDetails,
  onCopy,
}) => {
  const dataToCopy = fullDetails || agent;

  const handleCopy = async () => {
    try {
      if (onCopy) {
        await onCopy(dataToCopy);
      } else {
        await navigator.clipboard.writeText(JSON.stringify(dataToCopy, null, 2));
      }
    } catch (error) {
      console.error('Failed to copy agent JSON:', error);
    }
  };

  return (
    <DetailsModal
      title={`${agent.name} - Full Details (JSON)`}
      isOpen={isOpen}
      onClose={onClose}
      loading={loading}
      maxWidth="4xl"
    >
      <div className="space-y-4">
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
          <h4 className="font-medium text-primary mb-2">Complete Agent Schema</h4>
          <p className="text-sm text-primary">
            This is the complete A2A agent definition stored in the registry. It includes all metadata, skills,
            security schemes, and configuration details.
          </p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-foreground">Agent JSON Schema:</h4>
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
                  <code className="bg-muted px-1 rounded">protocol_version</code> - A2A protocol
                  version
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">name</code> - Agent display name
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">description</code> - Agent purpose
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">url</code> - Agent endpoint URL
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">path</code> - Registry path
                </li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium text-foreground mb-2">Metadata Fields</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>
                  <code className="bg-muted px-1 rounded">skills</code> - Agent capabilities
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">security_schemes</code> - Auth methods
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">tags</code> - Categorization
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">trust_level</code> - Verification status
                </li>
                <li>
                  <code className="bg-muted px-1 rounded">status</code> - Lifecycle status
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </DetailsModal>
  );
};

export default AgentDetailsModal;
