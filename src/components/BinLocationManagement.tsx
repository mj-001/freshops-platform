import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Power, PowerOff, X, MapPin, Loader2 } from 'lucide-react';
import { Warehouse, Zone } from '../types';

interface BinLocation {
  id: string;
  code: string;
  name?: string;
  warehouse_id: string;
  zone_id: string;
  location_type: 'pick' | 'bulk' | 'receiving' | 'dispatch' | 'quarantine';
  capacity_units?: number;
  capacity_kg?: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Props {
  currentUser: { role: string } | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const LOCATION_TYPES = ['pick', 'bulk', 'receiving', 'dispatch', 'quarantine'] as const;
type LocType = typeof LOCATION_TYPES[number];

interface BLForm {
  code: string;
  name: string;
  warehouse_id: string;
  zone_id: string;
  location_type: LocType;
  capacity_units: string;
  capacity_kg: string;
}

const EMPTY_FORM: BLForm = { code: '', name: '', warehouse_id: '', zone_id: '', location_type: 'pick', capacity_units: '', capacity_kg: '' };

export default function BinLocationManagement({ currentUser, triggerToast }: Props) {
  const [bins, setBins] = useState<BinLocation[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [filterWh, setFilterWh] = useState('ALL');
  const [filterZone, setFilterZone] = useState('ALL');

  const [modal, setModal] = useState<'add' | 'edit' | 'deactivate' | 'activate' | null>(null);
  const [selected, setSelected] = useState<BinLocation | null>(null);
  const [form, setForm] = useState<BLForm>(EMPTY_FORM);

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'ops_manager';

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const [rb, rw, rz] = await Promise.all([
        fetch('/api/v1/bin-locations'),
        fetch('/api/v1/warehouses'),
        fetch('/api/v1/zones'),
      ]);
      const [bj, wj, zj] = await Promise.all([rb.json(), rw.json(), rz.json()]);
      setBins(bj.data || []);
      setWarehouses(wj.data || []);
      setZones(zj.data || []);
    } catch {
      triggerToast('Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const zonesForWh = (whId: string) => zones.filter(z => z.warehouse_id === whId && z.is_active);
  const filteredZones = filterWh === 'ALL' ? zones : zones.filter(z => z.warehouse_id === filterWh);

  const openAdd = () => {
    const defaultWh = filterWh !== 'ALL' ? filterWh : (warehouses[0]?.id || '');
    const defaultZone = filterZone !== 'ALL' ? filterZone : (zonesForWh(defaultWh)[0]?.id || '');
    setForm({ ...EMPTY_FORM, warehouse_id: defaultWh, zone_id: defaultZone });
    setModal('add');
  };

  const openEdit = (b: BinLocation) => {
    setSelected(b);
    setForm({
      code: b.code, name: b.name || '', warehouse_id: b.warehouse_id, zone_id: b.zone_id,
      location_type: b.location_type,
      capacity_units: b.capacity_units != null ? String(b.capacity_units) : '',
      capacity_kg: b.capacity_kg != null ? String(b.capacity_kg) : '',
    });
    setModal('edit');
  };

  const openDeactivate = (b: BinLocation) => { setSelected(b); setModal('deactivate'); };
  const openActivate = (b: BinLocation) => { setSelected(b); setModal('activate'); };
  const closeModal = () => { setModal(null); setSelected(null); };

  const handleAdd = async () => {
    if (!form.code.trim() || !form.warehouse_id || !form.zone_id) return triggerToast('Code, warehouse, and zone are required', 'error');
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/bin-locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim() || undefined,
          warehouse_id: form.warehouse_id,
          zone_id: form.zone_id,
          location_type: form.location_type,
          capacity_units: form.capacity_units ? Number(form.capacity_units) : undefined,
          capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to create', 'error');
      setBins(prev => [...prev, json.data]);
      triggerToast('Bin location created', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/bin-locations/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim() || undefined,
          code: form.code.trim().toUpperCase(),
          location_type: form.location_type,
          capacity_units: form.capacity_units ? Number(form.capacity_units) : undefined,
          capacity_kg: form.capacity_kg ? Number(form.capacity_kg) : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to update', 'error');
      setBins(prev => prev.map(b => b.id === selected.id ? json.data : b));
      triggerToast('Bin location updated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleDeactivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/bin-locations/${selected.id}/deactivate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Cannot deactivate', 'error');
      setBins(prev => prev.map(b => b.id === selected.id ? { ...b, is_active: false } : b));
      triggerToast('Bin location deactivated', 'info');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const handleActivate = async () => {
    if (!selected) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/bin-locations/${selected.id}/activate`, { method: 'PATCH' });
      const json = await res.json();
      if (!res.ok) return triggerToast(json.error?.message || 'Failed to activate', 'error');
      setBins(prev => prev.map(b => b.id === selected.id ? { ...b, is_active: true } : b));
      triggerToast('Bin location activated', 'success');
      closeModal();
    } catch { triggerToast('Request failed', 'error'); }
    finally { setSubmitting(false); }
  };

  const zoneName = (id: string) => zones.find(z => z.id === id)?.name ?? id;
  const whName = (id: string) => warehouses.find(w => w.id === id)?.name ?? id;

  const capacityDisplay = (b: BinLocation) => {
    const parts = [];
    if (b.capacity_units != null) parts.push(`${b.capacity_units} units`);
    if (b.capacity_kg != null) parts.push(`${b.capacity_kg} kg`);
    return parts.length ? parts.join(' / ') : '—';
  };

  const filtered = bins.filter(b => {
    if (filterWh !== 'ALL' && b.warehouse_id !== filterWh) return false;
    if (filterZone !== 'ALL' && b.zone_id !== filterZone) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-teal-500" />
            Bin Location Management
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">Create and manage physical bin locations within zones.</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Warehouse</label>
            <select value={filterWh} onChange={e => { setFilterWh(e.target.value); setFilterZone('ALL'); }}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none min-h-[40px]">
              <option value="ALL">All Warehouses</option>
              {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[9px] font-black uppercase text-slate-400 block mb-1">Zone</label>
            <select value={filterZone} onChange={e => setFilterZone(e.target.value)}
              className="border border-slate-200 rounded-xl px-3 py-2 text-xs bg-white focus:outline-none min-h-[40px]">
              <option value="ALL">All Zones</option>
              {filteredZones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
            </select>
          </div>
          {isAdmin && (
            <button onClick={openAdd}
              className="flex items-center gap-1.5 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs min-h-[44px] cursor-pointer transition self-end">
              <Plus className="h-4 w-4" />
              Add Bin
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
            <MapPin className="h-8 w-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold">No bin locations found.</p>
            <p className="text-xs mt-1">Adjust filters or add a new bin location.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                  <th className="p-3.5">Code</th>
                  <th className="p-3.5">Name</th>
                  <th className="p-3.5">Warehouse</th>
                  <th className="p-3.5">Zone</th>
                  <th className="p-3.5">Type</th>
                  <th className="p-3.5">Capacity</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5 text-right pr-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(b => (
                  <tr key={b.id} className={`hover:bg-slate-50/50 transition-colors ${!b.is_active ? 'opacity-60' : ''}`}>
                    <td className="p-3.5 font-mono font-bold text-slate-800">{b.code}</td>
                    <td className="p-3.5 text-slate-600">{b.name || '—'}</td>
                    <td className="p-3.5 text-slate-500">{whName(b.warehouse_id)}</td>
                    <td className="p-3.5 text-slate-600">{zoneName(b.zone_id)}</td>
                    <td className="p-3.5">
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">{b.location_type}</span>
                    </td>
                    <td className="p-3.5 text-slate-500 font-mono text-[10px]">{capacityDisplay(b)}</td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${b.is_active ? 'bg-teal-100 text-teal-800' : 'bg-slate-100 text-slate-500'}`}>
                        {b.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="p-3.5 text-right pr-5">
                      {isAdmin && (
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => openEdit(b)}
                            className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                            title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          {b.is_active ? (
                            <button onClick={() => openDeactivate(b)}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Deactivate">
                              <PowerOff className="h-3.5 w-3.5" />
                            </button>
                          ) : (
                            <button onClick={() => openActivate(b)}
                              className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition min-h-[36px] min-w-[36px] flex items-center justify-center cursor-pointer"
                              title="Activate">
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
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Add Bin Location</h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Code *</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. A01-01-01" maxLength={20} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Name (optional)</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  placeholder="e.g. Shelf A, Row 1" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Warehouse *</label>
                <select value={form.warehouse_id}
                  onChange={e => setForm(p => ({ ...p, warehouse_id: e.target.value, zone_id: '' }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  <option value="">Select warehouse…</option>
                  {warehouses.filter(w => w.is_active).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Zone *</label>
                <select value={form.zone_id} onChange={e => setForm(p => ({ ...p, zone_id: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                  disabled={!form.warehouse_id}>
                  <option value="">Select zone…</option>
                  {zonesForWh(form.warehouse_id).map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Location Type *</label>
                <select value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value as LocType }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Capacity (units)</label>
                  <input type="number" min={0} value={form.capacity_units} onChange={e => setForm(p => ({ ...p, capacity_units: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    placeholder="Optional" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Capacity (kg)</label>
                  <input type="number" min={0} value={form.capacity_kg} onChange={e => setForm(p => ({ ...p, capacity_kg: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300"
                    placeholder="Optional" />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={closeModal} className="flex-1 border border-slate-200 text-slate-700 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer hover:bg-slate-50">Cancel</button>
              <button onClick={handleAdd} disabled={submitting}
                className="flex-1 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs min-h-[44px] cursor-pointer disabled:opacity-50 flex items-center justify-center gap-2">
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Bin Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {modal === 'edit' && selected && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="font-bold text-sm text-slate-900">Edit Bin — <span className="font-mono text-teal-600">{selected.code}</span></h2>
              <button onClick={closeModal} className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer">
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Code</label>
                <input type="text" value={form.code} onChange={e => setForm(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-300" maxLength={20} />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Name (optional)</label>
                <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Location Type</label>
                <select value={form.location_type} onChange={e => setForm(p => ({ ...p, location_type: e.target.value as LocType }))}
                  className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300">
                  {LOCATION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Capacity (units)</label>
                  <input type="number" min={0} value={form.capacity_units} onChange={e => setForm(p => ({ ...p, capacity_units: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" placeholder="—" />
                </div>
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Capacity (kg)</label>
                  <input type="number" min={0} value={form.capacity_kg} onChange={e => setForm(p => ({ ...p, capacity_kg: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-300" placeholder="—" />
                </div>
              </div>
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
                <h2 className="font-bold text-sm text-slate-900">Deactivate Bin Location</h2>
                <p className="text-xs text-slate-500 mt-0.5">Blocked if stock is currently allocated here.</p>
              </div>
            </div>
            <p className="text-sm text-slate-700">Deactivate bin <strong>{selected.code}</strong>?</p>
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
              <h2 className="font-bold text-sm text-slate-900">Activate Bin Location</h2>
            </div>
            <p className="text-sm text-slate-700">Activate bin <strong>{selected.code}</strong>? Parent zone must be active.</p>
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
