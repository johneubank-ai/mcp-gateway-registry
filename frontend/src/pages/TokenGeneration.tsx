import React, { useState } from 'react';
import { Key, Clipboard, Check, AlertTriangle } from 'lucide-react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const TokenGeneration: React.FC = () => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    description: '',
    expires_in_hours: 8,
    scopeMethod: 'current' as 'current' | 'custom',
    customScopes: '',
  });
  const [generatedToken, setGeneratedToken] = useState<string>('');
  const [tokenDetails, setTokenDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const expirationOptions = [
    { value: 1, label: '1 hour' },
    { value: 8, label: '8 hours' },
    { value: 24, label: '24 hours' },
  ];

  const handleGenerateToken = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const requestData: any = {
        description: formData.description,
        expires_in_hours: formData.expires_in_hours,
      };

      // Handle scopes based on the selected method
      if (formData.scopeMethod === 'custom') {
        const customScopesText = formData.customScopes.trim();
        if (customScopesText) {
          try {
            const parsedScopes = JSON.parse(customScopesText);
            if (!Array.isArray(parsedScopes)) {
              throw new Error('Custom scopes must be a JSON array');
            }
            requestData.requested_scopes = parsedScopes;
          } catch (e) {
            setError('Invalid JSON format for custom scopes. Please provide a valid JSON array.');
            return;
          }
        }
      }
      // If using current scopes, we don't need to set requested_scopes - it will default to user's current scopes

      const response = await axios.post('/api/tokens/generate', requestData, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.data.success) {
        setGeneratedToken(response.data.token_data.access_token);
        setTokenDetails(response.data);
      } else {
        throw new Error('Token generation failed');
      }
    } catch (error: any) {
      console.error('Failed to generate token:', error);
      setError(error.response?.data?.detail || 'Failed to generate token');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyToken = async () => {
    try {
      await navigator.clipboard.writeText(generatedToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = generatedToken;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      try {
        document.execCommand('copy');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error('Failed to copy token:', err);
      }

      document.body.removeChild(textArea);
    }
  };

  const validateCustomScopes = () => {
    if (formData.scopeMethod === 'custom' && formData.customScopes.trim()) {
      try {
        const parsed = JSON.parse(formData.customScopes);
        if (!Array.isArray(parsed)) {
          return 'Custom scopes must be a JSON array';
        }
        return null;
      } catch (e) {
        return 'Invalid JSON format';
      }
    }
    return null;
  };

  const scopeValidationError = validateCustomScopes();

  return (
    <div className="flex flex-col h-full">
      {/* Compact Header Section */}
      <div className="flex-shrink-0 pb-2">
        <div className="text-center">
          <div className="mx-auto w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center mb-2">
            <Key className="w-5 h-5 text-primary" />
          </div>
          <h1 className="text-xl font-bold text-foreground">Generate JWT Token</h1>
          <p className="text-sm text-muted-foreground">
            Generate a personal access token for programmatic access to MCP servers
          </p>
        </div>
      </div>

      {/* Scrollable Content Area */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="max-w-4xl mx-auto space-y-4 pb-6">
          {/* Current User Permissions - Compact */}
          <Card className="p-4 bg-muted">
            <h3 className="text-base font-semibold text-foreground mb-2">Your Current Permissions</h3>
            <div className="mb-2">
              <span className="text-xs font-medium text-foreground">Current Scopes:</span>
              <div className="flex flex-wrap gap-1 mt-1">
                {user?.scopes && user.scopes.length > 0 ? (
                  user.scopes.map((scope) => (
                    <span key={scope} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {scope}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No scopes available</span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <em>Generated tokens can have the same or fewer permissions than your current scopes.</em>
            </p>
          </Card>

          {/* Token Configuration Form */}
          <Card className="p-4">
            <form onSubmit={handleGenerateToken} className="space-y-4">
              <h3 className="text-base font-semibold text-foreground">Token Configuration</h3>

              {/* Form Fields - Responsive Grid */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Left Column */}
                <div className="space-y-3">
                  {/* Description */}
                  <div>
                    <Label htmlFor="description" className="mb-1">
                      Description (optional)
                    </Label>
                    <Input
                      type="text"
                      id="description"
                      className="text-sm"
                      placeholder="e.g., Token for automation script"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    />
                  </div>

                  {/* Expiration */}
                  <div>
                    <Label htmlFor="expires_in_hours" className="mb-1">
                      Expires In
                    </Label>
                    <Select
                      value={String(formData.expires_in_hours)}
                      onValueChange={(val) => setFormData(prev => ({ ...prev, expires_in_hours: parseInt(val) }))}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {expirationOptions.map((option) => (
                          <SelectItem key={option.value} value={String(option.value)}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Right Column */}
                <div className="space-y-3">
                  {/* Scope Configuration */}
                  <div>
                    <h4 className="text-sm font-semibold text-foreground mb-2">Scope Configuration</h4>

                    <div className="space-y-2">
                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="scopeMethod"
                          value="current"
                          checked={formData.scopeMethod === 'current'}
                          onChange={(e) => setFormData(prev => ({ ...prev, scopeMethod: e.target.value as 'current' | 'custom' }))}
                          className="rounded border-border text-primary focus:ring-ring"
                        />
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            Use my current scopes
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Generate token with all your current permissions
                          </div>
                        </div>
                      </label>

                      <label className="flex items-center space-x-2">
                        <input
                          type="radio"
                          name="scopeMethod"
                          value="custom"
                          checked={formData.scopeMethod === 'custom'}
                          onChange={(e) => setFormData(prev => ({ ...prev, scopeMethod: e.target.value as 'current' | 'custom' }))}
                          className="rounded border-border text-primary focus:ring-ring"
                        />
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            Upload custom scopes (JSON)
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Specify custom scopes in JSON format
                          </div>
                        </div>
                      </label>
                    </div>

                    {/* Custom Scopes JSON Input */}
                    {formData.scopeMethod === 'custom' && (
                      <div className="mt-3">
                        <Label htmlFor="customScopes" className="mb-1">
                          Custom Scopes (JSON format)
                        </Label>
                        <Textarea
                          id="customScopes"
                          className={`h-24 font-mono text-xs ${scopeValidationError ? 'border-destructive focus:border-destructive focus:ring-destructive' : ''}`}
                          placeholder={`["mcp-servers-restricted/read", "mcp-registry-user"]`}
                          value={formData.customScopes}
                          onChange={(e) => setFormData(prev => ({ ...prev, customScopes: e.target.value }))}
                        />
                        <p className="mt-1 text-xs text-muted-foreground">
                          Enter a JSON array of scope names. Must be a subset of your current scopes.
                        </p>
                        {scopeValidationError && (
                          <p className="mt-1 text-xs text-destructive">
                            {scopeValidationError}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={loading || scopeValidationError !== null}
                className="w-full flex items-center justify-center space-x-2 py-2 text-sm"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Key className="h-4 w-4" />
                    <span>Generate Token</span>
                  </>
                )}
              </Button>

              {/* Error Display */}
              {error && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="h-4 w-4 text-destructive" />
                    <span className="text-sm text-destructive">{error}</span>
                  </div>
                </div>
              )}
            </form>
          </Card>

          {/* Generated Token Result */}
          {generatedToken && tokenDetails && (
            <Card className="p-4 bg-primary/10 border-primary/20">
              <div className="flex items-center space-x-2 mb-3">
                <Check className="h-5 w-5 text-primary" />
                <h3 className="text-lg font-semibold text-primary">
                  Token Generated Successfully
                </h3>
              </div>

              {/* Token Display */}
              <div className="relative mb-4">
                <div className="bg-card p-4 rounded-lg border border-primary/20">
                  <code className="text-sm font-mono break-all text-foreground">
                    {generatedToken}
                  </code>
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopyToken}
                  className="absolute top-2 right-2"
                  title={copied ? 'Copied!' : 'Copy token'}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Clipboard className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {/* Token Details */}
              <div className="space-y-2 text-sm mb-4">
                <p><strong>Expires:</strong> {new Date(Date.now() + tokenDetails.token_data.expires_in * 1000).toLocaleString()}</p>
                <p><strong>Scopes:</strong> {tokenDetails.requested_scopes.join(', ')}</p>
                {tokenDetails.token_data.description && (
                  <p><strong>Description:</strong> {tokenDetails.token_data.description}</p>
                )}
              </div>

              {/* Usage Instructions */}
              <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg mb-4">
                <h4 className="text-sm font-semibold text-primary mb-2">Usage Instructions</h4>
                <p className="text-sm text-primary mb-2">Use this token in your API requests:</p>
                <code className="block text-sm bg-primary/15 p-2 rounded font-mono text-primary">
                  Authorization: Bearer YOUR_TOKEN_HERE
                </code>
                <p className="text-xs text-primary mt-2">Replace YOUR_TOKEN_HERE with the token above.</p>
              </div>

              {/* Security Warning */}
              <div className="p-4 bg-muted border border-border rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Important:</strong> This token will not be shown again. Save it securely!
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default TokenGeneration;
