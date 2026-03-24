import React from 'react';
import { Badge } from '@/components/ui/badge';

type LifecycleStatus = 'active' | 'deprecated' | 'draft' | 'beta';

interface StatusBadgeProps {
  status: LifecycleStatus;
  className?: string;
}

const STATUS_CONFIG: Record<
  LifecycleStatus,
  {
    label: string;
    tooltip: string;
    colorClasses: string;
  }
> = {
  active: {
    label: 'Active',
    tooltip: 'This item is active and ready for use',
    colorClasses:
      'bg-primary/10 text-primary',
  },
  deprecated: {
    label: 'Deprecated',
    tooltip: 'This item is deprecated and may be removed in the future',
    colorClasses:
      'bg-muted text-muted-foreground',
  },
  draft: {
    label: 'Draft',
    tooltip: 'This item is in draft mode and not yet ready for production',
    colorClasses:
      'bg-muted text-foreground',
  },
  beta: {
    label: 'Beta',
    tooltip: 'This item is in beta testing phase',
    colorClasses:
      'bg-primary/10 text-primary',
  },
};

/**
 * StatusBadge component displays the lifecycle status of a server or agent.
 *
 * Features:
 * - Color-coded badges for different statuses
 * - Tooltip with status description
 * - Dark mode support
 */
const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.active;

  return (
    <Badge
      className={`${config.colorClasses} ${className}`}
      variant="outline"
      title={config.tooltip}
    >
      {config.label}
    </Badge>
  );
};

export default StatusBadge;
