import React, { useEffect, useState } from 'react';
import { Location, SKU, User } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { 
  ClipboardCheck, 
  Trash2, 
  Plus, 
  AlertTriangle, 
  CheckCircle2, 
  ShieldX, 
  ShieldAlert, 
  Layers,
  Search,
  UserCheck,
  Download,
  Printer
} from 'lucide-react';
import {
  exportCumulativeAuditLedger,
  exportCycleCountVoucher,
  exportWriteOffVoucher
} from '../utils/audit_pdf_generator';
import { countToBase, conversionSummary, displayQty } from '../utils/uom';
import { performQueueableRequest } from '../utils/offlineQueue';
import OfflineSyncHub from './OfflineSyncHub';

const getCategoryColor = (categoryId: string) => {
  switch (categoryId) {
    case 'CAT-DAIRY':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'CAT-MEAT':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    case 'CAT-PRODUCE':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'CAT-PACKAGED':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'CAT-FROZEN':
      return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    default:
      return 'bg-slate-100 text-slate-800 border-slate-200';
  }
};

const getInitials = (name: string) => {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

interface AuditsProps {
  locations: Location[];
  skus: SKU[];
  currentUser: User | null;
  triggerRefresh: () => void;
  refreshFlag: number;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Audits({ locations, skus, currentUser, triggerRefresh, refreshFlag, triggerToast }: AuditsProps) {
  const { currencyCode } = useCurrency();
  const [cycleCounts, setCycleCounts] = useState<any[]>([]);
  const [selectedCount, setSelectedCount] = useState<any | null>(null);
  
  // Write Offs List
  const [writeOffs, setWriteOffs] = useState<any[]>([]);
  const [selectedWriteOff, setSelectedWriteOff] = useState<any | null>(null);

  // Form Creation Cycle Count
  const [isCreatingCount, setIsCreatingCount] = useState(false);
  const [countWarehouse, setCountWarehouse] = useState('RGN');
  const [countZone, setCountZone] = useState('');
  const [countNotes, setCountNotes] = useState('');
  const [isWallToWall, setIsWallToWall] = useState(false);
  const [itemsPerSection, setItemsPerSection] = useState('');

  // Form Creation Write Off
  const [isCreatingWriteOff, setIsCreatingWriteOff] = useState(false);
  const [woWarehouse, setWoWarehouse] = useState('RGN');
  const [woLines, setWoLines] = useState<any[]>([{ sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-EARLY', location_id: 'L-RGN-CHL-01', qty: 2, reason: 'EXPIRED', value_cents: 14000 }]);
  const [woNotes, setWoNotes] = useState('');

  // Active inventory lookup for write-off select
  const [activeInventory, setActiveInventory] = useState<any[]>([]);

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Input states for counted entries
  const [countInputs, setCountInputs] = useState<{ [key: string]: number }>({});
  const [countFullUnits, setCountFullUnits] = useState<{ [key: string]: number }>({});
  const [countRemainderUnits, setCountRemainderUnits] = useState<{ [key: string]: number }>({});
  const [woFullUnits, setWoFullUnits] = useState(0);
  const [woRemainderUnits, setWoRemainderUnits] = useState(0);
  const [countLineNotes, setCountLineNotes] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    fetchCycleCounts();
    fetchWriteOffs();
    fetchActiveInventory();
  }, [refreshFlag]);

  const fetchCycleCounts = async () => {
    const res = await fetch('/api/v1/cycle-counts');
    const data = await res.json();
    if (data.data) setCycleCounts(data.data);
  };

  const fetchWriteOffs = async () => {
    const res = await fetch('/api/v1/write-offs');
    const data = await res.json();
    if (data.data) setWriteOffs(data.data);
  };

  const fetchActiveInventory = async () => {
    try {
      const resRGN = await fetch('/api/v1/warehouses/RGN/stock');
      const dataRGN = await resRGN.json();
      const resRGL = await fetch('/api/v1/warehouses/RGL/stock');
      const dataRGL = await resRGL.json();
      setActiveInventory([...(dataRGN.data || []), ...(dataRGL.data || [])]);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectCount = async (cnt: any) => {
    try {
      const res = await fetch(`/api/v1/cycle-counts/${cnt.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedCount(payload.data);
        setSelectedWriteOff(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        
        // Prepare line inputs
        const inputs: { [key: string]: number } = {};
        const notesObj: { [key: string]: string } = {};
        payload.data.lines.forEach((l: any) => {
          inputs[l.id] = l.counted_qty !== null ? l.counted_qty : l.system_qty;
          notesObj[l.id] = l.notes || '';
        });
        setCountInputs(inputs);
        setCountLineNotes(notesObj);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectWriteOff = async (wo: any) => {
    try {
      const res = await fetch(`/api/v1/write-offs/${wo.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedWriteOff(payload.data);
        setSelectedCount(null);
        setErrorMessage(null);
        setSuccessMessage(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateCountSheet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      warehouse_id: countWarehouse,
      zone_id: countZone || undefined,
      notes: countNotes,
      is_wall_to_wall: isWallToWall,
      items_per_section: itemsPerSection ? parseInt(itemsPerSection, 10) : undefined
    };

    try {
      const result = await performQueueableRequest(
        '/api/v1/cycle-counts',
        'POST',
        payload,
        `Start Cycle Count Sheet in ${countWarehouse}`
      );

      if (result.queued) {
        setSuccessMessage(`Cycle count queued offline successfully. It will synch automatically when connection is restored.`);
        setIsCreatingCount(false);
        setCountNotes('');

        const fakeVal = {
          id: 'PENDING-SYNC-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          warehouse_id: countWarehouse,
          notes: countNotes + ' (Queued Offline)',
          status: 'DRAFT',
          created_by: currentUser?.id || 'SYSTEM',
          created_at: new Date().toISOString(),
          is_wall_to_wall: isWallToWall,
          lines: []
        };
        setCycleCounts(prev => [fakeVal, ...prev]);
        setSelectedCount(fakeVal);
      } else if (result.success && result.data) {
        setSuccessMessage(`Cycle Counting sheet ${result.data.id} created successfully. Direct system stock snapshot recorded (skipping quarantined batches).`);
        setIsCreatingCount(false);
        setCountNotes('');
        fetchCycleCounts();
        handleSelectCount(result.data);
      } else {
        setErrorMessage(result.error || 'Server error.');
      }
    } catch (err) {
      setErrorMessage('Server connection error.');
    }
  };

  const handleLogCountLine = async (lineId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const counted = countInputs[lineId];
    const notesStr = countLineNotes[lineId];

    const payloadBody = { counted_qty: counted, notes: notesStr };
    try {
      if (String(selectedCount.id).startsWith('PENDING-SYNC-')) {
        setSuccessMessage('Count line recorded offline (waiting for sheet creation sync).');
        setSelectedCount((prev: any) => {
          if (!prev) return null;
          const updatedLines = prev.lines ? [...prev.lines] : [];
          const lineIdx = updatedLines.findIndex((l: any) => l.id === lineId);
          if (lineIdx !== -1) {
            updatedLines[lineIdx] = { ...updatedLines[lineIdx], counted_qty: counted, notes: notesStr };
          }
          return { ...prev, lines: updatedLines };
        });
        return;
      }

      const result = await performQueueableRequest(
        `/api/v1/cycle-counts/${selectedCount.id}/lines/${lineId}`,
        'PATCH',
        payloadBody,
        `Record line ${lineId} count as ${counted} under Sheet ${selectedCount.id}`
      );

      if (result.queued) {
        setSuccessMessage('Count line recorded locally (queued offline).');
        setSelectedCount((prev: any) => {
          if (!prev) return null;
          const updatedLines = prev.lines ? [...prev.lines] : [];
          const lineIdx = updatedLines.findIndex((l: any) => l.id === lineId);
          if (lineIdx !== -1) {
            updatedLines[lineIdx] = { ...updatedLines[lineIdx], counted_qty: counted, notes: notesStr, status: 'QUEUED' };
          }
          return { ...prev, lines: updatedLines };
        });
      } else if (result.success) {
        setSuccessMessage('Count line recorded locally.');
        handleSelectCount(selectedCount);
      } else {
        setErrorMessage(result.error || 'Failed to update line count.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitCount = async () => {
    try {
      const res = await fetch(`/api/v1/cycle-counts/${selectedCount.id}/submit`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setErrorMessage(data.error.message);
      else {
        if (data.data.status === 'pending_approval') {
          setSuccessMessage('Count sheet submitted. High counting variance (>5% or 1 unit deviation) detected. Escalated to Ops Manager approval.');
        } else {
          setSuccessMessage('Zero-variance audit completed successfully. Stock counts match perfectly.');
        }
        fetchCycleCounts();
        handleSelectCount(data.data);
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleApproveCount = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/cycle-counts/${selectedCount.id}/approve`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setErrorMessage(data.error.message);
      else {
        setSuccessMessage('Cycle Count variance approved. Stock Ledger adjustments committed safely in ledger.');
        fetchCycleCounts();
        handleSelectCount(data.data);
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWriteOff = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const payload = {
      warehouse_id: woWarehouse,
      notes: woNotes,
      lines: woLines.map(l => ({
        sku_id: l.sku_id,
        batch_id: l.batch_id,
        location_id: l.location_id,
        qty: parseFloat(l.qty),
        reason: l.reason,
        value_cents: parseFloat(l.value_cents)
      }))
    };

    try {
      const result = await performQueueableRequest(
        '/api/v1/write-offs',
        'POST',
        payload,
        `Create Write-Off in Warehouse ${woWarehouse}`
      );

      if (result.queued) {
        setSuccessMessage(`Write-off queued offline successfully. It will sync automatically when connection is restored.`);
        setIsCreatingWriteOff(false);
        setWoNotes('');
        setWoLines([{ sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-EARLY', location_id: 'L-RGN-CHL-01', qty: 2, reason: 'EXPIRED', value_cents: 14000 }]);

        const fakeVal = {
          id: 'PENDING-SYNC-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
          warehouse_id: woWarehouse,
          notes: woNotes + ' (Queued Offline)',
          status: 'PENDING_APPROVAL',
          created_by: currentUser?.id || 'SYSTEM',
          created_at: new Date().toISOString(),
          lines: payload.lines
        };
        setWriteOffs(prev => [fakeVal, ...prev]);
        setSelectedWriteOff(fakeVal);
      } else if (result.success && result.data) {
        setSuccessMessage(`Write-off slip ${result.data.id} created successfully with status PENDING_APPROVAL.`);
        setIsCreatingWriteOff(false);
        setWoNotes('');
        setWoLines([{ sku_id: 'SKU-MILK', batch_id: 'B-MILK-EXP-EARLY', location_id: 'L-RGN-CHL-01', qty: 2, reason: 'EXPIRED', value_cents: 14000 }]);
        fetchWriteOffs();
        handleSelectWriteOff(result.data);
      } else {
        setErrorMessage(result.error || 'Server error.');
      }
    } catch (err) {
      setErrorMessage('Server connection error.');
    }
  };

  const handleApproveWriteOff = async (id: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/write-offs/${id}/approve`, { method: 'POST' });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        setSuccessMessage(`Write-off approved. Sourced inventory deducted from stock ledger.`);
        setSelectedWriteOff(null);
        fetchWriteOffs();
        triggerRefresh();
      }
    } catch (err) {
      setErrorMessage('Server communication failure.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Offline Sync Hub */}
      <OfflineSyncHub triggerToast={triggerToast} triggerRefresh={() => {
        triggerRefresh();
        fetchCycleCounts();
        fetchWriteOffs();
      }} />

      {/* Alert panels */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <ShieldAlert className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Security & Compliance Constraint Blocked</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Execution Confirmed</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Count Sheets and Write-offs Listings */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          
          {/* Compliance PDF Action Trigger */}
          <button
            type="button"
            onClick={() => exportCumulativeAuditLedger(cycleCounts, writeOffs, currencyCode)}
            className="w-full py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold tracking-tight transition-all shadow-xs flex items-center justify-center space-x-2 border border-slate-700/50 cursor-pointer"
          >
            <Download className="h-4 w-4 animate-bounce shrink-0" />
            <span>Export Compliance PDF Ledger</span>
          </button>

          {/* Cycle Counts section */}
          <div className="space-y-2">
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ClipboardCheck className="h-5 w-5 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900">Cycle Counting Lists</h2>
              </div>
              {!isCreatingCount && (
                <button
                  onClick={() => setIsCreatingCount(true)}
                  className="px-2 py-1 text-[10px] uppercase font-bold bg-slate-900 hover:bg-slate-800 text-white rounded"
                >
                  Schedule
                </button>
              )}
            </div>

            {isCreatingCount ? (
              <form onSubmit={handleCreateCountSheet} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3 text-xs">
                <p className="font-bold text-slate-800">Schedule Count Snapshot</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5">Depot Target</label>
                    <select
                      value={countWarehouse}
                      onChange={(e) => setCountWarehouse(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs font-bold"
                    >
                      <option value="RGN">Regen Warehouse</option>
                      <option value="RGL">Regal Plaza FP</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-0.5">Zone Lock</label>
                    <select
                      value={countZone}
                      onChange={(e) => setCountZone(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-1.5 rounded text-xs font-bold"
                    >
                      <option value="">Full site (All Zones)</option>
                      <option value="Z-RGN-AMB">Ambient</option>
                      <option value="Z-RGN-CHL">Chilled</option>
                      <option value="Z-RGN-COOL">Cool</option>
                    </select>
                  </div>
                </div>

                {/* Audit Type Selector Mode Split */}
                <div className="space-y-1">
                  <label className="block text-slate-400 font-bold mb-1">Audit Mode Option</label>
                  <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-200/60 rounded-lg">
                    <button
                      type="button"
                      onClick={() => {
                        setIsWallToWall(true);
                        setItemsPerSection('');
                      }}
                      className={`py-1.5 rounded-md font-bold text-center transition-all text-[11px] cursor-pointer ${
                        isWallToWall 
                          ? 'bg-white text-teal-800 shadow-3xs border border-teal-100' 
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      Wall-to-Wall Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsWallToWall(false);
                      }}
                      className={`py-1.5 rounded-md font-bold text-center transition-all text-[11px] cursor-pointer ${
                        !isWallToWall 
                          ? 'bg-white text-indigo-800 shadow-3xs border border-indigo-100' 
                          : 'text-slate-600 hover:text-slate-950'
                      }`}
                    >
                      Selective SKU Sample
                    </button>
                  </div>
                </div>

                {/* Conditional configuration blocks */}
                {isWallToWall ? (
                  <div className="bg-white border border-teal-100 p-2.5 rounded-xl text-[10px] text-slate-600 animate-fadeIn space-y-1">
                    <p className="font-extrabold text-teal-800 flex items-center space-x-1">
                      <span>âœ“ Wall-to-Wall Comprehensive Mode Active</span>
                    </p>
                    <p className="leading-normal text-slate-500">
                      Systematically lists every possible product (including active <b>0-balance lines</b> in this section) to verify vacant physical bins and detect unrecorded stock. Perfect for full compliance.
                    </p>
                  </div>
                ) : (
                  <div className="bg-white border border-indigo-100 p-2.5 rounded-xl text-[10px] text-slate-600 animate-fadeIn space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-indigo-800">Target items per section:</span>
                      <input
                        type="number"
                        placeholder="Limit (e.g. 35)"
                        min="1"
                        required
                        value={itemsPerSection}
                        onChange={(e) => setItemsPerSection(e.target.value)}
                        className="w-24 text-right bg-slate-50 border border-slate-200 p-1 rounded font-bold font-mono text-[10px]"
                      />
                    </div>
                    <p className="leading-normal text-slate-500">
                      Limit scheduled items per section. These are automatically selected and arranged <b>ascending-wise</b> per zone to maximize efficiency.
                    </p>
                  </div>
                )}

                <input
                  type="text"
                  placeholder="Count notes (e.g. Dairy Audit June)"
                  value={countNotes}
                  onChange={(e) => setCountNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 p-1 rounded font-medium"
                />
                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-500 font-bold text-white p-1 rounded cursor-pointer">Create Sheet</button>
                  <button type="button" onClick={() => setIsCreatingCount(false)} className="bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded cursor-pointer">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-1.5 max-h-[170px] overflow-y-auto">
                {cycleCounts.map(cnt => (
                  <div
                    key={cnt.id}
                    onClick={() => handleSelectCount(cnt)}
                    className={`p-2 border rounded-xl text-xs pointer transition-all flex items-center justify-between ${
                      selectedCount?.id === cnt.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold font-mono tracking-wide">{cnt.id}</p>
                      <p className={`text-[9px] ${selectedCount?.id === cnt.id ? 'text-slate-300' : 'text-slate-400'}`}>Site: {cnt.warehouse_id} | Date: {cnt.scheduled_date.slice(5, 10)}</p>
                    </div>
                    <span className="text-[9px] font-bold uppercase">{cnt.status}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Write-offs section */}
          <div className="space-y-2 pt-3 border-t border-slate-150 relative">
            {(currentUser?.role !== 'ops_manager' && currentUser?.role !== 'admin') && (
              <div className="absolute inset-x-0 -top-1 -bottom-4 bg-slate-100/75 backdrop-blur-[0.5px] rounded-xl flex flex-col items-center justify-center text-center p-4 z-10">
                <ShieldAlert className="h-7 w-7 text-rose-500 mb-1 animate-pulse" />
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">Manager Permission Lock</p>
                <p className="text-[10px] text-slate-500 max-w-[220px]">Only users authorized with the 'Manager' role can create or approve write-offs.</p>
              </div>
            )}
            <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Trash2 className="h-5 w-5 text-slate-600" />
                <h2 className="text-sm font-bold text-slate-900">Waste Write-Offs slips</h2>
              </div>
              {!isCreatingWriteOff && (
                <button
                  onClick={() => setIsCreatingWriteOff(true)}
                  className="px-2 py-1 text-[10px] uppercase font-bold bg-slate-900 hover:bg-slate-800 text-white rounded"
                  disabled={currentUser?.role !== 'ops_manager' && currentUser?.role !== 'admin'}
                >
                  Write-off
                </button>
              )}
            </div>

            {isCreatingWriteOff ? (
              <form onSubmit={handleCreateWriteOff} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3 text-xs">
                <p className="font-bold text-slate-800">Issue Write-Off Slip</p>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-0.5">Depot</label>
                    <select
                      value={woWarehouse}
                      onChange={(e) => setWoWarehouse(e.target.value)}
                      className="w-full bg-white border border-slate-200 p-1.5 rounded"
                    >
                      <option value="RGN">Regen warehouse</option>
                      <option value="RGL">Regal Plaza</option>
                    </select>
                  </div>
                </div>                {/* Single wo Line for layout safety with cost calculator */}
                {(() => {
                  const skuObj = skus.find(s => s.id === woLines[0].sku_id);
                  return (
                    <div className="p-2.5 bg-white rounded-lg border border-slate-100 space-y-2">
                      <label className="block text-slate-400 mb-0.5">Select Damaged Inventory</label>
                      <select
                        value={woLines[0].batch_id}
                        onChange={(e) => {
                          const matching = activeInventory.find(i => i.batch_id === e.target.value);
                          if (matching) {
                            const copy = [...woLines];
                            copy[0].batch_id = matching.batch_id;
                            copy[0].sku_id = matching.sku_id;
                            copy[0].location_id = matching.location_id;
                            // Calculate standard write cost as placeholder
                            const matchingSku = skus.find(s => s.id === matching.sku_id);
                            copy[0].value_cents = (matchingSku?.cost_price_cents || 50) * copy[0].qty;
                            setWoLines(copy);
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-150 p-1 text-[10px]"
                      >
                        <option value="">-- Choose Stock Batch --</option>
                        {activeInventory.filter(i => i.location_id.includes(woWarehouse)).map((item, idx) => (
                          <option key={idx} value={item.batch_id}>
                            {item.sku_name} (Batch: {item.batch_id} at {item.location_id})
                          </option>
                        ))}
                      </select>

                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <div>
                          <label className="block text-slate-400 mb-1">Write Qty ({skuObj?.count_unit || 'Crate'} / {skuObj?.remainder_unit || 'Units'})</label>
                          <div className="flex gap-1">
                            <input
                              type="number"
                              value={woFullUnits || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setWoFullUnits(val);
                                
                                const valBase = countToBase(val, woRemainderUnits, skuObj);
                                const copy = [...woLines];
                                copy[0].qty = valBase;
                                copy[0].value_cents = (skuObj?.cost_price_cents || 50) * valBase;
                                setWoLines(copy);
                              }}
                              className="w-1/2 border border-slate-150 rounded text-center p-1 font-bold text-xs"
                              placeholder={skuObj?.count_unit || 'Full'}
                            />
                            <input
                              type="number"
                              value={woRemainderUnits || ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                setWoRemainderUnits(val);
                                
                                const valBase = countToBase(woFullUnits, val, skuObj);
                                const copy = [...woLines];
                                copy[0].qty = valBase;
                                copy[0].value_cents = (skuObj?.cost_price_cents || 50) * valBase;
                                setWoLines(copy);
                              }}
                              className="w-1/2 border border-slate-150 rounded text-center p-1 font-bold text-xs"
                              placeholder={skuObj?.remainder_unit || 'Rem'}
                            />
                          </div>
                          <div className="mt-1 text-[9px] text-slate-500 font-medium font-mono leading-tight">
                            {skuObj && conversionSummary(woFullUnits, woRemainderUnits, skuObj)}
                          </div>
                        </div>
                        <div>
                          <label className="block text-slate-400">Reason</label>
                          <select
                            value={woLines[0].reason}
                            onChange={(e) => {
                              const copy = [...woLines];
                              copy[0].reason = e.target.value;
                              setWoLines(copy);
                            }}
                            className="w-full border border-slate-150 rounded p-1 font-bold"
                          >
                            <option value="EXPIRED">EXPIRED</option>
                            <option value="DAMAGED">DAMAGED</option>
                            <option value="LOST">LOST</option>
                            <option value="QUALITY">QUALITY</option>
                            <option value="THEFT">THEFT</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-400">Est {currencyCode} Value</label>
                          <input
                            type="number"
                            value={woLines[0].value_cents / 100}
                            onChange={(e) => {
                              const copy = [...woLines];
                              copy[0].value_cents = (parseFloat(e.target.value) || 0) * 100;
                              setWoLines(copy);
                            }}
                            className="w-full border border-slate-150 rounded text-center p-1 font-bold text-rose-700 bg-rose-50/20"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })()}

                <input
                  type="text"
                  placeholder="Write-off description/destruction notes..."
                  value={woNotes}
                  onChange={(e) => setWoNotes(e.target.value)}
                  className="w-full bg-white border border-slate-200 p-1.5 rounded"
                />

                <div className="flex gap-2">
                  <button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-500 font-bold text-white p-1 rounded">Discharge Slip</button>
                  <button type="button" onClick={() => setIsCreatingWriteOff(false)} className="bg-slate-200 text-slate-700 font-medium px-2 py-1 rounded">Cancel</button>
                </div>
              </form>
            ) : (
              <div className="space-y-1.5 max-h-[170px] overflow-y-auto">
                {writeOffs.map(wo => (
                  <div
                    key={wo.id}
                    onClick={() => handleSelectWriteOff(wo)}
                    className={`p-2 border rounded-xl text-xs pointer transition-all flex items-center justify-between ${
                      selectedWriteOff?.id === wo.id ? 'bg-slate-900 border-slate-900 text-white' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold font-mono tracking-wide">{wo.id}</p>
                      <p className={`text-[9px] ${selectedWriteOff?.id === wo.id ? 'text-slate-300' : 'text-slate-400'}`}>Depot: {wo.warehouse_id} | Value: {(wo.total_value_cents/100).toLocaleString()} KES</p>
                    </div>
                    <div className="flex items-center space-x-1.5 shrink-0">
                      <span className="text-[9px] font-bold uppercase">{wo.status}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          exportWriteOffVoucher(wo, currencyCode);
                        }}
                        className={`p-1 rounded border transition-all cursor-pointer ${
                          selectedWriteOff?.id === wo.id
                            ? 'bg-slate-800 border-slate-700 text-rose-300 hover:text-rose-100'
                            : 'bg-white border-slate-200 text-rose-600 hover:bg-rose-50'
                        }`}
                        title="Download Waste Slip PDF"
                      >
                        <Printer className="h-3 w-3 shrink-0" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Center & Right Column: Sub details viewer */}
        <div className="lg:col-span-2">
          {selectedCount ? (
            /* Selected count sheet details and entering counts */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center bg-slate-50/50 p-3 rounded-lg">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Cycle Counting Sheet ({selectedCount.id})</h2>
                    <button
                      type="button"
                      onClick={() => exportCycleCountVoucher(selectedCount, currencyCode)}
                      className="p-1 px-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-md transition-all text-[11px] font-bold flex items-center space-x-1 border border-indigo-200 bg-white shadow-xs cursor-pointer"
                      title="Save as PDF"
                    >
                      <Printer className="h-3.5 w-3.5 shrink-0" />
                      <span>PDF Voucher</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <p className="text-xs text-slate-500">Site snapshot target: <b>{selectedCount.warehouse_id}</b></p>
                    {selectedCount.is_wall_to_wall && (
                      <span className="bg-purple-150 text-purple-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-purple-200">
                        WALL-TO-WALL COMPLETE
                      </span>
                    )}
                    {selectedCount.items_per_section && (
                      <span className="bg-blue-100 text-blue-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200">
                        LIMIT: {selectedCount.items_per_section} SNAP LINES/ZONE
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 block">Status:</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    selectedCount.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-105 text-amber-850'
                  }`}>{selectedCount.status}</span>
                </div>
              </div>

              <p className="text-xxs text-slate-400 italic">
                * Operational rule: Standard system stock is snapshotted upon sheet creation. Counting discrepancy above Â±5% or Â±1 unit automatically flags variance blocks (BR-040).
              </p>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                <p className="text-xs font-bold text-slate-800 uppercase tracking-widest">Inventory Locations Sheet</p>
                {selectedCount.lines?.map((line: any, idx: number) => {
                  const isLocked = selectedCount.status === 'completed' || selectedCount.status === 'pending_approval';
                  
                  // Compute dynamic display variance
                  const varVal = countInputs[line.id] !== undefined ? (countInputs[line.id] - line.system_qty) : null;
                  const absVar = varVal !== null ? Math.abs(varVal) : 0;
                  const varPct = varVal !== null && line.system_qty > 0 ? Math.round((varVal / line.system_qty) * 100) : 0;
                  const deviates = absVar > 1 || Math.abs(varPct) > 5;

                  const targetSku = skus.find(s => s.id === line.sku_id);
                  const skuCategory = targetSku ? targetSku.category_id : '';

                  return (
                    <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex flex-col md:flex-row items-center gap-3 text-xs animate-fadeIn">
                      {/* Visual SKU confirmation thumbnail */}
                      <div className={`w-12 h-12 shrink-0 rounded-lg border flex items-center justify-center font-bold text-sm uppercase tracking-wider ${getCategoryColor(skuCategory)}`}>
                        {getInitials(line.sku_name || line.sku_id || '')}
                      </div>

                      <div className="flex-1 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 w-full">
                        <div>
                          <p className="font-bold text-slate-800">{line.sku_name || line.sku_id}</p>
                          <p className="text-[10px] text-slate-500 font-mono">Location: <b className="text-slate-800">{line.location_code}</b> | Batch: {line.batch_id}</p>
                        </div>

                        <div className="flex flex-wrap items-center gap-3">
                        <div className="text-right">
                          <span className="text-[10px] text-slate-400 block font-bold">System Qty</span>
                          <span className="font-bold text-slate-705 font-mono">{line.system_qty} pk</span>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-[10px] text-slate-400 block font-bold">Counted ({targetSku?.count_unit || 'Crate'} / {targetSku?.remainder_unit || 'Units'})</span>
                          <div className="flex gap-1.5 w-32">
                            <input
                              type="number"
                              disabled={isLocked}
                              value={countFullUnits[line.id] !== undefined ? countFullUnits[line.id] : ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const rems = countRemainderUnits[line.id] || 0;
                                const copyFull = { ...countFullUnits, [line.id]: val };
                                setCountFullUnits(copyFull);
                                
                                const copyCount = { ...countInputs };
                                copyCount[line.id] = countToBase(val, rems, targetSku);
                                setCountInputs(copyCount);
                              }}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-center font-bold text-xs"
                              placeholder={targetSku?.count_unit || 'Full'}
                            />
                            <input
                              type="number"
                              disabled={isLocked}
                              value={countRemainderUnits[line.id] !== undefined ? countRemainderUnits[line.id] : ''}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 0;
                                const fulls = countFullUnits[line.id] || 0;
                                const copyRem = { ...countRemainderUnits, [line.id]: val };
                                setCountRemainderUnits(copyRem);
                                
                                const copyCount = { ...countInputs };
                                copyCount[line.id] = countToBase(fulls, val, targetSku);
                                setCountInputs(copyCount);
                              }}
                              className="w-full bg-white border border-slate-200 rounded p-1 text-center font-bold text-xs"
                              placeholder={targetSku?.remainder_unit || 'Rem'}
                            />
                          </div>
                          <div className="text-[9px] text-slate-500 font-medium font-mono leading-tight">
                            {targetSku && conversionSummary(countFullUnits[line.id] || 0, countRemainderUnits[line.id] || 0, targetSku)}
                          </div>
                        </div>

                        {varVal !== null && varVal !== 0 && (
                          <div className="text-right whitespace-nowrap min-w-16">
                            <span className="text-[10px] text-slate-400 block font-bold">Variance</span>
                            <span className={`font-bold ${deviates ? 'text-rose-600' : 'text-amber-600'}`}>
                              {varVal > 0 ? `+${varVal}` : varVal} ({varPct}%)
                            </span>
                          </div>
                        )}

                        {!isLocked && (
                          <button
                            onClick={() => handleLogCountLine(line.id)}
                            className="p-1 px-2.5 bg-slate-900 border border-slate-950 text-white font-medium rounded animate-fadeIn"
                          >
                            Save
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
                })}
              </div>

              {/* Counts Footers */}
              <div className="border-t border-slate-100 pt-3 flex justify-end gap-2">
                {selectedCount.status === 'in_progress' && (
                  <button
                    onClick={handleSubmitCount}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs"
                  >
                    Submit Counting Sheet and Evaluate Variances
                  </button>
                )}

                {selectedCount.status === 'pending_approval' && (
                  <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                    <div className="flex items-start space-x-2 text-xs text-left">
                      <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div className="space-y-0.5 text-amber-900">
                        <p className="font-bold">Variance triggers approved verification!</p>
                        <p className="text-[11px] leading-relaxed">
                          Counting sheets has discrepancy values exceeding Â±5% or Â±1 unit threshold. Requires Ops Manager override to commit adjustments.
                        </p>
                      </div>
                    </div>

                    {(currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') ? (
                      <button
                        onClick={handleApproveCount}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs"
                      >
                        Authorize Ledger Adjustments
                      </button>
                    ) : (
                      <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded">
                        Roles Blocked: Select manager account to approve
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : selectedWriteOff ? (
            /* Selected write off details and approvals */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center bg-slate-50/50 p-3 rounded-lg">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-sm font-bold text-slate-900">Write-Off Slip details ({selectedWriteOff.id})</h2>
                    <button
                      type="button"
                      onClick={() => exportWriteOffVoucher(selectedWriteOff, currencyCode)}
                      className="p-1 px-1.5 text-rose-600 hover:text-rose-800 hover:bg-rose-50 rounded-md transition-all text-[11px] font-bold flex items-center space-x-1 border border-rose-200 bg-white shadow-xs cursor-pointer"
                      title="Save as PDF"
                    >
                      <Printer className="h-3.5 w-3.5 shrink-0" />
                      <span>PDF Voucher</span>
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Target site: <b>{selectedWriteOff.warehouse_id}</b></p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 block">Total Loss Value {currencyCode}</span>
                  <span className="text-base font-bold text-rose-700 font-mono">{(selectedWriteOff.total_value_cents / 100).toLocaleString() || '0'} KES</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-450 block font-semibold">Creator</span>
                  <span className="font-bold text-slate-800">U-OPS ({selectedWriteOff.created_by})</span>
                </div>
                <div>
                  <span className="text-slate-450 block font-semibold">Co-Signer Approver (BR-050)</span>
                  <span className="font-bold text-slate-800">{selectedWriteOff.approved_by || 'Awaiting second authorizer'}</span>
                </div>
              </div>

              <div className="pt-2">
                <p className="text-xs font-bold text-slate-900 mb-2">Damaged Stock Lines</p>
                {selectedWriteOff.lines?.map((line: any, idx: number) => {
                  const targetSku = skus.find(s => s.id === line.sku_id);
                  const skuCategory = targetSku ? targetSku.category_id : '';
                  return (
                    <div key={idx} className="p-3 bg-rose-50/20 border border-rose-100 rounded-xl flex items-center space-x-3 text-xs animate-fadeIn">
                      <div className={`w-10 h-10 shrink-0 rounded-lg border flex items-center justify-center font-bold text-xs uppercase tracking-wider ${getCategoryColor(skuCategory)}`}>
                        {getInitials(line.sku_name || line.sku_id || '')}
                      </div>
                      <div className="flex-1 flex items-center justify-between gap-1.5">
                        <div>
                          <p className="font-bold text-slate-800">{line.sku_name || line.sku_id}</p>
                          <p className="text-[10px] text-slate-500 font-mono">CODE: {line.sku_code} | Batch: {line.batch_id} at Location {line.location_id}</p>
                        </div>
                        <div className="text-right space-y-0.5 shrink-0">
                          <span className="text-xs font-bold text-slate-800 block">Deducted Qty: {line.qty} packs</span>
                          <span className="text-[10px] text-rose-750 bg-rose-100 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">{line.reason}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Approving controls */}
              {selectedWriteOff.status === 'pending_approval' && (
                <div className="border-t border-slate-100 pt-4 flex flex-col md:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-1.5 text-xs">
                    <UserCheck className="h-5 w-5 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-slate-500 leading-tight">
                      To prevent self-approval, co-signer MUST differ from Creator <b className="text-slate-700 font-bold">{selectedWriteOff.created_by}</b> (BR-050).
                    </p>
                  </div>

                  {currentUser?.role === 'ops_manager' || currentUser?.role === 'admin' ? (
                    <button
                      onClick={() => handleApproveWriteOff(selectedWriteOff.id)}
                      className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                    >
                      Co-Sign Loss Approval & Deduct Ledger
                    </button>
                  ) : (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-100 p-2 rounded">
                      Role Locked: Select Manager Account to approve
                    </span>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Welcome desk greeting */
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2 h-full flex flex-col items-center justify-center">
              <ClipboardCheck className="h-8 w-8 text-slate-200" />
              <p className="text-sm font-bold text-slate-700">Inventory Auditing & Waste Manager</p>
              <p className="text-xs max-w-sm">Schedule routine cycle counts with real-time snapshots, review stock count sheets, or record authorized write-off slips.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

