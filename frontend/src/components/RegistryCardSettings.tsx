import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  FileText,
  Globe,
  Mail,
  Link,
  Info,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';

interface RegistryCardData {
  schema_version: string;
  id: string;
  name: string;
  description: string | null;
  registry_url: string;
  organization_name: string;
  federation_api_version: string;
  federation_endpoint: string;
  contact_email: string | null;
  contact_url: string | null;
  capabilities: {
    servers: boolean;
    agents: boolean;
    skills: boolean;
    prompts: boolean;
    security_scans: boolean;
    incremental_sync: boolean;
    webhooks: boolean;
  };
  authentication: {
    schemes: string[];
    oauth2_issuer: string | null;
    oauth2_token_endpoint: string | null;
    scopes_supported: string[];
  };
  metadata: Record<string, any>;
}

interface RegistryCardSettingsProps {
  onShowToast?: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * RegistryCardSettings component for viewing and editing the Registry Card.
 *
 * Features:
 * - Fetches registry card from /api/registry/v0.1/card
 * - Displays current configuration
 * - Allows editing contact information
 * - Updates via PATCH /api/registry/v0.1/card
 * - Loading and error states
 */
const RegistryCardSettings: React.FC<RegistryCardSettingsProps> = ({ onShowToast }) => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [card, setCard] = useState<RegistryCardData | null>(null);
  const [formData, setFormData] = useState({
    description: '',
    contact_email: '',
    contact_url: '',
  });

  useEffect(() => {
    fetchRegistryCard();
  }, []);

  const fetchRegistryCard = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get('/api/registry/v0.1/card');
      const cardData = response.data;
      setCard(cardData);
      setFormData({
        description: cardData.description || '',
        contact_email: cardData.contact_email || '',
        contact_url: cardData.contact_url || '',
      });
    } catch (err: any) {
      const errorMsg = err.response?.status === 404
        ? 'Registry card not initialized. Please configure REGISTRY_URL, REGISTRY_NAME, and REGISTRY_ORGANIZATION_NAME in .env'
        : err.response?.data?.detail || 'Failed to load registry card';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!card) return;

    setSaving(true);
    try {
      await axios.patch('/api/registry/v0.1/card', {
        description: formData.description || null,
        contact_email: formData.contact_email || null,
        contact_url: formData.contact_url || null,
      });

      toast.success('Registry card updated successfully');

      // Refresh the card
      await fetchRegistryCard();
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || 'Failed to update registry card';
      setError(errorMsg);
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = card && (
    formData.description !== (card.description || '') ||
    formData.contact_email !== (card.contact_email || '') ||
    formData.contact_url !== (card.contact_url || '')
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary dark:border-primary"></div>
          <p className="text-sm text-muted-foreground">Loading registry card...</p>
        </div>
      </div>
    );
  }

  if (error && !card) {
    return (
      <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-6">
        <h3 className="font-medium text-destructive mb-2 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Error Loading Registry Card
        </h3>
        <p className="text-sm text-destructive mb-4">{error}</p>
        <Button variant="destructive" onClick={fetchRegistryCard}>
          Retry
        </Button>
      </div>
    );
  }

  if (!card) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          Registry Card
        </h2>
        <p className="text-sm text-muted-foreground">
          Manage your registry's metadata and contact information for federation discovery.
        </p>
      </div>

      {/* Read-only Information */}
      <Card className="bg-primary/10 dark:bg-primary/10 border-primary/20 dark:border-primary/20 p-4">
        <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <Info className="h-5 w-5" />
          Registry Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-primary font-medium">Registry ID:</span>
            <p className="text-foreground font-mono">{card.id}</p>
          </div>
          <div>
            <span className="text-primary font-medium">Name:</span>
            <p className="text-foreground">{card.name}</p>
          </div>
          <div>
            <span className="text-primary font-medium">Organization:</span>
            <p className="text-foreground">{card.organization_name}</p>
          </div>
          <div>
            <span className="text-primary font-medium">Registry URL:</span>
            <p className="text-foreground font-mono break-all">{card.registry_url}</p>
          </div>
          <div>
            <span className="text-primary font-medium">Federation Endpoint:</span>
            <p className="text-foreground font-mono break-all">{card.federation_endpoint}</p>
          </div>
          <div>
            <span className="text-primary font-medium">API Version:</span>
            <p className="text-foreground">{card.federation_api_version}</p>
          </div>
        </div>
      </Card>

      {/* Authentication Configuration */}
      <Card className="bg-primary/10 border-primary/20 p-4">
        <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Authentication Configuration
        </h3>
        <div className="space-y-3 text-sm">
          <div>
            <span className="text-primary font-medium">Supported Schemes:</span>
            <p className="text-foreground mt-1">
              {card.authentication.schemes.join(', ')}
            </p>
          </div>
          {card.authentication.oauth2_issuer && (
            <div>
              <span className="text-primary font-medium">OAuth2 Issuer:</span>
              <p className="text-foreground font-mono break-all mt-1">
                {card.authentication.oauth2_issuer}
              </p>
            </div>
          )}
          {card.authentication.oauth2_token_endpoint && (
            <div>
              <span className="text-primary font-medium">OAuth2 Token Endpoint:</span>
              <p className="text-foreground font-mono break-all mt-1">
                {card.authentication.oauth2_token_endpoint}
              </p>
            </div>
          )}
          <div>
            <span className="text-primary font-medium">Scopes Supported:</span>
            <p className="text-foreground mt-1">
              {card.authentication.scopes_supported.join(', ')}
            </p>
          </div>
        </div>
      </Card>

      {/* Editable Fields */}
      <div className="space-y-4">
        <h3 className="font-medium text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Editable Information
        </h3>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Description
          </label>
          <Textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Describe your registry's purpose and contents..."
            rows={3}
            maxLength={1000}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {formData.description.length}/1000 characters
          </p>
        </div>

        {/* Contact Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Contact Email
          </label>
          <Input
            type="email"
            value={formData.contact_email}
            onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
            placeholder="contact@example.com"
          />
        </div>

        {/* Contact URL */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <Link className="h-4 w-4" />
            Contact URL
          </label>
          <Input
            type="url"
            value={formData.contact_url}
            onChange={(e) => setFormData({ ...formData, contact_url: e.target.value })}
            placeholder="https://example.com/contact"
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={!hasChanges || saving}
        >
          {saving ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>

      {/* Capabilities */}
      <Card className="bg-muted p-4">
        <h3 className="font-medium text-foreground mb-3 flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Capabilities
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
          {Object.entries(card.capabilities).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${value ? 'bg-emerald-500' : 'bg-muted-foreground'}`} />
              <span className="text-foreground">
                {key.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
};

export default RegistryCardSettings;
