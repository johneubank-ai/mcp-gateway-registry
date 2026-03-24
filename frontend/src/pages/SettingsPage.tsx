import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  ChevronDown,
  ChevronRight,
  Users,
  Globe,
  ArrowLeft,
  ClipboardList,
  Cog,
  Layers,
  IdCard,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import FederationPeers from '../components/FederationPeers';
import FederationPeerForm from '../components/FederationPeerForm';
import ConfigPanel from '../components/ConfigPanel';
import VirtualServerList from '../components/VirtualServerList';
import AuditLogsPage from './AuditLogsPage';
import IAMGroups from '../components/IAMGroups';
import IAMUsers from '../components/IAMUsers';
import IAMM2M from '../components/IAMM2M';
import RegistryCardSettings from '../components/RegistryCardSettings';
import { useAuth } from '../contexts/AuthContext';
import { canAccessSettings } from '../utils/permissions';


interface SettingsItem {
  id: string;
  label: string;
  path: string;
}

interface SettingsCategory {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: SettingsItem[];
  disabled?: boolean; // Greyed out, not clickable -- for future categories
  adminOnly?: boolean; // Visible only to admins
}

/**
 * Settings categories configuration.
 * All active categories require admin access -- gated at the page level.
 * Disabled categories are shown greyed out as a preview of upcoming features.
 *
 * Known issue: Hard-refreshing or directly navigating to a sub-path like
 * /settings/iam/groups causes a blank page because Create React App
 * (homepage: ".") generates relative asset paths. The browser resolves
 * ./static/js/main.xxx.js relative to the current URL, requesting
 * /settings/iam/static/js/main.xxx.js which returns HTML from the SPA
 * catch-all instead of JavaScript.
 * Root fix: inject <base href="/"> in registry/main.py _build_cached_index_html().
 */
const SETTINGS_CATEGORIES: SettingsCategory[] = [
  {
    id: 'registry',
    label: 'Registry',
    icon: <IdCard className="h-5 w-5" />,
    items: [
      { id: 'card', label: 'Registry Card', path: '/settings/registry/card' },
    ],
  },
  {
    id: 'audit',
    label: 'Audit',
    icon: <ClipboardList className="h-5 w-5" />,
    items: [
      { id: 'logs', label: 'Audit Logs', path: '/settings/audit/logs' },
    ],
  },
  {
    id: 'federation',
    label: 'Federation',
    icon: <Globe className="h-5 w-5" />,
    items: [
      { id: 'peers', label: 'Peers', path: '/settings/federation/peers' },
    ],
  },
  {
    id: 'virtual-mcp',
    label: 'Virtual MCP',
    icon: <Layers className="h-5 w-5" />,
    items: [
      { id: 'servers', label: 'Virtual Servers', path: '/settings/virtual-mcp/servers' },
    ],
  },
  {
    id: 'iam',
    label: 'IAM',
    icon: <Users className="h-5 w-5" />,
    items: [
      { id: 'groups', label: 'Groups', path: '/settings/iam/groups' },
      { id: 'users', label: 'Users', path: '/settings/iam/users' },
      { id: 'm2m', label: 'M2M Accounts', path: '/settings/iam/m2m' },
    ],
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: <ClipboardList className="h-5 w-5" />,
    items: [],
    disabled: true,
  },
  {
    id: 'system-config',
    label: 'System Config',
    icon: <Cog className="h-5 w-5" />,
    items: [
      { id: 'configuration', label: 'Configuration', path: '/settings/system-config/configuration' },
    ],
    adminOnly: true,
  },
];


/**
 * SettingsPage component provides a VS Code-style settings interface.
 *
 * Features a collapsible sidebar with categories and a main content area
 * that renders the appropriate component based on the current route.
 */
