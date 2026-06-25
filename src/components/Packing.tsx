import React, { useState, useEffect } from 'react';
import { 
  PackageCheck, CheckCircle2, ThermometerSnowflake, Loader2, 
  Building, User, Plus, Minus, AlertCircle, Calendar, ChevronDown, ChevronUp, 
  Check, Square, CheckSquare, X, RefreshCw, AlertTriangle, TrendingUp, Sparkles
} from 'lucide-react';
import { User as UserType, Warehouse } from '../types';

interface PackingProps {
  currentUser: UserType | null;
  triggerRefresh: () => void;
  refreshFlag: number;
  triggerToast?: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export default function Packing({ currentUser, triggerRefresh, refreshFlag, triggerToast }: PackingProps) {
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [packedTodayCount, setPackedTodayCount] = useState<number>(0);

  // Sorting and Filtering states for transit risk mitigation
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'cold' | 'scheduled' | 'urgent'>('all');
  const [sortBy, setSortBy] = useState<'sequence' | 'date_asc' | 'date_desc' | 'zone'>('sequence');
  
  // Selection state for Bulk Packing
  const [selectedOrderIds, setSelectedOrderIds] = useState<string[]>([]);
  const [isBulkPackingMode, setIsBulkPackingMode] = useState<boolean>(false);
  const [bulkColdChainConfirmed, setBulkColdChainConfirmed] = useState<boolean>(false);
  const [bulkToteCounts, setBulkToteCounts] = useState<Record<string, number>>({});
  
  // State for optional itemized bulk assets per order: order_id -> asset_counts
  const [bulkAssets, setBulkAssets] = useState<Record<string, { cooler_box: number; insulated_tote: number; crate: number; gel_pack: number }>>({});
  const [bulkAssetToggle, setBulkAssetToggle] = useState<Record<string, boolean>>({});
  
  // Bulk submission progress and feedback states
  const [bulkSubmitting, setBulkSubmitting] = useState<boolean>(false);
  const [bulkStatuses, setBulkStatuses] = useState<Record<string, { status: 'pending' | 'success' | 'error'; message?: string }>>({});

  // Single card expansion state (disabled when in bulk pack view)
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Form states for the single expanded order card
  const [coldChainConfirmed, setColdChainConfirmed] = useState<boolean>(false);
  const [toteCount, setToteCount] = useState<number>(1);
  const [coolerBoxCount, setCoolerBoxCount] = useState<number>(0);
  const [insulatedToteCount, setInsulatedToteCount] = useState<number>(0);
  const [crateCount, setCrateCount] = useState<number>(0);
  const [gelPackCount, setGelPackCount] = useState<number>(0);
  const [showAssetBreakdown, setShowAssetBreakdown] = useState<boolean>(false);
  
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    if (triggerToast) {
      triggerToast(msg, type);
    } else {
      console.log(`[Toast ${type}]: ${msg}`);
    }
  };

