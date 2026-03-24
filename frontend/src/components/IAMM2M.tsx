import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  RefreshCw,
  ClipboardCopy,
  Eye,
  EyeOff,
  Pencil,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIAMUsers, useIAMGroups, createM2MAccount, deleteUser, updateUserGroups, CreateM2MPayload, M2MCredentials, IAMUser } from '../hooks/useIAM';
import DeleteConfirmation from './DeleteConfirmation';

interface IAMM2MProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type View = 'list' | 'create' | 'credentials' | 'edit';

interface FormErrors {
  name?: string;
  groups?: string;
}

const IAMM2M: React.FC<IAMM2MProps> = ({ onShowToast }) => {
  // Filter to only M2M accounts
  const { users, isLoading, error, refetch } = useIAMUsers();
  const { groups } = useIAMGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>('list');

  // Create form state
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formGroups, setFormGroups] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Credentials display
  const [credentials, setCredentials] = useState<M2MCredentials | null>(null);
  const [showSecret, setShowSecret] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Edit state
  const [editTarget, setEditTarget] = useState<IAMUser | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const m2mAccounts = useMemo(() => {
    // M2M service accounts are identified by their email domain.
    // The backend sets email to "{clientId}@service-account.local" for all M2M accounts.
    return users.filter(
      (u) => (u.email || '').endsWith('@service-account.local')
    );
  }, [users]);

  const filteredAccounts = useMemo(() => {
    if (!searchQuery) return m2mAccounts;
    const q = searchQuery.toLowerCase();
    return m2mAccounts.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q)
    );
  }, [m2mAccounts, searchQuery]);

  const resetForm = useCallback(() => {
    setFormName('');
    setFormDescription('');
    setFormGroups(new Set());
    setErrors({});
  }, []);

  const toggleGroup = (groupName: string) => {
    setFormGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.info(`${label} copied to clipboard`);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleCreate = async () => {
    // Validate
    const newErrors: FormErrors = {};
    if (!formName.trim()) newErrors.name = 'Name is required';
    if (formGroups.size === 0) newErrors.groups = 'At least one group is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsCreating(true);
    try {
      const payload: CreateM2MPayload = {
        name: formName.trim(),
        description: formDescription.trim() || undefined,
        groups: Array.from(formGroups),
      };
      const creds = await createM2MAccount(payload);
      setCredentials(creds);
      setView('credentials');
      toast.success(`M2M account "${formName}" created`);
      resetForm();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to create M2M account';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (username: string) => {
    await deleteUser(username);
    toast.success(`Account "${username}" deleted`);
    setDeleteTarget(null);
    await refetch();
  };

  const handleEdit = (user: IAMUser) => {
    setEditTarget(user);
    setFormGroups(new Set(user.groups || []));
    setView('edit');
  };

  const handleUpdate = async () => {
    if (!editTarget) return;

    // Validate
    const newErrors: FormErrors = {};
    if (formGroups.size === 0) newErrors.groups = 'At least one group is required';
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setIsUpdating(true);
    try {
      await updateUserGroups(editTarget.username, Array.from(formGroups));
      toast.success(`Groups updated for "${editTarget.username}"`);
      setEditTarget(null);
      setFormGroups(new Set());
      setView('list');
      await refetch();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to update groups';
      toast.error(message);
    } finally {
      setIsUpdating(false);
    }
  };

  // ─── Credentials View (after creation) ────────────────────────
  if (view === 'credentials' && credentials) {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold text-foreground">
          IAM &gt; M2M Accounts &gt; Credentials
        </h2>

        <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 space-y-4">
          <p className="text-sm font-medium text-primary">
            M2M Account Created Successfully
          </p>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Client ID</span>
                <p className="text-sm font-mono text-foreground">{credentials.client_id}</p>
              </div>
              <Button variant="ghost" size="icon-xs" onClick={() => copyToClipboard(credentials.client_id, 'Client ID')} title="Copy">
                <ClipboardCopy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Client Secret</span>
                <p className="text-sm font-mono text-foreground">
                  {showSecret ? credentials.client_secret : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'}
                </p>
              </div>
              <div className="flex items-center space-x-1">
                <Button variant="ghost" size="icon-xs" onClick={() => setShowSecret(!showSecret)} title={showSecret ? 'Hide' : 'Show'}>
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button variant="ghost" size="icon-xs" onClick={() => copyToClipboard(credentials.client_secret, 'Client Secret')} title="Copy">
                  <ClipboardCopy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-muted border border-border rounded p-3">
            <p className="text-xs text-muted-foreground">
              Save these credentials now. The client secret cannot be retrieved later.
            </p>
          </div>
        </div>

        <Button
          variant="link"
          onClick={() => { setCredentials(null); setShowSecret(false); setView('list'); refetch(); }}
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to M2M Accounts List
        </Button>
      </div>
    );
  }

  // ─── Edit View ────────────────────────────────────────────────
  if (view === 'edit' && editTarget) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            IAM &gt; M2M Accounts &gt; Edit "{editTarget.username}"
          </h2>
          <Button variant="ghost" onClick={() => { setFormGroups(new Set()); setEditTarget(null); setErrors({}); setView('list'); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
          </Button>
        </div>

        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Groups *</label>
            <div className={`space-y-2 max-h-48 overflow-y-auto rounded-lg p-3 ${
              errors.groups ? 'border-2 border-red-500' : 'border border-border'
            }`}>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">No groups available</p>
              ) : (
                groups.map((g) => (
                  <label key={g.name} className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={formGroups.has(g.name)}
                      onChange={() => { toggleGroup(g.name); if (errors.groups) setErrors((p) => ({ ...p, groups: undefined })); }}
                      className="rounded border-border text-primary focus:ring-ring" />
                    <span className="text-sm text-foreground">{g.name}</span>
                  </label>
                ))
              )}
            </div>
            {errors.groups && <p className="mt-1 text-sm text-red-500">{errors.groups}</p>}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => { setFormGroups(new Set()); setEditTarget(null); setErrors({}); setView('list'); }}>
            Cancel
          </Button>
          <Button onClick={handleUpdate} disabled={isUpdating}>
            {isUpdating ? 'Updating...' : 'Update Groups'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── Create View ──────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            IAM &gt; M2M Accounts &gt; Create
          </h2>
          <Button variant="ghost" onClick={() => { resetForm(); setView('list'); }}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to List
          </Button>
        </div>

        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Name *</label>
            <Input type="text" value={formName}
              onChange={(e) => { setFormName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: undefined })); }}
              placeholder="e.g. ci-pipeline"
              className={errors.name ? 'border-red-500' : ''} />
            {errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Description (optional)</label>
            <Input type="text" value={formDescription} onChange={(e) => setFormDescription(e.target.value)} />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">Groups *</label>
            <div className={`space-y-2 max-h-48 overflow-y-auto rounded-lg p-3 ${
              errors.groups ? 'border-2 border-red-500' : 'border border-border'
            }`}>
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">No groups available</p>
              ) : (
                groups.map((g) => (
                  <label key={g.name} className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={formGroups.has(g.name)}
                      onChange={() => { toggleGroup(g.name); if (errors.groups) setErrors((p) => ({ ...p, groups: undefined })); }}
                      className="rounded border-border text-primary focus:ring-ring" />
                    <span className="text-sm text-foreground">{g.name}</span>
                  </label>
                ))
              )}
            </div>
            {errors.groups && <p className="mt-1 text-sm text-red-500">{errors.groups}</p>}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => { resetForm(); setView('list'); }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">IAM &gt; M2M Accounts</h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={refetch} title="Refresh">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button onClick={() => setView('create')}>
            <Plus className="h-4 w-4 mr-1" /> Create M2M Account
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search M2M accounts..."
          className="w-full pl-10 pr-4 text-sm" />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" /></div>
      )}
      {error && !isLoading && (
        <div className="text-center py-8 text-destructive text-sm">{error}</div>
      )}
      {!isLoading && !error && filteredAccounts.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No accounts match your search.' : 'No M2M accounts yet. Create your first service account.'}
        </div>
      )}

      {!isLoading && !error && filteredAccounts.length > 0 && (
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Groups</TableHead>
                <TableHead className="text-right py-3 px-4 font-medium text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAccounts.map((u) => (
                <React.Fragment key={u.username}>
                  <TableRow className="border-b border-border hover:bg-accent">
                    <TableCell className="py-3 px-4 text-foreground font-medium">{u.username}</TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-wrap gap-1">
                        {(u.groups || []).map((g) => (
                          <Badge key={g} className="bg-primary/10 text-primary">
                            {g}
                          </Badge>
                        ))}
                        {(!u.groups || u.groups.length === 0) && <span className="text-muted-foreground text-xs">{'\u2014'}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <Button variant="ghost" size="icon-xs" onClick={() => handleEdit(u)} title="Edit groups">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon-xs" onClick={() => setDeleteTarget(u.username)} title="Delete account">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {deleteTarget === u.username && (
                    <TableRow>
                      <TableCell colSpan={3} className="p-2">
                        <DeleteConfirmation
                          entityType="m2m"
                          entityName={u.username}
                          entityPath={u.username}
                          onConfirm={handleDelete}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
};

export default IAMM2M;
