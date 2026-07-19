import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Power, PowerOff, X, Building2, Loader2 } from 'lucide-react';
import { Warehouse } from '../types';

interface Props {
  currentUser: { role: string } | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const WAREHOUSE_TYPES = ['main_warehouse', 'fulfilment_point'] as const;
type WHType = typeof WAREHOUSE_TYPES[number];

const TYPE_LABELS: Record<WHType, string> = {
  main_warehouse: 'Main Warehouse',
  fulfilment_point: 'Fulfilment Point',
};

interface WHForm {
  name: string;
  code: string;
  type: WHType;
  address: string;
}

const EMPTY_FORM: WHForm = { name: '', code: '', type: 'main_warehouse', address: '' };

export default function WarehouseManagement({ currentUser, triggerToast }: Props) {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [modal, setModal] = useState<'add' | 'edit' | 'deactivate' | 'activate' | null>(null);
  const [selected, setSelected] = useState<Warehouse | null>(null);
  const [form, setForm] = useState<WHForm>(EMPTY_FORM);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ops_manager';

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/warehouses');
      const json = await res.json();
      setWarehouses(json.data || []);
    } catch {
      triggerToast('Failed to load warehouses', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => { setForm(EMPTY_FORM); setModal('add'); };
  const openEdit = (wh: Warehouse) => { setSelected(wh); setForm({ name: wh.name, code: (wh as any).code || wh.id, type: wh.type as WHType, address: (wh as any).address || '' }); setModal('edit'); };
  const openDeactivate = (wh: Warehouse) => { setSelected(wh); setModal('deactivate'); };
  const openActivate = (wh: Warehouse) => { setSelected(wh); setModal('activate'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.code.trim()) return triggerToast('Name and code are required', 'error');
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/warehouses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), code: form.code.trim().toUpperCase(), type: form.type, address: form.address.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to create warehouse', 'error');
      setWarehouses(prev => [...prev, json.data]);
      triggerToast('Warehouse created', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    if (!form.name.trim()) return triggerToast('Name is required', 'error');
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/warehouses/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name.trim(), type: form.type, address: form.address.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to update', 'error');
      setWarehouses(prev => prev.map(w => w.id === selected.id ? json.data : w));
      triggerToast('Warehouse updated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/warehouses/${selected.id}/deactivate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Cannot deactivate', 'error');
      setWarehouses(prev => prev.map(w => w.id === selected.id ? { ...w, is_active: false } : w));
      triggerToast('Warehouse deactivated', 'info');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/warehouses/${selected.id}/activate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to activate', 'error');
      setWarehouses(prev => prev.map(w => w.id === selected.id ? { ...w, is_active: true } : w));
      triggerToast('Warehouse activated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-500" />
            Warehouse Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create and manage physical warehouse sites and fulfilment points.</p>
        </div>
        {isAdmin && (
          <button
            onClick={openAdd}
            className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs min-h-[44px] cursor-pointer transition"
          >
            <Plus className="h-4 w-4" />
            Add Warehouse
          </button>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : warehouses.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Building2 className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold">No warehouses yet.</p>
            <p className="text-xs mt-1">Add your first warehouse above.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Address</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {warehouses.map(wh => (
                  <tr key={wh.id} className={`hover:bg-slate-50/50 transition-colors ${!wh.is_active ? 'opacity-60' : ''}`}>
                    <td className="p-3.5 font-mono font-bold text-slate-800">{wh.id}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{wh.name}</td>
                    <td className="p-3.5 text-slate-600">{TYPE_LABELS[wh.type as WHType] ?? wh.type}</td>
                    <td className="p-3.5 text-slate-500">{(wh as any).address || '—'}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${wh.is_active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
                        {wh.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(wh)}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {wh.is_active ? (
                            <button
                              onClick={() => openDeactivate(wh)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Deactivate"
                            >
                              <PowerOff className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openActivate(wh)}
                              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Activate"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {(modal === 'add' || modal === 'edit') && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">{modal === 'add' ? 'Add Warehouse' : 'Edit Warehouse'}</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. Nairobi Central Warehouse"
                />
              </div>
              {modal === 'add' && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Code * (3–6 chars)</label>
                  <input
                    type="text"
                    value={form.code}
                    onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-300"
                    placeholder="e.g. NBO"
                    maxLength={6}
                  />
                </div>
              )}
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Type *</label>
                <select
                  value={form.type}
                  onChange={e => setForm(p => ({ ...p, type: e.target.value as WHType }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                >
                  {WAREHOUSE_TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Address (optional)</label>
                <input
                  type="text"
                  value={form.address}
                  onChange={e => setForm(p => ({ ...p, address: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. Industrial Area, Nairobi"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button
                onClick={modal === 'add' ? handleAdd : handleEdit}
                disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                {modal === 'add' ? 'Create Warehouse' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirm */}
      {modal === 'deactivate' && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-rose-100 rounded-xl"><PowerOff className="h-5 w-5 text-rose-600" /></div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">Deactivate Warehouse</h2>
                <p className="text-xs text-slate-500 mt-0.5">This blocks new receipts, transfers, and pick operations.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Deactivate <strong>{selected.name}</strong>? All active zones must be deactivated first.</p>
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleDeactivate}
                disabled={submitting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activate confirm */}
      {modal === 'activate' && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-100 rounded-xl"><Power className="h-5 w-5 text-teal-600" /></div>
              <div>
                <h2 className="font-bold text-sm text-slate-900">Activate Warehouse</h2>
                <p className="text-xs text-slate-500 mt-0.5">Re-enables this warehouse for all operations.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Activate <strong>{selected.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button
                onClick={handleActivate}
                disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Activate
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
