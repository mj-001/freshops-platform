import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  Clock, 
  User, 
  Percent, 
  MapPin, 
  Activity, 
  Wrench,
  TrendingUp, 
  ShieldAlert, 
  Check, 
  PlusCircle, 
  Trash2,
  Lock,
  UserCheck
} from 'lucide-react';
import { displayQty } from '../utils/uom';
import BarcodeInput from './BarcodeInput';

interface AssembliesProps {
  currentUser: any;
  warehouses: any[];
  skus: any[];
  locations: any[];
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  refreshFlag?: number;
  triggerRefresh?: () => void;
}

export default function Assemblies({ 
  currentUser, 
  warehouses, 
  skus, 
  locations, 
  triggerToast,
  refreshFlag = 0,
  triggerRefresh
}: AssembliesProps) {
  // Tabs: 'templates' or 'orders'
  const [activeTab, setActiveTab] = useState<'templates' | 'orders'>('orders');

  // Core assemblies states
  const [templates, setTemplates] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection states
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Modals / Form toggles
  const [showNewTemplateForm, setShowNewTemplateForm] = useState(false);
  const [showNewOrderForm, setShowNewOrderForm] = useState(false);

  // New Template Form parameters
  const [tplName, setTplName] = useState('');
  const [tplType, setTplType] = useState('repackaging');
  const [tplInputSku, setTplInputSku] = useState('');
  const [tplOutputSku, setTplOutputSku] = useState('');
  const [tplYieldPct, setTplYieldPct] = useState(100);
  const [tplZone, setTplZone] = useState('ambient');
  const [tplNotes, setTplNotes] = useState('');
  const [tplStages, setTplStages] = useState<any[]>([
    { name: 'Initial Processing', min_dwell_hours: 0, max_dwell_hours: 2, inspection_required: false }
  ]);

  // New Order Form parameters
  const [ordTemplateId, setOrdTemplateId] = useState('');
  const [ordWarehouseId, setOrdWarehouseId] = useState('RGN');
  const [ordLocationId, setOrdLocationId] = useState('');
  const [ordBatchId, setOrdBatchId] = useState('');
  const [ordQtyInput, setOrdQtyInput] = useState<number>(0);
  const [ordQtyOutputPlanned, setOrdQtyOutputPlanned] = useState<number>(0);
  const [ordNotes, setOrdNotes] = useState('');
  const [ordScheduledStart, setOrdScheduledStart] = useState(new Date().toISOString().slice(0, 16));

  // Contextual actions inputs
  const [actionTemp, setActionTemp] = useState<string>('');
  const [actionNotes, setActionNotes] = useState<string>('');
  const [actionInspector, setActionInspector] = useState<string>('');
  const [actionActualQty, setActionActualQty] = useState<string>('');
  const [actionOutputBatch, setActionOutputBatch] = useState<string>('');

  useEffect(() => {
    fetchAssembliesData();
  }, [refreshFlag]);

  const fetchAssembliesData = async () => {
    setLoading(true);
    try {
      const [resTpl, resOrd, resBatches] = await Promise.all([
        fetch('/api/v1/assemblies/templates'),
        fetch('/api/v1/assembly-orders'),
        fetch('/api/v1/batches')
      ]);

      if (resTpl.ok) {
        const payload = await resTpl.json();
        setTemplates(payload.data || []);
      }
      if (resOrd.ok) {
        const payload = await resOrd.json();
        const data = payload.data || [];
        setOrders(data);
        // Reselect order if details are open
        if (selectedOrder) {
          const matching = data.find((o: any) => o.id === selectedOrder.id);
          if (matching) setSelectedOrder(matching);
        }
      }
      if (resBatches.ok) {
        const payload = await resBatches.json();
        setBatches(payload.data || []);
      }
    } catch (err) {
      console.error('Error fetching assemblies:', err);
      triggerToast('Error synchronizing assemblies data ledger.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Helper: auto-calculate planned yield based on yield % when inputs change
  useEffect(() => {
    if (ordTemplateId && ordQtyInput > 0) {
      const tpl = templates.find((t: any) => t.id === ordTemplateId);
      if (tpl) {
        const calculated = Number((ordQtyInput * (tpl.expected_yield_pct / 100)).toFixed(0));
        setOrdQtyOutputPlanned(calculated);
      }
    }
  }, [ordTemplateId, ordQtyInput, templates]);

  // Handle SKU change on template creation
  useEffect(() => {
    if (showNewTemplateForm && skus.length > 0) {
      if (!tplInputSku) setTplInputSku(skus[0]?.id || '');
      if (!tplOutputSku) setTplOutputSku(skus[1]?.id || skus[0]?.id || '');
    }
  }, [showNewTemplateForm, skus]);

  // Handle template selection on order creation
  useEffect(() => {
    if (showNewOrderForm) {
      const activeTpl = templates.find((t: any) => t.status === 'active');
      if (activeTpl) {
        setOrdTemplateId(activeTpl.id);
      }
    }
  }, [showNewOrderForm, templates]);

  // Handle warehouse changes on order creation
  useEffect(() => {
    if (showNewOrderForm) {
      const filteredLocs = locations.filter((loc: any) => loc.warehouse_id === ordWarehouseId);
      if (filteredLocs.length > 0) {
        setOrdLocationId(filteredLocs[0].id);
      } else {
        setOrdLocationId('');
      }
    }
  }, [showNewOrderForm, ordWarehouseId, locations]);

  // Template custom stages handlers
  const handleAddStage = () => {
    setTplStages([
      ...tplStages,
      { name: `Stage ${tplStages.length + 1}`, min_dwell_hours: 0, max_dwell_hours: 2, inspection_required: false }
    ]);
  };

  const handleRemoveStage = (index: number) => {
    if (tplStages.length <= 1) return;
    setTplStages(tplStages.filter((_, i) => i !== index));
  };

  const handleUpdateStage = (index: number, field: string, value: any) => {
    const copy = [...tplStages];
    copy[index] = { ...copy[index], [field]: value };
    setTplStages(copy);
  };

  // Submit operations
  const handleCreateTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName || !tplInputSku || !tplOutputSku) {
      triggerToast('Please complete all template fields.', 'error');
      return;
    }

    try {
      const res = await fetch('/api/v1/assemblies/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: tplName,
          type: tplType,
          input_sku_id: tplInputSku,
          output_sku_id: tplOutputSku,
          expected_yield_pct: Number(tplYieldPct),
          required_zone: tplZone,
          stages: tplStages,
          requires_temperature_log: true,
          notes: tplNotes
        })
      });

      if (res.ok) {
        triggerToast('Assembly Template created successfully in DRAFT mode.', 'success');
        setShowNewTemplateForm(false);
        setTplName('');
        setTplStages([{ name: 'Initial Processing', min_dwell_hours: 0, max_dwell_hours: 2, inspection_required: false }]);
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const payload = await res.json();
        triggerToast(payload.error || 'Failed to create template.', 'error');
      }
    } catch (err) {
      triggerToast('Server communication failure.', 'error');
    }
  };

  const handleApproveTemplate = async (template: any) => {
    if (currentUser?.id === template.created_by || currentUser?.name === template.created_by) {
      triggerToast('Self-approval of drafted templates is prohibited under food safety compliance guidelines.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/assemblies/templates/${template.id}/approve`, {
        method: 'POST'
      });
      if (res.ok) {
        triggerToast(`Template ${template.id} successfully approved and set to ACTIVE!`, 'success');
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const payload = await res.json();
        triggerToast(payload.error || 'Approval rejected.', 'error');
      }
    } catch (err) {
      triggerToast('Communication error.', 'error');
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ordTemplateId || !ordWarehouseId || !ordLocationId || !ordBatchId || ordQtyInput <= 0 || ordQtyOutputPlanned <= 0) {
      triggerToast('Please complete all fields to schedule order.', 'error');
      return;
    }

    const tplObj = templates.find((t: any) => t.id === ordTemplateId);
    const locObj = locations.find((l: any) => l.id === ordLocationId);
    
    try {
      const res = await fetch('/api/v1/assembly-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: ordTemplateId,
          warehouse_id: ordWarehouseId,
          location_id: ordLocationId,
          input_batch_id: ordBatchId,
          qty_input: ordQtyInput,
          qty_output_planned: ordQtyOutputPlanned,
          notes: ordNotes,
          scheduled_start: ordScheduledStart ? new Date(ordScheduledStart).toISOString() : new Date().toISOString()
        })
      });

      const payload = await res.json();
      if (res.ok && payload.data) {
        triggerToast(`Assembly Order ${payload.data.id} scheduled successfully!`, 'success');
        setShowNewOrderForm(false);
        setOrdNotes('');
        setOrdQtyInput(0);
        setOrdQtyOutputPlanned(0);
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const msg = payload.error?.message || payload.error || 'Insufficient parameters or mismatch rules met.';
        triggerToast(`Order Rejected: ${msg}`, 'error');
      }
    } catch (err) {
      triggerToast('Network ledger submission failed.', 'error');
    }
  };

  const handleStartOrder = async (orderId: string) => {
    const temp = Number(actionTemp);
    if (isNaN(temp)) {
      triggerToast('Initial starting temperature is required to commencing cold chain tracking.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/assembly-orders/${orderId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature_celsius: temp })
      });
      if (res.ok) {
        triggerToast(`Order COMMENCED. Cold-chain stage logging is online.`, 'success');
        setActionTemp('');
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const payload = await res.json();
        triggerToast(payload.error || 'Failed to start.', 'error');
      }
    } catch (err) {
      triggerToast('Server connection errors.', 'error');
    }
  };

  const handleAdvanceStage = async (order: any) => {
    const inspector = actionInspector.trim() || currentUser?.name || '';
    if (!inspector) {
      triggerToast('Inspector signature name is required.', 'error');
      return;
    }

    if (inspector === order.initiated_by || currentUser?.id === order.initiated_by || currentUser?.name === order.initiated_by) {
      triggerToast('INSPECTOR_IS_INITIATOR: Stage validator name cannot be the order initiator.', 'error');
      return;
    }

    try {
      const res = await fetch(`/api/v1/assembly-orders/${order.id}/advance-stage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approved_by_name: inspector,
          temperature_celsius: actionTemp ? Number(actionTemp) : null,
          notes: actionNotes || 'Dwell check approved'
        })
      });

      const payload = await res.json();
      if (res.ok) {
        triggerToast(`Stage advanced successfully! Certified by ${inspector}.`, 'success');
        setActionTemp('');
        setActionNotes('');
        setActionInspector('');
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const msg = payload.error?.message || payload.error || 'Stage update disallowed.';
        triggerToast(`Stage Rejected: ${msg}`, 'error');
      }
    } catch (err) {
      triggerToast('Network update timed out.', 'error');
    }
  };

  const handleCompleteOrder = async (order: any) => {
    const actQty = Number(actionActualQty);
    if (isNaN(actQty) || actQty <= 0) {
      triggerToast('Please provide valid actual output pack counts.', 'error');
      return;
    }

    try {
      const finalBatch = actionOutputBatch || `BAT-ASM-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await fetch(`/api/v1/assembly-orders/${order.id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qty_output_actual: actQty,
          output_batch_id: finalBatch,
          notes: actionNotes || 'Final output processed'
        })
      });

      const payload = await res.json();
      if (res.ok) {
        if (payload.warning === 'YIELD_VARIANCE_WARNING') {
          triggerToast(`Order entered yield review: Deviation is beyond 10% tolerance!`, 'info');
        } else {
          triggerToast(`Order COMPLETED! Stock created in batch ${finalBatch}`, 'success');
        }
        setActionActualQty('');
        setActionNotes('');
        setActionOutputBatch('');
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        triggerToast(payload.error || 'Failed to close order lines.', 'error');
      }
    } catch (err) {
      triggerToast('Server failure closing ledger lines.', 'error');
    }
  };

  const handleApproveYield = async (order: any) => {
    if (currentUser?.id === order.initiated_by || currentUser?.name === order.initiated_by) {
      triggerToast('SELF_APPROVAL_PROHIBITED: Initiators are disallowed from bypassing yield deviances.', 'error');
      return;
    }

    try {
      const finalBatch = actionOutputBatch || order.output_batch_id || `BAT-ASM-${Math.floor(100000 + Math.random() * 900000)}`;
      const res = await fetch(`/api/v1/assembly-orders/${order.id}/approve-yield`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ output_batch_id: finalBatch })
      });

      if (res.status === 422) {
        triggerToast('SELF_APPROVAL_PROHIBITED: Cannot self-approve deviation bypass.', 'error');
        return;
      }

      if (res.ok) {
        triggerToast(`Yield Deviation resolved! Order closed into batch ${finalBatch}`, 'success');
        setActionOutputBatch('');
        fetchAssembliesData();
        if (triggerRefresh) triggerRefresh();
      } else {
        const payload = await res.json();
        const msg = payload.error?.message || payload.error || 'reconciliation refused.';
        triggerToast(`Bypass Error: ${msg}`, 'error');
      }
    } catch (err) {
      triggerToast('Server communication timeout.', 'error');
    }
  };

  // Filter batches for order creation dropdown based on input SKU and location
  const ordTplSku = ordTemplateId ? templates.find((t: any) => t.id === ordTemplateId)?.input_sku_id : '';
  const filteredAvailableBatches = batches.filter((b: any) => {
    return b.sku_id === ordTplSku && b.warehouse_id === ordWarehouseId && b.quantity_available > 0;
  });

  const handleBatchScan = (codeStr: string) => {
    const cleanCode = codeStr.toUpperCase().trim();
    if (!ordTemplateId) {
      triggerToast('Please select an Assembly Recipe template first so we can match the input stock!', 'error');
      return;
    }
    const foundBatch = batches.find((b: any) => b.id.toUpperCase() === cleanCode);
    if (foundBatch) {
      if (foundBatch.sku_id !== ordTplSku) {
        triggerToast(`Batch matches product SKU ${foundBatch.sku_id}, but current recipe requires ${ordTplSku}. Selection rejected.`, 'error');
        return;
      }
      setOrdBatchId(foundBatch.id);
      if (foundBatch.warehouse_id !== ordWarehouseId) {
        setOrdWarehouseId(foundBatch.warehouse_id);
      }
      triggerToast(`Successfully scanned and selected Batch ${foundBatch.id}!`, 'success');
    } else {
      triggerToast(`Batch ID "${codeStr}" was not found in active inventories.`, 'error');
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Module Title Header Card */}
      <div className="bg-white border border-slate-250 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-teal-50 text-teal-750 rounded-2xl">
            <Wrench className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">KRA-Aligned Assembly & Stage Ledger</h2>
            <p className="text-xs text-slate-500 max-w-xl">
              Track manufacturing conversions, draft temperature staging protocols, and validate yield deviation boundaries.
            </p>
          </div>
        </div>

        {/* Global tab selector */}
        <div className="flex bg-slate-100 hover:bg-slate-150 p-1.5 rounded-2xl transition">
          <button 
            id="tab-btn-orders"
            onClick={() => { setActiveTab('orders'); setSelectedOrder(null); }}
            className={`px-4 py-2 font-bold text-xs rounded-xl tracking-wide transition-all ${
              activeTab === 'orders' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Conversions Orders List
          </button>
          <button 
            id="tab-btn-templates"
            onClick={() => { setActiveTab('templates'); setSelectedTemplate(null); }}
            className={`px-4 py-2 font-bold text-xs rounded-xl tracking-wide transition-all ${
              activeTab === 'templates' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            Safety Conversion Templates
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 italic text-xs animate-pulse">Syncing safety conversions ledger indexes...</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* LEFT CONTENT LIST COLUMN (8 OF 12 COLS) */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* -------------------- ORDERS SUB-TAB LISTING -------------------- */}
            {activeTab === 'orders' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xxs">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Conversion Batches</h3>
                    <p className="text-[10px] text-slate-400 font-mono">ALL KRA CONVERSIONS WITH STAGE ENFORCEMENT</p>
                  </div>
                  <button
                    id="btn-new-order"
                    onClick={() => setShowNewOrderForm(!showNewOrderForm)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3.5 text-xs font-black cursor-pointer shadow-xs transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Initiate Conversion</span>
                  </button>
                </div>

                {/* Create New Order Collapse Form */}
                {showNewOrderForm && (
                  <form onSubmit={handleCreateOrder} className="mb-6 p-4 bg-teal-50/40 border border-teal-100 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black uppercase text-teal-850 tracking-wider">Schedule Conversion Activity</h4>
                    
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Select Protocol Recipe</label>
                        <select 
                          value={ordTemplateId} 
                          onChange={(e) => setOrdTemplateId(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                        >
                          <option value="">-- Choose Approved Active Template --</option>
                          {templates.filter(t => t.status === 'active').map(tpl => (
                            <option key={tpl.id} value={tpl.id}>[{tpl.id}] {tpl.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Warehouse Division</label>
                        <select 
                          value={ordWarehouseId} 
                          onChange={(e) => setOrdWarehouseId(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                        >
                          {warehouses.map(wh => (
                            <option key={wh.id} value={wh.id}>{wh.name} Warehouse</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Work Location Stall</label>
                        <select 
                          value={ordLocationId} 
                          onChange={(e) => setOrdLocationId(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                        >
                          <option value="">-- Select Stall Location --</option>
                          {locations.filter(l => l.warehouse_id === ordWarehouseId).map((loc: any) => (
                            <option key={loc.id} value={loc.id}>{loc.id.replace('L-', '')} ({loc.zone_id.replace('Z-', '')})</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Source Raw Batch</label>
                        <select 
                          value={ordBatchId} 
                          onChange={(e) => setOrdBatchId(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold mb-2"
                        >
                          <option value="">-- Select Batch (SKU-matched) --</option>
                          {filteredAvailableBatches.map((b: any) => (
                            <option key={b.id} value={b.id}>
                              {b.id} ({b.sku_id}) - Qty: {b.quantity_available}
                            </option>
                          ))}
                        </select>
                        <BarcodeInput 
                          onScan={handleBatchScan}
                          placeholder="Or scan Batch ID (e.g. BAT-KIP...)"
                          context="general"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Input Qty Required</label>
                        <input 
                          type="number"
                          value={ordQtyInput}
                          onChange={(e) => setOrdQtyInput(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold text-center"
                          placeholder="Packs"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Planned Success Output Qty</label>
                        <input 
                          type="number"
                          value={ordQtyOutputPlanned}
                          onChange={(e) => setOrdQtyOutputPlanned(Math.max(0, parseInt(e.target.value) || 0))}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold text-center bg-teal-50/20"
                          placeholder="Converter-planned success packs"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Scheduled Commencing Time</label>
                        <input 
                          type="datetime-local"
                          value={ordScheduledStart}
                          onChange={(e) => setOrdScheduledStart(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Conversion Purpose Notes</label>
                        <input 
                          type="text"
                          value={ordNotes}
                          onChange={(e) => setOrdNotes(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs"
                          placeholder="e.g. repacking bulk Hass Avocados into retail boxes"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button 
                        type="button" 
                        onClick={() => setShowNewOrderForm(false)}
                        className="px-4 py-2 border border-slate-250 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-teal-650 hover:bg-teal-700 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                      >
                        Launch Order Protocol
                      </button>
                    </div>
                  </form>
                )}

                {/* Orders Grid/List */}
                {orders.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic text-xs">No conversions initialized or historical runs in local ledger.</div>
                ) : (
                  <div className="space-y-3.5">
                    {orders.map((ord: any) => {
                      const inputSkuObj = skus.find(s => s.id === ord.input_sku_id);
                      const outputSkuObj = skus.find(s => s.id === ord.output_sku_id);
                      let statusBg = 'bg-slate-100 text-slate-700';
                      if (ord.status === 'in_progress') statusBg = 'bg-indigo-50 border border-indigo-200 text-indigo-800 animate-pulse';
                      if (ord.status === 'inspection_pending') statusBg = 'bg-rose-50 border border-rose-200 text-rose-800';
                      if (ord.status === 'completed') statusBg = 'bg-emerald-50 border border-emerald-250 text-emerald-800';
                      
                      const active = selectedOrder?.id === ord.id;

                      return (
                        <div 
                          key={ord.id}
                          onClick={() => {
                            setSelectedOrder(ord);
                            setActionInspector('');
                            setActionActualQty('');
                            setActionOutputBatch('');
                          }}
                          className={`p-4 border rounded-2xl text-xs transition cursor-pointer flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 ${
                            active ? 'border-teal-400 bg-teal-50/5' : 'border-slate-150 hover:border-slate-250 bg-slate-50/40'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-slate-900 text-xs">{ord.id}</span>
                              <span className="text-[10px] text-slate-400 font-mono">[{ord.type.toUpperCase()}]</span>
                              <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${statusBg}`}>
                                {ord.status.toUpperCase()}
                              </span>
                            </div>
                            <p className="font-semibold text-slate-700">{ord.template_name}</p>
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-mono">
                              <span>From: <b>{ord.input_batch_id} ({inputSkuObj?.code || ord.input_sku_id})</b></span>
                              <span>To: <b>{ord.output_batch_id || '(Pending)'} ({outputSkuObj?.code || ord.output_sku_id})</b></span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 mt-1">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>Sched: {new Date(ord.scheduled_start).toLocaleString()}</span>
                              <span>• Loc: <b>{ord.location_id.replace('L-', '')}</b></span>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <div className="space-y-0.5">
                              <span className="text-slate-400 block text-[9px] font-bold">Planned Yield</span>
                              <span className="font-bold text-slate-800 text-xs">
                                {displayQty(ord.qty_input, inputSkuObj)} &rarr; {displayQty(ord.qty_output_planned, outputSkuObj)}
                              </span>
                              {ord.qty_output_actual !== null && (
                                <div className="text-[10px] font-black text-teal-700 bg-teal-50 px-2 py-0.5 rounded mt-1 inline-block">
                                  Actual: {displayQty(ord.qty_output_actual, outputSkuObj)}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* -------------------- TEMPLATES SUB-TAB LISTING -------------------- */}
            {activeTab === 'templates' && (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xxs">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="font-extrabold text-sm text-slate-900">Safety Protocols & Formulas</h3>
                    <p className="text-[10px] text-slate-400 font-mono">HACCP COMPLIANT STEP SEQUENCE AND YIELD GAUGES</p>
                  </div>
                  <button
                    id="btn-new-template"
                    onClick={() => setShowNewTemplateForm(!showNewTemplateForm)}
                    className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-2 px-3.5 text-xs font-black cursor-pointer shadow-xs transition"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Protocol Formula</span>
                  </button>
                </div>

                {/* Create New Template Collapse Form */}
                {showNewTemplateForm && (
                  <form onSubmit={handleCreateTemplate} className="mb-6 p-4 bg-teal-50/40 border border-teal-100 rounded-2xl space-y-4">
                    <h4 className="text-xs font-black uppercase text-teal-850 tracking-wider">Configure Assembly Safety Protocols</h4>
                    
                    <div className="space-y-3 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Protocol / Formula Name</label>
                          <input 
                            type="text"
                            required
                            value={tplName}
                            onChange={(e) => setTplName(e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                            placeholder="e.g. Avocado Grade A Retail Carton Packer"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Conversion Task Type</label>
                          <select 
                            value={tplType}
                            onChange={(e) => setTplType(e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                          >
                            <option value="repackaging">Repackaging / Grading</option>
                            <option value="blending">Blending / Mixing</option>
                            <option value="maturation">Maturation / Ripening</option>
                            <option value="standard">Standard Assembly Conversion</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Input Source SKU</label>
                          <select 
                            value={tplInputSku}
                            onChange={(e) => setTplInputSku(e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                          >
                            <option value="">-- Select SKU --</option>
                            {skus.map(s => (
                              <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Output Target SKU</label>
                          <select 
                            value={tplOutputSku}
                            onChange={(e) => setTplOutputSku(e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                          >
                            <option value="">-- Select SKU --</option>
                            {skus.map(s => (
                              <option key={s.id} value={s.id}>[{s.code}] {s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Yield % Efficiency</label>
                          <input 
                            type="number"
                            value={tplYieldPct}
                            onChange={(e) => setTplYieldPct(Math.max(1, Math.min(200, parseInt(e.target.value) || 100)))}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold text-center"
                            placeholder="Target success pct (e.g. 95)"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Required Environmental Zone</label>
                          <select 
                            value={tplZone}
                            onChange={(e) => setTplZone(e.target.value)}
                            className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs font-bold"
                          >
                            <option value="ambient">Ambient (15°C to 25°C)</option>
                            <option value="chilled">Chilled (0°C to 4°C)</option>
                            <option value="cool">Cool (8°C to 12°C)</option>
                            <option value="frozen">Frozen (&lt; -18°C)</option>
                          </select>
                        </div>
                      </div>

                      {/* Dynamic Protocol Stages Section */}
                      <div className="space-y-3 pt-3 border-t border-slate-150">
                        <div className="flex justify-between items-center">
                          <label className="block text-[10px] uppercase font-black text-slate-500">Step Procedures & HACCP checkpoints</label>
                          <button 
                            type="button" 
                            onClick={handleAddStage}
                            className="flex items-center gap-1 text-teal-700 font-bold hover:text-teal-800"
                          >
                            <PlusCircle className="w-4.5 h-4.5" />
                            <span>Add Stage</span>
                          </button>
                        </div>

                        <div className="space-y-2.5">
                          {tplStages.map((stg, sIndex) => (
                            <div key={sIndex} className="p-3 bg-white border border-slate-150 rounded-xl space-y-2 relative">
                              <div className="flex items-center justify-between">
                                <span className="text-[10px] font-black text-slate-400">STAGE #{sIndex+1}</span>
                                {tplStages.length > 1 && (
                                  <button 
                                    type="button" 
                                    onClick={() => handleRemoveStage(sIndex)}
                                    className="text-rose-500 hover:text-rose-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div className="sm:col-span-2">
                                  <input 
                                    type="text"
                                    required
                                    value={stg.name}
                                    placeholder="Procedure Stage Name"
                                    onChange={(e) => handleUpdateStage(sIndex, 'name', e.target.value)}
                                    className="w-full border border-slate-205 rounded-lg p-1.5 text-xs font-bold"
                                  />
                                </div>
                                <div>
                                  <label className="flex items-center gap-1.5 cursor-pointer mt-2">
                                    <input 
                                      type="checkbox"
                                      checked={stg.inspection_required}
                                      onChange={(e) => handleUpdateStage(sIndex, 'inspection_required', e.target.checked)}
                                    />
                                    <span className="text-[10px] font-bold text-slate-600">Requires Sign-off</span>
                                  </label>
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block uppercase">Min Dwell Hrs</label>
                                  <input 
                                    type="number"
                                    value={stg.min_dwell_hours}
                                    onChange={(e) => handleUpdateStage(sIndex, 'min_dwell_hours', parseInt(e.target.value) || 0)}
                                    className="w-full text-center border border-slate-205 rounded-lg p-1 text-xs"
                                  />
                                </div>
                                <div>
                                  <label className="text-[9px] text-slate-400 block uppercase">Max Dwell Hrs</label>
                                  <input 
                                    type="number"
                                    value={stg.max_dwell_hours}
                                    onChange={(e) => handleUpdateStage(sIndex, 'max_dwell_hours', parseInt(e.target.value) || 0)}
                                    className="w-full text-center border border-slate-205 rounded-lg p-1 text-xs"
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Compliance Notes</label>
                        <input 
                          type="text"
                          value={tplNotes}
                          onChange={(e) => setTplNotes(e.target.value)}
                          className="w-full bg-white border border-slate-205 rounded-xl p-2 text-xs"
                          placeholder="e.g. ensure proper sterile tools are sanitized with Ethanol 70%"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <button 
                        type="button" 
                        onClick={() => setShowNewTemplateForm(false)}
                        className="px-4 py-2 border border-slate-250 rounded-xl text-xs font-semibold cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button 
                        type="submit" 
                        className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black cursor-pointer shadow-xs"
                      >
                        Draft safety formula
                      </button>
                    </div>
                  </form>
                )}

                {/* Templates Grid / List */}
                {templates.length === 0 ? (
                  <div className="py-12 text-center text-slate-400 italic text-xs animate-pulse">Synchronizing formulas catalog from server...</div>
                ) : (
                  <div className="space-y-4">
                    {templates.map((tpl: any) => {
                      const inputSk = skus.find(s => s.id === tpl.input_sku_id);
                      const outputSk = skus.find(s => s.id === tpl.output_sku_id);
                      const isCreator = currentUser?.name === tpl.created_by;

                      return (
                        <div 
                          key={tpl.id}
                          className="p-4 border border-slate-150 rounded-2xl text-xs hover:border-slate-250 transition bg-slate-50/40 relative space-y-3"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-extrabold text-slate-900 text-xs">{tpl.id}</span>
                                <span className={`px-2 py-0.5 rounded text-[8px] font-black tracking-wider uppercase ${
                                  tpl.status === 'active' ? 'bg-emerald-50 border border-emerald-200 text-emerald-800' : 'bg-slate-100 text-slate-700'
                                }`}>
                                  {tpl.status.toUpperCase()}
                                </span>
                              </div>
                              <h4 className="font-black text-slate-800 text-sm mt-1">{tpl.name}</h4>
                            </div>

                            {tpl.status === 'draft' && (
                              <div>
                                {isCreator ? (
                                  <span className="text-[10px] text-slate-400 italic font-medium block">Approval locked: Creator</span>
                                ) : (
                                  <button
                                    id={`btn-approve-${tpl.id}`}
                                    onClick={() => handleApproveTemplate(tpl)}
                                    className="bg-emerald-650 hover:bg-emerald-700 text-white font-bold rounded-xl px-3 py-1.5 text-xs cursor-pointer shadow-xs transition"
                                  >
                                    Approve Formula
                                  </button>
                                )}
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t border-slate-100 pt-3 text-[10px] text-slate-500 font-mono">
                            <div>
                              <span className="block text-slate-400 text-[8px] uppercase font-bold">Input convert SKU</span>
                              <span className="font-bold text-slate-700 truncate block">{inputSk?.name || tpl.input_sku_id}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 text-[8px] uppercase font-bold">Output conversion SKU</span>
                              <span className="font-bold text-slate-700 truncate block">{outputSk?.name || tpl.output_sku_id}</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 text-[8px] uppercase font-bold">Expected conversion safety yield</span>
                              <span className="font-bold text-teal-700 text-xs">{tpl.expected_yield_pct}%</span>
                            </div>
                            <div>
                              <span className="block text-slate-400 text-[8px] uppercase font-bold">Target Zone requirement</span>
                              <span className="font-bold text-slate-700 capitalize">{tpl.required_zone}</span>
                            </div>
                          </div>

                          {/* Render Stages summary list */}
                          <div className="bg-white border border-slate-150 p-3 rounded-xl">
                            <span className="text-[9px] font-bold text-slate-400 block uppercase mb-1">Approved Stages Procedures ({tpl.stages?.length || 0})</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {tpl.stages?.map((st: any, sIdx: number) => (
                                <React.Fragment key={sIdx}>
                                  {sIdx > 0 && <ChevronRight className="w-3 h-3 text-slate-350" />}
                                  <div className="bg-slate-50 px-2 py-1 rounded text-[9px] font-medium text-slate-700 border border-slate-100">
                                    <span className="font-bold text-slate-400 mr-1">#{st.stage_number}</span>
                                    {st.name} 
                                    {st.inspection_required && <span className="text-amber-600 font-bold ml-1">★</span>}
                                    <span className="text-slate-400 ml-1">({st.min_dwell_hours}h - {st.max_dwell_hours}h)</span>
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>

                          <div className="flex justify-between text-[9px] text-slate-400 italic">
                            <span>Created By: <b>{tpl.created_by}</b> at {new Date(tpl.created_at).toLocaleDateString()}</span>
                            {tpl.approved_by && (
                              <span className="text-emerald-700 font-semibold">Approved By: <b>{tpl.approved_by}</b></span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

          </div>

          {/* RIGHT PANELS DETAIL WITH STAGE TRACKING AND ACTIONS (5 OF 12 COLS) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* -------------------- OPERATIONAL ORDER TRACKER -------------------- */}
            {activeTab === 'orders' ? (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xxs space-y-5">
                <div className="border-b border-slate-100 pb-4">
                  <h3 className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                    <Activity className="h-4.5 w-4.5 text-teal-650" />
                    <span>Active Stage Tracker</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">KPI TELEMETRY STEP SEQUENCE AUDIT TRAIL</p>
                </div>

                {!selectedOrder ? (
                  <div className="py-16 text-center text-slate-400 italic text-xs">
                    Select a conversion activity row on the left to review cold staging protocols, stage approvals, and yield balances.
                  </div>
                ) : (
                  <div className="space-y-5 text-xs">
                    
                    {/* Header Summary */}
                    <div className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-2 relative">
                      <div className="absolute top-4 right-4 bg-slate-900 text-white font-bold px-2 py-0.5 rounded text-[9px] tracking-wider uppercase">
                        {selectedOrder.status}
                      </div>
                      <h4 className="font-extrabold text-slate-900 text-sm leading-tight">{selectedOrder.id}</h4>
                      <p className="text-slate-500 font-medium">{selectedOrder.template_name}</p>
                      
                      <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] font-mono text-slate-500 pt-2 border-t border-slate-200/65">
                        <span>Terminal Stall: <b>{selectedOrder.location_id.replace('L-', '')}</b></span>
                        <span>Warehouse: <b>{selectedOrder.warehouse_id}</b></span>
                        <span>From Batch: <b>{selectedOrder.input_batch_id}</b></span>
                        <span>Created By: <b>{selectedOrder.initiated_by}</b></span>
                      </div>
                    </div>

                    {/* Stage List Progress */}
                    <div className="space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Cold-Chain Step Protocol Status</h4>
                      
                      {(() => {
                        // Load template stages to render actual configured steps
                        const ordTemplate = templates.find(t => t.id === selectedOrder.template_id);
                        if (!ordTemplate) return <div className="text-slate-400 italic">No stage data found on formula catalog.</div>;

                        return (
                          <div className="space-y-3 relative before:absolute before:bottom-2 before:top-2 before:left-[11px] before:w-[2px] before:bg-slate-150">
                            {ordTemplate.stages?.map((stage: any, idx: number) => {
                              const activeStageNum = selectedOrder.current_stage;
                              const isCompleted = activeStageNum > stage.stage_number || selectedOrder.status === 'completed';
                              const isActive = activeStageNum === stage.stage_number && selectedOrder.status === 'in_progress';
                              
                              // Find historical event payload
                              const historyEvent = selectedOrder.stage_history?.find((h: any) => h.stage_number === stage.stage_number);

                              let circleColor = 'bg-slate-200 text-slate-500';
                              let borderHighlight = 'border-slate-150';
                              if (isCompleted) { circleColor = 'bg-emerald-500 text-white'; borderHighlight = 'border-slate-200 bg-emerald-50/5'; }
                              else if (isActive) { circleColor = 'bg-indigo-600 text-white animate-pulse'; borderHighlight = 'border-indigo-300 bg-indigo-50/10'; }

                              return (
                                <div key={stage.stage_number} className={`flex gap-4 p-3 border rounded-xl relative ${borderHighlight}`}>
                                  {/* Milestone Dot Indicator */}
                                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] z-10 shrink-0 select-none ${circleColor}`}>
                                    {isCompleted ? <Check className="w-3.5 h-3.5" /> : stage.stage_number}
                                  </div>

                                  <div className="space-y-1 flex-1 min-w-0">
                                    <div className="flex justify-between items-center">
                                      <span className="font-extrabold text-slate-805 truncate">{stage.name}</span>
                                      {stage.inspection_required && (
                                        <span className="text-[8px] font-extrabold uppercase bg-amber-100 border border-amber-200 text-amber-800 px-1.5 rounded-sm">
                                          Safety Lock
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[10px] text-slate-400">
                                      Dwell boundaries: {stage.min_dwell_hours}h to {stage.max_dwell_hours}h limits
                                    </p>

                                    {/* Render execution state details if logged */}
                                    {historyEvent && (
                                      <div className="mt-1.5 p-1.5 bg-slate-100/50 rounded-lg text-[9px] font-mono text-slate-500 space-y-0.5">
                                        <div className="flex justify-between">
                                          <span>Entered: <b>{new Date(historyEvent.entered_at).toLocaleTimeString()}</b></span>
                                          {historyEvent.temperature_celsius !== null && (
                                            <span className="text-indigo-600 font-bold">Temp: {historyEvent.temperature_celsius}°C</span>
                                          )}
                                        </div>
                                        {historyEvent.approved_by_name && (
                                          <div className="flex justify-between border-t border-slate-200/50 pt-1 mt-1 text-slate-600">
                                            <span>Signed: <b>{historyEvent.approved_by_name}</b></span>
                                            <span className="italic">&ldquo;{historyEvent.notes}&rdquo;</span>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })()}
                    </div>

                    {/* Operational Action Buttons Section (Trigger Contextual Workflows) */}
                    <div className="p-4 bg-slate-50 border border-slate-205 rounded-2xl space-y-3">
                      <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Contextual Safety Controls</h4>
                      
                      {/* 1. STATE: SCHEDULED -> Commencing */}
                      {selectedOrder.status === 'scheduled' && (
                        <div className="space-y-2">
                          <p className="text-[11px] text-slate-500">
                            Provide the commencing cold-room thermometer temperature reading to stamp regulatory files.
                          </p>
                          <div className="flex gap-2">
                            <input 
                              type="number"
                              step="0.1"
                              value={actionTemp}
                              onChange={(e) => setActionTemp(e.target.value)}
                              className="w-1/2 bg-white border border-slate-250 rounded-xl p-2 font-bold text-center"
                              placeholder="Temp (°C) e.g. 2.1"
                            />
                            <button
                              onClick={() => handleStartOrder(selectedOrder.id)}
                              className="w-1/2 bg-slate-900 hover:bg-slate-800 text-white font-extrabold rounded-xl py-2 px-3 flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <Play className="w-4 h-4 shrink-0" />
                              <span>Commence Activity</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 2. STATE: IN_PROGRESS -> Stage approvals & completion */}
                      {selectedOrder.status === 'in_progress' && (
                        <div className="space-y-4">
                          
                          {/* STAGE SIGN-OFF FORM (If more steps exist) */}
                          {(() => {
                            const template = templates.find(t => t.id === selectedOrder.template_id);
                            const nextStage = template?.stages.find((s: any) => s.stage_number === selectedOrder.current_stage + 1);
                            
                            return (
                              <div className="space-y-2 pt-2.5 border-t border-slate-200/50">
                                <p className="text-[10px] uppercase font-extrabold text-indigo-750 block">Validate Dwell Limit & Cleanliness</p>
                                <div className="space-y-2.5">
                                  <div>
                                    <label className="text-[9px] text-slate-400 block font-bold">Inspector Signature</label>
                                    <input 
                                      type="text"
                                      value={actionInspector}
                                      onChange={(e) => setActionInspector(e.target.value)}
                                      className="w-full bg-white border border-slate-250 rounded-lg p-1.5 font-bold text-xs"
                                      placeholder={`Inspector name (e.g. Mercy Wanjiku)`}
                                    />
                                    <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Must be different from order creator ({selectedOrder.initiated_by})</span>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2">
                                    <div>
                                      <label className="text-[9px] text-slate-400 block font-bold">Temperature (°C)</label>
                                      <input 
                                        type="number"
                                        step="0.1"
                                        value={actionTemp}
                                        onChange={(e) => setActionTemp(e.target.value)}
                                        className="w-full bg-white border border-slate-250 rounded-lg p-1.5 text-center font-bold"
                                        placeholder="e.g. 5.6"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[9px] text-slate-400 block font-bold">Inspection logs</label>
                                      <input 
                                        type="text"
                                        value={actionNotes}
                                        onChange={(e) => setActionNotes(e.target.value)}
                                        className="w-full bg-white border border-slate-250 rounded-lg p-1.5"
                                        placeholder="Stage sanitized"
                                      />
                                    </div>
                                  </div>

                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handleAdvanceStage(selectedOrder)}
                                      className="w-full bg-teal-650 hover:bg-teal-700 text-white font-black py-2.5 px-3 rounded-xl flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <CheckCircle className="w-4.5 h-4.5 shrink-0" />
                                      <span>Signoff & Advance Stage</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}

                          {/* COMPLETE TO FINAL BATCH FORM */}
                          <div className="space-y-2 pt-3 border-t border-slate-200/50">
                            <p className="text-[10px] uppercase font-black text-rose-750 block">Complete and Produce Output Batch</p>
                            <div className="space-y-2 bg-rose-50/20 p-3 rounded-xl border border-rose-100">
                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">Actual Conversion Output Pack Qty</label>
                                <input 
                                  type="number"
                                  value={actionActualQty}
                                  onChange={(e) => setActionActualQty(e.target.value)}
                                  className="w-full bg-white border border-rose-300 font-extrabold text-rose-700 p-2 rounded-lg text-center text-xs"
                                  placeholder={`Planned: ${selectedOrder.qty_output_planned} packs`}
                                />
                                <span className="text-[9px] text-slate-400 font-medium block mt-0.5">Deviation exceeds ±10% rules blocks bypass & forces Auditor inspection.</span>
                              </div>

                              <div>
                                <label className="text-[9px] text-slate-400 block font-bold">Create Target Batch ID</label>
                                <input 
                                  type="text"
                                  value={actionOutputBatch}
                                  onChange={(e) => setActionOutputBatch(e.target.value)}
                                  className="w-full bg-white border border-slate-250 p-2 rounded-lg font-mono text-center text-xs"
                                  placeholder="BAT-ASM-(auto-generated)"
                                />
                              </div>

                              <button
                                onClick={() => handleCompleteOrder(selectedOrder)}
                                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-extrabold py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <span>Produce Convert Output</span>
                                <ArrowRight className="w-4 h-4" />
                              </button>
                            </div>
                          </div>

                        </div>
                      )}

                      {/* 3. STATE: INSPECTION_PENDING -> Deviant approve by non-initiator */}
                      {selectedOrder.status === 'inspection_pending' && (
                        <div className="space-y-3 pt-2 bg-rose-50 border border-rose-200 p-4 rounded-xl text-xs text-rose-950">
                          <div className="flex items-start gap-2 text-rose-700">
                            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-extrabold">Compliance Yield Alert!</p>
                              <p className="text-[10px] leading-relaxed">
                                The conversion resulted in actual output {selectedOrder.qty_output_actual} pk vs planned {selectedOrder.qty_output_planned} pk.
                                Deviation of {selectedOrder.yield_variance_pct}% exceeds 10% bounds.
                              </p>
                            </div>
                          </div>

                          <div className="border-t border-rose-200/50 pt-2 space-y-2">
                            {(() => {
                              const isSelfInitiator = currentUser?.id === selectedOrder.initiated_by || currentUser?.name === selectedOrder.initiated_by;
                              if (isSelfInitiator) {
                                return (
                                  <div className="bg-white/80 p-2 rounded border border-rose-100 text-[10px] font-bold text-rose-800 text-center">
                                    🛡️ self-approval prohibited. As initiator <b>[{selectedOrder.initiated_by}]</b>, you are locked from bypassing yield deviances.
                                  </div>
                                );
                              }

                              return (
                                <div className="space-y-2">
                                  <label className="text-[9px] text-rose-950 block font-bold">Assign Output Stock Batch</label>
                                  <input 
                                    type="text"
                                    value={actionOutputBatch}
                                    onChange={(e) => setActionOutputBatch(e.target.value)}
                                    className="w-full bg-white border border-rose-300 p-2 text-center text-xs font-mono rounded"
                                    placeholder={selectedOrder.output_batch_id || '(Auto BAT-ASM)'}
                                  />
                                  <button
                                    onClick={() => handleApproveYield(selectedOrder)}
                                    className="w-full bg-rose-650 hover:bg-rose-700 text-white py-2 px-3 rounded-lg font-black cursor-pointer shadow-xs text-xs text-center"
                                  >
                                    Authorize Deviances Bypass
                                  </button>
                                </div>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {/* 4. STATE: COMPLETED */}
                      {selectedOrder.status === 'completed' && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1.5 text-xs text-emerald-950">
                          <div className="flex items-center gap-1 text-emerald-600 font-bold">
                            <CheckCircle className="w-5 h-5" />
                            <span>CONVERSION COMPLETED</span>
                          </div>
                          <p className="text-[10px] text-emerald-800 leading-normal font-mono">
                            Dwell limits validated and stock committed under batch <b>{selectedOrder.output_batch_id}</b>. Ledger index locked.
                          </p>
                          <div className="text-[10px] text-slate-500 font-mono flex flex-col pt-1 border-t border-emerald-200/40">
                            <span>Deviation variance: {selectedOrder.yield_variance_pct || 0}%</span>
                            <span>Finished Timestamp: {new Date(selectedOrder.completed_at || '').toLocaleString()}</span>
                          </div>
                        </div>
                      )}

                    </div>

                  </div>
                )}

              </div>
            ) : (
              <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xxs space-y-4">
                <div className="border-b border-slate-100 pb-3">
                  <h3 className="font-extrabold text-sm text-slate-905 flex items-center gap-1.5">
                    <Layers className="h-4.5 w-4.5 text-slate-600" />
                    <span>Safety Conversion Standards Help</span>
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">REGULATORY FOOD CHAIN MANDATE</p>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Food items processed inside facility operations undergo conversion protocols tracked inside the KRA-Approved conversion stages.
                </p>
                <div className="bg-slate-50 border border-slate-150 p-4 rounded-2xl text-[11px] text-slate-500 space-y-2">
                  <p className="font-extrabold text-slate-700 uppercase tracking-wide">Quality Stage Guardrails:</p>
                  <ul className="list-disc list-inside space-y-1.5">
                    <li>Dwell periods are checked dynamically between stages based on minimum and maximum parameters.</li>
                    <li>Stage validation signatures are locked dynamically; validators must differ from context order creators.</li>
                    <li>Yield deviances over ±10% require dual-auth auditing and yield bypass authorizations.</li>
                  </ul>
                </div>
              </div>
            )}

          </div>

        </div>
      )}

    </div>
  );
}
