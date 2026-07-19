import React, { useState, useEffect } from 'react';
import {
  Users2, Search, Edit2, ShieldAlert, Check, X, Loader2, AlertCircle,
  UserCheck, UserX, HelpCircle, Shield, Building, Plus, Trash2, Copy,
  Minus, ShieldCheck, Copy as CloneIcon
} from 'lucide-react';
import { User, Role, Warehouse, CustomRole, Permission } from '../types';

interface UsersProps {
  currentUser: User | null;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const ROLES_LIST: { id: Role | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'admin', label: 'Admin' },
  { id: 'ops_manager', label: 'Ops Manager' },
  { id: 'receiver', label: 'Receiver' },
  { id: 'picker', label: 'Picker' },
  { id: 'driver', label: 'Driver' },
  { id: 'auditor', label: 'Auditor' }
];

interface PermissionDefinition {
  value: Permission;
  label: string;
  description: string;
}

interface PermissionGroup {
  name: string;
  permissions: PermissionDefinition[];
}

const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    name: 'Warehouse & Receiving',
    permissions: [
      { value: 'receiving:view', label: 'receiving:view', description: 'View incoming purchase orders and GRNs' },
      { value: 'receiving:create', label: 'receiving:create', description: 'Receive goods against a purchase order' }
    ]
  },
  {
    name: 'Inventory',
    permissions: [
      { value: 'catalogue:view', label: 'catalogue:view', description: 'View product catalogue' },
      { value: 'bundles:manage', label: 'bundles:manage', description: 'Create and manage product bundles' },
      { value: 'cycle_counts:create', label: 'cycle_counts:create', description: 'Conduct cycle counts' },
      { value: 'cycle_counts:approve', label: 'cycle_counts:approve', description: 'Approve cycle count adjustments' },
      { value: 'write_offs:create', label: 'write_offs:create', description: 'Raise write-offs' },
      { value: 'write_offs:approve', label: 'write_offs:approve', description: 'Approve write-offs' }
    ]
  },
  {
    name: 'Fulfillment & Logistics',
    permissions: [
      { value: 'transfers:create', label: 'transfers:create', description: 'Create stock transfers' },
      { value: 'transfers:approve', label: 'transfers:approve', description: 'Approve stock transfers' },
      { value: 'picking:execute', label: 'picking:execute', description: 'Pick customer orders' },
      { value: 'packing:execute', label: 'packing:execute', description: 'Pack customer orders' },
      { value: 'dispatch:execute', label: 'dispatch:execute', description: 'Dispatch orders to drivers' },
      { value: 'deliveries:view', label: 'deliveries:view', description: 'View delivery tracking' },
      { value: 'returns:manage', label: 'returns:manage', description: 'Process customer returns' },
      { value: 'eod_check:execute', label: 'eod_check:execute', description: 'Run cross-dock end-of-day checks' }
    ]
  },
  {
    name: 'Compliance',
    permissions: [
      { value: 'traceability:view', label: 'traceability:view', description: 'View regulatory and traceability records' },
      { value: 'recalls:initiate', label: 'recalls:initiate', description: 'Initiate a product recall' },
      { value: 'recalls:execute', label: 'recalls:execute', description: 'Execute recall actions' }
    ]
  },
  {
    name: 'Manufacturing',
    permissions: [
      { value: 'assembly_templates:approve', label: 'assembly_templates:approve', description: 'Approve assembly templates' },
      { value: 'production:execute', label: 'production:execute', description: 'Run production/assembly orders' }
    ]
  },
  {
    name: 'Accounting & Admin',
    permissions: [
      { value: 'margin_report:view', label: 'margin_report:view', description: 'View gross margin reports' },
      { value: 'api_keys:manage', label: 'api_keys:manage', description: 'Manage API keys' },
      { value: 'webhooks:manage', label: 'webhooks:manage', description: 'Manage webhooks' },
      { value: 'settings:manage', label: 'settings:manage', description: 'Manage platform settings' },
      { value: 'users:manage', label: 'users:manage', description: 'Manage users and roles' }
    ]
  }
];

