// src/components/ZoneManagement.tsx
import React, { useEffect, useState } from 'react';
import { 
  ShieldAlert, 
  Plus, 
  Trash2, 
  X, 
  Layers, 
  MapPin, 
  Flame, 
  Thermometer, 
  AlertTriangle,
  Info,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { 
  ZoningSeparationRule, 
  Zone, 
  Warehouse, 
  ProductClass, 
  User as UserType, 
  SKU, 
  Location as LocationType 
} from '../types';
interface ZoneManagementProps {
  currentUser: UserType | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function ZoneManagement({ currentUser, triggerToast }: ZoneManagementProps) {
  const [activeTab, setActiveTab] = useState<'rules' | 'map'>('rules');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [rules, setRules] = useState<ZoningSeparationRule[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [locations, setLocations] = useState<LocationType[]>([]);

  // Filters
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>('All');
  const [ruleClassAFilter, setRuleClassAFilter] = useState<string>('All');

  // New Rule form overlay
  const [showAddRule, setShowAddRule] = useState<boolean>(false);
  const [newRule, setNewRule] = useState({
    rule_type: 'product_class_separation' as 'product_class_separation' | 'ethylene_separation' | 'allergen_separation',
    class_a: 'fresh_produce' as ProductClass,
    class_b: 'cleaning_chemical' as ProductClass,
    require_different_zones: true,
    minimum_distance_m: 5,
    notes: ''
  });

  // Client-side simulation of mock quantities / SKUs residing in zones
  // We can generate beautiful assignments based on categories of SKUs matching Zone temperature type
  const [assignedSkusByZone, setAssignedSkusByZone] = useState<Record<string, { sku: SKU; qty: number; occupiedKg: number }[]>>({});

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      // 1. Separation Rules
      const rulesRes = await fetch('/api/v1/zoning-rules');
      if (!rulesRes.ok) throw new Error('Failed to load rules');
      const rulesJson = await rulesRes.json();
      const loadedRules = rulesJson.data || [];
      setRules(loadedRules);

      // 2. Zones
      const zonesRes = await fetch('/api/v1/zones');
      if (!zonesRes.ok) throw new Error('Failed to load zones');
      const zonesJson = await zonesRes.json();
      const loadedZones = zonesJson.data || [];
      setZones(loadedZones);

      // 3. Warehouses
      const whRes = await fetch('/api/v1/warehouses');
      if (!whRes.ok) throw new Error('Failed to load warehouses');
      const whJson = await whRes.json();
      const loadedWarehouses = whJson.data || [];
      setWarehouses(loadedWarehouses);
      if (loadedWarehouses && loadedWarehouses.length > 0) {
        setSelectedWarehouseId(loadedWarehouses[0].id);
      }

      // 4. SKUs & Locations to simulate inventory
      const skusRes = await fetch('/api/v1/skus');
      if (!skusRes.ok) throw new Error('Failed to load SKUs');
      const skusJson = await skusRes.json();
      const loadedSkus = skusJson.data || [];
      setSkus(loadedSkus);

      const locRes = await fetch('/api/v1/locations');
      if (!locRes.ok) throw new Error('Failed to load locations');
      const locJson = await locRes.json();
      setLocations(locJson.data || []);

      // Simulate assignments:
      // Map SKUs to zones based on temp compatibility to show real visual dashboard
      const mockAssignments: Record<string, { sku: SKU; qty: number; occupiedKg: number }[]> = {};
      
      loadedZones.forEach((z: Zone) => {
        // Find some compatible SKUs
        const compatSkus = loadedSkus.filter((s: SKU) => s.temp_zone === z.type).slice(0, 3);
        mockAssignments[z.id] = compatSkus.map((sku: SKU, idx: number) => {
          // generate mock quantities
          const qty = idx === 0 ? 120 : idx === 1 ? 85 : 40;
          const weight = sku.weight_kg || 1;
          const occupiedKg = qty * weight;
          return { sku, qty, occupiedKg };
        });
      });

      setAssignedSkusByZone(mockAssignments);

    } catch (err) {
      console.error(err);
      setLoadError('Could not load zoning configuration. Check your internet connection.');
      triggerToast('Error loading zoning configuration.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRule = async () => {
    const isAuthorized = currentUser?.role === 'ops_manager' || currentUser?.role === 'admin';
    if (!isAuthorized) {
      return triggerToast('Access Denied. Only ops_manager or admin roles may save zoning rules.', 'error');
    }

    if (!selectedWarehouseId || selectedWarehouseId === 'All') {
      return triggerToast('Please choose a specific warehouse for this zoning rule.', 'error');
    }

    if (newRule.class_a === newRule.class_b) {
      return triggerToast('Select distinct Class A and Class B products to build separation rules.', 'error');
    }

    const ruleData: ZoningSeparationRule = {
      id: 'ZSR-' + Math.random().toString(36).substr(2, 5).toUpperCase(),
      warehouse_id: selectedWarehouseId,
      rule_type: newRule.rule_type,
      class_a: newRule.class_a,
      class_b: newRule.class_b,
      require_different_zones: newRule.require_different_zones,
      minimum_distance_m: newRule.require_different_zones ? null : newRule.minimum_distance_m,
      notes: newRule.notes || null,
      created_by: currentUser?.id || 'U-OPS',
      created_at: new Date().toISOString()
    };

    try {
      const res = await fetch('/api/v1/zoning-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ruleData)
      });

      if (res.ok) {
        const net = await res.json();
        setRules(prev => [net.data || net, ...prev]);
        triggerToast('Safety Zoning separation rule saved to warehouse ledger.', 'success');
      } else {
        const json = await res.json().catch(() => null);
        triggerToast(json?.error?.message || 'Failed to save Safety Zoning rule on server.', 'error');
      }
    } catch {
      triggerToast('Unbound failure saving rule — check configuration.', 'error');
    }

    setShowAddRule(false);
  };

  const handleDeleteRule = async (ruleId: string) => {
    const isAuthorized = currentUser?.role === 'ops_manager' || currentUser?.role === 'admin';
    if (!isAuthorized) {
      return triggerToast('Access Denied. Only ops_managers can modify warehouse zoning rules.', 'error');
    }

    try {
      const res = await fetch(`/api/v1/zoning-rules/${ruleId}`, { method: 'DELETE' });
      if (res.ok) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
        triggerToast('Safety rule successfully deleted.', 'info');
      } else {
        const json = await res.json().catch(() => null);
        triggerToast(json?.error?.message || 'Failed to delete rule on server.', 'error');
      }
    } catch {
      triggerToast('Deletion failed — check configuration.', 'error');
    }
  };

  // Filter Rules list
  const filteredRules = rules.filter(r => {
    const matchesWh = selectedWarehouseId === 'All' ? true : r.warehouse_id === selectedWarehouseId;
    const matchesClass = ruleClassAFilter === 'All' ? true : r.class_a === ruleClassAFilter || r.class_b === ruleClassAFilter;
    return matchesWh && matchesClass;
  });

  const getRuleBadgeColor = (type: string) => {
    if (type === 'prohibited') return 'bg-rose-50 text-rose-800 border-rose-250 font-bold';
    if (type === 'allowed_with_distance') return 'bg-amber-50 text-amber-800 border-amber-305 font-bold';
    return 'bg-blue-50 text-blue-800 border-blue-200';
  };

  const productClasses: ProductClass[] = [
    'raw_protein',
    'ready_to_eat',
    'dairy',
    'fresh_produce',
    'dry_goods',
    'frozen_protein',
    'allergen',
    'cleaning_chemical',
    'packaging'
  ];

  const classLabels: Record<ProductClass, string> = {
    raw_protein: 'Raw Protein 🔴',
    ready_to_eat: 'Ready To Eat 🍪',
    dairy: 'Dairy / Chilled 🥛',
    fresh_produce: 'Fresh Produce 🍏',
    dry_goods: 'Dry Goods 📦',
    frozen_protein: 'Frozen Protein ❄️',
    allergen: 'Allergen Core ⚠️',
    cleaning_chemical: 'Cleaning Chemical 🧪',
    packaging: 'Packaging Box 📦'
  };

  return (
    <div className="space-y-6">
      
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Layers className="h-5 w-5 text-teal-500" />
            <span>Warehouse Zoning & Separation Matrix</span>
          </h1>
          <p className="text-xs text-slate-550">
            Enforce microbiological, thermal, and chemical isolation parameters alongside absolute ethylene-profile compliance.
          </p>
        </div>

        {/* View Switchers */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveTab('rules')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer transition-all ${
              activeTab === 'rules' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Separation Rules
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer transition-all ${
              activeTab === 'map' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Zone Map & Utilization
          </button>
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
        </div>
      ) : (
        <>
          {activeTab === 'rules' ? (
            <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-4">
              
              {/* Filter controls table header */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2 max-w-full">
                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Target Site</label>
                    <select
                      value={selectedWarehouseId}
                      onChange={(e) => setSelectedWarehouseId(e.target.value)}
                      className="border p-2 rounded-xl text-xs bg-white focus:outline-hidden"
                    >
                      <option value="All">All Sites</option>
                      {warehouses.map(w => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Product Class Filter</label>
                    <select
                      value={ruleClassAFilter}
                      onChange={(e) => setRuleClassAFilter(e.target.value)}
                      className="border p-2 rounded-xl text-xs bg-white focus:outline-hidden"
                    >
                      <option value="All">All Classes</option>
                      {productClasses.map(pc => (
                        <option key={pc} value={pc}>{classLabels[pc]}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <button
                  onClick={() => setShowAddRule(true)}
                  className="bg-teal-505 dark:bg-teal-500 text-slate-950 font-bold px-3 py-2 rounded-xl text-xs flex items-center gap-1.5 min-h-[44px] cursor-pointer"
                >
                  <Plus className="h-4.5 w-4.5 stroke-[2.5]" />
                  <span>Add Safety Rule</span>
                </button>
              </div>

              {/* Rules List Grid */}
              {filteredRules.length === 0 ? (
                <div className="p-12 text-center text-slate-400 text-xs">No active cross-class isolation rules are configured.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold uppercase tracking-wider text-[10px]">
                        <th className="p-4">Site ID</th>
                        <th className="p-4">Rule Core</th>
                        <th className="p-4">Product Category A</th>
                        <th className="p-4">Product Category B</th>
                        <th className="p-4">Separation Mandate</th>
                        <th className="p-4">Rule Explanation / Instruction</th>
                        <th className="p-4 text-right">Delete</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRules.map(rule => {
                        const styleRuleType = rule.require_different_zones ? 'prohibited' : 'allowed_with_distance';
                        const styleText = rule.require_different_zones ? 'PROHIBITED SAME ZONE 🚫' : `DISTANCE BIAS (Min ${rule.minimum_distance_m}m) 📏`;

                        return (
                          <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="p-4 font-mono font-bold text-slate-650">{rule.warehouse_id}</td>
                            <td className="p-4">
                              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold uppercase text-[9px] block w-fit">
                                {rule.rule_type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-slate-900">{classLabels[rule.class_a]}</td>
                            <td className="p-4 font-bold text-slate-900">{classLabels[rule.class_b]}</td>
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded border text-[9px] font-black uppercase ${getRuleBadgeColor(styleRuleType)}`}>
                                {styleText}
                              </span>
                            </td>
                            <td className="p-4 text-slate-500 max-w-xs truncate" title={rule.notes || ''}>
                              {rule.notes || 'Default automatic zone incompatibility safeguard policy.'}
                            </td>
                            <td className="p-4 text-right">
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-slate-300 hover:text-rose-500 font-bold p-1 min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                              >
                                <Trash2 className="h-4.5 w-4.5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            /* MAP AND UTILIZATION VIEW */
            <div className="space-y-6">
              
              <div className="bg-white border rounded-2xl border-slate-150 p-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase text-slate-400">Physical Zone Map Overviews</h3>
                  <p className="text-[11px] text-slate-500 mt-1">Showing active cooling chambers and allergen compliance statuses.</p>
                </div>

                <select
                  value={selectedWarehouseId}
                  onChange={(e) => setSelectedWarehouseId(e.target.value)}
                  className="border p-1.5 text-xs rounded-xl bg-white focus:outline-hidden"
                >
                  {warehouses.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              {/* Grid map cards layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {zones
                  .filter(z => selectedWarehouseId === 'All' ? true : z.warehouse_id === selectedWarehouseId)
                  .map(z => {
                    const housed = assignedSkusByZone[z.id] || [];
                    
                    // Calc occupied kg vs capacity
                    const occupiedSum = housed.reduce((acc, curr) => acc + curr.occupiedKg, 0);
                    const hasCapacityLimit = z.max_capacity_kg != null;
                    const percentUsed = hasCapacityLimit
                      ? Math.min(100, Math.round((occupiedSum / z.max_capacity_kg!) * 100))
                      : null;

                    // Is there an ethylene mismatch?
                    // Producer: ethylene_profile === 'producer'
                    // Sensitive: ethylene_profile === 'sensitive'
                    const hasProducer = housed.some(item => item.sku.ethylene_profile === 'producer');
                    const hasSensitive = housed.some(item => item.sku.ethylene_profile === 'sensitive');
                    const isEthyleneMismatch = hasProducer && hasSensitive;

                    const producerSkus = housed.filter(item => item.sku.ethylene_profile === 'producer').map(item => item.sku.name);
                    const sensitiveSkus = housed.filter(item => item.sku.ethylene_profile === 'sensitive').map(item => item.sku.name);

                    return (
                      <div key={z.id} className="bg-white border border-slate-150 rounded-2xl p-4 space-y-4 shadow-xs flex flex-col justify-between">
                        
                        {/* Area Info */}
                        <div className="space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <strong className="text-slate-900 font-extrabold text-sm block leading-none">{z.name}</strong>
                              <span className="text-[10px] text-slate-400 font-semibold block mt-1.5">Site: {z.warehouse_id}</span>
                            </div>

                            <span className="p-1 px-2 text-[10px] bg-slate-100 text-slate-800 rounded font-bold uppercase shrink-0">
                              {z.type}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
                            <Thermometer className="h-4 w-4 text-teal-500" />
                            <span>Ambient Temp: <strong>{z.current_temp_celsius != null ? `${z.current_temp_celsius}°C` : `${z.min_temp_celsius}-${z.max_temp_celsius}°C`}</strong></span>
                          </div>

                          {/* Level utilization gauge */}
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-500 font-mono">
                              <span>Slot Utilization</span>
                              {hasCapacityLimit && percentUsed !== null && (
                                <span className={percentUsed >= 85 ? 'text-amber-600 font-black' : 'text-slate-900 font-black'}>{percentUsed}%</span>
                              )}
                            </div>
                            {hasCapacityLimit && percentUsed !== null ? (
                              <>
                                <div className="w-full h-2 bg-slate-100 border rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${percentUsed >= 85 ? 'bg-amber-500 animate-pulse' : 'bg-teal-550'}`} 
                                    style={{ width: `${percentUsed}%` }} 
                                  />
                                </div>
                                {percentUsed >= 85 && (
                                  <div className="text-[9px] text-amber-600 font-bold flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" />
                                    <span>High capacity bias threshold! Reserve secondary zone room.</span>
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 italic">No limit set</span>
                            )}
                          </div>

                          {/* Ethylene mismatch soft warn */}
                          {isEthyleneMismatch && (
                            <div className="p-2.5 bg-amber-50 border border-amber-200 text-amber-950 text-[10px] rounded-xl flex gap-1.5 leading-normal font-semibold">
                              <AlertTriangle className="h-4.5 w-4.5 text-amber-600 shrink-0 mt-0.5" />
                              <div>
                                <span className="font-extrabold block">🚩 Ethylene Hazard Alert</span>
                                <span>
                                  Producer <strong className="text-slate-900 font-bold">[{producerSkus.join(', ')}]</strong> housed next to Sensitive 
                                  <strong className="text-slate-900 font-bold"> [{sensitiveSkus.join(', ')}]</strong> in cold room!
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Housed SKUs listed */}
                          <div className="space-y-1.5">
                            <span className="text-[10px] uppercase font-black text-slate-400 block pb-1 border-b border-dashed">Allocated SKU Stocks</span>
                            {housed.length === 0 ? (
                              <div className="text-[10.5px] text-slate-400 italic">No inventory loads mapped to this zone currently.</div>
                            ) : (
                              <div className="space-y-1">
                                {housed.map(item => (
                                  <div key={item.sku.id} className="flex justify-between items-center text-[11px] p-1 bg-slate-50 rounded">
                                    <span className="truncate text-slate-750 font-semibold" title={item.sku.name}>{item.sku.name}</span>
                                    <strong className="text-slate-900 font-mono font-bold shrink-0">{item.qty} units</strong>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                        </div>

                        {/* Allowed classes footer pill badges */}
                        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap gap-1">
                          {(z.permitted_product_classes || []).slice(0, 3).map(cl => (
                            <span key={cl} className="bg-teal-50/50 border border-teal-150 text-teal-800 text-[8.5px] font-bold uppercase rounded px-1.5 py-0.5">
                              {cl.replace(/_/g, ' ')}
                            </span>
                          ))}
                          {(z.permitted_product_classes || []).length > 3 && (
                            <span className="bg-slate-100 text-slate-500 text-[8.5px] font-bold rounded px-1.5 py-0.5">
                              +{z.permitted_product_classes!.length - 3} more
                            </span>
                          )}
                        </div>

                      </div>
                    );
                  })
                }
              </div>
            </div>
          )}
        </>
      )}

      {/* NEW RULE FORM MODAL OVERLAY */}
      {showAddRule && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl border border-slate-100 p-5 max-w-sm w-full space-y-4 animate-scaleUp">
            
            <div className="flex items-center justify-between border-b pb-2">
              <strong className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                <ShieldAlert className="h-4.5 w-4.5 text-teal-600" />
                <span>Add Safety Separation Rule</span>
              </strong>
              <button onClick={() => setShowAddRule(false)} className="p-1 hover:bg-slate-100 text-slate-400 rounded-lg min-h-[44px] min-w-[44px]">
                <X className="h-4.5 w-4.5" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-slate-705">
              
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Safety Rule Category</label>
                <select
                  value={newRule.rule_type}
                  onChange={(e) => setNewRule(p => ({ ...p, rule_type: e.target.value as any }))}
                  className="w-full border p-1.5 rounded-xl bg-white"
                >
                  <option value="product_class_separation">Microbiological Class Proximity isolation</option>
                  <option value="ethylene_separation">Ethylene Safety separation</option>
                  <option value="allergen_separation">Allergen Safety Isolation</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Product Class A</label>
                  <select
                    value={newRule.class_a}
                    onChange={(e) => setNewRule(p => ({ ...p, class_a: e.target.value as ProductClass }))}
                    className="w-full border p-1 rounded bg-white"
                  >
                    {productClasses.map(pc => (
                      <option key={pc} value={pc}>{classLabels[pc]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Product Class B</label>
                  <select
                    value={newRule.class_b}
                    onChange={(e) => setNewRule(p => ({ ...p, class_b: e.target.value as ProductClass }))}
                    className="w-full border p-1 rounded bg-white"
                  >
                    {productClasses.map(pc => (
                      <option key={pc} value={pc}>{classLabels[pc]}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Segregation level</label>
                <div className="space-y-2 mt-1 bg-slate-50/50 p-2 border rounded-xl">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="different_zones"
                      checked={newRule.require_different_zones}
                      onChange={() => setNewRule(p => ({ ...p, require_different_zones: true }))}
                    />
                    <span>Absolute Separation (Different zones req.)</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="radio"
                      name="different_zones"
                      checked={!newRule.require_different_zones}
                      onChange={() => setNewRule(p => ({ ...p, require_different_zones: false }))}
                    />
                    <span>Distance Separation (Min distance bias)</span>
                  </label>
                </div>
              </div>

              {!newRule.require_different_zones && (
                <div>
                  <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Minimum Safe Distance (Meters)</label>
                  <input
                    type="number"
                    value={newRule.minimum_distance_m || ''}
                    onChange={(e) => setNewRule(p => ({ ...p, minimum_distance_m: parseInt(e.target.value) || 0 }))}
                    className="w-full border p-1 rounded-xl"
                  />
                </div>
              )}

              <div>
                <label className="text-[10px] font-black uppercase text-slate-400 block mb-1">Instruction / Warning Notes</label>
                <textarea
                  value={newRule.notes}
                  onChange={(e) => setNewRule(p => ({ ...p, notes: e.target.value }))}
                  placeholder="e.g. Do not store cleaning concentrates adjacent to cardboard packaging containers..."
                  className="w-full border p-1.5 rounded-xl text-xs"
                  rows={2}
                />
              </div>

            </div>

            <button
              onClick={handleCreateRule}
              className="w-full bg-teal-500 hover:bg-teal-400 text-slate-950 font-black py-2 rounded-xl text-xs min-h-[44px] cursor-pointer"
            >
              Commit Safety Isolation Matrix
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