  // Fetch queue and users database
  const loadQueue = async () => {
    setLoading(true);
    try {
      const whParam = currentUser?.primary_warehouse_id 
        ? `?warehouse_id=${encodeURIComponent(currentUser.primary_warehouse_id)}`
        : '';
        
      const [queueRes, allOrdersRes, usersRes, whRes] = await Promise.all([
        fetch(`/api/v1/orders/packing-queue${whParam}`),
        fetch('/api/v1/orders'),
        fetch('/api/v1/users'),
        fetch('/api/v1/warehouses')
      ]);

      if (!queueRes.ok || !allOrdersRes.ok || !usersRes.ok || !whRes.ok) {
        throw new Error('Failed to retrieve queue records from server');
      }

      const queueData = await queueRes.json();
      const allOrdersData = await allOrdersRes.json();
      const usersData = await usersRes.json();
      const whData = await whRes.json();

      let items = queueData.data || [];
      // Client-side safety filter by primary warehouse if configured
      if (currentUser?.primary_warehouse_id) {
        items = items.filter((o: any) => o.fulfilment_warehouse_id === currentUser.primary_warehouse_id);
      }

      setOrders(items);
      if (usersData.data) setUsers(usersData.data);
      if (whData.data) setWarehouses(whData.data);

      // Calculate packed today count matching the primary warehouse filters
      const allOrders = allOrdersData.data || [];
      const today = new Date();
      const packedTodayList = allOrders.filter((o: any) => {
        if (o.status !== 'packed' || !o.packed_at) return false;
        
        // Filter by primary warehouse if configured
        if (currentUser?.primary_warehouse_id && o.fulfilment_warehouse_id !== currentUser.primary_warehouse_id) {
          return false;
        }

        const packedDate = new Date(o.packed_at);
        return (
          packedDate.getFullYear() === today.getFullYear() &&
          packedDate.getMonth() === today.getMonth() &&
          packedDate.getDate() === today.getDate()
        );
      });
      setPackedTodayCount(packedTodayList.length);
    } catch (err: any) {
      showToast(err.message || 'Error occurred while loading packing queue', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, [refreshFlag, currentUser?.primary_warehouse_id]);

  // Determine current active warehouse focus of the selected orders block
  const firstSelectedOrder = orders.find(o => selectedOrderIds.includes(o.id));
  const selectedWarehouseId = firstSelectedOrder ? firstSelectedOrder.fulfilment_warehouse_id : null;

  // Dynamic Priority determination for visual alerts and smart filtering
  const getOrderPriority = React.useCallback((order: any) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const isOverdueOrToday = order.delivery_date && order.delivery_date.slice(0, 10) <= todayStr;
    const requiresColdChain = order.requires_cold_chain || order.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen');
    const isScheduled = order.dispatch_sequence !== null && order.dispatch_sequence !== undefined;

    if (isOverdueOrToday && requiresColdChain) {
      return { level: 'Critical', label: 'Critical Cold Chain', color: 'bg-red-50 border-red-200 text-red-700 font-extrabold', icon: '🔥' };
    }
    if (isOverdueOrToday) {
      return { level: 'Urgent', label: 'Urgent (Due Today)', color: 'bg-orange-50 border-orange-200 text-orange-700 font-bold', icon: '⏰' };
    }
    if (requiresColdChain) {
      return { level: 'High', label: 'High Care (Cold Chain)', color: 'bg-amber-50 border-amber-200 text-amber-700 font-bold', icon: '❄️' };
    }
    if (isScheduled) {
      return { level: 'Medium', label: `Scheduled (Seq #${order.dispatch_sequence})`, color: 'bg-blue-50 border-blue-200 text-blue-700 font-semibold', icon: '📦' };
    }
    return { level: 'Normal', label: 'Normal Priority', color: 'bg-slate-50 border-slate-200 text-slate-600 font-medium', icon: '🟢' };
  }, []);

  // Filter and sort the packing queue based on active terminal criteria
  const filteredAndSortedOrders = React.useMemo(() => {
    let result = [...orders];

    // Priority filter rules
    if (priorityFilter === 'high') {
      result = result.filter(o => {
        const p = getOrderPriority(o);
        return p.level === 'Critical' || p.level === 'Urgent' || p.level === 'High';
      });
    } else if (priorityFilter === 'cold') {
      result = result.filter(o => o.requires_cold_chain || o.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen'));
    } else if (priorityFilter === 'scheduled') {
      result = result.filter(o => o.dispatch_sequence !== null && o.dispatch_sequence !== undefined);
    } else if (priorityFilter === 'urgent') {
      const todayStr = new Date().toISOString().slice(0, 10);
      result = result.filter(o => o.delivery_date && o.delivery_date.slice(0, 10) <= todayStr);
    }

    // Sort order mapping
    if (sortBy === 'date_asc') {
      result.sort((a, b) => new Date(a.created_at || a.delivery_date).getTime() - new Date(b.created_at || b.delivery_date).getTime());
    } else if (sortBy === 'date_desc') {
      result.sort((a, b) => new Date(b.created_at || b.delivery_date).getTime() - new Date(a.created_at || a.delivery_date).getTime());
    } else if (sortBy === 'zone') {
      result.sort((a, b) => (a.delivery_zone || '').localeCompare(b.delivery_zone || ''));
    } else if (sortBy === 'sequence') {
      result.sort((a, b) => {
        const seqA = a.dispatch_sequence ?? 999999;
        const seqB = b.dispatch_sequence ?? 999999;
        return seqA - seqB;
      });
    }

    return result;
  }, [orders, priorityFilter, sortBy, getOrderPriority]);

  // Single card helper
  const handleToggleExpand = (orderId: string) => {
    if (isBulkPackingMode) {
      showToast('Exit Bulk Packing view to pack orders individually', 'info');
      return;
    }
    if (expandedOrderId === orderId) {
      setExpandedOrderId(null);
    } else {
      const order = orders.find(o => o.id === orderId);
      setExpandedOrderId(orderId);
      // Reset form controls
      setColdChainConfirmed(false);
      setToteCount(1);
      setCoolerBoxCount(0);
      setInsulatedToteCount(0);
      setCrateCount(0);
      setGelPackCount(0);
      setShowAssetBreakdown(false);
    }
  };

  // User list resolver
  const getPickerName = (pickerId: string | null) => {
    if (!pickerId) return 'N/A';
    const found = users.find(u => u.id === pickerId);
    return found ? found.name : pickerId;
  };

  const getWarehouseName = (whId: string) => {
    const wh = warehouses.find(w => w.id === whId);
    return wh ? wh.name : whId;
  };

  // Selection Checkbox managers
  const handleToggleSelectOrder = (order: any) => {
    const isChecked = selectedOrderIds.includes(order.id);
    if (isChecked) {
      setSelectedOrderIds(prev => prev.filter(id => id !== order.id));
    } else {
      // Validate warehouse compatibility
      if (selectedWarehouseId && order.fulfilment_warehouse_id !== selectedWarehouseId) {
        showToast(`Cannot select order. Warehouse must match selected group: ${selectedWarehouseId}`, 'error');
        return;
      }
      setSelectedOrderIds(prev => [...prev, order.id]);
      
      // Initialize default values for this order in bulk states
      if (!bulkToteCounts[order.id]) {
        setBulkToteCounts(prev => ({ ...prev, [order.id]: 1 }));
      }
      if (!bulkAssets[order.id]) {
        setBulkAssets(prev => ({ 
          ...prev, 
          [order.id]: { cooler_box: 0, insulated_tote: 0, crate: 0, gel_pack: 0 } 
        }));
      }
    }
  };

  const handleSelectAllMatching = () => {
    if (!selectedWarehouseId) return;
    const matchIds = orders
      .filter(o => o.fulfilment_warehouse_id === selectedWarehouseId)
      .map(o => o.id);
    setSelectedOrderIds(matchIds);
    
    // Initialize default states for all selected orders
    const newTotes = { ...bulkToteCounts };
    const newAssets = { ...bulkAssets };
    matchIds.forEach(id => {
      if (!newTotes[id]) newTotes[id] = 1;
      if (!newAssets[id]) newAssets[id] = { cooler_box: 0, insulated_tote: 0, crate: 0, gel_pack: 0 };
    });
    setBulkToteCounts(newTotes);
    setBulkAssets(newAssets);
    showToast(`Checked all matching orders in ${selectedWarehouseId}`, 'info');
  };

  const handleDeselectAll = () => {
    setSelectedOrderIds([]);
    setIsBulkPackingMode(false);
    setBulkStatuses({});
  };

  // Single submission handler
  const handleConfirmPacking = async (order: any) => {
    const requiresColdChain = order.requires_cold_chain || order.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen');
    
    if (requiresColdChain && !coldChainConfirmed) {
      showToast('Please confirm cold-chain integrity before completing', 'error');
      return;
    }

    if (toteCount <= 0) {
      showToast('Please enter at least 1 tote or cooler box', 'error');
      return;
    }

    setSubmittingId(order.id);

    try {
      const assetList = [
        { asset_type: 'cooler_box', count: coolerBoxCount },
        { asset_type: 'insulated_tote', count: insulatedToteCount },
        { asset_type: 'crate', count: crateCount },
        { asset_type: 'gel_pack', count: gelPackCount }
      ].filter(a => a.count > 0);

      const response = await fetch(`/api/v1/orders/${order.id}/complete-packing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cold_chain_confirmed: coldChainConfirmed,
          tote_count: toteCount,
          assets: assetList
        })
      });

      const responseData = await response.json();

      if (response.ok) {
        showToast(`Order ${order.id} packed and ready for dispatch.`, 'success');
        setOrders(prev => prev.filter(o => o.id !== order.id));
        setExpandedOrderId(null);
        triggerRefresh();
      } else {
        const errorDetail = responseData.error || {};
        if (errorDetail.code === 'PACKER_MUST_DIFFER_FROM_PICKER') {
          showToast('You picked this order — a different team member needs to pack it.', 'error');
        } else {
          showToast(errorDetail.message || 'Unable to confirm packing status on order', 'error');
        }
      }
    } catch (err) {
      showToast('Network timeout or request error', 'error');
    } finally {
      setSubmittingId(null);
    }
  };

  // Bulk submission handler (runs HTTP POST packing confirmations sequentially/parallelly)
  const handleConfirmBulkPacking = async () => {
    const selectedOrders = orders.filter(o => selectedOrderIds.includes(o.id));
    
    // Check if any selected order requires cold chain
    const anyRequiresColdChain = selectedOrders.some(o => 
      o.requires_cold_chain || o.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen')
    );
    if (anyRequiresColdChain && !bulkColdChainConfirmed) {
      showToast('Please confirm cold-chain integrity for all selected orders.', 'error');
      return;
    }

    // Verify all selected tote counts are (> 0)
    const anyInvalidCount = selectedOrders.some(o => {
      const qty = bulkToteCounts[o.id] ?? 1;
      return qty <= 0;
    });
    if (anyInvalidCount) {
      showToast('All orders being bulk packed require at least 1 tote.', 'error');
      return;
    }

    setBulkSubmitting(true);
    
    // Initialize state mapping so progress is visible
    const statuses: Record<string, { status: 'pending' | 'success' | 'error'; message?: string }> = {};
    selectedOrders.forEach(o => {
      statuses[o.id] = { status: 'pending' };
    });
    setBulkStatuses({ ...statuses });

    let successes = 0;
    let failures = 0;

    // Loop and submit orders sequentially to prevent concurrent db lockups
    for (const order of selectedOrders) {
      const currentOrderTotes = bulkToteCounts[order.id] ?? 1;
      const currentAssetsObj = bulkAssets[order.id] || { cooler_box: 0, insulated_tote: 0, crate: 0, gel_pack: 0 };
      
      const assetList = [
        { asset_type: 'cooler_box', count: currentAssetsObj.cooler_box },
        { asset_type: 'insulated_tote', count: currentAssetsObj.insulated_tote },
        { asset_type: 'crate', count: currentAssetsObj.crate },
        { asset_type: 'gel_pack', count: currentAssetsObj.gel_pack }
      ].filter(a => a.count > 0);

      try {
        const response = await fetch(`/api/v1/orders/${order.id}/complete-packing`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cold_chain_confirmed: bulkColdChainConfirmed,
            tote_count: currentOrderTotes,
            assets: assetList
          })
        });

        const responseData = await response.json();

        if (response.ok) {
          statuses[order.id] = { status: 'success' };
          successes++;
        } else {
          const errorDetail = responseData.error || {};
          let msg = errorDetail.message || 'Server returned negative status';
          if (errorDetail.code === 'PACKER_MUST_DIFFER_FROM_PICKER') {
            msg = 'You picked this order — other team member must pack it.';
          }
          statuses[order.id] = { status: 'error', message: msg };
          failures++;
        }
      } catch (err) {
        statuses[order.id] = { status: 'error', message: 'Connection timeout or parsing failure' };
        failures++;
      }
      
      // Live UI update as we compute each step
      setBulkStatuses({ ...statuses });
    }

    setBulkSubmitting(false);

    // Apply outcomes update
    if (successes > 0) {
      showToast(`Bulk packed ${successes} order(s) successfully.`, 'success');
      const successfulIds = Object.keys(statuses).filter(id => statuses[id].status === 'success');
      // Prune successfully finished orders from UI cache
      setOrders(prev => prev.filter(o => !successfulIds.includes(o.id)));
      setSelectedOrderIds(prev => prev.filter(id => !successfulIds.includes(id)));
      triggerRefresh();
    }

    if (failures > 0) {
      showToast(`${failures} order(s) failed bulk-packing validations (see panel notes).`, 'error');
    } else {
      // Clear panel mode on comprehensive success
      setIsBulkPackingMode(false);
      setSelectedOrderIds([]);
    }
  };

  // Helper calculation to verify if any selected order requires cold chain
  const selectedOrdersList = orders.filter(o => selectedOrderIds.includes(o.id));
  const bulkRequiresColdChain = selectedOrdersList.some(o => 
    o.requires_cold_chain || o.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen')
  );

  return (
    <div className="space-y-6">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <PackageCheck className="h-6 w-6 text-teal-400" />
            <h2 className="text-xl font-bold tracking-tight">Packing Queue</h2>
          </div>
          <p className="text-slate-400 text-xs mt-1 leading-normal">
            Orders ready to be packed for dispatch. Secure cold chain, stage counts, and route assets.
          </p>
        </div>
        
        {currentUser?.primary_warehouse_id && (
          <div className="bg-slate-800/80 border border-slate-700 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 self-start sm:self-center">
            <Building className="h-3.5 w-3.5 text-slate-400" />
            <span>Warehouse: <span className="text-teal-400">{getWarehouseName(currentUser.primary_warehouse_id)}</span></span>
          </div>
        )}
      </div>

      {/* Visual Progress Summary Dashboard */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row items-stretch gap-6 animate-fadeIn">
        {/* Left Stats Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 flex-[1.4] divide-y sm:divide-y-0 sm:divide-x divide-slate-100">
          
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 shrink-0">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-450 block">Packed Today</span>
              <span className="text-2xl font-black text-slate-900 leading-none mt-1 block">{packedTodayCount}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:pl-6">
            <div className="h-12 w-12 bg-amber-50 rounded-xl flex items-center justify-center text-amber-600 border border-amber-100 shrink-0">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-455 block">Remaining to Pack</span>
              <span className="text-2xl font-black text-slate-900 leading-none mt-1 block">{orders.length}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 pt-4 sm:pt-0 sm:pl-6">
            <div className="h-12 w-12 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600 border border-teal-100 shrink-0">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-455 block">Total Capacity</span>
              <span className="text-2xl font-black text-slate-900 leading-none mt-1 block">{packedTodayCount + orders.length}</span>
            </div>
          </div>

        </div>

        {/* Right Animated Progress Bar Section */}
        <div className="flex-1 flex flex-col justify-center gap-2.5 pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-100 md:pl-6">
          <div className="flex items-center justify-between text-xs text-slate-500 font-bold">
            <span className="text-slate-450 uppercase text-[9px] font-black tracking-widest block">Floor Throughput Daily Goal</span>
            <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded-md font-black text-xs">
              {packedTodayCount + orders.length > 0 
                ? Math.round((packedTodayCount / (packedTodayCount + orders.length)) * 100) 
                : 100}%
            </span>
          </div>

          {/* Progress Bar Container */}
          <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden p-[1px] relative">
            <div 
              style={{ 
                width: `${packedTodayCount + orders.length > 0 
                  ? (packedTodayCount / (packedTodayCount + orders.length)) * 100 
                  : 100}%` 
              }}
              className="bg-gradient-to-r from-teal-500 to-emerald-400 h-full rounded-full transition-all duration-1000 ease-out shadow-inner"
            />
          </div>
          
          <div className="text-[10.5px] text-slate-400 font-semibold leading-normal flex items-center gap-1">
            {orders.length === 0 ? (
              <span className="text-emerald-600 font-extrabold flex items-center gap-1 animate-pulse">
                <Sparkles className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                <span>Floor cleared! Every order packed and processed. Awesome run!</span>
              </span>
            ) : (
              <span>Processed <strong className="text-slate-700">{packedTodayCount}</strong> of <strong className="text-slate-700">{packedTodayCount + orders.length}</strong> operational targets for this terminal.</span>
            )}
          </div>
        </div>
      </div>

      {/* Floating Checkpoint Selector Banner (Stops layout movement when checking boxes) */}
      {selectedOrderIds.length > 0 && (
        <div className="bg-teal-50 border border-teal-250 p-4 rounded-2xl flex flex-col sm:flex-row shadow-3xs items-center justify-between gap-4 animate-fadeIn">
          <div className="flex items-center gap-2.5">
            <CheckSquare className="h-5 w-5 text-teal-600 shrink-0" />
            <div className="text-sm">
              <span className="font-extrabold text-slate-900">{selectedOrderIds.length}</span> orders selected for warehouse{' '}
              <span className="bg-teal-100 text-teal-800 px-2 py-0.5 font-bold rounded-md font-mono text-xs">
                {selectedWarehouseId}
              </span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto justify-end">
            <button
              onClick={handleDeselectAll}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition min-h-[36px] cursor-pointer"
            >
              Deselect All
            </button>
            
            {orders.some(o => o.fulfilment_warehouse_id === selectedWarehouseId && !selectedOrderIds.includes(o.id)) && (
              <button
                onClick={handleSelectAllMatching}
                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-teal-700 bg-teal-100 hover:bg-teal-150 transition min-h-[36px] cursor-pointer"
              >
                Select All ({selectedWarehouseId})
              </button>
            )}

            {!isBulkPackingMode ? (
              <button
                onClick={() => {
                  setExpandedOrderId(null);
                  setIsBulkPackingMode(true);
                  setBulkStatuses({});
                }}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition hover:bg-slate-800 flex items-center gap-1.5 shadow-2xs min-h-[40px] cursor-pointer"
              >
                <PackageCheck className="h-4 w-4 text-teal-400" />
                <span>Bulk Pack ({selectedOrderIds.length})</span>
              </button>
            ) : (
              <button
                onClick={() => setIsBulkPackingMode(false)}
                className="px-4 py-2 bg-white text-slate-800 border border-slate-350 rounded-xl text-xs font-bold transition hover:bg-slate-50 flex items-center gap-1.5 shadow-2xs min-h-[40px] cursor-pointer"
              >
                <X className="h-4 w-4 text-slate-500" />
                <span>Collapse Console</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Bulk packing console panel */}
      {isBulkPackingMode && selectedOrderIds.length > 0 && (
        <div className="bg-gradient-to-tr from-slate-50 to-white rounded-2xl border-2 border-teal-500 p-4 sm:p-6 space-y-6 shadow-md max-w-3xl mx-auto animate-slideDown">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2">
              <PackageCheck className="h-5.5 w-5.5 text-teal-500" />
              <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                Bulk Packing Console
              </h3>
            </div>
            <button
              onClick={() => setIsBulkPackingMode(false)}
              className="text-slate-400 hover:text-slate-700 transition p-1 rounded-full hover:bg-slate-200"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="text-xs text-slate-500 leading-normal bg-white p-3.5 rounded-xl border border-slate-200 shadow-3xs">
            Confirming <strong className="text-slate-800">{selectedOrderIds.length}</strong> orders together. Each order will receive independent packing ledgers. Any picker overlap errors will fail safely, letting the rest succeed.
          </div>

          {/* Bulk Cold Chain Checkbox */}
          {bulkRequiresColdChain && (
            <label className="flex items-start gap-3 bg-amber-50 border border-amber-200 p-4 rounded-xl cursor-pointer select-none active:bg-amber-100/30 transition">
              <input
                type="checkbox"
                checked={bulkColdChainConfirmed}
                onChange={(e) => setBulkColdChainConfirmed(e.target.checked)}
                className="h-5.5 w-5.5 rounded border-amber-400 accent-amber-600 cursor-pointer mt-0.5 shrink-0"
              />
              <div className="space-y-0.5">
                <span className="text-xs font-bold text-amber-900 leading-tight block">Secure Bulk Cold Integrity</span>
                <span className="text-[10px] text-amber-700 leading-normal block">
                  I verify chilled or frozen items for all selected cold-chain orders are properly packaged in cooler boxes with chilling packs before packing completion.
                </span>
              </div>
            </label>
          )}

          {/* Inline breakdown checklist list */}
          <div className="space-y-3">
            <span className="text-[10px] font-black text-slate-450 uppercase tracking-widest block">Selected Packing Ledger Entries</span>
            
            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {selectedOrdersList.map((order) => {
                const itemStatus = bulkStatuses[order.id];
                const orderTotes = bulkToteCounts[order.id] ?? 1;
                const orderAssetsObj = bulkAssets[order.id] || { cooler_box: 0, insulated_tote: 0, crate: 0, gel_pack: 0 };
                const showAssetBreakdownRow = bulkAssetToggle[order.id] || false;
                const requiresColdChain = order.requires_cold_chain || order.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen');

                return (
                  <div 
                    key={order.id} 
                    className={`p-3.5 rounded-xl border bg-white transition space-y-3.5 ${
                      itemStatus?.status === 'success' ? 'border-emerald-250 bg-emerald-50/20' :
                      itemStatus?.status === 'error' ? 'border-rose-250 bg-rose-50/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-black text-slate-800">{order.id}</span>
                          <span className="text-[10px] text-slate-400 font-medium font-mono">({order.customer_name})</span>
                          {requiresColdChain && (
                            <ThermometerSnowflake className="h-3 w-3 text-amber-600 shrink-0" title="Requires Chilled Care" />
                          )}
                        </div>
                        <span className="text-[10px] text-slate-450 block font-semibold">
                          {order.line_count || order.lines?.length || 0} line items | Picked by: {getPickerName(order.picked_by)}
                        </span>
                      </div>

                      {/* Operation Status Badging */}
                      {itemStatus ? (
                        <div className="self-start sm:self-center">
                          {itemStatus.status === 'pending' && (
                            <span className="inline-flex items-center gap-1.5 text-slate-600 text-xs font-semibold">
                              <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-500" />
                              <span>Packing...</span>
                            </span>
                          )}
                          {itemStatus.status === 'success' && (
                            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-100 py-1 px-2.5 rounded-md text-[10px] font-extrabold uppercase">
                              <Check className="h-3 w-3" />
                              <span>Packed OK</span>
                            </span>
                          )}
                          {itemStatus.status === 'error' && (
                            <span className="inline-flex items-center gap-1 text-rose-700 bg-rose-100 py-1 px-2 text-[10px] font-extrabold uppercase" title={itemStatus.message}>
                              <AlertTriangle className="h-3.5 w-3.5" />
                              <span>Blocked</span>
                            </span>
                          )}
                        </div>
                      ) : (
                        /* Stepper control for Tote count of this order when not loading */
                        <div className="flex items-center gap-2 self-start sm:self-center">
                          <span className="text-[10px] font-bold text-slate-500">Totes:</span>
                          <div className="flex items-center border border-slate-250 rounded-lg overflow-hidden h-[34px] bg-slate-50">
                            <button
                              type="button"
                              onClick={() => {
                                setBulkToteCounts(prev => ({
                                  ...prev,
                                  [order.id]: Math.max(1, (prev[order.id] ?? 1) - 1)
                                }));
                              }}
                              className="w-8 hover:bg-slate-100 flex items-center justify-center border-r border-slate-200 h-full active:bg-slate-150 cursor-pointer"
                            >
                              <Minus className="h-3 w-3 text-slate-600" />
                            </button>
                            <span className="w-8 text-center text-xs font-extrabold text-slate-900 bg-white leading-normal">
                              {orderTotes}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setBulkToteCounts(prev => ({
                                  ...prev,
                                  [order.id]: (prev[order.id] ?? 1) + 1
                                }));
                              }}
                              className="w-8 hover:bg-slate-100 flex items-center justify-center border-l border-slate-200 h-full active:bg-slate-150 cursor-pointer"
                            >
                              <Plus className="h-3 w-3 text-slate-600" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Show dynamic row failure code message detail if any */}
                    {itemStatus?.status === 'error' && itemStatus.message && (
                      <div className="text-[10.5px] text-rose-700 bg-rose-50 p-2 rounded-lg border border-rose-150 leading-relaxed font-bold flex items-start gap-1">
                        <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-rose-500" />
                        <span>{itemStatus.message}</span>
                      </div>
                    )}

                    {/* Toggle optional Asset Itemization link for this order row */}
                    {!itemStatus && (
                      <div className="space-y-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBulkAssetToggle(prev => ({ ...prev, [order.id]: !prev[order.id] }));
                          }}
                          className="text-[10px] font-semibold text-slate-500 hover:text-slate-800 inline-flex items-center gap-0.5 cursor-pointer"
                        >
                          {showAssetBreakdownRow ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          <span>{showAssetBreakdownRow ? 'Hide equipment asset lists' : 'Itemize equipment assets'}</span>
                        </button>

                        {showAssetBreakdownRow && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 bg-slate-50/60 p-2.5 rounded-lg border border-slate-200">
                            
                            {/* Cooler Box */}
                            <div className="flex flex-col gap-1 items-center justify-center bg-white p-1.5 rounded-md border border-slate-150">
                              <span className="text-[9px] font-bold text-slate-700">Cooler Box</span>
                              <div className="flex items-center border border-slate-200 rounded overflow-hidden h-[26px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, cooler_box: Math.max(0, orderAssetsObj.cooler_box - 1) }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-150 h-full"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-[10px] font-bold text-slate-900">{orderAssetsObj.cooler_box}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, cooler_box: orderAssetsObj.cooler_box + 1 }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-150 h-full"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Insulated Tote */}
                            <div className="flex flex-col gap-1 items-center justify-center bg-white p-1.5 rounded-md border border-slate-150">
                              <span className="text-[9px] font-bold text-slate-700">Insulated Tote</span>
                              <div className="flex items-center border border-slate-200 rounded overflow-hidden h-[26px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, insulated_tote: Math.max(0, orderAssetsObj.insulated_tote - 1) }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-150 h-full"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-[10px] font-bold text-slate-900">{orderAssetsObj.insulated_tote}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, insulated_tote: orderAssetsObj.insulated_tote + 1 }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-150 h-full"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Plastic Crate */}
                            <div className="flex flex-col gap-1 items-center justify-center bg-white p-1.5 rounded-md border border-slate-150">
                              <span className="text-[9px] font-bold text-slate-700">Plastic Crate</span>
                              <div className="flex items-center border border-slate-200 rounded overflow-hidden h-[26px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, crate: Math.max(0, orderAssetsObj.crate - 1) }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-150 h-full"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-[10px] font-bold text-slate-900">{orderAssetsObj.crate}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, crate: orderAssetsObj.crate + 1 }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-150 h-full"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                            {/* Gel Packs */}
                            <div className="flex flex-col gap-1 items-center justify-center bg-white p-1.5 rounded-md border border-slate-150">
                              <span className="text-[9px] font-bold text-slate-700">Gel Packs</span>
                              <div className="flex items-center border border-slate-200 rounded overflow-hidden h-[26px]">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, gel_pack: Math.max(0, orderAssetsObj.gel_pack - 1) }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-150 h-full"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-[10px] font-bold text-slate-900">{orderAssetsObj.gel_pack}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setBulkAssets(p => ({
                                      ...p,
                                      [order.id]: { ...orderAssetsObj, gel_pack: orderAssetsObj.gel_pack + 1 }
                                    }));
                                  }}
                                  className="w-6 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-150 h-full"
                                >
                                  +
                                </button>
                              </div>
                            </div>

                          </div>
                        )}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          </div>