export default function Users({ currentUser, triggerToast }: UsersProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<Role | 'all'>('all');

  // Editing state
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editingRoleValue, setEditingRoleValue] = useState<string>('');
  const [editingReportsToValue, setEditingReportsToValue] = useState<string>('');
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  // Sub-tabs for Phase 2 Custom Roles & Permissions
  const [subTab, setSubTab] = useState<'members' | 'roles'>('members');
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);

  // Custom Role Form state
  const [roleFormOpen, setRoleFormOpen] = useState<boolean>(false);
  const [formRoleId, setFormRoleId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formPermissions, setFormPermissions] = useState<Permission[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [savingForm, setSavingForm] = useState<boolean>(false);

  // Clone role modal
  const [cloneModalRoleId, setCloneModalRoleId] = useState<string | null>(null);
  const [cloneName, setCloneName] = useState('');
  const [cloningRole, setCloningRole] = useState(false);

  // Reassign-before-delete modal
  const [reassignModal, setReassignModal] = useState<{ roleId: string; roleName: string } | null>(null);
  const [reassignTarget, setReassignTarget] = useState<string>('receiver');
  const [reassigning, setReassigning] = useState(false);

  // Per-user permissions modal
  const [permUser, setPermUser] = useState<User | null>(null);
  const [permData, setPermData] = useState<any>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [editGranted, setEditGranted] = useState<Permission[]>([]);
  const [editRevoked, setEditRevoked] = useState<Permission[]>([]);
  const [savingPerms, setSavingPerms] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  // New User Form & Temp Password Reveal states
  const [showNewUserForm, setShowNewUserForm] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserPhone, setNewUserPhone] = useState<string>('');
  const [newUserWarehouseId, setNewUserWarehouseId] = useState<string>('');
  const [newUserRoleValue, setNewUserRoleValue] = useState<string>('receiver');
  const [newUserReportsToValue, setNewUserReportsToValue] = useState<string>('none');
  const [creatingUser, setCreatingUser] = useState<boolean>(false);
  const [newUserFormError, setNewUserFormError] = useState<string | null>(null);
  const [newUserFieldError, setNewUserFieldError] = useState<{ [key: string]: string }>({});

  // Temp Password Reveal Modal state
  const [revealTempPassword, setRevealTempPassword] = useState<string | null>(null);
  const [revealCreatedName, setRevealCreatedName] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);

  // Load Data
  useEffect(() => {
    fetchUsersAndWarehouses();
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (triggerToast) {
      triggerToast(msg, type);
    } else {
      console.log(`[Toast ${type}]: ${msg}`);
    }
  };

  const fetchUsersAndWarehouses = async () => {
    setLoading(true);
    try {
      const [usersRes, whsRes, customRolesRes] = await Promise.all([
        fetch('/api/v1/users'),
        fetch('/api/v1/warehouses'),
        fetch('/api/v1/custom-roles')
      ]);

      if (!usersRes.ok || !whsRes.ok) {
        throw new Error('Failed to retrieve server data');
      }

      const usersData = await usersRes.json();
      const whsData = await whsRes.json();
      const rolesData = customRolesRes.ok ? await customRolesRes.json() : { data: [] };

      if (usersData.data) {
        setUsers(usersData.data);
      }
      if (whsData.data) {
        setWarehouses(whsData.data);
      }
      if (rolesData.data) {
        setCustomRoles(rolesData.data);
      }
    } catch (err: any) {
      showToast(err.message || 'Error occurred fetching backend team accounts', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Toggle user state
  const handleToggleActive = async (user: User) => {
    const isSelf = currentUser && currentUser.id === user.id;
    if (isSelf) {
      // Direct hard block as specified in instructions
      return; 
    }

    const nextActive = !user.is_active;
    const confirmMsg = nextActive 
      ? `Reactivate account for ${user.name}? They will instantly regain operational portal access.`
      : `Deactivate account for ${user.name}? This terminates all sessions and blocks access immediately.`;

    if (!window.confirm(confirmMsg)) return;

    setSubmittingId(user.id);
    // Optimistic Update
    setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: nextActive } : u));

    try {
      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive })
      });
      const data = await res.json();
      if (res.ok && data.data) {
        showToast(`Account for ${user.name} has been ${nextActive ? 'reactivated' : 'deactivated'}.`, 'success');
      } else {
        // Revert Optimistic
        setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: user.is_active } : u));
        showToast(data.error?.message || 'Failed to modify account state', 'error');
      }
    } catch (err) {
      // Revert Optimistic
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, is_active: user.is_active } : u));
      showToast('Connection to server timeout or failure', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Start inline edit
  const handleStartEdit = (user: User) => {
    setEditingUserId(user.id);
    const initialRoleValue = user.custom_role_id ? `custom:${user.custom_role_id}` : user.role;
    setEditingRoleValue(initialRoleValue);
    setEditingReportsToValue(user.reports_to_user_id || 'none');
  };

  // Cancel inline edit
  const handleCancelEdit = () => {
    setEditingUserId(null);
    setEditingRoleValue('');
    setEditingReportsToValue('');
  };

  // Save role update
  const handleSaveRole = async (user: User) => {
    if (!editingRoleValue) return;

    const isCustom = editingRoleValue.startsWith('custom:');
    const roleToSave = isCustom ? user.role : editingRoleValue as Role;
    const customRoleIdToSave = isCustom ? editingRoleValue.replace('custom:', '') : null;

    // Check if unchanged
    const currentVal = user.custom_role_id ? `custom:${user.custom_role_id}` : user.role;
    const currentReportsToVal = user.reports_to_user_id || 'none';
    if (editingRoleValue === currentVal && editingReportsToValue === currentReportsToVal) {
      setEditingUserId(null);
      setEditingRoleValue('');
      setEditingReportsToValue('');
      return;
    }

    // 2. Self demotion guard when NOT assigning a custom role (unless custom role is also not an admin)
    const isSelf = currentUser && currentUser.id === user.id;
    if (isSelf && user.role === 'admin' && !isCustom && roleToSave !== 'admin') {
      const confirmSelfDemote = window.confirm(
        "You are about to remove your own admin access. You will lose access to this screen and other admin-only areas immediately. Are you sure?"
      );
      if (!confirmSelfDemote) return;
    }

    setSubmittingId(user.id);
    try {
      const nextReportsTo = editingReportsToValue === 'none' ? null : editingReportsToValue;
      const body = isCustom
        ? { custom_role_id: customRoleIdToSave, role: user.role, reports_to_user_id: nextReportsTo }
        : { role: roleToSave, custom_role_id: null, reports_to_user_id: nextReportsTo };

      const res = await fetch(`/api/v1/users/${user.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();

      if (res.ok && data.data) {
        setUsers(prev => prev.map(u => u.id === user.id ? { 
          ...u, 
          role: data.data.role, 
          custom_role_id: data.data.custom_role_id,
          reports_to_user_id: data.data.reports_to_user_id
        } : u));
        showToast(`Team member configurations updated for ${user.name}.`, 'success');
        setEditingUserId(null);
        setEditingRoleValue('');
        setEditingReportsToValue('');
        
        // If demoting self, prompt to refresh/reload if appropriate or simply let them know
        if (isSelf && !isCustom && roleToSave !== 'admin') {
          window.location.reload();
        }
      } else {
        showToast(data.error?.message || 'Failed to save role update', 'error');
      }
    } catch (err) {
      showToast('Network connection failed', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  const handleOpenNewUserForm = () => {
    setNewUserName('');
    setNewUserEmail('');
    setNewUserPhone('');
    setNewUserWarehouseId(warehouses[0]?.id || '');
    setNewUserRoleValue('receiver');
    setNewUserFormError(null);
    setNewUserFieldError({});
    setShowNewUserForm(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setNewUserFormError(null);
    setNewUserFieldError({});

    const errors: { [key: string]: string } = {};
    if (!newUserName.trim()) errors.name = 'Name is required';
    if (!newUserEmail.trim()) {
      errors.email = 'Email is required';
    } else if (!/\S+@\S+\.\S+/.test(newUserEmail)) {
      errors.email = 'Please enter a valid email address';
    }
    if (!newUserWarehouseId) errors.primary_warehouse_id = 'Warehouse is required';
    if (!newUserRoleValue) errors.role = 'Role is required';

    if (Object.keys(errors).length > 0) {
      setNewUserFieldError(errors);
      return;
    }

    setCreatingUser(true);
    try {
      const isCustom = newUserRoleValue.startsWith('custom:');
      const body = {
        name: newUserName.trim(),
        email: newUserEmail.trim(),
        phone: newUserPhone.trim() || null,
        primary_warehouse_id: newUserWarehouseId,
        role: isCustom ? null : newUserRoleValue,
        custom_role_id: isCustom ? newUserRoleValue.replace('custom:', '') : null,
        reports_to_user_id: newUserReportsToValue === 'none' ? null : newUserReportsToValue
      };

      const res = await fetch('/api/v1/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const payload = await res.json();

      if (!res.ok) {
        if (payload.error?.code === 'EMAIL_EXISTS') {
          setNewUserFieldError({ email: 'This email is already in use by another user.' });
        } else {
          setNewUserFormError(payload.error?.message || 'Failed to create user.');
        }
        return;
      }

      if (payload.data && payload.temp_password) {
        // Successful creation! Add to users list
        setUsers(prev => [payload.data, ...prev]);
        setShowNewUserForm(false);
        // Open the temp password reveal modal
        setRevealCreatedName(payload.data.name);
        setRevealTempPassword(payload.temp_password);
        setCopied(false);
        showToast(`User ${payload.data.name} created successfully!`, 'success');
      } else {
        setNewUserFormError('Unexpected server response format.');
      }
    } catch (err) {
      console.error('Create user error:', err);
      setNewUserFormError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setCreatingUser(false);
    }
  };

  const handleCopyTempPassword = () => {
    if (revealTempPassword) {
      navigator.clipboard.writeText(revealTempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Temporary password copied to clipboard!', 'info');
    }
  };

  // Format Relative Time Helper
  const formatRelativeTime = (dateStr: string | null) => {
    if (!dateStr) return 'Never';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    if (diffMs < 0) return 'Just now';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 15) return 'Just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  };

  // Get human friendly warehouse name
  const getWarehouseName = (whId: string) => {
    const wh = warehouses.find(w => w.id === whId);
    return wh ? `${wh.name} (${wh.id})` : whId || 'N/A';
  };

  // Get distinct styles for each role badge
  const getRoleBadgeStyle = (userRole: Role) => {
    switch (userRole) {
      case 'admin':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ops_manager':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'receiver':
        return 'bg-sky-50 text-sky-700 border-sky-200';
      case 'picker':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'driver':
        return 'bg-teal-50 text-teal-700 border-teal-200';
      case 'auditor':
        return 'bg-slate-50 text-slate-700 border-slate-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // Client side Search and Filter
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = activeFilter === 'all' || u.role === activeFilter;
    return matchesSearch && matchesRole;
  });

  const handleOpenCreateForm = () => {
    setFormRoleId(null);
    setFormName('');
    setFormDescription('');
    setFormPermissions([]);
    setFormError(null);
    setRoleFormOpen(true);
  };

  const handleOpenEditForm = (role: CustomRole) => {
    setFormRoleId(role.id);
    setFormName(role.name);
    setFormDescription(role.description || '');
    setFormPermissions(role.permissions);
    setFormError(null);
    setRoleFormOpen(true);
  };

  const handleDeleteRoleWithCheck = (role: CustomRole) => {
    const assigned = users.filter(u => u.custom_role_id === role.id).length;
    if (assigned > 0) {
      setReassignTarget('receiver');
      setReassignModal({ roleId: role.id, roleName: role.name });
    } else {
      if (!window.confirm(`Delete custom role "${role.name}"? This cannot be undone.`)) return;
      doDeleteRole(role.id);
    }
  };

  const doDeleteRole = async (roleId: string) => {
    try {
      const res = await fetch(`/api/v1/custom-roles/${roleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast('Custom role deleted', 'success');
        setCustomRoles(prev => prev.filter(r => r.id !== roleId));
      } else {
        showToast(data.error?.message || 'Failed to delete custom role', 'error');
      }
    } catch {
      showToast('Connection failure', 'error');
    }
  };

  const handleReassignAndDelete = async () => {
    if (!reassignModal) return;
    setReassigning(true);
    try {
      const isCustom = reassignTarget.startsWith('custom:');
      const body = isCustom
        ? { new_custom_role_id: reassignTarget.replace('custom:', '') }
        : { new_role_id: reassignTarget };
      const res = await fetch(`/api/v1/custom-roles/${reassignModal.roleId}/bulk-reassign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const d = await res.json();
        showToast(d.error?.message || 'Reassignment failed', 'error');
        return;
      }
      await doDeleteRole(reassignModal.roleId);
      setReassignModal(null);
      await fetchUsersAndWarehouses();
    } catch {
      showToast('Request failed', 'error');
    } finally {
      setReassigning(false);
    }
  };

  const handleCloneRole = (role: CustomRole) => {
    setCloneModalRoleId(role.id);
    setCloneName(`${role.name} (Copy)`);
  };

  const submitClone = async () => {
    if (!cloneModalRoleId || !cloneName.trim()) return;
    setCloningRole(true);
    try {
      const res = await fetch(`/api/v1/custom-roles/${cloneModalRoleId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: cloneName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error?.message || 'Clone failed', 'error'); return; }
      setCustomRoles(prev => [...prev, data.data]);
      showToast('Role cloned successfully', 'success');
      setCloneModalRoleId(null);
    } catch {
      showToast('Request failed', 'error');
    } finally {
      setCloningRole(false);
    }
  };

  const openPermissionsModal = async (user: User) => {
    if (user.role === 'admin') {
      showToast('Admin users have all permissions — overrides cannot be set.', 'info');
      return;
    }
    setPermUser(user);
    setPermData(null);
    setPermError(null);
    setPermLoading(true);
    try {
      const res = await fetch(`/api/v1/users/${user.id}/permissions`);
      const data = await res.json();
      if (!res.ok) { setPermError(data.error?.message || 'Failed to load permissions'); return; }
      setPermData(data.data);
      setEditGranted(data.data.granted_permissions || []);
      setEditRevoked(data.data.revoked_permissions || []);
    } catch {
      setPermError('Failed to load permissions');
    } finally {
      setPermLoading(false);
    }
  };

  const savePermissions = async () => {
    if (!permUser) return;
    // Client-side overlap check
    const overlap = editGranted.filter(p => editRevoked.includes(p));
    if (overlap.length) {
      setPermError(`Cannot both grant and revoke: ${overlap.join(', ')}`);
      return;
    }
    setSavingPerms(true);
    setPermError(null);
    try {
      const res = await fetch(`/api/v1/users/${permUser.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted_permissions: editGranted, revoked_permissions: editRevoked }),
      });
      const data = await res.json();
      if (!res.ok) { setPermError(data.error?.message || 'Save failed'); return; }
      setUsers(prev => prev.map(u => u.id === permUser.id
        ? { ...u, granted_permissions: data.data.granted_permissions, revoked_permissions: data.data.revoked_permissions }
        : u));
      showToast('Permission overrides saved', 'success');
      setPermUser(null);
    } catch {
      setPermError('Request failed');
    } finally {
      setSavingPerms(false);
    }
  };

  const ALL_PERMISSIONS: Permission[] = [
    'receiving:view', 'receiving:create', 'catalogue:view', 'bundles:manage',
    'cycle_counts:create', 'cycle_counts:approve', 'write_offs:create', 'write_offs:approve',
    'transfers:create', 'transfers:approve', 'picking:execute', 'packing:execute',
    'dispatch:execute', 'deliveries:view', 'returns:manage', 'eod_check:execute',
    'traceability:view', 'recalls:initiate', 'recalls:execute',
    'assembly_templates:approve', 'production:execute', 'margin_report:view',
    'api_keys:manage', 'webhooks:manage', 'settings:manage', 'users:manage', 'finance:approve'
  ];

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = formName.trim();
    if (!trimmedName || trimmedName.length < 2) {
      setFormError('Name is required (minimum 2 characters).');
      return;
    }

    if (formPermissions.length === 0) {
      setFormError('At least one permission must be selected.');
      return;
    }

    setSavingForm(true);
    try {
      const isEdit = !!formRoleId;
      const url = isEdit ? `/api/v1/custom-roles/${formRoleId}` : '/api/v1/custom-roles';
      const method = isEdit ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: formDescription.trim() || null,
          permissions: formPermissions
        })
      });

      const data = await res.json();
      if (res.ok) {
        showToast(isEdit ? 'Custom role updated successfully.' : 'Custom role created successfully.', 'success');
        setRoleFormOpen(false);
        await fetchUsersAndWarehouses();
      } else {
        setFormError(data.error?.message || 'Failed to save custom role');
      }
    } catch (err) {
      setFormError('Network request failed. Please check your connection.');
    } finally {
      setSavingForm(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <Users2 className="h-6 w-6 text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">User Management & Permissions</h2>
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-normal">
            View and manage team member access and roles. Control platform-level permissions securely.
          </p>
        </div>
      </div>

      {/* Sub Tab Switcher */}
      <div className="flex border-b border-slate-200">
        <button
          type="button"
          onClick={() => setSubTab('members')}
          className={`px-6 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer min-h-[44px] flex items-center gap-2 ${
            subTab === 'members'
              ? 'border-teal-500 text-teal-600 font-extrabold bg-teal-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Users2 className="h-4 w-4" />
          <span>Team Members</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('roles')}
          className={`px-6 py-3 text-xs font-bold border-b-2 transition-all cursor-pointer min-h-[44px] flex items-center gap-2 ${
            subTab === 'roles'
              ? 'border-teal-500 text-teal-600 font-extrabold bg-teal-50/10'
              : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
          }`}
        >
          <Shield className="h-4 w-4" />
          <span>Custom Roles</span>
        </button>
      </div>

      {subTab === 'members' ? (
        <>
          {/* Primary Filtering and Search Tools */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs space-y-4">
            <div className="flex flex-col md:flex-row gap-3">
              
              {/* Search bar input */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-405" />
                <input
                  type="text"
                  placeholder="Search users by name or email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white text-slate-800 placeholder-slate-450 border border-slate-250 rounded-xl pl-9 pr-4 py-2.5 text-xs shadow-2xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                />
              </div>

              {/* Quick Action Refresh button */}
              <button
                onClick={fetchUsersAndWarehouses}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-150 text-slate-700 rounded-xl font-bold text-xs flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
              >
                Refresh List
              </button>

              {/* + New User action button for Admins */}
              {currentUser?.role === 'admin' && (
                <button
                  type="button"
                  onClick={handleOpenNewUserForm}
                  className="bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wide px-4 py-2.5 rounded-xl min-h-[44px] transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Plus className="h-4 w-4 stroke-[3]" />
                  <span>New User</span>
                </button>
              )}
            </div>

            {/* Filters Tab Panel */}
            <div className="border-t border-slate-100 pt-3 overflow-x-auto">
              <div className="flex space-x-1 min-w-max pb-1">
                {ROLES_LIST.map((tab) => {
                  const active = activeFilter === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-wide transition pointer-events-auto cursor-pointer min-h-[36px] ${
                        active
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Main Users Representation Grid/Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="p-12 text-center text-slate-450 flex flex-col items-center justify-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
                <span className="text-xs font-medium">Gathering platform team directories...</span>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Users2 className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                <p className="text-xs font-bold leading-normal">No users match your criteria</p>
              </div>
            ) : (
              <>
                {/* Desktop Table Layout */}
                <div className="hidden md:block overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-slate-500 border-b border-slate-200 uppercase font-bold tracking-wider text-[10px]">
                        <th className="p-4">Name</th>
                        <th className="p-4">Email</th>
                        <th className="p-4">Role Badge</th>
                        <th className="p-4">Assigned Warehouse</th>
                        <th className="p-4 text-center">Permissions</th>
                        <th className="p-4 text-center">Status</th>
                        <th className="p-4">Last Login</th>
                        <th className="p-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {filteredUsers.map((u) => {
                        const isSelf = currentUser && currentUser.id === u.id;
                        const isEditing = editingUserId === u.id;
                        const isSubmitting = submittingId === u.id;

                        return (
                          <tr key={u.id} className={`hover:bg-slate-50/50 transition-colors ${isSelf ? 'bg-indigo-50/10' : ''}`}>
                            
                            {/* Name */}
                            <td className="p-4 font-bold text-slate-900">
                              <div className="flex items-center gap-1.5">
                                <span>{u.name}</span>
                                {isSelf && (
                                  <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase px-1 rounded-sm shrink-0">
                                    You
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Email */}
                            <td className="p-4 font-mono text-slate-500">
                              {u.email}
                            </td>

                            {/* Role */}
                            <td className="p-4">
                              {isEditing ? (
                                <div className="flex flex-col gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 w-16">Role:</span>
                                    <select
                                      value={editingRoleValue}
                                      onChange={(e) => setEditingRoleValue(e.target.value)}
                                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium h-[40px] focus:outline-hidden focus:border-teal-500 flex-1"
                                    >
                                      <optgroup label="Built-in Roles">
                                        <option value="admin">Admin</option>
                                        <option value="ops_manager">Ops Manager</option>
                                        <option value="receiver">Receiver</option>
                                        <option value="picker">Picker</option>
                                        <option value="driver">Driver</option>
                                        <option value="auditor">Auditor</option>
                                      </optgroup>
                                      <optgroup label="Custom Roles">
                                        {customRoles.map(cr => (
                                          <option key={cr.id} value={`custom:${cr.id}`}>{cr.name}</option>
                                        ))}
                                      </optgroup>
                                    </select>
                                  </div>

                                  <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 w-16">Reports To:</span>
                                    <select
                                      value={editingReportsToValue}
                                      onChange={(e) => setEditingReportsToValue(e.target.value)}
                                      className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium h-[40px] focus:outline-hidden focus:border-teal-500 flex-1"
                                    >
                                      <option value="none">No Supervisor</option>
                                      {users.filter(x => x.id !== u.id).map(x => (
                                        <option key={x.id} value={x.id}>{x.name} ({x.role})</option>
                                      ))}
                                    </select>
                                  </div>

                                  <div className="flex gap-2 justify-end mt-1">
                                    <button
                                      onClick={() => handleSaveRole(u)}
                                      disabled={isSubmitting}
                                      className="p-2 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg flex items-center justify-center min-w-[36px] min-h-[36px] cursor-pointer"
                                      title="Save changes"
                                    >
                                      {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                    </button>
                                    <button
                                      onClick={handleCancelEdit}
                                      disabled={isSubmitting}
                                      className="p-2 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center min-w-[36px] min-h-[36px] cursor-pointer"
                                      title="Cancel"
                                    >
                                      <X className="h-3.5 w-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {u.custom_role_id ? (
                                    (() => {
                                      const cr = customRoles.find(r => r.id === u.custom_role_id);
                                      return (
                                        <span className="inline-flex items-center border px-2.5 py-0.5 font-bold text-[10px] rounded-full uppercase tracking-wide shrink-0 bg-violet-50 text-violet-700 border-violet-200">
                                          {cr ? cr.name : 'Unknown Custom Role'}
                                        </span>
                                      );
                                    })()
                                  ) : (
                                    <span className={`inline-flex items-center border px-2.5 py-0.5 font-bold text-[10px] rounded-full uppercase tracking-wide shrink-0 ${getRoleBadgeStyle(u.role)}`}>
                                      {u.role.replace('_', ' ')}
                                    </span>
                                  )}
                                  <div className="text-[10.5px] text-slate-500 mt-1">
                                    {u.reports_to_user_id ? (
                                      <span>Reports to: <strong className="text-slate-700 font-semibold">{users.find(x => x.id === u.reports_to_user_id)?.name || u.reports_to_user_id}</strong></span>
                                    ) : (
                                      <span className="italic text-slate-400">No supervisor</span>
                                    )}
                                  </div>
                                </>
                              )}
                            </td>

                            {/* Warehouse */}
                            <td className="p-4 text-slate-600">
                              <div className="flex items-center gap-1.5">
                                <Building className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="font-medium">{getWarehouseName(u.primary_warehouse_id)}</span>
                              </div>
                            </td>

                            {/* Permissions summary */}
                            <td className="p-4 text-center">
                              {u.role === 'admin' ? (
                                <span className="text-[10px] text-slate-400 italic">All</span>
                              ) : (() => {
                                const g = (u.granted_permissions || []).length;
                                const r = (u.revoked_permissions || []).length;
                                const cr = u.custom_role_id;
                                if (!g && !r && !cr) return <span className="text-[10px] text-slate-400 italic">Base role</span>;
                                return (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {cr && <span className="text-[9px] bg-violet-50 text-violet-700 border border-violet-200 px-1.5 py-0.5 rounded font-bold">Custom</span>}
                                    {g > 0 && <span className="text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-bold">+{g} grant{g !== 1 ? 's' : ''}</span>}
                                    {r > 0 && <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-200 px-1.5 py-0.5 rounded font-bold">{r} revoked</span>}
                                  </div>
                                );
                              })()}
                            </td>

                            {/* Status */}
                            <td className="p-4 text-center">
                              {u.is_active ? (
                                <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                                  Active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 text-[9px] font-extrabold rounded-md uppercase tracking-wider">
                                  Inactive
                                </span>
                              )}
                            </td>

                            {/* Last Login */}
                            <td className="p-4 text-slate-500 font-medium">
                              {formatRelativeTime(u.last_login_at)}
                            </td>

                            {/* Actions */}
                            <td className="p-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                
                                {/* Permissions Button */}
                                {!isEditing && (
                                  <button
                                    onClick={() => openPermissionsModal(u)}
                                    className="px-2.5 py-1.5 border border-violet-200 hover:border-violet-300 hover:bg-violet-50 text-violet-700 rounded-lg font-bold flex items-center gap-1 transition text-[11px] min-h-[36px] cursor-pointer"
                                    title="Edit permission overrides"
                                  >
                                    <ShieldCheck className="h-3 w-3 shrink-0" />
                                    <span>Perms</span>
                                  </button>
                                )}

                                {/* Edit Role Button */}
                                {!isEditing && (
                                  <button
                                    onClick={() => handleStartEdit(u)}
                                    className="px-2.5 py-1.5 border border-slate-200 hover:border-slate-350 hover:bg-slate-50 text-slate-700 rounded-lg font-bold flex items-center gap-1 transition text-[11px] min-h-[36px] cursor-pointer"
                                  >
                                    <Edit2 className="h-3 w-3 shrink-0" />
                                    <span>Edit Role</span>
                                  </button>
                                )}

                                {/* Toggle Block/Deactivate Button */}
                                <button
                                  disabled={isSelf || isSubmitting}
                                  onClick={() => handleToggleActive(u)}
                                  className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition text-[11px] min-h-[36px] border ${
                                    isSelf
                                      ? 'bg-slate-50 text-slate-300 border-slate-155 cursor-not-allowed opacity-50'
                                      : u.is_active
                                      ? 'border-rose-100 hover:border-rose-300 hover:bg-rose-50 text-rose-750'
                                      : 'border-emerald-100 hover:border-emerald-300 hover:bg-emerald-50 text-emerald-850'
                                  } cursor-pointer`}
                                  title={isSelf ? "Self-deactivation is strictly prohibited" : ""}
                                >
                                  {isSubmitting && submittingId === u.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                                  ) : u.is_active ? (
                                    <UserX className="h-3 w-3 shrink-0" />
                                  ) : (
                                    <UserCheck className="h-3 w-3 shrink-0" />
                                  )}
                                  <span>{u.is_active ? 'Deactivate' : 'Reactivate'}</span>
                                </button>

                              </div>
                            </td>

                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Stacked Card List Layout */}
                <div className="md:hidden divide-y divide-slate-150 p-4 space-y-4">
                  {filteredUsers.map((u) => {
                    const isSelf = currentUser && currentUser.id === u.id;
                    const isEditing = editingUserId === u.id;
                    const isSubmitting = submittingId === u.id;

                    return (
                      <div key={u.id} className={`p-4 rounded-xl border ${isSelf ? 'border-indigo-200 bg-indigo-50/5' : 'border-slate-150 bg-white'} space-y-3.5`}>
                        
                        {/* User primary identifiers */}
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5 flex-wrap">
                              <span>{u.name}</span>
                              {isSelf && (
                                <span className="bg-indigo-100 text-indigo-700 text-[8px] font-black uppercase px-1 rounded-sm shrink-0">
                                  You
                                </span>
                              )}
                            </div>
                            <div className="font-mono text-xs text-slate-450 break-all mt-0.5">{u.email}</div>
                          </div>
                          
                          {/* Active / Inactive Badge */}
                          {u.is_active ? (
                            <span className="inline-flex items-center gap-1 bg-emerald-50 border border-emerald-200 text-emerald-800 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 bg-slate-100 border border-slate-200 text-slate-500 px-2 py-0.5 text-[9px] font-bold rounded-md uppercase">
                              Inactive
                            </span>
                          )}
                        </div>

                        {/* Operational parameters list */}
                        <div className="grid grid-cols-2 gap-3 text-xs text-slate-655 border-t border-b border-dashed border-slate-100 py-3">
                          <div>
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">
                              Warehouse
                            </span>
                            <span className="font-medium text-slate-800 break-words block mt-0.5">
                              {getWarehouseName(u.primary_warehouse_id)}
                            </span>
                          </div>
                          <div>
                            <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">
                              Last login
                            </span>
                            <span className="font-medium text-slate-700 block mt-0.5">
                              {formatRelativeTime(u.last_login_at)}
                            </span>
                          </div>
                        </div>

                        {/* Role Display and Editing */}
                        <div className="space-y-2">
                          <span className="block text-[9px] font-black text-slate-400 uppercase tracking-wide">
                            Role Position
                          </span>
                          {isEditing ? (
                            <div className="flex gap-2">
                              <select
                                value={editingRoleValue}
                                onChange={(e) => setEditingRoleValue(e.target.value)}
                                className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 font-medium h-[44px] flex-1 focus:outline-hidden focus:border-teal-500"
                              >
                                <optgroup label="Built-in Roles">
                                  <option value="admin">Admin</option>
                                  <option value="ops_manager">Ops Manager</option>
                                  <option value="receiver">Receiver</option>
                                  <option value="picker">Picker</option>
                                  <option value="driver">Driver</option>
                                  <option value="auditor">Auditor</option>
                                </optgroup>
                                <optgroup label="Custom Roles">
                                  {customRoles.map(cr => (
                                    <option key={cr.id} value={`custom:${cr.id}`}>{cr.name}</option>
                                  ))}
                                </optgroup>
                              </select>
                              <button
                                onClick={() => handleSaveRole(u)}
                                disabled={isSubmitting}
                                className="p-3 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-bold rounded-lg flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer"
                              >
                                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                disabled={isSubmitting}
                                className="p-3 border border-slate-200 hover:bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center min-w-[44px] min-h-[44px] cursor-pointer"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            </div>
                          ) : (
                            u.custom_role_id ? (
                              (() => {
                                const cr = customRoles.find(r => r.id === u.custom_role_id);
                                return (
                                  <span className="inline-flex items-center border px-2.5 py-1 font-bold text-[10px] rounded-full uppercase tracking-wide bg-violet-50 text-violet-700 border-violet-200">
                                    {cr ? cr.name : 'Unknown Custom Role'}
                                  </span>
                                );
                              })()
                            ) : (
                              <span className={`inline-flex items-center border px-2.5 py-1 font-bold text-[10px] rounded-full uppercase tracking-wide ${getRoleBadgeStyle(u.role)}`}>
                                {u.role.replace('_', ' ')}
                              </span>
                            )
                          )}
                        </div>

                        {/* Operational Action triggers */}
                        {!isEditing && (
                          <div className="flex gap-2 pt-1 border-t border-slate-50">
                            
                            {/* Edit Role Mobile Triggers */}
                            <button
                              onClick={() => handleStartEdit(u)}
                              className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs min-h-[44px] cursor-pointer"
                            >
                              <Edit2 className="h-3.5 w-3.5 shrink-0" />
                              <span>Edit Role</span>
                            </button>

                            {/* Deactivate/Reactivate Mobile Triggers */}
                            <button
                              disabled={isSelf || isSubmitting}
                              onClick={() => handleToggleActive(u)}
                              className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition text-xs min-h-[44px] border ${
                                isSelf
                                  ? 'bg-slate-50 text-slate-300 border-slate-155 cursor-not-allowed opacity-50'
                                  : u.is_active
                                  ? 'border-rose-100 bg-rose-50/20 hover:bg-rose-50 text-rose-750'
                                  : 'border-emerald-100 bg-emerald-50/20 hover:bg-emerald-50 text-emerald-850'
                              } cursor-pointer`}
                              title={isSelf ? "Self-deactivation is strictly prohibited" : ""}
                            >
                              {isSubmitting && submittingId === u.id ? (
                                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                              ) : u.is_active ? (
                                <UserX className="h-3.5 w-3.5 shrink-0" />
                              ) : (
                                <UserCheck className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span>{u.is_active ? 'Deactivate' : 'Reactivate'}</span>
                            </button>
                            
                          </div>
                        )}

                        {isSelf && (
                          <p className="text-[10px] text-slate-450 italic text-center pt-1 leading-normal">
                            Your account is currently locked from self-deactivation.
                          </p>
                        )}

                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </>
      ) : (
        /* Custom Roles tab content */
        <div className="space-y-6">
          {roleFormOpen ? (
            /* Create / Edit Custom Role Form */
            <form onSubmit={handleSaveForm} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {formRoleId ? `Edit Custom Role: ${formName}` : 'Create New Custom Role'}
                  </h3>
                  <p className="text-slate-500 text-xs mt-1">
                    Configure a bespoke security group with highly targetable functional permissions.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setRoleFormOpen(false)}
                  className="px-4 py-2 border border-slate-205 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition min-h-[40px] cursor-pointer"
                >
                  Cancel
                </button>
              </div>

              {formError && (
                <div className="p-4 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="h-4.5 w-4.5 text-rose-650 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Form Input fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-700">Role Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Dispatcher, Stock Supervisor"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-250 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                </div>
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-705">Description</label>
                  <input
                    type="text"
                    placeholder="Describe the operational scope of this custom role..."
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full bg-white text-slate-800 border border-slate-250 rounded-xl px-4 py-2.5 text-xs focus:ring-1 focus:ring-teal-500 focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                </div>
              </div>

              {/* Permissions Header with current X selected counter */}
              <div className="border-t border-slate-100 pt-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">Select Permissions Map</h4>
                    <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                      Assign at least one targeted endpoint permission for this group structure.
                    </p>
                  </div>
                  <div className="px-3 py-1.5 bg-violet-50 border border-violet-150 text-violet-700 text-xs font-bold rounded-lg self-start">
                    {formPermissions.length} permissions checked.
                  </div>
                </div>

                {/* Checklist grouped by functional areas */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.name} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-4">
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest border-b border-slate-205 pb-2">
                        {group.name}
                      </h4>
                      <div className="space-y-4">
                        {group.permissions.map((perm) => {
                          const checked = formPermissions.includes(perm.value);
                          return (
                            <label key={perm.value} className="flex items-start gap-3 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => {
                                  if (checked) {
                                    setFormPermissions(prev => prev.filter(p => p !== perm.value));
                                  } else {
                                    setFormPermissions(prev => [...prev, perm.value]);
                                  }
                                }}
                                className="mt-1 h-4 w-4 text-teal-600 border-slate-300 rounded focus:ring-teal-500 cursor-pointer min-h-[16px]"
                              />
                              <div className="space-y-1">
                                <span className="font-mono font-bold text-slate-900 bg-white border border-slate-200 px-1.5 py-0.5 rounded-md text-[10px]">
                                  {perm.value}
                                </span>
                                <p className="text-slate-500 text-[11px] leading-relaxed">
                                  {perm.description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Cancel Footer row */}
              <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setRoleFormOpen(false)}
                  className="px-5 py-2.5 border border-slate-205 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingForm}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-850 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50 cursor-pointer"
                >
                  {savingForm && <Loader2 className="h-4 w-4 animate-spin" />}
                  <span>{formRoleId ? 'Save Changes' : 'Create Custom Role'}</span>
                </button>
              </div>
            </form>
          ) : (
            /* Custom Roles Cards listing */
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs">
                <div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest">Custom Action-gated authorization</h3>
                  <p className="text-[11px] text-slate-500 leading-normal mt-0.5">
                    Configure granular functional permission templates in place of legacy presets.
                  </p>
                </div>
                <button
                  onClick={handleOpenCreateForm}
                  className="px-4 py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 min-h-[44px] cursor-pointer"
                >
                  <Plus className="h-4 w-4" />
                  <span>New Custom Role</span>
                </button>
              </div>

              {customRoles.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
                  <Shield className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                  <p className="text-xs font-bold leading-normal">No custom roles defined yet.</p>
                  <p className="text-[11px] text-slate-455 mt-1">Press "+ New Custom Role" above to provision one.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {customRoles.map((role) => {
                    const assignedUsersCount = users.filter(u => u.custom_role_id === role.id).length;
                    return (
                      <div key={role.id} className="bg-white rounded-2xl border border-slate-205 shadow-2xs p-5 flex flex-col justify-between space-y-4 hover:border-slate-300 transition-all">
                        <div className="space-y-2">
                          <div className="flex items-start justify-between">
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{role.name}</h4>
                            <span className="bg-slate-100 text-slate-700 text-[9px] font-black uppercase px-2 py-0.5 rounded-md border border-slate-200">
                              {role.permissions.length} PERMS
                            </span>
                          </div>
                          <p className="text-slate-500 text-xs leading-normal">
                            {role.description || <span className="italic opacity-60">No description provided.</span>}
                          </p>

                          {/* Users assigned badge */}
                          <div className="flex items-center gap-1.5 pt-1">
                            <Users2 className="h-3.5 w-3.5 text-slate-400" />
                            <span className="text-[11px] font-bold text-slate-755">
                              {assignedUsersCount} {assignedUsersCount === 1 ? 'user' : 'users'} assigned
                            </span>
                          </div>

                          {/* Tiny Pill list of permissions */}
                          <div className="flex flex-wrap gap-1 pt-2 max-h-24 overflow-y-auto font-mono text-[9px]">
                            {role.permissions.map((p) => (
                              <span key={p} className="bg-slate-50 border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded-sm">
                                {p}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* Action Edit / Clone / Delete footer */}
                        <div className="border-t border-slate-100 pt-3 flex items-center gap-2">
                          <button
                            onClick={() => handleOpenEditForm(role)}
                            className="flex-1 py-1.5 border border-slate-205 hover:bg-slate-50 text-slate-750 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                            <span>Edit</span>
                          </button>
                          <button
                            onClick={() => handleCloneRole(role)}
                            className="flex-1 py-1.5 border border-indigo-100 hover:border-indigo-300 hover:bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                            title="Clone this role"
                          >
                            <Copy className="h-3.5 w-3.5" />
                            <span>Clone</span>
                          </button>
                          <button
                            onClick={() => handleDeleteRoleWithCheck(role)}
                            className="flex-1 py-1.5 border border-rose-100 hover:border-rose-300 hover:bg-rose-50 text-rose-705 font-bold text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>Delete</span>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Clone Role Modal */}
      {cloneModalRoleId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Clone Custom Role</h2>
              <button onClick={() => setCloneModalRoleId(null)} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">New Role Name *</label>
              <input
                type="text"
                value={cloneName}
                onChange={e => setCloneName(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="e.g. Senior Dispatcher"
              />
            </div>
            <div className="flex gap-3">
              <button onClick={() => setCloneModalRoleId(null)} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={submitClone} disabled={cloningRole || !cloneName.trim()}
                className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {cloningRole && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Clone Role
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign-before-delete Modal */}
      {reassignModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Reassign Users Before Delete</h2>
                <p className="text-xs text-slate-500 mt-0.5">Users assigned to <strong>{reassignModal.roleName}</strong> must be moved first.</p>
              </div>
              <button onClick={() => setReassignModal(null)} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Move all users to</label>
              <select value={reassignTarget} onChange={e => setReassignTarget(e.target.value)}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                <optgroup label="Built-in Roles">
                  <option value="ops_manager">Ops Manager</option>
                  <option value="receiver">Receiver</option>
                  <option value="picker">Picker</option>
                  <option value="driver">Driver</option>
                  <option value="auditor">Auditor</option>
                </optgroup>
                {customRoles.filter(r => r.id !== reassignModal.roleId).length > 0 && (
                  <optgroup label="Custom Roles">
                    {customRoles.filter(r => r.id !== reassignModal.roleId).map(r => (
                      <option key={r.id} value={`custom:${r.id}`}>{r.name}</option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setReassignModal(null)} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleReassignAndDelete} disabled={reassigning}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {reassigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Reassign & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Per-user Permissions Modal */}
      {permUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-100 p-5">
              <div>
                <h2 className="font-bold text-sm text-slate-900">Permission Overrides — {permUser.name}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Base role: <strong>{permUser.role}</strong>
                  {permUser.custom_role_id && (() => {
                    const cr = customRoles.find(r => r.id === permUser.custom_role_id);
                    return <> · Custom role: <strong>{cr?.name ?? permUser.custom_role_id}</strong></>;
                  })()}
                </p>
              </div>
              <button onClick={() => setPermUser(null)} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-5 space-y-5">
              {permError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {permError}
                </div>
              )}

              {permLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  Loading…
                </div>
              ) : permData ? (
                <>
                  {/* Legend */}
                  <div className="flex flex-wrap gap-3 text-[10px] font-bold">
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> Granted via role</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-orange-400 inline-block" /> Individually granted</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> Individually revoked</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-slate-200 inline-block" /> Not granted</span>
                  </div>

                  {/* Permission grid with status */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PERMISSION_GROUPS.map(group => (
                      <div key={group.name} className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">{group.name}</p>
                        {group.permissions.map(perm => {
                          const isGrantedOverride = editGranted.includes(perm.value);
                          const isRevokedOverride = editRevoked.includes(perm.value);
                          const isEffective = (permData.effective_permissions || []).includes(perm.value);
                          const isRoleGranted = isEffective && !isGrantedOverride && !isRevokedOverride;

                          let dot = 'bg-slate-200';
                          let label = 'text-slate-400';
                          if (isRevokedOverride) { dot = 'bg-rose-500'; label = 'text-rose-700 line-through'; }
                          else if (isGrantedOverride) { dot = 'bg-orange-400'; label = 'text-orange-700'; }
                          else if (isRoleGranted) { dot = 'bg-emerald-500'; label = 'text-slate-700'; }

                          return (
                            <div key={perm.value} className="flex items-center gap-2 py-0.5">
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${dot}`} />
                              <span className={`font-mono text-[10px] flex-1 ${label}`}>{perm.value}</span>
                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  title="Grant individually"
                                  onClick={() => {
                                    if (isGrantedOverride) {
                                      setEditGranted(p => p.filter(x => x !== perm.value));
                                    } else {
                                      setEditGranted(p => [...p, perm.value]);
                                      setEditRevoked(p => p.filter(x => x !== perm.value));
                                    }
                                  }}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black border cursor-pointer transition ${isGrantedOverride ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-orange-50 hover:border-orange-200'}`}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                                <button
                                  title="Revoke individually"
                                  onClick={() => {
                                    if (isRevokedOverride) {
                                      setEditRevoked(p => p.filter(x => x !== perm.value));
                                    } else {
                                      setEditRevoked(p => [...p, perm.value]);
                                      setEditGranted(p => p.filter(x => x !== perm.value));
                                    }
                                  }}
                                  className={`w-6 h-6 rounded flex items-center justify-center text-[10px] font-black border cursor-pointer transition ${isRevokedOverride ? 'bg-rose-100 border-rose-300 text-rose-700' : 'bg-white border-slate-200 text-slate-400 hover:bg-rose-50 hover:border-rose-200'}`}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>

                  <div className="text-[10px] text-slate-400 pt-1">
                    <strong className="text-orange-600">+</strong> = grant individually (adds on top of role) &nbsp;·&nbsp;
                    <strong className="text-rose-600">−</strong> = revoke individually (strips from role). Click again to clear.
                  </div>
                </>
              ) : null}
            </div>

            <div className="border-t border-slate-100 p-5 flex gap-3">
              <button onClick={() => setPermUser(null)} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={savePermissions} disabled={savingPerms || permLoading || !permData}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {savingPerms && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Permission Overrides
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New User Creation Overlay Modal */}
      {showNewUserForm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-6 border-b border-slate-150 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">Provision New User</h3>
                <p className="text-slate-400 text-xs mt-1">Add a team member to access FreshOpsPlatform.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowNewUserForm(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {newUserFormError && (
                <div className="p-4 bg-rose-50 text-rose-850 border border-rose-200 rounded-xl text-xs font-semibold flex items-center gap-2.5">
                  <AlertCircle className="h-4.5 w-4.5 text-rose-600 shrink-0" />
                  <span>{newUserFormError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Full Name *</label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => {
                      setNewUserName(e.target.value);
                      if (newUserFieldError.name) setNewUserFieldError(prev => { const n = {...prev}; delete n.name; return n; });
                    }}
                    placeholder="Enter full name"
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-405 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                  {newUserFieldError.name && (
                    <p className="text-rose-600 text-[10px] mt-1 font-semibold">{newUserFieldError.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email *</label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => {
                      setNewUserEmail(e.target.value);
                      if (newUserFieldError.email) setNewUserFieldError(prev => { const n = {...prev}; delete n.email; return n; });
                    }}
                    placeholder="name@freshopsplatform.com"
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-450 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                  {newUserFieldError.email && (
                    <p className="text-rose-600 text-[10px] mt-1 font-semibold">{newUserFieldError.email}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Phone Number (Optional)</label>
                  <input
                    type="text"
                    value={newUserPhone}
                    onChange={(e) => setNewUserPhone(e.target.value)}
                    placeholder="+1 (555) 000-0000"
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-450 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Primary Warehouse *</label>
                  <select
                    required
                    value={newUserWarehouseId}
                    onChange={(e) => {
                      setNewUserWarehouseId(e.target.value);
                      if (newUserFieldError.primary_warehouse_id) setNewUserFieldError(prev => { const n = {...prev}; delete n.primary_warehouse_id; return n; });
                    }}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  >
                    <option value="" disabled>Select a warehouse</option>
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name} ({w.id})</option>
                    ))}
                  </select>
                  {newUserFieldError.primary_warehouse_id && (
                    <p className="text-rose-600 text-[10px] mt-1 font-semibold">{newUserFieldError.primary_warehouse_id}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Role Assignment *</label>
                  <select
                    required
                    value={newUserRoleValue}
                    onChange={(e) => {
                      setNewUserRoleValue(e.target.value);
                      if (newUserFieldError.role) setNewUserFieldError(prev => { const n = {...prev}; delete n.role; return n; });
                    }}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  >
                    <optgroup label="Built-in Roles">
                      <option value="admin">Admin</option>
                      <option value="ops_manager">Ops Manager</option>
                      <option value="receiver">Receiver</option>
                      <option value="picker">Picker</option>
                      <option value="driver">Driver</option>
                      <option value="auditor">Auditor</option>
                    </optgroup>
                    <optgroup label="Custom Roles">
                      {customRoles.map(cr => (
                        <option key={cr.id} value={`custom:${cr.id}`}>{cr.name}</option>
                      ))}
                    </optgroup>
                  </select>
                  {newUserFieldError.role && (
                    <p className="text-rose-600 text-[10px] mt-1 font-semibold">{newUserFieldError.role}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Supervisor / Reports To</label>
                  <select
                    value={newUserReportsToValue}
                    onChange={(e) => setNewUserReportsToValue(e.target.value)}
                    className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  >
                    <option value="none">No Supervisor</option>
                    {users.map(u => (
                      <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 flex items-center justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowNewUserForm(false)}
                  className="px-4 py-2.5 border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingUser}
                  className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wide text-xs rounded-xl flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  {creatingUser ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <span>Create User</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* One-Time Temp Password Reveal Modal */}
      {revealTempPassword && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl w-full max-w-md p-6 md:p-8 space-y-6 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="text-center space-y-2">
              <div className="mx-auto h-12 w-12 bg-teal-500/10 text-teal-400 rounded-full flex items-center justify-center">
                <Check className="h-6 w-6" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-white uppercase tracking-tight">User Created Successfully</h3>
              <p className="text-slate-400 text-xs text-balance">
                The account for <span className="text-white font-bold">{revealCreatedName}</span> has been provisioned.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block leading-none">Temporary Password</label>
              <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between text-xs font-mono select-all select-text">
                <span className="text-teal-400 font-bold tracking-widest text-sm text-center font-mono leading-none flex-1 truncate break-all select-text">
                  {revealTempPassword}
                </span>
                <button
                  type="button"
                  onClick={handleCopyTempPassword}
                  className="p-1 px-3 bg-slate-900 hover:bg-slate-850 text-slate-300 rounded-lg flex items-center gap-1 font-bold border border-slate-800 transition min-h-[36px] cursor-pointer"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5 shrink-0" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-rose-950/20 border border-rose-900/40 rounded-lg text-rose-300 flex gap-2.5 items-start text-xs">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5 animate-pulse" />
              <div className="leading-relaxed">
                <span className="font-bold">This password is shown only once and cannot be retrieved again.</span> Share it with <strong>{revealCreatedName}</strong> directly — they will be required to set their own password on first login.
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setRevealTempPassword(null);
                setRevealCreatedName('');
              }}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-black text-xs uppercase tracking-wide rounded-xl min-h-[44px] cursor-pointer transition-colors"
            >
              Done - Return to Team List
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
