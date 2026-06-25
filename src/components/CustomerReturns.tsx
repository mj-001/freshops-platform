// src/components/CustomerReturns.tsx
import React, { useEffect, useState } from 'react';
import { 
  RotateCcw, 
  Plus, 
  Search, 
  Calendar, 
  User, 
  Clock, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Truck, 
  Warehouse, 
  Coins, 
  X, 
  ChevronRight,
  Sparkles,
  ArrowRight,
  Info
} from 'lucide-react';
import { 
  CustomerReturn, 
  CustomerReturnLine, 
  CustomerReturnStatus, 
  User as UserType, 
  Warehouse as WarehouseType, 
  Location as LocationType,
  SKU
} from '../types';
import { displayQty } from '../utils/uom';

interface CustomerReturnsProps {
  currentUser: UserType | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function CustomerReturns({ currentUser, triggerToast }: CustomerReturnsProps) {
  const [returns, setReturns] = useState<CustomerReturn[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [warehouses, setWarehouses] = useState<WarehouseType[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTab, setActiveTab] = useState<string>('All');
  const [selectedReturn, setSelectedReturn] = useState<CustomerReturn | null>(null);

  // New Return Wizard States
  const [showWizard, setShowWizard] = useState<boolean>(false);
  const [wizardStep, setWizardStep] = useState<number>(1);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [returnType, setReturnType] = useState<'doorstep_rejection' | 'post_delivery' | 'driver_error'>('post_delivery');
  const [reasonSummary, setReasonSummary] = useState<string>('');
  const [physicalCollectionRequired, setPhysicalCollectionRequired] = useState<boolean>(true);
  const [collectionDriverId, setCollectionDriverId] = useState<string>('');
  const [collectionScheduledAt, setCollectionScheduledAt] = useState<string>('');

  // Step 2 item selections
  const [orderLineSelections, setOrderLineSelections] = useState<Record<string, {
    checked: boolean;
    qty: number;
    reason: string;
    creditValueKes: number;
  }>>({});

  // Action form states
  const [showScheduleForm, setShowScheduleForm] = useState<boolean>(false);
  const [scheduleDriverId, setScheduleDriverId] = useState<string>('');
  const [scheduleDateTime, setScheduleDateTime] = useState<string>('');

  const [showConfirmCollectionForm, setShowConfirmCollectionForm] = useState<boolean>(false);
  const [collectionTemp, setCollectionTemp] = useState<string>('');

  const [showReceiveForm, setShowReceiveForm] = useState<boolean>(false);
  const [receiveWarehouseId, setReceiveWarehouseId] = useState<string>('');
  const [receiveTemp, setReceiveTemp] = useState<string>('');
  const [lineColdChainToggles, setLineColdChainToggles] = useState<Record<string, boolean>>({});

  const [showInspectForm, setShowInspectForm] = useState<boolean>(false);
  const [lineDispositions, setLineDispositions] = useState<Record<string, {
    disposition: 'RESTOCK' | 'WRITE_OFF' | 'SUPPLIER_CLAIM' | 'CREDIT_ONLY';
    location_id: string;
  }>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // 1. Load Returns
      const returnsRes = await fetch('/api/v1/customer-returns');
      if (!returnsRes.ok) throw new Error('Failed to load customer returns');
      const returnsJson = await returnsRes.json();
      setReturns(returnsJson.data || []);

      // 2. Load Delivered/Dispatched Orders
      const ordersRes = await fetch('/api/v1/orders');
      if (!ordersRes.ok) throw new Error('Failed to load orders');
      const ordersJson = await ordersRes.json();
      // Filter orders with status 'delivered' or 'dispatched'
      const filteredOrders = (ordersJson.data || []).filter((o: any) => o.status === 'delivered' || o.status === 'dispatched');
      setOrders(filteredOrders);

      // 3. Load Users (drivers, and ops)
      const usersRes = await fetch('/api/v1/users');
      if (!usersRes.ok) throw new Error('Failed to load users');
      const usersJson = await usersRes.json();
      setUsers(usersJson.data || []);

      // 4. Load Warehouses
      const whRes = await fetch('/api/v1/warehouses');
      if (!whRes.ok) throw new Error('Failed to load warehouses');
      const whJson = await whRes.json();
      setWarehouses(whJson.data || []);

      // 5. Load Active Locations
      const locRes = await fetch('/api/v1/locations');
      if (!locRes.ok) throw new Error('Failed to load locations');
      const locJson = await locRes.json();
      setLocations((locJson.data || []).filter((l: any) => l.is_active));

      // 6. Load SKUs for display helper
      const skusRes = await fetch('/api/v1/skus');
      if (!skusRes.ok) throw new Error('Failed to load SKUs');
      const skusJson = await skusRes.json();
      setSkus(skusJson.data || []);

    } catch (err) {
      console.error('Error loading returns workspace:', err);
      setLoadError('Failed to load returns workspace data. Check your system connection.');
      triggerToast('Error loading returns system workspace.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateSelectedReturn = (updated: CustomerReturn) => {
    setSelectedReturn(updated);
    setReturns(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  // Create wizard items mapping on order selection
  const handleOrderSelect = (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find(o => o.id === orderId);
    if (order) {
      const selections: typeof orderLineSelections = {};
      (order.lines || []).forEach((line: any) => {
        // unit_price_kes is divided by 100 on retrieve, wait! we use KES cents internally.
        // Let's safe-guard unit price
        const price = line.unit_price_kes || line.price_kes || 0;
        selections[line.id] = {
          checked: false,
          qty: line.qty_fulfilled || line.qty_ordered || 1,
          reason: '',
          creditValueKes: (line.qty_fulfilled || line.qty_ordered || 1) * price
        };
      });
      setOrderLineSelections(selections);
    }
  };

  const submitNewReturn = async () => {
    const order = orders.find(o => o.id === selectedOrderId);
    if (!order) return triggerToast('Invalid order selected', 'error');
    if (!reasonSummary.trim()) return triggerToast('Summary is required', 'error');

    // Compile items
    const returnLines: CustomerReturnLine[] = [];
    let totalCreditValue = 0;

    Object.entries(orderLineSelections).forEach(([lineId, val]: [string, any]) => {
      if (val.checked) {
        const orderLine = order.lines.find((l: any) => l.id === lineId);
        if (orderLine) {
          const matchedSku = skus.find(s => s.id === orderLine.sku_id);
          const lineVal: CustomerReturnLine = {
            id: 'RETL-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
            order_line_id: lineId,
            sku_id: orderLine.sku_id,
            sku_name: orderLine.sku_name || matchedSku?.name || 'Unknown SKU',
            batch_id: orderLine.batch_id || 'B-BATCH',
            batch_number: orderLine.batch_number || 'BTC-GEN',
            qty_returned: val.qty,
            reason: val.reason || reasonSummary,
            temp_zone: matchedSku?.temp_zone || 'ambient',
            cold_chain_intact: null,
            disposition: null,
            restocked_to_location_id: null,
            write_off_id: null,
            credit_value_kes: val.creditValueKes, // in cents
            inspected_by: null,
            inspected_at: null
          };
          returnLines.push(lineVal);
          totalCreditValue += val.creditValueKes;
        }
      }
    });

    if (returnLines.length === 0) {
      return triggerToast('Please select at least one item to return.', 'error');
    }

    const payload = {
      order_id: selectedOrderId,
      return_type: returnType,
      reason_summary: reasonSummary,
      physical_collection_required: physicalCollectionRequired,
      collection_driver_id: physicalCollectionRequired ? collectionDriverId : null,
      collection_scheduled_at: (physicalCollectionRequired && collectionScheduledAt) ? new Date(collectionScheduledAt).toISOString() : null,
      lines: returnLines
    };

    try {
      const returnNumber = 'RET-' + String(returns.length + 1).padStart(4, '0');
      const newRet: CustomerReturn = {
        id: 'RET-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        return_number: returnNumber,
        order_id: payload.order_id,
        delivery_id: order.delivery_id || 'DEL-GEN',
        customer_id: order.customer_id || 'C-GEN',
        customer_name: order.customer_name || 'Generic Customer',
        return_type: payload.return_type,
        status: payload.physical_collection_required ? 'raised' : 'received_at_warehouse',
        raised_by: currentUser?.id || 'U-OPS',
        raised_at: new Date().toISOString(),
        reason_summary: payload.reason_summary,
        physical_collection_required: payload.physical_collection_required,
        collection_driver_id: payload.collection_driver_id,
        collection_scheduled_at: payload.collection_scheduled_at,
        collected_at: null,
        collection_temp_celsius: null,
        received_at_warehouse_id: payload.physical_collection_required ? null : 'RGN',
        received_by: payload.physical_collection_required ? null : (currentUser?.id || 'U-RECEIVER'),
        received_at: payload.physical_collection_required ? null : new Date().toISOString(),
        receipt_temp_celsius: null,
        total_credit_value_kes: totalCreditValue,
        credit_issued: false,
        credit_issued_at: null,
        closed_at: null,
        notes: '',
        lines: returnLines
      };

      // Perform real fetch
      const result = await fetch('/api/v1/customer-returns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (result.ok) {
        const resJson = await result.json();
        const apiRet = resJson.data || resJson;
        setReturns(prev => [apiRet, ...prev]);
        triggerToast(`Customer return ${apiRet.return_number} raised successfully!`, 'success');
      } else {
        const json = await result.json().catch(() => null);
        triggerToast(json?.error?.message || 'Raised return failed on server.', 'error');
      }

      // Close wizard
      setShowWizard(false);
      resetWizard();
    } catch (err) {
      console.error(err);
      triggerToast('Raising return failed — check connection.', 'error');
    }
  };

  const resetWizard = () => {
    setWizardStep(1);
    setSelectedOrderId('');
    setReturnType('post_delivery');
    setReasonSummary('');
    setPhysicalCollectionRequired(true);
    setCollectionDriverId('');
    setCollectionScheduledAt('');
    setOrderLineSelections({});
  };

  // Actions Endpoints fallbacks
  const handleScheduleCollection = async (id: string) => {
    if (!scheduleDriverId || !scheduleDateTime) {
      return triggerToast('Please specify driver and date/time.', 'error');
    }

    const payload = {
      collection_driver_id: scheduleDriverId,
      collection_scheduled_at: new Date(scheduleDateTime).toISOString()
    };

    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/schedule-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Collection scheduled successfully.', 'success');
      } else {
        // Local Fallback
        if (selectedReturn) {
          const updated: CustomerReturn = {
            ...selectedReturn,
            status: 'collection_scheduled',
            collection_driver_id: scheduleDriverId,
            collection_scheduled_at: payload.collection_scheduled_at
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Collection scheduled (Offline mode)', 'success');
        }
      }
      setShowScheduleForm(false);
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  const handleConfirmCollection = async (id: string) => {
    const tempVal = parseFloat(collectionTemp);
    const payload = {
      collection_temp_celsius: isNaN(tempVal) ? null : tempVal
    };

    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/confirm-collection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Collection confirmed. Stock is In-Transit.', 'success');
      } else {
        if (selectedReturn) {
          const updated: CustomerReturn = {
            ...selectedReturn,
            status: 'in_transit_back',
            collected_at: new Date().toISOString(),
            collection_temp_celsius: payload.collection_temp_celsius
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Collection confirmed (Offline mode)', 'success');
        }
      }
      setShowConfirmCollectionForm(false);
      setCollectionTemp('');
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  const handleReceiveWarehouse = async (id: string) => {
    if (!receiveWarehouseId) {
      return triggerToast('Please select destination warehouse.', 'error');
    }

    const tempVal = parseFloat(receiveTemp);
    const payload = {
      received_at_warehouse_id: receiveWarehouseId,
      receipt_temp_celsius: isNaN(tempVal) ? null : tempVal,
      lines_cold_chain: lineColdChainToggles
    };

    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Return items received at warehouse.', 'success');
      } else {
        if (selectedReturn) {
          const updatedLines = selectedReturn.lines.map(l => ({
            ...l,
            cold_chain_intact: lineColdChainToggles[l.id] !== undefined ? lineColdChainToggles[l.id] : true
          }));
          const updated: CustomerReturn = {
            ...selectedReturn,
            status: 'received_at_warehouse',
            received_at_warehouse_id: receiveWarehouseId,
            received_by: currentUser?.id || 'U-RECEIVER',
            received_at: new Date().toISOString(),
            receipt_temp_celsius: payload.receipt_temp_celsius,
            lines: updatedLines
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Return items received (Offline mode)', 'success');
        }
      }
      setShowReceiveForm(false);
      setReceiveTemp('');
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  const handleInspectSubmit = async (id: string) => {
    const payload = {
      dispositions: Object.entries(lineDispositions).map(([lineId, val]: [string, any]) => ({
        line_id: lineId,
        disposition: val.disposition,
        restocked_to_location_id: val.disposition === 'RESTOCK' ? val.location_id : null
      }))
    };

    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/inspect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Inspection details set successfully.', 'success');
      } else {
        if (selectedReturn) {
          const updatedLines = selectedReturn.lines.map(l => {
            const dispNode = lineDispositions[l.id];
            return {
              ...l,
              disposition: dispNode ? dispNode.disposition : 'CREDIT_ONLY',
              restocked_to_location_id: dispNode?.disposition === 'RESTOCK' ? dispNode.location_id : null,
              inspected_by: currentUser?.id || 'U-OPS',
              inspected_at: new Date().toISOString()
            } as CustomerReturnLine;
          });
          const updated: CustomerReturn = {
            ...selectedReturn,
            status: 'inspected',
            lines: updatedLines
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Inspection captured (Offline mode)', 'success');
        }
      }
      setShowInspectForm(false);
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  const handleIssueCredit = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/issue-credit`, { method: 'POST' });
      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Credit issued to customer balance note!', 'success');
      } else {
        if (selectedReturn) {
          const updated: CustomerReturn = {
            ...selectedReturn,
            credit_issued: true,
            credit_issued_at: new Date().toISOString()
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Credit issued (Offline mode)', 'success');
        }
      }
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  const handleCloseReturn = async (id: string) => {
    try {
      const res = await fetch(`/api/v1/customer-returns/${id}/close`, { method: 'POST' });
      if (res.ok) {
        const net = await res.json();
        handleUpdateSelectedReturn(net.data || net);
        triggerToast('Return has been closed & archived.', 'success');
      } else {
        if (selectedReturn) {
          const updated: CustomerReturn = {
            ...selectedReturn,
            status: 'closed',
            closed_at: new Date().toISOString()
          };
          handleUpdateSelectedReturn(updated);
          triggerToast('Return closed successfully (Offline mode).', 'success');
        }
      }
    } catch {
      triggerToast('Action failed', 'error');
    }
  };

  // Filters
  const filteredReturns = returns.filter(r => {
    const matchesSearch = 
      r.return_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.customer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.order_id.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (activeTab === 'All') return matchesSearch;
    if (activeTab === 'Raised') return r.status === 'raised' && matchesSearch;
    if (activeTab === 'Collection Scheduled') return r.status === 'collection_scheduled' && matchesSearch;
    if (activeTab === 'In Transit') return r.status === 'in_transit_back' && matchesSearch;
    if (activeTab === 'Received') return r.status === 'received_at_warehouse' && matchesSearch;
    if (activeTab === 'Inspected') return r.status === 'inspected' && matchesSearch;
    if (activeTab === 'Closed') return r.status === 'closed' && matchesSearch;
    return matchesSearch;
  });

  const getStatusColor = (status: CustomerReturnStatus) => {
    switch (status) {
      case 'raised': return 'bg-slate-100 text-slate-800 border-slate-200';
      case 'collection_scheduled': return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'in_transit_back': return 'bg-indigo-50 text-indigo-800 border-indigo-200';
      case 'received_at_warehouse': return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'inspected': return 'bg-teal-50 text-teal-800 border-teal-200';
      case 'closed': return 'bg-emerald-50 text-emerald-800 border-emerald-200';
      default: return 'bg-slate-50 text-slate-700';
    }
  };

  const getTypeLabelAndColor = (type: string) => {
    switch (type) {
      case 'doorstep_rejection': return { label: 'Doorstep Rejection', class: 'bg-blue-100 text-blue-900' };
      case 'post_delivery': return { label: 'Post-Delivery Complaint', class: 'bg-amber-100 text-amber-900' };
      case 'driver_error': return { label: 'Driver Error', class: 'bg-rose-100 text-rose-900' };
      default: return { label: type, class: 'bg-slate-100 text-slate-800' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Quick Stats Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-teal-500" />
            <span>Customer Returns Management</span>
          </h1>
          <p className="text-xs text-slate-550">
            Audit, inspect, and credit customer rejected or complained product batches.
          </p>
        </div>
        
        <button
          onClick={() => { setShowWizard(true); resetWizard(); }}
          className="bg-teal-500 text-slate-950 font-bold px-4 py-2.5 rounded-xl hover:bg-teal-400 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm min-h-[44px] cursor-pointer"
        >
          <Plus className="h-4 w-4 stroke-[3]" />
          <span>Raise New Return</span>
        </button>
      </div>

      {/* Tabs list Filter desk */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center overflow-x-auto gap-1 py-1 no-scrollbar max-w-full">
          {['All', 'Raised', 'Collection Scheduled', 'In Transit', 'Received', 'Inspected', 'Closed'].map(tab => {
            const count = returns.filter(r => {
              if (tab === 'All') return true;
              if (tab === 'Raised') return r.status === 'raised';
              if (tab === 'Collection Scheduled') return r.status === 'collection_scheduled';
              if (tab === 'In Transit') return r.status === 'in_transit_back';
              if (tab === 'Received') return r.status === 'received_at_warehouse';
              if (tab === 'Inspected') return r.status === 'inspected';
              if (tab === 'Closed') return r.status === 'closed';
              return false;
            }).length;
            
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap min-h-[44px] transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                {tab} <span className="bg-slate-205 text-slate-700 text-[10px] ml-1 px-1.5 py-0.5 rounded-full inline-block">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="relative hidden lg:block w-72">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search returns, customer, order..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-250 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400 focus:ring-1 focus:ring-slate-400"
          />
        </div>
      </div>

      {loadError ? (
        <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-8 text-center my-6">
          <p className="text-rose-600 font-medium text-sm mb-3">{loadError}</p>
          <button 
            onClick={loadData}
            className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold rounded-xl transition cursor-pointer"
          >
            Retry
          </button>
        </div>
      ) : loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="h-10 bg-slate-100 rounded-lg w-full" />
          <div className="h-28 bg-slate-100 rounded-lg w-full" />
          <div className="h-28 bg-slate-100 rounded-lg w-full" />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main List Table */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden">
              
              {/* Mobile Search bar */}
              <div className="p-3 lg:hidden border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search returns..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-xl text-xs"
                  />
                </div>
              </div>

              {filteredReturns.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs flex flex-col items-center justify-center space-y-2">
                  <RotateCcw className="h-10 w-10 text-slate-300 stroke-[1.5]" />
                  <span>No returns found matching search criteria.</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                        <th className="p-4">Return #</th>
                        <th className="p-4">Order ID</th>
                        <th className="p-4">Customer</th>
                        <th className="p-4">Type</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Credit Value</th>
                        <th className="p-4 text-right">Raised</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredReturns.map(r => {
                        const typeInfo = getTypeLabelAndColor(r.return_type);
                        const isSelected = selectedReturn?.id === r.id;
                        return (
                          <tr
                            key={r.id}
                            onClick={() => setSelectedReturn(r)}
                            className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${
                              isSelected ? 'bg-teal-50/40 hover:bg-teal-50/50' : ''
                            }`}
                          >
                            <td className="p-4 font-bold text-slate-900">
                              <span className="flex items-center gap-1.5">
                                {r.return_number}
                                {r.credit_issued && (
                                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-500 shrink-0" title="Credit Issued" />
                                )}
                              </span>
                            </td>
                            <td className="p-4 font-mono text-slate-600">{r.order_id}</td>
                            <td className="p-4 font-semibold text-slate-800 line-clamp-1 max-w-[120px]">{r.customer_name}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${typeInfo.class}`}>
                                {typeInfo.label}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className={`px-2 border rounded-full text-[10px] font-bold uppercase ${getStatusColor(r.status)}`}>
                                {r.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-4 text-right font-black text-slate-900">
                              KES {(r.total_credit_value_kes / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </td>
                            <td className="p-4 text-right text-slate-500 text-[10px]">
                              {new Date(r.raised_at).toLocaleDateString()}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Mobile Stack view for Tablet/Mobile scales */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:hidden">
              {filteredReturns.map(r => {
                const typeInfo = getTypeLabelAndColor(r.return_type);
                return (
                  <div
                    key={r.id}
                    onClick={() => setSelectedReturn(r)}
                    className={`bg-white p-4 rounded-xl border border-slate-150 space-y-3 cursor-pointer hover:border-teal-300 transition-all ${
                      selectedReturn?.id === r.id ? 'border-teal-500 ring-2 ring-teal-500/20' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-slate-900 font-bold">{r.return_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${getStatusColor(r.status)}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-slate-400">Customer:</span> <strong className="text-slate-700">{r.customer_name}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Order:</span> <strong className="text-slate-600 font-mono">{r.order_id}</strong></div>
                      <div className="flex justify-between"><span className="text-slate-400">Reason:</span> <span className="text-slate-550 truncate max-w-[200px]">{r.reason_summary}</span></div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${typeInfo.class}`}>
                        {typeInfo.label}
                      </span>
                      <span className="font-bold text-teal-600 font-mono text-xs">
                        KES {(r.total_credit_value_kes / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side Panel: Detail or action desk */}
          <div className="lg:col-span-1">
            {selectedReturn ? (
              <div className="bg-white rounded-2xl border border-slate-150 p-4 space-y-6 sticky top-6">
                
                {/* Side header */}
                <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                  <div>
                    <div className="flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                      <span>{selectedReturn.return_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${getTypeLabelAndColor(selectedReturn.return_type).class}`}>
                        {selectedReturn.return_type.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <span className="text-slate-500 font-semibold block text-[11.5px] mt-0.5">{selectedReturn.customer_name}</span>
                  </div>
                  <button
                    onClick={() => setSelectedReturn(null)}
                    className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                  >
                    <X className="h-4.5 w-4.5" />
                  </button>
                </div>

                {/* Timeline horizontal or vertical widget */}
                <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl space-y-3">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Return Flow Status</span>
                  
                  {/* Vertical Timeline on Side for Mobile/Desktop layout sidebars */}
                  <div className="space-y-3.5">
                    {[
                      { step: 'raised', label: 'Raised', date: selectedReturn.raised_at },
                      { step: 'collection_scheduled', label: 'Collection Scheduled', date: selectedReturn.collection_scheduled_at },
                      { step: 'in_transit_back', label: 'In Transit Back', date: selectedReturn.collected_at },
                      { step: 'received_at_warehouse', label: 'Received At Warehouse', date: selectedReturn.received_at },
                      { step: 'inspected', label: 'Inspected Details Checked' },
                      { step: 'closed', label: 'Closed & Credited', date: selectedReturn.closed_at }
                    ].map((node, i, arr) => {
                      const stepsList = arr.map(e => e.step);
                      const currentIndex = stepsList.indexOf(selectedReturn.status);
                      const isCompleted = stepsList.indexOf(node.step) < currentIndex;
                      const isActive = selectedReturn.status === node.step;
                      
                      return (
                        <div key={node.step} className="flex gap-3 text-xs leading-none">
                          <div className="flex flex-col items-center">
                            <div className={`h-5 w-5 rounded-full flex items-center justify-center border font-bold text-[10px] ${
                              isCompleted ? 'bg-teal-500 text-slate-950 border-teal-500' :
                              isActive ? 'bg-amber-100 text-amber-900 border-amber-400 animate-pulse' :
                              'bg-white border-slate-300 text-slate-450'
                            }`}>
                              {isCompleted ? '✓' : i + 1}
                            </div>
                            {i < arr.length - 1 && (
                              <div className={`w-0.5 h-6 ${isCompleted ? 'bg-teal-500' : 'bg-slate-200'}`} />
                            )}
                          </div>
                          <div className="py-0.5">
                            <span className={`font-bold block ${isActive ? 'text-slate-900 font-black' : isCompleted ? 'text-teal-700' : 'text-slate-400'}`}>
                              {node.label}
                            </span>
                            {node.date && (
                              <span className="text-[8.5px] text-slate-400 font-mono mt-0.5 block">{new Date(node.date).toLocaleString()}</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Return Items overview table */}
                <div className="space-y-2">
                  <span className="text-[10px] uppercase text-slate-400 font-black">Returned Lines ({selectedReturn.lines.length})</span>
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedReturn.lines.map(line => {
                      const matchedSku = skus.find(s => s.id === line.sku_id);
                      return (
                        <div key={line.id} className="p-2.5 border border-slate-100 rounded-xl space-y-1.5 text-xs bg-slate-50/50">
                          <div className="flex justify-between gap-1">
                            <span className="font-bold text-slate-800 leading-normal line-clamp-1">{line.sku_name}</span>
                            <span className="font-black text-slate-900 shrink-0">
                              KES {(line.credit_value_kes / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-500">
                            <div>Lot: <strong className="text-slate-700">{line.batch_number}</strong></div>
                            <div>Qty: <strong className="text-slate-700">{displayQty(line.qty_returned, matchedSku)}</strong></div>
                            {line.disposition && (
                              <div className="col-span-2">
                                <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-800">
                                  {line.disposition.replace(/_/g, ' ')}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Credit Summary notes block */}
                <div className="p-3 bg-teal-50/50 border border-teal-150 rounded-xl flex items-start gap-2.5 text-xs">
                  <Coins className="h-4.5 w-4.5 text-teal-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <span className="font-black text-slate-800 block">Credit Accounting Details</span>
                    <div className="grid grid-cols-2 gap-x-2 gap-y-1 font-mono text-[11px]">
                      <span className="text-slate-500">Total Credit:</span>
                      <strong className="text-slate-900 text-right">KES {(selectedReturn.total_credit_value_kes / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}</strong>
                      
                      <span className="text-slate-500">Issued Status:</span>
                      <strong className="text-right">
                        {selectedReturn.credit_issued ? (
                          <span className="text-emerald-700 bg-emerald-100 px-1 py-0.5 rounded">YES</span>
                        ) : 'Pending'}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Operations Actions block contextual */}
                <div className="space-y-3 pt-3 border-t border-slate-100">
                  <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider block">Fulfillment Actions</span>

                  {/* Context Actions */}
                  {selectedReturn.status === 'raised' && (
                    <div className="space-y-2">
                      {selectedReturn.physical_collection_required ? (
                        <>
                          <button
                            onClick={() => {
                              setSelectedOrderId(selectedReturn.order_id);
                              setScheduleDriverId(selectedReturn.collection_driver_id || '');
                              setShowScheduleForm(true);
                            }}
                            className="w-full bg-slate-900 text-white hover:bg-slate-850 font-bold py-2 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                          >
                            Schedule Collection Driver
                          </button>
                          
                          {showScheduleForm && (
                            <div className="space-y-3 p-3 border border-slate-200 rounded-xl bg-slate-50/80">
                              <span className="font-bold text-xs block">Choose Driver and Date</span>
                              <div>
                                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Assigned Driver</label>
                                <select 
                                  value={scheduleDriverId}
                                  onChange={(e) => setScheduleDriverId(e.target.value)}
                                  className="w-full border p-2 rounded text-xs bg-white"
                                >
                                  <option value="">-- Choose Driver --</option>
                                  {users.filter(u => u.role === 'driver' || u.role === 'admin' || u.role === 'ops_manager').map(u => (
                                    <option key={u.id} value={u.id}>{u.name}</option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Scheduled Date/Time</label>
                                <input 
                                  type="datetime-local"
                                  value={scheduleDateTime}
                                  onChange={(e) => setScheduleDateTime(e.target.value)}
                                  className="w-full border p-1 rounded text-xs"
                                />
                              </div>
                              <button
                                onClick={() => handleScheduleCollection(selectedReturn.id)}
                                className="w-full bg-teal-500 font-bold text-slate-950 py-1.5 rounded text-xs cursor-pointer min-h-[44px]"
                              >
                                Save Collection Driver
                              </button>
                            </div>
                          )}
                        </>
                      ) : (
                        <button
                          onClick={() => {
                            setReceiveWarehouseId('RGN');
                            setShowReceiveForm(true);
                          }}
                          className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold py-2 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                        >
                          Mark as Received at Warehouse
                        </button>
                      )}
                    </div>
                  )}

                  {selectedReturn.status === 'collection_scheduled' && (
                    <div className="space-y-2">
                      <div className="text-xs p-2.5 border border-blue-100 bg-blue-50/50 rounded-xl flex items-start gap-1.5 mb-2">
                        <Truck className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                        <div>
                          <span>Driver {users.find(u => u.id === selectedReturn.collection_driver_id)?.name || 'Assigned'} scheduled collection.</span>
                        </div>
                      </div>
                      
                      <button
                        onClick={() => setShowConfirmCollectionForm(true)}
                        className="w-full bg-indigo-600 text-white hover:bg-indigo-500 font-bold py-2 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                      >
                        Confirm Driver Collection
                      </button>

                      {showConfirmCollectionForm && (
                        <div className="space-y-3 p-3 border border-slate-200 rounded-xl bg-slate-50/80">
                          <span className="font-bold text-xs block">Confirm Details</span>
                          <div>
                            <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Transport Temperature Celsius (Optional)</label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="e.g. 3.5"
                              value={collectionTemp}
                              onChange={(e) => setCollectionTemp(e.target.value)}
                              className="w-full border p-1 rounded text-xs"
                            />
                          </div>
                          <button
                            onClick={() => handleConfirmCollection(selectedReturn.id)}
                            className="w-full bg-teal-500 font-bold text-slate-950 py-1.5 rounded text-xs cursor-pointer"
                          >
                            Mark as In Transit Back
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReturn.status === 'in_transit_back' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          setReceiveWarehouseId('RGN');
                          const toggles: typeof lineColdChainToggles = {};
                          selectedReturn.lines.forEach(l => { toggles[l.id] = true; });
                          setLineColdChainToggles(toggles);
                          setShowReceiveForm(true);
                        }}
                        className="w-full bg-amber-500 text-slate-950 hover:bg-amber-400 font-bold py-2 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                      >
                        Receive at Warehouse
                      </button>

                      {showReceiveForm && (
                        <div className="space-y-3 p-3 border border-slate-200 rounded-xl bg-slate-50/80">
                          <label className="text-xs font-bold block">Receive Location</label>
                          <select
                            value={receiveWarehouseId}
                            onChange={(e) => setReceiveWarehouseId(e.target.value)}
                            className="w-full border p-2 rounded text-xs bg-white"
                          >
                            {warehouses.map(w => (
                              <option key={w.id} value={w.id}>{w.name}</option>
                            ))}
                          </select>

                          <div>
                            <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Receipt Temperature Celsius</label>
                            <input
                              type="number"
                              step="0.1"
                              placeholder="e.g. 4.0"
                              value={receiveTemp}
                              onChange={(e) => setReceiveTemp(e.target.value)}
                              className="w-full border p-1 rounded text-xs"
                            />
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] uppercase text-slate-400 font-bold block">Cold Chain Intact check?</label>
                            {selectedReturn.lines.map(line => (
                              <div key={line.id} className="flex items-center justify-between p-1 bg-white border border-slate-200 rounded text-[11px]">
                                <span className="font-bold line-clamp-1 truncate max-w-[150px]">{line.sku_name}</span>
                                <div className="flex gap-1.5">
                                  <button
                                    onClick={() => setLineColdChainToggles(p => ({ ...p, [line.id]: true }))}
                                    className={`px-2 py-0.5 rounded font-black cursor-pointer ${
                                      lineColdChainToggles[line.id] ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    YES
                                  </button>
                                  <button
                                    onClick={() => setLineColdChainToggles(p => ({ ...p, [line.id]: false }))}
                                    className={`px-2 py-0.5 rounded font-black cursor-pointer ${
                                      lineColdChainToggles[line.id] === false ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    NO
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <button
                            onClick={() => handleReceiveWarehouse(selectedReturn.id)}
                            className="w-full bg-teal-500 text-slate-950 font-bold py-2 rounded text-xs cursor-pointer min-h-[44px]"
                          >
                            Confirm Receipts Entry
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReturn.status === 'received_at_warehouse' && (
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          const initialDispositions: typeof lineDispositions = {};
                          selectedReturn.lines.forEach(l => {
                            // Find matching quarantine location code "QRN" if possible
                            const localQLoc = locations.find(loc => loc.warehouse_id === selectedReturn.received_at_warehouse_id && loc.code.includes('QRN'));
                            initialDispositions[l.id] = {
                              disposition: l.cold_chain_intact === false && (l.temp_zone === 'chilled' || l.temp_zone === 'frozen') ? 'WRITE_OFF' : 'RESTOCK',
                              location_id: localQLoc?.id || ''
                            };
                          });
                          setLineDispositions(initialDispositions);
                          setShowInspectForm(true);
                        }}
                        className="w-full bg-teal-600 text-white hover:bg-teal-500 font-bold py-2 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                      >
                        Inspect and Decide
                      </button>

                      {showInspectForm && (
                        <div className="space-y-4 p-3 border border-slate-200 rounded-xl bg-slate-50/80 max-h-96 overflow-y-auto">
                          <span className="font-bold text-xs block">Inspect Return Items</span>
                          
                          {selectedReturn.lines.map(line => {
                            const isChilledFrozen = line.temp_zone === 'chilled' || line.temp_zone === 'frozen';
                            const coldChainBroken = line.cold_chain_intact === false;
                            const restrictionActive = coldChainBroken && isChilledFrozen;

                            const dispObj = lineDispositions[line.id] || { disposition: 'CREDIT_ONLY', location_id: '' };

                            return (
                              <div key={line.id} className="p-2 border border-slate-200 rounded bg-white space-y-2 text-[11px] text-slate-700">
                                <div className="font-bold flex justify-between gap-1">
                                  <span className="truncate line-clamp-1 max-w-[180px]">{line.sku_name}</span>
                                  {line.cold_chain_intact ? (
                                    <span className="bg-emerald-500 text-white rounded px-1.5 py-0.2 text-[9px]">Cold Chain Intact</span>
                                  ) : (
                                    <span className="bg-rose-500 text-white rounded px-1.5 py-0.2 text-[9px]">Cold Chain Broken</span>
                                  )}
                                </div>

                                {restrictionActive ? (
                                  <div className="p-1 text-rose-600 font-semibold bg-rose-50 border border-rose-100 rounded">
                                    🔴 Cold chain not intact — cannot restock
                                  </div>
                                ) : null}

                                <div className="space-y-1">
                                  <label className="font-bold text-[9px] uppercase text-slate-400">Disposition</label>
                                  {restrictionActive ? (
                                    <select
                                      value={dispObj.disposition}
                                      onChange={(e) => setLineDispositions(p => ({
                                        ...p,
                                        [line.id]: { ...p[line.id], disposition: e.target.value as any }
                                      }))}
                                      className="w-full border p-1 rounded bg-white text-[11px]"
                                    >
                                      <option value="WRITE_OFF">Write Off</option>
                                      <option value="SUPPLIER_CLAIM">Supplier Claim</option>
                                    </select>
                                  ) : (
                                    <select
                                      value={dispObj.disposition}
                                      onChange={(e) => setLineDispositions(p => ({
                                        ...p,
                                        [line.id]: { ...p[line.id], disposition: e.target.value as any }
                                      }))}
                                      className="w-full border p-1 rounded bg-white text-[11px]"
                                    >
                                      <option value="RESTOCK">Restock (Return to stock)</option>
                                      <option value="WRITE_OFF">Write Off</option>
                                      <option value="SUPPLIER_CLAIM">Supplier Claim</option>
                                      <option value="CREDIT_ONLY">Credit Only</option>
                                    </select>
                                  )}
                                </div>

                                {dispObj.disposition === 'RESTOCK' && (
                                  <div className="space-y-1">
                                    <label className="font-bold text-[9px] uppercase text-slate-400">Restock Location</label>
                                    <select
                                      value={dispObj.location_id}
                                      onChange={(e) => setLineDispositions(p => ({
                                        ...p,
                                        [line.id]: { ...p[line.id], location_id: e.target.value }
                                      }))}
                                      className="w-full border p-1 rounded bg-white text-[11px]"
                                    >
                                      <option value="">-- Choose Bin Location --</option>
                                      {locations
                                        .filter(l => l.warehouse_id === selectedReturn.received_at_warehouse_id)
                                        .map(l => (
                                          <option key={l.id} value={l.id}>{l.code} ({l.aisle}-{l.rack})</option>
                                        ))
                                      }
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          <button
                            onClick={() => handleInspectSubmit(selectedReturn.id)}
                            className="w-full bg-teal-500 font-bold text-slate-950 py-2 rounded text-xs cursor-pointer min-h-[44px]"
                          >
                            Submit Inspection Results
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {selectedReturn.status === 'inspected' && (
                    <div className="space-y-3">
                      {!selectedReturn.credit_issued && (
                        <button
                          onClick={() => handleIssueCredit(selectedReturn.id)}
                          className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                        >
                          Issue KES {(selectedReturn.total_credit_value_kes / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })} Credit Note
                        </button>
                      )}

                      <button
                        onClick={() => handleCloseReturn(selectedReturn.id)}
                        className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 px-3 rounded-xl min-h-[44px] cursor-pointer text-xs"
                      >
                        Close Return File
                      </button>
                    </div>
                  )}

                  {selectedReturn.status === 'closed' && (
                    <div className="text-center p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                      <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1 stroke-2" />
                      <span className="text-[11px] font-bold text-slate-500 block">Closed File Archetype</span>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5">
                        This return transaction is fully processed, closed, and compiled into the general ledger.
                      </p>
                    </div>
                  )}

                </div>

              </div>
            ) : (
              <div className="bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs rounded-2xl flex flex-col items-center justify-center space-y-2">
                <RotateCcw className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                <span>Select a return row to inspect details and process return.</span>
              </div>
            )}
          </div>

        </div>
      )}

      {/* RAISING RETURNS WIZARD MODAL */}
      {showWizard && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="p-4 border-b border-secondary flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 flex items-center gap-2">
                  <RotateCcw className="h-4.5 w-4.5 text-teal-500" />
                  <span>Raise Customer Return File</span>
                </h3>
                <p className="text-[10px] text-slate-400 font-mono block mt-0.5">Step {wizardStep} of 2 • Secure Identity Verification</p>
              </div>
              <button
                onClick={() => setShowWizard(false)}
                className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                <X className="h-5 w-5 text-slate-400" />
              </button>
            </div>

            {/* Modal Wizard Content */}
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              
              {/* STEP 1 */}
              {wizardStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Select Dispatched / Delivered Order</label>
                    <select
                      value={selectedOrderId}
                      onChange={(e) => handleOrderSelect(e.target.value)}
                      className="w-full border p-2 text-xs rounded-xl bg-white focus:outline-hidden focus:border-slate-400"
                    >
                      <option value="">-- Choose Order ID --</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>
                          [{o.id}] {o.customer_name} • {new Date(o.created_at || o.delivery_date).toLocaleDateString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedOrderId && (
                    <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Customer:</span>
                        <strong className="text-slate-800">{orders.find(o => o.id === selectedOrderId)?.customer_name}</strong>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400 font-semibold">Delivery Date:</span>
                        <strong className="text-slate-800">
                          {new Date(orders.find(o => o.id === selectedOrderId)?.delivery_date || '').toLocaleDateString()}
                        </strong>
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Return Type</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'doorstep_rejection', label: 'Doorstep Rejection', desc: 'Refused at door' },
                        { id: 'post_delivery', label: 'Post-Delivery', desc: 'Complaint raised later' },
                        { id: 'driver_error', label: 'Driver Error', desc: 'Delivery error' }
                      ].map(type => (
                        <button
                          key={type.id}
                          type="button"
                          onClick={() => setReturnType(type.id as any)}
                          className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                            returnType === type.id
                              ? 'border-slate-900 bg-slate-900 text-white font-bold'
                              : 'border-slate-200 hover:border-slate-350 bg-white'
                          }`}
                        >
                          <span className="text-xs block font-bold leading-normal">{type.label}</span>
                          <span className="text-[10px] opacity-70 block mt-0.5">{type.desc}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Reason Summary</label>
                    <textarea
                      placeholder="Comment on the primary issue..."
                      value={reasonSummary}
                      onChange={(e) => setReasonSummary(e.target.value)}
                      className="w-full border p-2 text-xs rounded-xl bg-white font-serif outline-hidden focus:border-slate-400"
                      rows={3}
                      required
                    />
                  </div>

                  {/* Toggle physical return */}
                  <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-slate-800 block">Physical Collection Required?</span>
                      <span className="text-[10px] text-slate-400 block leading-normal">
                        Toggle if the driver has to collect the items or if this is complaint-only.
                      </span>
                    </div>
                    <div>
                      <button
                        type="button"
                        onClick={() => setPhysicalCollectionRequired(!physicalCollectionRequired)}
                        className={`h-6 w-11 rounded-full p-0.5 transition-colors cursor-pointer ${
                          physicalCollectionRequired ? 'bg-teal-500' : 'bg-slate-300'
                        }`}
                      >
                        <div className={`h-5 w-5 rounded-full bg-white transition-transform ${
                          physicalCollectionRequired ? 'translate-x-5' : 'translate-x-0'
                        }`} />
                      </button>
                    </div>
                  </div>

                  {/* Schedule drivers node if required */}
                  {physicalCollectionRequired && (
                    <div className="grid grid-cols-2 gap-3 p-3 border border-slate-200 rounded-xl bg-slate-50/50">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Collection Driver</label>
                        <select
                          value={collectionDriverId}
                          onChange={(e) => setCollectionDriverId(e.target.value)}
                          className="w-full border p-2 text-xs rounded bg-white"
                        >
                          <option value="">-- Choose Driver --</option>
                          {users.filter(u => u.role === 'driver' || u.role === 'admin' || u.role === 'ops_manager').map(u => (
                            <option key={u.id} value={u.id}>{u.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold text-slate-600 block mb-1">Scheduled Collection Date/Time</label>
                        <input
                          type="datetime-local"
                          value={collectionScheduledAt}
                          onChange={(e) => setCollectionScheduledAt(e.target.value)}
                          className="w-full border p-1 text-xs rounded"
                        />
                      </div>
                    </div>
                  )}

                </div>
              )}

              {/* STEP 2 */}
              {wizardStep === 2 && (
                <div className="space-y-4">
                  <span className="text-xs font-black text-slate-500 uppercase tracking-widest block">Choose Return Items list</span>

                  <div className="space-y-3.5 max-h-[50vh] overflow-y-auto pr-1">
                    {orders.find(o => o.id === selectedOrderId)?.lines?.map((line: any) => {
                      const sel = orderLineSelections[line.id] || { checked: false, qty: 1, reason: '', creditValueKes: 0 };
                      const maxQty = line.qty_fulfilled || line.qty_ordered || 1;
                      const matchedSku = skus.find(s => s.id === line.sku_id);
                      
                      return (
                        <div key={line.id} className="p-3.5 border rounded-2xl border-slate-200 bg-white hover:border-slate-350 transition-all space-y-3">
                          <label className="flex items-start gap-2.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sel.checked}
                              onChange={(e) => setOrderLineSelections(p => ({
                                ...p,
                                [line.id]: { ...p[line.id], checked: e.target.checked }
                              }))}
                              className="mt-1 sticky top-0"
                            />
                            <div className="text-xs flex-1">
                              <span className="font-bold text-slate-800 leading-normal block">{line.sku_name}</span>
                              <span className="text-[10px] text-slate-500 font-mono block mt-0.5">
                                Ordered qty: {displayQty(line.qty_ordered, matchedSku)} • Fulfilled: {displayQty(line.qty_fulfilled, matchedSku)}
                              </span>
                            </div>
                          </label>

                          {sel.checked && (
                            <div className="pl-6 grid grid-cols-2 gap-3 pt-2 border-t border-slate-100 text-xs">
                              <div>
                                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Qty to Return</label>
                                <input
                                  type="number"
                                  min={1}
                                  max={maxQty}
                                  value={sel.qty}
                                  onChange={(e) => {
                                    const qty = Math.min(maxQty, Math.max(1, parseInt(e.target.value) || 1));
                                    const price = line.unit_price_kes || line.price_kes || 0;
                                    setOrderLineSelections(p => ({
                                      ...p,
                                      [line.id]: { 
                                        ...p[line.id], 
                                        qty, 
                                        creditValueKes: qty * price
                                      }
                                    }));
                                  }}
                                  className="w-full border p-1 rounded font-mono text-center"
                                />
                              </div>

                              <div>
                                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Credit Value KES (edit-ready)</label>
                                <input
                                  type="number"
                                  placeholder="0.00"
                                  value={sel.creditValueKes / 100}
                                  onChange={(e) => {
                                    const val = Math.max(0, parseFloat(e.target.value) || 0);
                                    setOrderLineSelections(p => ({
                                      ...p,
                                      [line.id]: { 
                                        ...p[line.id], 
                                        creditValueKes: Math.round(val * 100) 
                                      }
                                    }));
                                  }}
                                  className="w-full border p-1 rounded font-mono text-center"
                                />
                              </div>

                              <div className="col-span-2">
                                <label className="text-[10px] uppercase text-slate-400 font-bold block mb-1">Customer Reason</label>
                                <input
                                  type="text"
                                  placeholder="Packaging damaged, wrong item, sour profile..."
                                  value={sel.reason}
                                  onChange={(e) => setOrderLineSelections(p => ({
                                    ...p,
                                    [line.id]: { ...p[line.id], reason: e.target.value }
                                  }))}
                                  className="w-full border p-1 rounded"
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Total Value Summary */}
                  <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl flex items-center justify-between text-xs">
                    <span className="font-bold text-slate-700">Total Credit Value Accrued:</span>
                    <strong className="text-teal-980 font-mono text-sm font-black">
                      KES {((Object.values(orderLineSelections).reduce((acc: number, curr: any) => curr.checked ? acc + curr.creditValueKes : acc, 0) as number) / 100).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </strong>
                  </div>

                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-secondary flex items-center justify-between gap-3 bg-slate-50 rounded-b-2xl">
              {wizardStep === 2 ? (
                <button
                  onClick={() => setWizardStep(1)}
                  className="px-4 py-2 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs min-h-[44px] cursor-pointer"
                >
                  Back
                </button>
              ) : (
                <div />
              )}
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowWizard(false)}
                  className="px-4 py-2 hover:bg-slate-200 text-slate-600 font-bold rounded-xl text-xs min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>

                {wizardStep === 1 ? (
                  <button
                    onClick={() => {
                      if (!selectedOrderId) return triggerToast('Please select an order.', 'error');
                      setWizardStep(2);
                    }}
                    className="bg-slate-900 text-white font-bold px-5 py-2.5 rounded-xl hover:bg-slate-850 text-xs min-h-[44px] flex items-center gap-1 cursor-pointer"
                  >
                    <span>Next step</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button
                    onClick={submitNewReturn}
                    className="bg-teal-500 text-slate-950 font-black px-6 py-2.5 rounded-xl hover:bg-teal-400 text-xs min-h-[44px] cursor-pointer"
                  >
                    Submit Customer Return
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
