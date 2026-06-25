import React, { useState, useEffect } from 'react';
import { 
  Warehouse, 
  SKU, 
  Location, 
  User, 
  LoadingManifest, 
  ReplenishmentRule, 
  CycleCountSuggestion 
} from '../types';
import { 
  Truck, 
  Thermometer, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Plus, 
  Edit, 
  Trash, 
  Compass, 
  FileText, 
  ChevronRight, 
  Printer, 
  ArrowUpDown, 
  RefreshCw, 
  Eye, 
  Check, 
  ClipboardCheck, 
  Sparkles,
  MapPin,
  Calendar,
  AlertOctagon
} from 'lucide-react';

interface TransferLogisticsProps {
  warehouses: Warehouse[];
  locations: Location[];
  skus: SKU[];
  currentUser: User | null;
  triggerRefresh: () => void;
  refreshFlag: number;
}

export default function TransferLogistics({ warehouses, locations, skus, currentUser, triggerRefresh, refreshFlag }: TransferLogisticsProps) {
  // Active Logistics sub-view: rules, manifests, receiving, cycle_suggestions
  const [activeLogisticsTab, setActiveLogisticsTab] = useState<'rules' | 'manifests' | 'logs'>('rules');

  // Rules State
  const [rules, setRules] = useState<any[]>([]);
  const [isLoadingRules, setIsLoadingRules] = useState(false);
  const [ruleForm, setRuleForm] = useState({
    id: '',
    sku_id: skus[0]?.id || '',
    warehouse_id: 'RGN',
    min_qty: 10,
    max_qty: 100,
    reorder_qty: 50
  });
  const [isEditingRule, setIsEditingRule] = useState(false);
  const [isCreatingRule, setIsCreatingRule] = useState(false);

  // Manifests State
  const [manifests, setManifests] = useState<any[]>([]);
  const [selectedManifest, setSelectedManifest] = useState<any | null>(null);
  const [availableTransfersToManifest, setAvailableTransfersToManifest] = useState<any[]>([]);
  const [isLoadingManifests, setIsLoadingManifests] = useState(false);
  const [showDispatchConfirm, setShowDispatchConfirm] = useState(false);

  // Create Manifest State
  const [isCreatingManifest, setIsCreatingManifest] = useState(false);
  const [manifestForm, setManifestForm] = useState({
    type: 'replenishment' as 'replenishment' | 'delivery',
    warehouse_from_id: 'RGN',
    warehouse_to_id: 'RGL',
    carrier_name: 'Lumara Logistics',
    driver_name: 'Mzee Mwangi',
    vehicle_registration: 'KCC 123X',
    dispatched_temp_celsius: 4.0
  });

  // Receiving state
  const [receivingLine, setReceivingLine] = useState<any | null>(null);
  const [receiveForm, setReceiveForm] = useState({
    qty_accepted: 0,
    qty_rejected: 0,
    rejection_reason: '' as any,
    disposition: '' as any,
    actual_sku_id: '',
    cargo_temp_celsius: 4.0
  });

  // Cycle Counts state
  const [suggestions, setSuggestions] = useState<any[]>([]);

  // System Messages
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);

  // Temp logs state
  const [liveTempLogs, setLiveTempLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchRules();
    fetchManifests();
    fetchSuggestions();
    fetchLiveTempLogs();
  }, [refreshFlag, activeLogisticsTab]);

  const triggerToast = (msg: string, type: 'success' | 'error') => {
    if (type === 'success') {
      setSuccessText(msg);
      setErrorText(null);
    } else {
      setErrorText(msg);
      setSuccessText(null);
    }
    setTimeout(() => {
      setSuccessText(null);
      setErrorText(null);
    }, 5000);
  };

  // ==========================================
  // RULES MANAGEMENT
  // ==========================================
  const fetchRules = async () => {
    setIsLoadingRules(true);
    try {
      const res = await fetch('/api/v1/replenishment-rules');
      const payload = await res.json();
      if (payload.data) {
        setRules(payload.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingRules(false);
    }
  };

  const handleSaveRule = async (e: React.FormEvent) => {
    e.preventDefault();
    const url = isEditingRule 
      ? `/api/v1/replenishment-rules/${ruleForm.id}` 
      : '/api/v1/replenishment-rules';
    const method = isEditingRule ? 'PATCH' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sku_id: ruleForm.sku_id,
          warehouse_id: ruleForm.warehouse_id,
          min_qty: Number(ruleForm.min_qty),
          max_qty: Number(ruleForm.max_qty),
          reorder_qty: Number(ruleForm.reorder_qty)
        })
      });
      const data = await res.json();

      if (data.error) {
        triggerToast(data.error.message || 'Error saving rule', 'error');
      } else {
        triggerToast(`Replenishment rule successfully ${isEditingRule ? 'updated' : 'created'}!`, 'success');
        setIsEditingRule(false);
        setIsCreatingRule(false);
        fetchRules();
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Network failure saving rule', 'error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    if (!window.confirm('Delete this par-level replenishment rule?')) return;
    try {
      const res = await fetch(`/api/v1/replenishment-rules/${ruleId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast('Replenishment rule deleted.', 'success');
        fetchRules();
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Error connecting to server', 'error');
    }
  };

  const triggerReplenishmentRun = async (rule: any) => {
    try {
      const payload = {
        from_warehouse_id: rule.warehouse_id === 'RGN' ? 'RGL' : 'RGN',
        to_warehouse_id: rule.warehouse_id,
        transfer_scope: 'replenishment',
        notes: `Auto Replenish [PAR BREAK] SKU: ${rule.sku_id}`,
        lines: [
          {
            sku_id: rule.sku_id,
            qty_requested: rule.reorder_qty,
            // Sourced location logic handles placeholder
            from_location_id: rule.warehouse_id === 'RGN' ? 'L-RGL-CHL-01' : 'L-RGN-CHL-01',
            to_location_id: rule.warehouse_id === 'RGN' ? 'L-RGN-CHL-01' : 'L-RGL-CHL-01'
          }
        ]
      };

      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        triggerToast(data.error.message || 'Unable to start replenishment movement.', 'error');
      } else {
        triggerToast(`FPO Replenishment Transfer ${data.data.replenishment_order_number} raised automatically for ${rule.reorder_qty} units!`, 'success');
        fetchRules();
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Connection failure auto-generating transfer.', 'error');
    }
  };

  // ==========================================
  // MANIFESTS & ROUTING DISPATCH
  // ==========================================
  const fetchManifests = async () => {
    setIsLoadingManifests(true);
    try {
      const res = await fetch('/api/v1/manifests');
      const payload = await res.json();
      if (payload.data) {
        setManifests(payload.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingManifests(false);
    }
  };

  const fetchUnmanifestedTransfers = async (fromWH: string, toWH: string) => {
    try {
      const res = await fetch('/api/v1/transfers');
      const payload = await res.json();
      if (payload.data) {
        // filter transfers with matching route, of replenishment scope, which are not already associated with a manifest
        const filtered = payload.data.filter((t: any) => 
          t.from_warehouse_id === fromWH && 
          t.to_warehouse_id === toWH &&
          t.transfer_scope === 'replenishment' &&
          !t.manifest_id &&
          t.status === 'pending_approval' // loaded prior to packing
        );
        setAvailableTransfersToManifest(filtered);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectManifest = async (m: any) => {
    try {
      const res = await fetch(`/api/v1/manifests/${m.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedManifest(payload.data);
        fetchUnmanifestedTransfers(payload.data.warehouse_from_id, payload.data.warehouse_to_id);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateManifest = async (e: React.FormEvent) => {
    e.preventDefault();
    const endpoint = '/api/v1/manifests/replenishment';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(manifestForm)
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast(`Manifest ${data.data.id} created successfully!`, 'success');
        setIsCreatingManifest(false);
        fetchManifests();
        handleSelectManifest(data.data);
      }
    } catch (err) {
      triggerToast('Server failure creating manifest', 'error');
    }
  };

  const handleAddFPOToManifest = async (transferId: string) => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/add-fpo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_id: transferId })
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast('FPO added to loading manifest.', 'success');
        handleSelectManifest(selectedManifest);
      }
    } catch (err) {
      triggerToast('Server link failed', 'error');
    }
  };

  const handleRemoveFPOFromManifest = async (transferId: string) => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/remove-fpo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_id: transferId })
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast('FPO removed from manifest.', 'success');
        handleSelectManifest(selectedManifest);
      }
    } catch (err) {
      triggerToast('Server link failed', 'error');
    }
  };

  const handlePackTransfer = async (transferId: string) => {
    try {
      const res = await fetch(`/api/v1/transfers/${transferId}/pack`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packed_by: currentUser?.id || 'OPS' })
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast('Transfer packed and security sealed.', 'success');
        if (selectedManifest) handleSelectManifest(selectedManifest);
      }
    } catch (err) {
      triggerToast('Packing register error', 'error');
    }
  };

  const handleDispatchManifest = async () => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/dispatch`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message || 'Dispatch checks failed', 'error');
      } else {
        triggerToast(`Manifest dispatched! Vehicles approved and cargo seal committed.`, 'success');
        handleSelectManifest(selectedManifest);
        fetchManifests();
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Error during dispatch trigger', 'error');
    }
  };

  const handleOpenReceiving = async () => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/open-receiving`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast('Manifest status updated to receiving. Ready to record quantities.', 'success');
        handleSelectManifest(selectedManifest);
        fetchManifests();
      }
    } catch (err) {
      triggerToast('Error updating status', 'error');
    }
  };

  // ==========================================
  // RECEIVING WORKFLOW (WITH REJECTIONS/DISPOSITIONS)
  // ==========================================
  const initiateReceiveLine = (line: any) => {
    setReceivingLine(line);
    setReceiveForm({
      qty_accepted: line.qty_requested,
      qty_rejected: 0,
      rejection_reason: '',
      disposition: '',
      actual_sku_id: line.sku_id,
      cargo_temp_celsius: selectedManifest?.dispatched_temp_celsius || 4.2
    });
  };

  const handleCommitReceiveLine = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedManifest || !receivingLine) return;

    const payload = {
      manifest_line_id: receivingLine.id,
      qty_accepted: Number(receiveForm.qty_accepted),
      qty_rejected: Number(receiveForm.qty_rejected),
      rejection_reason: receiveForm.qty_rejected > 0 ? receiveForm.rejection_reason : undefined,
      disposition: receiveForm.qty_rejected > 0 ? receiveForm.disposition : undefined,
      actual_sku_id: receiveForm.qty_rejected > 0 && receiveForm.disposition === 'ACCEPT_AS_RECEIVED' ? receiveForm.actual_sku_id : undefined,
      cargo_temp_celsius: Number(receiveForm.cargo_temp_celsius)
    };

    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/receive-line`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        triggerToast(data.error.message || 'Receiving line error', 'error');
      } else {
        let msg = `Line successfully counted!`;
        if (data.warning) msg += ` WARNING: ${data.warning}`;
        triggerToast(msg, 'success');
        setReceivingLine(null);
        handleSelectManifest(selectedManifest);
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Connection failure receiving line item.', 'error');
    }
  };

  const handleCloseFPO = async (transferId: string) => {
    if (!selectedManifest) return;
    try {
      const res = await fetch(`/api/v1/manifests/${selectedManifest.id}/close-fpo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfer_id: transferId })
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message || 'Closure failed', 'error');
      } else {
        triggerToast(`FPO closed successfully and secure reports drafted.`, 'success');
        handleSelectManifest(selectedManifest);
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Network failure closing FPO', 'error');
    }
  };

  const handleAcknowledgeClosure = async (transferId: string) => {
    try {
      const res = await fetch(`/api/v1/transfers/${transferId}/acknowledge-closure`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast(`FPO closure acknowledged! Reverse return manifest created if rejections are pending.`, 'success');
        if (selectedManifest) handleSelectManifest(selectedManifest);
      }
    } catch (err) {
      triggerToast('Acknowledgment error', 'error');
    }
  };

  // ==========================================
  // DISCREPANCIES & SUGGESTIONS
  // ==========================================
  const fetchSuggestions = async () => {
    try {
      const res = await fetch('/api/v1/cycle-count-suggestions');
      const payload = await res.json();
      if (payload.data) {
        setSuggestions(payload.data);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleActionSuggestion = async (id: string, actionType: 'queue_physical' | 'ignore') => {
    try {
      const res = await fetch(`/api/v1/cycle-count-suggestions/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action_type: actionType })
      });
      const data = await res.json();
      if (data.error) {
        triggerToast(data.error.message, 'error');
      } else {
        triggerToast(
          actionType === 'queue_physical' 
            ? 'Discrepancy counted. New Physical Cycle Count task dispatched into auditor queue!' 
            : 'Discrepancy ignored and resolved.', 
          'success'
        );
        fetchSuggestions();
        triggerRefresh();
      }
    } catch (err) {
      triggerToast('Error updating status', 'error');
    }
  };

  // ==========================================
  // TEMPERATURE STREAM SIMULATION
  // ==========================================
  const fetchLiveTempLogs = async () => {
    // Generate simple mock active transit telemetry
    const list = [
      { id: 'TL-88', route: 'Regen (RGN) to Regal (RGL)', temp: 4.1, status: 'nominal', timestamp: 'Just now' },
      { id: 'TL-82', route: 'Regal (RGL) to Regal Putaway', temp: 1.8, status: 'nominal', timestamp: '5m ago' },
      { id: 'TL-81', route: 'Regen Main (RGN) to Cold Room', temp: -18.2, status: 'nominal', timestamp: '12m ago' },
      { id: 'TL-79', route: 'Unknown', temp: 8.4, status: 'warning', timestamp: '1h ago', reason: 'Abuse near loading dock' }
    ];
    setLiveTempLogs(list);
  };

  return (
    <div className="space-y-6">
      {/* Toast Alert Banner */}
      {successText && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 text-xs flex items-start space-x-2 animate-fadeIn shadow-sm">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold">Logistics Clear</p>
            <p>{successText}</p>
          </div>
        </div>
      )}

      {errorText && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 text-xs flex items-start space-x-2 animate-fadeIn shadow-sm">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="space-y-0.5">
            <p className="font-bold">Logistics Hazard Flagged</p>
            <p>{errorText}</p>
          </div>
        </div>
      )}

      {/* Main Sub Tab Selector */}
      <div className="flex border-b border-slate-200 max-w-lg">
        <button
          onClick={() => { setActiveLogisticsTab('rules'); setSelectedManifest(null); }}
          className={`flex items-center space-x-2 p-3 font-medium text-xs border-b-2 transition-all ${
            activeLogisticsTab === 'rules' 
              ? 'border-slate-900 text-slate-950 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Replenishment Par Rules</span>
        </button>

        <button
          onClick={() => { setActiveLogisticsTab('manifests'); }}
          className={`flex items-center space-x-2 p-3 font-medium text-xs border-b-2 transition-all ${
            activeLogisticsTab === 'manifests' 
              ? 'border-slate-900 text-slate-950 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Truck className="h-4 w-4" />
          <span>Intra-Depot Manifests</span>
        </button>

        <button
          onClick={() => { setActiveLogisticsTab('logs'); }}
          className={`flex items-center space-x-2 p-3 font-medium text-xs border-b-2 transition-all ${
            activeLogisticsTab === 'logs' 
              ? 'border-slate-900 text-slate-950 font-bold' 
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          <Compass className="h-4 w-4" />
          <span>Audit & Suggestions</span>
        </button>
      </div>

      {/* VIEW: REPLENISHMENT RULES */}
      {activeLogisticsTab === 'rules' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 bg-white border border-slate-200 p-5 rounded-xl">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="h-4 w-4 text-slate-600" />
                Inter-Site Stock Par Levels
              </h2>
              <p className="text-xs text-slate-500">Configure safety thresholds at each warehouse to enforce automatic inventory replenishment.</p>
            </div>
            
            <button
              onClick={() => {
                setIsEditingRule(false);
                setRuleForm({ id: '', sku_id: skus[0]?.id || '', warehouse_id: 'RGN', min_qty: 10, max_qty: 100, reorder_qty: 50 });
                setIsCreatingRule(true);
              }}
              className="flex items-center space-x-1 px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors cursor-pointer self-start sm:self-center"
            >
              <Plus className="h-4 w-4" />
              <span>Configure Par Level</span>
            </button>
          </div>

          {/* Rule Creator / Editor Panel inline */}
          {(isCreatingRule || isEditingRule) && (
            <form onSubmit={handleSaveRule} className="bg-slate-900 text-white border border-slate-800 p-5 rounded-xl space-y-4 text-xs animate-fadeIn">
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span className="font-bold text-teal-400 uppercase tracking-wider">{isEditingRule ? 'Edit Replenishment Threshold' : 'Configure New Par Threshold'}</span>
                <button type="button" onClick={() => { setIsCreatingRule(false); setIsEditingRule(false); }} className="text-slate-400 hover:text-white font-bold">Cancel</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Target SKU Product</label>
                  <select
                    value={ruleForm.sku_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, sku_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white font-medium"
                    disabled={isEditingRule}
                  >
                    {skus.map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Warehouse Depot</label>
                  <select
                    value={ruleForm.warehouse_id}
                    onChange={(e) => setRuleForm({ ...ruleForm, warehouse_id: e.target.value })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white font-medium"
                    disabled={isEditingRule}
                  >
                    {warehouses.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Safety Min Qty</label>
                  <input
                    type="number"
                    value={ruleForm.min_qty}
                    onChange={(e) => setRuleForm({ ...ruleForm, min_qty: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Optimum Max Qty</label>
                  <input
                    type="number"
                    value={ruleForm.max_qty}
                    onChange={(e) => setRuleForm({ ...ruleForm, max_qty: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Reorder Push Qty</label>
                  <input
                    type="number"
                    value={ruleForm.reorder_qty}
                    onChange={(e) => setRuleForm({ ...ruleForm, reorder_qty: parseInt(e.target.value) || 0 })}
                    className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button type="submit" className="px-5 py-2 bg-teal-500 text-slate-950 hover:bg-teal-400 transition-colors rounded-lg font-bold">
                  {isEditingRule ? 'Commit Rule Update' : 'Initialize Par Level Rule'}
                </button>
              </div>
            </form>
          )}

          {/* Rules List (Bento-styled Cards) */}
          {isLoadingRules ? (
            <div className="text-center py-12 text-slate-400 text-xs">Loading par-level rules...</div>
          ) : rules.length === 0 ? (
            <div className="bg-white border border-slate-200 p-12 text-center text-slate-400 rounded-xl">
              <Layers className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="font-bold text-slate-700 text-xs">No Safety Par Levels Configured</p>
              <p className="text-xs">Define a limit rule to unlock auto-transfer capabilities.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rules.map((rule) => {
                const skuItem = skus.find(s => s.id === rule.sku_id);
                // Simple warning check comparing current quantity (we can simulate based on state logic)
                const currentQty = rule.current_qty !== undefined ? rule.current_qty : Math.floor(Math.random() * 40 + 5); 
                const isViolated = currentQty < rule.min_qty;

                return (
                  <div key={rule.id} className={`bg-white border text-slate-800 rounded-xl p-5 space-y-4 shadow-xs transition-all ${
                    isViolated ? 'border-amber-400 bg-amber-50/10' : 'border-slate-200'
                  }`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] uppercase font-bold text-slate-600 block w-max mb-1">
                          Depot: {rule.warehouse_id}
                        </span>
                        <h3 className="text-xs font-black text-slate-950">{skuItem ? skuItem.name : rule.sku_id}</h3>
                        <p className="text-[10px] text-slate-400">SKU Code: {rule.sku_id}</p>
                      </div>

                      {isViolated ? (
                        <span className="flex items-center space-x-1 text-amber-600 bg-amber-55 font-bold p-1 px-2 rounded-lg text-[10px] uppercase animate-pulse">
                          <AlertTriangle className="h-3.5 w-3.5" />
                          <span>LOW STOCK</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-emerald-600 bg-emerald-50 font-bold p-1 px-2 rounded-lg text-[10px] uppercase">
                          <Check className="h-3.5 w-3.5" />
                          <span>NOMINAL</span>
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-slate-50 p-2.5 rounded-lg text-center font-mono">
                      <div className="border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 block font-sans">Safety Min</span>
                        <span className="text-xs font-bold text-slate-900">{rule.min_qty}</span>
                      </div>
                      <div className="border-r border-slate-200">
                        <span className="text-[9px] text-slate-400 block font-sans">Silo Curr</span>
                        <span className={`text-xs font-bold ${isViolated ? 'text-amber-600 font-extrabold' : 'text-slate-900'}`}>
                          {currentQty}
                        </span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-sans">Max Par</span>
                        <span className="text-xs font-bold text-slate-900">{rule.max_qty}</span>
                      </div>
                    </div>

                    {isViolated && (
                      <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[10px] leading-relaxed text-amber-900">
                        Current stock is <b className="font-extrabold">{rule.min_qty - currentQty} units</b> below the safe threshold bounds index.
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setRuleForm({ ...rule });
                            setIsEditingRule(true);
                            setIsCreatingRule(false);
                          }}
                          className="p-1 px-2 text-slate-600 hover:text-slate-950 font-semibold"
                          title="Edit rule config"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteRule(rule.id)}
                          className="p-1 px-2 text-slate-400 hover:text-rose-600 font-semibold"
                          title="Delete rule"
                        >
                          <Trash className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {isViolated ? (
                        <button
                          onClick={() => triggerReplenishmentRun(rule)}
                          className="flex items-center space-x-1 p-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-2.5 rounded-lg"
                        >
                          <Sparkles className="h-3 w-3 shrink-0 text-slate-900" />
                          <span>Auto-Replenish</span>
                        </button>
                      ) : (
                        <span className="text-[9px] text-slate-400 italic font-mono">Target Reorder: +{rule.reorder_qty}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW: INTRA-DEPOT MANIFESTS */}
      {activeLogisticsTab === 'manifests' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Manifest Tracker Card List */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <Truck className="h-5 w-5 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900">Routing Manifests</h2>
              </div>
              <button
                onClick={() => {
                  setIsCreatingManifest(true);
                  setSelectedManifest(null);
                }}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Slip</span>
              </button>
            </div>

            {isCreatingManifest ? (
              <form onSubmit={handleCreateManifest} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-4 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-1">
                  <span className="font-bold text-slate-800">Dispatch Route Loader</span>
                  <button type="button" onClick={() => setIsCreatingManifest(false)} className="text-slate-400 font-bold hover:text-slate-600">Cancel</button>
                </div>

                <div>
                  <label className="block text-slate-400 mb-0.5">Route Scope</label>
                  <select
                    value={manifestForm.type}
                    onChange={(e) => setManifestForm({ ...manifestForm, type: e.target.value as any })}
                    className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                  >
                    <option value="replenishment">Replenishment Transfer (FPO)</option>
                    <option value="delivery">Outbound Delivery Order</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5">Origin</label>
                    <select
                      value={manifestForm.warehouse_from_id}
                      onChange={(e) => setManifestForm({ ...manifestForm, warehouse_from_id: e.target.value })}
                      className="w-full bg-white border border-slate-250 p-1.5 rounded-lg font-bold"
                    >
                      <option value="RGN">Regen Main</option>
                      <option value="RGL">Regal Depot</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5">Destination</label>
                    <select
                      value={manifestForm.warehouse_to_id}
                      onChange={(e) => setManifestForm({ ...manifestForm, warehouse_to_id: e.target.value })}
                      className="w-full bg-white border border-slate-250 p-1.5 rounded-lg font-bold"
                    >
                      <option value="RGL">Regal Depot</option>
                      <option value="RGN">Regen Main</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-0.5">Carrier Service Provider</label>
                  <input
                    type="text"
                    value={manifestForm.carrier_name}
                    onChange={(e) => setManifestForm({ ...manifestForm, carrier_name: e.target.value })}
                    className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5">Driver</label>
                    <input
                      type="text"
                      value={manifestForm.driver_name}
                      onChange={(e) => setManifestForm({ ...manifestForm, driver_name: e.target.value })}
                      className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-450 mb-0.5">Vehicle Reg No</label>
                    <input
                      type="text"
                      value={manifestForm.vehicle_registration}
                      onChange={(e) => setManifestForm({ ...manifestForm, vehicle_registration: e.target.value })}
                      className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 mb-0.5">Departure Seal Temp (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={manifestForm.dispatched_temp_celsius}
                    onChange={(e) => setManifestForm({ ...manifestForm, dispatched_temp_celsius: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-white border border-slate-250 p-1.5 rounded-lg text-center"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full p-2.5 bg-slate-900 border border-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                >
                  Create Loading Manifest
                </button>
              </form>
            ) : (
              <div className="space-y-2 max-h-[450px] overflow-y-auto">
                {isLoadingManifests ? (
                  <p className="text-center text-slate-400 py-6 text-xs font-mono animate-pulse">Loading manifests...</p>
                ) : manifests.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-1">
                    <Truck className="h-6 w-6 text-slate-200" />
                    <p className="font-bold text-xs text-slate-700">No active manifests drafted.</p>
                  </div>
                ) : (
                  manifests.map(m => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectManifest(m)}
                      className={`p-3 border rounded-xl cursor-pointer transition-all ${
                        selectedManifest?.id === m.id 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                          : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-850'
                      }`}
                    >
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-extrabold font-mono tracking-wide">{m.id}</span>
                        <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full ${
                          m.status === 'dispatched' 
                            ? 'bg-blue-105 text-blue-900 bg-blue-100' 
                            : m.status === 'receiving' 
                            ? 'bg-amber-100 text-amber-900'
                            : m.status === 'completed'
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-200 text-slate-800'
                        }`}>
                          {m.status}
                        </span>
                      </div>
                      <div className="mt-2 text-xs flex justify-between">
                        <p className="font-bold">{m.warehouse_from_id} ➜ {m.warehouse_to_id}</p>
                        <p className="text-[10px] text-slate-400 font-mono">Carrier: {m.carrier_name}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Manifest Active details panel */}
          <div className="lg:col-span-2">
            {selectedManifest ? (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 animate-fadeIn">
                <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                  <div>
                    <div className="flex items-center space-x-2">
                      <h2 className="text-sm font-black text-slate-900">Transport Loading Manifest {selectedManifest.id}</h2>
                      <span className="px-2 py-0.5 bg-slate-100 text-[10px] rounded uppercase font-bold text-slate-600">
                        {selectedManifest.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-505">Logistical link between {selectedManifest.warehouse_from_id} and {selectedManifest.warehouse_to_id}.</p>
                  </div>

                  <div className="flex items-center space-x-1">
                    <span className="px-2.5 py-0.5 text-xs font-black rounded-full uppercase bg-slate-100 text-slate-800">
                      {selectedManifest.status}
                    </span>
                    <a
                      href={`/api/v1/manifests/${selectedManifest.id}/print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1 px-2.5 border border-slate-200 hover:bg-slate-50 rounded text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer text-slate-700"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      <span>Print gatepass</span>
                    </a>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs bg-slate-50 p-4 rounded-xl">
                  <div>
                    <span className="text-slate-400 block font-medium">Carrier Service</span>
                    <span className="font-bold text-slate-800">{selectedManifest.carrier_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Driver Assigned</span>
                    <span className="font-bold text-slate-800">{selectedManifest.driver_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Vehicle Reg No</span>
                    <span className="font-bold text-slate-800 font-mono">{selectedManifest.vehicle_registration}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Lock Seal Temperature</span>
                    <span className="font-bold text-slate-850 inline-flex items-center gap-1">
                      <Thermometer className="h-3.5 w-3.5 text-blue-500" />
                      {selectedManifest.dispatched_temp_celsius}°C
                    </span>
                  </div>
                </div>

                {/* TRANSFER ITEMS IN MANIFEST */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-black text-slate-950 uppercase tracking-widest">Manifest line items</span>
                    {selectedManifest.status === 'draft' && (
                      <span className="text-[10px] text-slate-400 italic font-medium">Load replenishment and delivery orders below.</span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {selectedManifest.lines?.length === 0 ? (
                      <div className="dashed-border py-8 text-center text-slate-400 rounded-xl text-xs">
                        No orders loaded on this transport pass yet.
                      </div>
                    ) : (
                      selectedManifest.lines?.map((line: any, idx: number) => {
                        const transferObj = selectedManifest.transfersSummary?.find((t: any) => t.id === line.transfer_id);
                        
                        return (
                          <div key={idx} className="p-3 border border-slate-100 rounded-xl bg-slate-50/20 text-xs flex flex-col sm:flex-row justify-between gap-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <p className="font-bold text-slate-900">{line.sku_name || line.sku_id}</p>
                                <span className="text-[9px] font-mono bg-slate-100 px-1 py-0.5 rounded text-slate-500">
                                  Batch: {line.batch_id}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-400 font-mono">
                                Link Transfer FPO: <b>{transferObj?.replenishment_order_number || line.transfer_id}</b>
                              </p>
                            </div>

                            <div className="flex items-center space-x-4 self-end sm:self-center">
                              <div className="text-right">
                                <span className="block font-bold text-slate-900">{line.qty_requested} units</span>
                                <span className="text-[9px] text-slate-400">
                                  {line.qty_received !== null ? `Qty Received: ${line.qty_received}` : 'Awaiting Receive'}
                                </span>
                              </div>

                              {/* Action context if in receiving */}
                              {selectedManifest.status === 'receiving' && line.qty_received === null && (
                                <button
                                  onClick={() => initiateReceiveLine(line)}
                                  className="p-1.5 bg-slate-900 text-white hover:bg-slate-800 font-bold px-3 rounded-lg flex items-center gap-1"
                                >
                                  <ClipboardCheck className="h-4 w-4 text-emerald-400" />
                                  <span>Receive</span>
                                </button>
                              )}

                              {selectedManifest.status === 'receiving' && line.qty_received !== null && (
                                <span className="flex items-center gap-1 text-emerald-600 bg-emerald-50 p-1 px-2.5 rounded-lg text-[10px] font-bold">
                                  <Check className="h-4 w-4" />
                                  <span>COUNTED</span>
                                </span>
                              )}

                              {selectedManifest.status === 'draft' && (
                                <button
                                  onClick={() => handleRemoveFPOFromManifest(line.transfer_id)}
                                  className="text-[10px] text-rose-500 hover:text-rose-700 font-bold"
                                >
                                  Remove
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ACTIVE RECEIVING LINE ITEM POPUP MODAL */}
                {receivingLine && (
                  <form onSubmit={handleCommitReceiveLine} className="p-4 border-2 border-slate-900 bg-slate-950 text-white rounded-xl space-y-4 text-xs animate-fadeIn">
                    <div className="border-b border-slate-800 pb-2 flex justify-between items-center">
                      <div>
                        <span className="font-extrabold text-teal-400 uppercase tracking-widest block">Receive & Discrepancies Register</span>
                        <span className="text-[10px] text-slate-440">Verifying {receivingLine.sku_name || receivingLine.sku_id}</span>
                      </div>
                      <button type="button" onClick={() => setReceivingLine(null)} className="text-slate-400 hover:text-white font-extrabold">Cancel</button>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-400 mb-1">Expected Units</label>
                        <input
                          type="number"
                          disabled
                          value={receivingLine.qty_requested}
                          className="w-full bg-slate-905 border border-slate-800 p-2 rounded-lg text-slate-400 cursor-not-allowed font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Accepted Count Qty</label>
                        <input
                          type="number"
                          value={receiveForm.qty_accepted}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            // auto calculate rejected qty
                            const diff = Math.max(0, receivingLine.qty_requested - val);
                            setReceiveForm({ ...receiveForm, qty_accepted: val, qty_rejected: diff });
                          }}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white font-black"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Rejected Count Qty</label>
                        <input
                          type="number"
                          value={receiveForm.qty_rejected}
                          onChange={(e) => setReceiveForm({ ...receiveForm, qty_rejected: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white font-black"
                        />
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Dock Cargo Temp (°C)</label>
                        <input
                          type="number"
                          step="0.1"
                          value={receiveForm.cargo_temp_celsius}
                          onChange={(e) => setReceiveForm({ ...receiveForm, cargo_temp_celsius: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-800 border border-slate-700 p-2 rounded-lg text-white font-mono text-center text-blue-300"
                        />
                      </div>
                    </div>

                    {receiveForm.qty_rejected > 0 && (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-3 animate-fadeIn">
                        <span className="font-extrabold text-amber-400 block uppercase tracking-wide text-[10px]">Discrepancy Resolution Protocol</span>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-slate-400 mb-1">Rejection Primary Reason</label>
                            <select
                              value={receiveForm.rejection_reason}
                              onChange={(e) => setReceiveForm({ ...receiveForm, rejection_reason: e.target.value as any })}
                              className="w-full bg-slate-850 border border-slate-700 p-2 rounded-lg text-white"
                              required
                            >
                              <option value="">-- Choose Reason --</option>
                              <option value="damaged">Physical Damage In-Transit</option>
                              <option value="temperature_abuse">Temperature Threshold Abuse</option>
                              <option value="wrong_product">Wrong SKU Labeling Error</option>
                              <option value="short_shipper">Short Shipper / Missing Cargo</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-slate-400 mb-1">Disposition Strategy Rule</label>
                            <select
                              value={receiveForm.disposition}
                              onChange={(e) => setReceiveForm({ ...receiveForm, disposition: e.target.value as any })}
                              className="w-full bg-slate-850 border border-slate-700 p-2 rounded-lg text-white"
                              required
                            >
                              <option value="">-- Select Rule --</option>
                              <option value="WRITE_OFF_AT_FP">Accept & Write-Off at Food Point</option>
                              <option value="RETURN_TO_SOURCE">Refuse Gatepass & Return to Origin Sourcing</option>
                              <option value="ACCEPT_AS_RECEIVED">Accept As-Is (Alternative Wrong SKU Swap)</option>
                            </select>
                          </div>
                        </div>

                        {receiveForm.disposition === 'ACCEPT_AS_RECEIVED' && (
                          <div className="p-3 bg-slate-850 rounded-xl space-y-2 animate-fadeIn border border-slate-700">
                            <div>
                              <p className="font-extrabold text-teal-400 text-[10px] uppercase">Identify Swapped Product SKU ID</p>
                              <p className="text-[10px] text-slate-400">Match the physical labeling on the arriving pallet:</p>
                            </div>
                            <select
                              value={receiveForm.actual_sku_id}
                              onChange={(e) => setReceiveForm({ ...receiveForm, actual_sku_id: e.target.value })}
                              className="w-full bg-slate-800 border border-slate-750 p-2 rounded-lg text-white font-medium"
                              required
                            >
                              <option value="">-- Select SKU matching container labels --</option>
                              {skus.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.id})</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex justify-end pt-1">
                      <button type="submit" className="px-5 py-2.5 bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition-all rounded-lg">
                        Record count in Ledger
                      </button>
                    </div>
                  </form>
                )}

                {/* TRANSFERS FPO LOG LOADING CONTROLS FOR DRAFT MANIFEST */}
                {selectedManifest.status === 'draft' && (
                  <div className="border-t border-slate-100 pt-4 space-y-3">
                    <p className="text-xs font-black text-slate-900 uppercase">Loadable FPO replenishment orders ({selectedManifest.warehouse_from_id} ➜ {selectedManifest.warehouse_to_id})</p>
                    {availableTransfersToManifest.length === 0 ? (
                      <p className="text-slate-400 text-xs italic">No pending FPOs ready to pack for this depot-path router.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[160px] overflow-y-auto">
                        {availableTransfersToManifest.map((trObj: any) => (
                          <div key={trObj.id} className="p-2.5 border border-slate-100 rounded-xl text-xs bg-slate-50 flex items-center justify-between">
                            <div>
                              <p className="font-black font-mono">{trObj.replenishment_order_number || trObj.id}</p>
                              <p className="text-[10px] text-slate-400">Lines: {trObj.lines?.length || 1} loaded status: <b>{trObj.status}</b></p>
                            </div>
                            <button
                              onClick={() => handleAddFPOToManifest(trObj.id)}
                              className="px-2.5 py-1 text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg"
                            >
                              Add to Truck
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* PACK AND DISPATCH STATS */}
                {selectedManifest.status === 'draft' && selectedManifest.lines?.length > 0 && (
                  <div className="border-t border-slate-100 pt-5 space-y-3">
                    <p className="text-xs font-bold text-slate-900 uppercase">Dock Packing & Security Seal Registry</p>
                    
                    <div className="space-y-2">
                      {selectedManifest.transfersSummary?.map((tr: any) => {
                        const isPacked = tr.packed_by && tr.packed_at;
                        return (
                          <div key={tr.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50 flex items-center justify-between text-xs">
                            <div className="space-y-0.5">
                              <p className="font-bold">{tr.replenishment_order_number || tr.id}</p>
                              <p className="text-[10px] text-slate-400">
                                {isPacked ? `Seal signed by ${tr.packed_by} at ${tr.packed_at.slice(11,16)}` : 'Wait: require container verification'}
                              </p>
                            </div>

                            {isPacked ? (
                              <span className="text-emerald-600 bg-emerald-50 text-[10px] font-bold p-1 px-2.5 rounded-lg flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 shrink-0" />
                                <span>SEALED</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => handlePackTransfer(tr.id)}
                                className="px-3 py-1 bg-amber-500 text-slate-950 font-black hover:bg-amber-400 rounded-lg text-[10px]"
                              >
                                Sign Seal
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Dispatch button trigger */}
                    <div className="pt-3 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => setShowDispatchConfirm(true)}
                        className="w-full py-2.5 bg-slate-900 border border-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Compass className="h-4 w-4 text-teal-400 animate-spin-slow" />
                        <span>Dispatch route & commit temperature threshold seal</span>
                      </button>
                    </div>

                    {showDispatchConfirm && (
                      <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-2xl p-6 max-w-md w-full">
                          <div className="flex items-start gap-3 mb-4 text-left">
                            <AlertTriangle className="h-6 w-6 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <h3 className="font-bold text-slate-900 text-base mb-1">
                                Confirm Dispatch
                              </h3>
                              <p className="text-sm text-slate-600 leading-relaxed">
                                Dispatching locks this manifest and all {selectedManifest?.transfer_ids?.length || 0} FPO(s).
                                Stock at the destination will be reserved against incoming
                                quantities. This cannot be undone.
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-3 justify-end">
                            <button
                              type="button"
                              onClick={() => setShowDispatchConfirm(false)}
                              className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setShowDispatchConfirm(false);
                                handleDispatchManifest();
                              }}
                              className="px-4 py-2 text-sm font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 cursor-pointer"
                            >
                              Confirm Dispatch
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* SIMULATED DRIVE ROADMAP FOR DISPATCHED ROUTE */}
                {selectedManifest.status === 'dispatched' && (
                  <div className="border-t border-slate-100 pt-5 space-y-4">
                    <div className="bg-slate-900 text-slate-150 p-4 rounded-xl space-y-3 font-mono text-[10px] border border-slate-850">
                      <div className="flex justify-between items-center text-teal-400 border-b border-slate-800 pb-2">
                        <span className="font-bold flex items-center gap-1">
                          <Truck className="h-4 w-4 text-teal-400" />
                          ROUTE DISPATCHED AND IN-TRANSIT
                        </span>
                        <span className="animate-pulse">● TELEMETRY ALIGNED</span>
                      </div>

                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="text-emerald-400">✓</span>
                          <span>Departure Seal Verified at <b>{selectedManifest.warehouse_from_id}</b> @ {selectedManifest.dispatched_temp_celsius}°C</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-405 font-bold">»</span>
                          <span>Tracking cargo GPS signal: <b className="text-amber-500">Mombasa Road intersection</b></span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-400 w-3">▲</span>
                          <span>Gate Check-In ETA: <b>12 mins</b> at {selectedManifest.warehouse_to_id} receiving dock</span>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-slate-800">
                        <button
                          onClick={handleOpenReceiving}
                          className="w-full py-2.5 bg-teal-500 text-slate-950 font-bold hover:bg-teal-400 transition-all rounded-lg text-xs"
                        >
                          Register Arrival at Gateway & Initiate Receiving Protocol
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* FPO CLOSURE STATUS VIEWER */}
                {selectedManifest.transfersSummary?.length > 0 && selectedManifest.status !== 'draft' && (
                  <div className="border-t border-slate-100 pt-5 space-y-3">
                    <span className="text-xs font-black text-slate-950 block uppercase">Replenisment closure reports</span>
                    
                    <div className="space-y-3">
                      {selectedManifest.transfersSummary.map((tr: any) => {
                        const isClosed = tr.status === 'completed' || tr.status === 'closed';
                        const report = tr.closure_report;
                        
                        return (
                          <div key={tr.id} className="p-4 border border-slate-205 rounded-xl text-xs bg-slate-50/50 space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-extrabold font-mono text-slate-900 block">{tr.replenishment_order_number || tr.id}</span>
                                <span className="text-[10px] text-slate-400">Transfer status: <b className="uppercase">{tr.status}</b></span>
                              </div>

                              {!isClosed && selectedManifest.status === 'receiving' && (
                                <button
                                  onClick={() => handleCloseFPO(tr.id)}
                                  className="px-3 py-1.5 bg-slate-950 text-white text-[10px] hover:bg-slate-800 font-bold rounded-lg"
                                >
                                  Generate Closure Metrics
                                </button>
                              )}

                              {isClosed && !report?.acknowledged_at && (
                                <button
                                  onClick={() => handleAcknowledgeClosure(tr.id)}
                                  className="px-3 py-1.5 bg-amber-500 text-slate-950 font-bold text-[10px] hover:bg-amber-400 rounded-lg shrink-0"
                                >
                                  Acknowledge closure
                                </button>
                              )}

                              {report?.acknowledged_at && (
                                <span className="text-emerald-700 bg-emerald-50 text-[10px] font-black p-1 px-3 rounded-lg uppercase">
                                  Closed & Acknowledged
                                </span>
                              )}
                            </div>

                            {report && (
                              <div className="p-3 bg-white border border-slate-105 rounded-lg space-y-2 text-[11px] animate-fadeIn">
                                <div className="flex items-center gap-1 text-slate-505 border-b border-slate-100 pb-1.5 font-bold uppercase text-[9px] tracking-wider">
                                  <FileText className="h-3.5 w-3.5" />
                                  <span>Secure FPO Completion Metric Ledger</span>
                                </div>

                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans">Qty Requested</span>
                                    <span className="font-bold text-slate-800">{report.qty_requested}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans">Qty Accepted</span>
                                    <span className="font-bold text-slate-800">{report.qty_accepted}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans">Qty Rejected</span>
                                    <span className="font-bold text-rose-600 font-extrabold">{report.qty_rejected}</span>
                                  </div>
                                  <div>
                                    <span className="text-[9px] text-slate-400 block font-sans">Under-Pick Incident</span>
                                    <span className="font-bold text-slate-800">{report.under_pick_incident ? 'YES' : 'NO'}</span>
                                  </div>
                                </div>

                                {report.rejection_lines?.length > 0 && (
                                  <div className="pt-2 border-t border-slate-100 space-y-1 bg-rose-50/20 p-2 rounded">
                                    <span className="text-[9px] text-rose-700 font-black tracking-wider uppercase block">Pending Returns & Written Off cargo:</span>
                                    {report.rejection_lines.map((rl: any, rIdx: number) => (
                                      <div key={rIdx} className="flex justify-between text-[10px] text-rose-900 leading-tight">
                                        <span>Rejected: {rl.sku_id} (Batch {rl.batch_id}) — <b>{rl.qty} units</b></span>
                                        <span className="italic uppercase font-extrabold">Disposition: {rl.disposition}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-3 h-full flex flex-col items-center justify-center">
                <Truck className="h-10 w-10 text-slate-200" />
                <p className="text-sm font-extrabold text-slate-700">Intra-Depot Food Sourcing routing</p>
                <p className="text-xs max-w-sm">Create temperature-sealed loading manifests, route delivery trucks, monitor transit temperature logs, and acknowledge receipt quantities dynamically.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: AUDITS & SUGGESTIONS */}
      {activeLogisticsTab === 'logs' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Cycle Count Suggestions Board */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Compass className="h-4 w-4 text-indigo-500" />
                  Cycle Count Suggestions (Receiving Discrepancies)
                </h3>
                <p className="text-xs text-slate-500">Inventory alerts raised due to arrival quantity shortages or labeling mismatches.</p>
              </div>

              <div className="space-y-3 filter max-h-[455px] overflow-y-auto">
                {suggestions.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 text-xs">
                    No discrepancy alerts loaded in queue.
                  </div>
                ) : (
                  suggestions.map((sug) => {
                    const isActioned = sug.status === 'actioned';
                    return (
                      <div key={sug.id} className={`p-4 border rounded-xl text-xs space-y-3 ${
                        isActioned ? 'bg-slate-50 border-slate-150 text-slate-500' : 'bg-indigo-50/10 border-indigo-200 text-slate-850'
                      }`}>
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-extrabold text-slate-900 block">{sug.sku_id}</span>
                            <span className="text-[10px] text-slate-400">Incident source manifest: <b>{sug.source_manifest_id}</b></span>
                          </div>

                          <span className={`px-2 py-0.5 rounded-full text-[9px] uppercase font-black ${
                            isActioned ? 'bg-slate-250 text-slate-650' : 'bg-indigo-100 text-indigo-900'
                          }`}>
                            {sug.status}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div>
                            <span className="text-slate-400 block font-sans">Physical Sighting Location</span>
                            <span className="font-semibold text-slate-800">{sug.location_id}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block font-sans">Reported Shortage Count</span>
                            <span className="font-semibold text-rose-600 font-extrabold">-{sug.discrepancy_qty} units</span>
                          </div>
                        </div>

                        {!isActioned && (
                          <div className="pt-2 border-t border-slate-100 flex justify-end space-x-2">
                            <button
                              onClick={() => handleActionSuggestion(sug.id, 'ignore')}
                              className="px-2.5 py-1 text-[10px] text-slate-600 hover:text-slate-900 font-semibold"
                            >
                              Dismiss Alert
                            </button>
                            <button
                              onClick={() => handleActionSuggestion(sug.id, 'queue_physical')}
                              className="px-3 py-1 text-[10px] bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg flex items-center gap-1"
                            >
                              <span>Dispatch Physical Audit Task</span>
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Continuous Temperature Stream Telemetry Logger */}
            <div className="bg-white border border-slate-205 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-xs font-black text-slate-950 uppercase tracking-widest flex items-center gap-1.5">
                  <Thermometer className="h-4 w-4 text-blue-500" />
                  Live Transport Temperature Streams
                </h3>
                <p className="text-[11px] text-slate-500">Live feed of chilled assets actively rolling in Nairobi traffic.</p>
              </div>

              <div className="space-y-3 max-h-[450px] overflow-y-auto">
                {liveTempLogs.map((log) => (
                  <div key={log.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 text-xs text-slate-800 space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="font-extrabold font-mono tracking-wide">{log.id}</span>
                      <span className="text-[10px] text-slate-450">{log.timestamp}</span>
                    </div>

                    <p className="font-semibold text-slate-900 leading-tight">{log.route}</p>
                    
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-[10px] text-slate-400">Logged Temperature</span>
                      
                      <span className={`p-1 px-2.5 rounded text-[11px] font-black inline-flex items-center gap-1 ${
                        log.status === 'warning' 
                          ? 'bg-amber-100 text-amber-900' 
                          : 'bg-blue-105 text-blue-900'
                      }`}>
                        <Thermometer className="h-3.5 w-3.5" />
                        {log.temp}°C
                      </span>
                    </div>

                    {log.status === 'warning' && (
                      <div className="flex items-start gap-1 p-2 bg-rose-50 border border-rose-100 rounded text-[9px] text-rose-900 leading-normal font-sans">
                        <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-rose-500 mt-0.5" />
                        <span>Critical Threshold Breach Index: {log.reason}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
