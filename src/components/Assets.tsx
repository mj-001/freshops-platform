import React, { useState, useEffect } from 'react';
import { User, Asset } from '../types';
import { 
  Plus, 
  Search, 
  MapPin, 
  RefreshCw, 
  ShieldCheck, 
  AlertTriangle, 
  HelpCircle, 
  FolderPlus, 
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  Sparkles
} from 'lucide-react';

interface AssetsPanelProps {
  currentUser: User | null;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function AssetsPanel({ currentUser, triggerToast }: AssetsPanelProps) {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [offline, setOffline] = useState(false);

  // Pagination states
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [warehouseFilter, setWarehouseFilter] = useState('ALL');

  // Add Asset modal / form state
  const [isAdding, setIsAdding] = useState(false);
  const [newUid, setNewUid] = useState('');
  const [newType, setNewType] = useState<'cooler_box' | 'insulated_tote' | 'crate' | 'gel_pack'>('cooler_box');
  const [newWarehouse, setNewWarehouse] = useState('RGN');
  const [newNotes, setNewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchAssets();
  }, [page, statusFilter, typeFilter, warehouseFilter]);

  const fetchAssets = async () => {
    setLoading(true);
    try {
      // Build filters query string
      let q = `?page=${page}&per_page=20`;
      if (statusFilter !== 'ALL') q += `&status=${statusFilter}`;
      if (warehouseFilter !== 'ALL') q += `&warehouse_id=${warehouseFilter}`;
      
      const res = await fetch(`/api/v1/assets${q}`);
      const data = await res.json();
      
      if (data.data) {
        let list: Asset[] = data.data;
        // Search filter client side if searchQuery is present
        if (searchQuery.trim() !== '') {
          const queryStr = searchQuery.toLowerCase();
          list = list.filter(a => 
            a.uid.toLowerCase().includes(queryStr) || 
            (a.notes && a.notes.toLowerCase().includes(queryStr))
          );
        }

        setAssets(list);
        if (data.pagination) {
          setTotalPages(data.pagination.total_pages || 1);
          setTotalItems(data.pagination.total || list.length);
        }
      }
      setOffline(false);
    } catch (err) {
      console.error(err);
      setOffline(true);
      triggerToast('Refresh failed. Using offline buffer.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUid.trim()) {
      triggerToast('UID is required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          uid: newUid.toUpperCase().trim(),
          type: newType,
          warehouse_id: newWarehouse,
          notes: newNotes
        })
      });
      const data = await res.json();
      if (data.data) {
        triggerToast('New returnable logistics asset declared.', 'success');
        setIsAdding(false);
        setNewUid('');
        setNewNotes('');
        fetchAssets();
      } else {
        triggerToast(data.error?.message || 'Failed to create asset', 'error');
      }
    } catch (err) {
      console.error(err);
      triggerToast('Network error saving asset', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Summaries numbers from local or fetched counts
  const availableCount = assets.filter(a => a.status === 'available').length;
  const transitCount = assets.filter(a => a.status === 'in_transit').length;
  const damagedCount = assets.filter(a => a.status === 'damaged').length;

  return (
    <div className="space-y-6">
      {/* Fallback offline message */}
      {offline && (
        <div className="bg-amber-50 border border-amber-200 text-amber-950 text-xs p-4 rounded-xl flex items-center justify-between font-bold">
          <span>Viewing cached assets data. Connection currently unstable.</span>
          <button onClick={fetchAssets} className="bg-white border border-amber-300 text-amber-900 px-3.5 py-1 rounded-lg">Retry</button>
        </div>
      )}

      {/* Stats Summary Widget */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Available On Deck</span>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-black text-slate-800">{availableCount}</span>
            <span className="text-[10px] text-slate-450">items ready</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active In Transit</span>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-black text-indigo-650">{transitCount}</span>
            <span className="text-[10px] text-indigo-500">courier vans</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Damaged / Quarantine</span>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-black text-rose-600">{damagedCount}</span>
            <span className="text-[10px] text-rose-500">needs inspection</span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Assets Limit</span>
          <div className="flex items-baseline space-x-1.5 mt-2">
            <span className="text-2xl font-black text-slate-800">{totalItems}</span>
            <span className="text-[10px] text-slate-450">registered</span>
          </div>
        </div>
      </div>

      {/* Main Filter Action Bar */}
      <div className="bg-white border border-slate-250 p-4.5 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left side filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status filter selector */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 min-h-[44px] font-bold"
            >
              <option value="ALL">All Statuses</option>
              <option value="available">Available</option>
              <option value="in_transit">In Transit</option>
              <option value="returned">Returned</option>
              <option value="damaged">Damaged</option>
              <option value="lost">Lost</option>
            </select>
          </div>

          {/* Type filter selector */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Asset Category</label>
            <select
              value={typeFilter}
              onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 min-h-[44px] font-bold"
            >
              <option value="ALL">All Categories</option>
              <option value="cooler_box">Cooler Box</option>
              <option value="insulated_tote">Insulated Tote</option>
              <option value="crate">Crate</option>
              <option value="gel_pack">Gel Pack</option>
            </select>
          </div>

          {/* Warehouse filter selector */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1">Depot</label>
            <select
              value={warehouseFilter}
              onChange={(e) => { setWarehouseFilter(e.target.value); setPage(1); }}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2 min-h-[44px] font-bold"
            >
              <option value="ALL">All Depots</option>
              <option value="RGN">Central Depot (RGN)</option>
              <option value="RGL">Regal Branch (RGL)</option>
            </select>
          </div>
        </div>

        {/* Search & Plus assets */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search asset UID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-800 outline-hidden min-h-[44px]"
            />
          </div>

          <button
            onClick={() => setIsAdding(true)}
            className="min-h-[44px] bg-slate-905 hover:bg-slate-800 text-white text-xs font-bold px-4 rounded-xl flex items-center space-x-1.5 shadow-sm cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Add Asset</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xxs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                <th className="p-3.5">Asset UID</th>
                <th className="p-3.5">Category Type</th>
                <th className="p-3.5 text-center">Home Depot</th>
                <th className="p-3.5 text-center">Status</th>
                <th className="p-3.5">Specifications & Remarks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5].map((idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-24"></div></td>
                  <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-20"></div></td>
                  <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-16 mx-auto"></div></td>
                  <td className="p-4"><div className="h-4 bg-slate-200 rounded-full w-16 mx-auto"></div></td>
                  <td className="p-4"><div className="h-4 bg-slate-200 rounded-md w-48"></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : assets.length === 0 ? (
        <div className="bg-white border rounded-xl p-12 text-center text-slate-400 space-y-2">
          <AlertTriangle className="h-7 w-7 text-slate-350 mx-auto" />
          <p className="text-sm font-bold">No packaging assets matches criteria.</p>
          <p className="text-xs">Adjust filter settings or barcode scan to synchronize.</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xxs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-widest">
                  <th className="p-3.5">Asset UID</th>
                  <th className="p-3.5">Category Type</th>
                  <th className="p-3.5 text-center">Home Depot</th>
                  <th className="p-3.5 text-center">Status</th>
                  <th className="p-3.5">Specifications & Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-705">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/50">
                    <td className="p-3.5 font-mono font-bold text-slate-950 text-sm">
                      {asset.uid}
                    </td>
                    <td className="p-3.5 capitalize font-semibold">
                      {asset.type.replace('_', ' ')}
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono">
                      {asset.warehouse_id}
                    </td>
                    <td className="p-3.5 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                        asset.status === 'available' ? 'bg-emerald-100 text-emerald-800' :
                        asset.status === 'in_transit' ? 'bg-indigo-100 text-indigo-800' :
                        asset.status === 'damaged' ? 'bg-rose-100 text-rose-800 animate-pulse' :
                        'bg-slate-100 text-slate-500'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-3.5 max-w-sm truncate text-xs text-slate-500 italic font-semibold">
                      {asset.notes || 'No remarks recorded.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Simple Pagination Footer */}
          <div className="flex items-center justify-between pt-2">
            <span className="text-xs text-slate-450 font-semibold">
              Showing page <b>{page}</b> of <b>{totalPages}</b> ({totalItems} assets)
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50 min-h-[44px]"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add asset modal */}
      {isAdding && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border shadow-xl space-y-5">
            <div className="flex justify-between items-center border-b pb-3">
              <div>
                <h3 className="text-sm font-black text-slate-900">Declare Returnable Asset</h3>
                <p className="text-[10px] text-slate-450">Register individual tracked items into system database</p>
              </div>
              <button 
                onClick={() => setIsAdding(false)}
                className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAsset} className="space-y-4 text-xs font-semibold text-slate-750">
              <div className="flex flex-col space-y-1">
                <label className="text-slate-500">Asset Barcode UID (Mandatory)</label>
                <input
                  type="text"
                  placeholder="e.g. CC-109, IT-112, CR-502"
                  value={newUid}
                  onChange={(e) => setNewUid(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 font-mono select-all min-h-[44px]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col space-y-1">
                  <label className="text-slate-500">Asset Category Type</label>
                  <select
                    value={newType}
                    onChange={(e) => setNewType(e.target.value as any)}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 min-h-[44px]"
                  >
                    <option value="cooler_box">Cooler Box</option>
                    <option value="insulated_tote">Insulated Tote</option>
                    <option value="crate">Crate</option>
                    <option value="gel_pack">Gel Pack</option>
                  </select>
                </div>

                <div className="flex flex-col space-y-1">
                  <label className="text-slate-500">Assigned Base Depot</label>
                  <select
                    value={newWarehouse}
                    onChange={(e) => setNewWarehouse(e.target.value)}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 min-h-[44px]"
                  >
                    <option value="RGN">Central Depot (RGN)</option>
                    <option value="RGL">Regal Branch (RGL)</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col space-y-1">
                <label className="text-slate-500">Tech Specifications & Remarks (Optional)</label>
                <textarea
                  placeholder="Describe material, brand, temperature limits..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  rows={3}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 focus:bg-white outline-hidden"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full min-h-[44px] bg-slate-905 hover:bg-slate-800 text-white font-bold rounded-xl flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin text-white" />}
                <span>Register Returning Asset</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