const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading } = useAuth();

  // All settings categories require admin -- no per-category filtering
  const visibleCategories = canAccessSettings(user) ? SETTINGS_CATEGORIES : [];

  // Track which categories are expanded - auto-expand based on current path
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(() => {
    const initial = new Set(['registry']);
    // Auto-expand the category matching the current route
    for (const category of SETTINGS_CATEGORIES) {
      for (const item of category.items) {
        if (location.pathname.startsWith(item.path) || location.pathname.startsWith(`/settings/${category.id}`)) {
          initial.add(category.id);
        }
      }
    }
    return initial;
  });

  // Redirect non-admin users to home (only after auth has loaded)
  useEffect(() => {
    if (!loading && !canAccessSettings(user)) {
      navigate('/', { replace: true });
    }
  }, [user, loading, navigate]);

  // Show spinner while auth is loading.
  // Must return a valid element (not null) because Layout uses cloneElement.
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  /**
   * Show a toast notification via sonner.
   */
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (type === 'error') toast.error(message);
    else if (type === 'info') toast.info(message);
    else toast.success(message);
  };

  /**
   * Toggle category expansion.
   */
  const toggleCategory = (categoryId: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  /**
   * Check if a path is currently active.
   */
  const isActivePath = (path: string): boolean => {
    return location.pathname.startsWith(path);
  };

  /**
   * Get the current active item ID.
   */
  const getActiveItemId = (): string | null => {
    for (const category of SETTINGS_CATEGORIES) {
      for (const item of category.items) {
        if (isActivePath(item.path)) {
          return item.id;
        }
      }
    }
    return null;
  };

  /**
   * Render the content area based on current route.
   */
  const renderContent = () => {
    const path = location.pathname;

    // Audit > Logs
    if (path === '/settings/audit/logs' || path === '/settings/audit') {
      return <AuditLogsPage embedded />;
    }

    // Registry > Card
    if (path === '/settings/registry/card' || path === '/settings/registry') {
      return <RegistryCardSettings onShowToast={showToast} />;
    }

    // Federation > Peers list
    if (path === '/settings/federation/peers' || path === '/settings/federation') {
      return <FederationPeers onShowToast={showToast} />;
    }

    // Federation > Add peer
    if (path === '/settings/federation/peers/add') {
      return <FederationPeerForm onShowToast={showToast} />;
    }

    // Federation > Edit peer
    const editMatch = path.match(/^\/settings\/federation\/peers\/([^/]+)\/edit$/);
    if (editMatch) {
      return <FederationPeerForm peerId={editMatch[1]} onShowToast={showToast} />;
    }

    // Virtual MCP > Servers
    if (path === '/settings/virtual-mcp/servers' || path === '/settings/virtual-mcp') {
      return <VirtualServerList onShowToast={showToast} />;
    }

    // System Config > Configuration
    if (path === '/settings/system-config/configuration' || path === '/settings/system-config') {
      return <ConfigPanel showToast={showToast} />;
    }

    // IAM > Groups
    if (path === '/settings/iam/groups' || path === '/settings/iam') {
      return <IAMGroups onShowToast={showToast} />;
    }

    // IAM > Users
    if (path === '/settings/iam/users') {
      return <IAMUsers onShowToast={showToast} />;
    }

    // IAM > M2M Accounts
    if (path === '/settings/iam/m2m') {
      return <IAMM2M onShowToast={showToast} />;
    }

    // Default to Audit Logs (all settings require admin)
    return <AuditLogsPage embedded />;
  };

  const activeItemId = getActiveItemId();


  return (
    <div className="flex flex-col h-full">
      {/* Header with back button */}
      <div className="flex items-center space-x-4 mb-6">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/')}
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex flex-1 gap-6 min-h-0">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-card rounded-lg shadow-xs border border-border p-4">
            <nav className="space-y-1">
              {visibleCategories.map((category) => (
                <div key={category.id}>
                  {/* Category header */}
                  <button
                    onClick={() => !category.disabled && toggleCategory(category.id)}
                    disabled={category.disabled}
                    className={`w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      category.disabled
                        ? 'text-muted-foreground cursor-not-allowed'
                        : 'text-foreground hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-3">
                      <span className={category.disabled ? 'opacity-40' : ''}>
                        {category.icon}
                      </span>
                      <span>{category.label}</span>
                    </div>
                    {!category.disabled && (
                      expandedCategories.has(category.id) ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )
                    )}
                  </button>

                  {/* Category items */}
                  {!category.disabled && expandedCategories.has(category.id) && (
                    <div className="ml-8 mt-1 space-y-1">
                      {category.items.map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.path)}
                          className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                            activeItemId === item.id
                              ? 'bg-primary/10 text-primary font-medium'
                              : 'text-muted-foreground hover:bg-accent'
                          }`}
                        >
                          {item.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </nav>
          </div>
        </div>

        {/* Content area */}
        <div className="flex-1 min-w-0">
          <div className="bg-card rounded-lg shadow-xs border border-border p-6 h-full overflow-y-auto">
            {renderContent()}
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsPage;
