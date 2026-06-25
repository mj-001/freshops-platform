import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  TrendingUp, 
  Search, 
  Download, 
  ArrowUpDown, 
  DollarSign, 
  Percent, 
  ShoppingBag, 
  Package, 
  ArrowUpRight, 
  ArrowDownRight,
  RefreshCw,
  SlidersHorizontal
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
  LineChart,
  Line
} from 'recharts';

const downloadAsXLSX = (
  rows: (string | number | null)[][],
  filename: string
) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

interface SKUMarginItem {
  sku_id: string;
  sku_name: string;
  qty_ordered: number;
  revenue_kes: number;
  cogs_kes: number;
  profit_kes: number;
  margin_pct: number;
}

interface OrderMarginItem {
  order_id: string;
  customer_name: string;
  qty_ordered: number;
  revenue_kes: number;
  cogs_kes: number;
  profit_kes: number;
  margin_pct: number;
  created_at: string;
}

interface MarginReportProps {
  currentUser: any;
  triggerToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function MarginReport({ currentUser, triggerToast }: MarginReportProps) {
  const [activeTab, setActiveTab] = useState<'sku' | 'order'>('sku');
  const [skuData, setSkuData] = useState<SKUMarginItem[]>([]);
  const [orderData, setOrderData] = useState<OrderMarginItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [marginGroupFilter, setMarginGroupFilter] = useState<string>('All'); // 'All', 'High' (>30%), 'Mid' (15%-30%), 'Low' (0%-15%), 'Negative' (<0%)
  const [sortBy, setSortBy] = useState<string>('revenue_desc'); // revenue_desc, revenue_asc, margin_desc, margin_asc, profit_desc, qty_desc

  // Category and Prefix States
  const [skus, setSkus] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [skuNamePrefix, setSkuNamePrefix] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  useEffect(() => {
    const loadMetadata = async () => {
      try {
        const [skusRes, catRes] = await Promise.all([
          fetch('/api/v1/skus'),
          fetch('/api/v1/categories')
        ]);
        if (skusRes.ok) {
          const skusJson = await skusRes.json();
          setSkus(skusJson.data || []);
        }
        if (catRes.ok) {
          const catJson = await catRes.json();
          setCategories(catJson.data || []);
        }
      } catch (err) {
        console.error('Failed to prefetch margin report filtering metadata:', err);
      }
    };
    loadMetadata();
  }, []);

  const getSkuCategoryName = (skuId: string) => {
    const skuInfo = skus.find(s => s.id === skuId || s.code === skuId);
    if (!skuInfo) return 'General';
    const cat = categories.find(c => c.id === skuInfo.category_id);
    return cat ? cat.name : 'General';
  };

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      if (activeTab === 'sku') {
        const res = await fetch('/api/v1/reports/margin-by-sku');
        if (!res.ok) throw new Error('Failed to load margin report by SKU.');
        const payload = await res.json();
        setSkuData(payload.data || []);
      } else {
        const res = await fetch('/api/v1/reports/margin-by-order');
        if (!res.ok) throw new Error('Failed to load margin report by Order.');
        const payload = await res.json();
        setOrderData(payload.data || []);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Server connectivity failure or missing route.');
      triggerToast('Error updating margin analytics datasets.', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Sort & Filter functions
  const getFilteredSKUData = () => {
    let filtered = skuData.filter(item => {
      const matchesSearch = item.sku_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.sku_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesMargin = true;
      if (marginGroupFilter === 'High') matchesMargin = item.margin_pct >= 30;
      else if (marginGroupFilter === 'Mid') matchesMargin = item.margin_pct >= 15 && item.margin_pct < 30;
      else if (marginGroupFilter === 'Low') matchesMargin = item.margin_pct >= 0 && item.margin_pct < 15;
      else if (marginGroupFilter === 'Negative') matchesMargin = item.margin_pct < 0;

      // Category filter implementation
      let matchesCategory = true;
      if (selectedCategory !== 'All') {
        const skuInfo = skus.find(s => s.id === item.sku_id || s.code === item.sku_id);
        if (skuInfo) {
          matchesCategory = skuInfo.category_id === selectedCategory;
        } else {
          matchesCategory = false;
        }
      }

      // SKU name prefix filter implementation
      let matchesPrefix = true;
      if (skuNamePrefix.trim() !== '') {
        matchesPrefix = item.sku_name.toLowerCase().startsWith(skuNamePrefix.toLowerCase().trim());
      }

      return matchesSearch && matchesMargin && matchesCategory && matchesPrefix;
    });

    // Sort order
    filtered.sort((a, b) => {
      if (sortBy === 'revenue_desc') return b.revenue_kes - a.revenue_kes;
      if (sortBy === 'revenue_asc') return a.revenue_kes - b.revenue_kes;
      if (sortBy === 'margin_desc') return b.margin_pct - a.margin_pct;
      if (sortBy === 'margin_asc') return a.margin_pct - b.margin_pct;
      if (sortBy === 'profit_desc') return b.profit_kes - a.profit_kes;
      if (sortBy === 'qty_desc') return b.qty_ordered - a.qty_ordered;
      return 0;
    });

    return filtered;
  };

  const getFilteredOrderData = () => {
    let filtered = orderData.filter(item => {
      const matchesSearch = item.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.order_id.toLowerCase().includes(searchQuery.toLowerCase());
      
      let matchesMargin = true;
      if (marginGroupFilter === 'High') matchesMargin = item.margin_pct >= 30;
      else if (marginGroupFilter === 'Mid') matchesMargin = item.margin_pct >= 15 && item.margin_pct < 30;
      else if (marginGroupFilter === 'Low') matchesMargin = item.margin_pct >= 0 && item.margin_pct < 15;
      else if (marginGroupFilter === 'Negative') matchesMargin = item.margin_pct < 0;

      return matchesSearch && matchesMargin;
    });

    // Sort order
    filtered.sort((a, b) => {
      if (sortBy === 'revenue_desc') return b.revenue_kes - a.revenue_kes;
      if (sortBy === 'revenue_asc') return a.revenue_kes - b.revenue_kes;
      if (sortBy === 'margin_desc') return b.margin_pct - a.margin_pct;
      if (sortBy === 'margin_asc') return a.margin_pct - b.margin_pct;
      if (sortBy === 'profit_desc') return b.profit_kes - a.profit_kes;
      if (sortBy === 'qty_desc') return b.qty_ordered - a.qty_ordered;
      return 0;
    });

    return filtered;
  };

  // Calculations for KPI Cards
  const getTotals = () => {
    if (activeTab === 'sku') {
      const filtered = getFilteredSKUData();
      const revenue = filtered.reduce((acc, curr) => acc + curr.revenue_kes, 0);
      const cogs = filtered.reduce((acc, curr) => acc + curr.cogs_kes, 0);
      const profit = revenue - cogs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const totalUnits = filtered.reduce((acc, curr) => acc + curr.qty_ordered, 0);
      return { revenue, cogs, profit, margin, count: filtered.length, secondaryMetric: totalUnits, secondaryLabel: 'SKUs Active' };
    } else {
      const filtered = getFilteredOrderData();
      const revenue = filtered.reduce((acc, curr) => acc + curr.revenue_kes, 0);
      const cogs = filtered.reduce((acc, curr) => acc + curr.cogs_kes, 0);
      const profit = revenue - cogs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      const totalUnits = filtered.reduce((acc, curr) => acc + curr.qty_ordered, 0);
      return { revenue, cogs, profit, margin, count: filtered.length, secondaryMetric: totalUnits, secondaryLabel: 'Orders Recorded' };
    }
  };

  const totals = getTotals();

  // Color mapper helper for margin percentages
  const getMarginStyle = (margin: number) => {
    if (margin >= 30) {
      return {
        bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        text: 'text-emerald-600',
        badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        barColor: '#059669' // space emerald
      };
    } else if (margin >= 15) {
      return {
        bg: 'bg-blue-50 text-blue-700 border-blue-200',
        text: 'text-blue-600',
        badge: 'bg-blue-100 text-blue-800 border-blue-200',
        barColor: '#2563eb' // bright blue
      };
    } else if (margin >= 0) {
      return {
        bg: 'bg-amber-50 text-amber-700 border-amber-200',
        text: 'text-amber-600',
        badge: 'bg-amber-100 text-amber-800 border-amber-200',
        barColor: '#d97706' // amber gold
      };
    } else {
      return {
        bg: 'bg-rose-50 text-rose-700 border-rose-250',
        text: 'text-rose-600',
        badge: 'bg-rose-100 text-rose-800 border-rose-200',
        barColor: '#dc2626' // rose red
      };
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    
    if (activeTab === 'sku') {
      csvContent += 'FRESHOPS WMS - MARGIN REPORT BY SKU\r\n';
      csvContent += `Generated On: ,${new Date().toLocaleString()}\r\n`;
      csvContent += `Filters Applied: Search="${searchQuery}", Category="${selectedCategory}", Prefix="${skuNamePrefix}", MarginGroup="${marginGroupFilter}", Sort="${sortBy}"\r\n\r\n`;
      csvContent += 'SKU ID,Product Category,SKU Name,Qty Ordered,Revenue (KES),COGS Cost (KES),Gross Profit (KES),Margin %\r\n';
      
      getFilteredSKUData().forEach(item => {
        const escapedName = item.sku_name.replace(/"/g, '""');
        const catName = getSkuCategoryName(item.sku_id);
        csvContent += `${item.sku_id},"${catName.replace(/"/g, '""')}","${escapedName}",${item.qty_ordered},${item.revenue_kes},${item.cogs_kes},${item.profit_kes},${item.margin_pct}%\r\n`;
      });
    } else {
      csvContent += 'FRESHOPS WMS - MARGIN REPORT BY CLIENT ORDER\r\n';
      csvContent += `Generated On: ,${new Date().toLocaleString()}\r\n`;
      csvContent += `Filters Applied: Search="${searchQuery}", MarginGroup="${marginGroupFilter}", Sort="${sortBy}"\r\n\r\n`;
      csvContent += 'Order ID,Customer Name,Units Ordered,Order Date,Revenue (KES),COGS Cost (KES),Gross Profit (KES),Margin %\r\n';
      
      getFilteredOrderData().forEach(item => {
        const escapedCustomer = item.customer_name.replace(/"/g, '""');
        csvContent += `${item.order_id},"${escapedCustomer}",${item.qty_ordered},"${item.created_at}",${item.revenue_kes},${item.cogs_kes},${item.profit_kes},${item.margin_pct}%\r\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `freshops_margins_${activeTab}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Margin report exported successfully.', 'success');
  };

  const handleExportXLSX = () => {
    const rows: (string | number | null)[][] = [];

    if (activeTab === 'sku') {
      rows.push(['FRESHOPS WMS - MARGIN REPORT BY SKU']);
      rows.push([`Generated On: ${new Date().toLocaleString()}`]);
      rows.push([`Filters Applied: Search="${searchQuery}", Category="${selectedCategory}", Prefix="${skuNamePrefix}", MarginGroup="${marginGroupFilter}", Sort="${sortBy}"`]);
      rows.push([]);
      rows.push(['SKU ID', 'Product Category', 'SKU Name', 'Qty Ordered', 'Revenue (KES)', 'COGS Cost (KES)', 'Gross Profit (KES)', 'Margin %']);
      
      getFilteredSKUData().forEach(item => {
        const catName = getSkuCategoryName(item.sku_id);
        rows.push([
          item.sku_id,
          catName,
          item.sku_name,
          item.qty_ordered,
          item.revenue_kes,
          item.cogs_kes,
          item.profit_kes,
          `${item.margin_pct}%`
        ]);
      });
    } else {
      rows.push(['FRESHOPS WMS - MARGIN REPORT BY CLIENT ORDER']);
      rows.push([`Generated On: ${new Date().toLocaleString()}`]);
      rows.push([`Filters Applied: Search="${searchQuery}", MarginGroup="${marginGroupFilter}", Sort="${sortBy}"`]);
      rows.push([]);
      rows.push(['Order ID', 'Customer Name', 'Units Ordered', 'Order Date', 'Revenue (KES)', 'COGS Cost (KES)', 'Gross Profit (KES)', 'Margin %']);
      
      getFilteredOrderData().forEach(item => {
        rows.push([
          item.order_id,
          item.customer_name,
          item.qty_ordered,
          item.created_at,
          item.revenue_kes,
          item.cogs_kes,
          item.profit_kes,
          `${item.margin_pct}%`
        ]);
      });
    }

    downloadAsXLSX(rows, `freshops_margins_${activeTab}_report_${new Date().toISOString().slice(0, 10)}`);
    triggerToast('Margin report exported successfully.', 'success');
  };

  // Chart preparation
  const getChartData = () => {
    if (activeTab === 'sku') {
      return getFilteredSKUData().slice(0, 8).map(item => ({
        name: item.sku_name.length > 18 ? `${item.sku_name.slice(0, 15)}...` : item.sku_name,
        'Revenue (KES)': item.revenue_kes,
        'COGS (KES)': item.cogs_kes,
        'Profit (KES)': item.profit_kes,
        'Margin %': item.margin_pct
      }));
    } else {
      return getFilteredOrderData().slice(0, 8).map(item => ({
        name: item.order_id,
        'Revenue (KES)': item.revenue_kes,
        'COGS (KES)': item.cogs_kes,
        'Profit (KES)': item.profit_kes,
        'Margin %': item.margin_pct
      }));
    }
  };

  const chartData = getChartData();

  return (
    <div className="space-y-6 max-w-7xl mx-auto animate-fadeIn">
      {/* Header Block */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-slate-200 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 p-2 rounded-lg">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-extrabold tracking-tight text-slate-900">Enterprise Margin Ledger</h2>
              <p className="text-[11px] text-slate-500 font-mono">FINANCIAL FORENSICS & COGS EVALUATIONS</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 mt-2 max-w-xl">
            Real-time profitability tracking by stock keeping units and dispatch orders. Asserts cross-dock pricing accuracy, safety-stock valuation, and gross-margin thresholds.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setActiveTab('sku')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'sku' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <Package className="h-4 w-4" />
            By Stock Unit (SKU)
          </button>
          
          <button
            onClick={() => setActiveTab('order')}
            className={`px-4 py-2.5 text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'order' 
                ? 'bg-slate-900 text-white shadow-xs' 
                : 'bg-white hover:bg-slate-50 text-slate-700 border border-slate-200'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            By Dispatch Order
          </button>

          <button
            onClick={fetchData}
            title="Reload report data"
            className="p-2.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-600 cursor-pointer min-h-[40px] min-w-[40px] flex items-center justify-center transition"
          >
            <RefreshCw className={`h-4.5 w-4.5 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            onClick={handleExportCSV}
            disabled={loading || totals.count === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={loading || totals.count === 0}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            Export XLSX
          </button>
        </div>
      </div>

      {/* Load Errors Handling */}
      {error && (
        <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 text-center animate-fadeIn">
          <h3 className="text-sm font-bold text-rose-950 mb-1">Ledger Communication Failure</h3>
          <p className="text-xs text-rose-600 leading-normal mb-3">{error}</p>
          <button 
            onClick={fetchData}
            className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-lg transition"
          >
            Re-Authenticate & Retry
          </button>
        </div>
      )}

      {/* loading skeleton */}
      {loading ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-slate-100 border border-slate-200 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 bg-slate-100 border border-slate-200 rounded-2xl" />
            <div className="h-80 bg-slate-100 border border-slate-200 rounded-2xl" />
          </div>
          <div className="h-64 bg-slate-100 border border-slate-200 rounded-2xl" />
        </div>
      ) : (
        <>
          {/* KPI Dashboard Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Total Revenue */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:border-slate-300 transition duration-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Enterprise Sales Revenue</span>
              <div className="flex items-baseline space-x-1.5 mt-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {totals.revenue.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">KES</span>
              </div>
              <div className="mt-2.5 flex items-center text-[10px] text-slate-500 font-medium">
                <DollarSign className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
                <span>Computed across {totals.count} rows</span>
              </div>
            </div>

            {/* Total Cost is COGS */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:border-slate-300 transition duration-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Cost of Goods Sold (COGS)</span>
              <div className="flex items-baseline space-x-1.5 mt-2">
                <span className="text-2xl font-black text-slate-900 font-mono">
                  {totals.cogs.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">KES</span>
              </div>
              <div className="mt-2.5 flex items-center text-[10px] text-slate-500 font-medium">
                <Package className="h-3.5 w-3.5 text-slate-400 shrink-0 mr-1" />
                <span>{totals.secondaryMetric.toLocaleString()} units dispatched</span>
              </div>
            </div>

            {/* Net Gross Profit */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 relative overflow-hidden shadow-xs hover:border-slate-300 transition duration-300">
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">Gross Profit Yield</span>
              <div className="flex items-baseline space-x-1.5 mt-2">
                <span className={`text-2xl font-black font-mono ${totals.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {totals.profit.toLocaleString()}
                </span>
                <span className="text-xs font-semibold text-slate-500">KES</span>
              </div>
              <div className="mt-2.5 flex items-center text-[10px] font-semibold">
                {totals.profit >= 0 ? (
                  <span className="text-emerald-600 flex items-center">
                    <ArrowUpRight className="h-3.5 w-3.5" /> Positively yielding
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center">
                    <ArrowDownRight className="h-3.5 w-3.5" /> Deficit margin
                  </span>
                )}
              </div>
            </div>

            {/* Overall Gross Margin Percentage */}
            <div className={`border rounded-2xl p-5 relative overflow-hidden shadow-xs hover:shadow-sm transition duration-300 ${getMarginStyle(totals.margin).bg}`}>
              <span className="text-[10px] uppercase font-bold opacity-80 tracking-wider block">Gross Profit Margin %</span>
              <div className="flex items-baseline space-x-1 mt-2">
                <span className="text-2xl font-black font-mono">
                  {totals.margin.toFixed(2)}%
                </span>
              </div>
              <div className="mt-2.5 flex items-center text-[10px] font-bold">
                <Percent className="h-3.5 w-3.5 shrink-0 mr-1 opacity-70" />
                <span>Overall average margin yield</span>
              </div>
            </div>
          </div>

          {/* Graphical Analytics Charts Area */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Profitability Spread (Top 8 Rows)</h3>
                  <p className="text-[10px] text-slate-500">Vetting Revenue, Cost & Gross Profit Yields</p>
                </div>
                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 border px-2 py-0.5 rounded-lg uppercase">
                  Currency: KES
                </span>
              </div>
              
              {chartData.length === 0 ? (
                <div className="h-72 flex flex-col items-center justify-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                  <TrendingUp className="h-8 w-8 text-slate-350 mb-1.5" />
                  <p className="text-xs text-slate-400">No report metrics match selected criteria.</p>
                </div>
              ) : (
                <div className="h-72 w-full text-xs font-mono">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="name" stroke="#64748b" tickLine={false} axisLine={false} dy={8} />
                      <YAxis stroke="#64748b" tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ background: '#0f172a', borderRadius: '12px', border: 'none', color: '#fff' }}
                        cursor={{ fill: 'rgba(241, 245, 249, 0.6)' }}
                      />
                      <Legend verticalAlign="top" height={36} wrapperStyle={{ fontSize: '11px', fontWeight: 'bold' }} />
                      <Bar dataKey="Revenue (KES)" fill="#0f172a" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="COGS (KES)" fill="#64748b" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Profit (KES)" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div>
                <dt className="text-sm font-bold text-slate-900 mb-1">Margin Threshold Analysis</dt>
                <p className="text-[10px] text-slate-500 mb-4 font-mono">DISTRIBUTION OF TARGET YIELD RANGES</p>
                
                {/* Visualizer list thresholds */}
                <div className="space-y-3">
                  {/* High Margins */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span className="flex items-center gap-1.5 text-emerald-700">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        High Margins (≥ 30%)
                      </span>
                      <span className="text-slate-600 font-mono">
                        {skuData.length > 0 || orderData.length > 0 ? (
                          activeTab === 'sku' 
                            ? skuData.filter(i => i.margin_pct >= 30).length
                            : orderData.filter(i => i.margin_pct >= 30).length
                        ) : 0} items
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            activeTab === 'sku' 
                              ? (skuData.filter(i => i.margin_pct >= 30).length / (skuData.length || 1)) * 100
                              : (orderData.filter(i => i.margin_pct >= 30).length / (orderData.length || 1)) * 105
                          }%` 
                        }} 
                        className="bg-emerald-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>

                  {/* Mid Margins */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span className="flex items-center gap-1.5 text-blue-700">
                        <span className="h-2 w-2 rounded-full bg-blue-500" />
                        Target Yield (15% - 29%)
                      </span>
                      <span className="text-slate-600 font-mono">
                        {skuData.length > 0 || orderData.length > 0 ? (
                          activeTab === 'sku' 
                            ? skuData.filter(i => i.margin_pct >= 15 && i.margin_pct < 30).length
                            : orderData.filter(i => i.margin_pct >= 15 && i.margin_pct < 30).length
                        ) : 0} items
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            activeTab === 'sku' 
                              ? (skuData.filter(i => i.margin_pct >= 15 && i.margin_pct < 30).length / (skuData.length || 1)) * 100
                              : (orderData.filter(i => i.margin_pct >= 15 && i.margin_pct < 30).length / (orderData.length || 1)) * 100
                          }%` 
                        }} 
                        className="bg-blue-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>

                  {/* Low Margins */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span className="flex items-center gap-1.5 text-amber-700">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Low Yield (0% - 14%)
                      </span>
                      <span className="text-slate-600 font-mono">
                        {skuData.length > 0 || orderData.length > 0 ? (
                          activeTab === 'sku' 
                            ? skuData.filter(i => i.margin_pct >= 0 && i.margin_pct < 15).length
                            : orderData.filter(i => i.margin_pct >= 0 && i.margin_pct < 15).length
                        ) : 0} items
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            activeTab === 'sku' 
                              ? (skuData.filter(i => i.margin_pct >= 0 && i.margin_pct < 15).length / (skuData.length || 1)) * 100
                              : (orderData.filter(i => i.margin_pct >= 0 && i.margin_pct < 15).length / (orderData.length || 1)) * 100
                          }%` 
                        }} 
                        className="bg-amber-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>

                  {/* Negative Margins */}
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1 font-semibold">
                      <span className="flex items-center gap-1.5 text-rose-700">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Negative / Risk (&lt; 0%)
                      </span>
                      <span className="text-slate-600 font-mono">
                        {skuData.length > 0 || orderData.length > 0 ? (
                          activeTab === 'sku' 
                            ? skuData.filter(i => i.margin_pct < 0).length
                            : orderData.filter(i => i.margin_pct < 0).length
                        ) : 0} items
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                      <div 
                        style={{ 
                          width: `${
                            activeTab === 'sku' 
                              ? (skuData.filter(i => i.margin_pct < 0).length / (skuData.length || 1)) * 100
                              : (orderData.filter(i => i.margin_pct < 0).length / (orderData.length || 1)) * 100
                          }%` 
                        }} 
                        className="bg-rose-500 h-full transition-all duration-500" 
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 bg-slate-50/50 p-3.5 rounded-xl border">
                <span className="text-[10px] uppercase font-bold text-slate-500 block">Margin Health Diagnostics</span>
                <p className="text-[11px] text-slate-600 leading-normal mt-1">
                  Ensure all SKUs yield &gt;15% margin to offset fresh operations cold-chain storage and logistics waste overrides. Product bundles use bundled components calculations dynamically.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Filtering Area */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">Secure Audit Spreadsheet</h3>
                <p className="text-[10px] text-slate-500">Live search filter audit for regulatory reporting</p>
              </div>

              {/* Filtering layout */}
              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                {/* Search Bar */}
                <div className="relative flex-1 md:flex-none min-w-[200px]">
                  <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={activeTab === 'sku' ? 'Search by SKU name, ID...' : 'Search order number, client...'}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs bg-slate-50 hover:bg-slate-50/50 focus:outline-hidden focus:border-emerald-500"
                  />
                </div>

                {/* Margin Class Selector */}
                <div className="flex items-center space-x-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold hidden sm:inline">Margin:</span>
                  <select
                    value={marginGroupFilter}
                    onChange={(e) => setMarginGroupFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:outline-hidden"
                  >
                    <option value="All">All Yield Tiers</option>
                    <option value="High">High Margin (≥30%)</option>
                    <option value="Mid">Med Margin (15%-29%)</option>
                    <option value="Low">Low Margin (0%-14%)</option>
                    <option value="Negative">Deficit (&lt;0%)</option>
                  </select>
                </div>

                {/* Sort selector */}
                <div className="flex items-center space-x-1">
                  <span className="text-slate-400 text-[10px] uppercase font-bold hidden sm:inline">Sort:</span>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 font-bold focus:outline-hidden"
                  >
                    <option value="revenue_desc">Revenue: High to Low</option>
                    <option value="revenue_asc">Revenue: Low to High</option>
                    <option value="margin_desc">Margin: High to Low</option>
                    <option value="margin_asc">Margin: Low to High</option>
                    <option value="profit_desc">Profit Ledger: High to Low</option>
                    <option value="qty_desc">Volume: High to Low</option>
                  </select>
                </div>
              </div>
            </div>

            {activeTab === 'sku' && (
              <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl flex flex-wrap items-center gap-4 text-xs">
                {/* Product Category Filter Selector */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono">Product Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 font-bold text-slate-700 focus:outline-hidden focus:border-emerald-500"
                  >
                    <option value="All">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* SKU Name Prefix Text Field */}
                <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider font-mono shrink-0">SKU Name Prefix:</span>
                  <div className="relative w-full">
                    <input
                      type="text"
                      value={skuNamePrefix}
                      onChange={(e) => setSkuNamePrefix(e.target.value)}
                      placeholder="e.g. APP (matches Apples), BAN (matches Bananas)..."
                      className="w-full pl-3 pr-8 py-1.5 border border-slate-200 rounded-lg bg-white font-mono text-xs focus:outline-hidden focus:border-emerald-500"
                    />
                    {skuNamePrefix && (
                      <button
                        type="button"
                        onClick={() => setSkuNamePrefix('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 font-black text-sm"
                      >
                        ×
                      </button>
                    )}
                  </div>
                </div>

                {/* Reset button dynamic indicator */}
                {(selectedCategory !== 'All' || skuNamePrefix.trim() !== '') && (
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategory('All');
                      setSkuNamePrefix('');
                    }}
                    className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-705 font-bold rounded-lg transition cursor-pointer"
                  >
                    Reset SKU Filters
                  </button>
                )}
              </div>
            )}

            {/* List Data Table */}
            <div className="overflow-x-auto min-h-[160px]">
              {activeTab === 'sku' ? (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">SKU Code</th>
                      <th className="py-3 px-4">Product Name</th>
                      <th className="py-3 px-4">Category</th>
                      <th className="py-3 px-4 text-right">Qty Ordered</th>
                      <th className="py-3 px-4 text-right">Revenue (KES)</th>
                      <th className="py-3 px-4 text-right">COGS Cost (KES)</th>
                      <th className="py-3 px-4 text-right">Gross Profit (KES)</th>
                      <th className="py-3 px-4 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-mono">
                    {getFilteredSKUData().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No SKU margin items match selected search and category filter.
                        </td>
                      </tr>
                    ) : (
                      getFilteredSKUData().map((item) => {
                        const style = getMarginStyle(item.margin_pct);
                        const catName = getSkuCategoryName(item.sku_id);
                        return (
                          <tr key={item.sku_id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-900">{item.sku_id}</td>
                            <td className="py-3.5 px-4 font-sans text-slate-700 font-medium max-w-[200px] truncate">{item.sku_name}</td>
                            <td className="py-3.5 px-4 font-sans text-slate-500 font-medium max-w-[120px] truncate">
                              <span className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">
                                {catName}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-right text-slate-650">{item.qty_ordered.toLocaleString()} units</td>
                            <td className="py-3.5 px-4 text-right text-slate-900 font-bold">{item.revenue_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right text-slate-500">{item.cogs_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right text-emerald-650 font-semibold">{item.profit_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${style.badge}`}>
                                {item.margin_pct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-bold text-[10px] uppercase tracking-wider bg-slate-50/50">
                      <th className="py-3 px-4">Order ID</th>
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4 text-center">Date</th>
                      <th className="py-3 px-4 text-right">Units</th>
                      <th className="py-3 px-4 text-right">Revenue (KES)</th>
                      <th className="py-3 px-4 text-right">COGS Cost (KES)</th>
                      <th className="py-3 px-4 text-right">Gross Profit (KES)</th>
                      <th className="py-3 px-4 text-center">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-mono">
                    {getFilteredOrderData().length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-8 text-slate-400">
                          No dispatch order items match selected filter.
                        </td>
                      </tr>
                    ) : (
                      getFilteredOrderData().map((item) => {
                        const style = getMarginStyle(item.margin_pct);
                        return (
                          <tr key={item.order_id} className="hover:bg-slate-50/50 transition">
                            <td className="py-3.5 px-4 font-bold text-slate-900">{item.order_id}</td>
                            <td className="py-3.5 px-4 font-sans text-slate-700 font-medium max-w-[200px] truncate">{item.customer_name}</td>
                            <td className="py-3.5 px-4 text-center text-slate-500 text-[10px]">
                              {new Date(item.created_at).toLocaleDateString()}
                            </td>
                            <td className="py-3.5 px-4 text-right text-slate-600">{item.qty_ordered} u</td>
                            <td className="py-3.5 px-4 text-right text-slate-900 font-bold">{item.revenue_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right text-slate-500">{item.cogs_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-right text-emerald-650 font-semibold">{item.profit_kes.toLocaleString()}</td>
                            <td className="py-3.5 px-4 text-center">
                              <span className={`px-2 py-0.5 rounded-md font-bold text-[10px] border ${style.badge}`}>
                                {item.margin_pct.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
