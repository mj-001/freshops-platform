import React, { useEffect, useState } from 'react';
import { PurchaseOrder, SKU, Location, GoodsReceipt as GRType, User } from '../types';
import { 
  ClipboardCheck, 
  Plus, 
  Calendar, 
  FileText, 
  PackageMinus, 
  Truck, 
  CheckCircle2, 
  AlertOctagon,
  AlertTriangle,
  Printer,
  ChevronRight,
  ShieldCheck,
  Scan,
  Search
} from 'lucide-react';
import BarcodeInput from './BarcodeInput';
import { procurementToBase, conversionSummary, displayQty } from '../utils/uom';

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

// Barcode component for scannable vector barcodes
const Barcode = ({ value }: { value: string }) => {
  // Deterministic mapping to turn character values into clean physical code-39 barcodes
  const charPatterns: { [key: string]: string } = {
    '0': '101001101101', '1': '110100101011', '2': '100110101011', '3': '110011010101',
    '4': '101100101011', '5': '110110010101', '6': '100110010101', '7': '101001101011',
    '8': '110100110101', '9': '100110011010', 'A': '110102010211', 'B': '120110201021',
    'C': '110201102010', 'D': '101102020102', 'E': '110110202010', 'F': '100110202010',
    'G': '101002110202', 'H': '110100211020', 'I': '100110021102', 'J': '101100211020',
    '-': '101001101101', ' ': '102002010101', '$': '100100100101', '/': '100101001001'
  };

  const getPattern = (char: string) => {
    const c = char.toUpperCase();
    return charPatterns[c] || '101100110101';
  };

  let bars = '101101101'; // start guard
  for (let i = 0; i < value.length; i++) {
    bars += getPattern(value[i]) + '0';
  }
  bars += '101101101'; // stop guard

  return (
    <svg viewBox={`0 0 ${bars.length * 2} 40`} className="w-full h-12" shapeRendering="crispEdges">
      <g fill="#000000">
        {bars.split('').map((bit, idx) => {
          if (bit === '1') {
            return <rect key={idx} x={idx * 2} y={0} width={2} height={40} />;
          }
          return null;
        })}
      </g>
    </svg>
  );
};

interface GoodsReceiptProps {
  locations: Location[];
  skus: SKU[];
  currentUser: User | null;
  triggerRefresh: () => void;
}

