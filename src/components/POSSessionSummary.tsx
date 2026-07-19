import React, { useEffect, useState } from 'react';
import { User, TillSession, POSSale } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { ArrowLeft, Loader2, X, RotateCcw } from 'lucide-react';

interface POSSessionSummaryProps {
  currentUser: User;
  sessionId: string;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack: () => void;
}

export default function POSSessionSummary({ currentUser, sessionId, triggerToast, onBack }: POSSessionSummaryProps) {
  const { format } = useCurrency();
  const [session, setSession] = useState<TillSession | null>(null);
  const [sales, setSales] = useState<POSSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [refundModal, setRefundModal] = useState<POSSale | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/v1/pos/sessions/${sessionId}`);
      const d = await r.json();
      if (d.data) {
        setSession(d.data);
        setSales(d.data.sales || []);
      }
    } catch {
      triggerToast('Failed to load session', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [sessionId]);

  const handleRefund = async () => {
    if (!refundModal) return;
    const amtCents = Math.round(parseFloat(refundAmount) * 100);
    if (!refundReason.trim() || isNaN(amtCents) || amtCents <= 0) {
      triggerToast('Reason and valid amount required', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/v1/pos/sales/${refundModal.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refund_reason: refundReason, refund_amount_cents: amtCents })
      });
      const d = await r.json();
      if (!r.ok) { triggerToast(d.error?.message || 'Refund failed', 'error'); return; }
      triggerToast('Refund processed', 'success');
      setRefundModal(null);
      setRefundReason('');
      setRefundAmount('');
      await fetchData();
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: POSSale) => {
    if (s.status === 'refunded') return <span className="px-2 py-0.5 bg-rose-100 text-rose-700 rounded-full text-xs font-bold">Refunded</span>;
    if (s.status === 'partial_refund') return <span className="px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full text-xs font-bold">Part. Refund</span>;
    return <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-bold">Completed</span>;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>;
  if (!session) return <div className="p-6 text-slate-500">Session not found.</div>;

  const netRevenue = session.total_sales_cents - session.total_refunds_cents;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><ArrowLeft className="h-5 w-5" /></button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-slate-900">Session {session.id}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${session.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
              {session.status}
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${session.mode === 'retail' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
              {session.mode === 'retail' ? 'Retail' : 'Warehouse Desk'}
            </span>
          </div>
          <p className="text-sm text-slate-500 mt-0.5">Opened {new Date(session.opened_at).toLocaleString()}{session.closed_at ? ` · Closed ${new Date(session.closed_at).toLocaleString()}` : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Total Sales</p>
          <p className="text-xl font-black font-mono text-teal-700 mt-1">{format(session.total_sales_cents)}</p>
          <p className="text-xs text-slate-500 mt-0.5">{session.sale_count} transaction{session.sale_count !== 1 ? 's' : ''}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Refunds</p>
          <p className="text-xl font-black font-mono text-rose-600 mt-1">{format(session.total_refunds_cents)}</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Net Revenue</p>
          <p className={`text-xl font-black font-mono mt-1 ${netRevenue >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{format(netRevenue)}</p>
        </div>
        {session.status === 'closed' && session.cash_variance_cents !== null && (
          <div className={`border rounded-2xl p-4 ${Math.abs(session.cash_variance_cents) <= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Cash Variance</p>
            <p className={`text-xl font-black font-mono mt-1 ${session.cash_variance_cents >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{format(session.cash_variance_cents)}</p>
          </div>
        )}
      </div>

      {/* Sales table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-sm">Sales ({sales.length})</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left">Sale #</th>
                <th className="px-5 py-3 text-left">Time</th>
                <th className="px-5 py-3 text-left">Customer</th>
                <th className="px-5 py-3 text-right">Total</th>
                <th className="px-5 py-3 text-center">Payment</th>
                <th className="px-5 py-3 text-center">Status</th>
                <th className="px-5 py-3 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {sales.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-slate-400">No sales in this session</td></tr>
              )}
              {sales.map(sale => (
                <tr key={sale.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono font-bold text-slate-700">{sale.sale_number}</td>
                  <td className="px-5 py-3.5 text-slate-500">{new Date(sale.created_at).toLocaleTimeString()}</td>
                  <td className="px-5 py-3.5 text-slate-700">{sale.customer_name || <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold text-slate-900">{format(sale.total_cents)}</td>
                  <td className="px-5 py-3.5 text-center">
                    <span className="capitalize text-xs font-medium text-slate-600">{sale.payment_method}</span>
                  </td>
                  <td className="px-5 py-3.5 text-center">{statusBadge(sale)}</td>
                  <td className="px-5 py-3.5 text-center">
                    {sale.status !== 'refunded' && (
                      <button
                        onClick={() => { setRefundModal(sale); setRefundAmount((sale.total_cents / 100).toFixed(2)); setRefundReason(''); }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-50 border border-amber-200 rounded-lg transition-all cursor-pointer"
                      >
                        <RotateCcw className="h-3 w-3" /> Refund
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Refund modal */}
      {refundModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Refund Sale {refundModal.sale_number}</h3>
              <button onClick={() => setRefundModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Sale Total</span><span className="font-mono font-bold">{format(refundModal.total_cents)}</span></div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Refund Amount</label>
                <input
                  type="number"
                  min="0.01"
                  max={(refundModal.total_cents / 100).toFixed(2)}
                  step="0.01"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-600 block mb-1">Reason</label>
                <input
                  type="text"
                  placeholder="e.g. Customer changed mind, damaged product"
                  value={refundReason}
                  onChange={e => setRefundReason(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setRefundModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
              <button
                onClick={handleRefund}
                disabled={submitting}
                className="flex-1 py-2 bg-rose-600 text-white rounded-lg text-sm font-bold hover:bg-rose-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Processing…' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
