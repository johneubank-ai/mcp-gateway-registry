import React, { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

/**
 * Props for the DeleteConfirmation component.
 */
export interface DeleteConfirmationProps {
  entityType: 'server' | 'agent' | 'group' | 'user' | 'm2m';
  entityName: string;
  entityPath: string;
  onConfirm: (path: string) => Promise<void>;
  onCancel: () => void;
}

/**
 * DeleteConfirmation component provides an inline confirmation UI for delete operations.
 *
 * Displays a red-tinted container with warning text, requiring users to type the entity
 * name exactly before the delete button becomes enabled. Shows loading state during
 * API calls and displays error messages on failure.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8
 */
const DeleteConfirmation: React.FC<DeleteConfirmationProps> = ({
  entityType,
  entityName,
  entityPath,
  onConfirm,
  onCancel,
}) => {
  const [typedName, setTypedName] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isConfirmed = typedName === entityName;

  const handleDelete = async () => {
    if (!isConfirmed || isDeleting) return;

    setIsDeleting(true);
    setError(null);

    try {
      await onConfirm(entityPath);
      onCancel(); // Close on success - parent handles list refresh + toast
    } catch (err: any) {
      setError(
        err.response?.data?.detail ||
        err.response?.data?.reason ||
        `Failed to delete ${entityType}`
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const entityTypeLabels: Record<string, string> = {
    server: 'Server',
    agent: 'Agent',
    group: 'Group',
    user: 'User',
    m2m: 'M2M Account',
  };
  const entityTypeLabel = entityTypeLabels[entityType] || entityType;

  return (
    <div className="p-4 bg-destructive/10 rounded-lg border border-destructive/20">
      <h4 className="text-destructive font-semibold mb-2">
        Delete {entityTypeLabel}
      </h4>
      <p className="text-sm text-destructive mb-2">
        This action is irreversible. This will permanently delete the {entityType}{' '}
        "<strong>{entityName}</strong>" and remove it from the registry.
      </p>
      <p className="text-sm text-destructive mb-3">
        Type <strong>{entityName}</strong> to confirm:
      </p>
      <Input
        type="text"
        value={typedName}
        onChange={(e) => setTypedName(e.target.value)}
        className="w-full mb-3 border-destructive/30 bg-card text-foreground"
        placeholder={entityName}
        disabled={isDeleting}
      />
      {error && (
        <p className="text-sm text-destructive mb-3">{error}</p>
      )}
      <div className="flex gap-2 justify-end">
        <Button
          variant="secondary"
          onClick={onCancel}
          disabled={isDeleting}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          onClick={handleDelete}
          disabled={!isConfirmed || isDeleting}
          className="flex items-center gap-2"
        >
          {isDeleting && <RefreshCw className="h-4 w-4 animate-spin" />}
          Delete {entityTypeLabel}
        </Button>
      </div>
    </div>
  );
};

export default DeleteConfirmation;
