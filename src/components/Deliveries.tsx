import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { AlertTriangle, CheckCircle, Truck, Boxes, Search } from 'lucide-react';

interface DeliveriesProps {
  currentUser: User | null;
  triggerRefresh: () => void;
  refreshFlag: number;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

const SUPPLIERS_MAP: { [key: string]: string } = {
  'S-KENCHIC': 'Kenchic Poultry Ltd',
  'S-NAIROBI-GREENS': 'Nairobi Fresh Produce Co.',
  'S-DRYPACK': 'Drypack Millers Ltd'
};

export default function Deliveries({ currentUser, triggerRefresh, refreshFlag, triggerToast }: DeliveriesProps) {
  const [deliveryLog, setDeliveryLog] = useState<any[]>([]);
  const [deliveryAssets, setDeliveryAssets] = useState<any[]>([]);
  const [stagedAssets, setStagedAssets] = useState<{ [deliveryId: string]: any[] }>({});
  const [showLocationFlag, setShowLocationFlag] = useState<Record<string, boolean>>({});
  const [locationDistance, setLocationDistance] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetchDeliveries();
    fetchDeliveryAssets();
    fetchOrders();
    fetchSkus();
  }, [refreshFlag]);

  const fetchDeliveries = async () => {
    try {
      const res = await fetch('/api/v1/deliveries');
      const data = await res.json();
      if (data.data) setDeliveryLog(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchDeliveryAssets = async () => {
    try {
      const res = await fetch('/api/v1/delivery-assets');
      const data = await res.json();
      if (data.data) setDeliveryAssets(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch('/api/v1/orders');
      const data = await res.json();
      if (data.data) setOrders(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchSkus = async () => {
    try {
      const res = await fetch('/api/v1/skus');
      const data = await res.json();
      if (data.data) setSkus(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddScannedAsset = (deliveryId: string, uid: string) => {
    let type: 'cooler_box' | 'insulated_tote' | 'crate' | 'gel_pack' = 'cooler_box';
    if (uid.startsWith('IT-')) type = 'insulated_tote';
    else if (uid.startsWith('CR-')) type = 'crate';
    else if (uid.startsWith('GP-')) type = 'gel_pack';

    const newStaged = { uid, type, count: 1 };
    
    setStagedAssets(prev => ({
      ...prev,
      [deliveryId]: [...(prev[deliveryId] || []), newStaged]
    }));

    if (triggerToast) {
      triggerToast(`Staged asset UID ${uid} for dispatch.`, 'info');
    }
  };

  const handleAddCountAsset = (deliveryId: string, type: string, count: number) => {
    const newStaged = { type, count };
    
    setStagedAssets(prev => ({
      ...prev,
      [deliveryId]: [...(prev[deliveryId] || []), newStaged]
    }));

    if (triggerToast) {
      triggerToast(`Staged ${count} x ${type} for dispatch.`, 'info');
    }
  };

  const handleRemoveStaged = (deliveryId: string, idx: number) => {
    setStagedAssets(prev => {
      const copy = [...(prev[deliveryId] || [])];
      copy.splice(idx, 1);
      return {
        ...prev,
        [deliveryId]: copy
      };
    });
  };

  const handleAttachStaged = async (deliveryId: string) => {
    const staged = stagedAssets[deliveryId] || [];
    if (staged.length === 0) return;

    try {
      const individually_tracked = staged.filter(s => s.uid).map(s => ({ uid: s.uid }));
      const count_tracked = staged.filter(s => !s.uid).map(s => ({ type: s.type, count: s.count }));

      const res = await fetch(`/api/v1/deliveries/${deliveryId}/assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ individually_tracked, count_tracked })
      });

      const data = await res.json();
      if (data.data) {
        if (triggerToast) triggerToast('Logistics assets attached successfully!', 'success');
        
        setStagedAssets(prev => ({
          ...prev,
          [deliveryId]: []
        }));

        fetchDeliveryAssets();
      } else {
        if (triggerToast) triggerToast(data.error?.message || 'Failed to attach assets', 'error');
      }
    } catch (err) {
      console.error(err);
      if (triggerToast) triggerToast('Network error attaching assets', 'error');
    }
  };

  const handleReturnAsset = async (deliveryId: string, da: any, return_condition: string) => {
    try {
      const payloadItem = da.uid 
        ? { uid: da.uid, return_condition }
        : { delivery_asset_id: da.id, return_condition };

      const res = await fetch(`/api/v1/deliveries/${deliveryId}/return-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assets: [payloadItem] })
      });

      const data = await res.json();
      if (data.data) {
        if (triggerToast) {
          triggerToast(`Asset returned in ${return_condition} condition.`, 'success');
        }
        fetchDeliveryAssets();
      }
    } catch (err) {
      console.error(err);
      if (triggerToast) triggerToast('Failed to return logistics asset', 'error');
    }
  };

  const handleConfirmDelivery = async (
    delId: string,
    status: 'confirm' | 'fail',
    reason?: string,
    locationNote?: string,
    distanceFromAddress?: number
  ) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const url = `/api/v1/deliveries/${delId}/${status === 'confirm' ? 'confirm' : 'fail'}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reason,
          ...(locationNote ? { location_note: locationNote } : {}),
          ...(distanceFromAddress !== undefined ? { distance_from_address: distanceFromAddress } : {})
        })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        setSuccessMessage(status === 'confirm' ? 'Delivery confirmed!' : `Delivery flagged as failed. Sourced inventory returned to stock ledger automatically (BR-052).`);
        fetchDeliveries();
        fetchOrders();
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const query = searchQuery.toLowerCase().trim();

  const filteredDeliveries = deliveryLog.filter(del => {
    if (!query) return true;
    const matchBasic = 
      del.id.toLowerCase().includes(query) || 
      del.order_id.toLowerCase().includes(query);
    if (matchBasic) return true;

    const parentOrder = orders.find(o => o.id === del.order_id);
    if (parentOrder && parentOrder.lines) {
      return parentOrder.lines.some((l: any) => {
        const skuInfo = skus.find(s => s.id === l.sku_id);
        const skuName = skuInfo?.name || l.sku_name || '';
        const supplierId = skuInfo?.supplier_id || '';
        const supplierName = SUPPLIERS_MAP[supplierId] || '';
        return (
          l.sku_id.toLowerCase().includes(query) ||
          skuName.toLowerCase().includes(query) ||
          supplierId.toLowerCase().includes(query) ||
          supplierName.toLowerCase().includes(query)
        );
      });
    }
    return false;
  });

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-teal-400 font-bold">
            <Truck className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wider">Logistics Dispatch Center</span>
          </div>
          <h1 className="text-xl font-black">Driver Last-Mile Logistics Tracker</h1>
          <p className="text-xs text-slate-400">Track dispatched courier vans on route to customers across Nairobi</p>
        </div>

        {/* Search bar inside header */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            placeholder="Search Slip, Order, SKU, Batch..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-800 border border-slate-700 focus:border-teal-400 rounded-xl text-xs placeholder-slate-450 text-white font-medium transition-all"
          />
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-450" />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-2 text-slate-450 hover:text-white font-bold text-lg leading-none"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="space-y-1 text-left">
            <p className="font-bold">Compliance Warning</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="space-y-1 text-left">
            <p className="font-bold">Action Committed</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {/* Deliveries list */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
        <div className="space-y-3">
          {filteredDeliveries.length === 0 ? (
            <p className="text-xs text-slate-405 text-center py-8 bg-slate-50 border border-slate-100 rounded-xl">No active or completed transport slips match search query</p>
          ) : (
            filteredDeliveries.map((del, idx) => (
              <div key={idx} className="p-4 bg-slate-50 border border-slate-100 rounded-xl grid grid-cols-1 md:grid-cols-3 gap-4 text-xs items-center animate-fadeIn">
                <div className="space-y-1 text-left">
                  <p className="font-bold text-slate-850 font-mono text-[10px] uppercase">Slip: {del.id}</p>
                  <p className="text-[11px] font-semibold text-slate-650">Order: {del.order_id}</p>
                  <p className="text-[10px] text-slate-400 font-mono">Dispatched: {del.dispatched_at?.replace('T',' ').slice(5, 16) || ''} UTC</p>
                </div>

                <div className="text-left space-y-1">
                  <span className="text-slate-405 block text-[10px] uppercase tracking-wide">Transport Specifications</span>
                  <p>Driver: <b>U-KIPROP</b> ({del.driver_id})</p>
                  <p>Totes: <b>{del.tote_count} packed boxes</b></p>
                  <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase inline-block ${
                    del.status === 'delivered' ? 'bg-emerald-100 text-emerald-800' : del.status === 'failed' ? 'bg-rose-100 text-rose-800' : 'bg-indigo-100 text-indigo-800'
                  }`}>
                    Route: {del.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1.5 md:items-end">
                  {del.status === 'dispatched' && (
                    <>
                      <div className="flex gap-1.5 md:justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            const distanceStr = showLocationFlag[del.id] ? locationDistance[del.id] : undefined;
                            const distance = distanceStr ? Number(distanceStr) : undefined;
                            const note = distance !== undefined && distance > 0
                              ? `Driver reported delivering approximately ${distance}m from registered address`
                              : undefined;
                            handleConfirmDelivery(del.id, 'confirm', undefined, note, distance);
                          }}
                          className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded min-h-[44px] cursor-pointer"
                        >
                          Confirm Delivered
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const reason = prompt('Please describe non-delivery reason (e.g., Customer Refused, No response)');
                            if (reason) handleConfirmDelivery(del.id, 'fail', reason);
                          }}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded min-h-[44px] cursor-pointer"
                        >
                          Fail Delivery
                        </button>
                      </div>

                      <div className="mt-2 text-left md:text-right w-full">
                        <button
                          type="button"
                          onClick={() => setShowLocationFlag(prev => ({ ...prev, [del.id]: !prev[del.id] }))}
                          className="text-[11px] text-slate-500 underline cursor-pointer hover:text-slate-700 transition-colors"
                        >
                          {showLocationFlag[del.id] ? 'Hide shadow locator' : 'Delivering from a different location?'}
                        </button>
                        {showLocationFlag[del.id] && (
                          <div className="mt-2 flex items-center justify-start md:justify-end gap-2">
                            <input
                              type="number"
                              placeholder="Approx distance (m)"
                              value={locationDistance[del.id] || ''}
                              onChange={(e) => setLocationDistance(prev => ({ ...prev, [del.id]: e.target.value }))}
                              className="text-xs border border-slate-300 rounded-lg px-2 py-1.5 w-48 font-semibold text-slate-800 bg-white"
                            />
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {del.status === 'delivered' && (
                    <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-100 p-2 rounded">
                      Delivered successfully!
                    </span>
                  )}

                  {del.status === 'returning' && (
                    <span className="text-[10px] text-rose-700 font-bold bg-rose-50 border border-rose-100 p-2 rounded animate-pulse">
                      Quarantine Recall - Van returning to depot
                    </span>
                  )}

                  {del.status === 'failed' && (
                    <div className="text-left md:text-right space-y-0.5 max-w-[80%]">
                      <span className="text-[9px] text-rose-600 font-bold block uppercase tracking-wide">Returned To Inventory</span>
                      <span className="text-[10px] font-medium text-slate-500 italic block">
                        "Reason: {del.failure_reason || 'returned'}"
                      </span>
                    </div>
                  )}
                </div>

                {/* Returnable Assets Section */}
                <div className="mt-4 border-t border-slate-200/60 pt-4 space-y-3 col-span-1 md:col-span-3 text-left">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-1.5">
                      <Boxes className="h-4 w-4 text-slate-500" />
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider">Logistics Returnable Assets</h4>
                    </div>
                    <span className="text-[10px] text-slate-500 font-bold font-mono bg-slate-100 px-2 py-0.5 rounded-full">
                      {deliveryAssets.filter(da => da.delivery_id === del.id).length} Assigned
                    </span>
                  </div>

                  {del.status === 'dispatched' && (
                    <div className="bg-white border border-slate-200 rounded-xl p-3.5 space-y-3.5">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Scan / Type Asset UID</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              id={`uid-input-${del.id}`}
                              placeholder="e.g. CC-001, IT-001, CR-001"
                              className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-mono select-all min-h-[44px]"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const val = (e.target as HTMLInputElement).value.toUpperCase().trim();
                                  if (val) {
                                    handleAddScannedAsset(del.id, val);
                                    (e.target as HTMLInputElement).value = '';
                                  }
                                }
                              }}
                            />
                            <button
                              onClick={() => {
                                const el = document.getElementById('uid-input-' + del.id) as HTMLInputElement;
                                const val = el?.value.toUpperCase().trim();
                                if (val) {
                                  handleAddScannedAsset(del.id, val);
                                  el.value = '';
                                }
                              }}
                              className="px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg min-h-[44px] cursor-pointer"
                            >
                              Add UID
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-bold text-slate-400 uppercase">Add Count-Tracked Assets</label>
                          <div className="flex gap-2">
                            <select
                              id={`cnt-type-${del.id}`}
                              className="flex-1 bg-slate-50 border border-slate-200 text-xs rounded-lg p-2 min-h-[44px] font-semibold"
                            >
                              <option value="gel_pack">Gel Pack</option>
                              <option value="insulated_tote">Insulated Tote</option>
                              <option value="cooler_box">Cooler Box</option>
                              <option value="crate">Crate</option>
                            </select>
                            <input
                              type="number"
                              id={`cnt-qty-${del.id}`}
                              defaultValue="2"
                              min="1"
                              className="w-14 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs text-center min-h-[44px]"
                            />
                            <button
                              onClick={() => {
                                const typeEl = document.getElementById('cnt-type-' + del.id) as HTMLSelectElement;
                                const qtyEl = document.getElementById('cnt-qty-' + del.id) as HTMLInputElement;
                                const type = typeEl?.value;
                                const count = parseInt(qtyEl?.value) || 1;
                                handleAddCountAsset(del.id, type, count);
                              }}
                              className="px-3 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg min-h-[44px] cursor-pointer"
                            >
                              Add Qty
                            </button>
                          </div>
                        </div>
                      </div>

                      {stagedAssets[del.id] && stagedAssets[del.id].length > 0 && (
                        <div className="bg-indigo-50/50 rounded-lg p-2.5 border border-indigo-100 flex items-center justify-between">
                          <div className="flex flex-wrap gap-1.5">
                            {stagedAssets[del.id].map((sa: any, sIdx: number) => (
                              <span key={sIdx} className="bg-white border text-indigo-950 font-mono text-[9px] font-bold px-2 py-0.5 rounded flex items-center gap-1">
                                {sa.uid ? `UID: ${sa.uid}` : `${sa.type} x${sa.count}`}
                                <button 
                                  onClick={() => handleRemoveStaged(del.id, sIdx)}
                                  className="text-rose-600 hover:text-rose-800 font-extrabold px-1"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                          <button
                            onClick={() => handleAttachStaged(del.id)}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold py-2 px-3 rounded-lg min-h-[44px] cursor-pointer"
                          >
                            Attach Dispatch Assets ({stagedAssets[del.id].length})
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-1.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {deliveryAssets.filter(da => da.delivery_id === del.id).length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">No logistics assets attached.</p>
                    ) : (
                      deliveryAssets.filter(da => da.delivery_id === del.id).map((da) => {
                        const isReturned = da.returned_at !== null;
                        return (
                          <div key={da.id} className="bg-white border border-slate-205 rounded-xl p-3 flex justify-between items-center text-[11px] font-semibold">
                            <div className="space-y-1 text-left">
                              <span className="capitalize text-[8px] text-slate-400 block font-bold leading-none">{da.asset_type.replace('_',' ')}</span>
                              <span className="font-mono text-slate-800 font-extrabold">{da.uid || `Qty: ${da.count}`}</span>
                            </div>
                            
                            <div>
                              {isReturned ? (
                                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                  da.return_condition === 'good' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                                }`}>
                                  Returned ({da.return_condition})
                                </span>
                              ) : (
                                <div className="flex gap-1">
                                  {['good', 'damaged', 'lost'].map((cond) => (
                                    <button
                                      key={cond}
                                      onClick={() => handleReturnAsset(del.id, da, cond)}
                                      className={`text-[8px] font-bold uppercase px-2 py-0.5 rounded border min-h-[44px] cursor-pointer ${
                                        cond === 'good' ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border-emerald-200' :
                                        cond === 'damaged' ? 'bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-200' :
                                        'bg-rose-50 text-rose-700 hover:bg-rose-100 border-rose-200'
                                      }`}
                                    >
                                      {cond}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
