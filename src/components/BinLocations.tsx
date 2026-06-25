import React, { useState, useEffect, useMemo } from 'react';
import { Location, Zone, Batch } from '../types';
import { displayQty } from '../utils/uom';
import BarcodeInput from './BarcodeInput';
import { 
  Search, 
  MapPin, 
  Grid, 
  Layers, 
  ShieldAlert, 
  RefreshCw, 
  Printer, 
  QrCode, 
  CheckSquare, 
  Square, 
  Check, 
  Settings, 
  Sliders, 
  SlidersHorizontal,
  LayoutGrid, 
  Maximize, 
  Trash2, 
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import QRCode from 'qrcode';

// Dynamic QR Code component utilizing the robust base64 Data URL technique
interface QRCodeImageProps {
  value: string;
  size?: number;
  className?: string;
}

export function QRCodeImage({ value, size = 120, className = "" }: QRCodeImageProps) {
  const [dataUrl, setDataUrl] = useState<string>('');

  useEffect(() => {
    QRCode.toDataURL(value, {
      margin: 1,
      width: size,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    })
    .then(url => setDataUrl(url))
    .catch(err => console.error('Error generating QR image:', err));
  }, [value, size]);

  if (!dataUrl) {
    return <div className={`animate-pulse bg-slate-100 rounded border border-slate-200`} style={{ width: size, height: size }} />;
  }

  return (
    <img 
      src={dataUrl} 
      alt={`QR Code for ${value}`} 
      className={className} 
      style={{ width: size, height: size }}
      referrerPolicy="no-referrer"
    />
  );
}

interface BinLocationsProps {
  onNavigate?: (tab: string) => void;
}

export default function BinLocations({ onNavigate }: BinLocationsProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [stockByLocation, setStockByLocation] = useState<Map<string, any[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [offlineError, setOfflineError] = useState<string | null>(null);

  // Filters
  const [selectedWarehouse, setSelectedWarehouse] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'grid' | 'table' | 'labels'>('grid');

  // Selected bin IDs for label generator queue
  const [selectedBinIds, setSelectedBinIds] = useState<string[]>([]);

  // Label Studio Configuration States
  const [labelPreset, setLabelPreset] = useState<'standard' | 'mini' | 'compact'>('standard');
  const [includeAllocated, setIncludeAllocated] = useState<boolean>(true);
  const [includeVerifiedFooter, setIncludeVerifiedFooter] = useState<boolean>(true);
  const [customText, setCustomText] = useState<string>('WMS COMPLIANCE SCAN');
  const [qrSize, setQrSize] = useState<number>(140);
  const [customPrefix, setCustomPrefix] = useState<string>('bin-code:');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setOfflineError(null);
    try {
      const [resLoc, resZone, resBatch, resSkus] = await Promise.all([
        fetch('/api/v1/locations'),
        fetch('/api/v1/zones'),
        fetch('/api/v1/batches'),
        fetch('/api/v1/skus')
      ]);

      if (!resLoc.ok || !resZone.ok || !resBatch.ok || !resSkus.ok) {
        throw new Error('Server returned unhandled error');
      }

      const rawLoc = await resLoc.json();
      const rawZone = await resZone.json();
      const rawBatch = await resBatch.json();
      const rawSkus = await resSkus.json();

      // Retrieve real stock data for both warehouses
      const [resRGN, resRGL] = await Promise.all([
        fetch('/api/v1/warehouses/RGN/stock'),
        fetch('/api/v1/warehouses/RGL/stock')
      ]);
      const rgnStock = await resRGN.json();
      const rglStock = await resRGL.json();
      const allStock = [...(rgnStock.data || []), ...(rglStock.data || [])];

      const map = new Map<string, any[]>();
      allStock.forEach((entry: any) => {
        const existing = map.get(entry.location_id) || [];
        map.set(entry.location_id, [...existing, entry]);
      });

      setLocations(rawLoc.data || []);
      setZones(rawZone.data || []);
      setBatches(rawBatch.data || []);
      setSkus(rawSkus.data || []);
      setStockByLocation(map);
    } catch (err) {
      console.error('Error fetching bin locations data:', err);
      setOfflineError('Last updated 1 min ago — refresh failed');
    } finally {
      setLoading(false);
    }
  };

  const zoneEthyleneRisk = useMemo(() => {
    const riskMap = new Map<string, boolean>();
    // Group locations by zone_id
    const zoneToLocs = new Map<string, string[]>();
    locations.forEach(loc => {
      const list = zoneToLocs.get(loc.zone_id) || [];
      list.push(loc.id);
      zoneToLocs.set(loc.zone_id, list);
    });

    zoneToLocs.forEach((locIds, zoneId) => {
      let hasProducer = false;
      let hasSensitive = false;
      locIds.forEach(locId => {
        const entries = stockByLocation.get(locId) || [];
        entries.forEach((entry: any) => {
          const sku = skus.find((s: any) => s.id === entry.sku_id);
          if (sku?.ethylene_profile === 'producer') hasProducer = true;
          if (sku?.ethylene_profile === 'sensitive') hasSensitive = true;
        });
      });
      riskMap.set(zoneId, hasProducer && hasSensitive);
    });
    return riskMap;
  }, [locations, stockByLocation, skus]);

  const filteredLocations = locations.filter(loc => {
    if (selectedWarehouse !== 'ALL' && loc.warehouse_id !== selectedWarehouse) return false;
    if (selectedZone !== 'ALL' && loc.zone_id !== selectedZone) return false;
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      // search by code or aisle or rack
      const matchCode = loc.code.toLowerCase().includes(query);
      const matchAisle = loc.aisle.toLowerCase().includes(query);
      const matchRack = loc.rack.toLowerCase().includes(query);
      return matchCode || matchAisle || matchRack;
    }
    return true;
  });

  // Helper to calculate days to expiry
  const getDaysToExpiry = (expiryDateStr: string) => {
    if (!expiryDateStr) return 999;
    const exp = new Date(expiryDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    exp.setHours(0, 0, 0, 0);
    const diffTime = exp.getTime() - today.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  // Helper to format date as DD MMM
  const formatDDMMM = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d.getDate()} ${months[d.getMonth()]}`;
  };

  return (
    <div className="space-y-6">
      {/* Offline Alert */}
      {offlineError && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between text-amber-950 text-xs">
          <div className="flex items-center space-x-2">
            <ShieldAlert className="h-4 w-4 text-amber-550" />
            <span>{offlineError}</span>
          </div>
          <button 
            onClick={fetchData}
            className="flex items-center bg-white border border-amber-300 text-amber-900 px-3 py-1.5 rounded-lg font-bold min-h-[44px]"
          >
            <RefreshCw className="h-3 w-3 mr-1.5" />
            Retry
          </button>
        </div>
      )}

      {/* Header Info Panel */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] bg-teal-500/20 text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            Smart Layouts Engine
          </span>
          <h1 className="text-xl font-extrabold tracking-tight">Zone Bin Locations Explorer</h1>
          <p className="text-xs text-slate-400">Authoritative visual tracking of multi-axis storage racks, capacity limits, and physical allocations.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab('grid')}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 border transition ${
              activeTab === 'grid' 
                ? 'bg-white text-slate-950 border-white' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Grid className="h-4 w-4" />
            <span>2D Layout Matrix</span>
          </button>
          <button
            onClick={() => setActiveTab('table')}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 border transition ${
              activeTab === 'table' 
                ? 'bg-white text-slate-950 border-white' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Layers className="h-4 w-4" />
            <span>Structured Table</span>
          </button>
          <button
            onClick={() => setActiveTab('labels')}
            className={`min-h-[44px] min-w-[44px] px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 border transition ${
              activeTab === 'labels' 
                ? 'bg-white text-slate-950 border-white' 
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-750'
            }`}
          >
            <Printer className="h-4 w-4" />
            <span>Label Studio</span>
            {selectedBinIds.length > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0">
                {selectedBinIds.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter Controls Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          {/* Warehouse Selector */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Warehouse</label>
            <select
              value={selectedWarehouse}
              onChange={(e) => setSelectedWarehouse(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-hidden min-h-[44px] font-bold"
            >
              <option value="ALL">All Warehouses</option>
              <option value="RGN">Regen Central Warehouse (RGN)</option>
              <option value="RGL">Regal Fulfillment Point (RGL)</option>
            </select>
          </div>

          {/* Zone Selector */}
          <div className="flex flex-col">
            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Temp Zone</label>
            <select
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-lg p-2.5 outline-hidden min-h-[44px] font-bold"
            >
              <option value="ALL">All Zones</option>
              {zones.map(z => (
                <option key={z.id} value={z.id}>
                  {z.name} ({z.type.toUpperCase()})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-80">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1 block">Global Bin Search & Scanner</label>
          <BarcodeInput 
            onScan={(code) => setSearchQuery(code)}
            placeholder="Scan location or type keyword..."
            context="bin_locations"
          />
          {searchQuery && (
            <div className="flex items-center justify-between mt-1 text-[10px] text-slate-500">
              <span>Active filter: <b className="text-slate-700 font-mono">{searchQuery}</b></span>
              <button 
                onClick={() => setSearchQuery('')}
                className="text-indigo-600 font-extrabold hover:underline cursor-pointer text-[10px]"
              >
                Clear Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="bg-white border border-slate-150 rounded-xl p-4 space-y-3 shadow-xxs">
              <div className="h-4 w-1/3 bg-slate-200 rounded-sm animate-pulse" />
              <div className="h-8 w-2/3 bg-slate-200 rounded animate-pulse" />
              <div className="h-3 w-1/2 bg-slate-200 rounded-sm animate-pulse" />
            </div>
          ))}
        </div>
      ) : filteredLocations.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2">
          <MapPin className="h-8 w-8 text-slate-300 mx-auto" />
          <p className="text-sm font-bold">No bin locations found matching filters.</p>
          <p className="text-xs">Try selecting a different warehouse, zone or clear search query.</p>
        </div>
      ) : activeTab === 'grid' ? (
        <div className="space-y-6">
          <div className="bg-indigo-50/50 border border-indigo-100 p-4 rounded-xl flex items-center space-x-3 text-indigo-950 text-xs">
            <Grid className="h-5 w-5 text-indigo-600 shrink-0" />
            <p>
              Each grid box shows the <b>Bin Code</b> (Aisle-Rack-Shelf-Bin) and details if any stock is currently allocated to that visual coordinate.
            </p>
          </div>

          {/* Matrix render */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {filteredLocations.map(loc => {
              const rawAllocated = stockByLocation.get(loc.id) || [];
              const allocated = [...rawAllocated].sort((a, b) => {
                const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
                const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
                return dateA - dateB;
              });
              const hasAlloc = allocated.length > 0;
              const isEthyleneRisk = zoneEthyleneRisk.get(loc.zone_id);
              return (
                <div 
                  key={loc.id} 
                  id={loc.id}
                  className={`border rounded-xl p-4.5 space-y-3 transition group relative ${
                    hasAlloc 
                      ? 'bg-teal-50/20 border-teal-200' 
                      : 'bg-white border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const binId = loc.id;
                          setSelectedBinIds(prev => 
                            prev.includes(binId) ? prev.filter(id => id !== binId) : [...prev, binId]
                          );
                        }}
                        className="text-slate-400 hover:text-indigo-600 transition cursor-pointer p-0.5 rounded"
                      >
                        {selectedBinIds.includes(loc.id) ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{loc.warehouse_id}</span>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${hasAlloc ? 'bg-teal-500' : 'bg-slate-300'}`} />
                  </div>

                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h3 className="text-sm font-black text-slate-800 font-mono tracking-tight">{loc.code}</h3>
                        {isEthyleneRisk && (
                          <span
                            title="Ethylene separation risk in this zone — producer and sensitive products are both present"
                            className="inline-flex items-center text-amber-500"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedBinIds(prev => {
                            if (prev.includes(loc.id)) return prev;
                            return [...prev, loc.id];
                          });
                          setActiveTab('labels');
                        }}
                        className="opacity-0 group-hover:opacity-100 transition duration-150 p-1 bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 rounded-md border border-slate-100 hover:border-indigo-150 cursor-pointer"
                        title="Generate Label for this Bin"
                      >
                        <Printer className="h-3 w-3" />
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-0.5">Aisle {loc.aisle} • Rack {loc.rack}</p>
                  </div>

                  {hasAlloc ? (
                    <div className="space-y-2 pt-1 border-t border-slate-100 mt-2">
                      {allocated.map((entry: any, eIdx) => {
                        const sLookup = skus.find(s => s.id === entry.sku_id);
                        const daysToExpiry = getDaysToExpiry(entry.expiry_date);
                        let badgeColor = 'bg-green-100 text-green-800 border-green-200';
                        if (daysToExpiry <= 2) {
                          badgeColor = 'bg-red-100 text-red-800 border-red-200';
                        } else if (daysToExpiry <= 5) {
                          badgeColor = 'bg-amber-100 text-amber-800 border-amber-200';
                        }
                        return (
                          <div key={entry.batch_id || eIdx} className="bg-white border border-slate-200 rounded-lg p-2.5 space-y-1 text-[11px] shadow-xxs">
                            <span className="text-[10px] text-slate-900 font-bold block leading-tight truncate">
                              {entry.sku_name}
                            </span>
                            <div className="flex items-center justify-between font-mono text-[9px] text-slate-550 leading-none">
                              <span className="truncate mr-1">Lot: <strong className="text-slate-750 font-semibold">{entry.batch_id}</strong></span>
                              <span className="font-bold text-slate-800 shrink-0">{displayQty(entry.qty_available, sLookup)}</span>
                            </div>
                            <div className="flex items-center justify-between text-[9px] pt-1.5 border-t border-slate-105 leading-none">
                              <span className="text-slate-400 font-medium">Exp: {formatDDMMM(entry.expiry_date)}</span>
                              <span className={`px-1 py-0.2 rounded font-black border text-[7px] uppercase tracking-wider ${badgeColor} shrink-0`}>
                                {daysToExpiry <= 0 ? 'Expired' : `${daysToExpiry}d`}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-[9px] text-slate-400 italic pt-1">Empty • Ready</div>
                  )}

                  {/* Absolute Badge on hover */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition text-[9px] font-bold bg-slate-905 text-white px-1.5 py-0.5 rounded">
                    Shelf {loc.shelf}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : activeTab === 'table' ? (
        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xxs">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                <th className="p-3.5 w-12 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      const allCurrentIds = filteredLocations.map(l => l.id);
                      const allSelected = allCurrentIds.every(id => selectedBinIds.includes(id));
                      if (allSelected) {
                        setSelectedBinIds(prev => prev.filter(id => !allCurrentIds.includes(id)));
                      } else {
                        setSelectedBinIds(prev => {
                          const union = new Set([...prev, ...allCurrentIds]);
                          return Array.from(union);
                        });
                      }
                    }}
                    className="p-1.5 rounded hover:bg-slate-150 transition text-slate-500 cursor-pointer"
                    title="Toggle all filtered bins selection"
                  >
                    {filteredLocations.length > 0 && filteredLocations.map(l => l.id).every(id => selectedBinIds.includes(id)) ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4 text-slate-350" />
                    )}
                  </button>
                </th>
                <th className="p-3.5">Bin Code</th>
                <th className="p-3.5 text-center">Warehouse</th>
                <th className="p-3.5">Aisle / Rack / Shelf / Bin</th>
                <th className="p-3.5">Status</th>
                <th className="p-3.5">Stock Stored</th>
                <th className="p-3.5 text-right pr-6">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredLocations.map(loc => {
                const rawAllocated = stockByLocation.get(loc.id) || [];
                const allocated = [...rawAllocated].sort((a, b) => {
                  const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
                  const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
                  return dateA - dateB;
                });
                const hasAlloc = allocated.length > 0;
                const isEthyleneRisk = zoneEthyleneRisk.get(loc.zone_id);
                return (
                  <tr key={loc.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => {
                          const binId = loc.id;
                          setSelectedBinIds(prev => 
                            prev.includes(binId) ? prev.filter(id => id !== binId) : [...prev, binId]
                          );
                        }}
                        className="p-1.5 rounded hover:bg-slate-100 transition text-slate-500 cursor-pointer"
                      >
                        {selectedBinIds.includes(loc.id) ? (
                          <CheckSquare className="h-4 w-4 text-indigo-600" />
                        ) : (
                          <Square className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-950 text-sm">
                      <div className="flex items-center gap-1.5">
                        <span>{loc.code}</span>
                        {isEthyleneRisk && (
                          <span
                            title="Ethylene separation risk in this zone — producer and sensitive products are both present"
                            className="inline-flex items-center text-amber-500"
                          >
                            <AlertTriangle className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-bold">
                      <span className="bg-slate-100 px-2 py-0.5 rounded text-xs">{loc.warehouse_id}</span>
                    </td>
                    <td className="p-3.5">
                      Aisle {loc.aisle} • Rack {loc.rack} • Shelf {loc.shelf} • Bin {loc.bin}
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        hasAlloc 
                          ? 'bg-teal-100 text-teal-800' 
                          : 'bg-slate-100 text-slate-500'
                      }`}>
                        {hasAlloc ? 'Occupied' : 'Available'}
                      </span>
                    </td>
                    <td className="p-3.5">
                      {hasAlloc ? (
                        <div className="space-y-1.5">
                          {allocated.map((entry: any, eIdx) => {
                            const entrySku = skus.find(s => s.id === entry.sku_id);
                            return (
                              <div key={entry.batch_id || eIdx} className="text-xs leading-normal">
                                <p className="font-bold text-slate-800">{entry.sku_name}</p>
                                <p className="text-[10px] text-slate-400 font-mono">
                                  Lot <strong className="text-slate-650">{entry.batch_id}</strong> • {displayQty(entry.qty_available, entrySku)} • Exp: {formatDDMMM(entry.expiry_date)}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">No physical stock</span>
                      )}
                    </td>
                    <td className="p-3.5 text-right pr-6">
                      <button
                        onClick={() => {
                          setSelectedBinIds(prev => {
                            if (prev.includes(loc.id)) return prev;
                            return [...prev, loc.id];
                          });
                          setActiveTab('labels');
                        }}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-150 text-indigo-700 border border-indigo-150 hover:border-indigo-250 rounded-lg text-xs font-bold transition flex items-center gap-1.5 inline-flex cursor-pointer min-h-[34px]"
                        title="Configure and print barcode label for this bin"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Custom style injection for absolute print formatting control */}
          <style dangerouslySetInnerHTML={{ __html: `
            @media print {
              /* Universal reset to override container grid boundaries & hide headers */
              html, body {
                background: #ffffff !important;
                color: #000000 !important;
                margin: 0 !important;
                padding: 0 !important;
              }
              body * {
                visibility: hidden !important;
              }
              /* Only target our specific printing wrapper block to display */
              #label-print-media-sheet, #label-print-media-sheet * {
                visibility: visible !important;
              }
              #label-print-media-sheet {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                background: #ffffff !important;
                padding: 0 !important;
                margin: 0 !important;
                box-shadow: none !important;
              }
              /* Enforce optimal page breaks & avoid cutoff */
              .print-break-avoid {
                page-break-inside: avoid !important;
                break-inside: avoid !important;
              }
              /* Eliminate double borders or shadows on printouts */
              .print-no-shadow {
                box-shadow: none !important;
                border: 1px solid #c0c0c0 !important;
              }
            }
          `}} />

          {/* Top informational header banner */}
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 p-5 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="bg-indigo-600/10 p-2.5 rounded-xl text-indigo-700 shrink-0">
                <QrCode className="h-6 w-6" />
              </div>
              <div className="space-y-0.5">
                <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight">QR Code Label Studio</h2>
                <p className="text-xs text-slate-600 max-w-2xl">
                  Batch output formatted physical tracking labels. Attach stickers to location racks to enable warehouse managers to instantly pull allocations, route inventories and log audits with handheld mobile scanners.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  // Add all currently filtered bins to printing queue
                  const allCurrentIds = filteredLocations.map(l => l.id);
                  setSelectedBinIds(prev => {
                    const union = new Set([...prev, ...allCurrentIds]);
                    return Array.from(union);
                  });
                }}
                className="bg-white hover:bg-slate-50 text-slate-700 text-xs px-3.5 py-2 rounded-xl border border-slate-200 font-bold tracking-tight transition max-h-[44px] cursor-pointer"
              >
                Queue All Filtered ({filteredLocations.length})
              </button>
              {selectedBinIds.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedBinIds([])}
                  className="bg-red-50 hover:bg-red-100 text-red-700 text-xs px-3.5 py-2 rounded-xl border border-red-100 font-bold tracking-tight transition max-h-[44px] cursor-pointer"
                >
                  Clear Queue
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left: Configuration Panel */}
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-6 shadow-xxs space-y-6">
              <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
                <Settings className="h-4 w-4 text-indigo-600" />
                <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Configuration Panel</h3>
              </div>

              {/* Presets Grid */}
              <div className="space-y-2">
                <label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Sticker Preset Size</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setLabelPreset('standard');
                      setQrSize(140);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      labelPreset === 'standard'
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Standard</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">2.5" x 2.2"</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLabelPreset('compact');
                      setQrSize(110);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      labelPreset === 'compact'
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Compact</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">2.0" x 1.8"</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setLabelPreset('mini');
                      setQrSize(90);
                    }}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      labelPreset === 'mini'
                        ? 'border-indigo-600 bg-indigo-50/40 text-indigo-950 font-bold'
                        : 'border-slate-200 hover:border-slate-300 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-xs">Mini Tag</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">1.7" x 1.0"</span>
                  </button>
                </div>
              </div>

              {/* Dynamic QR code structure and input params */}
              <div className="space-y-4 pt-1">
                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">QR Code Scheme Prefix</span>
                  <input
                    type="text"
                    value={customPrefix}
                    onChange={(e) => setCustomPrefix(e.target.value)}
                    placeholder="e.g. bin-code:"
                    className="w-full text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg p-2 font-mono transition outline-hidden"
                  />
                  <span className="text-[9px] text-slate-400 block">Payload will format as: <code className="text-indigo-600">{customPrefix}BIN_CODE</code></span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">Sticker Footer Text</span>
                  <input
                    type="text"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    placeholder="e.g. WMS COMPLIANCE SCAN"
                    className="w-full text-xs bg-slate-50 hover:bg-slate-100/50 focus:bg-white border border-slate-200 rounded-lg p-2 transition outline-hidden"
                  />
                </div>

                {/* QR Size Slider */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-semibold text-slate-500 uppercase tracking-wider">QR Code Scaling Size</span>
                    <span className="font-mono font-bold text-indigo-700">{qrSize}px</span>
                  </div>
                  <input
                    type="range"
                    min="80"
                    max="220"
                    step="10"
                    value={qrSize}
                    onChange={(e) => setQrSize(Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-ew-resize"
                  />
                </div>
              </div>

              {/* Extra toggles */}
              <div className="space-y-3.5 border-t border-slate-100 pt-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Render Target Stock Info</span>
                    <span className="text-[10px] text-slate-450 block">Output current item & batch status</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeAllocated(!includeAllocated)}
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                    style={{ backgroundColor: includeAllocated ? '#4f46e5' : '#cbd5e1' }}
                  >
                    <span
                      className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      style={{ transform: includeAllocated ? 'translateX(16px)' : 'translateX(0px)' }}
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-800 block">Render Verified Footer Stamp</span>
                    <span className="text-[10px] text-slate-450 block">Include short footer note and stamp</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIncludeVerifiedFooter(!includeVerifiedFooter)}
                    className="relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden"
                    style={{ backgroundColor: includeVerifiedFooter ? '#4f46e5' : '#cbd5e1' }}
                  >
                    <span
                      className="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out"
                      style={{ transform: includeVerifiedFooter ? 'translateX(16px)' : 'translateX(0px)' }}
                    />
                  </button>
                </div>
              </div>

              {/* Launch/Print primary triggers */}
              <div className="border-t border-slate-100 pt-4">
                {selectedBinIds.length === 0 ? (
                  <div className="text-center p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 space-y-1">
                    <Info className="h-4 w-4 mx-auto text-slate-300" />
                    <p className="text-[10px]">No bins selected in printing queue.</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full bg-indigo-600 hover:bg-indigo-750 text-white p-3.5 rounded-xl font-bold transition flex items-center justify-center space-x-2' font-black text-sm tracking-tight shadow-sm cursor-pointer hover:shadow-md mr-1.5"
                  >
                    <Printer className="h-4 w-4 text-indigo-200 mr-2" />
                    <span>Print {selectedBinIds.length} Label{selectedBinIds.length > 1 ? 's' : ''} Now</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right: Real-time dynamic visual sheet preview */}
            <div className="lg:col-span-8 bg-slate-50 border border-slate-200 rounded-2xl p-6 min-h-[500px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
                      <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest block">Live Print Sheet View</h3>
                    </div>
                    <p className="text-[10px] text-slate-400">Previews the exact sticker graphics as they'll align onto media</p>
                  </div>
                  <span className="text-[10px] bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">
                    {selectedBinIds.length} Sticker{selectedBinIds.length !== 1 ? 's' : ''} Loaded
                  </span>
                </div>

                {selectedBinIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 space-y-3.5">
                    <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center text-slate-350 border border-slate-200">
                      <QrCode className="h-7 w-7" />
                    </div>
                    <div className="space-y-1 max-w-sm">
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Sticker Queue is Empty</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        To add locations, toggle back to either the <b>2D Layout Matrix</b> or the <b>Structured Table</b> view, and select bins using the checkbox inputs or print buttons.
                      </p>
                    </div>
                  </div>
                ) : (
                  /* Printable sheet grid wrapper */
                  <div 
                    id="label-print-media-sheet" 
                    className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 p-1"
                  >
                    {locations
                      .filter(loc => selectedBinIds.includes(loc.id))
                      .map(loc => {
                        const rawAllocated = stockByLocation.get(loc.id) || [];
                        const allocated = [...rawAllocated].sort((a, b) => {
                          const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : 0;
                          const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : 0;
                          return dateA - dateB;
                        });
                        const hasAlloc = allocated.length > 0;
                        const qrPayload = `${customPrefix}${loc.code}`;

                        return (
                          <div
                            key={loc.id}
                            className="bg-white border border-slate-300 rounded-xl p-4 flex flex-col items-center justify-between relative group print-break-avoid print-no-shadow"
                            style={{
                              minHeight: labelPreset === 'standard' ? '210px' : labelPreset === 'compact' ? '180px' : '140px',
                            }}
                          >
                            {/* Sticky prune button to drop elements from layout */}
                            <button
                              type="button"
                              onClick={() => setSelectedBinIds(prev => prev.filter(id => id !== loc.id))}
                              className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 opacity-0 group-hover:opacity-100 transition duration-150 cursor-pointer print:hidden"
                              title="Delete from Queue"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>

                            {/* Label Header info */}
                            <div className="text-center w-full space-y-0.5 border-b border-dashed border-slate-150 pb-2 mb-2">
                              <span className="text-[9px] font-mono text-slate-400 block tracking-widest uppercase">{loc.warehouse_id} STORAGE BIN</span>
                              <h3 className="text-lg font-black text-slate-900 tracking-tight leading-tight uppercase font-mono">{loc.code}</h3>
                              <p className="text-[9px] text-slate-500 font-semibold leading-none">
                                Aisle: {loc.aisle} • Rack: {loc.rack} • Shelf: {loc.shelf} • Bin: {loc.bin}
                              </p>
                            </div>

                            {/* Dynamic generated QR component */}
                            <div className="flex items-center justify-center my-1">
                              <QRCodeImage value={qrPayload} size={qrSize} />
                            </div>

                            {/* Optional: Stock Allocation Detail section inside boundary */}
                            {includeAllocated && (
                              <div className="w-full bg-slate-50 border border-slate-150 rounded-lg p-1.5 mt-1 text-[8px] font-medium leading-normal space-y-1">
                                {hasAlloc ? (
                                  allocated.map((entry: any, eIdx) => {
                                    const entrySku = skus.find(s => s.id === entry.sku_id);
                                    return (
                                      <div key={entry.batch_id || eIdx} className="text-left border-b border-slate-150 pb-1 last:border-0 last:pb-0">
                                        <div className="font-extrabold text-slate-800 text-[9px] leading-tight truncate">{entry.sku_name}</div>
                                        <div className="text-slate-500 font-mono">Lot: {entry.batch_id} • Qty: {displayQty(entry.qty_available, entrySku)} • Exp: {formatDDMMM(entry.expiry_date)}</div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-slate-400 italic font-normal text-center py-1">No current stock allocation</div>
                                )}
                              </div>
                            )}

                            {/* Custom label footer tag */}
                            {includeVerifiedFooter && (
                              <div className="w-full text-center text-[7px] text-slate-400 mt-2 font-mono tracking-wider pt-1.5 border-t border-slate-100 flex items-center justify-center space-x-1 uppercase">
                                <CheckCircle2 className="h-2 w-2 text-indigo-500" />
                                <span>{customText || 'WMS COMPLIANCE SCAN'}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Bottom stats banner */}
              {selectedBinIds.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500">
                  <span className="font-medium text-slate-400">Selected layout format: <strong className="text-slate-700 capitalize">{labelPreset}</strong></span>
                  <span className="font-mono text-slate-400">Rendered payload scheme: <strong className="text-indigo-600">{customPrefix || 'None'}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
