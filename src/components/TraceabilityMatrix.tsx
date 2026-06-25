import React, { useState, useEffect } from 'react';
import { TestResult } from '../types';
import { 
  FileCheck, 
  Play, 
  Loader2, 
  CheckCircle2, 
  XOctagon, 
  ChevronDown, 
  ChevronUp, 
  RotateCcw,
  BookOpen,
  Check,
  ShieldAlert,
  Search,
  MapPin,
  ShoppingBag,
  Truck,
  AlertTriangle,
  User,
  Activity,
  Archive,
  Ban,
  ShieldCheck,
  Phone,
  Mail,
  Home
} from 'lucide-react';

interface TraceabilityMatrixProps {
  triggerRefresh: () => void;
}

export default function TraceabilityMatrix({ triggerRefresh }: TraceabilityMatrixProps) {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [expandedTest, setExpandedTest] = useState<string | null>(null);

  // Safety Recall specific states
  const [activeSubTab, setActiveSubTab] = useState<'tests' | 'recall'>('tests');
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [recallData, setRecallData] = useState<any | null>(null);
  const [isLoadingRecall, setIsLoadingRecall] = useState(false);
  const [isQuarantining, setIsQuarantining] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Live Requirements Matrix lists matching exact FR codes
  const requirements = [
    { code: 'FR-LED-01', rule: 'BR-001', name: 'Immutable Ledger Checks', desc: 'No ledger entry may be modified or deleted. PUT/DELETE fails with 405.' },
    { code: 'FR-LED-04', rule: 'BR-002', name: 'No Negative Stock constraint', desc: 'Transactions that result in negative stock are rejected.' },
    { code: 'FR-PICK-02', rule: 'BR-003', name: 'FEFO picking routing', desc: 'System automatically selectors batch with earliest expiry date.' },
    { code: 'NFR-03', rule: 'BR-004', name: 'Temperature zone enforce', desc: 'Mismatched cold categories vs dry racks are blocked.' },
    { code: 'FR-GR-02', rule: 'BR-005', name: 'Expiry mandatory on receipts', desc: 'Every goods-receipt batch requires clear future expiration.' },
    { code: 'FR-TRF-03', rule: 'BR-006', name: 'Atomic Transfer Transactions', desc: 'Both transfers out/in committed or rolled back intact.' },
    { code: 'FR-GR-01', rule: 'BR-010', name: 'PO-Backed receipts only', desc: 'Receipt lines requires open, outstanding PO references.' },
    { code: 'FR-GR-05', rule: 'BR-011', name: 'Over-receipting blocks', desc: 'Standard receivers are blocked from saving higher counts than ordered.' },
    { code: 'FR-GR-03', rule: 'BR-012', name: 'Rejected Quarantine shelf', desc: 'Damaged or rejected cargo kept off pickable available stock.' },
    { code: 'FR-TRF-02', rule: 'BR-020', name: 'Inter-depot approvals', desc: 'Site moves await active ops_manager co-signing before ledger write.' },
    { code: 'FR-TRF-04', rule: 'BR-021', name: 'Transfer References Batch', desc: 'Movements are locked to specific batch trace IDs.' },
    { code: 'FR-PICK-01', rule: 'BR-030', name: 'One active Pick per Order', desc: 'Duplicate pick list creations are rejected.' },
    { code: 'FR-PICK-04', rule: 'BR-031', name: 'Short pick reason codes', desc: 'If picked qty is lower, short pick code is mandatory.' },
    { code: 'FR-PICK-06', rule: 'BR-032', name: 'Completed lists lock', desc: 'Once marked finished, pick list becomes read-only on floor.' },
    { code: 'FR-CC-04', rule: 'BR-040', name: 'Discrepancy threshold limits', desc: 'Cycle count variance above 5% or 1 unit goes to Manager review queue.' },
    { code: 'FR-CC-07', rule: 'BR-042', name: 'Food stock accuracy KPI', desc: 'Calculates correct accuracy index: (zero_variance / total counted).' },
    { code: 'FR-WO-03', rule: 'BR-050', name: 'Dual Write-off authorize', desc: 'Creators are prohibited from self-approving write-off slips.' },
    { code: 'FR-WO-02', rule: 'BR-051', name: 'Write-off standardized codes', desc: 'Slips require standard approved waste codes: Expired, Theft, Damage...' },
    { code: 'FR-DISP-04', rule: 'BR-060', name: 'Cold chain temp log gatepass', desc: 'Dispatch of chilled orders is blocked without recorded temp logs.' },
    { code: 'FR-DISP-04', rule: 'BR-061', name: 'Cold breach auto leak warning', desc: 'Temp out of range dispatch flags system COLD_CHAIN_BREACH event.' },
    { code: 'NFR-04', rule: 'BR-070', name: 'Server-side access rules', desc: 'Access limits evaluated in Node routers (RBAC).' },
    { code: 'NFR-04', rule: 'BR-071', name: 'Deactivated User lock-out', desc: 'Inactive accounts are blocked from gaining authentication tokens.' },
    { code: 'FR-SKU-05', rule: 'BR-080', name: 'Reorder limits alert', desc: 'SKUs below designated threshold levels flag reorder alerts.' },
  ];

  const fetchBatches = async () => {
    try {
      const res = await fetch('/api/v1/batches');
      const payload = await res.json();
      if (payload.data) {
        setBatches(payload.data);
      }
    } catch (err) {
      console.error('Error fetching batches:', err);
    }
  };

  useEffect(() => {
    fetchBatches();
  }, []);

  const handleQueryRecall = async (batchId: string) => {
    if (!batchId) {
      setRecallData(null);
      return;
    }
    setIsLoadingRecall(true);
    try {
      const res = await fetch(`/api/v1/batches/${batchId}/recall`);
      const payload = await res.json();
      if (payload.data) {
        setRecallData(payload.data);
      }
    } catch (err) {
      console.error('Error loading recall detail:', err);
    } finally {
      setIsLoadingRecall(false);
    }
  };

  const handleQuarantine = async (batchId: string, shouldQuarantine: boolean) => {
    setIsQuarantining(true);
    try {
      const endpoint = shouldQuarantine 
        ? `/api/v1/batches/${batchId}/quarantine` 
        : `/api/v1/batches/${batchId}/activate`;
        
      const res = await fetch(endpoint, { method: 'POST' });
      await res.json();
      
      // reload batches & current recall state
      await fetchBatches();
      await handleQueryRecall(batchId);
      triggerRefresh(); // Sync other dashboard widgets
    } catch (err) {
      console.error('Error modifying quarantine status:', err);
    } finally {
      setIsQuarantining(false);
    }
  };

  const handleRunTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    try {
      const res = await fetch('/api/v1/tests/run', { method: 'POST' });
      const payload = await res.json();
      if (payload.data) {
        setTestResults(payload.data);
        triggerRefresh(); // reload database stock snapshots
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsRunning(false);
    }
  };

  const getTestStatus = (ruleCode: string) => {
    const matchingTest = testResults.find(t => t.id === ruleCode);
    return matchingTest?.status || 'idle';
  };

  const getStatusBadge = (status: 'passed' | 'failed' | 'skipped' | 'idle') => {
    switch (status) {
      case 'passed':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">PASS</span>;
      case 'failed':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-rose-100 text-rose-800 rounded-full border border-rose-200">FAIL</span>;
      case 'skipped':
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-700 rounded-full border border-slate-200">SKIP</span>;
      default:
        return <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-100 text-slate-400 rounded-full border border-slate-200">IDLE</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Selectors */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveSubTab('tests')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'tests'
              ? 'border-indigo-600 text-indigo-600 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <BookOpen className="h-4 w-4" />
          <span>Interactive Compliance Test Suite</span>
        </button>
        <button
          onClick={() => setActiveSubTab('recall')}
          className={`px-5 py-3 text-xs font-bold uppercase tracking-wider flex items-center space-x-2 border-b-2 transition-all cursor-pointer ${
            activeSubTab === 'recall'
              ? 'border-rose-600 text-rose-600 bg-rose-50/10 font-extrabold'
              : 'border-transparent text-slate-400 hover:text-slate-600'
          }`}
        >
          <ShieldAlert className="h-4 w-4 text-rose-500 animate-pulse" />
          <span>Instant Safety Recall & Quarantine Command</span>
        </button>
      </div>

      {activeSubTab === 'tests' && (
        <div className="space-y-6">
          {/* Test Suite Control header */}
          <div className="p-5 bg-slate-900 border border-slate-950 text-white rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <BookOpen className="h-5 w-5 text-teal-400" />
                <h2 className="text-base font-bold tracking-tight">Interactive Traceability Matrix & Test Suite</h2>
              </div>
              <p className="text-xs text-slate-400">
                Check compliance status against Lumara Holdings requirements and run integrated system test plans.
              </p>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="flex items-center space-x-2 px-4 py-2 bg-teal-500 hover:bg-teal-400 disabled:bg-slate-800 text-slate-950 font-bold rounded-lg text-xs transition-all tracking-wide cursor-pointer"
            >
              {isRunning ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Simulating rule sets...</span>
                </>
              ) : (
                <>
                  <Play className="h-4.5 w-4.5" />
                  <span>Run Automated WMS Test Suite</span>
                </>
              )}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* Left Column: Traceability Checklist Matrix */}
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileCheck className="h-5 w-5 text-slate-600" />
                  <h2 className="text-sm font-bold text-slate-900">Traceability Matrix checklist</h2>
                </div>
                
                <span className="text-[10px] font-bold bg-slate-100 px-2.5 py-0.5 rounded-full text-slate-600">
                  {requirements.length} Checked rules
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="p-3">Req Code</th>
                      <th className="p-3">Rule ID</th>
                      <th className="p-3">Business Specification</th>
                      <th className="p-3 text-right">Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requirements.map((req, idx) => {
                      const status = getTestStatus(req.rule);
                      return (
                        <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="p-3 font-semibold text-indigo-700 font-mono tracking-wider">{req.code}</td>
                          <td className="p-3 font-semibold text-slate-600 font-mono">{req.rule}</td>
                          <td className="p-3 space-y-0.5">
                            <p className="font-bold text-slate-800">{req.name}</p>
                            <p className="text-[10px] text-slate-400">{req.desc}</p>
                          </td>
                          <td className="p-3 text-right">
                            {status === 'passed' ? (
                              <div className="flex items-center justify-end space-x-1.5 text-xs text-emerald-700 font-bold">
                                <Check className="h-4 w-4 shrink-0 text-emerald-600" />
                                <span>Passed</span>
                              </div>
                            ) : (
                              getStatusBadge(status)
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right Column: Console runner stream of active transactions logs */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Virtual ledger transaction logs</h2>
                {testResults.length > 0 && (
                  <button 
                    onClick={() => setTestResults([])}
                    className="text-[10px] text-slate-400 hover:text-slate-600 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" /> Reset
                  </button>
                )}
              </div>

              {testResults.length === 0 ? (
                <div className="py-24 text-center text-slate-400 space-y-2 h-full flex flex-col items-center justify-center">
                  <Loader2 className="h-8 w-8 text-slate-100 animate-spin" />
                  <p className="text-xs font-bold text-slate-700">Audit Runner Standby</p>
                  <p className="text-[11px] max-w-xxs mx-auto">Click "Run Automated WMS Test Suite" above to simulate transactions on virtual databases.</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                  {testResults.map((test) => {
                    const isExpanded = expandedTest === test.id;
                    return (
                      <div key={test.id} className="border border-slate-150 rounded-xl bg-slate-50/50 overflow-hidden text-xs">
                        <div 
                          onClick={() => setExpandedTest(isExpanded ? null : test.id)}
                          className="p-3 flex items-center justify-between pointer select-none hover:bg-slate-100/50 cursor-pointer"
                        >
                          <div className="space-y-0.5">
                            <p className="font-bold flex items-center gap-1.5 text-slate-800">
                              <span className="font-mono text-[10px] text-slate-500 bg-slate-200 px-1 rounded">{test.id}</span>
                              <span>{test.name}</span>
                            </p>
                            <p className="text-[10px] text-slate-400">{test.module}</p>
                          </div>
                          <div className="flex items-center space-x-2">
                            {test.status === 'passed' ? <CheckCircle2 className="h-4.5 w-4.5 text-emerald-600" /> : <XOctagon className="h-4.5 w-4.5 text-rose-600" />}
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-450" /> : <ChevronDown className="h-4 w-4 text-slate-450" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-150 bg-slate-900 text-slate-350 p-3 font-mono text-[9px] space-y-1.5 leading-normal">
                            <p className="text-teal-400 font-bold border-b border-slate-850 pb-1 uppercase tracking-widest text-[8px]">Simulation console telemetry</p>
                            {test.logs?.map((log, lIdx) => (
                              <p key={lIdx} className="text-slate-300">• {log}</p>
                            ))}
                            {test.error && (
                              <p className="text-rose-400 font-bold bg-rose-950/45 p-1 rounded">ERROR: {test.error}</p>
                            )}
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
      )}

      {activeSubTab === 'recall' && (
        <div className="space-y-6">
          {/* Recall Hub Informational Jumbotron */}
          <div className="p-5 bg-rose-950 border border-rose-900 text-rose-50 rounded-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 animate-fadeIn">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <ShieldAlert className="h-5 w-5 text-rose-400 animate-pulse" />
                <h2 className="text-base font-bold tracking-tight text-white">Emergency Safety Recall & Quarantine Centre</h2>
              </div>
              <p className="text-xs text-rose-200 leading-relaxed">
                Instantly trace suspect batches, locate current warehouse storage racks, and isolate affected customer deliveries for immediate containment.
              </p>
            </div>
            <div className="text-[10px] font-mono bg-rose-900/60 border border-rose-800 text-rose-305 px-3 py-1.5 rounded-md font-bold uppercase tracking-wider shrink-0">
              🚨 Ops Command Active
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
            {/* Left Column: Batch Selector Index */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit">
              <div className="border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Archive className="h-4 w-4 text-slate-500" />
                  Traceable Batch Stock Index
                </h3>
                <p className="text-xxs text-slate-400 mt-0.5">Select a batch number to view its quarantine status and downstream footprint.</p>
              </div>

              {/* Batch Search input */}
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400 pointer-events-none">
                  <Search className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Query barcode or batch ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-1 focus:ring-rose-500 rounded-lg pl-9 pr-4 py-2 text-xs"
                />
              </div>

              {/* Batches list */}
              <div className="space-y-2 max-h-[440px] overflow-y-auto pr-1">
                {batches
                  .filter(b => {
                    if (!searchQuery) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      b.id.toLowerCase().includes(query) ||
                      b.batch_number.toLowerCase().includes(query) ||
                      b.sku_name.toLowerCase().includes(query) ||
                      b.sku_code.toLowerCase().includes(query)
                    );
                  })
                  .map((b) => {
                    const isSelected = selectedBatchId === b.id;
                    return (
                      <div
                        key={b.id}
                        onClick={() => {
                          setSelectedBatchId(b.id);
                          handleQueryRecall(b.id);
                        }}
                        className={`p-3 rounded-xl border transition-all cursor-pointer text-xs space-y-2 select-none ${
                          isSelected
                            ? 'bg-rose-50/50 border-rose-200 ring-1 ring-rose-500/20'
                            : 'bg-white border-slate-150 hover:bg-slate-55'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-bold text-slate-900 font-mono text-[11px] uppercase">{b.batch_number}</p>
                            <p className="text-[10px] text-indigo-700 font-mono mt-0.5 font-bold">SKU: {b.sku_code}</p>
                          </div>
                          
                          {b.status === 'quarantine' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-105 text-rose-700 border border-rose-200 animate-pulse">
                              🚫 QUARANTINE
                            </span>
                          ) : b.status === 'depleted' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-slate-100 text-slate-500">
                              DEPLETED
                            </span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                              ACTIVE
                            </span>
                          )}
                        </div>

                        <p className="text-[11px] font-semibold text-slate-700 line-clamp-1">{b.sku_name}</p>

                        <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1.5 border-t border-slate-100">
                          <span>Expiry: <strong className="text-slate-600 font-bold">{b.expiry_date.slice(0, 10)}</strong></span>
                          <span>Stock: <strong className="text-slate-800 font-bold">{b.qty_available_calculated} {b.sku_unit}</strong></span>
                        </div>
                      </div>
                    );
                  })}
                {batches.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs italic">No batches found</div>
                )}
              </div>
            </div>

            {/* Right Column (Col-span 2) Recall Data Panel & Action Center */}
            <div className="lg:col-span-2 space-y-6">
              {isLoadingRecall ? (
                <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center space-y-3 h-full">
                  <Loader2 className="h-10 w-10 text-rose-500 animate-spin" />
                  <p className="text-xs font-bold text-slate-700 uppercase tracking-widest animate-pulse">Tracing Batch Distribution...</p>
                  <p className="text-[11px] text-slate-450 max-w-xxs text-center">Scanning cycle logs, raw material goods receipts, shelf locations, and pick lines.</p>
                </div>
              ) : !recallData ? (
                <div className="bg-white border border-slate-200 rounded-xl p-16 flex flex-col items-center justify-center text-center space-y-3 h-full">
                  <ShieldAlert className="h-12 w-12 text-slate-200 animate-pulse" />
                  <h4 className="text-xs font-bold text-slate-850 uppercase tracking-wide">No Batch Selected</h4>
                  <p className="text-[11px] text-slate-400 max-w-sm leading-relaxed">
                    Select a suspect batch number from the index on the left. The system will perform real-time tree-trace scans across all active orders and location ledgers.
                  </p>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Selected Batch Metrics & Active Isolation Panel */}
                  <div className={`p-5 rounded-xl border text-xs transition-all duration-300 ${
                    recallData.batch.status === 'quarantine' 
                      ? 'bg-rose-50/10 border-rose-200 shadow-sm shadow-rose-50'
                      : 'bg-white border-slate-200'
                  }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center space-x-2">
                          <span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-indigo-100 text-indigo-800 rounded">
                            {recallData.batch.id}
                          </span>
                          <span className="font-mono text-xs font-black text-slate-900 uppercase">
                            Batch: {recallData.batch.batch_number}
                          </span>
                          {recallData.batch.status === 'quarantine' ? (
                            <span className="px-2.5 py-0.5 rounded text-[9px] font-extrabold font-mono uppercase bg-rose-200 text-rose-800 border border-rose-300 animate-pulse flex items-center gap-1">
                              <Ban className="h-3 w-3 shrink-0" />
                              Quarantined
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded text-[9px] font-bold font-mono uppercase bg-emerald-100 text-emerald-800 border border-emerald-250 flex items-center gap-1">
                              <ShieldCheck className="h-3 w-3 shrink-0" />
                              Fully Approved
                            </span>
                          )}
                        </div>

                        <h2 className="text-sm font-extrabold text-slate-900">{recallData.batch.sku_name}</h2>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-1.5 text-[10px] text-slate-400 font-mono">
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">SKU Code</span>
                            <span className="text-slate-805 font-bold">{recallData.batch.sku_code}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">Expiry Date</span>
                            <span className="text-slate-800 font-bold">{recallData.batch.expiry_date.slice(0, 10)}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">Received Qty</span>
                            <span className="text-slate-805 font-bold">{recallData.batch.quantity_received} {recallData.batch.sku_unit}</span>
                          </div>
                          <div>
                            <span className="block text-[9px] text-slate-400 uppercase">Current Stock</span>
                            <span className="text-slate-850 font-bold">{recallData.batch.quantity_available} {recallData.batch.sku_unit}</span>
                          </div>
                        </div>
                      </div>

                      {/* Quarantine Isolation Trigger */}
                      <div className="shrink-0">
                        {recallData.batch.status === 'quarantine' ? (
                          <button
                            type="button"
                            onClick={() => handleQuarantine(recallData.batch.id, false)}
                            disabled={isQuarantining}
                            className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold text-white rounded-lg text-xs shadow-sm shadow-emerald-50 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isQuarantining ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4 text-emerald-100" />
                            )}
                            <span>De-quarantine & Re-Verify</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleQuarantine(recallData.batch.id, true)}
                            disabled={isQuarantining}
                            className="w-full md:w-auto flex items-center justify-center space-x-1.5 px-3.5 py-2.5 bg-rose-600 hover:bg-rose-500 font-bold text-white rounded-lg text-xs shadow-sm shadow-rose-100 cursor-pointer transition-all active:scale-95 disabled:opacity-50"
                          >
                            {isQuarantining ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Ban className="h-4 w-4 text-rose-100" />
                            )}
                            <span>Lockdown Entire Batch & Quarantine</span>
                          </button>
                        )}
                        <p className="text-[9px] text-slate-400 font-mono mt-1 text-center md:text-right font-medium">Controlled Ops action (ISO 22000)</p>
                      </div>
                    </div>
                  </div>

                  {/* Upstream Traceability completion panel (Walmart-style trace) */}
                  <div className="bg-slate-50 border border-slate-205 rounded-xl p-4 space-y-3 shadow-3xs animate-fadeIn">
                    <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-indigo-600 animate-ping" />
                      Upstream Traceability Chain (Origin Audit Ledger)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs">
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Supplier Partner</span>
                        <span className="font-extrabold text-slate-800 block truncate">{recallData.batch.supplier_name || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Supplier Contact</span>
                        <span className="font-extrabold text-indigo-705 block truncate">{recallData.batch.supplier_phone || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">PO Reference</span>
                        <span className="font-extrabold text-slate-800 block truncate font-mono">{recallData.batch.po_id || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Incoming GRN</span>
                        <span className="font-extrabold text-slate-800 block truncate font-mono">{recallData.batch.grn_number || 'N/A'}</span>
                      </div>
                      <div className="p-2.5 bg-white border border-slate-150 rounded-lg">
                        <span className="text-[9px] uppercase font-bold text-slate-400 block font-sans">Received Date</span>
                        <span className="font-extrabold text-slate-850 block truncate font-mono">
                          {recallData.batch.received_date ? new Date(recallData.batch.received_date).toLocaleDateString() : 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Dual Grid: Current Storage Footprint vs. Client hazard delivery warnings */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Footprint: Current Storage Locations to Quarantine */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <MapPin className="h-4 w-4 text-slate-500" />
                          Storage Containment ({recallData.storage_locations.length})
                        </h4>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600">
                          {recallData.storage_locations.reduce((sum: number, l: any) => sum + l.qty, 0)} {recallData.batch.sku_unit}s Remain
                        </span>
                      </div>

                      {recallData.storage_locations.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 italic text-[11px] space-y-1 bg-slate-50 rounded-xl border border-dashed border-slate-150">
                          <p>✓ Zero storage footprint remaining in facilities.</p>
                          <p className="text-[9px] text-slate-400 uppercase font-mono">Stock has been fully dispatched or depleted.</p>
                        </div>
                      ) : (
                        <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                          <div className="p-3 bg-amber-50 border border-amber-100 rounded-lg text-[10px] text-amber-900 font-medium space-y-0.5">
                            <p className="font-bold flex items-center gap-1 text-amber-950">
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 animate-pulse" />
                              Physical Quarantine Seal Required
                            </p>
                            <p className="text-amber-800 text-[10px] leading-relaxed">
                              Send warehouse staff with high-contrast labels to secure the shelves below. No items can be checked out or moved.
                            </p>
                          </div>

                          {recallData.storage_locations.map((loc: any, idx: number) => (
                            <div key={idx} className="p-3 border border-slate-150 rounded-lg flex items-center justify-between text-xs hover:bg-slate-50 transition-colors">
                              <div className="space-y-1">
                                <div className="flex items-center space-x-1.5">
                                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-extrabold text-[10px] font-mono">
                                    {loc.id || loc.id_calculated || loc.warehouse_id}
                                  </span>
                                  <span className="font-bold text-slate-905 font-mono text-[11px] uppercase tracking-wide">
                                    {loc.code}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-400 font-medium leading-none">
                                  {loc.zone_name} • {loc.shelf_info}
                                </p>
                              </div>

                              <div className="text-right shrink-0">
                                <p className="font-mono text-slate-905 font-black text-xs">{loc.qty} {recallData.batch.sku_unit}</p>
                                <span className={`text-[8px] font-mono px-1 border rounded font-semibold tracking-wider uppercase ${
                                  recallData.batch.status === 'quarantine'
                                    ? 'bg-rose-100 text-rose-700 border-rose-200 font-extrabold animate-pulse'
                                    : 'bg-amber-50 text-amber-700 border-amber-200'
                                }`}>
                                  {recallData.batch.status === 'quarantine' ? '🛑 SEALED' : '⚠️ TO LOCK'}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Affected Customers and Deliveries Tracker */}
                    <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
                      <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
                        <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                          <ShoppingBag className="h-4 w-4 text-slate-500" />
                          Affected Customer Orders ({recallData.affected_orders.length})
                        </h4>
                        <span className="text-[10px] font-mono font-bold bg-slate-100 px-2 py-0.5 rounded text-slate-600 font-mono">
                          {recallData.affected_orders.reduce((sum: number, o: any) => sum + o.qty_affected, 0)} {recallData.batch.sku_unit}s Affected
                        </span>
                      </div>

                      {recallData.affected_orders.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 italic text-[11px] space-y-1 bg-slate-50 rounded-xl border border-dashed border-slate-150">
                          <p>✓ No customer deliveries found containing this batch.</p>
                          <p className="text-[9px] text-emerald-650 uppercase font-semibold font-mono">Zero downstream hazard exposure</p>
                        </div>
                      ) : (
                        <div className="space-y-3 max-h-[340px] overflow-y-auto pr-1">
                          {recallData.affected_orders.map((o: any, idx: number) => {
                            const isShipped = o.status === 'dispatched' || o.status === 'delivered';
                            return (
                              <div key={idx} className={`p-3 border rounded-xl space-y-2.5 transition-all duration-200 ${
                                isShipped 
                                  ? 'border-rose-200 bg-rose-50/15 shadow-xxs' 
                                  : 'border-amber-200 bg-amber-50/10'
                              }`}>
                                <div className="flex items-start justify-between">
                                  <div>
                                    <div className="flex items-center space-x-1.5">
                                      <span className="font-mono text-[11px] font-bold text-slate-900">{o.order_id}</span>
                                      <span className="text-[10px] text-slate-400 font-mono font-semibold">({o.qty_affected} {recallData.batch.sku_unit}s)</span>
                                    </div>
                                    <p className="text-xs font-extrabold text-slate-800 leading-none mt-1">{o.customer_name}</p>
                                  </div>

                                  <div className="text-right">
                                    <span className={`px-1.5 py-0.5 rounded text-[8px] font-bold font-mono uppercase border tracking-wider ${
                                      o.status === 'delivered'
                                        ? 'bg-rose-100 text-rose-700 border-rose-200 shadow-xxs animate-pulse'
                                        : o.status === 'dispatched'
                                        ? 'bg-red-50 text-red-700 border-red-200'
                                        : 'bg-amber-100 text-amber-700 border-amber-200'
                                    }`}>
                                      {o.status}
                                    </span>
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-100 mt-2 space-y-1 text-[10px] text-slate-400 font-mono leading-tight animate-fadeIn">
                                  <p className="flex items-start gap-1">
                                    <Home className="h-3 w-3 shrink-0 text-slate-405 mt-0.5" />
                                    <span>Deliver to: <strong className="text-slate-600 font-bold">{o.delivery_address}</strong></span>
                                  </p>
                                  {isShipped ? (
                                    <div className="p-2 mt-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-950 font-bold leading-relaxed tracking-tight space-y-1 text-[9px]">
                                      <div className="flex items-center gap-1 text-rose-800">
                                        <Truck className="h-3.5 w-3.5 animate-bounce" />
                                        <span>HAZARD TRIGGER: SUSPECT BATCH OUT OF WAREHOUSE</span>
                                      </div>
                                      <p className="font-sans font-normal text-rose-700 text-[10px] leading-tight mb-2">
                                        Suspect stock has been shipped. Initiate active recall protocol immediately. Customer details:
                                      </p>
                                      <div className="flex flex-col gap-0.5 pt-1.5 font-mono font-bold text-rose-800 border-t border-rose-100">
                                        <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-rose-500" /> Tel: {o.customer_phone || 'N/A'}</span>
                                        <span className="flex items-center gap-1"><Mail className="h-3 w-3 text-rose-500" /> Email: {o.customer_email || 'N/A'}</span>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="p-2 mt-2 rounded bg-amber-50 border border-amber-100 text-amber-900 font-bold text-[9px] tracking-tight flex items-center gap-1">
                                      <Ban className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                      <span>WAREHOUSE LOCKDOWN: HALT PACKING / LOADING!</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
