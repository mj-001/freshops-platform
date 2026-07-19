import React, { useState, useEffect } from 'react';
import { User, SKU, Supplier, Batch, ProductRecall, RecallAction } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { 
  Plus, 
  Lock, 
  Trash2, 
  Truck, 
  Users, 
  FileText, 
  CheckCircle2, 
  AlertTriangle, 
  Copy, 
  Loader2, 
  ArrowRight, 
  ShieldAlert, 
  X,
  Package,
  FileSpreadsheet
} from 'lucide-react';

interface RecallsProps {
  currentUser: User | null;
  skus: SKU[];
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Recalls({ currentUser, skus, triggerToast }: RecallsProps) {
  const { currencyCode } = useCurrency();
  const [recalls, setRecalls] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Modal / Form state
  const [isInitiating, setIsInitiating] = useState(false);
  const [formStep, setFormStep] = useState<1 | 2>(1);
  const [draftRecall, setDraftRecall] = useState<any | null>(null);

  // Form Fields
  const [scope, setScope] = useState<'batch' | 'sku' | 'supplier'>('sku');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedSupplier, setSelectedSupplier] = useState('');
  const [selectedBatches, setSelectedBatches] = useState<string[]>([]);
  const [reason, setReason] = useState<string>('HEALTH_SAFETY');
  const [disposition, setDisposition] = useState<string>('hold');

  // Active / Selected Recall Details View
  const [viewingRecall, setViewingRecall] = useState<any | null>(null);
  const [submittingConfirm, setSubmittingConfirm] = useState(false);

  // Static Data lists
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  // Permissions lock helper
  const isManager = currentUser?.role === 'ops_manager' || currentUser?.role === 'admin';

  useEffect(() => {
    fetchRecalls();
    fetchSuppliers();
    fetchBatches();
  }, []);

