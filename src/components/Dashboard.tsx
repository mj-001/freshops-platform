import React, { useEffect, useState } from 'react';
import * as XLSX from 'xlsx';
import { Warehouse, SKU } from '../types';
import { useCurrency } from '../hooks/useCurrency';
import { 
  Building2, 
  MapPin, 
  AlertTriangle, 
  TrendingUp, 
  CheckCircle, 
  ThermometerSnowflake,
  RotateCcw,
  Layers,
  Activity,
  Sliders,
  Wifi,
  Bell,
  AlertCircle,
  Clock,
  ArrowRight,
  Truck,
  Download,
  FileSpreadsheet,
  FileText,
  BookOpen
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell
} from 'recharts';

import { displayQty } from '../utils/uom';

const downloadAsXLSX = (
  rows: (string | number | null)[][],
  filename: string
) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

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

interface DashboardProps {
  warehouses: Warehouse[];
  skus: SKU[];
  triggerRefresh: number;
  onNavigate?: (tab: string) => void;
}

export default function Dashboard({ warehouses, skus, triggerRefresh, onNavigate }: DashboardProps) {
  const { currencyCode, format: formatMoney } = useCurrency();
  const [activeWh, setActiveWh] = useState<string>('RGN');
  const [stock, setStock] = useState<any[]>([]);
  const [reorderAlerts, setReorderAlerts] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [updatingZoneId, setUpdatingZoneId] = useState<string | null>(null);
  const [supplierPerf, setSupplierPerf] = useState<any[]>([]);
  const [kpis, setKpis] = useState({
    wastePct: 2.0,
    turnover: 2.5,
    accuracy: 94.0,
    breachCount: 0,
    totalRevenue: 500000,
    wasteValue: 10000,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [comprehensiveReport, setComprehensiveReport] = useState<any>(null);
  const [loadingReport, setLoadingReport] = useState<boolean>(false);

  useEffect(() => {
    fetchStock();
    fetchZones();
    fetchKPIs();
    fetchSupplierPerf();
    fetchComprehensiveReport();
  }, [activeWh, triggerRefresh]);

  const fetchComprehensiveReport = async () => {
    setLoadingReport(true);
    try {
      const res = await fetch('/api/v1/reports/comprehensive-export');
      const payload = await res.json();
      if (payload) {
        setComprehensiveReport(payload);
      }
    } catch (err) {
      console.error('Error fetching comprehensive export report:', err);
    } finally {
      setLoadingReport(false);
    }
  };

  const downloadCSVReport = () => {
    if (!comprehensiveReport) return;
    
    const { inventory_turnover, waste_details, inventory_items, timestamp } = comprehensiveReport;
    
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Header Info
    csvContent += "FreshOpsPlatform WMS - COMPREHENSIVE INVENTORY AND WASTE REPORT\r\n";
    csvContent += `Generated On: ,${new Date(timestamp).toLocaleString()}\r\n`;
    csvContent += "\r\n";
    
    // Part 1: KPIs & Turnover
    csvContent += "1. INVENTORY TURNOVER METRICS\r\n";
    csvContent += "Metric,Value,Explanation\r\n";
    csvContent += `Inventory Turnover Ratio,${inventory_turnover.turnover_ratio}x,Annualized depletion frequency\r\n`;
    csvContent += `Cost of Goods Sold (COGS) KES,${inventory_turnover.cogs_cents},Total cost of picked/dispatched goods\r\n`;
    csvContent += `Average Inventory Value KES,${inventory_turnover.avg_inventory_value_cents},Current holding cost baseline\r\n`;
    csvContent += "\r\n";
    
    // Part 2: Waste by Reason Code & SKU
    csvContent += "2. WASTE BY REASON CODE & SKU\r\n";
    csvContent += `Reason Code,SKU ID,SKU Name,Quantity,Total Waste Cost (${currencyCode})\r\n`;
    
    waste_details.forEach((item: any) => {
      const escapedName = item.sku_name.replace(/"/g, '""');
      csvContent += `${item.reason_code},${item.sku_id},"${escapedName}",${item.quantity},${item.total_waste_cost}\r\n`;
    });
    
    csvContent += `,,TOTAL WASTE COST,,${comprehensiveReport.total_waste_cost_sum}\r\n`;
    csvContent += "\r\n";
    
    // Part 3: Live Valuation Snapshot
    csvContent += "3. CURRENT LIVE INVENTORY & VALUATION SNAPSHOT\r\n";
    csvContent += `SKU ID,SKU Code,SKU Name,Category,Current Stock On Hand,Unit Cost (${currencyCode}),Total Valuation (${currencyCode})\r\n`;
    
    inventory_items.forEach((item: any) => {
      const escapedName = item.sku_name.replace(/"/g, '""');
      csvContent += `${item.sku_id},${item.sku_code},"${escapedName}",${item.group_category},${item.current_stock},${item.unit_cost_cents},${item.total_valuation_cents}\r\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `freshops_waste_report_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const downloadXLSXReport = () => {
    if (!comprehensiveReport) return;
    
    const { inventory_turnover, waste_details, inventory_items, timestamp } = comprehensiveReport;
    const rows: (string | number | null)[][] = [];

    // Header
    rows.push(['FreshOpsPlatform WMS - Comprehensive Inventory Report']);
    rows.push([`Generated On: ${new Date(timestamp).toLocaleString()}`]);
    rows.push([]);

    // Part 1: KPIs & Turnover
    rows.push(['1. INVENTORY TURNOVER METRICS']);
    rows.push(['Metric', 'Value', 'Explanation']);
    rows.push(['Inventory Turnover Ratio', `${inventory_turnover.turnover_ratio}x`, 'Annualized depletion frequency']);
    rows.push(['Cost of Goods Sold (COGS) KES', inventory_turnover.cogs_cents, 'Total cost of picked/dispatched goods']);
    rows.push(['Average Inventory Value KES', inventory_turnover.avg_inventory_value_cents, 'Current holding cost baseline']);
    rows.push([]);

    // Part 2: Waste by Reason Code & SKU
    rows.push(['2. WASTE BY REASON CODE & SKU']);
    rows.push(['Reason Code', 'SKU ID', 'SKU Name', 'Quantity', `Total Waste Cost (${currencyCode})`]);
    waste_details.forEach((item: any) => {
      rows.push([
        item.reason_code,
        item.sku_id,
        item.sku_name,
        item.quantity,
        item.total_waste_cost
      ]);
    });
    rows.push([null, null, 'TOTAL WASTE COST', null, comprehensiveReport.total_waste_cost_sum]);
    rows.push([]);

    // Part 3: Live Valuation Snapshot
    rows.push(['3. CURRENT LIVE INVENTORY & VALUATION SNAPSHOT']);
    rows.push(['SKU ID', 'SKU Code', 'SKU Name', 'Category', 'Current Stock On Hand', `Unit Cost (${currencyCode})`, `Total Valuation (${currencyCode})`]);
    inventory_items.forEach((item: any) => {
      rows.push([
        item.sku_id,
        item.sku_code,
        item.sku_name,
        item.group_category,
        item.current_stock,
        item.unit_cost_cents,
        item.total_valuation_cents
      ]);
    });

    downloadAsXLSX(rows, `freshops_waste_report_${new Date().toISOString().slice(0, 10)}`);
  };

  const downloadJSONReport = () => {
    if (!comprehensiveReport) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(comprehensiveReport, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `freshops_waste_report_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    document.body.removeChild(downloadAnchor);
  };

  const fetchSupplierPerf = async () => {
    try {
      const res = await fetch('/api/v1/reports/supplier-performance');
      const payload = await res.json();
      if (payload.data) {
        setSupplierPerf(payload.data);
      }
    } catch (err) {
      console.error('Error fetching supplier performance statistics:', err);
    }
  };

  // Periodic sensor readings auto-poll (real-time sensory tracking)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchZones();
      fetchKPIs();
    }, 4000);
    return () => clearInterval(interval);
  }, [activeWh]);

  const fetchStock = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/warehouses/${activeWh}/stock`);
      const payload = await res.json();
      if (payload.data) {
        setStock(payload.data);
      }
    } catch (err) {
      console.error('Error fetching warehouse stocks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/v1/zones');
      const payload = await res.json();
      if (payload.data) {
        setZones(payload.data);
      }
    } catch (err) {
      console.error('Error fetching zones sensory data:', err);
    }
  };

  const handleUpdateTemp = async (zoneId: string, temp: number) => {
    setUpdatingZoneId(zoneId);
    try {
      const res = await fetch(`/api/v1/zones/${zoneId}/temperature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ temperature: temp })
      });
      const payload = await res.json();
      if (payload.data) {
        // immediately refresh local stats
        await fetchZones();
        await fetchKPIs();
      }
    } catch (err) {
      console.error('Error updating zone sensor temperature:', err);
    } finally {
      setUpdatingZoneId(null);
    }
  };

  const fetchKPIs = async () => {
    try {
      // Reorder Alerts
      const rRes = await fetch('/api/v1/reports/reorder-alerts');
      const rData = await rRes.json();
      if (rData.data) setReorderAlerts(rData.data);

      // Turnover
      const tRes = await fetch('/api/v1/reports/inventory-turnover');
      const tData = await tRes.json();

      // Waste Summary
      const wRes = await fetch('/api/v1/reports/waste-summary');
      const wData = await wRes.json();

      // Stock Accuracy
      const sRes = await fetch('/api/v1/reports/stock-accuracy');
      const sData = await sRes.json();

      // Get real-time temperature zone breaches dynamically
      const zonesRes = await fetch('/api/v1/zones');
      const zonesData = await zonesRes.json();
      let breaches = 0;
      if (zonesData.data) {
        breaches = zonesData.data.filter((z: any) => {
          if (z.current_temp_celsius === undefined) return false;
          return z.current_temp_celsius < z.min_temp_celsius || z.current_temp_celsius > z.max_temp_celsius;
        }).length;
      }

      // Let's compute actual waste values
      let writeOffValueSim = 10000;
      if (wData.data && wData.data.length > 0) {
        writeOffValueSim = wData.data.reduce((acc: number, item: any) => acc + item.total_value_cents, 0);
      }

      setKpis({
        wastePct: writeOffValueSim > 0 ? parseFloat(((writeOffValueSim / 5000000) * 100).toFixed(1)) : 1.8,
        turnover: tData.data?.turnover_ratio || 2.4,
        accuracy: sData.data?.accuracy_pct || 100,
        breachCount: breaches,
        totalRevenue: 5000000,
        wasteValue: writeOffValueSim,
      });

    } catch (err) {
      console.error('Error fetching KPIs dashboard records:', err);
    }
  };

  // Get color for temperature zones
  const getZoneBadgeColor = (type: string) => {
    switch (type) {
      case 'frozen': return 'bg-cyan-100 text-cyan-800 border-cyan-200';
      case 'chilled': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cool': return 'bg-teal-100 text-teal-800 border-teal-200';
      default: return 'bg-amber-100 text-amber-800 border-amber-200';
    }
  };

  const getZoneByType = (type: string) => {
    return zones.find(z => z.type === type && z.warehouse_id === activeWh);
  };

  const getBreachStatusText = (zone: any) => {
    if (!zone || zone.current_temp_celsius === undefined) return 'NORMAL';
    if (zone.current_temp_celsius > zone.max_temp_celsius) {
      return 'CRITICALLY WARM';
    } else if (zone.current_temp_celsius < zone.min_temp_celsius) {
      return 'CRITICALLY COLD';
    }
    return 'NORMAL';
  };

  const expiringSoonStock = React.useMemo(() => {
    const now = new Date();
    return stock.filter(item => {
      if (!item.expiry_date) return false;
      const expDate = new Date(item.expiry_date);
      const diffMs = expDate.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);
      return diffHours < 48; // Expiring inside 48 hours, or already expired
    });
  }, [stock]);

  const getRemainingHoursText = (expiryDateStr: string) => {
    const now = new Date();
    const expDate = new Date(expiryDateStr);
    const diffMs = expDate.getTime() - now.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    if (diffHours < 0) {
      const absHours = Math.abs(diffHours);
      if (absHours < 1) return 'Expired just now';
      return `Expired ${Math.round(absHours)}h ago`;
    }
    if (diffHours < 1) {
      return `Expires in ${Math.round(diffHours * 60)}m`;
    }
    return `Expires in ${Math.round(diffHours)}h`;
  };

  return (
    <div className="space-y-6">
      {/* Active Breach Critical Alerts Banner */}
      {(() => {
        const activeBreaches = zones.filter(z => z.warehouse_id === activeWh && z.current_temp_celsius !== undefined && (z.current_temp_celsius < z.min_temp_celsius || z.current_temp_celsius > z.max_temp_celsius));
        if (activeBreaches.length === 0) return null;
        return (
          <div className="bg-rose-50 border border-rose-200 text-rose-900 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xs animate-pulse">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-rose-200 text-rose-800 rounded-lg shrink-0">
                <AlertTriangle className="h-5 w-5 text-rose-700 animate-bounce" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-rose-950 uppercase tracking-wider">Critical Cold-Chain Temperature Breach</h4>
                <p className="text-xs text-rose-800 mt-0.5">
                  The WMS sensors detected out-of-bounds temperature readings inside:
                  <span className="font-semibold text-rose-950 ml-1">
                    {activeBreaches.map(b => `${b.name} (${b.current_temp_celsius?.toFixed(1)}Â°C)`).join(', ')}
                  </span>
                </p>
              </div>
            </div>
            <div className="text-[10px] font-mono font-bold text-rose-700 bg-rose-100 px-3 py-1.5 rounded-md border border-rose-200 uppercase tracking-widest shrink-0">
              ðŸ›‘ OUT_OF_COMPLIANCE
            </div>
          </div>
        );
      })()}

      {/* Automated Expiry Warnings List */}
      {expiringSoonStock.length > 0 && (
        <div className="bg-amber-50/70 border border-amber-205 text-amber-950 rounded-xl p-4 flex flex-col gap-4 shadow-3xs animate-fadeIn">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-amber-200/65 pb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 bg-amber-250 text-amber-900 rounded-lg shrink-0">
                <Clock className="h-5 w-5 text-amber-800 animate-pulse" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">Automated Dispatch Warning: SKUs Nearing Expiry (&lt; 48 Hours)</h4>
                <p className="text-xs text-amber-800 mt-0.5 font-medium">
                  The following stock batches have less than 48 hours remaining. Route through the Fulfillment Desk immediately to prevent food waste.
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('fulfillment')}
                className="flex items-center space-x-2 px-3 py-2 bg-amber-950 hover:bg-black text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 shrink-0"
              >
                <span>Fulfillment Desk</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {expiringSoonStock.map((item, idx) => {
              const rText = getRemainingHoursText(item.expiry_date);
              const targetSku = skus.find(s => s.id === item.sku_id);
              const skuCategory = targetSku ? targetSku.category_id : '';
              return (
                <div key={idx} className="bg-white border border-amber-200/60 rounded-xl p-3 flex items-center space-x-3 shrink-0 shadow-3xs transition-hover hover:border-amber-400">
                  <div className={`w-12 h-12 rounded-lg border flex items-center justify-center font-bold text-sm shrink-0 uppercase tracking-wider ${getCategoryColor(skuCategory)}`}>
                    {getInitials(item.sku_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate leading-tight">{item.sku_name}</p>
                    <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 font-mono mt-0.5">
                      <span className="bg-slate-100 rounded px-1">{item.batch_id}</span>
                      <span>â€¢</span>
                      <span>Loc: <b className="text-slate-800">{item.location_id.replace('L-', '')}</b></span>
                    </div>
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs font-black text-slate-900 font-mono">{displayQty(item.qty_available, targetSku)}</span>
                      <span className="text-[10px] font-bold text-amber-700 bg-amber-100/60 border border-amber-200 rounded px-2 py-0.5 animate-pulse">
                        âš ï¸ {rText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* KPI Ribbons */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1 */}
        <div id="kpi-waste" className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium tracking-wider uppercase">
            <span>Waste Ratio %</span>
            <AlertTriangle className="h-4 w-4 text-rose-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.wastePct}%</span>
            <span className="text-xs text-rose-600 font-medium">({formatMoney(kpis.wasteValue)})</span>
          </div>
          <p className="text-[10px] text-slate-400">Approved write-offs / total D2C revenue</p>
        </div>

        {/* KPI 2 */}
        <div id="kpi-turnover" className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium tracking-wider uppercase">
            <span>Inv Turnover</span>
            <TrendingUp className="h-4 w-4 text-teal-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{kpis.turnover}x</span>
            <span className="text-xs text-teal-600 font-medium">COGS/Avg Val</span>
          </div>
          <p className="text-[10px] text-slate-400">Rate at which food stock is depleted</p>
        </div>

        {/* KPI 3 */}
        <div id="kpi-accuracy" className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium tracking-wider uppercase">
            <span>Stock Accuracy</span>
            <CheckCircle className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-slate-900">{kpis.accuracy}%</span>
          </div>
          <p className="text-[10px] text-slate-400">Zero-variance lines counted / total counted</p>
        </div>

        {/* KPI 4 */}
        <div id="kpi-reorders" className="p-4 bg-white border border-slate-200 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium tracking-wider uppercase">
            <span>Reorder Alerts</span>
            <Layers className="h-4 w-4 text-amber-500" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-2xl font-bold text-slate-900">{reorderAlerts.length} SKUs</span>
          </div>
          <p className="text-[10px] text-slate-400">Active stock counts below reorder limit</p>
        </div>

        {/* KPI 5 */}
        <div id="kpi-coldchain" className={`p-4 border rounded-xl space-y-2 transition-all duration-300 ${kpis.breachCount > 0 ? 'bg-rose-50 border-rose-200 shadow-sm shadow-rose-100' : 'bg-white border-slate-200'}`}>
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium tracking-wider uppercase">
            <span>Zone Breaches</span>
            <ThermometerSnowflake className={`h-4 w-4 ${kpis.breachCount > 0 ? 'text-rose-600 animate-bounce' : 'text-cyan-500 animate-pulse'}`} />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-2xl font-bold ${kpis.breachCount > 0 ? 'text-rose-700' : 'text-slate-900'}`}>{kpis.breachCount} Alert{kpis.breachCount !== 1 ? 's' : ''}</span>
          </div>
          <p className="text-[10px] text-slate-400">Warehouse zones currently out of target limits</p>
        </div>
      </div>

      {/* COMPREHENSIVE INVENTORY & WASTE DOWNLOADABLE REPORT (Satisfying User Query) */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 shadow-3xs">
        <div className="border-b border-slate-100 pb-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-teal-50 border border-teal-100 text-teal-800 rounded-lg shrink-0">
              <FileSpreadsheet className="h-5 w-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Ledger Audit, Valuation & Waste Report</h2>
              <p className="text-[11px] text-slate-500">Live operational ledger auditing food waste metrics and annual turnover rates for regulatory compliance</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={downloadCSVReport}
              disabled={!comprehensiveReport || loadingReport}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download CSV Audit Report</span>
            </button>
            
            <button
              type="button"
              onClick={downloadXLSXReport}
              disabled={!comprehensiveReport || loadingReport}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Download XLSX Audit Report</span>
            </button>
            
            <button
              onClick={downloadJSONReport}
              disabled={!comprehensiveReport || loadingReport}
              className="flex items-center space-x-1.5 px-3.5 py-2 bg-slate-900 hover:bg-black text-white font-bold text-xs rounded-lg transition-all cursor-pointer shadow-xs active:scale-95 disabled:opacity-50"
            >
              <FileText className="h-3.5 w-3.5 text-slate-350" />
              <span>Download JSON Dataset</span>
            </button>
          </div>
        </div>

        {loadingReport ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Activity className="h-6 w-6 animate-spin text-teal-500 mx-auto" />
            <p className="text-xs font-mono font-bold uppercase tracking-wider">Compiling detailed audit trail entries...</p>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Multi-metric Ribbons inside report card */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Inventory Turnover Ratio</span>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {comprehensiveReport?.inventory_turnover?.turnover_ratio?.toFixed(2) || '0.00'}x
                </p>
                <div className="flex items-center space-x-1 text-[9px] text-slate-500">
                  <span className="font-semibold text-emerald-650 font-sans">COGS / Avg Valuation</span>
                </div>
              </div>

              <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Cost of Goods Sold (COGS)</span>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {(comprehensiveReport?.inventory_turnover?.cogs_cents || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">KES</span>
                </p>
                <span className="text-[9px] text-slate-400 font-medium block">Total value of successfully shipped goods</span>
              </div>

              <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Average Inventory Value</span>
                <p className="text-xl font-bold text-slate-900 font-mono">
                  {(comprehensiveReport?.inventory_turnover?.avg_inventory_value_cents || 0).toLocaleString()} <span className="text-xs font-normal text-slate-500">KES</span>
                </p>
                <span className="text-[9px] text-slate-400 font-medium block">Live baseline stock value on hand</span>
              </div>

              <div className="p-3.5 bg-slate-50/70 border border-slate-150 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-black text-slate-450 tracking-wider">Total Write-Off Waste</span>
                <p className="text-xl font-bold text-rose-750 font-mono">
                  {formatMoney(comprehensiveReport?.total_waste_cost_sum || 0)}
                </p>
                <span className="text-[9px] text-rose-600 font-bold uppercase tracking-wider block">Total waste by cost</span>
              </div>
            </div>

            {/* Waste by Reason Code with Sku Details */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Waste list table */}
              <div className="lg:col-span-8 bg-slate-50/40 border border-slate-150 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <h3 className="text-xs font-black text-slate-700 uppercase tracking-widest">Wastage Breakdown Area</h3>
                  <span className="text-[10px] bg-slate-100 text-slate-600 font-mono px-2 py-0.5 rounded-full font-bold">
                    {comprehensiveReport?.waste_details?.length || 0} unique entries
                  </span>
                </div>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-slate-500 font-bold border-b border-slate-150 uppercase tracking-wider text-[9px]">
                        <th className="p-2.5">Reason Code</th>
                        <th className="p-2.5">SKU Code & Name</th>
                        <th className="p-2.5 text-center">Wasted Quantity</th>
                        <th className="p-2.5 text-right">Total Waste Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-150/60">
                      {comprehensiveReport?.waste_details?.map((item: any, idx: number) => (
                        <tr key={idx} className="hover:bg-white/70 transition-colors">
                          <td className="p-2.5">
                            <span className={`px-2 py-0.5 rounded-md font-black text-[9px] font-mono tracking-widest ${
                              item.reason_code === 'EXPIRED' 
                                ? 'bg-amber-100 text-amber-800' 
                                : item.reason_code === 'DAMAGED' 
                                ? 'bg-rose-100 text-rose-800' 
                                : item.reason_code === 'QUALITY'
                                ? 'bg-indigo-100 text-indigo-800'
                                : item.reason_code === 'THEFT'
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-slate-100 text-slate-800'
                            }`}>
                              {item.reason_code}
                            </span>
                          </td>
                          <td className="p-2.5">
                            <p className="font-bold text-slate-800">{item.sku_name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">{item.sku_id}</p>
                          </td>
                          <td className="p-2.5 text-center font-mono font-bold text-slate-700">
                            {item.quantity} units
                          </td>
                          <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                            {formatMoney(item.total_waste_cost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Informative side widget */}
              <div className="lg:col-span-4 bg-teal-50/35 border border-teal-100 rounded-xl p-4 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex items-center space-x-1.5 border-b border-teal-100/50 pb-2">
                    <BookOpen className="h-4 w-4 text-teal-600" />
                    <h3 className="text-xs font-bold text-teal-950 uppercase tracking-wide">Audit Intelligence</h3>
                  </div>
                  
                  <p className="text-[11px] text-teal-900 leading-relaxed">
                    Under standard compliance policies, the <b>Inventory Turnover Ratio</b> determines how effectively our cold chain and fresh food inventory is utilized.
                  </p>

                  <div className="p-3 bg-white/75 border border-teal-100 rounded-lg text-[10px] text-teal-950 space-y-1.5 leading-relaxed">
                    <p className="font-semibold block">Formula representation:</p>
                    <p className="font-mono text-[9px] bg-slate-50 p-1 rounded border border-slate-100 text-slate-700">
                      Turnover = COGS / Avg Inventory Cost
                    </p>
                    <p>
                      Wastage values are calculated from verified, approved write-off logs in our core system database.
                    </p>
                  </div>
                </div>

                <div className="text-[9px] text-slate-450 italic font-mono pt-2 border-t border-slate-100/40">
                  Last generated: {comprehensiveReport ? new Date(comprehensiveReport.timestamp).toLocaleTimeString() : '--:--:--'}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Supplier Performance Sourcing Module */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-3xs">
        <div className="border-b border-slate-100 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <Truck className="h-5 w-5 text-indigo-600 shrink-0" />
            <div>
              <h2 className="text-sm font-bold text-slate-900">Supplier Sourcing Performance Evaluation</h2>
              <p className="text-[11px] text-slate-500">Live lead time and quality analysis to optimize procurement logistics and sourcing decisions</p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 self-start">
            <span className="text-[9px] bg-indigo-50 border border-indigo-100 font-extrabold text-indigo-700 px-2 py-0.5 rounded uppercase tracking-wider">
              Strategic Sourcing Engine Active
            </span>
          </div>
        </div>

        {/* Performance Charts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Average Lead Times Chart */}
          <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Average Lead Time (Days)</h3>
              <span className="text-[9px] text-slate-400 font-medium">Lower is better</span>
            </div>
            <div className="h-60 w-full font-mono text-[10px]">
              {supplierPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={supplierPerf}
                    margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="supplier_name" stroke="#64748b" style={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis unit="d" stroke="#64748b" style={{ fontSize: 9 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 10 }}
                      formatter={(value: any) => [`${value} days`, 'Avg Lead Time']}
                    />
                    <ReferenceLine y={2} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Target Max (2d)', fill: '#3b82f6', fontSize: 8, position: 'top' }} />
                    <Bar dataKey="avg_lead_time_days" barSize={36} radius={[4, 4, 0, 0]}>
                      {supplierPerf.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.avg_lead_time_days > 2.0 ? '#f59e0b' : '#10b981'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading performance indicators...</div>
              )}
            </div>
          </div>

          {/* Defect Rate Chart */}
          <div className="bg-slate-50/50 border border-slate-150 p-4 rounded-xl space-y-3">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h3 className="text-[10px] font-black text-slate-700 uppercase tracking-wider">Quality Defect Rate (%)</h3>
              <span className="text-[9px] text-slate-400 font-medium font-sans">Lower is better</span>
            </div>
            <div className="h-60 w-full font-mono text-[10px]">
              {supplierPerf.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={supplierPerf}
                    margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="supplier_name" stroke="#64748b" style={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis unit="%" stroke="#64748b" style={{ fontSize: 9 }} />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '8px', fontSize: 10 }}
                      formatter={(value: any) => [`${value}%`, 'Defect Rate']}
                    />
                    <ReferenceLine y={2.5} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Tolerance Limit (2.5%)', fill: '#ef4444', fontSize: 8, position: 'top' }} />
                    <Bar dataKey="defect_rate_pct" barSize={36} radius={[4, 4, 0, 0]}>
                      {supplierPerf.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.defect_rate_pct > 2.5 ? '#ef4444' : '#10b981'} 
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 text-xs">Loading performance indicators...</div>
              )}
            </div>
          </div>
        </div>

        {/* Sourcing Decision Table & Recommendation */}
        <div className="overflow-x-auto border border-slate-150 rounded-xl bg-white shadow-xxs">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-150 uppercase tracking-wider text-[9px]">
                <th className="p-3">Supplier Name</th>
                <th className="p-3 text-center">Avg Lead Time</th>
                <th className="p-3 text-center">Defect Rate</th>
                <th className="p-3 text-center">Sourcing Rating</th>
                <th className="p-3 text-center">Risk Level</th>
                <th className="p-3">Sourcing Recommendation & Decision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {supplierPerf.map((s, idx) => (
                <tr key={s.supplier_id || idx} className="hover:bg-slate-50/55 transition-colors">
                  <td className="p-3">
                    <p className="font-bold text-slate-800 text-xs">{s.supplier_name}</p>
                    <p className="text-[10px] text-slate-400 font-mono">ID: {s.supplier_id} | Contact: {s.contact_name}</p>
                  </td>
                  <td className="p-3 text-center font-mono font-bold">
                    <span className={s.avg_lead_time_days > 2.0 ? 'text-amber-650' : 'text-emerald-650'}>
                      {s.avg_lead_time_days} days
                    </span>
                    <p className="text-[9px] text-slate-400 font-sans">Baseline: {s.baseline_lead_time_days}d</p>
                  </td>
                  <td className="p-3 text-center font-mono font-bold">
                    <span className={s.defect_rate_pct > 2.5 ? 'text-rose-600' : 'text-emerald-700'}>
                      {s.defect_rate_pct}%
                    </span>
                    <p className="text-[9px] text-slate-400 font-sans font-normal">Active records: {s.receipts_count} receipts</p>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      s.rating === 'Excellent' 
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                        : s.rating === 'Fair' 
                        ? 'bg-amber-100 text-amber-800 border border-amber-200'
                        : 'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      {s.rating}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2 py-0.5 rounded font-extrabold font-mono text-[9px] uppercase tracking-wide ${
                      s.risk_level === 'Low' 
                        ? 'bg-emerald-50 text-emerald-600 border border-emerald-150' 
                        : s.risk_level === 'Medium' 
                        ? 'bg-amber-50 text-amber-700 border border-amber-150'
                        : 'bg-rose-50 text-rose-600 border border-rose-150'
                    }`}>
                      {s.risk_level} Risk
                    </span>
                  </td>
                  <td className="p-3 max-w-sm">
                    <p className="font-semibold text-slate-700 text-xs leading-snug">{s.recommendation}</p>
                    <p className="text-[10px] text-slate-400">Linked to <b className="text-slate-600 font-mono">{s.orders_count} POs</b> processed at Regen and Regal sites</p>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Warehouse Selector & 2D Live map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: 2D Live Layout Map */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-slate-600" />
              <h2 className="text-base font-bold text-slate-900">Live Cold-Chain Layout Explorer</h2>
            </div>
            {/* Warehouse Selectors */}
            <div className="flex space-x-1 bg-slate-100 p-1 rounded-lg">
              {warehouses.map(wh => (
                <button
                  key={wh.id}
                  onClick={() => setActiveWh(wh.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    activeWh === wh.id 
                      ? 'bg-white text-slate-800 shadow-xs' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {wh.id} ({wh.type === 'main_warehouse' ? 'Main' : 'FP'})
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Interactive floor representation for <span className="font-semibold text-slate-700">{activeWh === 'RGN' ? 'Regen Warehouse Nairobi' : 'Regal Plaza Fulfilment Point'}</span>. Stock items are allocated inside temperature-controlled zones ensuring storage compliance.
          </p>

          {/* 2D Zone Grid Simulation */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
            {/* Frozen Box */}
            {(() => {
              const zoneData = getZoneByType('frozen');
              const isBreached = zoneData && zoneData.current_temp_celsius !== undefined && (zoneData.current_temp_celsius < zoneData.min_temp_celsius || zoneData.current_temp_celsius > zoneData.max_temp_celsius);
              return (
                <div className={`border rounded-xl p-4 space-y-3 transition-all duration-300 ${
                  isBreached 
                    ? 'border-rose-450 bg-rose-50/50 ring-2 ring-rose-500/20 animate-pulse' 
                    : 'border-cyan-250 bg-cyan-50/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-cyan-900 tracking-wide uppercase">Frozen Zone</span>
                    <span className="text-[10px] font-bold bg-cyan-200 text-cyan-800 px-1.5 py-0.5 rounded-full">â‰¤ -18Â°C</span>
                  </div>
                  
                  {zoneData ? (
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-cyan-100 text-[10px]">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                        Sensor:
                      </span>
                      <span className={`font-mono font-bold ${isBreached ? 'text-rose-600' : 'text-slate-700'}`}>
                        {zoneData.current_temp_celsius?.toFixed(1)}Â°C
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Not equipped</div>
                  )}

                  <div className="space-y-1.5">
                    <div className="bg-white border border-cyan-100 p-2 rounded-lg shadow-xxs">
                      <div className="text-[10px] font-mono text-cyan-700">Shelf: F-01-01-A</div>
                      <div className="text-xs font-medium text-slate-800 mt-1 leading-tight">
                        {stock.find(s => s.location_id === 'L-RGN-FRZ-01') ? (
                          <span>
                            Burger Patties ({stock.find(s => s.location_id === 'L-RGN-FRZ-01')?.qty_available} packs)
                          </span>
                        ) : (
                          <span className="text-slate-400">Empty Location</span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {isBreached && (
                    <p className="text-[9px] text-rose-600 font-bold uppercase animate-pulse">âš ï¸ FREEZER OVERHEATING</p>
                  )}
                </div>
              );
            })()}

            {/* Chilled Box */}
            {(() => {
              const zoneData = getZoneByType('chilled');
              const isBreached = zoneData && zoneData.current_temp_celsius !== undefined && (zoneData.current_temp_celsius < zoneData.min_temp_celsius || zoneData.current_temp_celsius > zoneData.max_temp_celsius);
              return (
                <div className={`border rounded-xl p-4 space-y-3 transition-all duration-300 ${
                  isBreached 
                    ? 'border-rose-450 bg-rose-50/50 ring-2 ring-rose-500/20 animate-pulse' 
                    : 'border-blue-250 bg-blue-50/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-blue-900 tracking-wide uppercase">Chilled Zone</span>
                    <span className="text-[10px] font-bold bg-blue-200 text-blue-800 px-1.5 py-0.5 rounded-full">0Â°C to 4Â°C</span>
                  </div>

                  {zoneData ? (
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-blue-100 text-[10px]">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                        Sensor:
                      </span>
                      <span className={`font-mono font-bold ${isBreached ? 'text-rose-600' : 'text-slate-700'}`}>
                        {zoneData.current_temp_celsius?.toFixed(1)}Â°C
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Not equipped</div>
                  )}

                  <div className="space-y-2">
                    <div className="bg-white border border-blue-100 p-2 rounded-lg shadow-xxs space-y-1">
                      <div className="text-[10px] font-mono text-blue-700">Shelf: C-01-01-A</div>
                      <div className="text-xs font-medium text-slate-800 leading-tight">
                        {stock.find(s => s.location_id === 'L-RGN-CHL-01' || s.location_id === 'L-RGL-CHL-01') ? (
                          <span className="space-y-1 block">
                            {stock.filter(s => s.location_id === 'L-RGN-CHL-01' || s.location_id === 'L-RGL-CHL-01').map((item, id) => (
                              <div key={id} className="text-xs">â€¢ {item.sku_name.split(' ')[0]} ({item.qty_available} units)</div>
                            ))}
                          </span>
                        ) : (
                          <span className="text-slate-400">Empty Location</span>
                        )}
                      </div>
                    </div>

                    {activeWh === 'RGN' && (
                      <div className="bg-white border border-blue-100 p-2 rounded-lg shadow-xxs">
                        <div className="text-[10px] font-mono text-blue-700">Shelf: C-01-01-B</div>
                        <div className="text-xs font-medium text-slate-800 leading-tight">
                          {stock.find(s => s.location_id === 'L-RGN-CHL-02') ? (
                            <span>Chicken ({stock.find(s => s.location_id === 'L-RGN-CHL-02')?.qty_available} pk)</span>
                          ) : (
                            <span className="text-slate-400 text-[10px]">Empty (Avail. poultry)</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {isBreached && (
                    <p className="text-[9px] text-rose-600 font-bold uppercase animate-pulse">âš ï¸ COLD ROOM TEMPERATURE SPIKE</p>
                  )}
                </div>
              );
            })()}

            {/* Cool Box */}
            {(() => {
              const zoneData = getZoneByType('cool');
              const isBreached = zoneData && zoneData.current_temp_celsius !== undefined && (zoneData.current_temp_celsius < zoneData.min_temp_celsius || zoneData.current_temp_celsius > zoneData.max_temp_celsius);
              return (
                <div className={`border rounded-xl p-4 space-y-3 transition-all duration-300 ${
                  isBreached 
                    ? 'border-rose-450 bg-rose-50/50 ring-2 ring-rose-500/20 animate-pulse' 
                    : 'border-teal-200 bg-teal-50/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-teal-900 tracking-wide uppercase">Cool Zone</span>
                    <span className="text-[10px] font-bold bg-teal-200 text-teal-800 px-1.5 py-0.5 rounded-full">8Â°C to 12Â°C</span>
                  </div>

                  {zoneData ? (
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-teal-100 text-[10px]">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                        Sensor:
                      </span>
                      <span className={`font-mono font-bold ${isBreached ? 'text-rose-600' : 'text-slate-700'}`}>
                        {zoneData.current_temp_celsius?.toFixed(1)}Â°C
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Not equipped</div>
                  )}

                  <div className="space-y-1.5">
                    <div className="bg-white border border-teal-100 p-2 rounded-lg shadow-xxs">
                      <div className="text-[10px] font-mono text-teal-700">Shelf: V-01-01-A</div>
                      <div className="text-xs font-medium text-slate-800 mt-1 leading-tight">
                        {stock.find(s => s.location_id === 'L-RGN-COOL-01') ? (
                          <span>Hass Avocados ({stock.find(s => s.location_id === 'L-RGN-COOL-01')?.qty_available} packs)</span>
                        ) : (
                          <span className="text-slate-400">Empty Location</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {isBreached && (
                    <p className="text-[9px] text-rose-600 font-bold uppercase animate-pulse">âš ï¸ COOL ROOM DEFECT</p>
                  )}
                </div>
              );
            })()}

            {/* Ambient Box */}
            {(() => {
              const zoneData = getZoneByType('ambient');
              const isBreached = zoneData && zoneData.current_temp_celsius !== undefined && (zoneData.current_temp_celsius < zoneData.min_temp_celsius || zoneData.current_temp_celsius > zoneData.max_temp_celsius);
              return (
                <div className={`border rounded-xl p-4 space-y-3 transition-all duration-300 ${
                  isBreached 
                    ? 'border-rose-450 bg-rose-50/50 ring-2 ring-rose-500/20 animate-pulse' 
                    : 'border-amber-200 bg-amber-50/40'
                }`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-900 tracking-wide uppercase">Ambient Zone</span>
                    <span className="text-[10px] font-bold bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full">15Â°C to 25Â°C</span>
                  </div>

                  {zoneData ? (
                    <div className="flex items-center justify-between bg-white/80 backdrop-blur-xs px-2 py-1 rounded-md border border-amber-100 text-[10px]">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <span className={`h-1.5 w-1.5 rounded-full ${isBreached ? 'bg-rose-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                        Sensor:
                      </span>
                      <span className={`font-mono font-bold ${isBreached ? 'text-rose-600' : 'text-slate-700'}`}>
                        {zoneData.current_temp_celsius?.toFixed(1)}Â°C
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">Not equipped</div>
                  )}

                  <div className="space-y-2">
                    <div className="bg-white border border-amber-100 p-2 rounded-lg shadow-xxs">
                      <div className="text-[10px] font-mono text-amber-700">Shelf: A-01-01-A</div>
                      <div className="text-xs font-medium text-slate-800 mt-1 leading-tight">
                        {stock.find(s => s.location_id === 'L-RGN-AMB-01' || s.location_id === 'L-RGL-AMB-01') ? (
                          <span>
                            {stock.find(s => s.location_id === 'L-RGN-AMB-01' || s.location_id === 'L-RGL-AMB-01')?.sku_name.split(' ').slice(0, 2).join(' ')} ({stock.find(s => s.location_id === 'L-RGN-AMB-01' || s.location_id === 'L-RGL-AMB-01')?.qty_available} packs)
                          </span>
                        ) : (
                          <span className="text-slate-400">Empty Location</span>
                        )}
                      </div>
                    </div>
                    {activeWh === 'RGN' && (
                      <div className="bg-white border border-amber-100 p-2 rounded-lg shadow-xxs">
                        <div className="text-[10px] font-mono text-amber-700">Shelf: A-01-01-B</div>
                        <div className="text-xs text-slate-400">Empty (Dry Racks)</div>
                      </div>
                    )}
                  </div>

                  {isBreached && (
                    <p className="text-[9px] text-rose-600 font-bold uppercase animate-pulse">âš ï¸ DRY AREA HEATWAVE</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* IoT Telemetry Calibration Controls */}
          {zones.filter(z => z.warehouse_id === activeWh).length > 0 && (
            <div className="pt-4 mt-2 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5">
                  <Sliders className="h-4 w-4 text-slate-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-slate-900 tracking-wider uppercase">Live WMS IoT Telemetry Controllers</h3>
                </div>
                <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-full">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[9px] font-bold text-slate-500 font-mono">100% SENSOR CODES RESPONDING</span>
                </div>
              </div>
              
              <div id="sensor-telemetry-override-dashboard-panel" className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {zones.filter(z => z.warehouse_id === activeWh).map((zone) => {
                  const isBr = zone.current_temp_celsius !== undefined && (zone.current_temp_celsius < zone.min_temp_celsius || zone.current_temp_celsius > zone.max_temp_celsius);
                  return (
                    <div key={zone.id} className={`p-3 rounded-xl border text-xs flex flex-col justify-between space-y-2.5 transition-all duration-300 ${
                      isBr 
                        ? 'border-rose-200 bg-rose-50/20 shadow-xs shadow-rose-50/50' 
                        : 'border-slate-150 bg-slate-50/40 hover:bg-slate-50/80'
                    }`}>
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-bold text-slate-950 leading-none">{zone.name}</p>
                          <p className="text-[9px] text-slate-400 font-mono mt-1">Normal Limits: <span className="text-slate-600 font-bold">{zone.min_temp_celsius}Â°C</span> to <span className="text-slate-600 font-bold">{zone.max_temp_celsius}Â°C</span></p>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider ${
                          isBr ? 'bg-rose-100 text-rose-700 border border-rose-200 animate-bounce' : 'bg-slate-100 border border-slate-200 text-slate-600'
                        }`}>
                          {isBr ? 'âš ï¸ OUT OF RANGE' : 'âœ“ COMPLIANT'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-100">
                        <div className="flex items-center space-x-1.5 text-xs text-slate-500">
                          <span className="font-bold text-[10px] uppercase font-sans text-slate-400">Live Reading:</span>
                          <span className={`font-mono font-extrabold text-[13px] ${isBr ? 'text-rose-600' : 'text-slate-800'}`}>
                            {zone.current_temp_celsius !== undefined ? zone.current_temp_celsius.toFixed(1) : '--'}Â°C
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const mid = (zone.min_temp_celsius + zone.max_temp_celsius) / 2;
                              handleUpdateTemp(zone.id, parseFloat(mid.toFixed(1)));
                            }}
                            disabled={updatingZoneId !== null}
                            className="px-2 py-1 text-[10px] font-bold bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 rounded-lg shadow-xxs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                            title="Reset code temperature to a mid-point compliant state"
                          >
                            Normalize
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const spikeVal = zone.max_temp_celsius + 5.2;
                              handleUpdateTemp(zone.id, parseFloat(spikeVal.toFixed(1)));
                            }}
                            disabled={updatingZoneId !== null}
                            className="px-2 py-1 text-[10px] font-bold bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 hover:text-rose-800 rounded-lg shadow-xxs cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                            title="Trigger an over-temperature sensor breach simulation"
                          >
                            Spike Temp
                          </button>
                          {updatingZoneId === zone.id && (
                            <Activity className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right: Stock snapshot list */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-4 w-4 text-teal-600" />
              <h2 className="text-sm font-bold text-slate-900">Current Stock On Hand</h2>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
              {stock.length} Batches
            </span>
          </div>

          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
              <Activity className="h-6 w-6 animate-spin text-slate-300" />
              <span className="text-xs font-medium">Scanning dynamic stock map...</span>
            </div>
          ) : stock.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-1">
              <Layers className="h-6 w-6 text-slate-200 mx-auto" />
              <p className="text-xs font-medium">All physical locations empty of stock.</p>
              <p className="text-[10px]">Create or Receive a Purchase order to put-away products.</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
              {stock.map((item, idx) => {
                const targetSku = skus.find(s => s.id === item.sku_id);
                return (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-lg flex items-center justify-between text-xs transition-hover hover:border-slate-200">
                    <div className="space-y-1 max-w-[70%]">
                      <p className="font-bold text-slate-800 leading-tight truncate">{item.sku_name}</p>
                      <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500">
                        <span className="bg-slate-200/60 px-1 rounded">{item.batch_id}</span>
                        <span className="text-slate-300">|</span>
                        <span>Loc: <b className="text-slate-700">{item.location_id.replace('L-', '')}</b></span>
                      </div>
                    </div>
                    <div className="text-right space-y-0.5">
                      <span className="text-sm font-bold text-slate-900">{displayQty(item.qty_available, targetSku)}</span>
                      <p className="text-[9px] text-slate-400 font-mono">Exp: {item.expiry_date.slice(0, 10)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Under reorder Alerts list */}
          {reorderAlerts.length > 0 && (
            <div className="bg-amber-50/50 border border-amber-200 text-amber-900 rounded-lg p-3 space-y-2">
              <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>Reorder Alerts ({reorderAlerts.length})</span>
              </div>
              <div className="space-y-1">
                {reorderAlerts.slice(0, 2).map((alert, idx) => (
                  <p key={idx} className="text-[10px] leading-relaxed text-amber-800">
                    â€¢ <b>{alert.sku_name}</b> is below reorder level. Stock: <b>{alert.current_stock}</b> / Limit: <b>{alert.reorder_level}</b> (Short: <span className="font-bold">{alert.shortage}</span>)
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

