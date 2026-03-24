import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DetailsModalProps {
  title: string;
  isOpen: boolean;
  onClose: () => void;
  loading?: boolean;
  error?: string | null;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl';
}

const MAX_WIDTH_CLASSES = {
  sm: 'sm:max-w-sm',
  md: 'sm:max-w-md',
  lg: 'sm:max-w-lg',
  xl: 'sm:max-w-xl',
  '2xl': 'sm:max-w-2xl',
  '3xl': 'sm:max-w-3xl',
  '4xl': 'sm:max-w-4xl',
};

/**
 * Shared DetailsModal component with loading and error states.
 *
 * Features:
 * - Uses shadcn Dialog (Radix UI) for portal, overlay, and escape key handling
 * - Configurable max width
 * - Built-in loading spinner
 * - Built-in error display
 * - Dark mode support
 *
 * Usage:
 * ```tsx
 * <DetailsModal
 *   title="Server Details"
 *   isOpen={isOpen}
 *   onClose={handleClose}
 *   loading={loading}
 *   error={error}
 *   maxWidth="4xl"
 * >
 *   <YourContent />
 * </DetailsModal>
 * ```
 */
const DetailsModal: React.FC<DetailsModalProps> = ({
  title,
  isOpen,
  onClose,
  loading = false,
  error = null,
  children,
  maxWidth = '4xl',
}) => {
  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent
        className={`${MAX_WIDTH_CLASSES[maxWidth]} max-h-[80vh] overflow-auto bg-card p-6`}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-foreground">
            {title}
          </DialogTitle>
        </DialogHeader>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary"></div>
              <p className="text-sm text-muted-foreground">
                Loading details...
              </p>
            </div>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-4">
            <h4 className="font-medium text-destructive mb-1">
              Error Loading Details
            </h4>
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {/* Content */}
        {!loading && !error && children}
      </DialogContent>
    </Dialog>
  );
};

export default DetailsModal;
