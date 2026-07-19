import React, { useEffect, useState } from 'react';
import { User, Warehouse, TillSession, POSMode } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { Store, ShoppingBag, X, Loader2, LogOut } from 'lucide-react';

interface POSHomeProps {
  currentUser: User;
  warehouses: Warehouse[];
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onGoToTill: (session: TillSession) => void;
}

export default function POSHome({ currentUser, warehouses, triggerToast, onGoToTill }: POSHomeProps) {
  const { format } = useCurrency();
  const [sessions, setSessions] = useState<TillSession[]>([]);
  const [openSession, setOpenSession] = useState<TillSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState<POSMode | null>(null);
  const [closeModal, setCloseModal] = useState(false);

  // Open session form
  const [formWarehouse, setFormWarehouse] = useState('');
  const [formFloat, setFormFloat] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Close session form
  const [actualCash, setActualCash] = useState('');

  const activeWarehouses = warehouses.filter(w => w.is_active !== false);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const r = await fetch('/api/v1/pos/sessions');
      const d = await r.json();
      if (d.data) {
        setSessions(d.data);
        const open = d.data.find((s: TillSession) => s.status === 'open');
        setOpenSession(open || null);
      }
    } catch {
      triggerToast('Failed to load sessions', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleOpenSession = async () => {
    if (!formWarehouse || !formFloat) {
      triggerToast('Select warehouse and enter float amount', 'error');
      return;
    }
    const floatCents = Math.round(parseFloat(formFloat) * 100);
    if (isNaN(floatCents) || floatCents < 0) {
      triggerToast('Invalid float amount', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/pos/sessions/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: openModal, warehouse_id: formWarehouse, float_amount_cents: floatCents, notes: formNotes || null })
      });
      const d = await r.json();
      if (!r.ok) { triggerToast(d.error?.message || 'Failed to open session', 'error'); return; }
      triggerToast('Till session opened', 'success');
      setOpenModal(null);
      setFormWarehouse(''); setFormFloat(''); setFormNotes('');
      await fetchSessions();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseSession = async () => {
    if (!openSession) return;
    const actualCents = Math.round(parseFloat(actualCash) * 100);
    if (isNaN(actualCents) || actualCents < 0) {
      triggerToast('Enter a valid cash amount', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const r = await fetch(`/api/v1/pos/sessions/${openSession.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actual_cash_cents: actualCents })
      });
      const d = await r.json();
      if (!r.ok) { triggerToast(d.error?.message || 'Failed to close session', 'error'); return; }
      triggerToast('Session closed', 'success');
      setCloseModal(false);
      setActualCash('');
      await fetchSessions();
    } finally {
      setSubmitting(false);
    }
  };

  const warehouse = (id: string) => warehouses.find(w => w.id === id);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>;
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
          <Store className="h-8 w-8 text-teal-600" /> Point of Sale
        </h1>
        <p className="text-slate-500 text-sm mt-1">Manage till sessions and process sales</p>
      </div>

      {openSession ? (
        <div className="bg-teal-50 border border-teal-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider mb-2 ${openSession.mode === 'retail' ? 'bg-indigo-100 text-indigo-700' : 'bg-amber-100 text-amber-700'}`}>
                {openSession.mode === 'retail' ? 'Retail' : 'Warehouse Desk'}
              </span>
              <h2 className="text-lg font-bold text-slate-900">Session Active — {warehouse(openSession.warehouse_id)?.name || openSession.warehouse_id}</h2>
              <p className="text-xs text-slate-500">
                Opened {new Date(openSession.opened_at).toLocaleString()} · {openSession.sale_count} sale{openSession.sale_count !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">Total Sales</p>
              <p className="text-2xl font-black font-mono text-teal-700">{format(openSession.total_sales_cents)}</p>
            </div>
          </div>
          <div className="flex gap-3 flex-wrap">
            <button
              onClick={() => onGoToTill(openSession)}
              className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl text-sm transition-all"
            >
              Go to Till
            </button>
            <button
              onClick={() => { setActualCash(''); setCloseModal(true); }}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-sm transition-all flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" /> Close Session
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <button
            onClick={() => { setOpenModal('warehouse_desk'); setFormWarehouse(activeWarehouses[0]?.id || ''); }}
            className="group p-8 bg-white border-2 border-slate-200 hover:border-amber-400 rounded-2xl text-left transition-all shadow-xs hover:shadow-md"
          >
            <Store className="h-10 w-10 text-amber-500 mb-3" />
            <h3 className="text-lg font-bold text-slate-900">Open Warehouse Desk Session</h3>
            <p className="text-sm text-slate-500 mt-1">Sell surplus, short-dated, or markdown stock. Price override allowed. Customer optional.</p>
          </button>
          <button
            onClick={() => { setOpenModal('retail'); setFormWarehouse(activeWarehouses[0]?.id || ''); }}
            className="group p-8 bg-white border-2 border-slate-200 hover:border-indigo-400 rounded-2xl text-left transition-all shadow-xs hover:shadow-md"
          >
            <ShoppingBag className="h-10 w-10 text-indigo-500 mb-3" />
            <h3 className="text-lg font-bold text-slate-900">Open Retail Session</h3>
            <p className="text-sm text-slate-500 mt-1">Published SKUs only. Catalogue pricing. Customer account required for each sale.</p>
          </button>
        </div>
      )}

      {/* Recent sessions */}
      {sessions.filter(s => s.status === 'closed').length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-3">Recent Sessions</h2>
          <div className="space-y-2">
            {sessions.filter(s => s.status === 'closed').slice(0, 5).map(s => (
              <div key={s.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm">
                <div>
                  <span className="font-mono font-bold text-slate-700">{s.id}</span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${s.mode === 'retail' ? 'bg-indigo-100 text-indigo-600' : 'bg-amber-100 text-amber-600'}`}>{s.mode === 'retail' ? 'Retail' : 'Desk'}</span>
                  <span className="ml-2 text-slate-400">{warehouse(s.warehouse_id)?.name || s.warehouse_id}</span>
                </div>
                <div className="text-right">
                  <span className="font-mono font-bold text-slate-900">{format(s.total_sales_cents)}</span>
                  <span className="text-slate-400 ml-2 text-xs">{s.sale_count} sales</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Open session modal */}
      {openModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">
                Open {openModal === 'retail' ? 'Retail' : 'Warehouse Desk'} Session
              </h3>
              <button onClick={() => setOpenModal(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Warehouse</label>
                <select
                  value={formWarehouse}
                  onChange={e => setFormWarehouse(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                >
                  <option value="">Select warehouse…</option>
                  {activeWarehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Float Amount</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formFloat}
                  onChange={e => setFormFloat(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Notes (optional)</label>
                <input
                  type="text"
                  placeholder="e.g. Saturday market session"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button onClick={() => setOpenModal(null)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
              <button
                onClick={handleOpenSession}
                disabled={submitting}
                className="flex-1 py-2 bg-teal-600 text-white rounded-lg text-sm font-bold hover:bg-teal-700 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Opening…' : 'Open Session'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close session modal */}
      {closeModal && openSession && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Close Session {openSession.id}</h3>
              <button onClick={() => setCloseModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="bg-slate-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Float</span><span className="font-mono font-bold">{format(openSession.float_amount_cents)}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Total Sales (Cash)</span><span className="font-mono font-bold text-teal-700">{format(openSession.total_sales_cents)}</span></div>
              <div className="flex justify-between border-t border-slate-200 pt-2"><span className="text-slate-700 font-bold">Expected Cash</span><span className="font-mono font-bold">{format(openSession.expected_cash_cents)}</span></div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 mb-1">Actual Cash Counted</label>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={actualCash}
                onChange={e => setActualCash(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
            </div>
            {actualCash && !isNaN(parseFloat(actualCash)) && (
              <div className={`p-3 rounded-lg text-sm font-bold ${Math.round(parseFloat(actualCash) * 100) >= openSession.expected_cash_cents ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                Variance: {format(Math.round(parseFloat(actualCash) * 100) - openSession.expected_cash_cents)}
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button onClick={() => setCloseModal(false)} className="flex-1 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-50 transition-all cursor-pointer">Cancel</button>
              <button
                onClick={handleCloseSession}
                disabled={submitting}
                className="flex-1 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 cursor-pointer"
              >
                {submitting ? 'Closing…' : 'Close Session'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
