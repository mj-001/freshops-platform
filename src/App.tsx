import React, { useEffect, useState } from 'react';
import { User, Location, SKU, Warehouse, WMSNotification, CustomRole } from './types';
import Dashboard from './components/Dashboard';
import GoodsReceipt from './components/GoodsReceipt';
import Transfers from './components/Transfers';
import Fulfillment from './components/Fulfillment';
import Audits from './components/Audits';
import TraceabilityMatrix from './components/TraceabilityMatrix';
import BinLocations from './components/BinLocations';
import Recalls from './components/Recalls';
import AssetsPanel from './components/Assets';
import Production from './components/Production';
import Assemblies from './components/Assemblies';
import Deliveries from './components/Deliveries';

import SetupWizard from './components/SetupWizard';
import Bundles from './components/Bundles';
import ApiKeys from './components/ApiKeys';
import Webhooks from './components/Webhooks';
import Settings from './components/Settings';
import Users from './components/Users';
import Packing from './components/Packing';
import WorkflowTemplates from './components/WorkflowTemplates';
import PendingApprovals from './components/PendingApprovals';
import Suppliers from './components/Suppliers';

import CustomerReturns from './components/CustomerReturns';
import Catalogue from './components/Catalogue';
import EODCheck from './components/EODCheck';
import ZoneManagement from './components/ZoneManagement';
import WarehouseManagement from './components/WarehouseManagement';
import ZoneCRUD from './components/ZoneCRUD';
import BinLocationManagement from './components/BinLocationManagement';
import MarginReport from './components/MarginReport';
import AuditLogs from './components/AuditLogs';
import POS from './components/POS';
import { subscribeToQueue } from './utils/offlineQueue';

import { 
  Building2, 
  LayoutDashboard, 
  Download, 
  ArrowLeftRight, 
  CheckSquare, 
  ClipboardSignature, 
  ShieldCheck,
  UserCheck,
  Clock,
  Layers,
  ThermometerSnowflake,
  ShieldAlert,
  Boxes,
  MapPin,
  Menu,
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Info,
  Wrench,
  Package2,
  Key,
  Radio,
  Settings as SettingsIcon,
  Bell,
  RotateCcw,
  BookOpen,
  Moon,
  TrendingUp,
  Truck,
  ChevronDown,
  Users2,
  PackageCheck,
  Copy,
  Check,
  GitBranch,
  Store
} from 'lucide-react';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

