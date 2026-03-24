import React from 'react';
import { Badge } from '@/components/ui/badge';
import { useRegistryConfig } from '../hooks/useRegistryConfig';

export const DeploymentModeIndicator: React.FC = () => {
  const { config } = useRegistryConfig();

  if (!config || config.deployment_mode === 'with-gateway') {
    return null;
  }

  return (
    <Badge
      className="bg-primary/10 text-primary"
      variant="outline"
      title="Registry is running without gateway integration. Nginx reverse proxy features are disabled."
    >
      Registry Only
    </Badge>
  );
};
