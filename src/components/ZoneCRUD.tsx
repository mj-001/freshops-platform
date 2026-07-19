import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Power, PowerOff, X, Layers, Loader2 } from 'lucide-react';
import { Zone, Warehouse } from '../types';

interface Props {
  currentUser: { role: string } | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

type ZoneType = 'ambient' | 'chilled' | 'frozen' | 'dry' | 'quarantine';
const ZONE_TYPES: ZoneType[] = ['ambient', 'chilled', 'frozen', 'dry', 'quarantine'];

interface ZoneForm {
  name: string;
  code: string;
  warehouse_id: string;
  zone_type: ZoneType;
  max_capacity_kg: string;
}

const EMPTY_FORM: ZoneForm = { name: '', code: '', warehouse_id: '', zone_type: 'ambient', max_capacity_kg: '' };

export default function ZoneCRUD({ currentUser, triggerToast }: Props) {
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [filterWh, setFilterWh] = useState('ALL');

  const [modal, setModal] = useState<'add' | 'edit' | 'deactivate' | 'activate' | null>(null);
  const [selected, setSelected] = useState<Zone | null>(null);
  const [form, setForm] = useState<ZoneForm>(EMPTY_FORM);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ops_manager';

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [rz, rw] = await Promise.all([fetch('/api/v1/zones'), fetch('/api/v1/warehouses')]);
      const [zj, wj] = await Promise.all([rz.json(), rw.json()]);
      setZones(zj.data || []);
      setWarehouses(wj.data || []);
    } catch {
      triggerToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    const defaultWh = filterWh !== 'ALL' ? filterWh : (warehouses[0]?.id || '');
    setForm({ ...EMPTY_FORM, warehouse_id: defaultWh });
    setModal('add');
  };
  const openEdit = (z: Zone) => {
    setSelected(z);
    setForm({ name: z.name, code: (z as any).code || '', warehouse_id: z.warehouse_id, zone_type: z.type as ZoneType, max_capacity_kg: z.max_capacity_kg != null ? String(z.max_capacity_kg) : '' });
    setModal('edit');
  };
  const openDeactivate = (z: Zone) => { setSelected(z); setModal('deactivate'); };
  const openActivate = (z: Zone) => { setSelected(z); setModal('activate'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleAdd = async () => {
    if (!form.name.trim() || !form.code.trim() || !form.warehouse_id) return triggerToast('Name, code, and warehouse are required', 'error');
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          code: form.code.trim().toUpperCase(),
          warehouse_id: form.warehouse_id,
          zone_type: form.zone_type,
          max_capacity_kg: form.max_capacity_kg ? Number(form.max_capacity_kg) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to create zone', 'error');
      setZones(prev => [...prev, json.data]);
      triggerToast('Zone created', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/zones/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          max_capacity_kg: form.max_capacity_kg ? Number(form.max_capacity_kg) : null,
        }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to update', 'error');
      setZones(prev => prev.map(z => z.id === selected.id ? json.data : z));
      triggerToast('Zone updated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/zones/${selected.id}/deactivate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Cannot deactivate', 'error');
      setZones(prev => prev.map(z => z.id === selected.id ? { ...z, is_active: false } : z));
      triggerToast('Zone deactivated', 'info');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/zones/${selected.id}/activate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to activate', 'error');
      setZones(prev => prev.map(z => z.id === selected.id ? { ...z, is_active: true } : z));
      triggerToast('Zone activated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const whName = (id: string) => warehouses.find(w => w.id === id)?.name ?? id;
  const filtered = filterWh === 'ALL' ? zones : zones.filter(z => z.warehouse_id === filterWh);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-teal-500" />
            Zone Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create and manage temperature zones within each warehouse.</p>
        </div>
        <div className="flex items-center gap-3">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Warehouse</label>
            <select
              value={filterWh}
              onChange={e => setFilterWh(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none min-h-[40px]"
            >
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <button
              onClick={openAdd}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs min-h-[44px] cursor-pointer transition self-end"
            >
              <Plus className="h-4 w-4" />
              Add Zone
            </button>
          )}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            <span className="text-sm">Loading…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Layers className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold">No zones found.</p>
            <p className="text-xs mt-1">{filterWh !== 'ALL' ? 'Try a different warehouse filter.' : 'Add your first zone above.'}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Warehouse</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Capacity (kg)</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(z => (
                  <tr key={z.id} className={`hover:bg-slate-50/50 transition-colors ${!z.is_active ? 'opacity-60' : ''}`}>
                    <td className="p-3.5 font-mono font-bold text-slate-800">{(z as any).code || z.id}</td>
                    <td className="p-3.5 font-semibold text-slate-900">{z.name}</td>
                    <td className="p-3.5 text-slate-500">{whName(z.warehouse_id)}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{z.type}</span>
                    </td>
                    <td className="p-3.5 text-slate-600 font-mono">{z.max_capacity_kg != null ? `${z.max_capacity_kg.toLocaleString()} kg` : '—'}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${z.is_active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
                        {z.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEdit(z)}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            title="Edit capacity"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {z.is_active ? (
                            <button
                              onClick={() => openDeactivate(z)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Deactivate"
                            >
                              <PowerOff className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button
                              onClick={() => openActivate(z)}
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

      {/* Add modal */}
      {modal === 'add' && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Add Zone</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Name *</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. Chilled Room A" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Code *</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. CR-A" maxLength={10} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Warehouse *</label>
                <select value={form.warehouse_id} onChange={e => setForm(p => ({ ...p, warehouse_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="">Select warehouse…</option>
                  {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Zone Type *</label>
                <select value={form.zone_type} onChange={e => setForm(p => ({ ...p, zone_type: e.target.value as ZoneType }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  {ZONE_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Max Capacity (kg, optional)</label>
                <input type="number" min={0} value={form.max_capacity_kg} onChange={e => setForm(p => ({ ...p, max_capacity_kg: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="Leave blank for unlimited" />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Zone
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal — only capacity editable (name/code/warehouse/type fixed after creation) */}
      {modal === 'edit' && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Edit Zone — <span className="font-mono text-teal-600">{(selected as any).code || selected.id}</span></h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Max Capacity (kg)</label>
              <input type="number" min={0} value={form.max_capacity_kg} onChange={e => setForm(p => ({ ...p, max_capacity_kg: e.target.value }))}
                className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                placeholder="Leave blank for unlimited" />
              <p className="text-[10px] text-slate-400 mt-1">Other zone attributes (name, code, type, warehouse) are fixed after creation.</p>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleEdit} disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save Changes
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
                <h2 className="font-bold text-sm text-slate-900">Deactivate Zone</h2>
                <p className="text-xs text-slate-500 mt-0.5">Blocks new putaway into this zone.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Deactivate <strong>{selected.name}</strong>? All active bin locations and stock must be cleared first.</p>
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleDeactivate} disabled={submitting}
                className="flex-1 bg-rose-600 hover:bg-rose-500 text-white font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
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
              <h2 className="font-bold text-sm text-slate-900">Activate Zone</h2>
            </div>
            <p className="text-sm text-slate-700">Activate <strong>{selected.name}</strong>?</p>
            <div className="flex gap-3">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleActivate} disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
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