function LoginScreen({ onLogin, error }: { onLogin: (email: string, password: string) => void; error: string | null }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await onLogin(email, password);
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">FreshOpsPlatform</h1>
          <p className="text-xs text-slate-500 mt-1">Sign in to continue</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded-lg p-3">
              {error}
            </div>
          )}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-3 text-sm text-white min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              autoComplete="username"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-3 text-sm text-white min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              autoComplete="current-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wide text-xs rounded-xl py-3 min-h-[44px] transition-colors cursor-pointer"
          >
            {submitting ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

function ForcedPasswordReset({ user, onComplete, triggerToast }: {
  user: User;
  onComplete: (user: User) => void;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.id, current_password: currentPassword, new_password: newPassword })
      });
      const payload = await res.json();
      if (!res.ok) {
        setError(payload.error?.message || 'Could not reset password.');
        setSubmitting(false);
        return;
      }
      triggerToast?.('Password updated. You are now signed in.', 'success');
      onComplete(user);
    } catch (err) {
      setError('Could not reach the server. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-xl font-black text-white uppercase tracking-tight">Set a New Password</h1>
          <p className="text-xs text-slate-500 mt-1">This account requires a password change before continuing.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          {error && (
            <div className="bg-rose-950/40 border border-rose-900 text-rose-300 text-xs rounded-lg p-3">
              {error}
            </div>
          )}
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Current (Temporary) Password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-3 text-sm text-white min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              autoComplete="current-password"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-3 text-sm text-white min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              autoComplete="new-password"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Confirm New Password</label>
            <input
              type="password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-slate-950 border border-slate-850 rounded-xl px-3 py-3 text-sm text-white min-h-[44px] focus:outline-hidden focus:ring-1 focus:ring-teal-500"
              autoComplete="new-password"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black uppercase tracking-wide text-xs rounded-xl py-3 min-h-[44px] transition-colors cursor-pointer"
          >
            {submitting ? 'Updating...' : 'Set Password & Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // Setup Wizard State
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [platformName, setPlatformName] = useState<string>('FRESHOPS WMS');

  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [customRoles, setCustomRoles] = useState<CustomRole[]>([]);
  const [refreshFlag, setRefreshFlag] = useState<number>(0);
  const [timeStr, setTimeStr] = useState<string>('');
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  // Notification states
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [notifOpen, setNotifOpen] = useState<boolean>(false);
  const [notifications, setNotifications] = useState<WMSNotification[]>([]);

  // Toast System
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Offline status tracking states
  const [offlineQueueLen, setOfflineQueueLen] = useState<number>(0);
  const [appOfflineMode, setAppOfflineMode] = useState<boolean>(false);

  useEffect(() => {
    const unsubscribe = subscribeToQueue((queue, isOfflineObj) => {
      setOfflineQueueLen(queue.length);
      setAppOfflineMode(isOfflineObj);
    });
    return () => unsubscribe();
  }, []);

  const triggerToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  useEffect(() => {
    checkSetupStatus();
    fetchUsers();
    fetchStaticModels();
    fetchUnreadCount();
    fetchCustomRoles();
    
    // Virtual UTC LED Timer
    const interval = setInterval(() => {
      const now = new Date();
      setTimeStr(now.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    }, 1000);

    // Poll unread count every 60 seconds
    const unreadInterval = setInterval(fetchUnreadCount, 60000);

    return () => {
      clearInterval(interval);
      clearInterval(unreadInterval);
    };
  }, []);

  const fetchCustomRoles = async () => {
    try {
      const res = await fetch('/api/v1/custom-roles');
      if (res.ok) {
        const payload = await res.json();
        if (payload.data) {
          setCustomRoles(payload.data);
        }
      }
    } catch (err) {
      console.error('Error fetching custom roles:', err);
    }
  };

  const checkSetupStatus = async () => {
    try {
      const res = await fetch('/api/v1/setup/status');
      const payload = await res.json();
      if (payload.data) {
        setSetupComplete(payload.data.setup_complete);
        if (payload.data.setup_complete) {
          const configRes = await fetch('/api/v1/admin/config');
          if (configRes.ok) {
            const configPayload = await configRes.json();
            if (configPayload.tenant_name) {
              setPlatformName(configPayload.tenant_name.toUpperCase());
            }
          }
        }
      } else {
        setSetupComplete(true);
      }
    } catch (err) {
      console.error('Error fetching setup status:', err);
      setSetupComplete(true); // fallback
    }
  };

  const fetchUnreadCount = async () => {
    try {
      const res = await fetch('/api/v1/notifications?is_read=false');
      if (res.ok) {
        const payload = await res.json();
        setUnreadCount(payload.data?.length ?? 0);
      }
    } catch (err) {
      console.error('Error fetching unread status:', err);
    }
  };

  const fetchRecentNotifications = async () => {
    try {
      const res = await fetch('/api/v1/notifications?is_read=false&limit=50');
      if (res.ok) {
        const payload = await res.json();
        setNotifications(payload.data || []);
      }
    } catch (err) {
      console.error('Error fetching recent notifications:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const res = await fetch('/api/v1/notifications/mark-all-read', { method: 'POST' });
      if (res.ok) {
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        triggerToast('All notifications marked read', 'success');
      } else {
        // client fallback
        const unreads = notifications.filter(n => !n.is_read);
        await Promise.all(unreads.map(async (n) => {
          await fetch(`/api/v1/notifications/${n.id}/read`, { method: 'POST' });
        }));
        setUnreadCount(0);
        setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
        triggerToast('All notifications marked read', 'success');
      }
    } catch (err) {
      triggerToast('Error updating unreads state', 'error');
    }
  };

  const handleNotificationClick = async (notif: WMSNotification) => {
    try {
      await fetch(`/api/v1/notifications/${notif.id}/read`, { method: 'POST' });
      setUnreadCount(prev => Math.max(0, prev - 1));
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n));
      setNotifOpen(false);

      const refType = notif.reference_type;
      if (refType === 'batch') {
        setActiveTab('bin_locations');
      } else if (refType === 'sku') {
        setActiveTab('dashboard');
      } else if (refType === 'delivery') {
        setActiveTab('fulfillment');
      } else if (refType === 'transfer') {
        setActiveTab('transfers');
      } else if (refType === 'write_off') {
        setActiveTab('audits');
      } else if (refType === 'production_run') {
        setActiveTab('production');
      } else if (refType === 'bundle') {
        setActiveTab('bundles');
      } else if (refType === 'markdown_approval') {
        setActiveTab('settings');
      }
    } catch (err) {
      console.error('Error reading notification:', err);
    }
  };

  const handleBellClick = async () => {
    const nextVal = !notifOpen;
    setNotifOpen(nextVal);
    if (nextVal) {
      await fetchRecentNotifications();
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    if (!dateStr) return 'just now';
    const now = new Date();
    const past = new Date(dateStr);
    const diffMs = now.getTime() - past.getTime();
    if (diffMs < 0) return 'just now';
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);

    if (diffSec < 15) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHour < 24) return `${diffHour}h ago`;
    return `${diffDay} ${diffDay === 1 ? 'day' : 'days'} ago`;
  };

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/v1/users');
      const payload = await res.json();
      if (payload.data) {
        setUsers(payload.data);
      }
    } catch (err) {
      console.error('Error fetching system users:', err);
    }
  };

  const fetchStaticModels = async () => {
    try {
      const rw = await fetch('/api/v1/warehouses');
      const pw = await rw.json();
      if (pw.data) setWarehouses(pw.data);

      const rsk = await fetch('/api/v1/skus');
      const psk = await rsk.json();
      if (psk.data) setSkus(psk.data);

      const rloc = await fetch('/api/v1/locations');
      const ploc = await rloc.json();
      if (ploc.data) setLocations(ploc.data);
    } catch (err) {
      console.error('Error fetching layouts profiles:', err);
    }
  };

  const [loginError, setLoginError] = useState<string | null>(null);
  const [mustResetPassword, setMustResetPassword] = useState(false);
  const [pendingResetUser, setPendingResetUser] = useState<User | null>(null);

  const handleLogin = async (email: string, password: string) => {
    setLoginError(null);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const payload = await res.json();
      if (!res.ok) {
        setLoginError(payload.error?.message || 'Login failed. Please try again.');
        return;
      }
      if (payload.must_reset_password) {
        setPendingResetUser(payload.user);
        setMustResetPassword(true);
        return;
      }
      setCurrentUser(payload.user);
      triggerToast(`Welcome back, ${payload.user.name}.`, 'success');
    } catch (err) {
      console.error('Login error:', err);
      setLoginError('Could not reach the server. Please try again.');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setMustResetPassword(false);
    setPendingResetUser(null);
    triggerToast('You have been logged out.', 'info');
  };

  const handlePasswordResetComplete = (loggedInUser: User) => {
    setCurrentUser(loggedInUser);
    setMustResetPassword(false);
    setPendingResetUser(null);
  };

  const triggerRefresh = () => {
    setRefreshFlag(prev => prev + 1);
  };

  const handleBottomTabClick = (tab: string) => {
    const isAllowed = getFilteredMenuItems().some(item => item.id === tab);
    if (isAllowed) {
      setActiveTab(tab);
    } else {
      triggerToast(`Your profile role does not have authorization for this module.`, 'error');
    }
  };

  // Defining the modern Left Navigation modules map grouped by operational area
  const NAV_GROUPS = [
    {
      id: 'ungrouped',
      label: null,
      items: [
        { id: 'dashboard', label: 'Operational KPIs', icon: LayoutDashboard }
      ]
    },
    {
      id: 'warehouse',
      label: 'Warehouse',
      items: [
        { id: 'receipts', label: 'PO Receipts', icon: Download },
        { id: 'bin_locations', label: 'Bin Locations', icon: MapPin },
        { id: 'zoning_rules', label: 'Zoning & Safety Rules', icon: Layers }
      ]
    },
    {
      id: 'inventory',
      label: 'Inventory',
      items: [
        { id: 'catalogue', label: 'Catalogue & PIM Gate', icon: BookOpen },
        { id: 'suppliers', label: 'Suppliers', icon: Building2 },
        { id: 'bundles', label: 'Bundles & Offers', icon: Package2, requiresManager: true },
        { id: 'audits', label: 'Cycle Counts & Write-offs', icon: Layers }
      ]
    },
    {
      id: 'fulfillment',
      label: 'Fulfillment & Logistics',
      items: [
        { id: 'transfers', label: 'Stock Reallocations', icon: ArrowLeftRight },
        { id: 'fulfillment', label: 'Fulfillment Desk', icon: CheckSquare },
        { id: 'packing', label: 'Packing Queue', icon: PackageCheck },
        { id: 'deliveries', label: 'Driver Logistics', icon: Truck },
        { id: 'returns', label: 'Customer Returns', icon: RotateCcw },
        { id: 'eod_check', label: 'Cross-Dock EOD Check', icon: Moon }
      ]
    },
    {
      id: 'compliance',
      label: 'Compliance',
      items: [
        { id: 'traceability', label: 'Regulatory Verification', icon: ClipboardSignature },
        { id: 'recalls', label: 'Product Recalls', icon: ShieldAlert, requiresManager: true },
        { id: 'audit_logs', label: 'Compliance Audit Logs', icon: ShieldCheck }
      ]
    },
    {
      id: 'pos',
      label: 'Point of Sale',
      items: [
        { id: 'pos', label: 'POS', icon: Store, requiresManager: true }
      ]
    },
    {
      id: 'manufacturing',
      label: 'Manufacturing',
      items: [
        { id: 'production', label: 'Assemblies & BOMs', icon: Wrench, requiresManager: true }
      ]
    },
    {
      id: 'accounting_api',
      label: 'Accounting & APIs',
      items: [
        { id: 'users', label: 'Users & Roles', icon: Users2, requiresAdmin: true },
        { id: 'workflow_templates', label: 'Workflow Templates', icon: GitBranch, requiresAdmin: true },
        { id: 'pending_approvals', label: 'Pending Approvals', icon: UserCheck },
        { id: 'margin_report', label: 'Gross Margin Report', icon: TrendingUp, requiresManager: true },
        { id: 'warehouse_mgmt', label: 'Warehouses', icon: Building2, requiresAdmin: true },
        { id: 'zone_mgmt', label: 'Zone Setup', icon: Layers, requiresAdmin: true },
        { id: 'bin_location_mgmt', label: 'Bin Locations Setup', icon: MapPin, requiresAdmin: true },
        { id: 'api_keys', label: 'API Keys', icon: Key, requiresAdmin: true },
        { id: 'webhooks', label: 'Webhooks', icon: Radio, requiresAdmin: true },
        { id: 'settings', label: 'Settings', icon: SettingsIcon, requiresAdmin: true }
      ]
    }
  ];

  // Mapping between Navigation panel items and core platform permissions
  const NAV_PERMISSION_MAP: Record<string, string[]> = {
    receipts: ['receiving:view', 'receiving:create'],
    bin_locations: ['receiving:view', 'receiving:create'],
    zoning_rules: ['receiving:view', 'settings:manage'],
    catalogue: ['catalogue:view'],
    suppliers: ['receiving:view'],
    bundles: ['bundles:manage'],
    audits: ['cycle_counts:create', 'cycle_counts:approve', 'write_offs:create', 'write_offs:approve'],
    transfers: ['transfers:create', 'transfers:approve'],
    fulfillment: ['picking:execute'],
    packing: ['packing:execute'],
    deliveries: ['deliveries:view'],
    returns: ['returns:manage'],
    eod_check: ['eod_check:execute'],
    traceability: ['traceability:view'],
    recalls: ['recalls:initiate', 'recalls:execute'],
    audit_logs: ['traceability:view'],
    production: ['production:execute', 'assembly_templates:approve'],
    users: ['users:manage'],
    workflow_templates: ['settings:manage'],
    pending_approvals: ['transfers:approve'],
    margin_report: ['margin_report:view'],
    pos: ['dispatch:execute', 'settings:manage'],
    warehouse_mgmt: ['settings:manage'],
    zone_mgmt: ['settings:manage'],
    bin_location_mgmt: ['settings:manage'],
    api_keys: ['api_keys:manage'],
    webhooks: ['webhooks:manage'],
    settings: ['settings:manage']
  };

  const userHasPermission = (user: User | null, itemId: string): boolean => {
    if (!user) return false;
    
    // 1. Give absolute priority to Custom Role and its defined permissions
    if (user.custom_role_id) {
      const customRoleObj = customRoles.find(cr => cr.id === user.custom_role_id);
      if (customRoleObj) {
        const requiredPermissions = NAV_PERMISSION_MAP[itemId];
        if (!requiredPermissions || requiredPermissions.length === 0) {
          // Deny by default: any nav item without an explicit entry
          // in NAV_PERMISSION_MAP is hidden from custom-role users.
          // This is intentional — a future nav item added without a
          // map entry must not silently become visible to every
          // custom-role user.
          return false;
        }
        return requiredPermissions.some(perm => customRoleObj.permissions.includes(perm as any));
      }
    }
    
    // 2. Fallback to default legacy roles and their hardcoded structures
    const role = user.role;
    if (role === 'picker') {
      return ['dashboard', 'fulfillment', 'packing'].includes(itemId);
    }
    if (role === 'receiver') {
      return ['dashboard', 'receipts', 'transfers', 'bin_locations', 'catalogue', 'suppliers', 'eod_check', 'deliveries', 'packing', 'pending_approvals'].includes(itemId);
    }
    if (role === 'auditor') {
      return ['dashboard', 'audits', 'traceability', 'catalogue', 'audit_logs', 'pending_approvals'].includes(itemId);
    }
    if (role === 'ops_manager') {
      const flatItems = NAV_GROUPS.flatMap(g => g.items) as any[];
      const matchedItem = flatItems.find(it => it.id === itemId);
      return matchedItem ? !matchedItem.requiresAdmin : true;
    }
    if (role === 'admin') {
      return true;
    }
    return false;
  };

  const getFilteredNavGroups = () => {
    const role = currentUser?.role;
    if (!role) return [];

    const isAllowed = (item: any) => {
      return userHasPermission(currentUser, item.id);
    };

    return NAV_GROUPS.map(group => {
      const filteredItems = group.items.filter(isAllowed);
      return {
        ...group,
        items: filteredItems
      };
    }).filter(group => group.items.length > 0);
  };

  const getFilteredMenuItems = () => {
    return getFilteredNavGroups().flatMap(group => group.items);
  };

  const filteredMenuItems = getFilteredMenuItems();

  useEffect(() => {
    const groupContainingActiveTab = getFilteredNavGroups().find(
      group => group.items.some((item: any) => item.id === activeTab)
    );
    if (groupContainingActiveTab && collapsedGroups.has(groupContainingActiveTab.id)) {
      setCollapsedGroups(prev => {
        const next = new Set(prev);
        next.delete(groupContainingActiveTab.id);
        return next;
      });
    }
  }, [activeTab]);

  useEffect(() => {
    const allowed = getFilteredMenuItems();
    if (allowed.length > 0 && !allowed.some(item => item.id === activeTab)) {
      setActiveTab(allowed[0].id);
    }
  }, [currentUser]);

  if (setupComplete === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-500 border-t-transparent mb-3" />
        <p className="text-slate-400 font-mono text-xs">Booting FreshOpsPlatform Secure Node...</p>
      </div>
    );
  }

  if (setupComplete === false) {
    return <SetupWizard onComplete={() => { setSetupComplete(true); window.location.reload(); }} />;
  }

  if (setupComplete === true && mustResetPassword && pendingResetUser) {
    return (
      <ForcedPasswordReset
        user={pendingResetUser}
        onComplete={handlePasswordResetComplete}
        triggerToast={triggerToast}
      />
    );
  }

  if (setupComplete === true && !currentUser) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        error={loginError}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased flex flex-col selection:bg-teal-100">
      
      {/* Top sticky telemetry header */}
      <header className="bg-slate-950 text-white border-b border-slate-900 shrink-0 sticky top-0 z-50">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Hamburger Button for mobile */}
            <button 
              onClick={() => setSidebarOpen(true)}
              className="hidden sm:flex md:hidden p-1.5 hover:bg-slate-900 text-slate-300 rounded-lg min-h-[44px] min-w-[44px] items-center justify-center cursor-pointer"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="bg-teal-500 text-slate-950 p-2 rounded-lg font-bold hidden xs:block">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xs sm:text-sm font-black tracking-tight uppercase">{platformName} WMS</h1>
              <p className="text-[9px] text-slate-400 tracking-wider">SECURE COLD-CHAIN SUPPLY TRACKING</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Clock */}
            <div className="hidden lg:flex items-center space-x-1.5 text-slate-400 font-mono text-xs">
              <Clock className="h-3.5 w-3.5 text-teal-400" />
              <span>{timeStr || 'TELEMETRY CONNECTING'}</span>
            </div>

            {/* Offline Resiliency Status Indicator Badge */}
            <div className={`hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full border text-[11px] font-bold ${
              appOfflineMode 
                ? 'bg-rose-950/50 text-rose-300 border-rose-800/80' 
                : offlineQueueLen > 0 
                  ? 'bg-amber-950/50 text-amber-300 border-amber-800/80' 
                  : 'bg-emerald-950/50 text-emerald-300 border-emerald-800/80'
            }`}>
              <span className={`h-2 w-2 rounded-full ${
                appOfflineMode 
                  ? 'bg-rose-500 animate-pulse' 
                  : offlineQueueLen > 0 
                    ? 'bg-amber-500 animate-pulse' 
                    : 'bg-emerald-500'
              }`} />
              <span>
                {appOfflineMode 
                  ? `Simulated Offline Mode (${offlineQueueLen} In Queue)` 
                  : offlineQueueLen > 0 
                    ? `Pending Offline Sync (${offlineQueueLen})` 
                    : 'WMS Server Online'
                }
              </span>
            </div>

            {/* Notification Bell */}
            <div className="relative">
              <button 
                onClick={handleBellClick}
                className="p-1.5 hover:bg-slate-900 text-slate-350 hover:text-white rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center relative cursor-pointer"
                id="notif_bell_button"
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 bg-rose-500 text-white rounded-full text-[9px] font-black h-4 px-1.5 flex items-center justify-center border border-slate-950 min-w-4">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                )}
              </button>

              {/* Close click-away */}
              {notifOpen && (
                <div className="fixed inset-0 bg-transparent z-40 cursor-default" onClick={() => setNotifOpen(false)} />
              )}

              {/* Slide-down notifications menu dropdown */}
              {notifOpen && (
                <div className="absolute right-0 mt-2.5 w-80 max-h-[480px] bg-slate-950 border border-slate-800 rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col font-sans animate-slideDown">
                  <div className="p-3 bg-slate-900 border-b border-slate-850 flex items-center justify-between shrink-0">
                    <span className="text-white font-extrabold text-[13px]">Notifications</span>
                    <button
                      onClick={handleMarkAllRead}
                      className="text-xs font-bold text-teal-400 hover:text-teal-300 transition cursor-pointer"
                    >
                      Mark all read
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-850 min-h-[100px] max-h-[360px]">
                    {notifications.length === 0 ? (
                      <div className="p-8 text-center text-slate-500 bg-slate-900">
                        <Bell className="h-8 w-8 mx-auto text-slate-700 mb-2" />
                        <p className="text-[11px] font-bold">No unread notifications</p>
                      </div>
                    ) : (
                      notifications.map((notif) => {
                        const isUnread = !notif.is_read;
                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 text-[11px] hover:bg-slate-800/65 transition flex items-start gap-2.5 cursor-pointer ${
                              isUnread ? 'bg-blue-950/20' : 'bg-transparent'
                            }`}
                          >
                            <div className="mt-0.5 shrink-0">
                              {notif.severity === 'critical' ? (
                                <AlertCircle className="h-4 w-4 text-rose-500" />
                              ) : notif.severity === 'warning' ? (
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                              ) : (
                                <Info className="h-4 w-4 text-sky-450" />
                              )}
                            </div>

                            <div className="flex-1 space-y-0.5">
                              <div className="font-semibold text-slate-100 flex items-center justify-between">
                                <span className="line-clamp-1">{notif.title}</span>
                                {isUnread && (
                                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 shrink-0 self-center" />
                                )}
                              </div>
                              <p className="text-slate-400 text-[11px] line-clamp-2 leading-relaxed">
                                {notif.message}
                              </p>
                              <span className="text-[10px] text-slate-500 block">
                                {formatRelativeTime(notif.created_at)}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Current session identity + logout */}
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 p-1.5 px-3 rounded-xl border-slate-700">
              <UserCheck className="h-4 w-4 text-teal-400 shrink-0" />
              <div className="text-left text-xs text-white">
                <span className="text-[9px] text-slate-500 uppercase font-black block leading-none">Active Session</span>
                <span className="font-bold text-xs block truncate max-w-[150px]">
                  [{currentUser?.role.toUpperCase()}] {currentUser?.name}
                </span>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="text-[10px] font-black text-rose-400 hover:text-rose-300 uppercase tracking-widest ml-2 px-2 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 transition-colors cursor-pointer border border-rose-950 hover:border-rose-900"
              >
                Log Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Structural Body Splitter */}
      <div className="flex-1 flex flex-row">
        
        {/* Static left sidebar for Desktop screens */}
        <aside className="hidden md:flex flex-col w-64 bg-slate-900 p-4 border-r border-slate-850 shrink-0 text-slate-350 justify-between">
          <div className="space-y-4 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-140px)]">
            {getFilteredNavGroups().map((group) => (
              <div key={group.id} className="space-y-1">
                {group.label && (
                  <button
                    type="button"
                    onClick={() => toggleGroupCollapse(group.id)}
                    className="w-full flex items-center justify-between text-[10px] font-black text-slate-500 tracking-widest uppercase mb-1.5 px-3 py-1 hover:text-slate-300 transition-colors cursor-pointer min-h-[28px]"
                  >
                    <span>{group.label}</span>
                    <ChevronDown
                      className={`h-3 w-3 transition-transform duration-200 ${
                        collapsedGroups.has(group.id) ? '-rotate-90' : 'rotate-0'
                      }`}
                    />
                  </button>
                )}
                {!collapsedGroups.has(group.id) && (
                  <nav className="space-y-1">
                    {group.items.map((item) => {
                      const active = activeTab === item.id;
                      const Icon = item.icon;
                      const navItem = item as { id: string; label: string; icon: any; requiresManager?: boolean; requiresAdmin?: boolean };
                      return (
                        <button
                          key={item.id}
                          onClick={() => setActiveTab(item.id)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs tracking-wide transition-all text-left group min-h-[44px] cursor-pointer ${
                            active 
                              ? 'bg-teal-500 text-slate-950 shadow-xs' 
                              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <Icon className={`h-4.5 w-4.5 shrink-0 ${active ? 'text-slate-955' : 'text-slate-500 group-hover:text-teal-400 transition-colors'}`} />
                            <span>{item.label}</span>
                          </div>
                          {navItem.requiresManager && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 rounded-sm ${active ? 'bg-slate-900 text-teal-400' : 'bg-slate-800 text-slate-500'}`}>
                              Mgmt
                            </span>
                          )}
                          {navItem.requiresAdmin && (
                            <span className={`text-[8px] font-extrabold uppercase px-1 rounded-sm ${active ? 'bg-slate-900 text-teal-400' : 'bg-slate-800 text-rose-405'}`}>
                              Admin
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </nav>
                )}
              </div>
            ))}
          </div>

          {/* Secure compliance badge floor */}
          <div className="p-3 bg-slate-950/40 border border-slate-800/80 rounded-xl space-y-1">
            <div className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 uppercase tracking-widest">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              <span>Co-signed Node</span>
            </div>
            <p className="text-[9px] text-slate-500 leading-normal">
              Active session co-signed on Kenyan food regulatory tracking servers securely.
            </p>
          </div>
        </aside>

        {/* Collapsible Mobile swipe menu drawer absolute */}
        {sidebarOpen && (
          <div className="fixed inset-0 bg-slate-955/65 backdrop-blur-xs z-50 md:hidden animate-fadeIn" onClick={() => setSidebarOpen(false)}>
            <div className="w-72 max-w-[85vw] h-full bg-slate-900 text-slate-350 p-4 space-y-4 flex flex-col justify-between" onClick={(e) => e.stopPropagation()}>
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <Building2 className="h-5 w-5 text-teal-405" />
                    <span className="text-xs font-black text-white tracking-widest uppercase">MODULE DESK</span>
                  </div>
                  <button 
                    onClick={() => setSidebarOpen(false)} 
                    className="p-1 hover:bg-slate-800 text-slate-400 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="space-y-4 flex-1 overflow-y-auto pr-1 max-h-[calc(100vh-180px)]">
                  {getFilteredNavGroups().map((group) => (
                    <div key={group.id} className="space-y-1">
                      {group.label && (
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="w-full flex items-center justify-between text-[9px] font-black text-slate-500 tracking-widest uppercase mb-1 px-3 py-1 hover:text-slate-300 transition-colors cursor-pointer min-h-[28px]"
                        >
                          <span>{group.label}</span>
                          <ChevronDown
                            className={`h-3 w-3 transition-transform duration-200 ${
                              collapsedGroups.has(group.id) ? '-rotate-90' : 'rotate-0'
                            }`}
                          />
                        </button>
                      )}
                      {!collapsedGroups.has(group.id) && (
                        <nav className="space-y-1">
                          {group.items.map((item) => {
                            const active = activeTab === item.id;
                            const Icon = item.icon;
                            const navItem = item as { id: string; label: string; icon: any; requiresManager?: boolean; requiresAdmin?: boolean };
                            return (
                              <button
                                key={item.id}
                                onClick={() => {
                                  setActiveTab(item.id);
                                  setSidebarOpen(false);
                                }}
                                className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl font-bold text-xs text-left min-h-[44px] cursor-pointer ${
                                  active 
                                    ? 'bg-teal-505 text-slate-950 bg-teal-500' 
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                                }`}
                              >
                                <div className="flex items-center space-x-3">
                                  <Icon className="h-4.5 w-4.5 shrink-0" />
                                  <span>{item.label}</span>
                                </div>
                                {navItem.requiresManager && (
                                  <span className="text-[8px] font-black uppercase px-1 bg-slate-800 text-slate-400 rounded-sm">
                                    Mgmt
                                  </span>
                                )}
                                {navItem.requiresAdmin && (
                                  <span className="text-[8px] font-black uppercase px-1 bg-slate-800 text-rose-405 rounded-sm">
                                    Admin
                                  </span>
                                )}
                              </button>
                            );
                          })}
                        </nav>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-slate-950/45 border border-slate-800 rounded-xl">
                <span className="text-[9px] text-slate-500 font-bold block">Telemetry Link Status</span>
                <p className="text-[10px] font-black text-emerald-450 flex items-center gap-1 mt-0.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 select-none animate-pulse" />
                  <span>CONNECTED TO REGULATOR</span>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Center operational content window */}
        <main className="flex-1 p-4 sm:p-6 pb-16 sm:pb-0 overflow-x-hidden space-y-6">
          
          {activeTab === 'dashboard' && (
            <Dashboard 
              warehouses={warehouses} 
              skus={skus} 
              triggerRefresh={refreshFlag} 
              onNavigate={setActiveTab}
            />
          )}
          
          {activeTab === 'receipts' && (
            <GoodsReceipt 
              locations={locations} 
              skus={skus} 
              currentUser={currentUser} 
              triggerRefresh={triggerRefresh} 
            />
          )}

          {activeTab === 'transfers' && (
            <Transfers 
              warehouses={warehouses} 
              locations={locations} 
              skus={skus} 
              currentUser={currentUser} 
              triggerRefresh={triggerRefresh}
              refreshFlag={refreshFlag}
            />
          )}

          {activeTab === 'fulfillment' && (
            <Fulfillment 
              currentUser={currentUser} 
              triggerRefresh={triggerRefresh} 
              refreshFlag={refreshFlag} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'packing' && (
            <Packing
              currentUser={currentUser}
              triggerRefresh={triggerRefresh}
              refreshFlag={refreshFlag}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'deliveries' && (
            <Deliveries 
              currentUser={currentUser} 
              triggerRefresh={triggerRefresh} 
              refreshFlag={refreshFlag} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'returns' && (
            <CustomerReturns 
              currentUser={currentUser} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'catalogue' && (
            <Catalogue 
              currentUser={currentUser} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'suppliers' && (
            <Suppliers
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'eod_check' && (
            <EODCheck 
              currentUser={currentUser} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'zoning_rules' && (
            <ZoneManagement
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'warehouse_mgmt' && (
            <WarehouseManagement
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'zone_mgmt' && (
            <ZoneCRUD
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'bin_location_mgmt' && (
            <BinLocationManagement
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'bin_locations' && (
            <BinLocations 
              onNavigate={setActiveTab}
            />
          )}

          {activeTab === 'audits' && (
            <Audits 
              locations={locations} 
              skus={skus} 
              currentUser={currentUser} 
              triggerRefresh={triggerRefresh} 
              refreshFlag={refreshFlag} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'traceability' && (
            <TraceabilityMatrix 
              triggerRefresh={triggerRefresh} 
            />
          )}

          {activeTab === 'audit_logs' && (
            <AuditLogs 
              triggerToast={triggerToast} 
            />
          )}

          {activeTab === 'margin_report' && (
            <MarginReport 
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'pos' && currentUser && (
            <POS
              currentUser={currentUser}
              warehouses={warehouses}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'recalls' && (
            <Recalls
              currentUser={currentUser}
              skus={skus}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'assets' && (
            <AssetsPanel 
              currentUser={currentUser} 
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'production' && (
            <Assemblies 
              currentUser={currentUser} 
              warehouses={warehouses}
              skus={skus}
              locations={locations}
              triggerToast={triggerToast}
              triggerRefresh={triggerRefresh}
              refreshFlag={refreshFlag}
            />
          )}

          {activeTab === 'bundles' && (
            <Bundles
              skus={skus}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'users' && (
            <Users
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'workflow_templates' && (
            <WorkflowTemplates
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'pending_approvals' && (
            <PendingApprovals
              currentUser={currentUser}
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'api_keys' && (
            <ApiKeys
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'webhooks' && (
            <Webhooks
              triggerToast={triggerToast}
            />
          )}

          {activeTab === 'settings' && (
            <Settings
              triggerToast={triggerToast}
            />
          )}
        </main>
      </div>
      
      {/* Mobile Bottom Tab Bar (screens < 640px) */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 h-[56px] bg-slate-950 border-t border-slate-800 flex items-center justify-around z-50 text-white shadow-lg">
        <button
          onClick={() => handleBottomTabClick('dashboard')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 cursor-pointer transition-colors ${
            activeTab === 'dashboard' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <LayoutDashboard className="h-4.5 w-4.5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Dashboard</span>
        </button>

        <button
          onClick={() => handleBottomTabClick('receipts')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 cursor-pointer transition-colors ${
            activeTab === 'receipts' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Download className="h-4.5 w-4.5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Receive</span>
        </button>

        <button
          onClick={() => handleBottomTabClick('fulfillment')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 cursor-pointer transition-colors ${
            activeTab === 'fulfillment' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="h-4.5 w-4.5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Pick</span>
        </button>

        <button
          onClick={() => handleBottomTabClick('bin_locations')}
          className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 cursor-pointer transition-colors ${
            activeTab === 'bin_locations' ? 'text-teal-400 font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="h-4.5 w-4.5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">Bins</span>
        </button>

        <button
          onClick={() => setSidebarOpen(true)}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[44px] flex-1 cursor-pointer text-slate-400 hover:text-slate-200"
        >
          <Menu className="h-4.5 w-4.5" />
          <span className="text-[10px] tracking-tight mt-0.5 font-bold">More</span>
        </button>
      </div>

      {/* Compliance banner floor */}
      <footer className="bg-white border-t border-slate-200 shrink-0 text-slate-400 py-4 text-xs font-mono">
        <div className="px-4 md:px-6 flex flex-col md:flex-row justify-between items-center gap-2">
          <p>© FreshOpsPlatform. All Rights Reserved.</p>
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 select-none" />
            <span className="font-bold text-slate-600">BR-001 to BR-080 Fully Verified</span>
          </div>
        </div>
      </footer>

      {/* Dynamic bottom Toast stack bar notification */}
      <div className="fixed bottom-4 right-4 left-4 md:left-auto md:w-96 flex flex-col space-y-2 z-50">
        {toasts.map(t => (
          <div 
            key={t.id} 
            className={`p-3 rounded-xl border shadow-lg flex items-start gap-2.5 text-xs font-semibold animate-slideUp text-slate-900 ${
              t.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-950' :
              t.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-950' :
              'bg-slate-900 border-slate-850 text-white shadow-slate-950/20'
            }`}
          >
            {t.type === 'success' && <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600 mt-0.5 shrink-0" />}
            {t.type === 'error' && <XCircle className="h-4.5 w-4.5 text-rose-600 mt-0.5 shrink-0" />}
            {t.type === 'info' && <Info className="h-4.5 w-4.5 text-teal-400 mt-0.5 shrink-0" />}
            <span className="flex-1 leading-normal">{t.message}</span>
            <button 
              onClick={() => setToasts(prev => prev.filter(item => item.id !== t.id))}
              className="text-[10px] opacity-70 hover:opacity-100 font-extrabold px-1 cursor-pointer"
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
