// src/components/BulkSkuUploadModal.tsx
import React, { useState } from 'react';
import { useCurrency } from '../hooks/useCurrency';
import { motion } from 'motion/react';
import { 
  X, 
  Upload, 
  CheckCircle2, 
  AlertTriangle, 
  FileSpreadsheet, 
  Info, 
  Play, 
  RotateCcw,
  Check,
  Loader2,
  Plus
} from 'lucide-react';
import { Category, Supplier, User as UserType } from '../types';

interface BulkSkuUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  suppliers: Supplier[];
  onUploadSuccess: () => void;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
  currentUser: UserType | null;
}

const STRICT_COLUMNS = [
  { key: 'name',              label: 'name',              required: true,  desc: 'Product name, e.g. Kenchic Whole Chicken 1.2kg' },
  { key: 'category',          label: 'category',          required: true,  desc: 'Exact category name, e.g. Fresh Poultry & Meats' },
  { key: 'supplier',          label: 'supplier',          required: true,  desc: 'Exact supplier name, e.g. Kenchic Ltd' },
  { key: 'temp_zone',         label: 'temp_zone',         required: true,  desc: 'One of: frozen, chilled, cool, ambient' },
  { key: 'unit',              label: 'unit',              required: true,  desc: 'One of: kg, g, each, litre, ml, pack' },
  { key: 'cost_price_cents',    label: 'cost_price_cents',    required: true,  desc: 'Decimal KES, e.g. 450.00' },
  { key: 'selling_price_cents', label: 'selling_price_cents', required: true,  desc: 'Decimal KES, e.g. 580.00' },
  { key: 'shelf_life_days',   label: 'shelf_life_days',   required: true,  desc: 'Positive integer, e.g. 7' },
  { key: 'reorder_level',     label: 'reorder_level',     required: true,  desc: 'Non-negative integer in base units, e.g. 25' },
  { key: 'moq',               label: 'moq',               required: true,  desc: 'Supplier minimum order quantity, e.g. 50' },
  { key: 'barcode',           label: 'barcode',           required: false, desc: 'UPC/EAN barcode, optional â€” leave blank if none' }
];

const validateRows = (rows: string[][], catList: Category[], supList: Supplier[], hasHeaders: boolean) => {
  const errors: { row: number; col: string; message: string }[] = [];
  const VALID_TEMP_ZONES = ['frozen', 'chilled', 'cool', 'ambient'];
  const VALID_UNITS = ['kg', 'g', 'each', 'litre', 'ml', 'pack'];

  rows.forEach((row, idx) => {
    const rowNum = idx + (hasHeaders ? 2 : 1);

    const name = row[0]?.trim();
    const category = row[1]?.trim();
    const supplier = row[2]?.trim();
    const tempZone = row[3]?.trim().toLowerCase();
    const unit = row[4]?.trim().toLowerCase();
    const costPrice = row[5]?.trim();
    const sellingPrice = row[6]?.trim();
    const shelfLife = row[7]?.trim();
    const reorderLevel = row[8]?.trim();
    const moq = row[9]?.trim();

    if (!name) errors.push({ row: rowNum, col: 'name', message: 'Product name is required' });

    const matchedCat = catList.find(c => c.name.toLowerCase() === category?.toLowerCase());
    if (!category) errors.push({ row: rowNum, col: 'category', message: 'Category is required' });
    else if (!matchedCat) errors.push({ row: rowNum, col: 'category', message: `"${category}" does not match any existing category. Available: ${catList.map(c => c.name).join(', ')}` });

    const matchedSup = supList.find(s => s.name.toLowerCase() === supplier?.toLowerCase() && s.is_active);
    if (!supplier) errors.push({ row: rowNum, col: 'supplier', message: 'Supplier is required' });
    else if (!matchedSup) errors.push({ row: rowNum, col: 'supplier', message: `"${supplier}" does not match any active supplier` });

    if (!VALID_TEMP_ZONES.includes(tempZone || '')) errors.push({ row: rowNum, col: 'temp_zone', message: `Must be one of: ${VALID_TEMP_ZONES.join(', ')}` });

    if (!VALID_UNITS.includes(unit || '')) errors.push({ row: rowNum, col: 'unit', message: `Must be one of: ${VALID_UNITS.join(', ')}` });

    const cost = parseFloat(costPrice || '');
    if (isNaN(cost) || cost <= 0) errors.push({ row: rowNum, col: 'cost_price_cents', message: 'Must be a positive number, e.g. 450.00' });

    const sell = parseFloat(sellingPrice || '');
    if (isNaN(sell) || sell <= 0) errors.push({ row: rowNum, col: 'selling_price_cents', message: 'Must be a positive number, e.g. 580.00' });

    const shelf = parseInt(shelfLife || '', 10);
    if (isNaN(shelf) || shelf <= 0) errors.push({ row: rowNum, col: 'shelf_life_days', message: 'Must be a positive whole number, e.g. 7' });

    const reorder = parseInt(reorderLevel || '', 10);
    if (isNaN(reorder) || reorder < 0) errors.push({ row: rowNum, col: 'reorder_level', message: 'Must be 0 or a positive whole number' });

    const moqVal = parseInt(moq || '', 10);
    if (isNaN(moqVal) || moqVal < 1) errors.push({ row: rowNum, col: 'moq', message: 'Minimum order quantity must be 1 or more' });
  });

  return errors;
};

