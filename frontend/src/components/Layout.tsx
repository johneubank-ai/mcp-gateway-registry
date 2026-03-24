import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Menu,
  User,
  ChevronDown,
  LogOut,
  Settings,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import Sidebar from './Sidebar';
import UptimeDisplay from './UptimeDisplay';
import { useServerStats } from '../hooks/useServerStats';
import { useAuth } from '../contexts/AuthContext';
import logo from '../assets/logo.png';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [version, setVersion] = useState<string | null>(null);
  const { user, logout } = useAuth();
  const { stats, activeFilter, setActiveFilter } = useServerStats();
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleTagSelect = useCallback((tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  }, []);

  const fetchTags = useCallback(() => {
    fetch('/api/search/tags')
      .then(res => res.json())
      .then(data => setAvailableTags(data.tags || []))
      .catch(err => console.error('Failed to fetch tags:', err));
  }, []);

  useEffect(() => {
    // Fetch version from API
    fetch('/api/version')
      .then(res => res.json())
      .then(data => setVersion(data.version))
      .catch(err => console.error('Failed to fetch version:', err));

    // Initial tag fetch
    fetchTags();

    // Re-fetch tags when servers/agents are registered, updated, or deleted
    const handleTagRefresh = () => fetchTags();
    window.addEventListener('registry-data-changed', handleTagRefresh);
    return () => window.removeEventListener('registry-data-changed', handleTagRefresh);
  }, [fetchTags]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <div className="min-h-screen bg-background overflow-hidden">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-card shadow-xs border-b border-border">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Left side */}
            <div className="flex items-center">
              {/* Sidebar toggle button - visible on all screen sizes */}
              <button
                type="button"
                className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent focus:outline-hidden focus:ring-2 focus:ring-ring mr-2"
                onClick={() => {
                  console.log('Toggle clicked, current state:', sidebarOpen);
                  setSidebarOpen(!sidebarOpen);
                }}
              >
                <Menu className="h-6 w-6" />
              </button>

              {/* Logo */}
              <div className="flex items-center ml-2 md:ml-0">
                <Link to="/" className="flex items-center hover:opacity-80 transition-opacity">
                  <img
                    src={logo}
                    alt="AI Gateway & Registry Logo"
                    className="h-8 w-8 dark:brightness-0 dark:invert"
                  />
                  <span className="ml-2 text-xl font-bold text-foreground">
                    AI Gateway & Registry
                  </span>
                </Link>
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center space-x-4">
              {/* GitHub link */}
              <a
                href="https://github.com/agentic-community/mcp-gateway-registry"
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
                title="View on GitHub"
              >
                <svg
                  className="h-5 w-5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z"
                    clipRule="evenodd"
                  />
                </svg>
              </a>

              {/* Version badge */}
              {version && (
                <Badge variant="outline" className="hidden md:inline-flex">
                  {version}
                </Badge>
              )}

              {/* Uptime display */}
              <UptimeDisplay />

              {/* Settings gear icon (admin only) */}
              {user?.is_admin && (
                <Link
                  to="/settings"
                  className="p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent"
                  title="Settings"
                >
                  <Settings className="h-5 w-5" />
                </Link>
              )}

              {/* User dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center space-x-3 text-sm rounded-full focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 p-2 hover:bg-accent">
                  <div className="h-8 w-8 rounded-full bg-primary/10 dark:bg-primary flex items-center justify-center">
                    <User className="h-5 w-5 text-primary" />
                  </div>
                  <span className="hidden md:block text-foreground font-medium">
                    {user?.username || 'Admin'}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-foreground cursor-pointer"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-screen pt-16">
        {/* Sidebar */}
        <Sidebar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          stats={stats}
          activeFilter={activeFilter}
          setActiveFilter={setActiveFilter}
          availableTags={availableTags}
          selectedTags={selectedTags}
          onTagSelect={handleTagSelect}
        />


        {/* Main content */}
        <main className={`flex-1 flex flex-col transition-all duration-300 ${
          sidebarOpen ? 'md:ml-64 lg:ml-72 xl:ml-80' : ''
        }`}>
          <div className="flex-1 flex flex-col px-4 sm:px-6 lg:px-8 py-4 md:py-8 overflow-y-auto">
            {React.cloneElement(children as React.ReactElement, { activeFilter, selectedTags })}
          </div>
        </main>
      </div>
    </div>
  );
};

export default Layout;
