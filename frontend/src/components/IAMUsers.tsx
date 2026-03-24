import React, { useState, useMemo, useCallback } from 'react';
import {
  Plus,
  Search,
  Trash2,
  ArrowLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Pencil,
  X,
  Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useIAMUsers, useIAMGroups, createHumanUser, deleteUser, updateUserGroups, CreateHumanUserPayload } from '../hooks/useIAM';
import DeleteConfirmation from './DeleteConfirmation';
import SearchableSelect from './SearchableSelect';

interface IAMUsersProps {
  onShowToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type View = 'list' | 'create';

/**
 * Form validation errors -- follows the same pattern as FederationPeerForm.
 */
interface FormErrors {
  username?: string;
  email?: string;
  first_name?: string;
  last_name?: string;
  password?: string;
}

const IAMUsers: React.FC<IAMUsersProps> = ({ onShowToast }) => {
  const { users, isLoading, error, refetch } = useIAMUsers();
  const { groups } = useIAMGroups();
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<View>('list');

  // Create form state
  const [formUsername, setFormUsername] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formFirstName, setFormFirstName] = useState('');
  const [formLastName, setFormLastName] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [formGroups, setFormGroups] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Delete state
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  // Edit groups state
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editGroups, setEditGroups] = useState<Set<string>>(new Set());
  const [isSavingGroups, setIsSavingGroups] = useState(false);

  const filteredUsers = useMemo(() => {
    if (!searchQuery) return users;
    const q = searchQuery.toLowerCase();
    return users.filter(
      (u) =>
        u.username.toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.first_name || '').toLowerCase().includes(q) ||
        (u.last_name || '').toLowerCase().includes(q)
    );
  }, [users, searchQuery]);

  const resetForm = useCallback(() => {
    setFormUsername('');
    setFormEmail('');
    setFormFirstName('');
    setFormLastName('');
    setFormPassword('');
    setShowPassword(false);
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

  /** Clear a single field error when the user edits that field. */
  const clearError = (field: keyof FormErrors) => {
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /** Validate all fields. Returns true if valid. */
  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formUsername.trim()) newErrors.username = 'Username is required';
    if (!formEmail.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(formEmail.trim())) {
      newErrors.email = 'Enter a valid email address';
    }
    if (!formFirstName.trim()) newErrors.first_name = 'First name is required';
    if (!formLastName.trim()) newErrors.last_name = 'Last name is required';
    if (!formPassword) newErrors.password = 'Password is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    setIsCreating(true);
    try {
      const payload: CreateHumanUserPayload = {
        username: formUsername.trim(),
        email: formEmail.trim(),
        first_name: formFirstName.trim(),
        last_name: formLastName.trim(),
        password: formPassword,
        groups: formGroups.size > 0 ? Array.from(formGroups) : undefined,
      };
      await createHumanUser(payload);
      toast.success(`User "${formUsername}" created successfully`);
      resetForm();
      setView('list');
      await refetch();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      const message = Array.isArray(detail)
        ? detail.map((d: any) => d.msg).join(', ')
        : detail || 'Failed to create user';
      toast.error(message);
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (username: string) => {
    await deleteUser(username);
    toast.success(`User "${username}" deleted`);
    setDeleteTarget(null);
    await refetch();
  };

  const startEditGroups = (username: string, currentGroups: string[]) => {
    setEditingUser(username);
    setEditGroups(new Set(currentGroups));
  };

  const cancelEditGroups = () => {
    setEditingUser(null);
    setEditGroups(new Set());
  };

  const handleSaveGroups = async () => {
    if (!editingUser) return;
    setIsSavingGroups(true);
    try {
      const result = await updateUserGroups(editingUser, Array.from(editGroups));
      const addedCount = result.added?.length || 0;
      const removedCount = result.removed?.length || 0;
      if (addedCount > 0 || removedCount > 0) {
        toast.success(
          `Groups updated: ${addedCount} added, ${removedCount} removed`
        );
      } else {
        toast.info('No changes made');
      }
      setEditingUser(null);
      setEditGroups(new Set());
      await refetch();
    } catch (err: any) {
      const message = err.response?.data?.detail || 'Failed to update groups';
      toast.error(message);
    } finally {
      setIsSavingGroups(false);
    }
  };

  const toggleEditGroup = (groupName: string) => {
    setEditGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupName)) next.delete(groupName);
      else next.add(groupName);
      return next;
    });
  };

  const addGroupToEdit = (groupName: string) => {
    if (groupName && !editGroups.has(groupName)) {
      setEditGroups((prev) => {
        const next = new Set(prev);
        next.add(groupName);
        return next;
      });
    }
  };

  const removeGroupFromEdit = (groupName: string) => {
    setEditGroups((prev) => {
      const next = new Set(prev);
      next.delete(groupName);
      return next;
    });
  };

  // Helper: input border class based on error state
  const inputErrorClass = (field: keyof FormErrors) =>
    errors[field] ? 'border-red-500' : '';

  // ─── Create View ──────────────────────────────────────────────
  if (view === 'create') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            IAM &gt; Users &gt; Create
          </h2>
          <Button
            variant="ghost"
            onClick={() => { resetForm(); setView('list'); }}
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to List
          </Button>
        </div>

        <div className="space-y-4 max-w-lg">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Username *</label>
            <Input type="text" value={formUsername}
              onChange={(e) => { setFormUsername(e.target.value); clearError('username'); }}
              placeholder="e.g. jdoe"
              className={inputErrorClass('username')} />
            {errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Email *</label>
            <Input type="email" value={formEmail}
              onChange={(e) => { setFormEmail(e.target.value); clearError('email'); }}
              placeholder="user@example.com"
              className={inputErrorClass('email')} />
            {errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">First Name *</label>
              <Input type="text" value={formFirstName}
                onChange={(e) => { setFormFirstName(e.target.value); clearError('first_name'); }}
                className={inputErrorClass('first_name')} />
              {errors.first_name && <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>}
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Last Name *</label>
              <Input type="text" value={formLastName}
                onChange={(e) => { setFormLastName(e.target.value); clearError('last_name'); }}
                className={inputErrorClass('last_name')} />
              {errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Password *</label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={formPassword}
                onChange={(e) => { setFormPassword(e.target.value); clearError('password'); }}
                placeholder="Initial password"
                className={`pr-10 ${inputErrorClass('password')}`}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-500">{errors.password}</p>}
          </div>

          {/* Group selection */}
          <div>
            <label className="block text-sm text-muted-foreground mb-2">Groups</label>
            <div className="space-y-2 max-h-48 overflow-y-auto border border-border rounded-lg p-3">
              {groups.length === 0 ? (
                <p className="text-xs text-muted-foreground">No groups available</p>
              ) : (
                groups.map((g) => (
                  <label key={g.name} className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formGroups.has(g.name)}
                      onChange={() => toggleGroup(g.name)}
                      className="rounded border-border text-primary focus:ring-ring"
                    />
                    <span className="text-sm text-foreground">{g.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4 border-t border-border">
          <Button variant="secondary" onClick={() => { resetForm(); setView('list'); }}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={isCreating}>
            {isCreating ? 'Creating...' : 'Create User'}
          </Button>
        </div>
      </div>
    );
  }

  // ─── List View ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">IAM &gt; Users</h2>
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="icon" onClick={refetch} title="Refresh">
            <RefreshCw className="h-5 w-5" />
          </Button>
          <Button onClick={() => setView('create')}>
            <Plus className="h-4 w-4 mr-1" /> Create User
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-10 pr-4 text-sm" />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><RefreshCw className="h-6 w-6 text-muted-foreground animate-spin" /></div>
      )}
      {error && !isLoading && (
        <div className="text-center py-8 text-destructive text-sm">{error}</div>
      )}
      {!isLoading && !error && filteredUsers.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          {searchQuery ? 'No users match your search.' : 'No users yet. Create your first user.'}
        </div>
      )}

      {!isLoading && !error && filteredUsers.length > 0 && (
        <div className="overflow-x-auto">
          <Table className="w-full text-sm">
            <TableHeader>
              <TableRow className="border-b border-border">
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Username</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Email</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Name</TableHead>
                <TableHead className="text-left py-3 px-4 font-medium text-muted-foreground">Groups</TableHead>
                <TableHead className="text-right py-3 px-4 font-medium text-muted-foreground">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((u) => (
                <React.Fragment key={u.username}>
                  <TableRow className="border-b border-border hover:bg-accent">
                    <TableCell className="py-3 px-4 text-foreground font-medium">{u.username}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground">{u.email || '\u2014'}</TableCell>
                    <TableCell className="py-3 px-4 text-muted-foreground">
                      {[u.first_name, u.last_name].filter(Boolean).join(' ') || '\u2014'}
                    </TableCell>
                    <TableCell className="py-3 px-4">
                      <div className="flex flex-wrap gap-1 items-center">
                        {(u.groups || []).map((g) => (
                          <Badge key={g} className="bg-primary/10 text-primary">
                            {g}
                          </Badge>
                        ))}
                        {(!u.groups || u.groups.length === 0) && <span className="text-muted-foreground text-xs">{'\u2014'}</span>}
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => startEditGroups(u.username, u.groups || [])}
                          title="Edit groups"
                          className="ml-2"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="py-3 px-4 text-right">
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleteTarget(u.username)} title="Delete user">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                  {deleteTarget === u.username && (
                    <TableRow>
                      <TableCell colSpan={5} className="p-2">
                        <DeleteConfirmation
                          entityType="user"
                          entityName={u.username}
                          entityPath={u.username}
                          onConfirm={handleDelete}
                          onCancel={() => setDeleteTarget(null)}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                  {editingUser === u.username && (
                    <TableRow className="bg-primary/10">
                      <TableCell colSpan={5} className="p-4">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">
                              Edit Groups for {u.username}
                            </span>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditGroups}
                              >
                                Cancel
                              </Button>
                              <Button
                                size="sm"
                                onClick={handleSaveGroups}
                                disabled={isSavingGroups}
                              >
                                <Check className="h-3 w-3 mr-1" />
                                {isSavingGroups ? 'Saving...' : 'Save'}
                              </Button>
                            </div>
                          </div>

                          {/* Selected groups as removable tags */}
                          <div className="flex flex-wrap gap-2">
                            {Array.from(editGroups).map((groupName) => (
                              <Badge
                                key={groupName}
                                className="bg-primary/10 text-primary"
                              >
                                {groupName}
                                <button
                                  type="button"
                                  onClick={() => removeGroupFromEdit(groupName)}
                                  className="ml-1 hover:text-primary"
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </Badge>
                            ))}
                            {editGroups.size === 0 && (
                              <span className="text-xs text-muted-foreground italic">No groups assigned</span>
                            )}
                          </div>

                          {/* Searchable dropdown to add groups */}
                          <div className="max-w-sm">
                            <SearchableSelect
                              options={groups
                                .filter((g) => !editGroups.has(g.name))
                                .map((g) => ({
                                  value: g.name,
                                  label: g.name,
                                  description: g.path || undefined,
                                }))}
                              value=""
                              onChange={addGroupToEdit}
                              placeholder="Search and add groups..."
                              maxDescriptionWords={5}
                            />
                          </div>
                        </div>
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

export default IAMUsers;
