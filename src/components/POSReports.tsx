import React, { useEffect, useState } from 'react';
import { User, Warehouse } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Loader2, TrendingUp } from 'lucide-react';

interface POSReportsProps {
  currentUser: User;
  warehouses: Warehouse[];
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

interface POSSummary {
  total_sales_cents: number;
  total_refunds_cents: number;
  net_revenue_cents: number;
  sale_count: number;
  average_basket_cents: number;
  by_payment_method: Record<string, { count: number; total_cents: number }>;
  top_skus: Array<{ sku_id: string; sku_name: string; qty: number; total_cents: number }>;
  revenue_by_day: Array<{ date: string; total_cents: number }>;
}

export default function POSReports({ currentUser, warehouses, triggerToast }: POSReportsProps) {
  const { currencyCode, format } = useCurrency();
  const [summary, setSummary] = useState<POSSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [from, setFrom] = useState(() => new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [warehouseId, setWarehouseId] = useState('');
  const [mode, setMode] = useState('');

  const fetchReport = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (warehouseId) params.set('warehouse_id', warehouseId);
      if (mode) params.set('mode', mode);
      const r = await fetch(`/api/v1/reports/pos-summary?${params}`);
      const d = await r.json();
      setSummary(d.data);
    } catch {
      triggerToast('Failed to load report', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchReport(); }, [from, to, warehouseId, mode]);

  const chartData = (summary?.revenue_by_day || []).map(d => ({
    date: d.date,
    [`Revenue (${currencyCode})`]: d.total_cents / 100
  }));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <TrendingUp className="h-7 w-7 text-teal-600" />
        <h1 className="text-2xl font-bold text-slate-900">POS Reports</h1>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 bg-white border border-slate-200 rounded-2xl p-4">
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400" />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Warehouse</label>
          <select value={warehouseId} onChange={e => setWarehouseId(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">All warehouses</option>
            {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-bold text-slate-500 block mb-1">Mode</label>
          <select value={mode} onChange={e => setMode(e.target.value)} className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400">
            <option value="">All modes</option>
            <option value="warehouse_desk">Warehouse Desk</option>
            <option value="retail">Retail</option>
          </select>
        </div>
      </div>

      {loading && <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-teal-500" /></div>}

      {!loading && summary && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Net Revenue</p>
              <p className="text-xl font-black font-mono text-teal-700 mt-1">{format(summary.net_revenue_cents)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Transactions</p>
              <p className="text-xl font-black font-mono text-slate-900 mt-1">{summary.sale_count}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Avg Basket</p>
              <p className="text-xl font-black font-mono text-slate-900 mt-1">{format(summary.average_basket_cents)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl p-4">
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Refunds</p>
              <p className="text-xl font-black font-mono text-rose-600 mt-1">{format(summary.total_refunds_cents)}</p>
            </div>
          </div>

          {/* Revenue by day */}
          {chartData.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="font-bold text-slate-900 mb-4">Revenue by Day</h2>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="date" stroke="#64748b" tickLine={false} axisLine={false} dy={8} tick={{ fontSize: 11 }} />
                    <YAxis stroke="#64748b" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }} />
                    <Bar dataKey={`Revenue (${currencyCode})`} fill="#0d9488" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Payment breakdown */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="font-bold text-slate-900 mb-3">Payment Methods</h2>
              <div className="space-y-2">
                {(['cash', 'mpesa', 'card'] as const).map(m => {
                  const data = summary.by_payment_method[m] || { count: 0, total_cents: 0 };
                  const pct = summary.total_sales_cents > 0 ? Math.round(data.total_cents / summary.total_sales_cents * 100) : 0;
                  return (
                    <div key={m}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium capitalize text-slate-700">{m === 'mpesa' ? 'M-Pesa' : m.charAt(0).toUpperCase() + m.slice(1)}</span>
                        <span className="font-mono font-bold text-slate-900">{format(data.total_cents)} <span className="text-xs text-slate-400">({data.count} txns)</span></span>
                      </div>
                      <div className="h-1.5 bg-slate-100 rounded-full">
                        <div className="h-1.5 bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Top SKUs */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5">
              <h2 className="font-bold text-slate-900 mb-3">Top 5 Products</h2>
              <div className="space-y-2">
                {summary.top_skus.length === 0 && <p className="text-slate-400 text-sm">No sales data</p>}
                {summary.top_skus.map((sku, i) => (
                  <div key={sku.sku_id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <span className="text-slate-700 truncate max-w-[150px]">{sku.sku_name}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-mono font-bold text-slate-900">{format(sku.total_cents)}</span>
                      <span className="text-xs text-slate-400 ml-1">({sku.qty} units)</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
