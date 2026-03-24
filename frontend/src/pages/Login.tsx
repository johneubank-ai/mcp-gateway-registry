import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface OAuthProvider {
  name: string;
  display_name: string;
  icon?: string;
}

const Login: React.FC = () => {
  const [error, setError] = useState('');
  const [oauthProviders, setOauthProviders] = useState<OAuthProvider[]>([]);
  const [authServerUrl, setAuthServerUrl] = useState<string>('');
  const [searchParams] = useSearchParams();

  useEffect(() => {
    console.log('[Login] Component mounted, fetching OAuth providers...');
    fetchAuthConfig();
    fetchOAuthProviders();

    // Check for error parameter from URL (e.g., from OAuth callback)
    const urlError = searchParams.get('error');
    if (urlError) {
      setError(decodeURIComponent(urlError));
    }
  }, [searchParams]);

    const fetchAuthConfig = async () => {
        try {
            const response = await axios.get('/api/auth/config');
            setAuthServerUrl(response.data.auth_server_url || '');
        } catch (error) {
            console.error('Failed to fetch auth config:', error);
            // Fallback to localhost for development
            setAuthServerUrl('http://localhost:8888');
        }
    };

  // Log when oauthProviders state changes
  useEffect(() => {
    console.log('[Login] oauthProviders state changed:', oauthProviders);
  }, [oauthProviders]);

  const fetchOAuthProviders = async () => {
    try {
      console.log('[Login] Fetching OAuth providers from /api/auth/providers');
      // Call the registry auth providers endpoint
      const response = await axios.get('/api/auth/providers');
      console.log('[Login] Response received:', response.data);
      console.log('[Login] Providers:', response.data.providers);
      setOauthProviders(response.data.providers || []);
      console.log('[Login] State updated with', response.data.providers?.length || 0, 'providers');
    } catch (error) {
      console.error('[Login] Failed to fetch OAuth providers:', error);
    }
  };

  const handleOAuthLogin = (provider: string) => {
    const currentOrigin = window.location.origin;
    // Get the base path from the <base> tag or default to '/'
    const baseElement = document.querySelector('base');
    const basePath = baseElement?.getAttribute('href') || '/';
    const redirectUri = encodeURIComponent(currentOrigin + basePath);

    // Use the auth server URL from config, fallback to localhost if not loaded yet
    const authUrl = authServerUrl || 'http://localhost:8888';
    window.location.href = `${authUrl}/oauth2/login/${provider}?redirect_uri=${redirectUri}`;
  };

  return (
    <div className="min-h-screen bg-muted flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="text-center text-3xl font-bold text-foreground">
          Sign in to AI Gateway & Registry
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground">
          Access your AI management dashboard
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <Card className="p-8">
          {error && (
            <div className="p-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg flex items-start space-x-2 mb-6">
              <AlertTriangle className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* OAuth Providers */}
          {oauthProviders.length > 0 && (
            <div className="space-y-3">
              {oauthProviders.map((provider) => (
                <Button
                  key={provider.name}
                  variant="outline"
                  onClick={() => handleOAuthLogin(provider.name)}
                  className="w-full flex items-center justify-center px-4 py-3 shadow-xs text-sm font-medium transition-all duration-200 hover:shadow-md"
                >
                  <span>Continue with {provider.display_name}</span>
                </Button>
              ))}
            </div>
          )}

          {/* Fallback when no providers are configured */}
          {oauthProviders.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">
                No login methods are currently configured.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Please contact your administrator.
              </p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Login;
