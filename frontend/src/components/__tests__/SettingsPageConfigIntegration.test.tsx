import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SettingsPage from '../../pages/SettingsPage';

// Mock auth context
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}));
import { useAuth } from '../../contexts/AuthContext';

// Mock child components to avoid deep rendering
vi.mock('../../pages/AuditLogsPage', () => ({ default: () => <div>AuditLogsPage</div> }));
vi.mock('../FederationPeers', () => ({ default: () => <div>FederationPeers</div> }));
vi.mock('../FederationPeerForm', () => ({ default: () => <div>FederationPeerForm</div> }));
vi.mock('../ConfigPanel', () => ({ default: () => <div data-testid="config-panel-mock">ConfigPanel</div> }));

describe('SettingsPage - System Config category', () => {
  test('shows System Config category for admin users', () => {
    (useAuth as vi.Mock).mockReturnValue({
      user: { username: 'admin', is_admin: true },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('System Config')).toBeInTheDocument();
  });

  test('hides System Config category for non-admin users', () => {
    (useAuth as vi.Mock).mockReturnValue({
      user: { username: 'viewer', is_admin: false },
      loading: false,
    });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <SettingsPage />
      </MemoryRouter>
    );

    expect(screen.queryByText('System Config')).not.toBeInTheDocument();
  });
});
