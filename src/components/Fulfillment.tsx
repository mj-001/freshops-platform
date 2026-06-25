import React, { useEffect, useState } from 'react';
import { CustomerOrder, PickList, User } from '../types';
import { 
  Scan, 
  Truck, 
  Layers, 
  Compass, 
  CheckCircle, 
  Thermometer, 
  FileEdit,
  AlertTriangle,
  Lock,
  Boxes,
  HelpCircle,
  QrCode,
  ArrowDownUp,
  Search
} from 'lucide-react';
import BarcodeInput from './BarcodeInput';
import { displayQty } from '../utils/uom';

interface FulfillmentProps {
  currentUser: User | null;
  triggerRefresh: () => void;
  refreshFlag: number;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Fulfillment({ currentUser, triggerRefresh, refreshFlag, triggerToast }: FulfillmentProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [pickLists, setPickLists] = useState<any[]>([]);
  const [activePickList, setActivePickList] = useState<any | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);
  const [scannedLineHighlight, setScannedLineHighlight] = useState<string | null>(null);

  const handleRawBarcodeScan = (code: string) => {
    const upper = code.toUpperCase().trim();
    let type: 'po' | 'sku' | 'order' | 'picklist' | 'location' = 'sku';
    if (upper.startsWith('PO-')) {
      type = 'po';
    } else if (upper.startsWith('ORD-')) {
      type = 'order';
    } else if (upper.startsWith('PL-')) {
      type = 'picklist';
    } else if (upper.startsWith('L-') || upper.startsWith('RGN-') || upper.startsWith('RGL-')) {
      type = 'location';
    }
    handleScanSuccess({ type, code: upper });
  };

