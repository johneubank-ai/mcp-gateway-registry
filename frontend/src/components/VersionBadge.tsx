import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Badge } from '@/components/ui/badge';


interface ServerVersion {
  version: string;
  proxy_pass_url: string;
  status: string;
  is_default: boolean;
  released?: string;
  sunset_date?: string;
  description?: string;
}


interface VersionBadgeProps {
  versions?: ServerVersion[] | null;
  defaultVersion?: string | null;
  onClick?: () => void;
}


/**
 * VersionBadge component displays the current version of a server.
 *
 * - Shows the default version as a clickable badge
 * - Displays dropdown arrow when multiple versions exist
 * - Hidden when server has no versions (single-version backward compatibility)
 */
const VersionBadge: React.FC<VersionBadgeProps> = ({
  versions,
  defaultVersion,
  onClick
}) => {
  // Don't render badge if no versions configured (backward compatibility)
  if (!versions || versions.length === 0) {
    return null;
  }

  // Find the current default version
  const currentVersion = defaultVersion ||
    versions.find(v => v.is_default)?.version ||
    versions[0]?.version ||
    'v1.0.0';

  const hasMultipleVersions = versions.length > 1;

  return (
    <Badge
      asChild
      variant="outline"
      className={`
        inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded
        ${hasMultipleVersions
          ? 'bg-primary/10 text-primary hover:bg-primary/10 dark:bg-primary/10 dark:text-primary dark:hover:bg-primary/15 cursor-pointer'
          : 'bg-muted text-muted-foreground cursor-default'
        }
        transition-colors duration-200
      `}
    >
      <button
        onClick={onClick}
        disabled={!onClick || !hasMultipleVersions}
        title={hasMultipleVersions ? 'Click to manage versions' : `Version: ${currentVersion}`}
      >
        {currentVersion}
        {hasMultipleVersions && (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>
    </Badge>
  );
};


export default VersionBadge;
