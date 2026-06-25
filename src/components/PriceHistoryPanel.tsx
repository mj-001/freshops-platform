import React, { useState, useEffect } from 'react';
import { 
  History, 
  ChevronDown, 
  ChevronUp, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle, 
  Loader2, 
  Plus, 
  Calendar, 
  User, 
  HelpCircle,
  X,
  Check
} from 'lucide-react';
import { PriceHistory, User as UserType } from '../types';

interface PriceHistoryPanelProps {
  skuId: string;
  skuName: string;
  currentCostPrice: number;      // in cents
  currentSellingPrice: number;   // in cents
  currentUser: UserType | null;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
  onPriceChanged?: () => void;
}

export default function PriceHistoryPanel({
  skuId,
  skuName,
  currentCostPrice,
  currentSellingPrice,
  currentUser,
  triggerToast,
  onPriceChanged
}: PriceHistoryPanelProps) {
  const [history, setHistory] = useState<PriceHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Price adjustment form variables
  const [showForm, setShowForm] = useState(false);
  const [newCostKes, setNewCostKes] = useState('');
  const [newSellingKes, setNewSellingKes] = useState('');
  const [reason, setReason] = useState<string>('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  // Field errors validation
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});

  // Expansion limit toggling
  const [showAllHistory, setShowAllHistory] = useState(false);

  const canManage = currentUser?.role === 'admin' || currentUser?.role === 'ops_manager';

  const fetchPriceHistory = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/skus/${skuId}/price-history`);
      if (!res.ok) {
        throw new Error('Could not retrieve pricing ledger details.');
      }
      const json = await res.json();
      const historyData: PriceHistory[] = json.data || [];
      
      // Sort most-recent-first (by effective_from descending)
      const sorted = [...historyData].sort((a, b) => {
        return new Date(b.effective_from).getTime() - new Date(a.effective_from).getTime();
      });
      setHistory(sorted);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to fetch historical pricing details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPriceHistory();
  }, [skuId]);

  // Sync inputs on product change or load
  useEffect(() => {
    setNewCostKes((currentCostPrice / 100).toFixed(2));
    setNewSellingKes((currentSellingPrice / 100).toFixed(2));
    setReason('');
    setEffectiveFrom(new Date().toISOString().split('T')[0]);
    setNotes('');
    setFormError(null);
    setFieldErrors({});
    setShowForm(false);
  }, [skuId, currentCostPrice, currentSellingPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const errors: { [key: string]: string } = {};
    const costVal = parseFloat(newCostKes);
    const sellingVal = parseFloat(newSellingKes);

    if (isNaN(costVal) || costVal < 0) {
      errors.cost = 'Please provide a valid cost price (KES).';
    }
    if (isNaN(sellingVal) || sellingVal <= 0) {
      errors.selling = 'Please provide a valid positive selling price (KES).';
    }
    if (!reason) {
      errors.reason = 'Pricing reason is required.';
    }
    if (!effectiveFrom) {
      errors.effectiveFrom = 'Effective date is required.';
    }

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/skus/${skuId}/price-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cost_price_kes: Math.round(costVal * 100),
          selling_price_kes: Math.round(sellingVal * 100),
          effective_from: effectiveFrom + 'T00:00:00.000Z',
          reason,
          notes: notes.trim() || null
        })
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error?.message || 'Price adjustment request rejected by system validation.');
      }

      triggerToast?.('Core SKU pricing matrix updated successfully.', 'success');
      setShowForm(false);
      onPriceChanged?.();
      await fetchPriceHistory();
    } catch (err: any) {
      console.error(err);
      setFormError(err.message || 'Failed to authorize price change.');
    } finally {
      setSubmitting(false);
    }
  };

  const getReasonLabel = (reasonStr: string) => {
    switch (reasonStr) {
      case 'initial': return 'Initial Price';
      case 'supplier_increase': return 'Supplier Price Increase';
      case 'supplier_decrease': return 'Supplier Price Decrease';
      case 'repricing': return 'Strategic Repricing';
      case 'promotion': return 'Promotional Pricing';
      case 'correction': return 'Price Correction';
      case 'variance_approved': return 'POM Variance Approved';
      default: return reasonStr;
    }
  };

  const getReasonBadgeClass = (reasonStr: string) => {
    switch (reasonStr) {
      case 'initial': return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'supplier_increase': return 'bg-rose-50 text-rose-700 border-rose-150';
      case 'supplier_decrease': return 'bg-emerald-50 text-emerald-700 border-emerald-150';
      case 'repricing': return 'bg-indigo-50 text-indigo-700 border-indigo-150';
      case 'promotion': return 'bg-amber-50 text-amber-700 border-amber-150';
      case 'correction': return 'bg-sky-50 text-sky-700 border-sky-150';
      case 'variance_approved': return 'bg-teal-50 text-teal-700 border-teal-150';
      default: return 'bg-slate-100 text-slate-600 border-slate-205';
    }
  };

  const getDotColorClass = (reasonStr: string) => {
    switch (reasonStr) {
      case 'initial': return 'bg-slate-400 border-white ring-slate-100';
      case 'supplier_increase': return 'bg-rose-500 border-white ring-rose-100';
      case 'supplier_decrease': return 'bg-emerald-500 border-white ring-emerald-100';
      case 'repricing': return 'bg-indigo-50 border-white ring-indigo-100';
      case 'promotion': return 'bg-amber-500 border-white ring-amber-100';
      case 'correction': return 'bg-sky-500 border-white ring-sky-100';
      case 'variance_approved': return 'bg-teal-500 border-white ring-teal-100';
      default: return 'bg-slate-400 border-white ring-slate-100';
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Delta calculation: Only between index 0 & index 1 (the two most recent logged items)
  let deltaCostElement: React.ReactNode = null;
  if (history.length >= 2) {
    const currentCost = history[0].cost_price_kes / 100;
    const previousCost = history[1].cost_price_kes / 100;
    const diff = currentCost - previousCost;
    if (diff > 0) {
      deltaCostElement = (
        <span className="inline-flex items-center gap-0.5 text-rose-600 text-[10px] font-black">
          <TrendingUp className="h-3 w-3" />
          Cost ↑ KES {diff.toFixed(2)}
        </span>
      );
    } else if (diff < 0) {
      deltaCostElement = (
        <span className="inline-flex items-center gap-0.5 text-emerald-600 text-[10px] font-black">
          <TrendingDown className="h-3 w-3" />
          Cost ↓ KES {Math.abs(diff).toFixed(2)}
        </span>
      );
    }
  }

  const displayedHistory = showAllHistory ? history : history.slice(0, 5);

  return (
    <div className="space-y-4">
      {/* Section Header Accordion / Toggle bar */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
          <History className="h-3.5 w-3.5 text-slate-400" />
          Price History Registry
        </span>

        {canManage && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="text-[11px] font-black tracking-tight text-teal-600 hover:text-teal-700 hover:underline inline-flex items-center gap-0.5 cursor-pointer min-h-[44px]"
          >
            <span>↕ Change Price</span>
          </button>
        )}
      </div>

      {/* Pricing adjustment form */}
      {showForm && (
        <div className="bg-slate-50 border border-slate-205 rounded-xl p-4 space-y-4 animate-fadeIn">
          <div className="flex items-center justify-between border-b border-slate-150 pb-2">
            <span className="font-bold text-[11px] text-slate-800">Initiate SKU Pricing Matrix Adjustment</span>
            <button 
              onClick={() => setShowForm(false)} 
              className="text-slate-400 hover:text-slate-600 p-1 rounded-full cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-[11px] flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Cost Price (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0"
                  value={newCostKes}
                  onChange={(e) => {
                    setNewCostKes(e.target.value);
                    if (fieldErrors.cost) setFieldErrors(prev => { const c = {...prev}; delete c.cost; return c; });
                  }}
                  className="w-full bg-white text-slate-800 placeholder-slate-400 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                />
                {fieldErrors.cost && (
                  <p className="text-rose-600 text-[9px] mt-0.5 font-semibold">{fieldErrors.cost}</p>
                )}
              </div>

              <div>
                <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Selling Price (KES) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={newSellingKes}
                  onChange={(e) => {
                    setNewSellingKes(e.target.value);
                    if (fieldErrors.selling) setFieldErrors(prev => { const c = {...prev}; delete c.selling; return c; });
                  }}
                  className="w-full bg-white text-slate-800 placeholder-slate-400 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
                />
                {fieldErrors.selling && (
                  <p className="text-rose-600 text-[9px] mt-0.5 font-semibold">{fieldErrors.selling}</p>
                )}
              </div>
            </div>

            <div>
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Reason for Price Change *</label>
              <select
                required
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (fieldErrors.reason) setFieldErrors(prev => { const c = {...prev}; delete c.reason; return c; });
                }}
                className="w-full bg-white text-slate-800 border border-slate-250 rounded-lg px-2 py-1.5 text-xs focus:border-teal-500 focus:outline-hidden"
              >
                <option value="">-- Choose reason --</option>
                <option value="supplier_increase">Supplier price increase</option>
                <option value="supplier_decrease">Supplier price decrease</option>
                <option value="repricing">Strategic repricing</option>
                <option value="promotion">Promotional pricing</option>
                <option value="correction">Price correction</option>
              </select>
              {fieldErrors.reason && (
                <p className="text-rose-600 text-[9px] mt-0.5 font-semibold">{fieldErrors.reason}</p>
              )}
            </div>

            <div>
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Effective Date *</label>
              <input
                type="date"
                required
                value={effectiveFrom}
                onChange={(e) => {
                  setEffectiveFrom(e.target.value);
                  if (fieldErrors.effectiveFrom) setFieldErrors(prev => { const c = {...prev}; delete c.effectiveFrom; return c; });
                }}
                className="w-full bg-white text-slate-800 border border-slate-250 rounded-lg px-2.5 py-1.5 text-xs focus:border-teal-500"
              />
              {fieldErrors.effectiveFrom && (
                <p className="text-rose-600 text-[9px] mt-0.5 font-semibold">{fieldErrors.effectiveFrom}</p>
              )}
            </div>

            <div>
              <label className="text-[9.5px] font-black text-slate-500 uppercase tracking-wider block mb-1">Logistics / Management Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Log cost authorization code, external price catalog reference, or vendor rep names..."
                className="w-full bg-white text-slate-800 placeholder-slate-400 border border-slate-250 rounded-lg p-2 text-xs focus:border-teal-500 focus:outline-hidden"
                rows={2}
              />
            </div>

            <div className="flex gap-2.5 justify-end pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setShowForm(false)}
                className="px-3.5 py-2.5 border border-slate-250 hover:bg-slate-100 font-bold text-slate-600 rounded-lg text-xs min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-55 text-white font-extrabold rounded-lg text-xs min-h-[44px] inline-flex items-center justify-center gap-1 cursor-pointer"
              >
                {submitting && <Loader2 className="h-3 w-3 animate-spin" />}
                Submit Price Change
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Main Ledger Content List */}
      {loading ? (
        <div className="flex items-center justify-center py-6 bg-slate-50/50 rounded-xl">
          <Loader2 className="h-4.5 w-4.5 text-slate-400 animate-spin mr-1.5" />
          <span className="text-slate-500 text-[11px] font-semibold">Decryption ledger lines...</span>
        </div>
      ) : error ? (
        <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-[11px] flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
          <span>{error}</span>
        </div>
      ) : history.length === 0 ? (
        <p className="text-slate-400 italic text-[11px] text-center py-4">No price history recorded yet.</p>
      ) : (
        <div className="space-y-4">
          <div className="relative pl-1">
            {/* The vertical timeline list */}
            <div className="space-y-4">
              {displayedHistory.map((item, index) => {
                const isCurrent = index === 0 && !showAllHistory; // With history sorted latest-first, the first item is current
                
                return (
                  <div key={item.id} className="relative pl-6">
                    {/* Visual Line connector */}
                    {index < displayedHistory.length - 1 && (
                      <div className="absolute left-1.5 top-3.5 bottom-[-16px] w-[1px] bg-slate-200"></div>
                    )}

                    {/* Dot Icon indicator */}
                    <div className={`absolute left-0 top-1 w-3 h-3 rounded-full border-2 ring-4 ${getDotColorClass(item.reason)}`}></div>

                    <div className="space-y-1">
                      {/* Metabar: Date + Badges */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
                        <span className="font-mono text-slate-500 font-bold">{formatDate(item.effective_from)}</span>
                        
                        <span className={`inline-flex px-1.5 py-0.2 rounded text-[8.5px] font-extrabold uppercase border ${getReasonBadgeClass(item.reason)}`}>
                          {getReasonLabel(item.reason)}
                        </span>

                        {isCurrent && (
                          <span className="inline-flex px-1.5 py-0.2 rounded text-[8.5px] font-black uppercase bg-teal-500/10 border border-teal-500/25 text-teal-700">
                            Current
                          </span>
                        )}
                      </div>

                      {/* Financial statistics row */}
                      <div className="text-[11px] text-slate-800 font-medium leading-none">
                        Cost <strong className="text-slate-900">KES {(item.cost_price_kes / 100).toFixed(2)}</strong> · 
                        Selling <strong className="text-slate-900">KES {(item.selling_price_kes / 100).toFixed(2)}</strong>
                      </div>

                      {/* Management details/notes line */}
                      {(item.notes || item.source_po_id || item.changed_by) && (
                        <div className="text-[9.5px] text-slate-400 leading-relaxed italic">
                          {item.notes && <span>{item.notes} </span>}
                          {item.source_po_id && <span className="font-mono">via PO {item.source_po_id} </span>}
                          {item.changed_by && <span>by {item.changed_by}</span>}
                        </div>
                      )}

                      {/* Show the Delta element right after the current entry if it exists */}
                      {index === 0 && deltaCostElement && (
                        <div className="pt-0.5 flex items-center">
                          {deltaCostElement}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Show more/less toggling for historical lines */}
          {history.length > 5 && (
            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowAllHistory(!showAllHistory)}
                className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
              >
                {showAllHistory ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Show less price history
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    Show {history.length - 5} more pricing records
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