export default function GoodsReceipt({ locations, skus, currentUser, triggerRefresh }: GoodsReceiptProps) {
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [selectedPo, setSelectedPo] = useState<any | null>(null);
  const [receivingLines, setReceivingLines] = useState<any[]>([]);
  const [notes, setNotes] = useState('');
  const [overrideOverReceipt, setOverrideOverReceipt] = useState(false);
  const [grnResult, setGrnResult] = useState<any | null>(null);
  const [isScanOpen, setIsScanOpen] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');

  // Extended states for past Goods Receipts and Barcode printing
  const [goodsReceipts, setGoodsReceipts] = useState<any[]>([]);
  const [sidebarTab, setSidebarTab] = useState<'pos' | 'grns'>('pos');
  const [selectedGrnLines, setSelectedGrnLines] = useState<string[]>([]);
  const [isPrintPreviewOpen, setIsPrintPreviewOpen] = useState(false);
  const [labelCopies, setLabelCopies] = useState<number>(1);

  const SUPPLIERS_MAP: { [key: string]: string } = {
    'S-KENCHIC': 'Kenchic Poultry Ltd',
    'S-NAIROBI-GREENS': 'Nairobi Fresh Produce Co.',
    'S-DRYPACK': 'Drypack Millers Ltd'
  };

  const query = searchQuery.toLowerCase().trim();

  const filteredPurchaseOrders = purchaseOrders.filter(po => {
    if (!query) return true;
    const matchBasic = 
      po.id.toLowerCase().includes(query) || 
      (po.supplier_id && po.supplier_id.toLowerCase().includes(query)) ||
      (po.supplier_name && po.supplier_name.toLowerCase().includes(query));
    if (matchBasic) return true;

    if (po.lines && po.lines.length > 0) {
      return po.lines.some((l: any) => {
        const skuInfo = skus.find(s => s.id === l.sku_id);
        const skuName = skuInfo?.name || l.sku_name || '';
        return (
          l.sku_id.toLowerCase().includes(query) ||
          skuName.toLowerCase().includes(query)
        );
      });
    }
    return false;
  });

  const filteredGoodsReceipts = goodsReceipts.filter(gr => {
    if (!query) return true;
    const matchBasic = 
      gr.id.toLowerCase().includes(query) || 
      (gr.grn_number && gr.grn_number.toLowerCase().includes(query)) ||
      (gr.po_id && gr.po_id.toLowerCase().includes(query)) ||
      (gr.notes && gr.notes.toLowerCase().includes(query));
    return matchBasic;
  });

  const filteredReceivingLines = receivingLines.filter(line => {
    if (!query) return true;
    const skuInfo = skus.find(s => s.id === line.sku_id);
    const skuName = skuInfo?.name || line.sku_name || '';
    const supplierId = skuInfo?.supplier_id || '';
    const supplierName = SUPPLIERS_MAP[supplierId] || '';
    
    const matchBatch = 
      (line.batch_number && line.batch_number.toLowerCase().includes(query)) ||
      (line.batch_id && line.batch_id.toLowerCase().includes(query));

    return (
      line.sku_id.toLowerCase().includes(query) ||
      skuName.toLowerCase().includes(query) ||
      supplierId.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      matchBatch
    );
  });

  const filteredGrnLines = grnResult?.lines?.filter((line: any) => {
    if (!query) return true;
    const skuInfo = skus.find(s => s.id === line.sku_id);
    const skuName = skuInfo?.name || line.sku_name || '';
    const supplierId = skuInfo?.supplier_id || '';
    const supplierName = SUPPLIERS_MAP[supplierId] || '';
    
    const matchBatch = 
      (line.batch_id && line.batch_id.toLowerCase().includes(query)) ||
      (line.batch_number && line.batch_number.toLowerCase().includes(query));

    return (
      line.sku_id.toLowerCase().includes(query) ||
      skuName.toLowerCase().includes(query) ||
      supplierId.toLowerCase().includes(query) ||
      supplierName.toLowerCase().includes(query) ||
      matchBatch
    );
  });

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
    setPutAwayWarnings(null);
    
    // 1. Scanned PO
    if (scanned.type === 'po') {
      const foundPo = purchaseOrders.find(po => po.id === scanned.code);
      if (foundPo) {
        handleSelectPO(foundPo);
        setSuccessMessage(`Scanned Purchase Order: ${scanned.code} loaded for receiving.`);
      } else {
        setErrorMessage(`Purchase Order ${scanned.code} not found in pending POs.`);
      }
    }
    // 2. Scanned SKU
    else if (scanned.type === 'sku') {
      if (selectedPo) {
        let matched = false;
        const updatedLines = receivingLines.map(l => {
          if (l.sku_id === scanned.code) {
            matched = true;
            return {
              ...l,
              qty_received: (parseFloat(l.qty_received) || 0) + 1
            };
          }
          return l;
        });
        if (matched) {
          setReceivingLines(updatedLines);
          setSuccessMessage(`Verified SKU: ${scanned.item?.name || scanned.code}. Quantity incremented.`);
        } else {
          setErrorMessage(`SKU ${scanned.item?.name || scanned.code} is not a line item in active PO ${selectedPo.id}.`);
        }
      } else {
        // Find if any pending PO has this SKU
        const containingPo = purchaseOrders.find(po => {
          // If po lines already fetched, or has some details
          return po.id; // Just a simple match or select the first pending PO
        });
        
        // Let's find first PO or suggest selecting/scanning PO first
        if (purchaseOrders.length > 0) {
          handleSelectPO(purchaseOrders[0]);
          setSuccessMessage(`SKU Scanned. Initialized PO reception for ${purchaseOrders[0].id}.`);
        } else {
          setErrorMessage(`No selected PO reception slip, and could not associate SKU with any open POs.`);
        }
      }
    }
    // 3. Scanned Location
    else if (scanned.type === 'location') {
      if (selectedPo && receivingLines.length > 0) {
        // Assign location to the first good-condition receiving line
        const updatedLines = receivingLines.map((l, index) => {
          if (index === 0) {
            return {
              ...l,
              put_away_location_id: scanned.code
            };
          }
          return l;
        });
        setReceivingLines(updatedLines);
        setSuccessMessage(`Bin Location ${scanned.code} assigned to put-away line.`);
      } else {
        setErrorMessage(`Scanned Location "${scanned.code}" requires an active PO receiving session.`);
      }
    }
  };
  
  // Custom PO Form
  const [isCreatingPo, setIsCreatingPo] = useState(false);
  const [poSupplier, setPoSupplier] = useState('S-KENCHIC');
  const [poWarehouse, setPoWarehouse] = useState('RGN');
  const [poLines, setPoLines] = useState<any[]>([{ sku_id: 'SKU-MILK', qty_ordered: 50, unit_cost_kes: 7000 }]);

  // Errors state
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [putAwayWarnings, setPutAwayWarnings] = useState<string[] | null>(null);

  useEffect(() => {
    fetchPOs();
    fetchGoodsReceipts();
  }, []);

  useEffect(() => {
    if (grnResult?.lines) {
      setSelectedGrnLines(grnResult.lines.map((l: any) => l.id));
    } else {
      setSelectedGrnLines([]);
    }
  }, [grnResult]);

  const fetchPOs = async () => {
    try {
      const res = await fetch('/api/v1/purchase-orders');
      const payload = await res.json();
      if (payload.data) {
        setPurchaseOrders(payload.data);
      }
    } catch (err) {
      console.error('Error fetching POs:', err);
    }
  };

  const fetchGoodsReceipts = async () => {
    try {
      const res = await fetch('/api/v1/goods-receipts');
      const payload = await res.json();
      if (payload.data) {
        setGoodsReceipts(payload.data);
      }
    } catch (err) {
      console.error('Error fetching GRNs:', err);
    }
  };

  const handleSelectGRN = async (gr: any) => {
    try {
      const res = await fetch(`/api/v1/goods-receipts/${gr.id}`);
      const payload = await res.json();
      if (payload.data) {
        setGrnResult(payload.data);
        setSelectedPo(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        setPutAwayWarnings(null);
      }
    } catch (err) {
      console.error('Error fetching GRN details:', err);
    }
  };

  const handleSelectPO = async (po: any) => {
    try {
      const res = await fetch(`/api/v1/purchase-orders/${po.id}`);
      const payload = await res.json();
      if (payload.data) {
        setSelectedPo(payload.data);
        setGrnResult(null);
        setErrorMessage(null);
        setSuccessMessage(null);
        setPutAwayWarnings(null);
        setOverrideOverReceipt(false);
        // Map lines for receiving initial values
        const linesMap = payload.data.lines.map((l: any) => {
          const sku = skus.find(s => s.id === l.sku_id);
          // Suggest location based on sku temp zone
          let suggestedLoc = '';
          if (sku?.temp_zone === 'chilled') suggestedLoc = 'L-RGN-CHL-01';
          else if (sku?.temp_zone === 'frozen') suggestedLoc = 'L-RGN-FRZ-01';
          else if (sku?.temp_zone === 'cool') suggestedLoc = 'L-RGN-COOL-01';
          else suggestedLoc = 'L-RGN-AMB-01';

          // Set custom future default expiry date based on shelf life
          const defaultExpiry = new Date(Date.now() + (sku?.shelf_life_days || 3) * 24 * 3600 * 1000).toISOString().slice(0, 10);

          const qtyToRec = l.qty_ordered - l.qty_received;
          const pQty = sku?.procurement_unit_qty || 1;
          const full = Math.floor(qtyToRec / pQty);
          const rem = qtyToRec % pQty;

          return {
            po_line_id: l.id,
            sku_id: l.sku_id,
            sku_name: l.sku_name,
            qty_ordered: l.qty_ordered,
            qty_received_already: l.qty_received,
            qty_received: qtyToRec, // outstanding
            fullUnits: full,
            remainderUnits: rem,
            expiry_date: defaultExpiry,
            condition: 'good',
            put_away_location_id: suggestedLoc,
            batch_number: `BAT-${Date.now().toString().slice(-4)}-${sku?.code.split('-')[1]}`
          };
        });
        setReceivingLines(linesMap);
      }
    } catch (err) {
      console.error('Error fetching PO lines details:', err);
    }
  };

  const handleSaveReceipt = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setPutAwayWarnings(null);

    // Basic validation
    if (receivingLines.some(l => !l.expiry_date)) {
      setErrorMessage("Expiry Date is strictly mandatory for fresh foods safety tracing (BR-005)");
      return;
    }

    const payload = {
      notes,
      override_over_receipt: overrideOverReceipt,
      lines: receivingLines.map(l => ({
        po_line_id: l.po_line_id,
        qty_received: parseFloat(l.qty_received),
        expiry_date: new Date(l.expiry_date).toISOString(),
        condition: l.condition,
        put_away_location_id: l.condition === 'good' ? l.put_away_location_id : undefined,
        batch_number: l.batch_number
      }))
    };

    try {
      const res = await fetch(`/api/v1/purchase-orders/${selectedPo.id}/receive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.error) {
        setErrorMessage(data.error.message || 'Validation error');
      } else {
        setSuccessMessage(`GRN Generated successfully! Document code: ${data.data.grn_number}`);
        if (data.warnings && data.warnings.length > 0) {
          setPutAwayWarnings(data.warnings);
        }
        setGrnResult(data.data);
        setSelectedPo(null);
        setNotes('');
        fetchPOs();
        fetchGoodsReceipts();
        triggerRefresh();
      }
    } catch (err) {
      console.error('Error receiving goods po:', err);
      setErrorMessage('Server connection failure.');
    }
  };

  const handleCreatePo = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setPutAwayWarnings(null);

    try {
      const res = await fetch('/api/v1/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier_id: poSupplier,
          warehouse_id: poWarehouse,
          lines: poLines
        })
      });
      const data = await res.json();
      if (data.data) {
        setSuccessMessage(`Purchase Order ${data.data.id} dispatched to supplier successfully!`);
        setIsCreatingPo(false);
        fetchPOs();
        setPoLines([{ sku_id: 'SKU-MILK', qty_ordered: 50, unit_cost_kes: 7000 }]);
      } else {
        setErrorMessage(data.error?.message || 'Error creating PO');
      }
    } catch (err) {
      console.error('Error creating PO:', err);
    }
  };

  const addPoLine = () => {
    setPoLines([...poLines, { sku_id: 'SKU-MILK', qty_ordered: 50, unit_cost_kes: 7000 }]);
  };

  const removePoLine = (idx: number) => {
    setPoLines(poLines.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {errorMessage && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <AlertOctagon className="h-5 w-5 text-rose-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Execution Blocked</p>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <div className="space-y-1">
            <p className="font-bold">Transaction Confirmed</p>
            <p>{successMessage}</p>
          </div>
        </div>
      )}

      {putAwayWarnings && putAwayWarnings.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-250 rounded-xl text-amber-900 text-xs flex items-start space-x-2 animate-fadeIn">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 w-full">
            <p className="font-bold text-amber-950">Put-Away Zoning Alert</p>
            <ul className="list-disc pl-4 space-y-1 leading-relaxed text-amber-850">
              {putAwayWarnings.map((warn, idx) => (
                <li key={idx}>{warn}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Purchase Orders List */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <ClipboardCheck className="h-5 w-5 text-slate-600" />
              <h2 className="text-sm font-bold text-slate-900">Purchase Orders (POs)</h2>
            </div>
            
            <div className="flex items-center space-x-1.5">
              {(currentUser?.role === 'admin' || currentUser?.role === 'ops_manager') && (
                <button
                  type="button"
                  onClick={() => setIsCreatingPo(!isCreatingPo)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 text-xs bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-medium transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Issue PO</span>
                </button>
              )}
            </div>
          </div>

          <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl p-3.5 space-y-1.5">
            <p className="text-[10px] font-bold text-indigo-800 uppercase tracking-wider font-mono">Barcode Receiving Terminal</p>
            <BarcodeInput 
              onScan={handleRawBarcodeScan}
              context="goods_receipt"
              activeId={selectedPo?.id}
            />
          </div>

          {/* Segment Control Tab Selectors */}
          <div className="grid grid-cols-2 p-1 bg-slate-100/90 rounded-xl">
            <button
              type="button"
              onClick={() => {
                setSidebarTab('pos');
                setSelectedPo(null);
                setGrnResult(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                sidebarTab === 'pos'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Pending POs
            </button>
            <button
              type="button"
              onClick={() => {
                setSidebarTab('grns');
                setSelectedPo(null);
                setGrnResult(null);
              }}
              className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                sidebarTab === 'grns'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Completed GRNs
            </button>
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

          {isCreatingPo ? (
            <form onSubmit={handleCreatePo} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
              <p className="text-xs font-bold text-slate-800">Issue New Purchase Order</p>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Supplier</label>
                  <select
                    value={poSupplier}
                    onChange={(e) => setPoSupplier(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5"
                  >
                    <option value="S-KENCHIC">Kenchic Poultry Ltd</option>
                    <option value="S-NAIROBI-GREENS">Nairobi Fresh Produce Co.</option>
                    <option value="S-DRYPACK">Drypack Millers Ltd</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-500 mb-1 font-medium">Fulfillment Site</label>
                  <select
                    value={poWarehouse}
                    onChange={(e) => setPoWarehouse(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-1.5"
                  >
                    <option value="RGN">Regen Warehouse (RGN)</option>
                    <option value="RGL">Regal Plaza (RGL)</option>
                  </select>
                </div>
              </div>

              {/* Dynamic lines */}
              <div className="space-y-2 border-t border-slate-200 pt-2">
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[10px] font-bold text-slate-500 tracking-wider uppercase">Order Lines</span>
                  <button
                    type="button"
                    onClick={addPoLine}
                    className="text-[10px] text-teal-600 hover:text-teal-700 font-bold"
                  >
                    + Add Product
                  </button>
                </div>

                {poLines.map((line, idx) => (
                  <div key={idx} className="flex gap-2 items-end">
                    <div className="flex-1">
                      <select
                        value={line.sku_id}
                        onChange={(e) => {
                          const list = [...poLines];
                          list[idx].sku_id = e.target.value;
                          setPoLines(list);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs"
                      >
                        {skus.map(s => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        value={line.qty_ordered}
                        onChange={(e) => {
                          const list = [...poLines];
                          list[idx].qty_ordered = parseInt(e.target.value) || 0;
                          setPoLines(list);
                        }}
                        className="w-full bg-white border border-slate-200 rounded-lg p-1 text-xs text-center"
                        placeholder="Qty"
                      />
                    </div>
                    {poLines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removePoLine(idx)}
                        className="text-rose-500 hover:text-rose-600 text-xs p-1"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex gap-2 border-t border-slate-200 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-1 px-3 bg-emerald-600 text-white rounded-lg text-xs font-bold transition-colors text-center hover:bg-emerald-500"
                >
                  Confirm Issue
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingPo(false)}
                  className="px-3 py-1 bg-slate-200 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>          ) : sidebarTab === 'pos' ? (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredPurchaseOrders.length === 0 ? (
                <p className="text-xs text-slate-455 py-4 text-center">No POs match search query</p>
              ) : (
                filteredPurchaseOrders.map(po => (
                <div
                  key={po.id}
                  onClick={() => handleSelectPO(po)}
                  className={`p-3 border rounded-xl cursor-pointer transition-all ${
                    selectedPo?.id === po.id 
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm' 
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-800'
                  }`}
                >
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold font-mono tracking-wide">{po.id}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                      po.status === 'received' 
                        ? 'bg-emerald-100 text-emerald-800' 
                        : po.status === 'partial' 
                        ? 'bg-amber-100 text-amber-800' 
                        : 'bg-cyan-100 text-cyan-800'
                    }`}>
                      {po.status}
                    </span>
                  </div>
                  <div className="mt-2 text-xs space-y-1">
                    <p className={`font-semibold ${selectedPo?.id === po.id ? 'text-slate-200' : 'text-slate-600'}`}>
                      MFR: {po.supplier_name}
                    </p>
                    <div className="flex justify-between text-[10px]">
                      <span>Items ordered: {po.lines?.length || 0}</span>
                      <span>Target: <b className="font-bold">{po.warehouse_id}</b></span>
                    </div>
                  </div>
                </div>
              ))
            )}
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredGoodsReceipts.length === 0 ? (
                <p className="text-xs text-slate-455 py-4 text-center">No completed GRNs match search query</p>
              ) : (
                filteredGoodsReceipts.map(gr => (
                  <div
                    key={gr.id}
                    onClick={() => handleSelectGRN(gr)}
                    className={`p-3 border rounded-xl cursor-pointer transition-all ${
                      grnResult?.id === gr.id 
                        ? 'bg-indigo-950 text-white border-indigo-950 shadow-sm' 
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-100 text-slate-800'
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-bold font-mono tracking-wide">{gr.grn_number}</span>
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-emerald-50 text-emerald-800 border border-emerald-150">
                        {gr.status}
                      </span>
                    </div>
                    <div className="mt-2 text-xs space-y-1">
                      <p className={`font-semibold ${grnResult?.id === gr.id ? 'text-slate-200' : 'text-slate-600'}`}>
                        PO: {gr.po_id}
                      </p>
                      <div className="flex justify-between text-[10px]">
                        <span className={grnResult?.id === gr.id ? 'text-slate-300' : 'text-slate-400'}>
                          Site: <b className="font-bold">{gr.warehouse_id}</b>
                        </span>
                        <span className={grnResult?.id === gr.id ? 'text-slate-300' : 'text-slate-400'}>
                          {gr.received_at ? gr.received_at.slice(0, 10) : ''}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Center & Right column combined dynamically */}
        <div className="lg:col-span-2">
          {grnResult ? (
            /* Render GRN Receipts Printers slip */
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 shadow-sm animate-fadeIn">
              <div className="flex items-center justify-between border-b border-dashed border-slate-200 pb-3">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-100 text-emerald-800 uppercase tracking-widest rounded-full">
                    Completed Receipt
                  </span>
                  <p className="text-lg font-bold font-mono tracking-tight text-slate-900">{grnResult.grn_number}</p>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => {
                      if (selectedGrnLines.length === 0) {
                        setErrorMessage("Please select at least one received batch item to print.");
                        return;
                      }
                      setIsPrintPreviewOpen(true);
                    }}
                    className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-xs cursor-pointer"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Labels ({selectedGrnLines.length})</span>
                  </button>
                  
                  <button
                    onClick={() => {
                      setGrnResult(null);
                    }}
                    className="px-2.5 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="text-slate-400 font-medium">Purchase Order Ref</p>
                  <p className="font-semibold text-slate-800 font-mono">{grnResult.po_id}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Receipt Handler</p>
                  <p className="font-semibold text-slate-800">U-REC ({currentUser?.name})</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Received Date</p>
                  <p className="font-semibold text-slate-800 font-mono">{grnResult.received_at ? grnResult.received_at.slice(0, 16).replace('T', ' ') : ''} UTC</p>
                </div>
                <div>
                  <p className="text-slate-400 font-medium">Fulfillment Site</p>
                  <p className="font-semibold text-slate-800 font-mono uppercase">{grnResult.warehouse_id}</p>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-bold text-slate-900">Committed Batch Receipts</p>
                  {selectedGrnLines.length > 0 && (
                    <span className="text-[10px] text-indigo-700 font-semibold bg-indigo-50 border border-indigo-150 px-2 py-0.5 rounded-full">
                      {selectedGrnLines.length} Selected
                    </span>
                  )}
                </div>
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-100">
                      <th className="p-2 w-8">
                        <input
                          type="checkbox"
                          checked={selectedGrnLines.length === (grnResult?.lines?.length || 0)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedGrnLines(grnResult?.lines?.map((l: any) => l.id) || []);
                            } else {
                              setSelectedGrnLines([]);
                            }
                          }}
                          className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </th>
                      <th className="p-2">SKU Item</th>
                      <th className="p-2">Batch Number</th>
                      <th className="p-2 text-right">Committed Qty</th>
                      <th className="p-2">Condition</th>
                      <th className="p-2">Bin Selected</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!filteredGrnLines || filteredGrnLines.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-xs text-slate-400 font-medium font-sans">
                          No received batches match your search query.
                        </td>
                      </tr>
                    ) : (
                      filteredGrnLines.map((line: any, idx: number) => {
                        const sku = skus.find(s => s.id === line.sku_id);
                        const isChecked = selectedGrnLines.includes(line.id);
                        return (
                          <tr key={idx} className={`border-b border-slate-100 transition-colors ${isChecked ? 'bg-indigo-50/20' : ''}`}>
                            <td className="p-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedGrnLines([...selectedGrnLines, line.id]);
                                  } else {
                                    setSelectedGrnLines(selectedGrnLines.filter(id => id !== line.id));
                                  }
                                }}
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                              />
                            </td>
                            <td className="p-2 font-medium text-slate-800 flex items-center space-x-2">
                              <div className={`w-8 h-8 rounded-lg border flex items-center justify-center font-bold text-xxs shrink-0 ${getCategoryColor(sku?.category_id || '')}`}>
                                {getInitials(sku?.name || line.sku_id || '')}
                              </div>
                              <span>{sku?.name || line.sku_id}</span>
                            </td>
                            <td className="p-2 font-mono text-[10px]">{line.batch_id}</td>
                            <td className="p-2 text-right font-bold">{line.qty_received}</td>
                            <td className="p-2">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold tracking-wide ${
                                line.condition === 'good' 
                                  ? 'bg-emerald-50 text-emerald-700' 
                                  : 'bg-rose-50 text-rose-700'
                              }`}>
                                {line.condition}
                              </span>
                            </td>
                            <td className="p-2 font-bold font-mono text-[10px] text-teal-700">
                              {line.put_away_location_id || 'QUARANTINE'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-400 text-center uppercase tracking-wider mt-4">**** END OF DIGITAL RECEPT note ****</p>
            </div>
          ) : selectedPo ? (
            /* Active PO Receiving controller */
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-fadeIn">
              <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Goods In Receive Slip ({selectedPo.id})</h2>
                  <p className="text-xs text-slate-500">Log received items, batch exps, and bin put-away zones</p>
                </div>
                {/* Active user role indicator */}
                <div className="flex items-center space-x-1 border border-slate-200 rounded-full px-3 py-1 bg-slate-50">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  <span className="text-[10px] font-bold text-slate-600 tracking-wider uppercase">
                    Role: {currentUser?.role}
                  </span>
                </div>
              </div>

              <div className="space-y-4">
                {searchQuery && (
                  <div className="pb-1">
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-2.5 py-1 rounded-full uppercase tracking-wider select-none">
                      Filtered Receiving List
                    </span>
                  </div>
                )}
                {filteredReceivingLines.length === 0 ? (
                  <p className="text-xs text-slate-450 py-10 text-center bg-slate-50 border border-dashed border-slate-200 rounded-xl">No receiving items match your search query</p>
                ) : (
                  filteredReceivingLines.map((line, idx) => {
                    const skuSpec = skus.find(s => s.id === line.sku_id);
                    const orderedLine = selectedPo.lines.find((l: any) => l.id === line.po_line_id);
                    const rem = orderedLine ? (orderedLine.qty_ordered - orderedLine.qty_received) : 0;
                    
                    // Potential over-receiving check
                    const isOver = line.qty_received > rem;

                    return (
                      <div key={idx} className="p-4 bg-slate-50/60 border border-slate-100 rounded-xl flex flex-col md:flex-row items-center gap-4 text-xs">
                        {/* SKU Thumbnail Visual Confirmation */}
                        <div className={`w-16 h-16 shrink-0 rounded-lg border flex items-center justify-center font-bold text-sm uppercase tracking-wider ${getCategoryColor(skuSpec?.category_id || '')}`}>
                          {getInitials(line.sku_name || '')}
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-3 items-center w-full">
                          <div className="space-y-1">
                            <p className="font-bold text-slate-800">{line.sku_name}</p>
                            <p className="text-[10px] text-slate-400">Ordered: <b className="text-slate-600 font-mono">{orderedLine?.qty_ordered}</b> | Received: <b className="text-slate-600 font-mono">{orderedLine?.qty_received}</b></p>
                          </div>

                      {/* Qty Received Input */}
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Qty Received ({skuSpec?.procurement_unit || 'Boxes'} / {skuSpec?.remainder_unit || 'Units'})
                        </label>
                        <div className="flex gap-2">
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="number"
                              min="0"
                              value={line.fullUnits ?? 0}
                              onChange={(e) => {
                                const list = [...receivingLines];
                                const val = parseInt(e.target.value) || 0;
                                list[idx].fullUnits = val;
                                list[idx].qty_received = procurementToBase(val, list[idx].remainderUnits ?? 0, skuSpec);
                                setReceivingLines(list);
                              }}
                              className={`w-full bg-white border rounded-lg p-2 font-semibold text-xs ${
                                isOver ? 'border-rose-400 text-rose-700 bg-rose-50/20' : 'border-slate-200 text-slate-800'
                              }`}
                              placeholder={skuSpec?.procurement_unit || 'Full'}
                            />
                          </div>
                          <div className="relative flex-1 min-w-0">
                            <input
                              type="number"
                              min="0"
                              value={line.remainderUnits ?? 0}
                              onChange={(e) => {
                                const list = [...receivingLines];
                                const val = parseInt(e.target.value) || 0;
                                list[idx].remainderUnits = val;
                                list[idx].qty_received = procurementToBase(list[idx].fullUnits ?? 0, val, skuSpec);
                                setReceivingLines(list);
                              }}
                              className={`w-full bg-white border rounded-lg p-2 font-semibold text-xs ${
                                isOver ? 'border-rose-400 text-rose-700 bg-rose-50/20' : 'border-slate-200 text-slate-800'
                              }`}
                              placeholder={skuSpec?.remainder_unit || 'Rem'}
                            />
                          </div>
                          {isOver && (
                            <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping self-center shrink-0" />
                          )}
                        </div>
                        <div className="mt-1 text-[10px] text-slate-500 font-medium font-mono">
                          {conversionSummary(line.fullUnits ?? 0, line.remainderUnits ?? 0, skuSpec)}
                        </div>
                      </div>

                      {/* Expiry Date Input */}
                      <div>
                        <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                          Expiry Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          value={line.expiry_date}
                          onChange={(e) => {
                            const list = [...receivingLines];
                            list[idx].expiry_date = e.target.value;
                            setReceivingLines(list);
                          }}
                          className="w-full bg-white border border-slate-200 rounded-lg p-1.5 font-mono"
                        />
                      </div>

                      {/* Put-Away Bins / Condition */}
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">Condition</label>
                          <select
                            value={line.condition}
                            onChange={(e) => {
                              const list = [...receivingLines];
                              list[idx].condition = e.target.value;
                              setReceivingLines(list);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5"
                          >
                            <option value="good">Good</option>
                            <option value="damaged">Damaged (Quarantine)</option>
                            <option value="rejected">Rejected (Quarantine)</option>
                          </select>
                        </div>

                        <div>
                          <label className={`block text-[10px] font-bold uppercase tracking-wider mb-1 ${line.condition !== 'good' ? 'text-slate-300' : 'text-slate-400'}`}>Put Away Bin</label>
                          <select
                            value={line.put_away_location_id}
                            disabled={line.condition !== 'good'}
                            onChange={(e) => {
                              const list = [...receivingLines];
                              list[idx].put_away_location_id = e.target.value;
                              setReceivingLines(list);
                            }}
                            className="w-full bg-white border border-slate-200 rounded-lg p-1.5 text-[10px] font-mono text-teal-800 disabled:bg-slate-100 disabled:text-slate-400"
                          >
                            {locations.filter(l => l.warehouse_id === selectedPo.warehouse_id).map(l => (
                              <option key={l.id} value={l.id}>[{l.zone_id.split('-').pop()}] {l.code}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                );
                })
              )}
              </div>

              {/* Over receiving Manager Checkbox */}
              {receivingLines.some(l => {
                const poLine = selectedPo.lines.find((ol: any) => ol.id === l.po_line_id);
                return poLine && (l.qty_received > (poLine.qty_ordered - poLine.qty_received));
              }) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start space-x-3 text-xs animate-shake">
                  <AlertOctagon className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="font-bold text-amber-900">Over-Receipt Flag Detected (BR-011)</p>
                    <p className="text-amber-700 leading-relaxed">
                      You are logging a received quantity higher than the pending balance of this line. This block is enforced for receivers.
                    </p>
                    
                    {currentUser?.role === 'ops_manager' || currentUser?.role === 'admin' ? (
                      <label className="flex items-center space-x-2 font-bold text-amber-900 select-none bg-white p-2 rounded-lg border border-amber-100 pointer">
                        <input
                          type="checkbox"
                          checked={overrideOverReceipt}
                          onChange={(e) => setOverrideOverReceipt(e.target.checked)}
                          className="rounded text-amber-600 focus:ring-amber-500"
                        />
                        <span>Confirm Ops Manager over-receipt override</span>
                      </label>
                    ) : (
                      <p className="font-bold text-rose-700">Required: Delegate approval to an ops_manager accounts to continue.</p>
                    )}
                  </div>
                </div>
              )}

              {/* Comments Field & Final submit */}
              <div className="space-y-4 border-t border-slate-100 pt-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <input
                  type="text"
                  placeholder="Record reception notes/stamps..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs"
                />

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveReceipt}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                  >
                    Authorize Put-Away & GRN
                  </button>
                  <button
                    onClick={() => setSelectedPo(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Standby view */
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-slate-400 space-y-2 h-full flex flex-col items-center justify-center">
              <Truck className="h-8 w-8 text-slate-200" />
              <p className="text-sm font-bold text-slate-700">Goods Reception Desk</p>
              <p className="text-xs max-w-sm">Select an open PO from the list on the left to confirm shipping invoices, check expirations, and allocate stock into bins.</p>
            </div>
          )}
        </div>
      </div>

      {/* Label Print Preview Modal */}
      {isPrintPreviewOpen && grnResult && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-100 p-4 animate-fadeIn">
          {/* Inject style block for printing so only selected labels show up */}
          <style>{`
            @media print {
              html, body {
                background: #fff !important;
                color: #000 !important;
              }
              /* Hide the entire standard app workspace */
              #root, .fixed, .modal, .backdrop, header, nav, main {
                display: none !important;
                visibility: hidden !important;
              }
              /* Show ONLY the print section */
              #label-print-section {
                display: block !important;
                visibility: visible !important;
                position: absolute;
                left: 0;
                top: 0;
                width: 100% !important;
                background: white !important;
              }
              .printable-label-card {
                page-break-after: always !important;
                break-after: page !important;
                border: 2px solid #000000 !important;
                margin: 0 0 1cm 0 !important;
                box-shadow: none !important;
                width: 100% !important;
                max-width: 100% !important;
                page-break-inside: avoid !important;
              }
            }
          `}</style>

          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col shadow-xl overflow-hidden">
            {/* Header */}
            <div className="bg-slate-950 text-white p-4 px-6 flex justify-between items-center shrink-0">
              <div>
                <h3 className="font-bold text-sm tracking-tight flex items-center gap-2">
                  <Printer className="h-4 w-4 text-indigo-400" />
                  <span>Interactive Barcode Print Spooler</span>
                </h3>
                <p className="text-[10px] text-slate-450 tracking-wider">
                  PREPARATION FOR BARCODE SCANNERS & PHYSICAL ATTACHMENTS
                </p>
              </div>
              <button
                onClick={() => setIsPrintPreviewOpen(false)}
                className="text-slate-400 hover:text-white font-bold text-sm p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Print Controls / Header Tools */}
            <div className="bg-slate-50 border-b border-slate-250 p-4 px-6 flex flex-wrap items-center justify-between gap-4 text-xs shrink-0">
              <div className="flex items-center space-x-6">
                <div>
                  <span className="text-slate-500 font-medium mr-2">Selected Items:</span>
                  <span className="font-bold text-indigo-700 bg-indigo-50 border border-indigo-150 px-2.5 py-0.5 rounded-full">
                    {selectedGrnLines.length} batches
                  </span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-slate-500 font-medium">Copies per label:</span>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={labelCopies}
                    onChange={(e) => setLabelCopies(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-14 bg-white border border-slate-300 rounded-lg p-1 px-2 font-bold text-center text-xs text-slate-800"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="h-4 w-4" />
                  <span>Execute Print Job (Ctrl+P)</span>
                </button>
                <button
                  onClick={() => setIsPrintPreviewOpen(false)}
                  className="px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Close Spooler
                </button>
              </div>
            </div>

            {/* Print Area Preview */}
            <div className="p-6 overflow-y-auto bg-slate-100 flex-1 space-y-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mb-2">
                Live Label Layout Previews (Simulated 4" x 2" Thermal Stock)
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {grnResult.lines && grnResult.lines
                  .filter((l: any) => selectedGrnLines.includes(l.id))
                  .map((line: any) => {
                    const sku = skus.find(s => s.id === line.sku_id);
                    const labels = [];
                    for (let c = 0; c < labelCopies; c++) {
                      labels.push(
                        <div
                          key={`${line.id}-copy-${c}`}
                          className="bg-white border-2 border-slate-900 rounded-lg p-6 shadow-xs font-sans text-stone-900 space-y-3 relative overflow-hidden flex flex-col justify-between"
                          style={{ minHeight: '190px' }}
                        >
                          {/* Label Header */}
                          <div className="flex justify-between items-start border-b border-dashed border-stone-200 pb-2">
                            <div className="space-y-0.5">
                              <span className="text-[9px] font-black uppercase text-white bg-slate-900 px-1 py-0.5 rounded leading-none">
                                {grnResult.warehouse_id} WAREHOUSE
                              </span>
                              <h4 className="font-bold text-xs tracking-tight text-stone-800 truncate" style={{ maxWidth: '210px' }}>
                                {sku?.name || line.sku_id}
                              </h4>
                            </div>
                            <div className="text-right text-[8px] text-stone-450 font-mono">
                              GRN: {grnResult.grn_number}
                            </div>
                          </div>

                          {/* Label Body metadata */}
                          <div className="grid grid-cols-2 gap-2 text-[10px]">
                            <div>
                              <span className="text-stone-400 font-medium block text-[8px] uppercase">PRODUCT SKU</span>
                              <span className="font-bold font-mono text-stone-800">{line.sku_id}</span>
                            </div>
                            <div>
                              <span className="text-stone-400 font-medium block text-[8px] uppercase">TEMP ZONE</span>
                              <span className="font-bold text-indigo-700 font-mono capitalize">
                                {sku?.temp_zone || 'ambient'}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 font-medium block text-[8px] uppercase">BIN PUT-AWAY</span>
                              <span className="font-black font-mono text-teal-850 bg-teal-50 px-1 rounded inline-block">
                                {line.put_away_location_id || 'QUARANTINE'}
                              </span>
                            </div>
                            <div>
                              <span className="text-stone-400 font-medium block text-[8px] uppercase">EXPIRY DATE</span>
                              <span className="font-bold font-mono text-rose-750 bg-rose-50 px-1 rounded inline-block">
                                {line.expiry_date ? line.expiry_date.slice(0, 10) : 'N/A'}
                              </span>
                            </div>
                          </div>

                          {/* Barcode representation */}
                          <div className="pt-2 border-t border-dashed border-stone-200 flex flex-col items-center justify-center space-y-1">
                            <Barcode value={line.batch_id} />
                            <span className="font-mono text-[9px] font-bold text-stone-700 tracking-widest text-center">
                              *{line.batch_id}*
                            </span>
                          </div>
                          
                          {/* Page break marker for print preview screen only */}
                          <div className="absolute right-2 bottom-2 text-[8px] font-mono text-stone-300 pointer-events-none select-none uppercase">
                            Copy {c + 1}
                          </div>
                        </div>
                      );
                    }
                    return labels;
                  })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Actual Print block that's ONLY visible for print sheets */}
      <div id="label-print-section" className="hidden">
        {grnResult && grnResult.lines && (
          <div className="space-y-6">
            {grnResult.lines
              .filter((l: any) => selectedGrnLines.includes(l.id))
              .map((line: any) => {
                const sku = skus.find(s => s.id === line.sku_id);
                const labels = [];
                for (let c = 0; c < labelCopies; c++) {
                  labels.push(
                    <div
                      key={`print-${line.id}-copy-${c}`}
                      className="printable-label-card bg-white p-6 font-sans text-black space-y-4 flex flex-col justify-between border-2 border-black"
                      style={{ height: '3.5in', width: '6in', margin: '0 auto 0.5in auto', pageBreakInside: 'avoid' }}
                    >
                      {/* Label Header */}
                      <div className="flex justify-between items-start border-b-2 border-dashed border-black pb-2">
                        <div>
                          <span className="text-[10px] font-black uppercase text-white bg-black px-1.5 py-0.5 rounded leading-none">
                            {grnResult.warehouse_id} FACILITY
                          </span>
                          <h4 className="font-extrabold text-sm tracking-tight text-black mt-1">
                            {sku?.name || line.sku_id}
                          </h4>
                        </div>
                        <div className="text-right text-[9px] text-black font-mono">
                          GRN: {grnResult.grn_number}
                        </div>
                      </div>

                      {/* Label Body metadata */}
                      <div className="grid grid-cols-2 gap-4 text-xs">
                        <div>
                          <span className="text-black font-semibold block text-[9px] uppercase">PRODUCT SKU</span>
                          <span className="font-bold font-mono text-black text-sm">{line.sku_id}</span>
                        </div>
                        <div>
                          <span className="text-black font-semibold block text-[9px] uppercase">TEMP STORAGE ZONE</span>
                          <span className="font-black text-black font-mono text-sm uppercase">
                            {sku?.temp_zone || 'ambient'}
                          </span>
                        </div>
                        <div>
                          <span className="text-black font-semibold block text-[9px] uppercase">ALLOCATED BIN PLACE</span>
                          <span className="font-extrabold font-mono text-black text-sm">
                            {line.put_away_location_id || 'QUARANTINE'}
                          </span>
                        </div>
                        <div>
                          <span className="text-black font-semibold block text-[9px] uppercase">SAFETY EXPIRY DATE</span>
                          <span className="font-bold font-mono text-black text-sm">
                            {line.expiry_date ? line.expiry_date.slice(0, 10) : 'N/A'}
                          </span>
                        </div>
                      </div>

                      {/* Barcode representation */}
                      <div className="pt-2 border-t-2 border-dashed border-black flex flex-col items-center justify-center space-y-1">
                        <Barcode value={line.batch_id} />
                        <span className="font-mono text-[10px] font-bold text-black tracking-widest text-center uppercase">
                          *{line.batch_id}*
                        </span>
                      </div>
                    </div>
                  );
                }
                return labels;
              })}
          </div>
        )}
      </div>


    </div>
  );
}
