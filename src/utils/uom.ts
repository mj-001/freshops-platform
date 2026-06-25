import { SKU } from '../types';

export function displayQty(baseQty: number, sku: any): string {
  if (!sku || sku.display_divisor == null) return String(baseQty);
  const converted = baseQty / sku.display_divisor;
  return `${converted.toFixed(sku.display_decimals)} ${sku.display_unit}`;
}

export function countToBase(
  fullUnits: number, remainderUnits: number, sku: any
): number {
  const fQty = sku.count_unit_qty || 0;
  const rQty = sku.remainder_unit_qty || 0;
  return (fullUnits * fQty) + (remainderUnits * rQty);
}

export function procurementToBase(
  procUnits: number, remainderUnits: number, sku: any
): number {
  const pQty = sku.procurement_unit_qty || 0;
  const rQty = sku.remainder_unit_qty || 0;
  return (procUnits * pQty) + (remainderUnits * rQty);
}

// Returns human-readable conversion summary for UI confirmation.
// e.g. "3 x 25kg bag + 8 kg = 83 kg"
export function conversionSummary(
  fullUnits: number, remainderUnits: number, sku: any
): string {
  const base = countToBase(fullUnits, remainderUnits, sku);
  const display = (base / sku.display_divisor).toFixed(sku.display_decimals);
  return `${fullUnits} x ${sku.count_unit}` +
    (remainderUnits > 0 ? ` + ${remainderUnits} ${sku.remainder_unit}` : '') +
    ` = ${display} ${sku.display_unit}`;
}
