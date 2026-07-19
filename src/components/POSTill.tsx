import React, { useEffect, useState, useRef } from 'react';
import { User, TillSession, POSSale, Customer } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { Search, Plus, Minus, Trash2, X, Printer, ShoppingCart, UserPlus, Loader2, ChevronRight } from 'lucide-react';

interface POSTillProps {
  currentUser: User;
  session: TillSession;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onBack: () => void;
}

interface SKUResult {
  id: string;
  name: string;
  code: string;
  temp_zone: string;
  unit_of_measure: string;
  available_qty: number;
  catalogue_price_cents: number;
  batches: Array<{ batch_id: string; batch_number: string; expiry_date: string; qty_available: number; location_id: string }>;
}

interface CartLine {
  sku_id: string;
  sku_name: string;
  batch_id: string;
  batch_number: string;
  expiry_date: string;
  qty: number;
  unit_price_cents: number;
  catalogue_price_cents: number;
  discount_pct: number;
  location_id: string;
}

export default function POSTill({ currentUser, session, triggerToast, onBack }: POSTillProps) {
  const { format } = useCurrency();
  const [query, setQuery] = useState('');
  const [skuResults, setSkuResults] = useState<SKUResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [customerQuery, setCustomerQuery] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [payMethod, setPayMethod] = useState<'cash' | 'mpesa' | 'card'>('cash');
  const [cashTendered, setCashTendered] = useState('');
  const [mpesaRef, setMpesaRef] = useState('');
  const [cardRef, setCardRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState<POSSale | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRetail = session.mode === 'retail';
  const isDesk = session.mode === 'warehouse_desk';

  // SKU search
  const doSearch = (q: string) => {
    if (searchRef.current) clearTimeout(searchRef.current);
    if (!q.trim()) { setSkuResults([]); return; }
    searchRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await fetch(`/api/v1/pos/skus?q=${encodeURIComponent(q)}&warehouse_id=${session.warehouse_id}&mode=${session.mode}`);
        const d = await r.json();
        setSkuResults(d.data || []);
      } finally {
        setSearching(false);
      }
    }, 300);
  };

  useEffect(() => { doSearch(query); }, [query]);

  // Customer search
  const searchCustomers = async (q: string) => {
    if (!q.trim()) { setCustomerResults([]); return; }
    const r = await fetch(`/api/v1/customers?search=${encodeURIComponent(q)}`);
    const d = await r.json();
    setCustomerResults(d.data?.slice(0, 6) || []);
  };

  const addToCart = (sku: SKUResult, customPrice?: number) => {
    const existing = cart.findIndex(l => l.sku_id === sku.id);
    const batch = sku.batches[0];
    const price = customPrice !== undefined ? customPrice : sku.catalogue_price_cents;
    if (existing >= 0) {
      const updated = [...cart];
      updated[existing] = { ...updated[existing], qty: updated[existing].qty + 1 };
      setCart(updated);
    } else {
      setCart(prev => [...prev, {
        sku_id: sku.id,
        sku_name: sku.name,
        batch_id: batch.batch_id,
        batch_number: batch.batch_number,
        expiry_date: batch.expiry_date,
        qty: 1,
        unit_price_cents: price,
        catalogue_price_cents: sku.catalogue_price_cents,
        discount_pct: 0,
        location_id: batch.location_id
      }]);
    }
    setQuery('');
    setSkuResults([]);
  };

  const updateLine = (idx: number, field: keyof CartLine, value: number) => {
    const updated = [...cart];
    (updated[idx] as any)[field] = value;
    if (field === 'discount_pct') {
      const base = updated[idx].catalogue_price_cents;
      updated[idx].unit_price_cents = Math.round(base * (1 - value / 100));
    }
    setCart(updated);
  };

  const removeLine = (idx: number) => setCart(prev => prev.filter((_, i) => i !== idx));

  const subtotal = cart.reduce((sum, l) => sum + l.unit_price_cents * l.qty, 0);
  const discountTotal = cart.reduce((sum, l) => sum + (l.catalogue_price_cents - l.unit_price_cents) * l.qty, 0);
  const total = subtotal;
  const cashTenderedCents = Math.round(parseFloat(cashTendered || '0') * 100);
  const changeDue = payMethod === 'cash' ? cashTenderedCents - total : null;

  const handleCharge = async () => {
    if (isRetail && !customer) { triggerToast('Customer required for retail', 'error'); return; }
    if (cart.length === 0) { triggerToast('Cart is empty', 'error'); return; }
    if (payMethod === 'cash' && cashTenderedCents < total) { triggerToast('Cash tendered is less than total', 'error'); return; }
    if (payMethod === 'mpesa' && !mpesaRef.trim()) { triggerToast('Enter M-Pesa reference', 'error'); return; }
    if (payMethod === 'card' && !cardRef.trim()) { triggerToast('Enter card reference', 'error'); return; }
    setSubmitting(true);
    try {
      const r = await fetch('/api/v1/pos/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: session.id,
          mode: session.mode,
          warehouse_id: session.warehouse_id,
          customer_id: customer?.id || null,
          lines: cart.map(l => ({ sku_id: l.sku_id, qty: l.qty, unit_price_cents: l.unit_price_cents, discount_pct: l.discount_pct })),
          payment_method: payMethod,
          mpesa_reference: payMethod === 'mpesa' ? mpesaRef : null,
          card_reference: payMethod === 'card' ? cardRef : null,
          cash_tendered_cents: payMethod === 'cash' ? cashTenderedCents : null
        })
      });
      const d = await r.json();
      if (!r.ok) { triggerToast(d.error?.message || 'Sale failed', 'error'); return; }
      setReceipt(d.data);
      setCart([]);
      setCustomer(null);
      setCustomerQuery('');
      setCashTendered('');
      setMpesaRef('');
      setCardRef('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Left — SKU Search */}
      <div className="w-1/2 flex flex-col border-r border-slate-200 bg-slate-50">
        <div className="p-4 bg-white border-b border-slate-200 flex items-center gap-3">
          <button onClick={onBack} className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"><X className="h-5 w-5" /></button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products by name or code…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white"
              autoFocus
            />
          </div>
          {searching && <Loader2 className="h-4 w-4 animate-spin text-teal-500" />}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {skuResults.map(sku => (
            <div key={sku.id} className="bg-white border border-slate-200 rounded-xl p-4 hover:border-teal-300 transition-all group">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{sku.name}</p>
                  <p className="text-xs text-slate-500 font-mono">{sku.code}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-medium">{sku.temp_zone}</span>
                    <span className="text-xs text-slate-500">{sku.available_qty} {sku.unit_of_measure} avail.</span>
                  </div>
                  {sku.batches[0] && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      Next batch: #{sku.batches[0].batch_number} · exp. {new Date(sku.batches[0].expiry_date).toLocaleDateString()}
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-mono font-bold text-teal-700 text-sm">{format(sku.catalogue_price_cents)}</p>
                  <button
                    onClick={() => addToCart(sku)}
                    className="mt-2 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add
                  </button>
                </div>
              </div>
            </div>
          ))}
          {query && !searching && skuResults.length === 0 && (
            <div className="text-center py-12 text-slate-400 text-sm">No products found for "{query}"</div>
          )}
          {!query && (
            <div className="text-center py-12 text-slate-400 text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              Search for a product to add to cart
            </div>
          )}
        </div>
      </div>

      {/* Right — Cart */}
      <div className="w-1/2 flex flex-col bg-white">
        {/* Cart lines */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {cart.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              <ShoppingCart className="h-10 w-10 mx-auto mb-3 text-slate-300" />
              Cart is empty
            </div>
          ) : cart.map((line, idx) => (
            <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 text-sm truncate">{line.sku_name}</p>
                  <p className="text-[10px] text-slate-400">Batch #{line.batch_number} · exp. {new Date(line.expiry_date).toLocaleDateString()}</p>
                </div>
                <button onClick={() => removeLine(idx)} className="text-rose-400 hover:text-rose-600 transition-colors cursor-pointer"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 block mb-0.5">Qty</label>
                  <div className="flex items-center gap-1">
                    <button onClick={() => line.qty > 1 ? updateLine(idx, 'qty', line.qty - 1) : removeLine(idx)} className="h-7 w-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"><Minus className="h-3 w-3" /></button>
                    <span className="font-mono font-bold text-sm w-8 text-center">{line.qty}</span>
                    <button onClick={() => updateLine(idx, 'qty', line.qty + 1)} className="h-7 w-7 rounded border border-slate-200 flex items-center justify-center hover:bg-slate-50 cursor-pointer"><Plus className="h-3 w-3" /></button>
                  </div>
                </div>
                {isDesk ? (
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-0.5">Discount %</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={line.discount_pct}
                      onChange={e => updateLine(idx, 'discount_pct', parseFloat(e.target.value) || 0)}
                      className="w-full border border-slate-200 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-teal-400"
                    />
                  </div>
                ) : <div />}
                <div className="text-right">
                  <label className="text-[10px] text-slate-400 block mb-0.5">Line Total</label>
                  <p className="font-mono font-bold text-sm text-teal-700">{format(line.unit_price_cents * line.qty)}</p>
                  {line.discount_pct > 0 && (
                    <p className="text-[10px] text-rose-500 font-medium">-{format((line.catalogue_price_cents - line.unit_price_cents) * line.qty)}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Customer */}
        <div className="border-t border-slate-200 p-4 space-y-2">
          <div className="relative">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-400 flex-shrink-0" />
              {customer ? (
                <div className="flex-1 flex items-center justify-between bg-teal-50 border border-teal-200 rounded-lg px-3 py-1.5">
                  <span className="text-sm font-bold text-teal-800">{customer.name}</span>
                  <button onClick={() => { setCustomer(null); setCustomerQuery(''); }} className="text-teal-500 hover:text-teal-700 cursor-pointer"><X className="h-4 w-4" /></button>
                </div>
              ) : (
                <input
                  type="text"
                  placeholder={isRetail ? 'Customer (required)…' : 'Customer (optional)…'}
                  value={customerQuery}
                  onChange={e => { setCustomerQuery(e.target.value); searchCustomers(e.target.value); }}
                  className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
                />
              )}
            </div>
            {customerResults.length > 0 && !customer && (
              <div className="absolute left-6 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg z-10 overflow-hidden">
                {customerResults.map(c => (
                  <button
                    key={c.id}
                    onClick={() => { setCustomer(c); setCustomerQuery(''); setCustomerResults([]); }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors flex items-center justify-between cursor-pointer border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium text-slate-800">{c.name}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="bg-slate-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between text-slate-500"><span>Subtotal</span><span className="font-mono">{format(subtotal)}</span></div>
            {discountTotal > 0 && <div className="flex justify-between text-rose-500"><span>Discount</span><span className="font-mono">-{format(discountTotal)}</span></div>}
            <div className="flex justify-between font-black text-slate-900 border-t border-slate-200 pt-1.5"><span>Total</span><span className="font-mono text-teal-700">{format(total)}</span></div>
          </div>

          {/* Payment */}
          <div className="flex gap-2">
            {(['cash', 'mpesa', 'card'] as const).map(m => (
              <button
                key={m}
                onClick={() => setPayMethod(m)}
                className={`flex-1 py-2 text-xs font-bold rounded-lg border transition-all cursor-pointer ${payMethod === m ? 'bg-teal-600 text-white border-teal-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}
              >
                {m === 'mpesa' ? 'M-Pesa' : m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
          {payMethod === 'cash' && (
            <div className="space-y-1">
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="Amount tendered"
                value={cashTendered}
                onChange={e => setCashTendered(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-400"
              />
              {changeDue !== null && changeDue >= 0 && (
                <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                  <span>Change Due</span><span className="font-mono">{format(changeDue)}</span>
                </div>
              )}
              {changeDue !== null && changeDue < 0 && (
                <p className="text-xs text-rose-500 font-bold">Insufficient — need {format(-changeDue)} more</p>
              )}
            </div>
          )}
          {payMethod === 'mpesa' && (
            <input
              type="text"
              placeholder="M-Pesa transaction code"
              value={mpesaRef}
              onChange={e => setMpesaRef(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          )}
          {payMethod === 'card' && (
            <input
              type="text"
              placeholder="Card reference / approval code"
              value={cardRef}
              onChange={e => setCardRef(e.target.value)}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
            />
          )}

          <button
            onClick={handleCharge}
            disabled={submitting || cart.length === 0}
            className="w-full py-3 bg-teal-600 hover:bg-teal-700 text-white font-black text-base rounded-xl transition-all disabled:opacity-50 cursor-pointer"
          >
            {submitting ? 'Processing…' : `Charge ${format(total)}`}
          </button>
        </div>
      </div>

      {/* Receipt modal */}
      {receipt && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-bold text-slate-900">Receipt #{receipt.sale_number}</h3>
              <button onClick={() => setReceipt(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer"><X className="h-5 w-5" /></button>
            </div>
            <div className="p-5 space-y-3 font-mono text-sm">
              <p className="text-slate-500 text-xs">{new Date(receipt.created_at).toLocaleString()}</p>
              {receipt.customer_name && <p className="text-slate-700">Customer: <strong>{receipt.customer_name}</strong></p>}
              <div className="border-t border-dashed border-slate-200 pt-3 space-y-1">
                {receipt.lines.map(l => (
                  <div key={l.id} className="flex justify-between text-xs">
                    <span className="flex-1 truncate">{l.sku_name} × {l.qty}</span>
                    <span className="ml-2">{format(l.line_total_cents)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-dashed border-slate-200 pt-3 space-y-1">
                {receipt.discount_total_cents > 0 && <div className="flex justify-between text-xs text-rose-500"><span>Discount</span><span>-{format(receipt.discount_total_cents)}</span></div>}
                <div className="flex justify-between font-black text-base"><span>Total</span><span>{format(receipt.total_cents)}</span></div>
                <div className="flex justify-between text-xs text-slate-500"><span>Paid via</span><span className="capitalize">{receipt.payment_method}</span></div>
                {receipt.change_due_cents !== null && receipt.change_due_cents > 0 && (
                  <div className="flex justify-between text-xs text-emerald-600 font-bold"><span>Change</span><span>{format(receipt.change_due_cents)}</span></div>
                )}
              </div>
            </div>
            <div className="p-5 border-t border-slate-200 flex gap-3">
              <button
                onClick={() => window.print()}
                className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-bold rounded-xl hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              <button
                onClick={() => setReceipt(null)}
                className="flex-1 py-2 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 transition-all cursor-pointer"
              >
                New Sale
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
