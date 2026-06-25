import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Search, 
  X, 
  Edit, 
  Loader2, 
  Check, 
  ChevronDown, 
  ChevronUp, 
  Plus, 
  Truck, 
  Phone, 
  Mail, 
  Calendar,
  AlertCircle,
  ExternalLink,
  Ban,
  RefreshCw,
  Clock
} from 'lucide-react';
import { User, Supplier, SKU } from '../types';

interface SuppliersProps {
  currentUser: User | null;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Suppliers({ currentUser, triggerToast }: SuppliersProps) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
  
  // Expanded Supplier Details ID
  const [expandedSupplierId, setExpandedSupplierId] = useState<string | null>(null);
  
  // Slide-out Drawer Panel (Create / Edit)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<'create' | 'edit'>('create');
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  
  // Form state
  const [formName, setFormName] = useState('');
  const [formContactName, setFormContactName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formLeadTime, setFormLeadTime] = useState<number>(5);
  const [formPaymentTerms, setFormPaymentTerms] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formFieldError, setFormFieldError] = useState<{ [key: string]: string }>({});
  const [submittingForm, setSubmittingForm] = useState(false);
  
  // Inline/Row Actions state
  const [confirmDeactivateId, setConfirmDeactivateId] = useState<string | null>(null);
  const [submittingDeactivate, setSubmittingDeactivate] = useState(false);
  const [submittingReactivateId, setSubmittingReactivateId] = useState<string | null>(null);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'ops_manager';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [supRes, skusRes] = await Promise.all([
        fetch('/api/v1/suppliers'),
        fetch('/api/v1/skus')
      ]);

      if (!supRes.ok) throw new Error('Failed to fetch supplier lists.');
      if (!skusRes.ok) throw new Error('Failed to fetch product catalog.');

      const [supJson, skusJson] = await Promise.all([
        supRes.json(),
        skusRes.json()
      ]);

      setSuppliers(supJson.data || []);
      setSkus(skusJson.data || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error occurred while loading suppliers.');
      triggerToast?.(err.message || 'Could not load suppliers data.', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter products mapped to a supplier
  const getSupplierSKUs = (supplierId: string) => {
    return skus.filter(sku => sku.supplier_id === supplierId);
  };

  // Filter counts of active SKUs
  const getActiveSKUsCount = (supplierId: string) => {
    return skus.filter(sku => sku.supplier_id === supplierId && sku.is_active).length;
  };

  // Color Coding for lead times:
  // 1-2 days = green, 3-5 days = amber, 6+ days = rose
  const getLeadTimeBadgeClass = (days: number) => {
    if (days <= 2) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    } else if (days <= 5) {
      return 'bg-amber-50 text-amber-700 border-amber-200';
    } else {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
  };

  // Filtered suppliers selection
  const filteredSuppliers = suppliers.filter(s => {
    const matchesSearch = 
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.contact_name && s.contact_name.toLowerCase().includes(searchQuery.toLowerCase()));

    if (statusFilter === 'active') return s.is_active && matchesSearch;
    if (statusFilter === 'inactive') return !s.is_active && matchesSearch;
    return matchesSearch;
  });

  // Drawer handlers
  const handleOpenCreateDrawer = () => {
    setDrawerMode('create');
    setEditingSupplier(null);
    setFormName('');
    setFormContactName('');
    setFormPhone('');
    setFormEmail('');
    setFormLeadTime(5);
    setFormPaymentTerms('NET30');
    setFormError(null);
    setFormFieldError({});
    setIsDrawerOpen(true);
  };

  const handleOpenEditDrawer = (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setDrawerMode('edit');
    setEditingSupplier(supplier);
    setFormName(supplier.name || '');
    setFormContactName(supplier.contact_name || '');
    setFormPhone(supplier.phone || '');
    setFormEmail(supplier.email || '');
    setFormLeadTime(supplier.lead_time_days || 5);
    setFormPaymentTerms(supplier.payment_terms || '');
    setFormError(null);
    setFormFieldError({});
    setIsDrawerOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormFieldError({});

    if (!formName.trim()) {
      setFormFieldError(prev => ({ ...prev, name: 'Supplier name is required.' }));
      return;
    }
    if (formName.trim().length < 2) {
      setFormFieldError(prev => ({ ...prev, name: 'Name must be at least 2 characters.' }));
      return;
    }
    if (formLeadTime < 1) {
      setFormFieldError(prev => ({ ...prev, leadTime: 'Lead time must be at least 1 day.' }));
      return;
    }

    setSubmittingForm(true);
    try {
      const url = drawerMode === 'create' 
        ? '/api/v1/suppliers' 
        : `/api/v1/suppliers/${editingSupplier?.id}`;
      const method = drawerMode === 'create' ? 'POST' : 'PATCH';

      const payload = {
        name: formName.trim(),
        contact_name: formContactName.trim() || null,
        phone: formPhone.trim() || null,
        email: formEmail.trim() || null,
        lead_time_days: Number(formLeadTime),
        payment_terms: formPaymentTerms.trim() || null
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Failed to save supplier parameters.');
      }

      const savedSupplier = json.data;

      if (drawerMode === 'create') {
        setSuppliers(prev => [savedSupplier, ...prev]);
        triggerToast?.(`Supplier "${savedSupplier.name}" created successfully.`, 'success');
      } else {
        setSuppliers(prev => prev.map(s => s.id === savedSupplier.id ? savedSupplier : s));
        triggerToast?.(`Supplier "${savedSupplier.name}" updated successfully.`, 'success');
      }

      setIsDrawerOpen(false);
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Error occurred while saving supplier.');
    } finally {
      setSubmittingForm(false);
    }
  };

  // Deactivate inline handlers
  const handleDeactivateClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeactivateId(id);
  };

  const handleDeactivateCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeactivateId(null);
  };

  const handleDeactivateConfirm = async (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubmittingDeactivate(true);
    try {
      const res = await fetch(`/api/v1/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: false })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to deactivate supplier.');

      const updated = json.data;
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      triggerToast?.(`Supplier "${supplier.name}" has been deactivated.`, 'success');
      setConfirmDeactivateId(null);
    } catch (err: any) {
      console.error(err);
      triggerToast?.(err.message || 'Error occurred while deactivating supplier.', 'error');
    } finally {
      setSubmittingDeactivate(false);
    }
  };

  // Reactivate inline handler (no confirmation needed)
  const handleReactivate = async (supplier: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setSubmittingReactivateId(supplier.id);
    try {
      const res = await fetch(`/api/v1/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: true })
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error?.message || 'Failed to reactivate supplier.');

      const updated = json.data;
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      triggerToast?.(`Supplier "${supplier.name}" has been reactivated.`, 'success');
    } catch (err: any) {
      console.error(err);
      triggerToast?.(err.message || 'Error occurred while reactivating supplier.', 'error');
    } finally {
      setSubmittingReactivateId(null);
    }
  };

  const handleRowClick = (id: string) => {
    setExpandedSupplierId(expandedSupplierId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-slate-900 font-bold text-2xl leading-none">Suppliers</h1>
          <p className="text-slate-500 text-xs mt-1.5 leading-snug">
            Manage supplier relationships, lead times, and payment terms.
          </p>
        </div>
        {canManage && (
          <button
            onClick={handleOpenCreateDrawer}
            className="inline-flex items-center justify-center gap-1.5 bg-teal-500 hover:bg-teal-400 font-extrabold text-slate-950 text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-3xs transition-all shrink-0 min-h-[44px]"
          >
            <Plus className="h-4 w-4" />
            New Supplier
          </button>
        )}
      </div>

      {/* Search & Filter bar */}
      <div className="bg-white border border-slate-205 rounded-2xl shadow-3xs p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search suppliers by name or contact..."
            className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl pl-10 pr-4 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 overflow-x-auto self-start md:self-auto pb-1 md:pb-0">
          <span className="text-[10px] uppercase font-black text-slate-400 tracking-wider mr-1.5 shrink-0">Status:</span>
          {(['active', 'inactive', 'all'] as const).map(f => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border capitalize shrink-0 transition-all cursor-pointer min-h-[40px] ${
                statusFilter === f 
                  ? 'bg-teal-50 border-teal-500 text-teal-700' 
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Pane */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-150 rounded-2xl space-y-3">
          <Loader2 className="h-8 w-8 text-teal-500 animate-spin" />
          <span className="text-slate-500 text-xs font-semibold">Decryption directory listings...</span>
        </div>
      ) : error ? (
        <div className="p-5 bg-rose-50 border border-rose-150 rounded-2xl text-rose-800 text-xs flex items-center gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-rose-600" />
          <div className="space-y-1">
            <p className="font-bold">Failed to load supplier directories</p>
            <p className="opacity-90">{error}</p>
          </div>
          <button 
            onClick={loadData}
            className="ml-auto p-2 bg-rose-100 hover:bg-rose-200 rounded-lg font-bold text-rose-800 flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5 animate-pulse" />
            Retry
          </button>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center bg-white border border-slate-150 rounded-2xl">
          <div className="p-4 bg-teal-50 rounded-full mb-4">
            <Truck className="h-10 w-10 text-teal-600" />
          </div>
          <h3 className="font-bold text-slate-800 text-base leading-snug">No suppliers found</h3>
          <p className="text-slate-500 text-xs max-w-sm mt-1 leading-normal">
            {searchQuery || statusFilter !== 'active' 
              ? "No supplier directory records match your active search terms or status filters. Try clearing them or onboarding a new vendor."
              : "Start mapping directory metadata by boarding your organization's first official supply partner."}
          </p>
          {canManage && !searchQuery && statusFilter === 'active' && (
            <button
              onClick={handleOpenCreateDrawer}
              className="mt-5 inline-flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 font-extrabold text-slate-950 text-xs px-4 py-2.5 rounded-xl cursor-pointer shadow-3xs transition-all"
            >
              <Plus className="h-4 w-4" />
              Onboard First Supplier
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block bg-white border border-slate-205 rounded-2xl shadow-3xs overflow-hidden">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150">
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-left">Name</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-left">Contact</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-left">Phone</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-left">Email</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-center">Lead Time</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-left">Payment Terms</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-center">Products</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-center">Status</th>
                  <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest p-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSuppliers.map(s => {
                  const isExpanded = expandedSupplierId === s.id;
                  const isDeactivating = confirmDeactivateId === s.id;
                  const activeSkusCount = getActiveSKUsCount(s.id);
                  const supplierSKUs = getSupplierSKUs(s.id);

                  return (
                    <React.Fragment key={s.id}>
                      {/* Main Row */}
                      <tr 
                        onClick={() => handleRowClick(s.id)}
                        className={`hover:bg-slate-50 border-b border-slate-150 transition-all cursor-pointer ${
                          isExpanded ? 'bg-slate-50/50' : ''
                        }`}
                      >
                        {/* Name */}
                        <td className="p-4 font-bold text-slate-900 text-xs">
                          <div className="flex items-center gap-2">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                            <span>{s.name}</span>
                          </div>
                        </td>

                        {/* Contact */}
                        <td className="p-4 text-xs text-slate-700 font-medium">
                          {s.contact_name || <span className="text-slate-400 italic">—</span>}
                        </td>

                        {/* Phone */}
                        <td className="p-4 text-xs">
                          {s.phone ? (
                            <a 
                              href={`tel:${s.phone}`} 
                              onClick={(e) => e.stopPropagation()} 
                              className="text-teal-600 hover:underline inline-flex items-center gap-1 font-semibold"
                            >
                              <Phone className="h-3 w-3 text-slate-400" />
                              {s.phone}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Email */}
                        <td className="p-4 text-xs">
                          {s.email ? (
                            <a 
                              href={`mailto:${s.email}`} 
                              onClick={(e) => e.stopPropagation()} 
                              className="text-teal-600 hover:underline inline-flex items-center gap-1 font-semibold truncate max-w-[150px]"
                            >
                              <Mail className="h-3 w-3 text-slate-400" />
                              {s.email}
                            </a>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        {/* Lead Time */}
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getLeadTimeBadgeClass(s.lead_time_days)}`}>
                            {s.lead_time_days} days
                          </span>
                        </td>

                        {/* Payment Terms */}
                        <td className="p-4 text-xs text-slate-700">
                          {s.payment_terms || <span className="text-slate-400">COD</span>}
                        </td>

                        {/* Products */}
                        <td className="p-4 text-center text-xs font-bold text-slate-700">
                          {activeSkusCount}
                        </td>

                        {/* Status */}
                        <td className="p-4 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                            s.is_active 
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                              : 'bg-slate-50 text-slate-500 border-slate-200'
                          }`}>
                            {s.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={(e) => handleOpenEditDrawer(s, e)}
                              className="p-1.5 hover:bg-slate-100 text-slate-600 hover:text-teal-600 rounded-lg cursor-pointer"
                              title="Edit Supplier"
                            >
                              <Edit className="h-4 w-4" />
                            </button>

                            {canManage && (
                              s.is_active ? (
                                <button
                                  onClick={(e) => handleDeactivateClick(s.id, e)}
                                  disabled={submittingDeactivate}
                                  className="p-1.5 hover:bg-rose-50 text-slate-600 hover:text-rose-600 rounded-lg cursor-pointer"
                                  title="Deactivate Supplier"
                                >
                                  <Ban className="h-4 w-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={(e) => handleReactivate(s, e)}
                                  disabled={submittingReactivateId === s.id}
                                  className="p-1.5 hover:bg-teal-50 text-slate-600 hover:text-teal-600 rounded-lg cursor-pointer flex items-center justify-center"
                                  title="Reactivate Supplier"
                                >
                                  {submittingReactivateId === s.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-teal-600" />
                                  ) : (
                                    <Check className="h-4 w-4 text-teal-500" />
                                  )}
                                </button>
                              )
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Inline Confirmation row for Deactivation */}
                      {isDeactivating && (
                        <tr className="bg-rose-50/80">
                          <td colSpan={9} className="p-4 border-b border-rose-150 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                                <span className="text-rose-800 font-medium">
                                  Deactivate <strong className="text-rose-955">{s.name}</strong>? This supplier will no longer appear in product dropdowns.
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <button
                                  onClick={(e) => handleDeactivateConfirm(s, e)}
                                  disabled={submittingDeactivate}
                                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-[44px]"
                                >
                                  {submittingDeactivate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                  Confirm Deactivate
                                </button>
                                <button
                                  onClick={handleDeactivateCancel}
                                  disabled={submittingDeactivate}
                                  className="px-4 py-2 border border-slate-250 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer min-h-[44px]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expanded Details Row */}
                      {isExpanded && !isDeactivating && (
                        <tr className="bg-slate-50/55">
                          <td colSpan={9} className="p-4 border-b border-slate-200">
                            <div className="px-4 py-2 animate-fadeIn">
                              <div className="bg-white border border-slate-205 rounded-xl p-5 text-xs text-slate-700 space-y-5 shadow-xs">
                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 pb-4 border-b border-slate-100">
                                  <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Supplier ID</span>
                                    <span className="font-mono text-slate-800 font-bold">{s.id}</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Registered On</span>
                                    <span className="text-slate-800 font-medium flex items-center gap-1">
                                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                                      {new Date(s.created_at).toLocaleString()}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Active / Placed Products</span>
                                    <span className="text-slate-800 font-bold">{activeSkusCount} of {supplierSKUs.length} items</span>
                                  </div>
                                  <div>
                                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Expected Lead Time</span>
                                    <span className="text-slate-800 font-semibold flex items-center gap-1">
                                      <Clock className="h-3.5 w-3.5 text-slate-400" />
                                      {s.lead_time_days} days
                                    </span>
                                  </div>
                                </div>
                                
                                <div className="pt-2">
                                  <h4 className="text-xs font-bold text-slate-900 mb-3.5 flex items-center gap-1.5">
                                    <Building2 className="h-4 w-4 text-teal-500" />
                                    Products from this Supplier ({supplierSKUs.length})
                                  </h4>
                                  {supplierSKUs.length === 0 ? (
                                    <p className="text-slate-500 italic mt-1 text-[11px]">No catalog SKUs are currently mapped to this supplier.</p>
                                  ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                      {supplierSKUs.slice(0, 10).map(sku => (
                                        <div key={sku.id} className="bg-slate-50 border border-slate-150 rounded-xl p-3 flex items-center justify-between">
                                          <div>
                                            <p className="font-bold text-slate-800 leading-tight text-xs">{sku.name}</p>
                                            <p className="text-[10px] font-mono text-slate-400 mt-0.5">Code: {sku.code}</p>
                                          </div>
                                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                                            sku.is_active 
                                              ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                                              : 'bg-slate-100 text-slate-500 border-slate-205'
                                          }`}>
                                            {sku.is_active ? 'Active' : 'Inactive'}
                                          </span>
                                        </div>
                                      ))}
                                      {supplierSKUs.length > 10 && (
                                        <div className="col-span-1 md:col-span-2 lg:col-span-3 text-center py-2 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-xs font-bold text-slate-500">
                                          + {supplierSKUs.length - 10} more catalog products mapped to this supplier
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Collapsed Mobile Card Layout (< md) */}
          <div className="grid grid-cols-1 gap-4 md:hidden">
            {filteredSuppliers.map(s => {
              const activeSkusCount = getActiveSKUsCount(s.id);
              const isExpanded = expandedSupplierId === s.id;
              const isDeactivating = confirmDeactivateId === s.id;
              const supplierSKUs = getSupplierSKUs(s.id);
              
              return (
                <div 
                  key={s.id} 
                  onClick={() => handleRowClick(s.id)}
                  className={`bg-white rounded-2xl border transition-all p-5 space-y-3 cursor-pointer ${
                    isExpanded ? 'border-teal-500 ring-1 ring-teal-500/25' : 'border-slate-205 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-slate-900 text-sm leading-tight">{s.name}</h3>
                      <span className="text-[10px] font-mono text-slate-400 mt-1 block">ID: {s.id}</span>
                    </div>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider border ${
                      s.is_active 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-150' 
                        : 'bg-slate-50 text-slate-500 border-slate-200'
                    }`}>
                      {s.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-3 text-xs border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Contact</span>
                      <span className="text-slate-800 font-medium">{s.contact_name || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Lead Time</span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border mt-0.5 ${getLeadTimeBadgeClass(s.lead_time_days)}`}>
                        {s.lead_time_days} days
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Phone</span>
                      {s.phone ? (
                        <a 
                          href={`tel:${s.phone}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="text-teal-600 hover:underline inline-flex items-center gap-1 mt-0.5 font-semibold"
                        >
                          {s.phone}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Email</span>
                      {s.email ? (
                        <a 
                          href={`mailto:${s.email}`} 
                          onClick={(e) => e.stopPropagation()} 
                          className="text-teal-600 hover:underline inline-flex items-center gap-1 mt-0.5 font-semibold truncate max-w-[120px]"
                        >
                          {s.email}
                        </a>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Payment Terms</span>
                      <span className="text-slate-700 font-medium">{s.payment_terms || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active Products</span>
                      <span className="text-slate-700 font-bold">{activeSkusCount} items</span>
                    </div>
                  </div>

                  {/* Actions Area */}
                  <div className="flex items-center justify-between border-t border-slate-100 pt-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => handleOpenEditDrawer(s, e)}
                        className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-teal-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-teal-200 cursor-pointer"
                      >
                        <Edit className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      
                      {canManage && (
                        s.is_active ? (
                          <button
                            onClick={(e) => handleDeactivateClick(s.id, e)}
                            disabled={submittingDeactivate}
                            className="px-3 py-1.5 border border-rose-200 hover:bg-rose-50 rounded-lg text-xs font-bold text-rose-600 hover:text-rose-700 cursor-pointer"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            onClick={(e) => handleReactivate(s, e)}
                            disabled={submittingReactivateId === s.id}
                            className="px-3 py-1.5 border border-teal-250 hover:bg-teal-50 rounded-lg text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer"
                          >
                            {submittingReactivateId === s.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                            Reactivate
                          </button>
                        )
                      )}
                    </div>
                    
                    <button className="text-slate-500 hover:text-slate-800">
                      {isExpanded ? <ChevronUp className="h-4.5 w-4.5" /> : <ChevronDown className="h-4.5 w-4.5" />}
                    </button>
                  </div>

                  {/* Mobile confirmation container */}
                  {isDeactivating && (
                    <div className="bg-rose-50 border border-rose-150 rounded-xl p-4 space-y-3 mt-2" onClick={(e) => e.stopPropagation()}>
                      <p className="text-xs text-rose-800 font-medium leading-normal">
                        Deactivate <strong className="text-rose-955">{s.name}</strong>? This supplier will no longer appear in product dropdowns.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => handleDeactivateConfirm(s, e)}
                          disabled={submittingDeactivate}
                          className="px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 leading-none text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 shrink-0 cursor-pointer min-h-[44px]"
                        >
                          {submittingDeactivate && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                          Confirm Deactivate
                        </button>
                        <button 
                          onClick={handleDeactivateCancel}
                          disabled={submittingDeactivate}
                          className="px-3.5 py-2.5 border border-slate-205 hover:bg-slate-50 leading-none text-slate-700 rounded-xl text-xs font-bold cursor-pointer min-h-[44px]"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Mobile expanded SKU details container */}
                  {isExpanded && !isDeactivating && (
                    <div onClick={(e) => e.stopPropagation()} className="pt-2">
                      <div className="bg-slate-50 border border-slate-205 rounded-xl p-4 text-xs text-slate-700 space-y-3">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Supplier ID</span>
                          <span className="font-mono text-slate-800 font-bold">{s.id}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered On</span>
                          <span className="text-slate-800 font-medium">{new Date(s.created_at).toLocaleDateString()}</span>
                        </div>
                        <div className="border-t border-slate-200 pt-3">
                          <h4 className="text-[11px] font-bold text-slate-900 mb-2.5 flex items-center gap-1">
                            <Building2 className="h-4 w-4 text-teal-400" />
                            SKU Lineages ({supplierSKUs.length})
                          </h4>
                          {supplierSKUs.length === 0 ? (
                            <p className="text-slate-500 italic text-[11px]">No mapped SKUs registered for this vendor.</p>
                          ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {supplierSKUs.slice(0, 10).map(sku => (
                                <div key={sku.id} className="bg-white border border-slate-150 rounded-lg p-2.5 flex items-center justify-between text-[11px]">
                                  <div>
                                    <p className="font-bold text-slate-800 leading-tight">{sku.name}</p>
                                    <p className="text-[9px] font-mono text-slate-400 mt-0.5">Code: {sku.code}</p>
                                  </div>
                                  <span className={`inline-flex px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                                    sku.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-150' : 'bg-slate-100 text-slate-500 border-slate-200'
                                  }`}>
                                    {sku.is_active ? 'Active' : 'Inactive'}
                                  </span>
                                </div>
                              ))}
                              {supplierSKUs.length > 10 && (
                                <div className="text-center py-1.5 bg-slate-100/50 rounded-lg text-[10px] font-bold text-slate-500">
                                  + {supplierSKUs.length - 10} more SKUs
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Slide-out drawer sheet panel (matches Bundles / Catalogue visual design) */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex justify-end animate-fadeIn" onClick={() => setIsDrawerOpen(false)}>
          <div 
            className="w-full max-w-lg bg-white h-full shadow-2xl p-6 md:p-8 flex flex-col justify-between overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between border-b border-slate-150 pb-4">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {drawerMode === 'create' ? 'Add New Supplier' : 'Edit Supplier'}
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-1">
                    {drawerMode === 'create' 
                      ? 'Introduce a new vendor relation into the centralized catalog directory.' 
                      : `Update parameters and information for vendor ${editingSupplier?.id}`}
                  </p>
                </div>
                <button
                  onClick={() => setIsDrawerOpen(false)}
                  className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-slate-700 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-250 rounded-xl text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleFormSubmit} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Supplier Name *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => {
                      setFormName(e.target.value);
                      if (formFieldError.name) setFormFieldError(prev => { const n = {...prev}; delete n.name; return n; });
                    }}
                    placeholder="e.g. East Africa Growers Ltd."
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                  {formFieldError.name && (
                    <p className="text-rose-600 text-[10px] mt-1 font-semibold">{formFieldError.name}</p>
                  )}
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Contact Person Name</label>
                  <input
                    type="text"
                    value={formContactName}
                    onChange={(e) => setFormContactName(e.target.value)}
                    placeholder="e.g. Jane Doe"
                    className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Phone Number</label>
                    <input
                      type="tel"
                      value={formPhone}
                      onChange={(e) => setFormPhone(e.target.value)}
                      placeholder="e.g. +254 700 000000"
                      className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Email Address</label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      placeholder="e.g. supply@growers.co.ke"
                      className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Lead Time (Days) *</label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={formLeadTime}
                      onChange={(e) => {
                        setFormLeadTime(Number(e.target.value));
                        if (formFieldError.leadTime) setFormFieldError(prev => { const n = {...prev}; delete n.leadTime; return n; });
                      }}
                      className="w-full bg-slate-50 text-slate-800 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                    />
                    {formFieldError.leadTime && (
                      <p className="text-rose-600 text-[10px] mt-1 font-semibold">{formFieldError.leadTime}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Payment Terms (e.g. NET30, COD)</label>
                    <input
                      type="text"
                      value={formPaymentTerms}
                      onChange={(e) => setFormPaymentTerms(e.target.value)}
                      placeholder="e.g. NET30"
                      className="w-full bg-slate-50 text-slate-800 placeholder-slate-400 border border-slate-250 rounded-xl px-3 py-2.5 text-xs focus:border-teal-500 focus:outline-hidden min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-150 pt-4 flex items-center justify-end gap-3 mt-6">
                  <button
                    type="button"
                    disabled={submittingForm}
                    onClick={() => setIsDrawerOpen(false)}
                    className="px-4 py-2.5 border border-slate-250 hover:bg-slate-50 font-bold text-slate-700 rounded-xl text-xs min-h-[44px] cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingForm}
                    className="px-5 py-2.5 bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-extrabold rounded-xl text-xs flex items-center justify-center gap-1.5 min-h-[44px] cursor-pointer shadow-xs"
                  >
                    {submittingForm && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    {drawerMode === 'create' ? 'Create Supplier' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