          {/* Core action button row */}
          <div className="pt-2">
            <button
              onClick={handleConfirmBulkPacking}
              disabled={bulkSubmitting || (bulkRequiresColdChain && !bulkColdChainConfirmed)}
              className={`w-full py-4 rounded-xl font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 min-h-[56px] ${
                bulkSubmitting || (bulkRequiresColdChain && !bulkColdChainConfirmed)
                  ? 'bg-slate-200 text-slate-450 border border-slate-350 cursor-not-allowed'
                  : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
              }`}
            >
              {bulkSubmitting ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin cursor-not-allowed" />
                  <span>Processing Bulk Packing Queues...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 shrink-0" />
                  <span>Confirm and Bulk Pack {selectedOrderIds.length} Orders</span>
                </>
              )}
            </button>
            
            {bulkRequiresColdChain && !bulkColdChainConfirmed && (
              <p className="text-center text-[11px] text-amber-700 font-bold mt-2 animate-fadeIn flex items-center justify-center gap-1 bg-amber-50 rounded-lg p-2 border border-amber-200">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>Bulk cold-chain confirmation checkbox above is required first.</span>
              </p>
            )}
          </div>

        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-450 flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
          <span className="text-xs font-semibold">Pulling operational packing queues...</span>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center max-w-xl mx-auto space-y-4">
          <div className="h-14 w-14 bg-emerald-50 rounded-full flex items-center justify-center mx-auto text-emerald-500 border border-emerald-100">
            <CheckCircle2 className="h-7 w-7" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-850">Packing Completed</h3>
            <p className="text-slate-500 text-xs mt-1.5 leading-relaxed">
              No orders waiting to be packed right now. Check back when picker teams finalize their fulfillment runs.
            </p>
          </div>
          <button 
            onClick={loadQueue}
            className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold transition hover:bg-slate-800 min-h-[44px] cursor-pointer"
          >
            Check Again
          </button>
        </div>
      ) : (
        <div className="space-y-4 max-w-3xl mx-auto">
          {/* Priority filter and Sorting Control Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Queue Filter</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setPriorityFilter('all')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    priorityFilter === 'all'
                      ? 'bg-slate-900 border-slate-900 text-white shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🟢 All
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('high')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    priorityFilter === 'high'
                      ? 'bg-amber-600 border-amber-600 text-white shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  🔥 High Care
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('cold')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    priorityFilter === 'cold'
                      ? 'bg-blue-600 border-blue-600 text-white shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ❄️ Cold Chain
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('urgent')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    priorityFilter === 'urgent'
                      ? 'bg-orange-600 border-orange-600 text-white shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  ⏰ Due Today
                </button>
                <button
                  type="button"
                  onClick={() => setPriorityFilter('scheduled')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                    priorityFilter === 'scheduled'
                      ? 'bg-teal-600 border-teal-600 text-white shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  📦 Scheduled
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5 min-w-[220px]">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 block">Sort Sequence</span>
              <select
                value={sortBy}
                onChange={(e: any) => setSortBy(e.target.value)}
                className="w-full rounded-xl border border-slate-250 bg-white px-3 py-2 text-xs font-extrabold text-slate-700 shadow-3xs outline-hidden focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all cursor-pointer"
              >
                <option value="sequence">Dispatch Sequence (Transit Window)</option>
                <option value="date_asc">Order Date (Oldest First)</option>
                <option value="date_desc">Order Date (Newest First)</option>
                <option value="zone">Delivery Zone Name (A-Z)</option>
              </select>
            </div>
          </div>

          {filteredAndSortedOrders.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center space-y-4 shadow-3xs">
              <AlertCircle className="h-8 w-8 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-850">No matching orders found</h4>
                <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                  No tickets align with the selected active priorities. Readjust filters or search parameters to process orders.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setPriorityFilter('all');
                  setSortBy('sequence');
                }}
                className="px-4 py-2 bg-white text-slate-800 border border-slate-250 rounded-xl text-xs font-bold transition hover:bg-slate-50 shadow-3xs cursor-pointer"
              >
                Reset Queue View
              </button>
            </div>
          ) : (
            /* Regular packing cards list */
            <div className="grid grid-cols-1 gap-4">
              {filteredAndSortedOrders.map((order) => {
                const isSelected = selectedOrderIds.includes(order.id);
                const isExpanded = expandedOrderId === order.id;
                const isSubmitting = submittingId === order.id;
                const requiresColdChain = order.requires_cold_chain || order.lines?.some((ol: any) => ol.temp_zone === 'chilled' || ol.temp_zone === 'frozen');
                
                // Check compatibility constraints
                const isWarehouseMismatch = selectedWarehouseId && order.fulfilment_warehouse_id !== selectedWarehouseId;
                
                // Check validation constraints
                const isValidCount = toteCount > 0;
                const isColdChainOk = !requiresColdChain || coldChainConfirmed;
                const canConfirm = isValidCount && isColdChainOk && !isSubmitting;

                const priority = getOrderPriority(order);

                return (
                  <div 
                    key={order.id}
                    className={`bg-white rounded-2xl border transition-all duration-205 shadow-xs overflow-hidden ${
                      isExpanded ? 'ring-2 ring-teal-500 border-transparent shadow-md' :
                      isSelected ? 'border-teal-400 bg-teal-50/5 ring-1 ring-teal-350' : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {/* Main Card Header (Always Visible) */}
                    <div className="p-4 sm:p-5 space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        
                        {/* LEFT SIDE: Selection Checkbox & ID */}
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectOrder(order)}
                              disabled={isWarehouseMismatch ? true : false}
                              className="text-slate-500 hover:text-teal-600 transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                            >
                              {isSelected ? (
                                <CheckSquare className="h-5.5 w-5.5 text-teal-500 shrink-0" />
                              ) : (
                                <Square className={`h-5.5 w-5.5 shrink-0 ${isWarehouseMismatch ? 'text-slate-200' : 'text-slate-400 hover:text-slate-600'}`} />
                              )}
                            </button>

                            <div className="flex flex-col">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-base font-extrabold text-slate-900 tracking-tight">{order.id}</span>
                                
                                {/* Dynamic Priority Badge */}
                                <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-[9.5px] rounded-full border ${priority.color}`}>
                                  <span>{priority.icon}</span>
                                  <span>{priority.label}</span>
                                </span>

                                {/* Cold Chain High-Visibility Warning Indicator */}
                                {requiresColdChain && (
                                  <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 px-2 py-0.5 text-[10px] font-bold rounded-full">
                                    <ThermometerSnowflake className="h-3 w-3 shrink-0" />
                                    <span>Cold Chain</span>
                                  </span>
                                )}
                              </div>
                              <p className="text-xs font-bold text-slate-700 mt-1">{order.customer_name}</p>
                            </div>
                          </div>
                        </div>

                        {/* RIGHT SIDE: Warehouse details and labels */}
                        <div className="text-right text-xs text-slate-500 font-medium space-y-1">
                          <div className="bg-slate-100 px-2.5 py-1 rounded-md inline-block font-bold text-slate-755">
                            {order.line_count || order.lines?.length || 0} items
                          </div>
                          
                          <div className="text-[10px] text-slate-450 flex items-center gap-1 justify-end">
                            <Building className="h-3 w-3" />
                            <span className="font-semibold">{order.fulfilment_warehouse_id}</span>
                          </div>
                          
                          {isWarehouseMismatch && (
                            <span className="inline-block text-[9px] bg-slate-100 border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded font-semibold whitespace-nowrap">
                              Warehouse Mismatch
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Metadata and picker reference */}
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 text-xs border-t border-slate-100 pt-3.5 text-slate-600">
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Picked By: <strong className="text-slate-800 font-semibold">{getPickerName(order.picked_by)}</strong></span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          <span>Delivering: <strong className="text-slate-800 font-semibold">{order.delivery_date ? new Date(order.delivery_date).toLocaleDateString() : 'N/A'}</strong></span>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Zone:</span>
                          <strong className="text-teal-700 bg-teal-50 border border-teal-100 px-2 py-0.5 rounded font-black text-[10.5px]">
                            {order.delivery_zone || 'Standard'}
                          </strong>
                        </div>

                        <div className="flex items-center gap-1.5 justify-end">
                          <span className="text-[10px] font-bold text-slate-450 uppercase tracking-widest">Seq:</span>
                          <strong className="text-slate-800 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded font-black text-[11px] font-mono">
                            #{order.dispatch_sequence !== null && order.dispatch_sequence !== undefined ? order.dispatch_sequence : 'N/A'}
                          </strong>
                        </div>
                      </div>

                      {/* Direct Packing Expansion Trigger Button (Hidden when selected for bulk packing) */}
                      {!isExpanded && !isSelected && (
                        <button
                          onClick={() => handleToggleExpand(order.id)}
                          className="w-full py-3.5 bg-slate-900 text-white rounded-xl font-bold text-xs shadow-3xs transition hover:bg-slate-800 min-h-[56px] flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <PackageCheck className="h-4.5 w-4.5 text-teal-400" />
                          <span>Pack This Order</span>
                        </button>
                      )}
                      
                      {isSelected && !isBulkPackingMode && (
                        <div className="w-full py-3 bg-slate-50 border border-slate-200 text-slate-500 rounded-xl text-center text-xs font-bold transition">
                          Order queued in Bulk Packing list (above)
                        </div>
                      )}
                    </div>

                {/* Expanded Packing Actions & Control Panel Block (Expanded Slide-down view) */}
                {isExpanded && !isBulkPackingMode && (
                  <div className="bg-slate-50 border-t border-slate-100 p-4 sm:p-5 space-y-5 animate-slideDown">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Packing Desk Checkpoints</h4>
                      <button
                        onClick={() => handleToggleExpand(order.id)}
                        className="text-xs font-bold text-slate-500 hover:text-slate-800 transition py-1 px-2.5 rounded-md hover:bg-slate-200/50"
                      >
                        Cancel
                      </button>
                    </div>

                    {/* Order items quick list */}
                    {order.lines && order.lines.length > 0 && (
                      <div className="bg-white rounded-xl border border-slate-200 p-3 space-y-2 text-xs">
                        <span className="font-extrabold text-[10px] text-slate-450 uppercase block tracking-wider">Item Checklist Reference</span>
                        <div className="divide-y divide-slate-100 max-h-48 overflow-y-auto">
                          {order.lines.map((line: any, idx: number) => (
                            <div key={idx} className="py-2 flex items-center justify-between gap-3">
                              <div className="font-medium">
                                <span className="font-bold text-slate-850">{line.sku_name || line.sku_id}</span>
                                <span className="text-slate-400 font-mono text-[10px] block mt-0.5">{line.sku_code}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {line.temp_zone === 'frozen' && (
                                  <span className="bg-blue-50 text-blue-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">FROZEN</span>
                                )}
                                {line.temp_zone === 'chilled' && (
                                  <span className="bg-amber-50 text-amber-700 text-[9px] font-bold px-1.5 py-0.5 rounded-sm">CHILLED</span>
                                )}
                                <span className="bg-slate-100 px-2 py-0.5 font-bold text-slate-750 rounded-sm">Qty: {line.quantity}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 1. Cold Chain Confirmation Switch */}
                    {requiresColdChain && (
                      <label className="flex items-start gap-3 bg-amber-50/60 border border-amber-200/60 p-4 rounded-xl cursor-pointer select-none active:bg-amber-100/30 transition">
                        <input
                          type="checkbox"
                          checked={coldChainConfirmed}
                          onChange={(e) => setColdChainConfirmed(e.target.checked)}
                          className="h-5 w-5 rounded-md border-amber-450 accent-amber-600 cursor-pointer mt-0.5 shrink-0"
                        />
                        <div className="space-y-0.5">
                          <span className="text-xs font-bold text-amber-900 leading-tight block">Secure Cold Integrity</span>
                          <span className="text-[10px] text-amber-700 leading-normal block">
                            I verify all chilled or frozen items are packaged dynamically in cooler containers packed with active gel/ice packs, and sealed hermetically.
                          </span>
                        </div>
                      </label>
                    )}

                    {/* 2. Primary Tote / Box Stepper Counter */}
                    <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div>
                          <label className="text-xs font-bold text-slate-800 block">Total Dispatched Totes / Coolers</label>
                          <span className="text-[10px] text-slate-450 block mt-0.5">Asset units passed onto transit driver</span>
                        </div>

                        {/* Big Tap Target Stepper Buttons */}
                        <div className="flex items-center border border-slate-250 rounded-lg overflow-hidden h-[44px]">
                          <button
                            type="button"
                            onClick={() => setToteCount(prev => Math.max(1, prev - 1))}
                            className="w-12 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-250 h-full active:bg-slate-150 transition cursor-pointer"
                          >
                            <Minus className="h-4 w-4 text-slate-600" />
                          </button>
                          <span className="w-12 text-center text-sm font-extrabold text-slate-900 bg-white">
                            {toteCount}
                          </span>
                          <button
                            type="button"
                            onClick={() => setToteCount(prev => prev + 1)}
                            className="w-12 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-250 h-full active:bg-slate-150 transition cursor-pointer"
                          >
                            <Plus className="h-4 w-4 text-slate-600" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 3. Detailed Assets Breakdown Panel */}
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setShowAssetBreakdown(!showAssetBreakdown)}
                        className="text-[11px] font-bold text-slate-500 hover:text-slate-800 inline-flex items-center gap-1 cursor-pointer"
                      >
                        {showAssetBreakdown ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        <span>{showAssetBreakdown ? 'Hide itemized asset breakdown' : 'Add itemized asset breakdown (optional)'}</span>
                      </button>

                      {showAssetBreakdown && (
                        <div className="bg-white rounded-xl border border-slate-200 p-4 divide-y divide-slate-100 space-y-3">
                          
                          {/* Cooler Box row */}
                          <div className="flex items-center justify-between py-2 gap-4">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Cooler Box</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5">Rigid high and low-temp protection</span>
                            </div>
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-[36px]">
                              <button
                                type="button"
                                onClick={() => setCoolerBoxCount(prev => Math.max(0, prev - 1))}
                                className="w-10 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-250 h-full cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-slate-900 bg-white">{coolerBoxCount}</span>
                              <button
                                type="button"
                                onClick={() => setCoolerBoxCount(prev => prev + 1)}
                                className="w-10 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-250 h-full cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Insulated Tote row */}
                          <div className="flex items-center justify-between py-2.5 gap-4">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Insulated Tote</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Flexible zippered insulation bags</span>
                            </div>
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-[36px]">
                              <button
                                type="button"
                                onClick={() => setInsulatedToteCount(prev => Math.max(0, prev - 1))}
                                className="w-10 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-r border-slate-250 h-full cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-slate-900 bg-white">{insulatedToteCount}</span>
                              <button
                                type="button"
                                onClick={() => setInsulatedToteCount(prev => prev + 1)}
                                className="w-10 bg-slate-50 hover:bg-slate-100 flex items-center justify-center border-l border-slate-250 h-full cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Standard Plastic Crate row */}
                          <div className="flex items-center justify-between py-2.5 gap-4">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Plastic Crate</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Regular ambient cargo crates</span>
                            </div>
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-[36px]">
                              <button
                                type="button"
                                onClick={() => setCrateCount(prev => Math.max(0, prev - 1))}
                                className="w-10 bg-slate-50 hover:bg-slate-150 flex items-center justify-center border-r border-slate-250 h-full cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-slate-900 bg-white">{crateCount}</span>
                              <button
                                type="button"
                                onClick={() => setCrateCount(prev => prev + 1)}
                                className="w-10 bg-slate-50 hover:bg-slate-150 flex items-center justify-center border-l border-slate-250 h-full cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Gel Ice Packs row */}
                          <div className="flex items-center justify-between py-2.5 gap-4">
                            <div>
                              <span className="text-xs font-bold text-slate-800 block">Gel Cold Packs</span>
                              <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">Re-useable cooling gel items</span>
                            </div>
                            <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden h-[36px]">
                              <button
                                type="button"
                                onClick={() => setGelPackCount(prev => Math.max(0, prev - 1))}
                                className="w-10 bg-slate-50 hover:bg-slate-150 flex items-center justify-center border-r border-slate-250 h-full cursor-pointer"
                              >
                                <Minus className="h-3.5 w-3.5" />
                              </button>
                              <span className="w-10 text-center text-xs font-bold text-slate-900 bg-white">{gelPackCount}</span>
                              <button
                                type="button"
                                onClick={() => setGelPackCount(prev => prev + 1)}
                                className="w-10 bg-slate-50 hover:bg-slate-150 flex items-center justify-center border-l border-slate-250 h-full cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>

                        </div>
                      )}
                    </div>

                    {/* Submissions feedback triggers */}
                    <div className="space-y-3 pt-2">
                      {!canConfirm && (
                        <div className="flex items-center gap-1.5 text-[11px] text-amber-700 font-semibold bg-amber-50 p-2.5 rounded-lg border border-amber-200 shadow-2xs">
                          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {!isValidCount 
                              ? 'Must specify at least 1 tote pack for transit.'
                              : 'Requires cold chain process verification. Confirm the checkbox above.'}
                          </span>
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => handleConfirmPacking(order)}
                        disabled={!canConfirm || isSubmitting}
                        className={`w-full py-3.5 rounded-xl font-bold text-sm shadow-xs transition flex items-center justify-center gap-2 min-h-[56px] relative cursor-pointer ${
                          canConfirm
                            ? 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                            : 'bg-slate-200 text-slate-450 border border-slate-300 cursor-not-allowed'
                        }`}
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Updating Order Status...</span>
                          </>
                        ) : (
                          <>
                            <Check className="h-4 w-4 shrink-0" />
                            <span>Confirm Packing Completed</span>
                          </>
                        )}
                      </button>
                    </div>

                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
        </div>
      )}

    </div>
  );
}