  const fetchRecalls = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/v1/recalls');
      const data = await res.json();
      setRecalls(data.data || []);
      setOffline(false);
    } catch (err) {
      console.error(err);
      setOffline(true);
      triggerToast('Could not fetch products recalls list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/v1/suppliers');
      const data = await res.json();
      setSuppliers(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/v1/batches');
      const data = await res.json();
      setBatches(data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  // Steps handling
  const handleInitiateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        scope,
        sku_id: scope === 'sku' ? selectedSku : null,
        supplier_id: scope === 'supplier' ? selectedSupplier : null,
        batch_ids: scope === 'batch' ? selectedBatches : [],
        reason,
        disposition
      };

      const res = await fetch('/api/v1/recalls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.data) {
        setDraftRecall(data.data);
        setFormStep(2);
        triggerToast('Draft Recall initiated. Please review exposure.', 'info');
      } else {
        triggerToast(data.error?.message || 'Failed to initiate draft', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error while saving draft', 'error');
    }
  };

  const handleConfirmRecall = async () => {
    if (!draftRecall) return;
    try {
      setSubmittingConfirm(true);
      const res = await fetch(`/api/v1/recalls/${draftRecall.id}/confirm`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.data) {
        triggerToast('Safety recall fully confirmed and active!', 'success');
        setIsInitiating(false);
        setDraftRecall(null);
        setFormStep(1);
        fetchRecalls(); // reload
      } else {
        triggerToast(data.error?.message || 'Error executing safety recall', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error confirming recall', 'error');
    } finally {
      setSubmittingConfirm(false);
    }
  };

  const handleResolveRecall = async (recallId: string) => {
    const confirmChoice = window.confirm("Mark this recall as resolved? This means all affected stock has been accounted for.");
    if (!confirmChoice) return;
    
    try {
      const res = await fetch(`/api/v1/recalls/${recallId}/resolve`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.data) {
        triggerToast('Recall successfully resolved.', 'success');
        fetchRecalls();
        if (viewingRecall?.id === recallId) {
          setViewingRecall(data.data);
        }
      }
    } catch (err) {
      console.error(err);
      triggerToast('Failed to resolve recall', 'error');
    }
  };

  const openRecallDetails = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/recalls/${id}`);
      const data = await res.json();
      if (data.data) {
        setViewingRecall(data.data);
      }
    } catch (err) {
      triggerToast('Failed to load recall detailed actions log', 'error');
    }
  };

  const toggleBatchChecked = (bid: string) => {
    setSelectedBatches(prev => 
      prev.includes(bid) ? prev.filter(x => x !== bid) : [...prev, bid]
    );
  };

  const exportContactCsv = (contactList: any[]) => {
    if (!contactList || contactList.length === 0) return;
    const header = 'Customer Name,Phone Number,Delivery Date,Affected SKUs\n';
    const rows = contactList.map(c => 
      `"${c.customer_name}","${c.phone}","${c.delivery_date}","${c.skus_affected.join('; ')}"`
    ).join('\n');
    
    navigator.clipboard.writeText(header + rows);
    triggerToast('Contact list copied to clipboard as CSV!', 'success');
  };

  // Metrics sums
  const activeCount = recalls.filter(r => r.status === 'active').length;
  const resolvedCount = recalls.filter(r => r.status === 'resolved').length;

  return (
    <div className="space-y-6">
      {/* Offline indicators */}
      {offline && (
        <div className="bg-rose-50 border border-rose-200 text-rose-955 text-xs p-3.5 rounded-xl flex items-center justify-between font-bold">
          <span>Connection offline â€” viewing local snapshot.</span>
          <button onClick={fetchRecalls} className="bg-white border border-rose-300 text-rose-800 px-3 py-1.5 rounded-lg min-h-[44px]">Retry</button>
        </div>
      )}

      {/* Summary dashboard widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Recalls Logged</p>
            <p className="text-2xl font-black text-slate-800 mt-1">{recalls.length}</p>
          </div>
          <div className="bg-slate-100 p-2.5 rounded-lg text-slate-600">
            <FileText className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-sans">Active Quarantine Cases</p>
            <p className="text-2xl font-black text-rose-600 mt-1">{activeCount}</p>
          </div>
          <div className="bg-rose-55 p-2.5 rounded-lg text-rose-600">
            <AlertTriangle className="h-5 w-5 animate-pulse" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resolved Incidents</p>
            <p className="text-2xl font-black text-emerald-600 mt-1">{resolvedCount}</p>
          </div>
          <div className="bg-emerald-55 p-2.5 rounded-lg text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Recall Header Area & Button */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-bold text-slate-900">Incident Recalls & Safety Isolation</h2>
          <p className="text-xs text-slate-500">Initiate, audit, and trace food safety quarantine recalls. Stock adjustments happen authoritatively.</p>
        </div>

        {/* Permission Lock Action */}
        <div className="relative group">
          <button
            onClick={() => {
              if (isManager) setIsInitiating(true);
            }}
            disabled={!isManager}
            className={`w-full sm:w-auto min-h-[44px] px-5 rounded-xl font-bold text-xs flex items-center justify-center space-x-2 transition ${
              isManager 
                ? 'bg-slate-950 text-white hover:bg-slate-800 shadow-sm' 
                : 'bg-slate-100 border border-slate-250 text-slate-400 cursor-not-allowed'
            }`}
          >
            {!isManager && <Lock className="h-3.5 w-3.5 text-slate-400" />}
            <Plus className="h-4 w-4" />
            <span>Initiate Recalls</span>
          </button>
          {!isManager && (
            <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block bg-slate-900 text-white text-[9px] py-1 px-2.5 rounded font-bold whitespace-nowrap shadow-md z-30">
              Permission Lock: Manager Role Required
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recalls table list list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xxs">
            <div className="bg-slate-50 border-b border-slate-150 p-4">
              <h3 className="text-xs font-black text-slate-700 uppercase tracking-wider">Recalls Incidents History</h3>
            </div>

            {loading ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-150 uppercase tracking-wider text-[9px]">
                      <th className="p-3">Recall ID</th>
                      <th className="p-3">Scope / Target</th>
                      <th className="p-3 text-center">Reason</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i} className="animate-pulse border-b border-slate-100">
                        <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-16"></div></td>
                        <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-28"></div></td>
                        <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-24 mx-auto"></div></td>
                        <td className="p-4"><div className="h-4 bg-slate-200 rounded-full w-14 mx-auto font-medium"></div></td>
                        <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-12 mx-auto"></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : recalls.length === 0 ? (
              <div className="p-12 text-center text-slate-400 text-xs italic">
                No food safety quarantine recalls recorded.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-400 font-bold border-b border-slate-150 uppercase tracking-wider text-[9px]">
                      <th className="p-3">Recall ID</th>
                      <th className="p-3">Scope / Target</th>
                      <th className="p-3 text-center">Reason</th>
                      <th className="p-3 text-center">Status</th>
                      <th className="p-3 text-center">Value</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {recalls.map((recall) => (
                      <tr 
                        key={recall.id}
                        onClick={() => openRecallDetails(recall.id)}
                        className={`cursor-pointer hover:bg-slate-50 transition ${
                          viewingRecall?.id === recall.id ? 'bg-slate-50/70 border-l-4 border-indigo-500' : ''
                        }`}
                      >
                        <td className="p-3">
                          <p className="font-bold text-slate-900">{recall.id}</p>
                          <p className="text-[9px] text-slate-400">By {recall.initiated_by}</p>
                        </td>
                        <td className="p-3">
                          <span className="capitalize font-mono bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-[10px]">
                            {recall.scope}
                          </span>
                          <p className="text-[10px] text-slate-500 mt-1">
                            {recall.scope === 'sku' && recall.sku_id}
                            {recall.scope === 'supplier' && recall.supplier_id}
                            {recall.scope === 'batch' && `${recall.batch_ids?.length} batches`}
                          </p>
                        </td>
                        <td className="p-3 text-center text-[10px] text-slate-600">
                          {recall.reason}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                            recall.status === 'resolved' 
                              ? 'bg-emerald-100 text-emerald-800'
                              : recall.status === 'active'
                              ? 'bg-rose-100 text-rose-800 animate-pulse'
                              : recall.status === 'resolving'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {recall.status}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-500 text-[10px]">
                          KES {(recall.exposure_snapshot?.estimated_value_cents / 100).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Selected Recall detail panel */}
        <div className="lg:col-span-1">
          {viewingRecall ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-3xs">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-black text-slate-900">{viewingRecall.id}</h3>
                  <p className="text-[10px] text-slate-400">Incident detailed report</p>
                </div>
                <button 
                  onClick={() => setViewingRecall(null)}
                  className="p-1 text-slate-400 hover:text-slate-600 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Status block info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                  <span className="text-[8px] font-bold text-slate-400 block uppercase">Disposition</span>
                  <span className="text-xs font-bold text-slate-705 block capitalize mt-0.5">{viewingRecall.disposition.replace('_', ' ')}</span>
                </div>
                <div className="bg-slate-50 border border-slate-150 rounded-lg p-3">
                  <span className="text-[8px] font-bold text-slate-400 block uppercase">Created</span>
                  <span className="text-xs font-mono text-slate-705 block mt-0.5">{viewingRecall.created_at.slice(0,10)}</span>
                </div>
              </div>

              {/* Exposure Snapshots */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Exposure Snapshot</h4>
                <div className="bg-slate-905 text-white rounded-xl p-4 space-y-3">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Total Stock Written-Off</span>
                    <span className="font-bold font-mono">{viewingRecall.exposure_snapshot?.units_in_stock} Units</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">In Transit Recalled</span>
                    <span className="font-bold font-mono">{viewingRecall.exposure_snapshot?.units_in_transit} Units</span>
                  </div>
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-400">Delivered Units Impacted</span>
                    <span className="font-bold font-mono">{viewingRecall.exposure_snapshot?.units_delivered} Units</span>
                  </div>
                  <div className="flex justify-between items-center text-xs border-t border-slate-800 pt-2 text-rose-300 font-bold">
                    <span>{currencyCode} at Risk / Isolated</span>
                    <span className="font-mono">KES {(viewingRecall.exposure_snapshot?.estimated_value_cents / 100).toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Action logs timeline */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Automated Operations Log</h4>
                <div className="bg-slate-50 rounded-xl p-3.5 space-y-3 text-xs border border-slate-150">
                  {viewingRecall.recall_actions && viewingRecall.recall_actions.length > 0 ? (
                    <div className="relative pl-4 border-l border-slate-200 space-y-4">
                      {viewingRecall.recall_actions.map((act: any) => {
                        const isStock = act.action_type === 'STOCK_REMOVED';
                        const isCancel = act.action_type === 'PICKLIST_CANCELLED';
                        const isDriver = act.action_type === 'DRIVER_RECALLED';
                        const isContact = act.action_type === 'CONTACT_LIST_GENERATED';
                        const isClaim = act.action_type === 'SUPPLIER_CLAIM_RAISED';

                        const isDone = act.status === 'done';

                        return (
                          <div key={act.id} className="relative space-y-1">
                            {/* Dot indicator */}
                            <span className={`absolute -left-[21px] top-1 p-0.5 rounded-full ${isDone ? 'bg-indigo-500' : 'bg-rose-500'}`}>
                              <span className="h-1.5 w-1.5 block bg-white rounded-full" />
                            </span>
                            <div className="flex justify-between items-center">
                              <span className="font-extrabold text-[9px] text-slate-800 uppercase tracking-wide">
                                {act.action_type.replace('_', ' ')}
                              </span>
                              <span className={`text-[8px] font-extrabold uppercase px-1 rounded ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                {act.status}
                              </span>
                            </div>
                            <p className="text-[10px] text-slate-500 leading-relaxed font-semibold">{act.description}</p>
                            {!isDone && (
                              <p className="text-[9px] text-rose-600 font-bold italic mt-0.5">âš ï¸ Retry manually needed.</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400 italic text-center py-2">No actions logs generated yet.</p>
                  )}
                </div>
              </div>

              {/* Customer Contact List */}
              {viewingRecall.customers_to_contact && viewingRecall.customers_to_contact.length > 0 && (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Impacted Customers</h4>
                    <button
                      onClick={() => exportContactCsv(viewingRecall.customers_to_contact)}
                      className="text-[9px] font-extrabold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1 min-h-[44px] px-2"
                    >
                      <FileSpreadsheet className="h-3 w-3" />
                      <span>Export CSV</span>
                    </button>
                  </div>
                  <div className="bg-white border border-slate-150 rounded-xl overflow-x-auto max-h-48 overflow-y-auto">
                    <table className="w-full text-left text-[10px] border-collapse">
                      <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider text-[8px] sticky top-0">
                        <tr>
                          <th className="p-2">Customer</th>
                          <th className="p-2">Phone</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {viewingRecall.customers_to_contact.map((c: any) => (
                          <tr key={c.customer_id} className="hover:bg-slate-50">
                            <td className="p-2 font-bold text-slate-800">{c.customer_name}</td>
                            <td className="p-2 font-mono">{c.phone}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Resolve incident action */}
              {viewingRecall.status === 'active' && isManager && (
                <button
                  onClick={() => handleResolveRecall(viewingRecall.id)}
                  className="w-full min-h-[44px] bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition"
                >
                  Resolve Incident Quarantine
                </button>
              )}
            </div>
          ) : (
            <div className="bg-slate-50 border border-slate-150 border-dashed rounded-xl p-8 text-center text-slate-400 text-xs italic">
              Select any recall incident to inspect automated operational timelines, exposure risks, and generate safety checklists.
            </div>
          )}
        </div>
      </div>

      {/* Initiation Modal */}
      {isInitiating && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-xl w-full border border-slate-105 shadow-xl space-y-5">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Initiate Safety Recall</h3>
                <p className="text-[10px] text-slate-400">Step {formStep} of 2 â€” {formStep === 1 ? 'Configure Scope' : 'Confirm Exposure'}</p>
              </div>
              <button 
                onClick={() => setIsInitiating(false)}
                className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {formStep === 1 ? (
              <form onSubmit={handleInitiateDraft} className="space-y-4 text-xs font-semibold text-slate-700">
                {/* Scope Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Select Scope</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['sku', 'batch', 'supplier'].map((type: any) => (
                      <label 
                        key={type} 
                        className={`border rounded-xl p-3 flex flex-col items-center justify-center cursor-pointer transition ${
                          scope === type ? 'border-slate-950 bg-slate-50 text-slate-950 font-bold' : 'border-slate-200 text-slate-500 hover:bg-slate-50/50'
                        }`}
                      >
                        <input 
                          type="radio" 
                          name="scope" 
                          value={type} 
                          checked={scope === type} 
                          onChange={() => setScope(type)}
                          className="sr-only"
                        />
                        <span className="capitalize">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Conditional dropdowns */}
                {scope === 'sku' && (
                  <div className="flex flex-col space-y-1">
                    <label>Select Target SKU</label>
                    <select
                      value={selectedSku}
                      onChange={(e) => setSelectedSku(e.target.value)}
                      required
                      className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-hidden min-h-[44px]"
                    >
                      <option value="">-- Choose SKU --</option>
                      {skus.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                      ))}
                    </select>
                  </div>
                )}

                {scope === 'supplier' && (
                  <div className="flex flex-col space-y-1">
                    <label>Select Target Supplier</label>
                    <select
                      value={selectedSupplier}
                      onChange={(e) => setSelectedSupplier(e.target.value)}
                      required
                      className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-hidden min-h-[44px]"
                    >
                      <option value="">-- Choose Supplier --</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {scope === 'batch' && (
                  <div className="space-y-2">
                    <label>Check All Target Batches</label>
                    <div className="border border-slate-200 rounded-xl max-h-40 overflow-y-auto p-2 bg-slate-50 space-y-2">
                      {batches.length === 0 ? (
                        <p className="text-slate-400 italic p-2 text-center text-[11px]">No active batches found</p>
                      ) : (
                        batches.map(b => (
                          <label key={b.id} className="flex items-center space-x-2.5 p-1.5 hover:bg-slate-100 rounded-lg cursor-pointer transition">
                            <input
                              type="checkbox"
                              checked={selectedBatches.includes(b.id)}
                              onChange={() => toggleBatchChecked(b.id)}
                              className="h-4 w-4 bg-white rounded border border-slate-350 outline-hidden"
                            />
                            <div className="text-[10px]">
                              <p className="font-bold text-slate-800">{b.batch_number} ({b.sku_name})</p>
                              <p className="text-[9px] text-slate-400">Exp: {b.expiry_date.slice(0,10)} | Avail: {b.quantity_available}</p>
                            </div>
                          </label>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Reason & Disposition */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col space-y-1">
                    <label>Reason for Recall</label>
                    <select
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-hidden min-h-[44px]"
                    >
                      <option value="HEALTH_SAFETY">Health & Safety Threat</option>
                      <option value="QUALITY">Quality Defect</option>
                      <option value="SUPPLIER_DIRECTIVE">Supplier Directive</option>
                      <option value="CONTAMINATION">Contamination Alert</option>
                      <option value="REGULATORY">Regulatory Compliance</option>
                    </select>
                  </div>

                  <div className="flex flex-col space-y-1">
                    <label>Operations Disposition</label>
                    <select
                      value={disposition}
                      onChange={(e) => setDisposition(e.target.value)}
                      className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 outline-hidden min-h-[44px]"
                    >
                      <option value="hold">Quarantine Hold</option>
                      <option value="destroy">Absolute Destruction</option>
                      <option value="return_to_supplier">Return to Supplier</option>
                    </select>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full min-h-[44px] bg-slate-900 hover:bg-slate-855 text-white rounded-xl font-bold flex items-center justify-center space-x-2 shadow-xs cursor-pointer transition"
                  >
                    <span>Generate Exposure Preview</span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </form>
            ) : (
              <div className="space-y-4">
                <div className="bg-rose-50 border border-rose-250 rounded-xl p-4 flex items-start space-x-3 text-rose-955 text-xs">
                  <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1 font-semibold leading-relaxed">
                    <p className="font-bold">This safety recall action cannot be undone.</p>
                    <p className="text-rose-800">
                      Confirming will immediately write off all matching matching stock from the authoritative ledger, cancel pending pick lines, and instruct active delivery drivers with this stock to return back to warehouse.
                    </p>
                  </div>
                </div>

                {/* Exposure Snapshot stats preview */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <div className="bg-slate-50 border p-3 rounded-xl text-center">
                    <span className="text-[9px] text-slate-400 block font-bold transition uppercase">Units in Stock</span>
                    <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{draftRecall?.exposure_snapshot?.units_in_stock}</span>
                  </div>
                  <div className="bg-slate-50 border p-3 rounded-xl text-center">
                    <span className="text-[9px] text-slate-400 block font-bold transition uppercase">Units In-Transit</span>
                    <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{draftRecall?.exposure_snapshot?.units_in_transit}</span>
                  </div>
                  <div className="bg-slate-50 border p-3 rounded-xl text-center">
                    <span className="text-[9px] text-slate-400 block font-bold transition uppercase">Units Delivered</span>
                    <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{draftRecall?.exposure_snapshot?.units_delivered}</span>
                  </div>
                  <div className="bg-slate-50 border p-3 rounded-xl text-center">
                    <span className="text-[9px] text-slate-400 block font-bold transition uppercase">Affected Customers</span>
                    <span className="text-sm font-black text-slate-800 font-mono mt-0.5 block">{draftRecall?.exposure_snapshot?.customers_affected}</span>
                  </div>
                  <div className="bg-slate-900 border p-3 rounded-xl text-center text-white col-span-2">
                    <span className="text-[9px] text-slate-400 block font-bold transition uppercase">Isolated Value</span>
                    <span className="text-sm font-black text-teal-350 font-mono mt-0.5 block">KES {(draftRecall?.exposure_snapshot?.estimated_value_cents / 100).toLocaleString()}</span>
                  </div>
                </div>

                <div className="flex gap-4 pt-2">
                  <button
                    onClick={() => {
                      setDraftRecall(null);
                      setFormStep(1);
                      setIsInitiating(false);
                      triggerToast('Quarantine recall cancelled.', 'info');
                    }}
                    className="w-1/2 min-h-[44px] border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-xl text-xs cursor-pointer transition"
                  >
                    Cancel Draft
                  </button>
                  <button
                    onClick={handleConfirmRecall}
                    disabled={submittingConfirm}
                    className="w-1/2 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer transition disabled:opacity-50"
                  >
                    {submittingConfirm && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                    <span>Confirm Safety Recall</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