export default function BulkSkuUploadModal({
  isOpen,
  onClose,
  categories,
  suppliers,
  onUploadSuccess,
  triggerToast,
  currentUser
}: BulkSkuUploadModalProps) {
  const { currencyCode } = useCurrency();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [pastedText, setPastedText] = useState<string>('');
  const [hasHeaders, setHasHeaders] = useState<boolean>(true);
  const [headerError, setHeaderError] = useState<string | null>(null);

  // States for step 2 review
  const [validData, setValidData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{ row: number; col: string; message: string }[]>([]);

  // States for step 3 uploading status
  const [skuUploadStatus, setSkuUploadStatus] = useState<Array<{
    rowIdx: number;
    code: string;
    name: string;
    status: 'pending' | 'uploading' | 'success' | 'error';
    errorMsg?: string;
  }>>([]);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleDownloadTemplate = () => {
    const headers = STRICT_COLUMNS.map(c => c.label).join(',');
    const sampleRow = [
      'Kenchic Whole Chicken 1.2kg',
      'Fresh Poultry & Meats',
      'Kenchic Ltd',
      'chilled',
      'each',
      '450.00',
      '580.00',
      '4',
      '25',
      '50',
      ''
    ].join(',');
    const csv = `${headers}\n${sampleRow}`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'freshops_product_import_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setPastedText(text || '');
      triggerToast('Spreadsheet file parsed successfully.', 'success');
    };
    reader.readAsText(file);
  };

  const handleNextToStep2 = () => {
    setHeaderError(null);
    setValidationErrors([]);
    setValidData([]);

    if (!pastedText.trim()) {
      triggerToast('Safety check: spreadsheet input data cannot be empty.', 'error');
      return;
    }

    const lines = pastedText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) {
      triggerToast('Safety check: spreadsheet lines cannot be empty.', 'error');
      return;
    }

    const rawGrid = lines.map(line => {
      if (line.includes('\t')) {
        return line.split('\t').map(cell => cell.trim());
      } else {
        return line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''));
      }
    });

    let dataRows = rawGrid;
    if (hasHeaders) {
      const parsedHeaders = rawGrid[0];
      for (let i = 0; i < STRICT_COLUMNS.length; i++) {
        const expected = STRICT_COLUMNS[i].label.toLowerCase().trim();
        const got = (parsedHeaders[i] || '').toLowerCase().trim();
        if (expected !== got) {
          setHeaderError(`Header mismatch: expected "${STRICT_COLUMNS[i].label}" at column ${i + 1}, found "${parsedHeaders[i] || 'missing'}". Please check file column order.`);
          return;
        }
      }
      dataRows = rawGrid.slice(1);
    }

    if (dataRows.length === 0) {
      triggerToast('Spreadsheet is empty or lacks data rows.', 'error');
      return;
    }

    // Full file validation
    const errorsList = validateRows(dataRows, categories, suppliers, hasHeaders);
    setValidationErrors(errorsList);

    const validRowsToUpload: any[] = [];
    dataRows.forEach((row, idx) => {
      const rowNum = idx + (hasHeaders ? 2 : 1);
      const hasError = errorsList.some(e => e.row === rowNum);
      if (hasError) return;

      const name = row[0]?.trim();
      const category = row[1]?.trim();
      const supplier = row[2]?.trim();
      const tempZone = row[3]?.trim().toLowerCase();
      const unit = row[4]?.trim().toLowerCase();
      const costPrice = row[5]?.trim();
      const sellingPrice = row[6]?.trim();
      const shelfLife = row[7]?.trim();
      const reorderLevel = row[8]?.trim();
      const moq = row[9]?.trim();
      const barcode = row[10]?.trim() || '';

      const matchedCat = categories.find(c => c.name.toLowerCase() === category?.toLowerCase());
      const matchedSup = suppliers.find(s => s.name.toLowerCase() === supplier?.toLowerCase() && s.is_active);

      if (matchedCat && matchedSup) {
        validRowsToUpload.push({
          rowIdx: rowNum,
          name,
          category_id: matchedCat.id,
          category_name: matchedCat.name,
          supplier_id: matchedSup.id,
          supplier_name: matchedSup.name,
          temp_zone: tempZone,
          unit: unit,
          cost_price_cents: parseFloat(costPrice),
          selling_price_cents: parseFloat(sellingPrice),
          shelf_life_days: parseInt(shelfLife, 10),
          reorder_level: parseInt(reorderLevel, 10),
          moq: parseInt(moq, 10),
          barcode: barcode || null
        });
      }
    });

    setValidData(validRowsToUpload);
    setStep(2);
  };

  const handleCreateAllSkus = async () => {
    if (validationErrors.length > 0) {
      triggerToast('Cannot upload products while validation errors remain. Please fix errors and re-upload the file.', 'error');
      return;
    }

    if (validData.length === 0) {
      triggerToast('No valid product rows ready for ingestion.', 'error');
      return;
    }

    setIsUploading(true);
    setStep(3);

    // Initialise uploading structures
    const initialProgress = validData.map(item => ({
      rowIdx: item.rowIdx,
      code: '(Auto-generated)',
      name: item.name,
      status: 'pending' as const
    }));
    setSkuUploadStatus(initialProgress);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validData.length; i++) {
      const item = validData[i];

      setSkuUploadStatus(prev => prev.map(p => 
        p.rowIdx === item.rowIdx ? { ...p, status: 'uploading' } : p
      ));

      try {
        const basePreset = {
          base_unit: 'each',
          procurement_unit: 'crate of 50',
          procurement_unit_qty: 50,
          count_unit: 'crate of 50',
          count_unit_qty: 50,
          remainder_unit: 'each',
          remainder_unit_qty: 1,
          display_unit: 'each',
          display_divisor: 1,
          display_decimals: 0
        };

        if (item.unit === 'kg') {
          Object.assign(basePreset, {
            base_unit: 'g',
            procurement_unit: '25kg bag',
            procurement_unit_qty: 25000,
            count_unit: '25kg bag',
            count_unit_qty: 25000,
            remainder_unit: 'kg',
            remainder_unit_qty: 1000,
            display_unit: 'kg',
            display_divisor: 1000,
            display_decimals: 1
          });
        } else if (item.unit === 'litre' || item.unit === 'ml') {
          Object.assign(basePreset, {
            base_unit: 'ml',
            procurement_unit: 'case of 12',
            procurement_unit_qty: 6000,
            count_unit: 'case of 12',
            count_unit_qty: 6000,
            remainder_unit: 'bottle',
            remainder_unit_qty: 500,
            display_unit: 'L',
            display_divisor: 1000,
            display_decimals: 2
          });
        } else if (item.unit === 'pack') {
          Object.assign(basePreset, {
            base_unit: 'each',
            procurement_unit: 'case of 24',
            procurement_unit_qty: 24,
            count_unit: 'case of 24',
            count_unit_qty: 24,
            remainder_unit: 'each',
            remainder_unit_qty: 1,
            display_unit: 'each',
            display_divisor: 1,
            display_decimals: 0
          });
        }

        const skuPayload = {
          name: item.name,
          category_id: item.category_id,
          supplier_id: item.supplier_id,
          temp_zone: item.temp_zone,
          unit: item.unit,
          
          ...basePreset,

          cost_price_cents: Math.round(item.cost_price_cents * 100),
          selling_price_cents: Math.round(item.selling_price_cents * 100),
          shelf_life_days: item.shelf_life_days,
          reorder_level: item.reorder_level,
          moq: item.moq,
          reorder_qty: item.moq, // default qty to moq
          barcode: item.barcode,

          weight_kg: item.unit === 'kg' ? 1 : null,
          max_stock_level: null,
          publication_status: 'draft',
          published_at: null,
          published_by: null,
          readiness_pct: 0,
          is_active: true,
          requires_barcode: null,
          product_class: null,
          ethylene_profile: 'neutral',
          description: 'Uploaded via spreadsheet bulk tool',
          image_urls: []
        };

        const res = await fetch('/api/v1/skus', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(skuPayload)
        });

        const json = await res.json().catch(() => null);

        if (res.ok) {
          successCount++;
          const finalSkuCode = json?.data?.code || '(Auto-generated)';
          setSkuUploadStatus(prev => prev.map(p => 
            p.rowIdx === item.rowIdx ? { ...p, status: 'success', code: finalSkuCode } : p
          ));
        } else {
          failCount++;
          const errMsg = json?.error?.message || 'Server rejected sku creation';
          setSkuUploadStatus(prev => prev.map(p => 
            p.rowIdx === item.rowIdx ? { ...p, status: 'error', errorMsg: errMsg } : p
          ));
        }
      } catch (err) {
        failCount++;
        setSkuUploadStatus(prev => prev.map(p => 
          p.rowIdx === item.rowIdx ? { ...p, status: 'error', errorMsg: 'Network failure' } : p
        ));
      }

      await new Promise(r => setTimeout(r, 60));
    }

    setIsUploading(false);
    triggerToast(`Bulk upload finished safely. Successful: ${successCount} SKUs. Failed: ${failCount}`, failCount > 0 ? 'info' : 'success');
    onUploadSuccess();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-150 shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header ribbon bar */}
        <div className="bg-slate-900 text-white p-4 flex items-center justify-between shadow-sm">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-teal-500 text-slate-950 rounded-lg">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold">Strict Product Ingestion Portal</h2>
              <p className="text-[10px] text-slate-400">Exact Column Order & Headers Template Upload System</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            disabled={isUploading}
            className="p-1 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition cursor-pointer min-h-[32px] min-w-[32px] flex items-center justify-center"
            title="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Dynamic Wizard Steps indicator */}
        <div className="border-b border-slate-100 bg-slate-50 pin-t p-3 flex justify-center gap-8 text-[11px] font-bold text-slate-500 shrink-0">
          <div className={`flex items-center gap-1.5 ${step === 1 ? 'text-teal-600' : 'text-slate-400'}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 1 ? 'bg-teal-500 text-slate-950 font-black' : 'bg-slate-200'}`}>1</span>
            <span>Step 1: Download & Ingest</span>
          </div>
          <div className="h-px bg-slate-200 w-12 self-center" />
          <div className={`flex items-center gap-1.5 ${step === 2 ? 'text-teal-600' : 'text-slate-400'}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 2 ? 'bg-teal-500 text-slate-950 font-black' : 'bg-slate-200'}`}>2</span>
            <span>Step 2: Schema Validation</span>
          </div>
          <div className="h-px bg-slate-200 w-12 self-center" />
          <div className={`flex items-center gap-1.5 ${step === 3 ? 'text-teal-600' : 'text-slate-400'}`}>
            <span className={`h-5 w-5 rounded-full flex items-center justify-center text-[10px] ${step === 3 ? 'bg-teal-500 text-slate-950 font-black' : 'bg-slate-200'}`}>3</span>
            <span>Step 3: Registration Status</span>
          </div>
        </div>

        {/* Content Portal Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {step === 1 && (
            <div className="space-y-4">
              
              {/* Promotional strict template actions container */}
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-slate-50 rounded-xl p-4 border border-slate-200">
                <div className="flex items-start gap-2.5 text-xs text-slate-600">
                  <Info className="h-4 w-4 text-teal-600 mt-0.5 shrink-0" />
                  <div>
                    <h4 className="font-semibold text-slate-800">Strict CSV Template Required</h4>
                    <p className="mt-0.5 text-[11px]">The columns must match the exact template headers and order. Download the template below to ensure correct formatting.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs rounded-xl transition flex items-center gap-1.5 shrink-0 justify-center cursor-pointer shadow-xs min-h-[40px]"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Strict file uploader segment */}
              <div className="space-y-1.5 bg-slate-50/40 p-4 border border-dashed border-slate-200 rounded-xl">
                <label className="block text-xs font-bold text-slate-700">Import CSV or Tab-Separated File</label>
                <div className="flex items-center gap-3">
                  <input
                    type="file"
                    accept=".csv,.tsv,.txt"
                    onChange={handleFileChange}
                    className="block w-full text-xs text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800 file:cursor-pointer cursor-pointer border border-slate-200 rounded-xl bg-white p-1"
                  />
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-200"></div>
                <span className="flex-shrink mx-4 text-slate-400 text-[10px] font-bold uppercase tracking-wider">or paste directly</span>
                <div className="flex-grow border-t border-slate-200"></div>
              </div>

              {/* Direct textbox area segment */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between font-bold text-xs text-slate-700">
                  <span>Input Data Block</span>
                  <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={hasHeaders} 
                      onChange={(e) => setHasHeaders(e.target.checked)} 
                      className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-3.5 w-3.5 cursor-pointer"
                    />
                    <span>First row contains exact Column Headers</span>
                  </label>
                </div>
                <textarea
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  placeholder="name,category,supplier,temp_zone,unit,cost_price_cents,selling_price_cents,shelf_life_days,reorder_level,moq,barcode&#10;Kenchic Whole Chicken 1.2kg,Fresh Poultry & Meats,Kenchic Ltd,chilled,each,450.00,580.00,4,25,10,"
                  className="w-full h-44 p-4 border border-slate-200 rounded-xl font-mono text-xs outline-hidden focus:border-teal-500 bg-slate-50/20 text-slate-800 placeholder-slate-400 focus:bg-white transition-colors"
                />
              </div>

              {/* Layout header mismatch warning block */}
              {headerError && (
                <div className="bg-rose-50 border border-rose-250 text-rose-805 px-3.5 py-2.5 rounded-xl text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{headerError}</span>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {validationErrors.length > 0 ? (
                <div className="space-y-3">
                  <div className="bg-rose-50 border border-rose-100 rounded-xl p-3 text-xs text-rose-850 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Validation Failed â€” Action Required</p>
                      <p className="mt-0.5">Please review the validation errors below. You must correct your spreadsheet columns or cell values and re-upload/re-paste the correct data.</p>
                    </div>
                  </div>

                  {/* Scrollable validation errors panel */}
                  <div className="border border-rose-150 rounded-xl bg-white overflow-hidden max-h-[350px] overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse font-sans">
                      <thead className="bg-rose-100/60 text-rose-900 sticky top-0 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3 w-20">Row</th>
                          <th className="p-3 w-32">Column</th>
                          <th className="p-3">Error Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validationErrors.map((err, idx) => (
                          <tr key={idx} className="border-b border-rose-100 bg-white/60 hover:bg-rose-50/30">
                            <td className="p-3 font-mono text-[11px] font-bold text-slate-500">Row {err.row}</td>
                            <td className="p-3 font-mono text-[11px] text-rose-700 bg-rose-50/20 font-bold">{err.col}</td>
                            <td className="p-3 text-slate-700 font-medium">{err.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-rose-50 text-rose-800 px-4 py-3 rounded-xl border border-rose-200 text-xs font-bold text-center">
                    âŒ {validationErrors.length} errors found â€” fix your file and re-upload.
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-xs text-emerald-850 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    <div>
                      <p className="font-bold">Validation Successful!</p>
                      <p className="mt-0.5">All rows are structurally sound. No existing catalog constraints were violated. Review the preview table below before committing.</p>
                    </div>
                  </div>

                  {/* Scrollable preview table */}
                  <div className="overflow-x-auto border border-emerald-250 rounded-xl bg-white max-h-[350px]">
                    <table className="w-full text-left text-[11px] border-collapse relative">
                      <thead className="bg-slate-900 text-white sticky top-0 z-10 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-2.5">Row</th>
                          <th className="p-2.5">Name</th>
                          <th className="p-2.5">Category</th>
                          <th className="p-2.5">Supplier</th>
                          <th className="p-2.5">Temp Zone</th>
                          <th className="p-2.5">Unit</th>
                          <th className="p-2.5">Cost ({currencyCode})</th>
                          <th className="p-2.5">Sell ({currencyCode})</th>
                          <th className="p-2.5">Shelf Life</th>
                          <th className="p-2.5">Reorder Lvl</th>
                          <th className="p-2.5">MOQ</th>
                          <th className="p-2.5">Barcode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {validData.map((item, idx) => (
                          <tr key={idx} className="border-b border-slate-100 hover:bg-emerald-50/20">
                            <td className="p-2.5 font-mono text-slate-400 font-bold">R{item.rowIdx}</td>
                            <td className="p-2.5 text-slate-800 font-bold truncate max-w-[150px]" title={item.name}>{item.name}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[130px]">{item.category_name}</td>
                            <td className="p-2.5 text-slate-600 truncate max-w-[130px]">{item.supplier_name}</td>
                            <td className="p-2.5 text-slate-600 font-mono text-[10px]">{item.temp_zone}</td>
                            <td className="p-2.5 text-slate-600 font-mono text-[10px]">{item.unit}</td>
                            <td className="p-2.5 text-slate-850 font-semibold">{item.cost_price_cents.toFixed(2)}</td>
                            <td className="p-2.5 text-slate-850 font-semibold">{item.selling_price_cents.toFixed(2)}</td>
                            <td className="p-2.5 text-slate-600 font-semibold">{item.shelf_life_days} days</td>
                            <td className="p-2.5 text-slate-600">{item.reorder_level}</td>
                            <td className="p-2.5 text-slate-600">{item.moq}</td>
                            <td className="p-2.5 text-slate-400 font-mono text-[10px]">{item.barcode || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-4 py-3 rounded-xl text-center text-xs font-bold">
                    ðŸš€ Ready to upload {validData.length} valid products!
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4 py-4">
              <div className="text-center max-w-sm mx-auto space-y-2">
                {isUploading ? (
                  <>
                    <Loader2 className="h-8 w-8 text-teal-500 animate-spin mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">Uploading Product SKUs...</h3>
                    <p className="text-xs text-slate-500">Injecting products safely with customized units matching preset definitions.</p>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
                    <h3 className="text-sm font-bold text-slate-800">Ingestion Complete</h3>
                    <p className="text-xs text-slate-500">Spreadsheet processing finished. Review the upload record sheet below.</p>
                  </>
                )}
              </div>

              {/* Progress registry screen */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-[300px] overflow-y-auto bg-slate-50/40">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-100 text-slate-600 font-bold border-b border-slate-200 text-[10px] uppercase">
                      <th className="p-3">Import Line</th>
                      <th className="p-3">Allocated SKU Code</th>
                      <th className="p-3">Product Title</th>
                      <th className="p-3 text-right">Result status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skuUploadStatus.map((progress, pIdx) => (
                      <tr key={pIdx} className="border-b border-slate-100 bg-white hover:bg-slate-50/50">
                        <td className="p-3 text-[10px] font-mono text-slate-400">Row {progress.rowIdx}</td>
                        <td className="p-3 font-mono font-bold text-slate-800">{progress.code}</td>
                        <td className="p-3 text-slate-700 truncate max-w-[200px]">{progress.name}</td>
                        <td className="p-3 text-right">
                          {progress.status === 'pending' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-bold">Pending</span>
                          )}
                          {progress.status === 'uploading' && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-bold animate-pulse inline-flex items-center gap-1">
                              <Loader2 className="h-3 w-3 animate-spin" /> Ingesting
                            </span>
                          )}
                          {progress.status === 'success' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-black inline-flex items-center gap-1">
                              <Check className="h-3 w-3" /> SUCCESS
                            </span>
                          )}
                          {progress.status === 'error' && (
                            <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-black inline-flex items-center gap-1" title={progress.errorMsg}>
                              FAIL: {progress.errorMsg || 'Error'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Action button Footer */}
        <div className="bg-slate-100 p-4 border-t border-slate-150 flex items-center justify-between shrink-0">
          <div>
            {step === 2 && (
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 bg-white hover:bg-slate-55 border border-slate-200 text-slate-705 font-bold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
              >
                <RotateCcw className="h-4 w-4" />
                <span>Return to Step 1</span>
              </button>
            )}
            {step === 3 && !isUploading && (
              <button
                type="button"
                onClick={() => {
                  setPastedText('');
                  setHeaderError(null);
                  setStep(1);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-55 border border-slate-200 text-slate-705 font-bold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1.5 cursor-pointer hover:bg-slate-50"
              >
                <Plus className="h-4 w-4 text-teal-600" />
                <span>Upload Another Document</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isUploading}
              className={`px-4 py-2 border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-50 transition min-h-[44px] cursor-pointer ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              {step === 3 ? 'Done' : 'Cancel'}
            </button>

            {step === 1 && (
              <button
                type="button"
                onClick={handleNextToStep2}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1.5 cursor-pointer"
              >
                <span>Parse & Validate Schema</span>
                <Play className="h-3.5 w-3.5 text-teal-400" />
              </button>
            )}

            {step === 2 && (
              <button
                type="button"
                onClick={handleCreateAllSkus}
                disabled={validationErrors.length > 0 || validData.length === 0}
                className={`px-5 py-2 bg-teal-500 hover:bg-teal-450 text-slate-950 font-extrabold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1.5 cursor-pointer shadow-xs ${
                  (validationErrors.length > 0 || validData.length === 0) ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                <span>Upload {validData.length} products</span>
                <CheckCircle2 className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

