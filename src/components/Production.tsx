import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Play, 
  CheckCircle, 
  AlertTriangle, 
  Layers, 
  FileText, 
  ArrowRight, 
  ChevronRight, 
  Clock, 
  User, 
  Percent, 
  MapPin, 
  Activity, 
  Cpu, 
  TrendingUp, 
  ShieldAlert, 
  Network, 
  Boxes,
  HelpCircle
} from 'lucide-react';
import { displayQty } from '../utils/uom';

interface ProductionProps {
  currentUser: any;
}

export default function Production({ currentUser }: ProductionProps) {
  const [recipes, setRecipes] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [skus, setSkus] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [locations, setLocations] = useState<any[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // UI Tab state
  const [activeSubTab, setActiveSubTab] = useState<'runs' | 'recipes' | 'bom_checker' | 'lineage'>('runs');

  // Trigger Run Modal/Form State
  const [showTriggerModal, setShowTriggerModal] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<any>(null);
  const [batchesPlanned, setBatchesPlanned] = useState<number>(1);
  const [outputBatchId, setOutputBatchId] = useState<string>('');
  const [outputExpiryDate, setOutputExpiryDate] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [warehouseId, setWarehouseId] = useState<string>('RGN');
  const [outputLocationId, setOutputLocationId] = useState<string>('');

  // Selected batch mapping for ingredients: component_id -> selected_batch_id
  const [ingredientBatchSelections, setIngredientBatchSelections] = useState<Record<string, string>>({});

  // Lineage Tab State
  const [tracedBatchId, setTracedBatchId] = useState<string>('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const [resRecipes, resTemplates, resRuns, resSkus, resBatches, resLocs, resPOs] = await Promise.all([
        fetch('/api/v1/production/recipes'),
        fetch('/api/v1/assemblies/templates'),
        fetch('/api/v1/production/runs'),
        fetch('/api/v1/skus'),
        fetch('/api/v1/batches'),
        fetch('/api/v1/locations'),
        fetch('/api/v1/purchase-orders')
      ]);

      if (!resRecipes.ok || !resTemplates.ok || !resRuns.ok || !resSkus.ok || !resBatches.ok || !resLocs.ok) {
        throw new Error('Failed to retrieve assemblies & production BOM metadata.');
      }

      const dRecipes = await resRecipes.json();
      const dTemplates = await resTemplates.json();
      const dRuns = await resRuns.json();
      const dSkus = await resSkus.json();
      const dBatches = await resBatches.json();
      const dLocs = await resLocs.json();
      const dPOs = await resPOs.ok ? await resPOs.json() : { data: [] };

      setRecipes(dRecipes.data || []);
      setTemplates(dTemplates.data || []);
      setRuns(dRuns.data || []);
      setSkus(dSkus.data || []);
      setBatches(dBatches.data || []);
      setLocations(dLocs.data || []);
      setPurchaseOrders(dPOs.data || []);

      // Autofill default trace target if any batches exist
      const activeBatches = dBatches.data || [];
      const parentLinked = activeBatches.find((b: any) => b.parent_batch_ids && b.parent_batch_ids.length > 0);
      if (parentLinked) {
        setTracedBatchId(parentLinked.id);
      } else if (activeBatches.length > 0) {
        setTracedBatchId(activeBatches[0].id);
      }

    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Offline node connection error');
    } finally {
      setLoading(false);
    }
  };

  // Auto-allocate component batches based on FEFO (First Expired First Out)
  const handleSelectRecipe = (recipe: any) => {
    setSelectedRecipe(recipe);
    setBatchesPlanned(1);
    
    // Default output batch id suggestion
    setOutputBatchId(`ASM-BNO-${Math.floor(100000 + Math.random() * 900000)}`);
    
    // Expiry suggestions (30 days from today)
    const thirtyDaysOut = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0];
    setOutputExpiryDate(thirtyDaysOut);

    // Filter location coordinates by selected warehouse
    const matchLocs = locations.filter(l => l.warehouse_id === warehouseId);
    if (matchLocs.length > 0) {
      setOutputLocationId(matchLocs[0].id);
    }

    // Auto FEFO Allocation for each ingredient component
    const defaultSelections: Record<string, string> = {};
    recipe.components.forEach((comp: any) => {
      const componentBatches = batches
        .filter(b => b.sku_id === comp.sku_id && b.quantity_available > 0)
        .sort((a, b) => {
          const dateA = a.expiry_date ? new Date(a.expiry_date).getTime() : 9999999999999;
          const dateB = b.expiry_date ? new Date(b.expiry_date).getTime() : 9999999999999;
          return dateA - dateB;
        });

      if (componentBatches.length > 0) {
        // Bind to closest expiry batch (FEFO)
        defaultSelections[comp.id] = componentBatches[0].id;
      } else {
        defaultSelections[comp.id] = '';
      }
    });
    setIngredientBatchSelections(defaultSelections);
  };

  // Initiate Production Run execution
  const triggerProductionRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRecipe) return;

    // Validate selections
    let hasAlert = false;
    let alertText = '';

    const payloadLines = selectedRecipe.components.map((comp: any) => {
      const bid = ingredientBatchSelections[comp.id];
      const matchBatch = batches.find(b => b.id === bid);
      const reqAmount = comp.qty_per_batch * batchesPlanned;

      if (!bid) {
        hasAlert = true;
        alertText = `Ingredient batch is missing for component ${comp.sku_id}`;
      } else if (!matchBatch) {
        hasAlert = true;
        alertText = `Specified batch ID ${bid} could not be successfully loaded.`;
      } else {
        // Quantity warning
        if (matchBatch.quantity_available < reqAmount) {
          hasAlert = true;
          alertText = `Insufficient stock in batch ${bid}. Required: ${reqAmount}, Available: ${matchBatch.quantity_available}`;
        }
        // Expiry warning
        if (matchBatch.expiry_date && new Date(matchBatch.expiry_date) < new Date()) {
          hasAlert = true;
          alertText = `Warning: Select batch ${bid} is EXPIRED (Expiry: ${matchBatch.expiry_date}). Proceeding represents safety violation.`;
        }
      }

      return {
        component_id: comp.id,
        sku_id: comp.sku_id,
        batch_id: bid,
        qty_planned: reqAmount
      };
    });

    if (hasAlert) {
      if (!window.confirm(`${alertText}\n\nAre you sure you want to enforce execution despite safety/quantity anomalies?`)) {
        return;
      }
    }

    try {
      const res = await fetch('/api/v1/production/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipe_id: selectedRecipe.id,
          warehouse_id: warehouseId,
          output_location_id: outputLocationId,
          batches_planned: batchesPlanned,
          output_batch_id: outputBatchId,
          output_expiry_date: outputExpiryDate,
          notes,
          component_lines: payloadLines
        })
      });

      if (!res.ok) {
        throw new Error('Server rejected creation parameters');
      }

      setShowTriggerModal(false);
      setSelectedRecipe(null);
      fetchData();
    } catch (err: any) {
      alert(`Execution trigger failed: ${err.message}`);
    }
  };

  // Perform status progression step for standard run
  const advanceRunStatus = async (runId: string, currentStatus: string) => {
    let actualOutput = null;
    if (currentStatus === 'in_progress') {
      const inputStr = window.prompt("Confirm Actual Manufactured Quantity Base Units (Enter to keep planned target):");
      if (inputStr === null) return; // cancel
      if (inputStr.trim() !== '') {
        actualOutput = Number(inputStr);
      }
    }

    try {
      const res = await fetch(`/api/v1/production/runs/${runId}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qty_actual_output: actualOutput })
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Status alteration rejected');
      }
      fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Lineage node-tree computation helper
  const renderLineageTree = () => {
    const rootBatch = batches.find(b => b.id === tracedBatchId);
    if (!rootBatch) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-xs">
          Please enter or select a valid target batch code above to map its molecular production lineage.
        </div>
      );
    }

    // Trace down ancestors (parents)
    const parentsList = rootBatch.parent_batch_ids || [];
    const childrenList = rootBatch.child_batch_ids || [];

    const rootSku = skus.find(s => s.id === rootBatch.sku_id);

    return (
      <div className="space-y-6">
        <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden shadow-xs">
          <div className="absolute top-0 right-0 p-8 text-slate-800 pointer-events-none transform translate-x-4 -translate-y-4">
            <Network className="h-44 w-44" />
          </div>
          <div className="relative space-y-2">
            <span className="text-[10px] bg-teal-500/20 text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              Selected Flow Focal Point
            </span>
            <div className="text-xl font-mono font-black tracking-tight">{rootBatch.id}</div>
            <p className="text-xs text-slate-400 font-medium">
              SKU: <span className="text-white font-bold">{rootSku?.name || 'Unknown SKU'}</span> ({rootBatch.sku_id}) • Store Location: <span className="text-white font-bold">{rootBatch.warehouse_id} - Bin {rootBatch.location_id}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row items-stretch justify-center gap-6">
          
          {/* Parents Panel (Raw Inputs / Molecular Antecedents) */}
          <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xxs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <Boxes className="h-4 w-4 text-indigo-500" />
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Parent Inputs (Consumed Raw Material)</h3>
            </div>
            {parentsList.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-slate-400 italic">
                Direct origin. This batch contains virgin/imported materials (No parent assembly components found).
              </div>
            ) : (
              <div className="space-y-3">
                {parentsList.map(pId => {
                  const pBatch = batches.find(b => b.id === pId);
                  const pSku = pBatch ? skus.find(s => s.id === pBatch.sku_id) : null;
                  return (
                    <div 
                      key={pId} 
                      onClick={() => setTracedBatchId(pId)}
                      className="group border border-slate-150 p-3 rounded-xl hover:border-indigo-400 hover:bg-slate-50/50 cursor-pointer transition text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-indigo-600 transition">{pId}</span>
                        <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500">Parent Batch</span>
                      </div>
                      <p className="font-bold text-slate-700 text-[10px] leading-tight truncate">{pSku?.name || 'Secondary ingredient SKU'}</p>
                      {pBatch && (
                        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-100">
                          <span>Leftover Qty: <strong>{displayQty(pBatch.quantity_available, pSku)}</strong></span>
                          <span>Exp: {pBatch.expiry_date ? pBatch.expiry_date.split('T')[0] : 'None'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Connection Vector Graphic representation */}
          <div className="flex flex-col items-center justify-center text-slate-350 py-4 lg:py-0 w-8">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 font-mono rotate-0 lg:-rotate-90 block lg:inline my-1 whitespace-nowrap">CONSUMES</span>
            <div className="h-6 w-0.5 bg-slate-200 lg:h-12 border-dashed" />
            <ChevronRight className="h-4 w-4 text-indigo-505 rotate-90 lg:rotate-0 my-1 shrink-0" />
          </div>

          {/* Core Focus Center Batch Card Node */}
          <div className="flex-1 bg-indigo-50/20 border-2 border-indigo-200 rounded-2xl p-5 flex flex-col justify-between shadow-xxs max-w-full">
            <div className="space-y-3">
              <div className="flex items-center space-x-2 pb-3 border-b border-indigo-100">
                <Activity className="h-4 w-4 text-indigo-600 animate-pulse" />
                <h3 className="text-xs font-black uppercase text-indigo-900 tracking-wider">Molecular Node Center</h3>
              </div>
              <div className="text-sm font-mono font-black text-indigo-850">{rootBatch.id}</div>
              <p className="font-bold text-slate-800 text-xs leading-normal">{rootSku?.name || 'Primary target SKU'}</p>
              
              <div className="grid grid-cols-2 gap-2 pt-2 text-[10px]">
                <div className="bg-white p-2 rounded-lg border border-indigo-50">
                  <span className="text-slate-400 block pb-0.5">Physical Qty</span>
                  <span className="font-bold text-slate-800">{displayQty(rootBatch.quantity_available, rootSku)}</span>
                </div>
                <div className="bg-white p-2 rounded-lg border border-indigo-50">
                  <span className="text-slate-400 block pb-0.5">Manufacturing Exp</span>
                  <span className="font-bold text-slate-800">{rootBatch.expiry_date ? rootBatch.expiry_date.split('T')[0] : 'Unlimited'}</span>
                </div>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-indigo-100 text-[9px] text-indigo-750 font-semibold space-y-1">
              <div>Created: {new Date(rootBatch.created_at).toLocaleDateString()}</div>
              {rootBatch.assembly_order_id && (
                <div className="font-mono">Reference order: {rootBatch.assembly_order_id}</div>
              )}
            </div>
          </div>

          {/* Connection Vector Graphic representation */}
          <div className="flex flex-col items-center justify-center text-slate-350 py-4 lg:py-0 w-8">
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-405 font-mono rotate-0 lg:-rotate-90 block lg:inline my-1 whitespace-nowrap">BUILDS INTO</span>
            <div className="h-6 w-0.5 bg-slate-200 lg:h-12 border-dashed" />
            <ChevronRight className="h-4 w-4 text-teal-505 rotate-90 lg:rotate-0 my-1 shrink-0" />
          </div>

          {/* Children Panel (Assembled Output Batches) */}
          <div className="flex-1 bg-white border border-slate-200/80 rounded-2xl p-5 space-y-4 shadow-xxs">
            <div className="flex items-center space-x-2 pb-3 border-b border-slate-100">
              <TrendingUp className="h-4 w-4 text-teal-500" />
              <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider">Assembled Outputs (Downstream Child lines)</h3>
            </div>
            {childrenList.length === 0 ? (
              <div className="py-8 text-center text-[11px] text-slate-400 italic">
                Terminal leaf. This batch is not linked as parent ingredient to any subordinate/newer child assemblies.
              </div>
            ) : (
              <div className="space-y-3">
                {childrenList.map(cId => {
                  const cBatch = batches.find(b => b.id === cId);
                  const cSku = cBatch ? skus.find(s => s.id === cBatch.sku_id) : null;
                  return (
                    <div 
                      key={cId} 
                      onClick={() => setTracedBatchId(cId)}
                      className="group border border-slate-150 p-3 rounded-xl hover:border-teal-400 hover:bg-slate-50/50 cursor-pointer transition text-xs space-y-1.5"
                    >
                      <div className="flex justify-between items-center">
                        <span className="font-mono font-bold text-slate-900 group-hover:text-teal-600 transition">{cId}</span>
                        <span className="text-[9px] bg-teal-50 text-teal-700 px-1.5 py-0.5 rounded font-semibold">Assembled Output</span>
                      </div>
                      <p className="font-bold text-slate-700 text-[10px] leading-tight truncate">{cSku?.name || 'Assembled parent-child line'}</p>
                      {cBatch && (
                        <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5 border-t border-slate-100">
                          <span>Leftover Qty: <strong>{displayQty(cBatch.quantity_available, cSku)}</strong></span>
                          <span>Exp: {cBatch.expiry_date ? cBatch.expiry_date.split('T')[0] : 'None'}</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-24 text-slate-400 space-y-4">
        <Cpu className="h-10 w-10 text-teal-500 animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Revising factory logs...</span>
      </div>
    );
  }

  // Find PO lines that may have BOM triggers
  const pomLines = purchaseOrders.flatMap((po: any) => 
    (po.lines || []).map((line: any) => ({
      ...line,
      po_id: po.id,
      supplier_name: po.supplier_name,
      status: po.status
    }))
  ).filter((line: any) => line.bom_linked);

  return (
    <div className="space-y-6">
      {errorMsg && (
        <div className="bg-red-50 border border-red-200 text-red-950 p-4 rounded-xl text-xs flex items-center space-x-2">
          <ShieldAlert className="h-4 w-4 text-red-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Header Info Panel */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] bg-teal-500/20 text-teal-300 font-extrabold px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            SECURE BATCH MANUFACTORY & TRACING
          </span>
          <h2 className="text-xl font-black tracking-tight uppercase">Manufacturing & Assemblies</h2>
          <p className="text-slate-400 text-xs">Verify BOM links, deploy production recipes, and audit real-time ingredient traces.</p>
        </div>

        <button
          onClick={() => {
            if (recipes.length > 0) {
              handleSelectRecipe(recipes[0]);
              setShowTriggerModal(true);
            } else {
              alert("No recipes seeded in database to allocate components!");
            }
          }}
          className="flex items-center bg-teal-550 border border-teal-605 text-slate-950 px-4 py-2 font-bold text-xs rounded-xl hover:bg-teal-450 transition tracking-wide cursor-pointer min-h-[44px]"
        >
          <Plus className="h-4 w-4 mr-2 text-slate-950" />
          Trigger Production Run
        </button>
      </div>

      {/* Sub-tab list headers */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('runs')}
          className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition ${
            activeSubTab === 'runs'
              ? 'border-indigo-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Active Production Runs
        </button>
        <button
          onClick={() => setActiveSubTab('recipes')}
          className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition ${
            activeSubTab === 'recipes'
              ? 'border-indigo-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          BOM Production Recipes
        </button>
        <button
          onClick={() => setActiveSubTab('bom_checker')}
          className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition ${
            activeSubTab === 'bom_checker'
              ? 'border-indigo-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          BOM Link Checker
        </button>
        <button
          onClick={() => setActiveSubTab('lineage')}
          className={`px-4 py-2 text-xs font-bold tracking-wide uppercase border-b-2 transition ${
            activeSubTab === 'lineage'
              ? 'border-indigo-600 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-900'
          }`}
        >
          Batch Lineage DAG
        </button>
      </div>

      {/* Tab contents */}
      {activeSubTab === 'runs' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xxs p-6">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest mb-4">WMS Run Scheduler List</h3>
            {runs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 italic text-xs">
                No active assembly or production runs registered for the current ledger state.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {runs.map((run: any) => {
                  const outputSku = skus.find(s => s.id === recipes.find(r => r.id === run.recipe_id)?.output_sku_id);
                  let statusBadge = "bg-slate-105 text-slate-650";
                  let progressPct = 25;
                  if (run.status === 'planned') {
                    statusBadge = "bg-amber-100 text-amber-800 border-amber-200";
                    progressPct = 50;
                  } else if (run.status === 'in_progress') {
                    statusBadge = "bg-indigo-100 text-indigo-800 border-indigo-200";
                    progressPct = 75;
                  } else if (run.status === 'completed') {
                    statusBadge = "bg-green-100 text-green-800 border-green-200";
                    progressPct = 100;
                  }
                  
                  return (
                    <div key={run.id} className="py-4.5 flex flex-col md:flex-row items-stretch justify-between gap-4">
                      
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-black text-slate-900 text-sm">{run.id}</span>
                          <span className="text-[10px] text-slate-400">•</span>
                          <span className={`px-2 py-0.5 rounded border text-[9px] uppercase tracking-wider font-extrabold ${statusBadge}`}>
                            {run.status === 'planned' ? 'Draft' : run.status === 'in_progress' ? 'In Production' : 'Assembly Complete'}
                          </span>
                        </div>
                        <p className="text-xs font-bold text-slate-800">{run.recipe_name}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400 font-medium">
                          <span>Output destination location: <strong>{run.output_location_id}</strong></span>
                          <span>Output: <strong>{displayQty(run.output_qty_planned, outputSku)}</strong> ({outputSku?.name})</span>
                        </div>
                      </div>

                      {/* Ingredient list preview inside Run card */}
                      <div className="bg-slate-50 border border-slate-150 p-2.5 rounded-lg text-[10px] space-y-1 min-w-[240px]">
                        <span className="font-bold text-slate-500 uppercase text-[8px] tracking-wide block">Raw Ingredient Batches Consumed</span>
                        {run.component_lines.map((line: any, idx: number) => {
                          const lineSku = skus.find(s => s.id === line.sku_id);
                          return (
                            <div key={idx} className="flex items-center justify-between font-mono">
                              <span className="text-slate-700">{lineSku?.name || line.sku_id}: <strong className="text-indigo-600 font-semibold">{line.batch_id}</strong></span>
                              <span className="text-slate-900 font-bold">{displayQty(line.qty_planned, lineSku)}</span>
                            </div>
                          );
                        })}
                      </div>

                      <div className="flex flex-col justify-center items-end space-y-2">
                        {/* Progress Stepper bar representation */}
                        <div className="w-32 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                          <div className="bg-teal-500 h-full" style={{ width: `${progressPct}%` }} />
                        </div>
                        
                        {run.status !== 'completed' && (
                          <button
                            onClick={() => advanceRunStatus(run.id, run.status)}
                            className="flex items-center bg-indigo-50 border border-indigo-150 hover:bg-indigo-150 hover:border-indigo-250 text-indigo-700 font-bold text-[10px] px-3 py-1.5 rounded-lg transition min-h-[34px] cursor-pointer"
                          >
                            {run.status === 'planned' ? (
                              <>
                                <Play className="h-3 w-3 mr-1 text-indigo-700" />
                                Start Production Run
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1 text-indigo-700" />
                                Complete & Recalculate
                              </>
                            )}
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {activeSubTab === 'recipes' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {recipes.map(recipe => {
            const outSku = skus.find(s => s.id === recipe.output_sku_id);
            return (
              <div key={recipe.id} className="bg-white border border-slate-200/80 rounded-2xl p-6 space-y-4 shadow-xxs">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <span className="font-mono text-slate-400 font-bold select-none">{recipe.id}</span>
                  <span className="bg-teal-50 text-teal-700 border border-teal-100 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider">
                    {recipe.status}
                  </span>
                </div>
                <div className="space-y-1">
                  <h3 className="text-sm font-black text-slate-800 leading-tight uppercase">{recipe.name}</h3>
                  <p className="text-[10px] text-slate-400">{recipe.notes || 'No specialized instructions'}</p>
                </div>

                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3.5 space-y-2.5">
                  <div className="flex justify-between items-center text-[10px] font-bold text-slate-450 border-b border-slate-200 pb-1.5 uppercase">
                    <span>Component BOM SKU</span>
                    <span>Standard Target Requirement</span>
                  </div>
                  {recipe.components.map((comp: any) => {
                    const compSku = skus.find(s => s.id === comp.sku_id);
                    return (
                      <div key={comp.id} className="text-xs flex justify-between items-center font-semibold">
                        <span className="text-slate-800 leading-snug">{compSku?.name || comp.sku_id}</span>
                        <span className="font-mono text-slate-900 font-bold">{displayQty(comp.qty_per_batch, compSku)}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-1 text-[10px] text-slate-420 font-bold">
                  <span>Output product: <strong className="text-slate-700">{outSku?.name || recipe.output_sku_id}</strong></span>
                  <span>Per recipe batch: <strong className="text-teal-600">{displayQty(recipe.output_qty_per_batch, outSku)}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {activeSubTab === 'bom_checker' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xxs space-y-6">
          <div className="space-y-2">
            <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest text-left">BOM LinkedIn PO Verify Hub</h3>
            <p className="text-xs text-slate-450 text-left">Verify and track which imported purchase order lines require direct recipe mappings / ingredient allocations upon receipt.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-150 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="p-3">PO Line ID</th>
                  <th className="p-3 font-semibold">Associated SKU</th>
                  <th className="p-3 text-center">BOM Verification Status</th>
                  <th className="p-3">Requirement</th>
                  <th className="p-3 text-right">Standard Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {pomLines.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400 italic text-xs">
                      No inbound purchase order lines are linked/associated with active manufacturing recipes in current manifest.
                    </td>
                  </tr>
                ) : (
                  pomLines.map((line: any) => {
                    const lSku = skus.find(s => s.id === line.sku_id);
                    return (
                      <tr key={line.id} className="hover:bg-slate-50/50 transition duration-150">
                        <td className="p-3 font-mono font-bold text-slate-900">{line.id}</td>
                        <td className="p-3">
                          <p className="font-bold text-slate-800 leading-snug">{lSku?.name || line.sku_id}</p>
                          <p className="text-[10px] text-slate-400">PO: {line.po_id}</p>
                        </td>
                        <td className="p-3 text-center">
                          <span className="bg-green-100 text-green-800 border border-green-200 px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider">
                            ✓ SECURE BOM LINKED
                          </span>
                        </td>
                        <td className="p-3 font-mono font-bold text-slate-900">
                          {displayQty(line.qty_ordered, lSku)}
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              const matchRec = recipes.find(r => r.components.some((c: any) => c.sku_id === line.sku_id));
                              if (matchRec) {
                                handleSelectRecipe(matchRec);
                                setShowTriggerModal(true);
                              } else {
                                alert("No direct production recipe maps to this imported material component yet!");
                              }
                            }}
                            className="bg-slate-100 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 font-bold text-[10px] px-3 py-1.5 rounded-lg transition min-h-[34px] cursor-pointer"
                          >
                            Trigger Alloc Run
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeSubTab === 'lineage' && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-xxs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div className="space-y-1 text-left">
              <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest">Molecular Batch Lineage Trace (DAG)</h3>
              <p className="text-xs text-slate-450">Trace continuous molecular linkages between ingredients/PO raw input entries and final compiled assembled batches.</p>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-xs text-slate-500 font-bold">Trace Batch:</span>
              <select
                value={tracedBatchId}
                onChange={(e) => setTracedBatchId(e.target.value)}
                className="bg-slate-50 border border-slate-200 p-2 rounded-xl text-xs font-mono font-bold cursor-pointer"
              >
                {batches.map(b => (
                  <option key={b.id} value={b.id}>
                    [{b.id}] - {skus.find(s => s.id === b.sku_id)?.name || b.sku_id}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {renderLineageTree()}
        </div>
      )}

      {/* Trigger Modal Drawer */}
      {showTriggerModal && selectedRecipe && (
        <div className="fixed inset-0 bg-slate-955/60 backdrop-blur-xxs z-50 flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 w-full max-w-lg shadow-xl flex flex-col space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400">Launch Manufacturing Control</span>
                <h3 className="text-sm font-black text-slate-800 uppercase">{selectedRecipe.name}</h3>
              </div>
              <button 
                onClick={() => setSelectedRecipe(null)} 
                className="p-1 hover:bg-slate-50 text-slate-400 rounded-lg font-bold min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={triggerProductionRun} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1.5 text-left">Production Batch Count</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={batchesPlanned}
                    onChange={(e) => {
                      const num = Math.max(1, Number(e.target.value));
                      setBatchesPlanned(num);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1.5 text-left">Output Batch ID</label>
                  <input
                    type="text"
                    required
                    value={outputBatchId}
                    onChange={(e) => setOutputBatchId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1.5 text-left">Expiration Date</label>
                  <input
                    type="date"
                    required
                    value={outputExpiryDate}
                    onChange={(e) => setOutputExpiryDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1.5 text-left">Manufacture Location Bin</label>
                  <select
                    value={outputLocationId}
                    onChange={(e) => setOutputLocationId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold cursor-pointer"
                  >
                    {locations.filter(l => l.warehouse_id === warehouseId).map(l => (
                      <option key={l.id} value={l.id}>{l.warehouse_id} - Bin {l.code} ({l.zone_id})</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic ingredient batch allocation dropdowns */}
              <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4.5 space-y-3.5">
                <h4 className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-1 leading-none text-left">FEFO Raw Component Multi-Select Allocation</h4>
                {selectedRecipe.components.map((comp: any) => {
                  const compSku = skus.find(s => s.id === comp.sku_id);
                  const selectedId = ingredientBatchSelections[comp.id];
                  const matchBatch = batches.find(b => b.id === selectedId);
                  const reqQty = comp.qty_per_batch * batchesPlanned;

                  // Get active batches containing this SKU
                  const skuBatches = batches.filter(b => b.sku_id === comp.sku_id && b.quantity_available > 0);

                  // Safety and quantity warn evaluation
                  const isExpired = matchBatch?.expiry_date && new Date(matchBatch.expiry_date) < new Date();
                  const isInsufficient = matchBatch && matchBatch.quantity_available < reqQty;

                  return (
                    <div key={comp.id} className="space-y-1.5 border-b border-slate-200 pb-3 last:border-0 last:pb-0">
                      <div className="flex justify-between items-center text-[10px] font-bold text-slate-700 leading-none">
                        <span>{compSku?.name || comp.sku_id}</span>
                        <span className="text-[9px] text-slate-400 uppercase">Need: <strong className="text-indigo-600 font-bold">{displayQty(reqQty, compSku)}</strong></span>
                      </div>

                      <select
                        value={selectedId}
                        onChange={(e) => {
                          setIngredientBatchSelections(prev => ({
                            ...prev,
                            [comp.id]: e.target.value
                          }));
                        }}
                        className="w-full bg-white border border-slate-250 p-2 rounded-xl text-xs font-mono font-bold cursor-pointer"
                      >
                        <option value="">-- Choose active batch --</option>
                        {skuBatches.map(b => (
                          <option key={b.id} value={b.id}>
                            [{b.id}] Available: {displayQty(b.quantity_available, compSku)} • Exp: {b.expiry_date ? b.expiry_date.split('T')[0] : 'None'}
                          </option>
                        ))}
                      </select>

                      {/* Display Alert Warnings inside selector context */}
                      {isInsufficient && (
                        <div className="flex items-center space-x-1 text-red-700 bg-red-50 p-1.5 rounded-lg text-[9px] font-bold border border-red-100">
                          <AlertTriangle className="h-3 w-3 text-red-650 animate-bounce" />
                          <span>Insufficient quantity in selected batch (Available: {displayQty(matchBatch.quantity_available, compSku)}).</span>
                        </div>
                      )}

                      {isExpired && (
                        <div className="flex items-center space-x-1 text-red-700 bg-red-50 p-1.5 rounded-lg text-[9px] font-bold border border-red-100">
                          <ShieldAlert className="h-3 w-3 text-red-650" />
                          <span>Batch {selectedId} is EXPIRED. Trigger represents high safety risk violating Kenya food trace logs!</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block text-slate-400 font-bold uppercase text-[9px] tracking-wide mb-1.5 text-left">Run Operational Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Record recipe batch details..."
                  className="w-full bg-slate-50 border border-slate-200 p-2.5 rounded-xl font-bold min-h-[60px]"
                />
              </div>

              <div className="pt-3 flex gap-3 text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setSelectedRecipe(null)}
                  className="flex-1 bg-slate-100 border border-slate-200 text-slate-700 p-3 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-teal-550 hover:bg-teal-450 border border-teal-605 text-slate-905 p-3 rounded-xl transition cursor-pointer font-black"
                >
                  Initiate Production Run
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
