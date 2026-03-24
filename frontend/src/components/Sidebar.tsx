import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  X,
  Filter,
  BarChart3,
  Key,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clipboard,
  Check,
  Download,
  Tag,
} from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

interface SidebarProps {
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
  stats: {
    total: number;
    enabled: number;
    disabled: number;
    withIssues: number;
  };
  activeFilter: string;
  setActiveFilter: (filter: string) => void;
  availableTags: string[];
  selectedTags: string[];
  onTagSelect: (tag: string) => void;
}


const Sidebar: React.FC<SidebarProps> = ({ sidebarOpen, setSidebarOpen, stats, activeFilter, setActiveFilter, availableTags, selectedTags, onTagSelect }) => {
  // const { stats, activeFilter, setActiveFilter } = useServerStats();
  const { user } = useAuth();
  const location = useLocation();
  const [showScopes, setShowScopes] = useState(false);
  const [tagDropdownOpen, setTagDropdownOpen] = useState(false);
  const [tagSearch, setTagSearch] = useState('');
  const [tagHighlightIndex, setTagHighlightIndex] = useState(0);
  const tagDropdownRef = React.useRef<HTMLDivElement>(null);
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>('');

  const filters = [
    { key: 'all', label: 'All Services', count: 'total' },
    { key: 'enabled', label: 'Enabled', count: 'enabled' },
    { key: 'disabled', label: 'Disabled', count: 'disabled' },
    { key: 'unhealthy', label: 'With Issues', count: 'withIssues' },
  ];

  const isTokenPage = location.pathname === '/generate-token';

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(e.target as Node)) {
        setTagDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debug logging
  useEffect(() => {
    console.log('Sidebar state changed:', sidebarOpen);
  }, [sidebarOpen]);

  // Scope descriptions mapping
  const getScopeDescription = (scope: string) => {
    const scopeMappings: { [key: string]: string } = {
      'mcp-servers-restricted/read': 'Read access to restricted MCP servers',
      'mcp-servers/read': 'Read access to all MCP servers',
      'mcp-servers/write': 'Write access to MCP servers',
      'mcp-registry-user': 'Basic registry user permissions',
      'mcp-registry-admin': 'Full registry administration access',
      'health-check': 'Health check and monitoring access',
      'token-generation': 'Ability to generate access tokens',
      'server-management': 'Manage server configurations',
    };
    return scopeMappings[scope] || 'Custom permission scope';
  };

const fetchAdminTokens = async () => {
  setLoading(true);
  setError('');
  try {
    const requestData = {
      description: 'Generated via sidebar',
      expires_in_hours: 8,
    };

    const response = await axios.post('/api/tokens/generate', requestData, {
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (response.data.success) {
      setTokenData(response.data);
      setShowTokenModal(true);
    }
  } catch (err: any) {
    setError(err.response?.data?.detail || 'Failed to generate token');
  } finally {
    setLoading(false);
  }
};


  const handleCopyTokens = async () => {
    if (!tokenData) return;

    const formattedData = JSON.stringify(tokenData, null, 2);
    try {
      await navigator.clipboard.writeText(formattedData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleDownloadTokens = () => {
    if (!tokenData) return;

    const formattedData = JSON.stringify(tokenData, null, 2);
    const blob = new Blob([formattedData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-registry-api-tokens-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Conditional Content */}
      {isTokenPage ? (
        /* Token Page - Show navigation and user info */
        <div className="flex-1 p-4 md:p-6">
          {/* Navigation Links */}
          <div className="space-y-2 mb-6">
            <Link
              to="/"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring text-foreground hover:bg-accent"
              onClick={() => window.innerWidth < 768 && setSidebarOpen(false)} // Only close on mobile
              tabIndex={0}
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Dashboard</span>
            </Link>

            <Link
              to="/generate-token"
              className="flex items-center space-x-3 px-3 py-2 rounded-lg text-sm transition-colors focus:outline-hidden focus:ring-2 focus:ring-ring bg-primary/10 text-primary"
              tabIndex={0}
            >
              <Key className="h-4 w-4" />
              <span>Generate Token</span>
            </Link>
          </div>

          {/* User Access Information */}
          {user && (
            <div className="p-3 bg-muted rounded-lg mb-6">
              <div className="text-sm">
                <div className="font-medium text-foreground mb-1">
                  {user.username}
                </div>
                <div className="text-xs text-muted-foreground mb-2">
                  {user.is_admin ? (
                    <span className="text-foreground font-medium">Admin Access</span>
                  ) : user.can_modify_servers ? (
                    <span className="text-foreground font-medium">Modify Access</span>
                  ) : (
                    <span className="text-muted-foreground">Read-only Access</span>
                  )}
                  {user.auth_method === 'oauth2' && user.provider && (
                    <span className="ml-1">({user.provider})</span>
                  )}
                </div>

                {/* Scopes toggle */}
                {!user.is_admin && user.scopes && user.scopes.length > 0 && (
                  <div>
                    <button
                      onClick={() => setShowScopes(!showScopes)}
                      className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                    >
                      <span>Scopes ({user.scopes.length})</span>
                      {showScopes ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </button>

                    {showScopes && (
                      <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                        {user.scopes.map((scope) => (
                          <div key={scope} className="bg-primary/10 p-2 rounded text-xs">
                            <div className="font-medium text-primary">
                              {scope}
                            </div>
                            <div className="text-primary mt-1">
                              {getScopeDescription(scope)}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Token Generation Help */}
          <div className="text-center">
            <Key className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">Token Generation</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Create personal access tokens for programmatic access to MCP servers
            </p>
            <div className="text-xs text-muted-foreground space-y-1">
              <p>- Tokens inherit your current permissions</p>
              <p>- Configure expiration time and scopes</p>
              <p>- Use tokens for programmatic access</p>
            </div>
          </div>
        </div>
      ) : (
        /* Dashboard - Show user info, filters and stats */
        <>
          {/* User Info Header */}
          <div className="p-4 md:p-6 border-b border-border">
            {/* User Access Information */}
            {user && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-sm">
                  <div className="font-medium text-foreground mb-1">
                    {user.username}
                  </div>
                  <div className="text-xs text-muted-foreground mb-2">
                    {user.is_admin ? (
                      <span className="text-foreground font-medium">Admin Access</span>
                    ) : user.can_modify_servers ? (
                      <span className="text-foreground font-medium">Modify Access</span>
                    ) : (
                      <span className="text-muted-foreground">Read-only Access</span>
                    )}
                    {user.auth_method === 'oauth2' && user.provider && (
                      <span className="ml-1">({user.provider})</span>
                    )}
                  </div>

                  {/* JWT Token Button - Available to all users */}
                  <div className="mb-2">
                    <Button
                      onClick={fetchAdminTokens}
                      disabled={loading}
                      variant="secondary"
                      size="sm"
                      className="w-full"
                    >
                      {loading ? (
                        <>
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-foreground"></div>
                          <span>Loading...</span>
                        </>
                      ) : (
                        <>
                          <Key data-icon="inline-start" />
                          <span>Get JWT Token</span>
                        </>
                      )}
                    </Button>
                    {error && (
                      <p className="mt-1 text-xs text-destructive">{error}</p>
                    )}
                  </div>

                  {/* Scopes toggle */}
                  {!user.is_admin && user.scopes && user.scopes.length > 0 && (
                    <div>
                      <button
                        onClick={() => setShowScopes(!showScopes)}
                        className="flex items-center justify-between w-full text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
                      >
                        <span>Scopes ({user.scopes.length})</span>
                        {showScopes ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                      </button>

                      {showScopes && (
                        <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                          {user.scopes.map((scope) => (
                            <div key={scope} className="bg-primary/10 p-2 rounded text-xs">
                              <div className="font-medium text-primary">
                                {scope}
                              </div>
                              <div className="text-primary mt-1">
                                {getScopeDescription(scope)}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Filters Section */}
          <div className="flex-1 p-4 md:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Filter Services</h3>
            </div>

            <div className="flex flex-col gap-1">
              {filters.map((filter) => (
                <Button
                  key={filter.key}
                  variant={activeFilter === filter.key ? 'secondary' : 'ghost'}
                  size="lg"
                  onClick={() => setActiveFilter(filter.key)}
                  className={`w-full justify-between ${
                    activeFilter === filter.key
                      ? 'bg-accent text-accent-foreground'
                      : ''
                  }`}
                >
                  <span>{filter.label}</span>
                  <Badge variant="secondary">
                    {stats[filter.count as keyof typeof stats]}
                  </Badge>
                </Button>
              ))}
            </div>
          </div>

          {/* Tags Section */}
          {availableTags.length > 0 && (
            <div className="border-t border-border p-4 md:p-6">
              <div className="flex items-center space-x-2 mb-3">
                <Tag className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-medium text-foreground">Filter by Tag</h3>
                {selectedTags.length > 0 && (
                  <button
                    onClick={() => selectedTags.forEach(t => onTagSelect(t))}
                    className="text-xs text-primary hover:underline ml-auto"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Selected tag chips */}
              {selectedTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {selectedTags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="gap-1 cursor-pointer"
                      onClick={() => onTagSelect(tag)}
                    >
                      {tag}
                      <X className="h-3 w-3" data-icon="inline-end" />
                    </Badge>
                  ))}
                </div>
              )}

              {/* Tag dropdown */}
              {(() => {
                const filteredTags = availableTags.filter(tag =>
                  !selectedTags.includes(tag) &&
                  tag.toLowerCase().includes(tagSearch.toLowerCase())
                );
                return (
                  <div className="relative" ref={tagDropdownRef}>
                    <Input
                      type="text"
                      placeholder="Search tags..."
                      value={tagSearch}
                      onChange={(e) => {
                        setTagSearch(e.target.value);
                        setTagHighlightIndex(0);
                        setTagDropdownOpen(true);
                      }}
                      onFocus={() => {
                        setTagDropdownOpen(true);
                        setTagHighlightIndex(0);
                      }}
                      onKeyDown={(e) => {
                        if (!tagDropdownOpen || filteredTags.length === 0) return;
                        if (e.key === 'ArrowDown') {
                          e.preventDefault();
                          setTagHighlightIndex(prev => Math.min(prev + 1, filteredTags.length - 1));
                        } else if (e.key === 'ArrowUp') {
                          e.preventDefault();
                          setTagHighlightIndex(prev => Math.max(prev - 1, 0));
                        } else if (e.key === 'Enter') {
                          e.preventDefault();
                          const tag = filteredTags[tagHighlightIndex];
                          if (tag) {
                            onTagSelect(tag);
                            setTagSearch('');
                            setTagHighlightIndex(0);
                            setTagDropdownOpen(false);
                          }
                        } else if (e.key === 'Escape') {
                          setTagDropdownOpen(false);
                        }
                      }}
                      className="w-full text-xs"
                    />
                    {tagDropdownOpen && (
                      <div className="absolute z-50 mt-1 w-full max-h-40 overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
                        {filteredTags.map((tag, idx) => (
                          <button
                            key={tag}
                            onClick={() => {
                              onTagSelect(tag);
                              setTagSearch('');
                              setTagHighlightIndex(0);
                              setTagDropdownOpen(false);
                            }}
                            onMouseEnter={() => setTagHighlightIndex(idx)}
                            className={`w-full text-left px-3 py-1.5 text-xs transition-colors ${
                              idx === tagHighlightIndex
                                ? 'bg-primary/10 text-primary'
                                : 'text-foreground hover:bg-primary/10 hover:text-primary dark:hover:text-primary'
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                        {filteredTags.length === 0 && (
                          <div className="px-3 py-2 text-xs text-muted-foreground">
                            No matching tags
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Statistics Section */}
          <div className="border-t border-border p-4 md:p-6">
            <div className="flex items-center space-x-2 mb-4">
              <BarChart3 className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-sm font-medium text-foreground">Statistics</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card className="text-center">
                <CardContent className="py-3">
                  <div className="text-xl font-semibold text-foreground">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="py-3">
                  <div className="text-xl font-semibold text-primary">{stats.enabled}</div>
                  <div className="text-xs text-muted-foreground">Enabled</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="py-3">
                  <div className="text-xl font-semibold text-muted-foreground">{stats.disabled}</div>
                  <div className="text-xs text-muted-foreground">Disabled</div>
                </CardContent>
              </Card>
              <Card className="text-center">
                <CardContent className="py-3">
                  <div className="text-xl font-semibold text-destructive">{stats.withIssues}</div>
                  <div className="text-xs text-muted-foreground">Issues</div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile sidebar - Sheet */}
      {window.innerWidth < 768 && (
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent
            side="left"
            className="w-full max-w-xs p-0 bg-card border-r border-border"
            showCloseButton={false}
          >
            <div className="absolute right-0 top-0 -mr-12 flex w-16 justify-center pt-5">
              <button
                type="button"
                className="-m-2.5 p-2.5"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close sidebar"
              >
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex grow flex-col gap-y-5 overflow-y-auto">
              {sidebarContent}
            </div>
          </SheetContent>
        </Sheet>
      )}

      {/* Desktop sidebar */}
      {window.innerWidth >= 768 && sidebarOpen && (
        <div className="fixed left-0 top-16 bottom-0 z-40 w-64 lg:w-72 xl:w-80 bg-card border-r border-border overflow-y-auto transition ease-in-out duration-300 transform">
          {sidebarContent}
        </div>
      )}

      {/* Token Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="sm:max-w-3xl bg-card p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-medium leading-6 text-foreground">
              JWT Access Token
            </DialogTitle>
          </DialogHeader>

          {tokenData && (
            <div className="space-y-4">
              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button
                  onClick={handleCopyTokens}
                  className="flex items-center space-x-2 bg-primary text-white hover:bg-primary/90 text-sm"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Clipboard className="h-4 w-4" />
                      <span>Copy JSON</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleDownloadTokens}
                  className="flex items-center space-x-2 bg-primary text-white hover:bg-primary/90 text-sm"
                >
                  <Download className="h-4 w-4" />
                  <span>Download JSON</span>
                </Button>
              </div>

              {/* Token Data Display */}
              <div className="bg-muted rounded-lg p-4 max-h-96 overflow-y-auto">
                <pre className="text-xs text-foreground whitespace-pre-wrap break-all">
                  {JSON.stringify(tokenData, null, 2)}
                </pre>
              </div>

              {/* Close Button */}
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => setShowTokenModal(false)}
                  className="text-sm"
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Sidebar;
