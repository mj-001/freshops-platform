// src/components/Catalogue.tsx
import React, { useEffect, useState } from 'react';
import { useCurrency } from '../hooks/useCurrency';
import * as XLSX from 'xlsx';
import { 
  BookOpen, 
  CheckCircle, 
  XCircle, 
  Plus, 
  Search, 
  FileSpreadsheet, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Trash2, 
  Heart,
  ChevronRight,
  BookOpenCheck,
  Percent,
  Upload,
  AlertTriangle,
  X,
  Info
} from 'lucide-react';
import { SKU, Category, User as UserType, Supplier, VendorCard } from '../types';
import BarcodeInput from './BarcodeInput';
import BulkSkuUploadModal from './BulkSkuUploadModal';
import PriceHistoryPanel from './PriceHistoryPanel';

type VendorCardLocal = VendorCard;

const downloadAsXLSX = (
  rows: (string | number | null)[][],
  filename: string
) => {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Export');
  XLSX.writeFile(wb, `${filename}.xlsx`);
};

// Helper to determine starting metrics based on selected unit
function getUomPreset(unit: string) {
  switch (unit) {
    case 'kg':
      return {
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
      };
    case 'g':
      return {
        base_unit: 'g',
        procurement_unit: '5kg pack',
        procurement_unit_qty: 5000,
        count_unit: '5kg pack',
        count_unit_qty: 5000,
        remainder_unit: 'kg',
        remainder_unit_qty: 1000,
        display_unit: 'kg',
        display_divisor: 1000,
        display_decimals: 1
      };
    case 'litre':
      return {
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
      };
    case 'ml':
      return {
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
      };
    case 'pack':
      return {
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
      };
    case 'each':
    default:
      return {
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
  }
}

const initialNewProductState = {
  name: '',
  code: '',
  category_id: '',
  supplier_id: '',
  temp_zone: 'ambient',
  unit: 'each',
  // Customized units matching UOM Preset default (for 'each')
  base_unit: 'each',
  procurement_unit: 'crate of 50',
  procurement_unit_qty: 50,
  count_unit: 'crate of 50',
  count_unit_qty: 50,
  remainder_unit: 'each',
  remainder_unit_qty: 1,
  display_unit: 'each',
  display_divisor: 1,
  display_decimals: 0,
  // Section 2 pricing and duration
  cost_price_cents: '',
  selling_price_cents: '',
  shelf_life_days: '',
  // Section 3 limits
  reorder_level: '0',
  reorder_qty: '0',
  weight_kg: '',
  // Section 4 Advanced
  barcode: '',
  requires_barcode: 'inherit', // 'inherit' | 'required' | 'not_required'
  max_stock_level: '',
  product_class: 'inherit', // 'inherit' | ProductClass
  ethylene_profile: 'neutral',
  description: ''
};

interface CatalogueProps {
  currentUser: UserType | null;
  triggerToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export default function Catalogue({ currentUser, triggerToast }: CatalogueProps) {
  const { currencyCode } = useCurrency();
  const [activeView, setActiveView] = useState<'catalogue' | 'report'>('catalogue');
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  
  const [skus, setSkus] = useState<SKU[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [vendorCards, setVendorCards] = useState<VendorCard[]>([]);
  
  const [activeTab, setActiveTab] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSku, setSelectedSku] = useState<SKU | null>(null);

  // New Product Modal and state variables
  const [showNewProductModal, setShowNewProductModal] = useState<boolean>(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState<boolean>(false);
  const [newProduct, setNewProduct] = useState(initialNewProductState);
  const [isUnitConfigExpanded, setIsUnitConfigExpanded] = useState<boolean>(false);
  const [isAdvancedExpanded, setIsAdvancedExpanded] = useState<boolean>(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isSubmitLoading, setIsSubmitLoading] = useState<boolean>(false);

  // States for stock warning confirmation
  const [showStockWarningModal, setShowStockWarningModal] = useState<boolean>(false);
  const [stockWarningData, setStockWarningData] = useState<{
    skuId: string;
    newStatus: string;
    stockOnHand: number;
    message: string;
  } | null>(null);

  // Form structures
  const [showAddCard, setShowAddCard] = useState<boolean>(false);
  const [newCard, setNewCard] = useState({
    supplier_id: '',
    supplier_sku_code: '',
    supplier_unit: 'each',
    units_per_supplier_unit: 1,
    moq: 1,
    lead_time_days: 1,
    price_cents_full: 0, // In standard KES (converted to cents on save)
    is_preferred: false,
    notes: ''
  });

  const [imageUrlInput, setImageUrlInput] = useState<string>('');

  // Category quick-add state
  const [showQuickAddCategory, setShowQuickAddCategory] = useState<boolean>(false);
  const [quickCategory, setQuickCategory] = useState({
    name: '',
    parent_id: '',
    default_temp_zone: 'ambient',
    default_product_class: '',
    requires_barcode: false
  });
  const [quickCatError, setQuickCatError] = useState<string | null>(null);

  // Supplier quick-add state
  const [showQuickAddSupplier, setShowQuickAddSupplier] = useState<boolean>(false);
  const [quickSupplier, setQuickSupplier] = useState({
    name: '',
    contact_name: '',
    phone: '',
    email: '',
    lead_time_days: 7,
    payment_terms: ''
  });
  const [quickSupError, setQuickSupError] = useState<string | null>(null);
  const [quickAddSource, setQuickAddSource] = useState<'new_product' | 'vendor_card' | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const skusRes = await fetch('/api/v1/skus');
      if (!skusRes.ok) throw new Error('Failed to load SKUs');
      const skusJson = await skusRes.json();
      setSkus(skusJson.data || []);

      const catRes = await fetch('/api/v1/categories');
      if (!catRes.ok) throw new Error('Failed to load categories');
      const catJson = await catRes.json();
      setCategories(catJson.data || []);

      const supRes = await fetch('/api/v1/suppliers');
      if (!supRes.ok) throw new Error('Failed to load suppliers');
      const supJson = await supRes.json();
      setSuppliers(supJson.data || []);

      const vcRes = await fetch('/api/v1/vendor-cards');
      if (!vcRes.ok) throw new Error('Failed to load vendor cards');
      const vcJson = await vcRes.json();
      setVendorCards(vcJson.data || []);

    } catch (err) {
      console.error(err);
      setLoadError('Could not load catalogue data. Check your connection.');
      triggerToast('Error loading PIM catalogue.', 'error');
    } finally {
      setLoading(false);
    }
  };

  const getEffectiveRequiresBarcode = (sku: SKU): boolean => {
    if (sku.requires_barcode != null) return sku.requires_barcode;
    const cat = categories.find(c => c.id === sku.category_id);
    if (cat?.requires_barcode != null) return cat.requires_barcode;
    return false;
  };

  const calculateReadiness = (sku: SKU, vcs: VendorCardLocal[]): {
    pct: number;
    checklist: Record<string, boolean>;
    missing: string[];
  } => {
    const requiresBarcode = getEffectiveRequiresBarcode(sku);
    
    const checklist: Record<string, boolean> = {
      name: !!sku.name?.trim(),
      category: !!sku.category_id,
      temp_zone: !!sku.temp_zone,
      unit: !!sku.display_unit || !!sku.unit,
      shelf_life: sku.shelf_life_days > 0,
      selling_price: sku.selling_price_cents > 0,
      cost_price: sku.cost_price_cents > 0,
      images: !!(sku.image_urls && sku.image_urls.length > 0),
      vendor: vcs.some(vc => vc.sku_id === sku.id && vc.is_preferred)
    };

    if (requiresBarcode) {
      checklist.barcode = !!sku.barcode?.trim();
    }

    const total = Object.keys(checklist).length;
    const completed = Object.values(checklist).filter(Boolean).length;
    const pct = Math.round((completed / total) * 100);

    const missingLabels: Record<string, string> = {
      name: 'Product Name',
      category: 'Category Assigned',
      temp_zone: 'Temperature Zone',
      unit: 'Unit of Measure',
      shelf_life: 'Shelf Life (>0 Days)',
      selling_price: 'Selling Price (>0)',
      cost_price: 'Cost Price (>0)',
      images: 'Product Image',
      vendor: 'Preferred Vendor Linked',
      barcode: 'Barcode Scan'
    };

    const missing = Object.entries(checklist)
      .filter(([_, isDone]) => !isDone)
      .map(([key]) => missingLabels[key] || key);

    return { pct, checklist, missing };
  };

  const updateSkuValue = async (skuId: string, updates: Partial<SKU>) => {
    // 1. Optimistic Update UI
    setSkus(prev => prev.map(s => s.id === skuId ? { ...s, ...updates } : s));
    if (selectedSku?.id === skuId) {
      setSelectedSku(prev => prev ? { ...prev, ...updates } : null);
    }

    // 2. Perform real backend patch call
    try {
      const res = await fetch(`/api/v1/skus/${skuId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) {
        const json = await res.json().catch(() => null);
        triggerToast(json?.error?.message || 'Failed to update SKU on server', 'error');
      }
    } catch {
      triggerToast('Updating SKU failed â€” check configuration.', 'error');
    }
  };

  const handleStatusChange = async (skuId: string, newStatus: string, confirmStockWarning: boolean = false) => {
    try {
      const res = await fetch(`/api/v1/skus/${skuId}/status-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_status: newStatus,
          confirm_stock_warning: confirmStockWarning
        })
      });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        if (json?.requires_confirmation) {
          setStockWarningData({
            skuId,
            newStatus,
            stockOnHand: json.stock_on_hand,
            message: json.message
          });
          setShowStockWarningModal(true);
          return;
        }
        
        // Success! Let's update the local sku object and selectedSku
        const updatedSku = json.data;
        setSkus(prev => prev.map(s => s.id === skuId ? updatedSku : s));
        if (selectedSku?.id === skuId) {
          setSelectedSku(updatedSku);
        }
        triggerToast(`Product status successfully updated to ${newStatus}!`, 'success');
        return;
      }
      triggerToast(json?.error?.message || 'Failed to update status', 'error');
    } catch {
      triggerToast('Updating status failed â€” check connection.', 'error');
    }
  };

  const handleArchive = async (skuId: string) => {
    try {
      const res = await fetch(`/api/v1/skus/${skuId}/archive`, { method: 'POST' });
      const json = await res.json().catch(() => null);
      if (res.ok) {
        updateSkuValue(skuId, { publication_status: 'archived', is_active: false });
        triggerToast('Product archived.', 'info');
      } else {
        triggerToast(json?.error?.message || 'Archiving failed', 'error');
      }
    } catch {
      triggerToast('Archiving failed â€” check your connection.', 'error');
    }
  };

  const handleAddImage = () => {
    if (!imageUrlInput.trim()) return;
    if (!selectedSku) return;

    const urls = selectedSku.image_urls || [];
    if (urls.includes(imageUrlInput)) {
      return triggerToast('Image already exists', 'info');
    }

    const updatedUrls = [...urls, imageUrlInput];
    updateSkuValue(selectedSku.id, { image_urls: updatedUrls });
    setImageUrlInput('');
    triggerToast('Product image URL added successfully.', 'success');
  };

  // Vendor Card operations
  const handleAddNewVendorCard = async () => {
    if (!selectedSku) return;
    if (!newCard.supplier_id) return triggerToast('Supplier is required', 'error');
    
    const cardData: VendorCardLocal = {
      id: 'VC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
      sku_id: selectedSku.id,
      supplier_id: newCard.supplier_id,
      supplier_sku_code: newCard.supplier_sku_code || selectedSku.code,
      supplier_unit: newCard.supplier_unit,
      units_per_supplier_unit: newCard.units_per_supplier_unit,
      moq: newCard.moq,
      lead_time_days: newCard.lead_time_days,
      price_cents: Math.round(newCard.price_cents_full * 100), // convert to cents
      is_preferred: newCard.is_preferred,
      is_active: true,
      notes: newCard.notes || null,
      created_by: currentUser?.id || 'U-OPS',
      created_at: new Date().toISOString()
    };

    // If preferred, unset others
    let updatedCards = [...vendorCards];
    if (cardData.is_preferred) {
      updatedCards = updatedCards.map(vc => vc.sku_id === selectedSku.id ? { ...vc, is_preferred: false } : vc);
    }
    updatedCards.push(cardData);

    try {
      const res = await fetch('/api/v1/vendor-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cardData)
      });
      if (res.ok) {
        // saved on backend
      }
    } catch {
      // offline silent
    }

    setVendorCards(updatedCards);
    setShowAddCard(false);
    triggerToast('Supplier Vendor Card created successfully.', 'success');
    
    // Clear form
    setNewCard({
      supplier_id: '',
      supplier_sku_code: '',
      supplier_unit: 'each',
      units_per_supplier_unit: 1,
      moq: 1,
      lead_time_days: 1,
      price_cents_full: 0,
      is_preferred: false,
      notes: ''
    });
  };

  const handleSetPreferredVendor = (cardId: string, skuId: string) => {
    const updated = vendorCards.map(vc => {
      if (vc.sku_id === skuId) {
        return { ...vc, is_preferred: vc.id === cardId };
      }
      return vc;
    });
    setVendorCards(updated);
    triggerToast('Preferred supplier card priority set.', 'success');
  };

  // Export CSV Client Side
  const handleExportCSV = () => {
    const incompleteSKUs = skus.map(s => {
      const readiness = calculateReadiness(s, vendorCards);
      return { sku: s, readiness };
    });

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "SKU Code,Product Name,Category,Temp Zone,Readiness %,Status,Missing Fields\n";

    incompleteSKUs.forEach(item => {
      const missingFields = item.readiness.missing.join('; ');
      csvContent += `"${item.sku.code}","${item.sku.name}","${categories.find(c => c.id === item.sku.category_id)?.name || 'None'}","${item.sku.temp_zone}",${item.readiness.pct}%,"${item.sku.publication_status || 'draft'}","${missingFields}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `PIM_Readiness_Report_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerToast('Readiness report exported successfully!', 'success');
  };

  const handleExportXLSX = () => {
    const incompleteSKUs = skus.map(s => {
      const readiness = calculateReadiness(s, vendorCards);
      return { sku: s, readiness };
    });

    const rows: (string | number)[][] = [
      ['SKU Code', 'Product Name', 'Category', 'Temp Zone',
       'Readiness %', 'Status', 'Missing Fields']
    ];
    incompleteSKUs.forEach(item => {
      const missingFields = item.readiness.missing.join('; ');
      rows.push([
        item.sku.code,
        item.sku.name,
        categories.find(c => c.id === item.sku.category_id)?.name || '',
        item.sku.temp_zone,
        `${item.readiness.pct}%`,
        item.sku.publication_status || 'draft',
        missingFields
      ]);
    });
    downloadAsXLSX(rows, `PIM_Readiness_Report_${new Date().toISOString().split('T')[0]}`);
    triggerToast('Readiness report exported successfully!', 'success');
  };

  // Mapping computed entries
  const skusWithReadiness = skus.map(s => {
    const readiness = calculateReadiness(s, vendorCards);
    
    // Determine effective status
    let status: 'published' | 'ready' | 'draft' | 'archived' = 'draft';
    if (s.publication_status === 'published') status = 'published';
    else if (s.publication_status === 'archived') status = 'archived';
    else if (readiness.pct === 100) status = 'ready';
    else status = 'draft';

    return { sku: s, readiness, status };
  });

  const filteredItems = skusWithReadiness.filter(item => {
    const matchesSearch = 
      item.sku.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (item.sku.barcode && item.sku.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

    if (activeTab === 'All') return matchesSearch;
    if (activeTab === 'Published') return item.sku.publication_status === 'published' && matchesSearch;
    if (activeTab === 'Ready') return item.status === 'ready' && item.sku.publication_status !== 'published' && matchesSearch;
    if (activeTab === 'In Progress') return item.readiness.pct < 100 && item.readiness.pct > 0 && item.sku.publication_status !== 'published' && matchesSearch;
    if (activeTab === 'Draft') return item.sku.publication_status === 'draft' && matchesSearch;
    if (activeTab === 'Archived') return item.sku.publication_status === 'archived' && matchesSearch;
    
    return matchesSearch;
  });

  const handleUnitChange = (val: string) => {
    const preset = getUomPreset(val);
    setNewProduct(prev => ({
      ...prev,
      unit: val,
      ...preset
    }));
  };

  const handleCreateProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    // Client-side validations
    const errors: Record<string, string> = {};
    if (!newProduct.name.trim()) errors.name = 'Product name is required';
    if (!newProduct.code.trim()) errors.code = 'Product/SKU code is required';
    if (!newProduct.category_id) errors.category_id = 'Category assignment is required';
    if (!newProduct.supplier_id) errors.supplier_id = 'A default supplier is required';
    if (!newProduct.temp_zone) errors.temp_zone = 'Temperature zone setting is required';
    if (!newProduct.unit) errors.unit = 'Core unit designation is required';

    const costPriceVal = parseFloat(newProduct.cost_price_cents);
    if (!newProduct.cost_price_cents || isNaN(costPriceVal) || costPriceVal <= 0) {
      errors.cost_price_cents = 'Cost price is required and must be greater than 0';
    }

    const sellingPriceVal = parseFloat(newProduct.selling_price_cents);
    if (!newProduct.selling_price_cents || isNaN(sellingPriceVal) || sellingPriceVal <= 0) {
      errors.selling_price_cents = 'Selling price is required and must be greater than 0';
    }

    const shelfLifeVal = parseInt(newProduct.shelf_life_days);
    if (!newProduct.shelf_life_days || isNaN(shelfLifeVal) || shelfLifeVal <= 0) {
      errors.shelf_life_days = 'Shelf life of at least 1 day is required';
    }

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      triggerToast('Please correct validation errors on the form.', 'error');
      return;
    }

    setIsSubmitLoading(true);

    try {
      // Build precise POST schema as described
      const reqBody = {
        code: newProduct.code.trim().toUpperCase(),
        name: newProduct.name.trim(),
        category_id: newProduct.category_id,
        supplier_id: newProduct.supplier_id,
        temp_zone: newProduct.temp_zone,
        unit: newProduct.unit,
        
        // 9 UOM fields (possibly customised)
        base_unit: newProduct.base_unit,
        procurement_unit: newProduct.procurement_unit,
        procurement_unit_qty: Number(newProduct.procurement_unit_qty),
        count_unit: newProduct.count_unit,
        count_unit_qty: Number(newProduct.count_unit_qty),
        remainder_unit: newProduct.remainder_unit,
        remainder_unit_qty: Number(newProduct.remainder_unit_qty),
        display_unit: newProduct.display_unit,
        display_divisor: Number(newProduct.display_divisor),
        display_decimals: Number(newProduct.display_decimals),

        // Cost and selling prices converted to cents!
        cost_price_cents: Math.round(costPriceVal * 100),
        selling_price_cents: Math.round(sellingPriceVal * 100),

        // Shelf life / stock requirements
        shelf_life_days: Number(shelfLifeVal),
        reorder_level: Number(newProduct.reorder_level) || 0,
        reorder_qty: Number(newProduct.reorder_qty) || 0,
        weight_kg: newProduct.weight_kg ? Number(newProduct.weight_kg) : null,
        max_stock_level: newProduct.max_stock_level ? Number(newProduct.max_stock_level) : null,

        // Publication Status 
        publication_status: 'draft',
        published_at: null,
        published_by: null,
        readiness_pct: 0,
        is_active: true,

        // Optional/Advanced
        barcode: newProduct.barcode.trim() || null,
        requires_barcode: newProduct.requires_barcode === 'inherit' ? null : (newProduct.requires_barcode === 'required'),
        product_class: newProduct.product_class === 'inherit' ? null : newProduct.product_class,
        ethylene_profile: newProduct.ethylene_profile || 'neutral',
        description: newProduct.description.trim() || null,
        image_urls: []
      };

      const res = await fetch('/api/v1/skus', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });

      const json = await res.json().catch(() => null);

      if (res.status === 409 || json?.error?.code === 'CODE_EXISTS') {
        const errorMsg = json?.error?.message || 'Product/SKU code already exists in registry';
        setFormErrors(prev => ({ ...prev, code: errorMsg }));
        triggerToast(errorMsg, 'error');
        return;
      }

      if (!res.ok) {
        const fallbackMsg = json?.error?.message || 'Error occurred while saving new product SKU';
        triggerToast(fallbackMsg, 'error');
        return;
      }

      // Success!
      triggerToast(`Product SKU ${reqBody.code} created successfully!`, 'success');
      setShowNewProductModal(false);
      setNewProduct(initialNewProductState);
      setIsUnitConfigExpanded(false);
      setIsAdvancedExpanded(false);

      // Refresh list
      await loadData();
    } catch (err) {
      console.error(err);
      triggerToast('Failed to connect to the registry API.', 'error');
    } finally {
      setIsSubmitLoading(false);
    }
  };

  const handleQuickCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickCatError(null);

    if (!quickCategory.name.trim()) {
      setQuickCatError('Category name is required');
      return;
    }

    try {
      const res = await fetch('/api/v1/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: quickCategory.name.trim(),
          parent_id: quickCategory.parent_id || null,
          default_temp_zone: quickCategory.default_temp_zone,
          default_product_class: quickCategory.default_product_class || null,
          requires_barcode: quickCategory.requires_barcode
        })
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Failed to create category');
      }

      const created = json.data;
      triggerToast(`Category "${created.name}" created!`, 'success');
      
      // Update local state categories
      setCategories(prev => [...prev, created]);
      
      // Auto-select in form
      setNewProduct(prev => ({ ...prev, category_id: created.id }));

      // Reset state and close modal
      setShowQuickAddCategory(false);
      setQuickCategory({
        name: '',
        parent_id: '',
        default_temp_zone: 'ambient',
        default_product_class: '',
        requires_barcode: false
      });
    } catch (err: any) {
      setQuickCatError(err.message || 'An error occurred.');
    }
  };

  const handleQuickSupplierSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuickSupError(null);

    if (!quickSupplier.name.trim()) {
      setQuickSupError('Supplier name is required');
      return;
    }

    try {
      const res = await fetch('/api/v1/suppliers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: quickSupplier.name.trim(),
          contact_name: quickSupplier.contact_name.trim() || null,
          phone: quickSupplier.phone.trim() || null,
          email: quickSupplier.email.trim() || null,
          lead_time_days: Number(quickSupplier.lead_time_days) || 7,
          payment_terms: quickSupplier.payment_terms.trim() || null
        })
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.error?.message || 'Failed to create supplier');
      }

      const created = json.data;
      triggerToast(`Supplier "${created.name}" created!`, 'success');

      // Update local state suppliers
      setSuppliers(prev => [...prev, created]);

      // Auto-select in matching form dropdown
      if (quickAddSource === 'new_product') {
        setNewProduct(prev => ({ ...prev, supplier_id: created.id }));
      } else if (quickAddSource === 'vendor_card') {
        setNewCard(prev => ({ ...prev, supplier_id: created.id }));
      }

      // Reset state and close modal
      setShowQuickAddSupplier(false);
      setQuickSupplier({
        name: '',
        contact_name: '',
        phone: '',
        email: '',
        lead_time_days: 7,
        payment_terms: ''
      });
      setQuickAddSource(null);
    } catch (err: any) {
      setQuickSupError(err.message || 'An error occurred.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and subtabs switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-teal-500" />
            <span>Product Operations PIM Gate</span>
          </h1>
          <p className="text-xs text-slate-500">
            Publish products to catalogue after complying with rigorous 10-point warehouse integration checks.
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setActiveView('catalogue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer transition-all ${
              activeView === 'catalogue' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Product Catalogue
          </button>
          <button
            onClick={() => setActiveView('report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold min-h-[44px] cursor-pointer transition-all ${
              activeView === 'report' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            Readiness Report
          </button>
        </div>
      </div>

      {activeView === 'catalogue' ? (
        <>
          {/* Prominent SKU Search bar at the top */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <label htmlFor="top-sku-search-input" className="text-xs font-bold text-slate-705 flex items-center gap-1.5">
                <Search className="h-4 w-4 text-teal-500" />
                <span>Search & Filter SKU Registry</span>
              </label>
              <span className="text-[10px] text-slate-500 font-medium">
                Supports searching by SKU name, catalog code, or barcode
              </span>
            </div>
            <div className="relative">
              <Search className="absolute left-3.5 top-3.5 h-4 w-4 text-slate-400" />
              <input
                id="top-sku-search-input"
                type="text"
                placeholder="Type name, barcode (e.g. 600...), or catalog code (e.g. SKU-MILK)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50/30 outline-hidden focus:border-teal-500 focus:bg-white transition-all text-slate-800 placeholder-slate-400 min-h-[40px]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 p-1 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-655 transition min-h-[28px] min-w-[28px] flex items-center justify-center cursor-pointer"
                  title="Clear search query"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Summary Counts */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'Published', val: skusWithReadiness.filter(s => s.sku.publication_status === 'published').length, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Ready (Unpublished)', val: skusWithReadiness.filter(s => s.status === 'ready' && s.sku.publication_status !== 'published').length, color: 'text-teal-600 bg-teal-50' },
              { label: 'In Progress', val: skusWithReadiness.filter(s => s.readiness.pct < 100 && s.readiness.pct > 0 && s.sku.publication_status !== 'published').length, color: 'text-amber-600 bg-amber-50' },
              { label: 'Draft', val: skusWithReadiness.filter(s => s.sku.publication_status === 'draft' || !s.sku.publication_status).length, color: 'text-slate-600 bg-slate-50' },
              { label: 'Archived', val: skusWithReadiness.filter(s => s.sku.publication_status === 'archived').length, color: 'text-rose-600 bg-rose-50' }
            ].map(card => (
              <div key={card.label} className={`p-3 rounded-xl border border-slate-100 flex flex-col justify-between ${card.color}`}>
                <span className="text-[10px] font-black uppercase tracking-wider opacity-85 block">{card.label}</span>
                <span className="text-lg font-black mt-1 block">{card.val}</span>
              </div>
            ))}
          </div>

          {/* Filters List Area */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center overflow-x-auto gap-1 py-1 no-scrollbar max-w-full">
              {['All', 'Published', 'Ready', 'In Progress', 'Draft', 'Archived'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap min-h-[44px] cursor-pointer transition-all ${
                    activeTab === tab
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {(currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowBulkUploadModal(true)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-705 border border-slate-200 font-bold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1 cursor-pointer shadow-xs"
                    title="Upload multiple SKUs from Excel"
                  >
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    <span>Bulk Upload</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewProductModal(true)}
                    className="px-3 py-1.5 bg-teal-500 hover:bg-teal-450 text-slate-950 font-bold text-xs rounded-xl transition min-h-[44px] flex items-center gap-1 cursor-pointer shadow-xs"
                  >
                    <Plus className="h-4 w-4" />
                    <span>New Product</span>
                  </button>
                </>
              )}
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
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Table list left */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-white rounded-2xl border border-slate-150 overflow-hidden">
                  
                  {/* SKUs List Table */}

                  {filteredItems.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 text-xs">No products correspond to the chosen filter.</div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold uppercase tracking-wider">
                            <th className="p-4">Product Name</th>
                            <th className="p-4">Category</th>
                            <th className="p-4">Temp Zone</th>
                            <th className="p-4">Readiness Pct</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Vendors</th>
                            <th className="p-4 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredItems.map(item => {
                            const isSel = selectedSku?.id === item.sku.id;
                            
                            // Color bar setting
                            const barColor = item.readiness.pct >= 80 ? 'bg-emerald-500' : item.readiness.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';

                            // Badge display styles
                            const statusStyle = 
                              item.sku.publication_status === 'published' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' :
                              item.status === 'ready' ? 'bg-teal-50 text-teal-800 border-teal-200' :
                              item.sku.publication_status === 'archived' ? 'bg-rose-50 text-rose-800 border-rose-200' :
                              'bg-slate-50 text-slate-600 border-slate-200';

                            const activeVcsCount = vendorCards.filter(vc => vc.sku_id === item.sku.id).length;

                            return (
                              <tr
                                key={item.sku.id}
                                onClick={() => setSelectedSku(item.sku)}
                                className={`hover:bg-slate-50/70 transition-colors cursor-pointer ${isSel ? 'bg-teal-50/40 hover:bg-teal-50/50' : ''}`}
                              >
                                <td className="p-4">
                                  <div className="font-bold text-slate-900 leading-normal">{item.sku.name}</div>
                                  <span className="text-[10px] text-slate-400 font-mono font-semibold block mt-0.5">{item.sku.code}</span>
                                </td>
                                <td className="p-4 text-slate-700">{categories.find(c => c.id === item.sku.category_id)?.name || 'None'}</td>
                                <td className="p-4">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-900 font-bold uppercase">
                                    {item.sku.temp_zone}
                                  </span>
                                </td>
                                <td className="p-4">
                                  <div className="flex items-center gap-2">
                                    <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden shrink-0">
                                      <div className={`h-full ${barColor}`} style={{ width: `${item.readiness.pct}%` }} />
                                    </div>
                                    <span className="font-black text-slate-950 font-mono">{item.readiness.pct}%</span>
                                  </div>
                                </td>
                                <td className="p-4">
                                  <span className={`px-2 py-0.5 font-bold text-[9px] uppercase border rounded-full ${statusStyle}`}>
                                    {item.sku.publication_status || 'draft'}
                                  </span>
                                </td>
                                <td className="p-4 font-bold text-slate-700 text-center">{activeVcsCount}</td>
                                <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                                  <div className="flex items-center justify-end gap-1.5">
                                    {item.sku.publication_status !== 'published' && item.readiness.pct === 100 && (
                                      <button
                                        onClick={() => handleStatusChange(item.sku.id, 'published')}
                                        className="bg-emerald-505 dark:bg-emerald-600 text-white font-bold p-1 px-2.5 rounded text-[10.5px] hover:bg-emerald-700 min-h-[44px] flex items-center justify-center cursor-pointer shadow-xs"
                                      >
                                        Publish
                                      </button>
                                    )}

                                    {item.sku.publication_status === 'published' && (
                                      <button
                                        onClick={() => handleStatusChange(item.sku.id, 'draft')}
                                        className="bg-amber-100 text-amber-900 font-bold p-1 px-2.5 rounded text-[10.5px] hover:bg-amber-200 min-h-[44px] flex items-center justify-center cursor-pointer"
                                      >
                                        Unpublish
                                      </button>
                                    )}

                                    {item.sku.publication_status !== 'archived' && (
                                      <button
                                        onClick={() => handleArchive(item.sku.id)}
                                        className="bg-slate-100 hover:bg-slate-200 text-slate-650 p-1 px-2 rounded font-bold text-[10.5px] min-h-[44px] flex items-center justify-center cursor-pointer"
                                        title="Archive (Assumes zero stock check is completed)"
                                      >
                                        Archive
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* Side panel: Product details checklist and editing */}
              <div className="lg:col-span-1">
                {selectedSku ? (
                  (() => {
                    const requiresBarcode = getEffectiveRequiresBarcode(selectedSku);
                    const { pct, checklist, missing } = calculateReadiness(selectedSku, vendorCards);
                    const isPublished = selectedSku.publication_status === 'published';

                    return (
                      <div className="bg-white border border-slate-150 rounded-2xl p-4 space-y-6 sticky top-6">
                        {/* Selected product header */}
                        <div className="flex justify-between items-start border-b border-slate-100 pb-3">
                          <div>
                            <h3 className="font-bold text-slate-900 text-sm">{selectedSku.name}</h3>
                            <span className="text-[10.5px] font-mono text-slate-500 font-black mt-0.5 block">{selectedSku.code}</span>
                          </div>
                          
                          <button
                            onClick={() => setSelectedSku(null)}
                            className="p-1 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer"
                          >
                            <X className="h-4.5 w-4.5 text-slate-400" />
                          </button>
                        </div>

                        {/* Publication Control Panel */}
                        {(() => {
                          const current_status = selectedSku.publication_status || 'draft';
                          const has_stock_or_ready = selectedSku.current_stock > 0 || pct === 100;

                          if (!has_stock_or_ready) return null;

                          return (
                            <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
                              <div>
                                <h4 className="font-bold text-slate-900 text-xs tracking-tight">Publication Control Panel</h4>
                                <p className="text-[10px] text-slate-500 leading-normal mt-0.5">
                                  Manage the commercial availability and PIM publication lifecycle of this SKU.
                                </p>
                              </div>

                              <div className="flex items-center justify-between border-y border-slate-100 py-2">
                                <span className="text-[10px] uppercase font-black tracking-wider text-slate-450">Current Status</span>
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  current_status === 'published' ? 'bg-emerald-100 text-emerald-850' :
                                  current_status === 'blocked' ? 'bg-amber-100 text-amber-850' :
                                  current_status === 'delisted' ? 'bg-rose-100 text-rose-850' :
                                  current_status === 'archived' ? 'bg-slate-200 text-slate-700' :
                                  current_status === 'ready' ? 'bg-teal-100 text-teal-850' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {current_status}
                                </span>
                              </div>

                              <p className="text-[10.5px] text-slate-600 leading-relaxed italic">
                                {current_status === 'draft' && 'Product is in preparation and is not visible to the ordering platform or inventory team.'}
                                {current_status === 'ready' && 'Product has passed PIM validation and is cleared for publishing to the ordering catalog.'}
                                {current_status === 'published' && 'Product is active in the ordering catalog, visible to dispatch, and available for purchasing.'}
                                {current_status === 'blocked' && 'Product ordering is suspended. Stock continues to be tracked in inventory but cannot be added to customer orders.'}
                                {current_status === 'delisted' && 'Product is permanently removed from catalog ordering. Historical records are preserved.'}
                                {current_status === 'archived' && 'Product is retired and inactive. No ordering or replenishment is allowed.'}
                              </p>

                              {/* Action transitions */}
                              <div className="flex gap-2 flex-wrap pt-1">
                                {(currentUser?.role === 'admin' || currentUser?.role === 'ops_manager') && (
                                  <>
                                    {(current_status === 'draft' || current_status === 'ready') && (
                                      <button
                                        type="button"
                                        onClick={() => handleStatusChange(selectedSku.id, 'published')}
                                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                      >
                                        Publish SKU
                                      </button>
                                    )}

                                    {current_status === 'published' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange(selectedSku.id, 'blocked')}
                                          className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                        >
                                          Block
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange(selectedSku.id, 'delisted')}
                                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                        >
                                          Delist
                                        </button>
                                      </>
                                    )}

                                    {current_status === 'blocked' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange(selectedSku.id, 'published')}
                                          className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                        >
                                          Unblock
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleStatusChange(selectedSku.id, 'delisted')}
                                          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                        >
                                          Delist
                                        </button>
                                      </>
                                    )}

                                    {(current_status === 'delisted' || current_status === 'blocked' || current_status === 'draft') && (
                                      <button
                                        type="button"
                                        onClick={() => handleStatusChange(selectedSku.id, 'archived')}
                                        className="flex-1 bg-slate-600 hover:bg-slate-700 text-white font-bold text-[11px] py-1.5 px-3 rounded-lg transition-colors cursor-pointer min-h-[36px]"
                                      >
                                        Archive SKU
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Top banner checklist message */}
                        {pct === 100 ? (
                          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-950 font-semibold text-xs flex gap-2">
                            <BookOpenCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black block">100% Ready to Publish</span>
                              <p className="text-[10px] opacity-90 leading-normal mt-0.5">All supply parameters, barcodes, and supplier cards are fully satisfied.</p>
                            </div>
                          </div>
                        ) : pct >= 80 ? (
                          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 font-semibold text-xs flex gap-2">
                            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black block">Almost ready â€” {missing.length} Missing</span>
                              <p className="text-[10px] opacity-90 leading-normal mt-0.5">Please resolve the checklist gaps listed below before publishing.</p>
                            </div>
                          </div>
                        ) : (
                          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-950 font-semibold text-xs flex gap-2">
                            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
                            <div>
                              <span className="font-black block">Incomplete â€” {missing.length} Items Needed</span>
                              <p className="text-[10px] opacity-90 leading-normal mt-0.5">A minimum score of 100% is required to clear this SKU for active publication.</p>
                            </div>
                          </div>
                        )}

                        {/* checklist map */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-450 tracking-wider">PIM Audit Checklist ({pct}% Complete)</span>
                          <div className="grid grid-cols-2 gap-2 text-[11px]">
                            
                            {[
                              { label: 'Product Name', done: checklist.name },
                              { label: 'Category Assigned', done: checklist.category },
                              { label: 'Temperature Zone', done: checklist.temp_zone },
                              { label: 'Unit Of measure', done: checklist.unit },
                              { label: 'Shelf Life (>0 Days)', done: checklist.shelf_life },
                              { label: 'Selling Price (>0)', done: checklist.selling_price },
                              { label: 'Cost Price (>0)', done: checklist.cost_price },
                              { label: 'Product Image', done: checklist.images },
                              { label: 'Preferred Vendor', done: checklist.vendor }
                            ].map(item => (
                              <div key={item.label} className="flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded">
                                {item.done ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                )}
                                <span className={item.done ? 'text-slate-800' : 'text-slate-400 font-semibold'}>{item.label}</span>
                              </div>
                            ))}

                            {requiresBarcode && (
                              <div className="flex items-center gap-1.5 p-1 bg-slate-50 border border-slate-100 rounded">
                                {checklist.barcode ? (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                                ) : (
                                  <XCircle className="h-3.5 w-3.5 text-rose-500" />
                                )}
                                <span className={checklist.barcode ? 'text-slate-800' : 'text-slate-400 font-semibold'}>Barcode Linked</span>
                              </div>
                            )}

                          </div>
                        </div>

                        {/* Description Editor (Save on Blur) */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-black uppercase text-slate-450 block">PIM Product Description</label>
                          <textarea
                            placeholder="Provide product features, ingredients or logistics guidance..."
                            defaultValue={selectedSku.description || ''}
                            onBlur={(e) => updateSkuValue(selectedSku.id, { description: e.target.value })}
                            className="w-full border p-2 text-xs rounded-xl bg-slate-50/50 outline-hidden focus:bg-white focus:border-slate-400"
                            rows={2}
                          />
                        </div>

                        {/* Barcode Scanner with dynamic type overrides info */}
                        <div className="p-3 border border-slate-150 rounded-xl space-y-2 text-xs bg-slate-50/50">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-700">Digital Barcode Gateway</span>
                            <span className="text-[8.5px] uppercase font-black tracking-wider text-slate-400 bg-white px-1.5 py-0.5 border rounded">
                              {selectedSku.requires_barcode === true ? 'SKU FORCE' : selectedSku.requires_barcode === false ? 'DISABLED' : 'AUTO CATEGORY'}
                            </span>
                          </div>

                          <div className="text-[11px] text-slate-500 leading-normal">
                            Associated Barcode: <strong className="font-mono text-slate-900">{selectedSku.barcode || 'None / Type to scan'}</strong>
                          </div>

                          <BarcodeInput 
                            onScan={(code) => {
                              updateSkuValue(selectedSku.id, { barcode: code });
                              triggerToast(`Barcode ${code} scanned and registered!`, 'success');
                            }}
                            placeholder="Scan/Type and hit enter..."
                          />
                        </div>

                        {/* Product images layout */}
                        <div className="space-y-2">
                          <span className="text-[10px] font-black uppercase text-slate-450 block">Product Gallery</span>
                          <div className="flex gap-2 items-center flex-wrap">
                            {(selectedSku.image_urls || []).map((url, i) => (
                              <div key={i} className="h-10 w-10 border border-slate-200 bg-slate-100 rounded-lg overflow-hidden flex items-center justify-center relative group">
                                <img src={url} className="h-full w-full object-cover" referrerPolicy="no-referrer" alt="SKU Spec" />
                                <button
                                  onClick={() => {
                                    const nextUrls = (selectedSku.image_urls || []).filter(u => u !== url);
                                    updateSkuValue(selectedSku.id, { image_urls: nextUrls });
                                    triggerToast('Image URL deleted.', 'info');
                                  }}
                                  className="absolute inset-0 bg-rose-500/80 text-white font-bold text-[9px] flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
                                >
                                  DEL
                                </button>
                              </div>
                            ))}
                          </div>

                          <div className="flex gap-1.5">
                            <input
                              type="text"
                              placeholder="Add direct image URL..."
                              value={imageUrlInput}
                              onChange={(e) => setImageUrlInput(e.target.value)}
                              className="border p-1.5 text-xs rounded-xl flex-1 focus:border-slate-400 focus:outline-hidden"
                            />
                            <button
                              onClick={handleAddImage}
                              className="bg-slate-900 text-white text-xs px-3 font-bold rounded-xl min-h-[44px] shrink-0 cursor-pointer"
                            >
                              Add
                            </button>
                          </div>
                        </div>

                        {/* Supplier vendor cards panel lists */}
                        <div className="space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-slate-450">Supplier Vendor Cards</span>
                            <button
                              onClick={() => setShowAddCard(true)}
                              className="text-[10.5px] font-black text-teal-600 hover:text-teal-700 min-h-[44px] flex items-center cursor-pointer"
                            >
                              + Add card
                            </button>
                          </div>

                          <div className="space-y-2">
                            {vendorCards.filter(vc => vc.sku_id === selectedSku.id).map(card => {
                              const supName = suppliers.find(s => s.id === card.supplier_id)?.name || 'Direct Vendor';
                              return (
                                <div key={card.id} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 relative space-y-1">
                                  <div className="flex justify-between items-start">
                                    <div className="text-xs">
                                      <strong className="text-slate-900 leading-normal block">{supName}</strong>
                                      <span className="text-[9.5px] text-slate-400 font-mono block">Code: {card.supplier_sku_code}</span>
                                    </div>
                                    <div className="flex gap-1.5">
                                      <button
                                        onClick={() => handleSetPreferredVendor(card.id, selectedSku.id)}
                                        className={`p-1 rounded cursor-pointer ${
                                          card.is_preferred ? 'text-teal-500' : 'text-slate-300 hover:text-slate-500'
                                        }`}
                                        title="Preferred supply"
                                      >
                                        <Heart className="h-4.5 w-4.5 stroke-[2.5]" fill={card.is_preferred ? 'currentColor' : 'none'} />
                                      </button>
                                      <button
                                        onClick={async () => {
                                          try {
                                             const res = await fetch(`/api/v1/vendor-cards/${card.id}`, { method: 'DELETE' });
                                             if (res.ok) {
                                               const next = vendorCards.filter(vc => vc.id !== card.id);
                                               setVendorCards(next);
                                               triggerToast('Supplier Vendor Card removed.', 'info');
                                             } else {
                                               const json = await res.json().catch(() => null);
                                               triggerToast(json?.error?.message || 'Could not delete supplier card.', 'error');
                                             }
                                          } catch {
                                            triggerToast('Failed to delete supplier card.', 'error');
                                          }
                                        }}
                                        className="text-slate-350 hover:text-rose-500 p-1 rounded cursor-pointer"
                                        title="Delete Supplier card"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-2 gap-x-2 text-[10.5px] text-slate-500 font-mono">
                                    <span>Price: <strong>KES {(card.price_cents / 100).toLocaleString()}</strong></span>
                                    <span>MOQ: <strong>{card.moq} {card.supplier_unit}s</strong></span>
                                    <span>Lead: <strong>{card.lead_time_days} days</strong></span>
                                    <span>Capacity: <strong>{card.units_per_supplier_unit} base/unit</strong></span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Add Supplier Card form overlay modal internally */}
                        {showAddCard && (
                          <div className="p-4 border border-slate-200 bg-slate-50 rounded-2xl space-y-3">
                            <span className="font-bold text-xs block">Choose Supplier details</span>
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <label className="text-[10px] text-slate-450 font-bold block">Supplier</label>
                                {(currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowQuickAddSupplier(true);
                                      setQuickAddSource('vendor_card');
                                    }}
                                    className="text-[10px] font-bold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer"
                                  >
                                    + New Supplier
                                  </button>
                                )}
                              </div>
                              <select
                                value={newCard.supplier_id}
                                onChange={(e) => setNewCard(p => ({ ...p, supplier_id: e.target.value }))}
                                className="w-full border p-1 rounded text-xs bg-white focus:outline-hidden"
                              >
                                <option value="">-- Select supplier --</option>
                                {suppliers.map(s => (
                                  <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                              </select>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-[10px] text-slate-450 font-bold block mb-1">SKU Supplier Code</label>
                                <input
                                  type="text"
                                  value={newCard.supplier_sku_code}
                                  onChange={(e) => setNewCard(p => ({ ...p, supplier_sku_code: e.target.value }))}
                                  className="w-full border p-1 rounded text-xs"
                                  placeholder="e.g. S-CHICK"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-450 font-bold block mb-1">Price {currencyCode} (standard)</label>
                                <input
                                  type="number"
                                  value={newCard.price_cents_full}
                                  onChange={(e) => setNewCard(p => ({ ...p, price_cents_full: parseFloat(e.target.value) || 0 }))}
                                  className="w-full border p-1 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-450 font-bold block mb-1">MOQ</label>
                                <input
                                  type="number"
                                  value={newCard.moq}
                                  onChange={(e) => setNewCard(p => ({ ...p, moq: parseInt(e.target.value) || 1 }))}
                                  className="w-full border p-1 rounded text-xs"
                                />
                              </div>
                              <div>
                                <label className="text-[10px] text-slate-450 font-bold block mb-1">Lead Time (Days)</label>
                                <input
                                  type="number"
                                  value={newCard.lead_time_days}
                                  onChange={(e) => setNewCard(p => ({ ...p, lead_time_days: parseInt(e.target.value) || 1 }))}
                                  className="w-full border p-1 rounded text-xs"
                                />
                              </div>
                            </div>

                            {/* Preferred Toggle */}
                            <label className="flex items-center gap-1.5 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={newCard.is_preferred}
                                onChange={(e) => setNewCard(p => ({ ...p, is_preferred: e.target.checked }))}
                              />
                              <span className="text-[10.5px] font-bold text-slate-700">Set as preferred supplier?</span>
                            </label>

                            <div className="flex gap-2">
                              <button
                                onClick={handleAddNewVendorCard}
                                className="bg-teal-500 text-slate-950 font-bold px-3 py-1 rounded text-xs cursor-pointer min-h-[44px]"
                              >
                                Save Supplier
                              </button>
                              <button
                                onClick={() => setShowAddCard(false)}
                                className="bg-slate-200 text-slate-600 font-bold px-3 py-1 rounded text-xs cursor-pointer min-h-[44px]"
                              >
                                Close
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Publish product overlay banner details */}
                        {pct === 100 && !isPublished && (
                          <button
                            onClick={() => handleStatusChange(selectedSku.id, 'published')}
                            className="w-full bg-emerald-500 hover:bg-emerald-450 font-black py-2.5 rounded-xl text-slate-950 text-xs shadow-xs min-h-[44px]"
                          >
                            Release & Publish Product
                          </button>
                        )}

                        {/* Price History */}
                        <div className="border-t border-slate-100 pt-4">
                          <PriceHistoryPanel
                            skuId={selectedSku.id}
                            skuName={selectedSku.name}
                            currentCostPrice={selectedSku.cost_price_cents}
                            currentSellingPrice={selectedSku.selling_price_cents}
                            currentUser={currentUser}
                            triggerToast={triggerToast}
                            onPriceChanged={() => {
                              // Refresh the SKU in local state after a price change
                              fetch('/api/v1/skus')
                                .then(r => r.json())
                                .then(payload => {
                                  if (payload.data) {
                                    setSkus(payload.data);
                                    // Also update selectedSku to reflect new prices
                                    const updated = payload.data.find(
                                      (s: SKU) => s.id === selectedSku.id
                                    );
                                    if (updated) setSelectedSku(updated);
                                  }
                                })
                                .catch(() => {});
                            }}
                          />
                        </div>

                      </div>
                    );
                  })()
                ) : (
                  <div className="bg-slate-50 border border-dashed border-slate-200 p-8 text-center text-slate-400 text-xs rounded-2xl flex flex-col items-center justify-center space-y-2">
                    <BookOpenCheck className="h-8 w-8 text-slate-300 stroke-[1.5]" />
                    <span>Select a product row to view and audit checklist parameters.</span>
                  </div>
                )}
              </div>

            </div>
          )}
        </>
      ) : (
        /* READINESS SUMMARY REPORT SUBTAB */
        <div className="bg-white border border-slate-150 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h2 className="text-sm font-bold text-slate-900 leading-none">Products Readiness Diagnostics</h2>
              <span className="text-[10px] text-slate-400 block mt-1">Diagnose incomplete registry variables instantly.</span>
            </div>
            
            <div className="flex gap-2">
              <button
                onClick={handleExportCSV}
                className="bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors px-3 py-1.5 rounded-lg text-slate-700 text-xs font-bold leading-none flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Export CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportXLSX}
                className="bg-slate-100 border border-slate-200 hover:bg-slate-200 transition-colors px-3 py-1.5 rounded-lg text-slate-700 text-xs font-bold leading-none flex items-center gap-1.5 min-h-[44px] cursor-pointer"
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>Export XLSX</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto text-xs">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-indigo-100 text-slate-450 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3">Product Spec</th>
                  <th className="p-3">Readiness Score</th>
                  <th className="p-3">Status Badge</th>
                  <th className="p-3">Missing Checklist Requirements</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {skusWithReadiness
                  .filter(item => item.readiness.pct < 100)
                  .sort((a, b) => a.readiness.pct - b.readiness.pct)
                  .map(item => {
                    const barColor = item.readiness.pct >= 80 ? 'bg-emerald-500' : item.readiness.pct >= 50 ? 'bg-amber-500' : 'bg-rose-500';
                    return (
                      <tr key={item.sku.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <div className="font-bold text-slate-900 leading-normal">{item.sku.name}</div>
                          <span className="text-[10px] text-slate-450 font-mono italic block">{item.sku.code}</span>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden shrink-0">
                              <div className={`h-full ${barColor}`} style={{ width: `${item.readiness.pct}%` }} />
                            </div>
                            <span className="font-black font-mono text-slate-950">{item.readiness.pct}%</span>
                          </div>
                        </td>
                        <td className="p-3 uppercase">
                          <span className="bg-slate-100 text-slate-700 font-bold text-[9px] px-2 py-0.5 border rounded">
                            {item.sku.publication_status || 'draft'}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {item.readiness.missing.map(m => (
                              <span key={m} className="bg-rose-50 border border-rose-100 text-rose-800 text-[9px] font-bold px-1.5 rounded-full inline-block">
                                {m}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                }
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showBulkUploadModal && (
        <BulkSkuUploadModal
          isOpen={showBulkUploadModal}
          onClose={() => setShowBulkUploadModal(false)}
          categories={categories}
          suppliers={suppliers}
          onUploadSuccess={loadData}
          triggerToast={triggerToast}
          currentUser={currentUser}
        />
      )}

      {/* Confirm Status Change for Stocked Item Modal */}
      {showStockWarningModal && stockWarningData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full p-6 animate-fadeIn">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-rose-50 border border-rose-100 rounded-xl text-rose-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Confirm Status Change for Stocked Item</h3>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  This product currently has active stock in the warehouse. Setting status to <strong>{stockWarningData.newStatus}</strong> will suspend ordering, but physical units will still be tracked in inventory. Do you wish to proceed?
                </p>
                <div className="mt-3 p-2 bg-slate-50 border border-slate-100 rounded-lg text-xs">
                  <span className="text-slate-500 block text-[10px] uppercase font-black tracking-wider">Current Stock On Hand</span>
                  <strong className="text-slate-800 text-sm mt-0.5 block">{stockWarningData.stockOnHand} units</strong>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 justify-end mt-6">
              <button
                type="button"
                onClick={() => {
                  setShowStockWarningModal(false);
                  setStockWarningData(null);
                }}
                className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl transition min-h-[44px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const data = stockWarningData;
                  setShowStockWarningModal(false);
                  setStockWarningData(null);
                  await handleStatusChange(data.skuId, data.newStatus, true);
                }}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition min-h-[44px] cursor-pointer shadow-xs"
              >
                Yes, Confirm Status Change
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Product Form Modal */}
      {showNewProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-2xl w-full max-h-[90vh] overflow-y-auto flex flex-col animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  Create New Product in Registry
                </h2>
                <p className="text-[10px] text-slate-500">Add a draft product for validation checks & catalog readiness.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowNewProductModal(false);
                  setNewProduct(initialNewProductState);
                  setFormErrors({});
                  setIsUnitConfigExpanded(false);
                  setIsAdvancedExpanded(false);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-450 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Form Content */}
            <form onSubmit={handleCreateProductSubmit} className="p-5 space-y-6 flex-1 overflow-y-auto">
              
              {/* SECTION 1 â€” Basics */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-1">
                  Section 1 â€” Basics
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Product Name */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Product Name <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newProduct.name}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, name: e.target.value }));
                        if (formErrors.name) setFormErrors(errs => { const next = { ...errs }; delete next.name; return next; });
                      }}
                      placeholder="e.g. Red Gala Apples"
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-hidden focus:border-slate-400 ${formErrors.name ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    {formErrors.name && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.name}</span>}
                  </div>

                  {/* Product Code */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Product Code <span className="text-rose-500">*</span></label>
                    <input
                      type="text"
                      required
                      value={newProduct.code}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, code: e.target.value.toUpperCase().replace(/\s+/g, '-') }));
                        if (formErrors.code) setFormErrors(errs => { const next = { ...errs }; delete next.code; return next; });
                      }}
                      placeholder="e.g. APP-RED-GALA"
                      className={`w-full px-3 py-2 border rounded-xl text-xs font-mono uppercase outline-hidden focus:border-slate-400 ${formErrors.code ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    {formErrors.code && <span className="text-[10px] text-rose-500 mt-1 block font-semibold">{formErrors.code}</span>}
                  </div>

                  {/* Category */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">Category <span className="text-rose-500">*</span></label>
                      {(currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => setShowQuickAddCategory(true)}
                          className="text-[10.5px] font-black text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          + New Category
                        </button>
                      )}
                    </div>
                    <select
                      required
                      value={newProduct.category_id}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, category_id: e.target.value }));
                        if (formErrors.category_id) setFormErrors(errs => { const next = { ...errs }; delete next.category_id; return next; });
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs bg-white outline-hidden focus:border-slate-400 ${formErrors.category_id ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    >
                      {categories.length === 0 ? (
                        <option disabled>Loading categories...</option>
                      ) : (
                        <>
                          <option value="">-- Select Category --</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                    {formErrors.category_id && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.category_id}</span>}
                  </div>

                  {/* Supplier */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">Supplier <span className="text-rose-500">*</span></label>
                      {(currentUser?.role === 'ops_manager' || currentUser?.role === 'admin') && (
                        <button
                          type="button"
                          onClick={() => {
                            setShowQuickAddSupplier(true);
                            setQuickAddSource('new_product');
                          }}
                          className="text-[10.5px] font-black text-teal-600 hover:text-teal-700 hover:underline flex items-center gap-0.5 cursor-pointer"
                        >
                          + New Supplier
                        </button>
                      )}
                    </div>
                    <select
                      required
                      value={newProduct.supplier_id}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, supplier_id: e.target.value }));
                        if (formErrors.supplier_id) setFormErrors(errs => { const next = { ...errs }; delete next.supplier_id; return next; });
                      }}
                      className={`w-full px-3 py-2 border rounded-xl text-xs bg-white outline-hidden focus:border-slate-400 ${formErrors.supplier_id ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    >
                      {suppliers.length === 0 ? (
                        <option disabled>Loading suppliers...</option>
                      ) : (
                        <>
                          <option value="">-- Select Supplier --</option>
                          {suppliers.map(sup => (
                            <option key={sup.id} value={sup.id}>{sup.name}</option>
                          ))}
                        </>
                      )}
                    </select>
                    {formErrors.supplier_id && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.supplier_id}</span>}
                  </div>

                  {/* Temperature Zone */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Temperature Zone <span className="text-rose-500">*</span></label>
                    <select
                      required
                      value={newProduct.temp_zone}
                      onChange={(e) => setNewProduct(p => ({ ...p, temp_zone: e.target.value }))}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                    >
                      <option value="frozen">Frozen</option>
                      <option value="chilled">Chilled</option>
                      <option value="cool">Cool</option>
                      <option value="ambient">Ambient</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* SECTION 2 â€” Unit & Pricing */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-1">
                  Section 2 â€” Unit & Pricing
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Base Unit of Measure */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Primary Unit <span className="text-rose-500">*</span></label>
                    <select
                      value={newProduct.unit}
                      onChange={(e) => handleUnitChange(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                    >
                      <option value="each">each (Each piece)</option>
                      <option value="kg">kg (Kilogram)</option>
                      <option value="g">g (Gram)</option>
                      <option value="litre">litre (Litre)</option>
                      <option value="ml">ml (Millilitre)</option>
                      <option value="pack">pack (Package bundle)</option>
                    </select>
                  </div>
                </div>

                {/* Expandable UOM settings */}
                <div className="bg-slate-50 border border-slate-150 rounded-xl p-3">
                  <button
                    type="button"
                    onClick={() => setIsUnitConfigExpanded(!isUnitConfigExpanded)}
                    className="text-[10.5px] font-extrabold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer min-h-[44px]"
                  >
                    <span>{isUnitConfigExpanded ? 'â–¼ Hide' : 'â–¶ Customise'} detailed unit variables (Auto-loaded via preset)</span>
                  </button>

                  {isUnitConfigExpanded && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2 pt-3 border-t border-slate-200/60 font-mono">
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Base Unit</label>
                        <input
                          type="text"
                          value={newProduct.base_unit}
                          onChange={(e) => setNewProduct(p => ({ ...p, base_unit: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Procurement Unit</label>
                        <input
                          type="text"
                          value={newProduct.procurement_unit}
                          onChange={(e) => setNewProduct(p => ({ ...p, procurement_unit: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Procurement Qty</label>
                        <input
                          type="number"
                          value={newProduct.procurement_unit_qty}
                          onChange={(e) => setNewProduct(p => ({ ...p, procurement_unit_qty: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Count Unit</label>
                        <input
                          type="text"
                          value={newProduct.count_unit}
                          onChange={(e) => setNewProduct(p => ({ ...p, count_unit: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Count Qty</label>
                        <input
                          type="number"
                          value={newProduct.count_unit_qty}
                          onChange={(e) => setNewProduct(p => ({ ...p, count_unit_qty: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Remainder Unit</label>
                        <input
                          type="text"
                          value={newProduct.remainder_unit}
                          onChange={(e) => setNewProduct(p => ({ ...p, remainder_unit: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Remainder Qty</label>
                        <input
                          type="number"
                          value={newProduct.remainder_unit_qty}
                          onChange={(e) => setNewProduct(p => ({ ...p, remainder_unit_qty: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Display Unit</label>
                        <input
                          type="text"
                          value={newProduct.display_unit}
                          onChange={(e) => setNewProduct(p => ({ ...p, display_unit: e.target.value }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Display Divisor</label>
                        <input
                          type="number"
                          value={newProduct.display_divisor}
                          onChange={(e) => setNewProduct(p => ({ ...p, display_divisor: parseFloat(e.target.value) || 1 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-slate-500 block mb-0.5 uppercase font-sans">Display Decimals</label>
                        <input
                          type="number"
                          value={newProduct.display_decimals}
                          onChange={(e) => setNewProduct(p => ({ ...p, display_decimals: parseInt(e.target.value) || 0 }))}
                          className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs font-mono bg-white"
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Cost Price */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Cost Price ({currencyCode}) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newProduct.cost_price_cents}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, cost_price_cents: e.target.value }));
                        if (formErrors.cost_price_cents) setFormErrors(errs => { const next = { ...errs }; delete next.cost_price_cents; return next; });
                      }}
                      placeholder="e.g. 450.50"
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-hidden focus:border-slate-400 ${formErrors.cost_price_cents ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    {formErrors.cost_price_cents && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.cost_price_cents}</span>}
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Selling Price ({currencyCode}) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={newProduct.selling_price_cents}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, selling_price_cents: e.target.value }));
                        if (formErrors.selling_price_cents) setFormErrors(errs => { const next = { ...errs }; delete next.selling_price_cents; return next; });
                      }}
                      placeholder="e.g. 599.00"
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-hidden focus:border-slate-400 ${formErrors.selling_price_cents ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    {formErrors.selling_price_cents && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.selling_price_cents}</span>}
                  </div>

                  {/* Shelf Life Days */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Shelf Life (Days) <span className="text-rose-500">*</span></label>
                    <input
                      type="number"
                      required
                      value={newProduct.shelf_life_days}
                      onChange={(e) => {
                        setNewProduct(p => ({ ...p, shelf_life_days: e.target.value }));
                        if (formErrors.shelf_life_days) setFormErrors(errs => { const next = { ...errs }; delete next.shelf_life_days; return next; });
                      }}
                      placeholder="e.g. 7"
                      className={`w-full px-3 py-2 border rounded-xl text-xs outline-hidden focus:border-slate-400 ${formErrors.shelf_life_days ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'}`}
                    />
                    {formErrors.shelf_life_days && <span className="text-[10px] text-rose-500 mt-1 block font-medium">{formErrors.shelf_life_days}</span>}
                  </div>
                </div>
              </div>

              {/* SECTION 3 â€” Stock Planning */}
              <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-wider text-slate-450 border-b border-slate-100 pb-1">
                  Section 3 â€” Stock Planning
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Reorder Level */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Reorder Level (Base Units)</label>
                    <input
                      type="number"
                      required
                      value={newProduct.reorder_level}
                      onChange={(e) => setNewProduct(p => ({ ...p, reorder_level: e.target.value }))}
                      placeholder="e.g. 100"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400"
                    />
                  </div>

                  {/* Reorder Quantity */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Reorder Quantity (Base Units)</label>
                    <input
                      type="number"
                      required
                      value={newProduct.reorder_qty}
                      onChange={(e) => setNewProduct(p => ({ ...p, reorder_qty: e.target.value }))}
                      placeholder="e.g. 500"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400"
                    />
                  </div>

                  {/* Weight Kg */}
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Weight per unit (kg)</label>
                    <input
                      type="number"
                      step="0.001"
                      value={newProduct.weight_kg}
                      onChange={(e) => setNewProduct(p => ({ ...p, weight_kg: e.target.value }))}
                      placeholder="e.g. 0.25 (optional)"
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 4 â€” Advanced */}
              <div className="space-y-4">
                <div className="border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsAdvancedExpanded(!isAdvancedExpanded)}
                    className="text-[10.5px] font-extrabold text-teal-600 hover:text-teal-700 flex items-center gap-1 cursor-pointer min-h-[44px]"
                  >
                    <span>{isAdvancedExpanded ? 'â–¼ Hide' : 'â–¶ Show'} Advanced Configuration (Optional parameters)</span>
                  </button>
                </div>

                {isAdvancedExpanded && (
                  <div className="space-y-4 pt-2 animate-fadeIn">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Barcode input component */}
                      <div className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block">Barcode Scanning</label>
                        <div className="text-[10px] text-slate-550 leading-normal mb-1">
                          Scan or type standard code to link: <strong className="font-mono text-slate-900">{newProduct.barcode || 'Empty'}</strong>
                        </div>
                        <BarcodeInput
                          onScan={(code) => {
                            setNewProduct(p => ({ ...p, barcode: code }));
                            triggerToast(`Barcode "${code}" registered below.`, 'success');
                          }}
                          placeholder="Type or click here to scan..."
                        />
                        {newProduct.barcode && (
                          <button
                            type="button"
                            onClick={() => setNewProduct(p => ({ ...p, barcode: '' }))}
                            className="text-[10px] text-rose-500 underline font-semibold cursor-pointer block mt-1"
                          >
                            Clear scanned barcode
                          </button>
                        )}
                      </div>

                      {/* Requires Barcode */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Requires Barcode Enforcement</label>
                        <select
                          value={newProduct.requires_barcode}
                          onChange={(e) => setNewProduct(p => ({ ...p, requires_barcode: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                        >
                          <option value="inherit">Inherit from category defaults</option>
                          <option value="required">Strictly Required</option>
                          <option value="not_required">Not Required</option>
                        </select>
                      </div>

                      {/* Max Stock Level */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Max Stock Level (Base Units)</label>
                        <input
                          type="number"
                          value={newProduct.max_stock_level}
                          onChange={(e) => setNewProduct(p => ({ ...p, max_stock_level: e.target.value }))}
                          placeholder="e.g. 5000 (optional)"
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400"
                        />
                      </div>

                      {/* Product Class */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Product Class</label>
                        <select
                          value={newProduct.product_class}
                          onChange={(e) => setNewProduct(p => ({ ...p, product_class: e.target.value as any }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                        >
                          <option value="inherit">Inherit from category default</option>
                          <option value="raw_protein">Raw Protein</option>
                          <option value="ready_to_eat">Ready To Eat</option>
                          <option value="dairy">Dairy</option>
                          <option value="fresh_produce">Fresh Produce</option>
                          <option value="dry_goods">Dry Goods</option>
                          <option value="frozen_protein">Frozen Protein</option>
                          <option value="allergen">Allergen</option>
                          <option value="cleaning_chemical">Cleaning Chemical</option>
                          <option value="packaging">Packaging</option>
                        </select>
                      </div>

                      {/* Ethylene Profile */}
                      <div>
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Ethylene Profile</label>
                        <select
                          value={newProduct.ethylene_profile}
                          onChange={(e) => setNewProduct(p => ({ ...p, ethylene_profile: e.target.value }))}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                        >
                          <option value="neutral">Neutral (Default)</option>
                          <option value="producer">Producer</option>
                          <option value="sensitive">Sensitive</option>
                        </select>
                      </div>
                    </div>

                    {/* Description Area */}
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">Product Description</label>
                      <textarea
                        rows={3}
                        value={newProduct.description}
                        onChange={(e) => setNewProduct(p => ({ ...p, description: e.target.value }))}
                        placeholder="Logistics annotations, specific guidelines, user hints..."
                        className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowNewProductModal(false);
                    setNewProduct(initialNewProductState);
                    setFormErrors({});
                    setIsUnitConfigExpanded(false);
                    setIsAdvancedExpanded(false);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl transition min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitLoading}
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-450 disabled:bg-slate-300 text-slate-950 text-xs font-bold rounded-xl transition min-h-[44px] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  {isSubmitLoading ? 'Saving...' : 'Create Product'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Category Quick Add Modal */}
      {showQuickAddCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  Quick Add Category
                </h2>
                <p className="text-[10px] text-slate-500">Create a new product taxonomy group.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAddCategory(false);
                  setQuickCategory({
                    name: '',
                    parent_id: '',
                    default_temp_zone: 'ambient',
                    default_product_class: '',
                    requires_barcode: false
                  });
                  setQuickCatError(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-450 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickCategorySubmit} className="p-5 space-y-4 flex-1">
              {quickCatError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-600 text-[10.5px] font-medium leading-normal animate-fadeIn">
                  {quickCatError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Category Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickCategory.name}
                  onChange={(e) => setQuickCategory(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Fresh Fruit"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Temperature Zone */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Default Temperature Zone <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={quickCategory.default_temp_zone}
                  onChange={(e) => setQuickCategory(p => ({ ...p, default_temp_zone: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                >
                  <option value="frozen">Frozen</option>
                  <option value="chilled">Chilled</option>
                  <option value="cool">Cool</option>
                  <option value="ambient">Ambient</option>
                </select>
              </div>

              {/* Parent Category */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Parent Category
                </label>
                <select
                  value={quickCategory.parent_id || ''}
                  onChange={(e) => setQuickCategory(p => ({ ...p, parent_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                >
                  <option value="">None (Top Level)</option>
                  {categories.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.name}</option>
                  ))}
                </select>
              </div>

              {/* Default Product Class */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Default Product Class
                </label>
                <select
                  value={quickCategory.default_product_class}
                  onChange={(e) => setQuickCategory(p => ({ ...p, default_product_class: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs bg-white outline-hidden focus:border-slate-400"
                >
                  <option value="">None (Inherit nothing)</option>
                  <option value="raw_protein">Raw Protein</option>
                  <option value="ready_to_eat">Ready To Eat</option>
                  <option value="dairy">Dairy</option>
                  <option value="fresh_produce">Fresh Produce</option>
                  <option value="dry_goods">Dry Goods</option>
                  <option value="frozen_protein">Frozen Protein</option>
                  <option value="allergen">Allergen</option>
                  <option value="cleaning_chemical">Cleaning Chemical</option>
                  <option value="packaging">Packaging</option>
                </select>
              </div>

              {/* Requires Barcode */}
              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="quick_requires_barcode"
                  checked={quickCategory.requires_barcode}
                  onChange={(e) => setQuickCategory(p => ({ ...p, requires_barcode: e.target.checked }))}
                  className="rounded border-slate-300 text-teal-600 focus:ring-teal-500 h-4 w-4"
                />
                <label htmlFor="quick_requires_barcode" className="text-[11px] font-semibold text-slate-700 cursor-pointer select-none">
                  Requires Barcode Enforcement
                </label>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddCategory(false);
                    setQuickCategory({
                      name: '',
                      parent_id: '',
                      default_temp_zone: 'ambient',
                      default_product_class: '',
                      requires_barcode: false
                    });
                    setQuickCatError(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl transition min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-450 text-slate-950 text-xs font-bold rounded-xl transition min-h-[44px] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Create Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Quick Add Modal */}
      {showQuickAddSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 max-w-md w-full max-h-[90vh] overflow-y-auto flex flex-col animate-fadeIn">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100">
              <div>
                <h2 className="text-sm font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wider">
                  Quick Add Supplier
                </h2>
                <p className="text-[10px] text-slate-500">Register a new vendor for procurement link.</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowQuickAddSupplier(false);
                  setQuickSupplier({
                    name: '',
                    contact_name: '',
                    phone: '',
                    email: '',
                    lead_time_days: 7,
                    payment_terms: ''
                  });
                  setQuickSupError(null);
                  setQuickAddSource(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg min-h-[44px] min-w-[44px] flex items-center justify-center cursor-pointer text-slate-450 hover:text-slate-600 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleQuickSupplierSubmit} className="p-5 space-y-4 flex-1">
              {quickSupError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-600 text-[10.5px] font-medium leading-normal animate-fadeIn">
                  {quickSupError}
                </div>
              )}

              {/* Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Supplier Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={quickSupplier.name}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Kenya Fresh Orchards"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Contact Name */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Contact Person Name
                </label>
                <input
                  type="text"
                  value={quickSupplier.contact_name}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, contact_name: e.target.value }))}
                  placeholder="e.g. Jane Doe"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={quickSupplier.phone}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, phone: e.target.value }))}
                  placeholder="e.g. +254 700 000000"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Email */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={quickSupplier.email}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, email: e.target.value }))}
                  placeholder="e.g. orders@kenyafresh.co.ke"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Lead Time Days */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Lead Time (Days)
                </label>
                <input
                  type="number"
                  min="1"
                  value={quickSupplier.lead_time_days}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, lead_time_days: parseInt(e.target.value) || 7 }))}
                  placeholder="7"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Payment Terms */}
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 block mb-1">
                  Payment Terms
                </label>
                <input
                  type="text"
                  value={quickSupplier.payment_terms}
                  onChange={(e) => setQuickSupplier(p => ({ ...p, payment_terms: e.target.value }))}
                  placeholder="e.g. Net 14, Cash on delivery"
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-xs outline-hidden focus:border-slate-400 bg-white"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-5 -mb-5 p-5 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowQuickAddSupplier(false);
                    setQuickSupplier({
                      name: '',
                      contact_name: '',
                      phone: '',
                      email: '',
                      lead_time_days: 7,
                      payment_terms: ''
                    });
                    setQuickSupError(null);
                    setQuickAddSource(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-semibold rounded-xl transition min-h-[44px] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-500 hover:bg-teal-450 text-slate-950 text-xs font-bold rounded-xl transition min-h-[44px] cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
                >
                  Create Supplier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

