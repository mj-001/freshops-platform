import React, { useEffect, useState } from 'react';
import { Warehouse, SKU, Location, User } from '../types';
import { 
  ArrowLeftRight, 
  MapPin, 
  Layers, 
  Plus, 
  ShieldAlert, 
  CheckCircle2, 
  AlertTriangle,
  Send,
  UserCheck
} from 'lucide-react';
import TransferLogistics from './TransferLogistics';

interface TransfersProps {
  warehouses: Warehouse[];
  locations: Location[];
  skus: SKU[];
  currentUser: User | null;
  triggerRefresh: () => void;
  refreshFlag: number;
}

export default function Transfers({ warehouses, locations, skus, currentUser, triggerRefresh, refreshFlag }: TransfersProps) {
  const [activeMode, setActiveMode] = useState<'realloc' | 'logistics'>('realloc');
  const [transfers, setTransfers] = useState<any[]>([]);
  const [selectedTransfer, setSelectedTransfer] = useState<any | null>(null);
  
  // Create Form State
  const [isCreating, setIsCreating] = useState(false);
  const [fromWh, setFromWh] = useState('RGN');
  const [toWh, setToWh] = useState('RGL');
  const [tLines, setTLines] = useState<any[]>([{ sku_id: 'SKU-MILK', batch_id: '', from_location_id: 'L-RGN-CHL-01', to_location_id: 'L-RGL-CHL-01', qty_requested: 5 }]);
  const [notes, setNotes] = useState('');
  
  // Active Batches lookup
  const [activeBatches, setActiveBatches] = useState<any[]>([]);

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchTransfers();
    fetchActiveBatches();
  }, [refreshFlag]);

  const fetchTransfers = async () => {
    try {
      const res = await fetch('/api/v1/transfers');
      const payload = await res.json();
      if (payload.data) {
        setTransfers(payload.data);
      }
    } catch (err) {
      console.error('Error fetching transfers:', err);
    }
  };

  const fetchActiveBatches = async () => {
    try {
      // Query current stock to show which batches have quantity_available
      const res = await fetch('/api/v1/warehouses/RGN/stock');
      const payloadRGN = await res.json();
      const resL = await fetch('/api/v1/warehouses/RGL/stock');
      const payloadRGL = await resL.json();
      
      const combined = [...(payloadRGN.data || []), ...(payloadRGL.data || [])];
      setActiveBatches(combined);
    } catch (err) {
      console.error('Error fetching dynamic batches for transfers dropdown:', err);
    }
  };

  const handleSelectTransfer = async (tr: any) => {
    try {
      const res = await fetch(`/api/v1/transfers/${tr.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedTransfer(payload.data);
        setErrorMessage(null);
        setSuccessMessage(null);
      }
    } catch (err) {
      console.error('Error fetching transfer lines:', err);
    }
  };

  const handleCreateTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    // Form validating
    if (tLines.some(l => !l.batch_id || !l.qty_requested)) {
      setErrorMessage("All transfer lines must specify a valid Batch ID and non-zero quantity (BR-021)");
      return;
    }

    const payload = {
      from_warehouse_id: fromWh,
      to_warehouse_id: toWh,
      notes,
      lines: tLines.map(l => ({
        sku_id: l.sku_id,
        batch_id: l.batch_id,
        from_location_id: l.from_location_id,
        to_location_id: l.to_location_id,
        qty_requested: parseFloat(l.qty_requested)
      }))
    };

    try {
      const res = await fetch('/api/v1/transfers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message || 'Validation error');
      } else {
        setSuccessMessage(
          fromWh !== toWh
            ? 'Inter-Warehouse Transfer record registered. Status set to PENDING_APPROVAL.'
            : 'Intra-Warehouse Transfer executed instantly inside stock ledger.'
        );
        setIsCreating(false);
        setTLines([{ sku_id: 'SKU-MILK', batch_id: '', from_location_id: 'L-RGN-CHL-01', to_location_id: 'L-RGL-CHL-01', qty_requested: 5 }]);
        setNotes('');
        fetchTransfers();
        fetchActiveBatches();
        triggerRefresh();
      }
    } catch (err) {
      console.error('Error creating transfer:', err);
      setErrorMessage('Server connection failure.');
    }
  };

  const handleApproveTransfer = async (trId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/transfers/${trId}/approve`, {
        method: 'POST'
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        setSuccessMessage(`Inter-Warehouse Transfer approved! Atomic ledger write committed.`);
        setSelectedTransfer(null);
        fetchTransfers();
        fetchActiveBatches();
        triggerRefresh();
      }
    } catch (err) {
      console.error('Error approving transfer:', err);
      setErrorMessage('Connection error.');
    }
  };

  const addLine = () => {
    setTLines([...tLines, { sku_id: 'SKU-MILK', batch_id: '', from_location_id: 'L-RGN-CHL-01', to_location_id: 'L-RGL-CHL-01', qty_requested: 5 }]);
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs Toggle */}
      <div className="flex bg-slate-100 p-1 rounded-xl w-max border border-slate-200">
        <button
          onClick={() => setActiveMode('realloc')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'realloc' 
              ? 'bg-white text-slate-900 shadow-xs' 
              : 'text-slate-505 hover:text-slate-900'
          }`}
        >
          Stock Reallocations
        </button>
        <button
          onClick={() => setActiveMode('logistics')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            activeMode === 'logistics' 
              ? 'bg-white text-slate-900 shadow-xs' 
              : 'text-slate-550 hover:text-slate-900'
          }`}
        >
          Transfer Logistics & Replenishments
        </button>
      </div>

      {activeMode === 'logistics' ? (
        <TransferLogistics
          warehouses={warehouses}
          locations={locations}
          skus={skus}
          currentUser={currentUser}
          triggerRefresh={triggerRefresh}
          refreshFlag={refreshFlag}
        />
      ) : (
        <>
          {/* Messages */}
          {errorMessage && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2 animate-fadeIn">
              <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Transfer Blocked</p>
                <p>{errorMessage}</p>
              </div>
            </div>
          )}

          {successMessage && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2 animate-fadeIn">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div className="space-y-1">
                <p className="font-bold">Movement Completed</p>
                <p>{successMessage}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Transfers tracker */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ArrowLeftRight className="h-5 w-5 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">Active Stock Transfers</h2>
            </div>
            {!isCreating && (
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center space-x-1 px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Move Stock</span>
              </button>
            )}
          </div>

          {isCreating ? (
            <form onSubmit={handleCreateTransfer} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-4 text-xs">
              <div className="border-b border-slate-200 pb-1 flex justify-between">
                <span className="font-bold text-slate-800">New Move Instruction</span>
                <button type="button" onClick={() => setIsCreating(false)} className="text-slate-400 font-bold hover:text-slate-600">Cancel</button>
              </div>

              {/* Warehouses Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-0.5">Source Depot</label>
                  <select
                    value={fromWh}
                    onChange={(e) => setFromWh(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                  >
                    <option value="RGN">Regen Main (RGN)</option>
                    <option value="RGL">Regal PP (RGL)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-0.5">Dest Depot</label>
                  <select
                    value={toWh}
                    onChange={(e) => setToWh(e.target.value)}
                    className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                  >
                    <option value="RGN">Regen Main (RGN)</option>
                    <option value="RGL">Regal PP (RGL)</option>
                  </select>
                </div>
              </div>

              {/* Single Line transfer (multiple scoped for token count) */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-slate-500 uppercase text-[9px] tracking-widest">Line Item</span>
                </div>

                {tLines.map((line, idx) => {
                  // Filter batches holding stock at "fromWh" matching "line.sku_id"
                  const availableLines = activeBatches.filter(b => b.sku_id === line.sku_id && b.location_id.startsWith(`L-${fromWh}`));

                  return (
                    <div key={idx} className="p-3 bg-white border border-slate-100 rounded-lg space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 mb-0.5">SKU Product</label>
                          <select
                            value={line.sku_id}
                            onChange={(e) => {
                              const list = [...tLines];
                              list[idx].sku_id = e.target.value;
                              list[idx].batch_id = ''; // reset batch
                              setTLines(list);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 p-1 rounded"
                          >
                            {skus.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-0.5">Batch Sourced</label>
                          <select
                            value={line.batch_id}
                            onChange={(e) => {
                              const list = [...tLines];
                              list[idx].batch_id = e.target.value;
                              // Auto set source location of batch
                              const matching = availableLines.find(b => b.batch_id === e.target.value);
                              if (matching) {
                                list[idx].from_location_id = matching.location_id;
                              }
                              setTLines(list);
                            }}
                            className="w-full bg-slate-50 border border-slate-250 p-1 rounded font-mono"
                          >
                            <option value="">-- Choose Batch --</option>
                            {availableLines.map((item, id) => (
                              <option key={id} value={item.batch_id}>
                                {item.batch_id} ({item.qty_available} units at {item.location_id})
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        {/* From/To locations and qty */}
                        <div>
                          <label className="block text-slate-400 mb-0.5">From Location</label>
                          <input
                            type="text"
                            disabled
                            value={line.from_location_id}
                            className="w-full bg-slate-100 border border-slate-200 p-1 rounded"
                          />
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-0.5">To Location</label>
                          <select
                            value={line.to_location_id}
                            onChange={(e) => {
                              const list = [...tLines];
                              list[idx].to_location_id = e.target.value;
                              setTLines(list);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 p-1 rounded"
                          >
                            {locations.filter(l => l.warehouse_id === toWh).map(l => (
                              <option key={l.id} value={l.id}>{l.code}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-0.5">Move Qty</label>
                          <input
                            type="number"
                            min="1"
                            value={line.qty_requested}
                            onChange={(e) => {
                              const list = [...tLines];
                              list[idx].qty_requested = parseFloat(e.target.value) || 0;
                              setTLines(list);
                            }}
                            className="w-full bg-slate-50 border border-slate-200 p-1 rounded text-center"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {fromWh !== toWh && (
                <div className="p-2.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-lg flex items-start space-x-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                  <p className="text-[10px] leading-relaxed">
                    Note: Moving stock across RGN and RGL requires manager review before ledger validation commits.
                  </p>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t border-slate-200">
                <input
                  type="text"
                  placeholder="Transfer notes/realloc code (e.g., PUTAWAY-NBI)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full bg-white border border-slate-250 p-1.5 rounded-lg"
                />
                <button
                  type="submit"
                  className="w-full p-2 bg-slate-950 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors"
                >
                  Create Transfer Instruction
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {transfers.length === 0 ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center space-y-1">
                  <Layers className="h-6 w-6 text-slate-200" />
                  <p className="font-medium text-xs">No active transfer log recorded.</p>
                </div>
              ) : (
                transfers.map(tr => (
                  <div
                    key={tr.id}
                    onClick={() => handleSelectTransfer(tr)}
                    className={`p-3 border rounded-xl pointer transition-all ${
                      selectedTransfer?.id === tr.id 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                      : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold font-mono tracking-wide">{tr.id}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                        tr.status === 'completed' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {tr.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs flex justify-between">
                      <p className="font-medium">{tr.from_warehouse_id} ➜ {tr.to_warehouse_id}</p>
                      <p className="text-[10px] text-slate-400 font-mono">Date: {tr.created_at.slice(5, 10)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Right column: Action viewer */}
        <div className="lg:col-span-2">
          {selectedTransfer ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Transfer Slip Details ({selectedTransfer.id})</h2>
                  <p className="text-xs text-slate-500">Route path: {selectedTransfer.from_warehouse_id} to {selectedTransfer.to_warehouse_id}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full ${
                    selectedTransfer.status === 'completed' ? 'bg-emerald-100 text-emerald-850' : 'bg-amber-100 text-amber-850'
                  }`}>
                    {selectedTransfer.status}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/50 p-3 rounded-lg">
                <div>
                  <span className="text-slate-400 block font-medium">Slip Created By</span>
                  <span className="font-semibold text-slate-700">U-REC ({selectedTransfer.created_by})</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Approved / Verified By</span>
                  <span className="font-semibold text-slate-700">{selectedTransfer.approved_by || 'Pending Approval'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Creation Date</span>
                  <span className="font-semibold text-slate-700 font-mono">{selectedTransfer.created_at.replace('T', ' ').slice(0,16)}</span>
                </div>
                <div>
                  <span className="text-slate-400 block font-medium">Transfer Notes</span>
                  <span className="font-semibold text-slate-700 italic">"{selectedTransfer.notes || 'Realloc'}"</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold text-slate-900 mb-2">Transfer Item Lines</p>
                <div className="space-y-2">
                  {selectedTransfer.lines?.map((line: any, idx: number) => (
                    <div key={idx} className="p-3 border border-slate-100 rounded-xl flex items-center justify-between text-xs bg-slate-50/20">
                      <div className="space-y-1">
                        <p className="font-bold text-slate-800">{line.sku_name || line.sku_id}</p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1.5 font-mono">
                          <span>Batch: <b>{line.batch_id}</b></span>
                          <span>|</span>
                          <span>Path: {line.from_location_id} ➜ <b>{line.to_location_id}</b></span>
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-sm font-bold text-slate-900">{line.qty_requested} units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Approval controls */}
              {selectedTransfer.status === 'pending_approval' && (
                <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-1.5">
                    <UserCheck className="h-5 w-5 text-amber-500" />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      This is an Inter-Depot transfer. Authorize as <b className="text-slate-700">ops_manager</b> to commit to the Ledger.
                    </p>
                  </div>

                  {currentUser?.role === 'ops_manager' || currentUser?.role === 'admin' ? (
                    <button
                      onClick={() => handleApproveTransfer(selectedTransfer.id)}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      Approve & Execute Ledger Move
                    </button>
                  ) : (
                    <div className="bg-rose-50 border border-rose-200 text-rose-800 p-2 text-[10px] font-bold rounded-lg uppercase">
                      Roles Blocked: Select Manager Account to approve
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2 h-full flex flex-col items-center justify-center">
              <ArrowLeftRight className="h-8 w-8 text-slate-200" />
              <p className="text-sm font-bold text-slate-700">Stock Reallocations & Transfers</p>
              <p className="text-xs max-w-sm">Initiate transfers between different layout locations, or approve pending depot moves across Nairobi branches.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )}
</div>
  );
}