  const handleScanSuccess = (scanned: { type: 'po' | 'sku' | 'order' | 'picklist' | 'location'; code: string; item?: any }) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    // 1. Scan Order
    if (scanned.type === 'order') {
      const foundOrder = orders.find(o => o.id === scanned.code);
      if (foundOrder) {
        handleSelectOrder(foundOrder);
        setSuccessMessage(`Scanned Order: successfully loaded details for order ${scanned.code}.`);
      } else {
        setErrorMessage(`Customer Order ${scanned.code} is not loaded on this screen.`);
      }
    }
    // 2. Scan Picklist
    else if (scanned.type === 'picklist') {
      const foundPl = pickLists.find(pl => pl.id === scanned.code);
      if (foundPl) {
        handleSelectPicklist(foundPl);
        setSuccessMessage(`Scanned Pick List target: selected Pick List ${scanned.code}.`);
      } else {
        setErrorMessage(`Pick List ${scanned.code} not found or inactive.`);
      }
    }
    // 3. Scan SKU (inside active pick list)
    else if (scanned.type === 'sku') {
      if (activePickList) {
        const targetLine = activePickList.lines?.find((l: any) => l.sku_id === scanned.code && l.status === 'pending');
        if (targetLine) {
          const currentQty = pickerInputs[targetLine.id] || 0;
          const newQty = Math.min(currentQty + 1, targetLine.qty_requested);
          
          setPickerInputs(prev => ({
            ...prev,
            [targetLine.id]: newQty
          }));
          
          setScannedLineHighlight(targetLine.id);
          setTimeout(() => setScannedLineHighlight(null), 3000);

          setSuccessMessage(`Barcode Linked to Item! Incremented picked qty to ${newQty}/${targetLine.qty_requested} for item ${scanned.item?.name || scanned.code}.`);
        } else {
          const anyLine = activePickList.lines?.find((l: any) => l.sku_id === scanned.code);
          if (anyLine) {
            setSuccessMessage(`SKU ${scanned.item?.name || scanned.code} has already been fully processed.`);
          } else {
            setErrorMessage(`SKU ${scanned.item?.name || scanned.code} is not requested in current Pick List.`);
          }
        }
      } else {
        setErrorMessage(`Scanned SKU: ${scanned.item?.name || scanned.code}. Open a Floor Pick List first to log item picking logs.`);
      }
    }
    // 4. Scan Location
    else if (scanned.type === 'location') {
      if (activePickList) {
        const matchingLines = activePickList.lines?.filter((l: any) => l.location_id === scanned.code && l.status === 'pending');
        if (matchingLines && matchingLines.length > 0) {
          setScannedLineHighlight(matchingLines[0].id);
          setTimeout(() => setScannedLineHighlight(null), 3500);
          setSuccessMessage(`Shelf code identified: Found ${matchingLines.length} item lines stored at Bin Location ${scanned.code}. Highlighting first line.`);
        } else {
          setErrorMessage(`No pending items in active Pick List are stored at Location ${scanned.code}.`);
        }
      } else {
        setErrorMessage(`Scanned shelf location ${scanned.code}. Open a pick list first to verify positions.`);
      }
    }
  };

  // Dispatch fields
  const [driverId, setDriverId] = useState('U-DRIVER');
  const [totesCount, setTotesCount] = useState(2);
  const [dispatchTemp, setDispatchTemp] = useState(2.5); // Chilled norm

  // Reason codes
  const [shortPickReasons, setShortPickReasons] = useState<{ [key: string]: string }>({});
  const [pickerInputs, setPickerInputs] = useState<{ [key: string]: number }>({});

  // Messages
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [skus, setSkus] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  const SUPPLIERS_MAP: { [key: string]: string } = {
    'S-KENCHIC': 'Kenchic Poultry Ltd',
    'S-NAIROBI-GREENS': 'Nairobi Fresh Produce Co.',
    'S-DRYPACK': 'Drypack Millers Ltd'
  };

  useEffect(() => {
    fetchOrders();
    fetchPicklists();
    fetchSkus();
  }, [refreshFlag]);

  const fetchSkus = async () => {
    try {
      const res = await fetch('/api/v1/skus');
      const data = await res.json();
      if (data.data) setSkus(data.data);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    const res = await fetch('/api/v1/orders');
    const data = await res.json();
    if (data.data) setOrders(data.data);
  };

  const fetchPicklists = async () => {
    const res = await fetch('/api/v1/pick-lists');
    const data = await res.json();
    if (data.data) setPickLists(data.data);
  };

  const query = searchQuery.toLowerCase().trim();

  const filteredOrders = orders.filter(o => {
    if (!query) return true;
    const matchBasic = 
      o.id.toLowerCase().includes(query) || 
      (o.customer_name && o.customer_name.toLowerCase().includes(query)) ||
      (o.external_order_id && o.external_order_id.toLowerCase().includes(query));
    if (matchBasic) return true;

    if (o.lines && o.lines.length > 0) {
      return o.lines.some((l: any) => {
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

  const filteredPickLists = pickLists.filter(pl => {
    if (!query) return true;
    const matchBasic = 
      pl.id.toLowerCase().includes(query) || 
      pl.order_id.toLowerCase().includes(query);
    if (matchBasic) return true;

    if (pl.lines && pl.lines.length > 0) {
      return pl.lines.some((l: any) => {
        const skuInfo = skus.find(s => s.id === l.sku_id);
        const skuName = skuInfo?.name || l.sku_name || '';
        const supplierId = skuInfo?.supplier_id || '';
        const supplierName = SUPPLIERS_MAP[supplierId] || '';
        const matchBatch = 
          (l.batch_id && l.batch_id.toLowerCase().includes(query)) ||
          (l.batch_number && l.batch_number.toLowerCase().includes(query));
        return (
          l.sku_id.toLowerCase().includes(query) ||
          skuName.toLowerCase().includes(query) ||
          supplierId.toLowerCase().includes(query) ||
          supplierName.toLowerCase().includes(query) ||
          matchBatch
        );
      });
    }
    return false;
  });

  const filteredSelectedOrderLines = selectedOrder?.lines?.filter((l: any) => {
    if (!query) return true;
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

  const filteredActivePickListLines = activePickList?.lines?.filter((l: any) => {
    if (!query) return true;
    const skuInfo = skus.find(s => s.id === l.sku_id);
    const skuName = skuInfo?.name || l.sku_name || '';
    const supplierId = skuInfo?.supplier_id || '';
    const supplierName = SUPPLIERS_MAP[supplierId] || '';
    const matchBatch = 
      (l.batch_id && l.batch_id.toLowerCase().includes(query)) ||
      (l.batch_number && l.batch_number.toLowerCase().includes(query));
    return (
      l.sku_id.toLowerCase().includes(query) ||
      skuName.toLowerCase().includes(query) ||
      supplierId.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      matchBatch
    );
  });

  const handleSelectOrder = async (order: any) => {
    try {
      const res = await fetch(`/api/v1/orders/${order.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedOrder(payload.data);
        setActivePickList(null);
        setErrorMessage(null);
        setSuccessMessage(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSelectPicklist = async (pl: any) => {
    try {
      const res = await fetch(`/api/v1/pick-lists/${pl.id}`);
      const payload = await res.json();
      if (payload.data) {
        setActivePickList(payload.data);
        setSelectedOrder(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        
        // Populate inputs
        const inputs: { [key: string]: number } = {};
        const reasons: { [key: string]: string } = {};
        payload.data.lines.forEach((l: any) => {
          inputs[l.id] = l.qty_picked !== null ? l.qty_picked : l.qty_requested;
          reasons[l.id] = l.short_pick_reason || '';
        });
        setPickerInputs(inputs);
        setShortPickReasons(reasons);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGeneratePicklist = async (orderId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/orders/${orderId}/pick-list`, { method: 'POST' });
      const payload = await res.json();

      if (payload.error) {
        setErrorMessage(payload.error.message);
      } else {
        setSuccessMessage(`Automated FEFO Pick List generated! Earliest expiring batches reserved.`);
        fetchPicklists();
        fetchOrders();
        handleSelectPicklist(payload.data);
      }
    } catch (err) {
      setErrorMessage('Verification failed.');
    }
  };

  const handleAssignPicklist = async (plId: string) => {
    try {
      const res = await fetch(`/api/v1/pick-lists/${plId}/assign`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picker_id: currentUser?.id || 'U-PICKER' })
      });
      const data = await res.json();
      if (data.data) {
        setSuccessMessage('Pick list is now assigned to you and IN_PROGRESS.');
        handleSelectPicklist(data.data);
        fetchPicklists();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handlePickLine = async (lineId: string, requested: number) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    const picked = pickerInputs[lineId];
    const reason = shortPickReasons[lineId];

    if (picked < requested && !reason) {
      setErrorMessage('Security Warning: If logged picked quantity is short, a short pick reason code MUST be supplied (BR-031).');
      return;
    }

    try {
      const res = await fetch(`/api/v1/pick-lists/${activePickList.id}/lines/${lineId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_picked: picked, short_pick_reason: reason })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        setSuccessMessage('Picked line item logged successfully!');
        // Reload details
        handleSelectPicklist(activePickList);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCompletePicklist = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/pick-lists/${activePickList.id}/complete`, { method: 'POST' });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        setSuccessMessage(`Order picking completed successfully! Deducted quantities committed from stock ledger.`);
        setActivePickList(null);
        fetchPicklists();
        fetchOrders();
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleReopenPicklist = async () => {
    setErrorMessage(null);

    try {
      const res = await fetch(`/api/v1/pick-lists/${activePickList.id}/reopen`, { method: 'POST' });
      const data = await res.json();
      if (data.error) setErrorMessage(data.error.message);
      else {
        setSuccessMessage('Picklist reopened and unlocked for editing.');
        handleSelectPicklist(data.data);
        fetchPicklists();
        triggerRefresh();
      }
    } catch (err) {
       console.error(err);
    }
  };

  const handleSortFEFO = () => {
    if (!activePickList || !activePickList.lines) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    const sortedLines = [...activePickList.lines].sort((a: any, b: any) => {
      const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : Infinity;
      const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : Infinity;
      if (dateA !== dateB) return dateA - dateB;
      // Secondary sort fallback - sku_name or id
      return a.sku_id.localeCompare(b.sku_id);
    });

    setActivePickList({
      ...activePickList,
      lines: sortedLines
    });
    setSuccessMessage("FEFO Sort Applied! Reordered picking list items by earliest batch expiration dates (First Expired, First Out).");
  };

  const handleDispatchOrder = async (orderId: string) => {
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await fetch(`/api/v1/orders/${orderId}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: driverId,
          tote_count: totesCount,
          temp_log: { temperature_celsius: dispatchTemp }
        })
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message);
      } else {
        if (data.breach) {
          setSuccessMessage(`Order dispatched successfully! WARNING: Temp logged (${dispatchTemp}°C) exceeded limits, COLD_CHAIN_BREACH leak event automatically flagged in system.`);
        } else {
          setSuccessMessage(`Order packed into totes and dispatched to last-mile transport!`);
        }
        setSelectedOrder(null);
        fetchOrders();
        triggerRefresh();
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Alert Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Compliance Warning</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <CheckCircle className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Action Commited</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Orders & Pick lists */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          {/* Barcode Scanner Input */}
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider font-mono">Fulfillment Scanner Terminal</p>
            <BarcodeInput 
              onScan={handleRawBarcodeScan}
              context="fulfillment"
              activeId={activePickList?.id}
            />
          </div>

          {/* Search bar */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search ID, SKU, Supplier, Batch..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-8 py-2 bg-slate-50 border border-slate-200 focus:border-indigo-500 focus:bg-white rounded-xl text-xs placeholder-slate-400 font-medium transition-all"
            />
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2.5 text-slate-450 hover:text-slate-600 font-bold"
              >
                ×
              </button>
            )}
          </div>

          {/* Incoming Orders Section */}
          <div className="space-y-2">
            <div className="border-b border-slate-100 pb-2 flex items-center space-x-2">
              <Boxes className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">1. Customer Orders</h2>
            </div>
            
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {filteredOrders.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No orders match search query</p>
              ) : (
                filteredOrders.map(o => (
                  <div
                    key={o.id}
                    onClick={() => handleSelectOrder(o)}
                    className={`p-2.5 border rounded-xl text-xs pointer transition-all flex items-center justify-between ${
                      selectedOrder?.id === o.id 
                        ? 'bg-slate-900 text-white border-slate-900' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold font-mono text-[10px] uppercase">{o.id} ({o.external_order_id || 'OMS'})</p>
                      <p className={`font-semibold ${selectedOrder?.id === o.id ? 'text-slate-300' : 'text-slate-500'}`}>{o.customer_name}</p>
                    </div>
                    <div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                        o.status === 'received' ? 'bg-indigo-100 text-indigo-800' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {o.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Active Picklists list */}
          <div className="space-y-2 pt-2 border-t border-slate-100">
            <div className="border-b border-slate-100 pb-2 flex items-center space-x-2">
              <QrCode className="h-4.5 w-4.5 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">2. Active Floor Pick Lists</h2>
            </div>
            
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {filteredPickLists.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No pick lists match search query</p>
              ) : (
                filteredPickLists.map(pl => (
                  <div
                    key={pl.id}
                    onClick={() => handleSelectPicklist(pl)}
                    className={`p-2.5 border rounded-xl text-xs pointer transition-all flex items-center justify-between ${
                      activePickList?.id === pl.id 
                        ? 'bg-slate-900 text-white border-slate-950 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
                    }`}
                  >
                    <div>
                      <p className="font-bold font-mono tracking-wide">{pl.id}</p>
                      <p className={`text-[10px] ${activePickList?.id === pl.id ? 'text-slate-300' : 'text-slate-400'}`}>Order: {pl.order_id}</p>
                    </div>
                    <div>
                      <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold uppercase ${
                        pl.status === 'completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-850'
                      }`}>
                        {pl.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center & Right column dynamic views */}
        <div className="lg:col-span-2">
          {selectedOrder ? (
            /* Selected order dispatch and picklist generation */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center bg-slate-50/50 p-3 rounded-lg">
                <div className="space-y-0.5">
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-full uppercase">OMS Order Document</span>
                  <p className="text-sm font-bold text-slate-800">{selectedOrder.customer_name} ({selectedOrder.id})</p>
                </div>
                <div className="text-right">
                  <span className="text-xs font-bold text-slate-500 block">Delivery To:</span>
                  <p className="text-xs font-bold text-slate-900">{selectedOrder.delivery_address}</p>
                </div>
              </div>

              {/* Order lines */}
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-900 uppercase tracking-wide font-sans md:tracking-normal flex items-center justify-between">
                  <span>Ordered Items</span>
                  {searchQuery && (
                    <span className="text-[10px] lowercase text-indigo-700 bg-indigo-55 border border-indigo-150 px-2 py-0.5 rounded-full font-medium">Filtered</span>
                  )}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {!filteredSelectedOrderLines || filteredSelectedOrderLines.length === 0 ? (
                    <p className="text-xs text-slate-400 py-4 text-center col-span-3">No ordered items match search query</p>
                  ) : (
                    filteredSelectedOrderLines.map((line: any, idx: number) => {
                      const targetSku = skus.find(s => s.id === line.sku_id);
                      return (
                        <div key={idx} className="p-3 bg-slate-50/80 border border-slate-100 rounded-xl text-xs space-y-1">
                          <p className="font-bold text-slate-800">{line.sku_name}</p>
                          <p className="text-xxs text-slate-400 font-mono">CODE: {line.sku_code}</p>
                          <div className="flex justify-between items-center pt-1 border-t border-slate-200/50">
                            <span className="text-[10px] text-slate-500">Ordered Qty:</span>
                            <span className="font-bold text-slate-900">{displayQty(line.qty_ordered, targetSku)}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Action buttons */}
              <div className="border-t border-slate-100 pt-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
                {selectedOrder.status === 'received' && (
                  <div className="space-y-1 w-full sm:w-auto">
                    <p className="text-xs font-semibold text-slate-600">Issued and awaiting pick reservation list</p>
                    <button
                      onClick={() => handleGeneratePicklist(selectedOrder.id)}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all"
                    >
                      Process FEFO Pick List Allocation
                    </button>
                  </div>
                )}

                {selectedOrder.status === 'packed' && (
                  /* Dispatch form */
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl w-full grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs items-end">
                    <div className="sm:col-span-2 space-y-2 text-left">
                      <p className="font-bold text-slate-800 flex items-center gap-1">
                        <Truck className="h-4 w-4 text-slate-600" />
                        <span>Ready For Dispatch Packing</span>
                      </p>
                      <p className="text-[10px] text-slate-500">Select driver and record chill temperatures log</p>
                      
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <label className="block text-slate-450 mb-0.5">Last-mile Driver</label>
                          <select
                            value={driverId}
                            onChange={(e) => setDriverId(e.target.value)}
                            className="w-full bg-white border border-slate-200 p-1 rounded-md"
                          >
                            <option value="U-DRIVER">Peter Kiprop (Driver Van 1)</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-slate-450 mb-0.5">Tote count packed</label>
                          <input
                            type="number"
                            value={totesCount}
                            onChange={(e) => setTotesCount(parseInt(e.target.value) || 2)}
                            className="w-full bg-white border border-slate-200 p-1 rounded-md text-center"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] text-slate-500 font-bold uppercase mb-1 flex items-center gap-1">
                        <Thermometer className="h-3.5 w-3.5 text-slate-400" />
                        <span>Dispatch Temp (°C)</span>
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={dispatchTemp}
                        onChange={(e) => setDispatchTemp(parseFloat(e.target.value) || 2)}
                        className="w-full bg-white border border-slate-250 p-2 rounded-lg font-mono font-bold"
                      />
                    </div>

                    <button
                      onClick={() => handleDispatchOrder(selectedOrder.id)}
                      className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-[11px] transition-all"
                    >
                      Issue Gatepass Dispatch
                    </button>
                  </div>
                )}

                {selectedOrder.status !== 'received' && selectedOrder.status !== 'packed' && (
                  <p className="text-xs text-slate-400">Order is in status: <b className="text-slate-600">{selectedOrder.status}</b>. Completed floor picking or in delivery route.</p>
                )}
              </div>
            </div>
          ) : activePickList ? (
            /* Active floor picklist picking lines controller */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div className="space-y-0.5">
                  <h2 className="text-sm font-bold text-slate-900">Floor Picking Sheet ({activePickList.id})</h2>
                  <p className="text-xs text-slate-500">Pick from Depot: <b>{activePickList.warehouse_id}</b> for Order: {activePickList.order_id}</p>
                </div>

                <div className="flex gap-2 text-[10px] font-bold">
                  {activePickList.status === 'completed' && (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded flex items-center gap-1">
                      <Lock className="h-3.5 w-3.5" />
                      Locked (Completed)
                    </span>
                  )}
                  {activePickList.status === 'in_progress' && (
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded">In Progress (By: {activePickList.assigned_to})</span>
                  )}
                  {activePickList.status === 'pending' && (
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-700 rounded">Pending Assignment</span>
                  )}
                </div>
              </div>

              {activePickList.status === 'pending' ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl space-y-2">
                  <Scan className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">Awaiting Picker Assignment</p>
                  <button
                    onClick={() => handleAssignPicklist(activePickList.id)}
                    className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-bold font-medium"
                  >
                    Accept Work Assignment
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Lines list */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between pb-1">
                      <p className="text-xs font-bold text-slate-900 uppercase flex items-center gap-1.5">
                        <span>Reserves To Scan</span>
                        {searchQuery && (
                          <span className="text-[10px] lowercase text-indigo-700 bg-indigo-55 border border-indigo-150 px-2 py-0.5 rounded-full font-medium">Filtered</span>
                        )}
                      </p>
                      
                      {activePickList.status !== 'completed' && activePickList.lines && activePickList.lines.length > 1 && (
                        <button
                          type="button"
                          onClick={handleSortFEFO}
                          className="flex items-center space-x-1 px-2 py-0.5 text-[10px] bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-800 rounded-md font-bold transition-all border border-indigo-200 shadow-xs cursor-pointer"
                          title="Apply FEFO Pick sequencing to optimize path based on earliest batch expiry dates"
                        >
                          <ArrowDownUp className="h-3 w-3 shrink-0" />
                          <span>FEFO SORTING</span>
                        </button>
                      )}
                    </div>
                    
                    {!filteredActivePickListLines || filteredActivePickListLines.length === 0 ? (
                      <p className="text-xs text-slate-400 py-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">No picking lines match search query</p>
                    ) : (
                      filteredActivePickListLines.map((line: any, idx: number) => {
                      const isComplete = activePickList.status === 'completed';
                      const targetSku = skus.find(s => s.id === line.sku_id);
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-xl flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 text-xs border transition-all duration-300 ${
                            scannedLineHighlight === line.id 
                              ? 'bg-indigo-55/60 border-indigo-500 ring-2 ring-indigo-500/20 scale-[1.01]' 
                              : 'bg-slate-50 border-slate-100'
                          }`}
                        >
                          <div className="space-y-1 md:max-w-[40%]">
                            <p className="font-bold text-slate-800 leading-tight">{line.sku_name}</p>
                            <div className="flex flex-wrap gap-2 text-[10px] font-mono whitespace-nowrap">
                              <span className="text-slate-500">Shelf: <b className="text-indigo-800 font-bold">{line.location_code}</b></span>
                              <span className="text-slate-300">|</span>
                              <span className="text-slate-500">Batch: <b className="text-slate-700 font-bold">{line.batch_id}</b></span>
                              {line.expiry_date && (
                                <>
                                  <span className="text-slate-300">|</span>
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1 rounded border border-rose-100">Exp: {line.expiry_date.slice(0, 10)}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Picking fields */}
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-slate-400 block font-bold">Requested</span>
                              <span className="font-bold text-slate-800">{displayQty(line.qty_requested, targetSku)}</span>
                            </div>

                            <div className="w-24">
                              <span className="text-[10px] text-slate-400 block font-bold">Qty Logged</span>
                              <input
                                type="number"
                                min="0"
                                disabled={isComplete}
                                value={pickerInputs[line.id] !== undefined ? pickerInputs[line.id] : ''}
                                onChange={(e) => {
                                  const copy = { ...pickerInputs };
                                  copy[line.id] = parseInt(e.target.value) || 0;
                                  setPickerInputs(copy);
                                }}
                                className="w-full bg-white border border-slate-200 rounded p-1 font-bold text-center text-xs"
                              />
                            </div>

                            {/* Short Pick Reason dropdown */}
                            {pickerInputs[line.id] < line.qty_requested && (
                              <div className="w-28">
                                <span className="text-[10px] text-rose-500 block font-bold">Short Pick Code <span className="text-rose-500">*</span></span>
                                <select
                                  disabled={isComplete}
                                  value={shortPickReasons[line.id]}
                                  onChange={(e) => {
                                    const copy = { ...shortPickReasons };
                                    copy[line.id] = e.target.value;
                                    setShortPickReasons(copy);
                                  }}
                                  className="w-full bg-white border border-rose-200 outline-rose-500 text-rose-800 p-1 rounded text-xxs font-bold"
                                >
                                  <option value="">-- Choose Reason --</option>
                                  <option value="OUT_OF_STOCK">OUT OF STOCK</option>
                                  <option value="DAMAGED_ON_SHELF">DAMAGED ON SHELF</option>
                                  <option value="LOCATION_EMPTY">LOCATION EMPTY</option>
                                  <option value="QUALITY_REJECT">QUALITY REJECT</option>
                                </select>
                              </div>
                            )}

                            {!isComplete && (
                              <button
                                onClick={() => handlePickLine(line.id, line.qty_requested)}
                                className="px-2.5 py-1.5 bg-slate-900 text-white font-bold rounded"
                              >
                                {line.status === 'pending' ? 'Scan' : 'Revise'}
                              </button>
                            )}

                            {isComplete && (
                              <span className="text-[10px] bg-slate-200 text-slate-700 font-bold p-1 rounded tracking-wide">
                                Logged: {line.qty_picked !== null ? line.qty_picked : 'N/A'} {line.short_pick_reason ? `(${line.short_pick_reason})` : ''}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  </div>

                  {/* Submission footers */}
                  <div className="border-t border-slate-100 pt-4 flex gap-2 justify-end">
                    {activePickList.status !== 'completed' ? (
                      <button
                        onClick={handleCompletePicklist}
                        disabled={activePickList.lines?.some((l: any) => l.status === 'pending')}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold rounded-lg text-xs"
                      >
                        Finalize pick and decrement stock ledger
                      </button>
                    ) : (
                      (currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') && (
                        <button
                          onClick={handleReopenPicklist}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-lg text-xs"
                        >
                          Reopen & Unlock Picklist for edits
                        </button>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400">
              <Boxes className="h-8 w-8 mx-auto mb-2 text-slate-300" />
              <p className="text-xs font-bold text-slate-500">Select a customer order or active pick list to begin processing.</p>
            </div>
          )}
        </div>
      </div>


    </div>
  );
}
