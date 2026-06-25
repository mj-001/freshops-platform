import { jsPDF } from 'jspdf';

// Page layout dimensions for A4
const PAGE_HEIGHT = 297;
const PAGE_WIDTH = 210;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT; // 180mm

/**
 * Utility helper to draw an elegant document header
 */
function drawDocumentHeader(doc: jsPDF, title: string, docId: string): number {
  // Primary brand theme colors (Deep Indigo Slate)
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, PAGE_WIDTH, 38, 'F');

  // Decorative Accent Bar
  doc.setFillColor(99, 102, 241); // indigo-500
  doc.rect(0, 38, PAGE_WIDTH, 2, 'F');

  // Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.text('SILO COMPLIANCE WAREHOUSE GROUP', MARGIN_LEFT, 16);

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(194, 205, 217);
  doc.text('AUTOMATED AUDIT RUN & INVENTORY ADJUSTMENT LEDGER', MARGIN_LEFT, 23);

  // Document details right aligned
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text(`DOC CODE: ${docId}`, PAGE_WIDTH - MARGIN_RIGHT - 65, 16);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(212, 224, 237);
  const dateStr = new Date().toLocaleString('en-US', { timeZoneName: 'short' });
  doc.text(`AUDIT GENERATION TIMESTAMP: ${dateStr}`, PAGE_WIDTH - MARGIN_RIGHT - 110, 23);
  doc.text('REGULATORY JURISDICTION: KE-NBO / EAC LOGISTICS', PAGE_WIDTH - MARGIN_RIGHT - 110, 28);

  // Section header title on page
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(title, MARGIN_LEFT, 52);

  // Underline for section title
  doc.setDrawColor(226, 232, 240); // border-slate-200
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, 55, PAGE_WIDTH - MARGIN_RIGHT, 55);

  return 62; // return next Y insertion point
}

/**
 * Utility helper to draw corporate stamps and signature slots at the bottom
 */
function drawSignaturesAndFooters(
  doc: jsPDF, 
  y: number, 
  createdBy: string, 
  approvedBy: string,
  creatorDept: string = 'INVENTORY DEPARTMENT',
  approverDept: string = 'FINANCE DEPARTMENT'
): number {
  if (y > PAGE_HEIGHT - 65) {
    doc.addPage();
    y = 25;
  }

  y += 10;
  // Border line separating signature section
  doc.setDrawColor(203, 213, 225); // border-slate-300
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y);
  y += 6;

  // Compliance statement text
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    'Disclaimer: This inventory statement is compiled from electronic snapshots of physical stock counts and write-offs. By co-signing, the warehouse managers verify that physical audits have been executed safely under active inventory guidelines (BR-040 & BR-050). Under Kenya Revenue Authority and East African Logistics protocols, records are kept for a minimum of 7 years.',
    MARGIN_LEFT,
    y,
    { maxWidth: CONTENT_WIDTH }
  );

  y += 18;

  // Signatures split
  const halfway = PAGE_WIDTH / 2;

  // Auditor Slot
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(`${creatorDept} SIGNATURE:`, MARGIN_LEFT, y);
  doc.line(MARGIN_LEFT, y + 10, halfway - 10, y + 10); // line for signature
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(`Signatory: ${createdBy || 'SYSTEM'}`, MARGIN_LEFT, y + 14);
  doc.text('Signature Date: ______________________', MARGIN_LEFT, y + 18);

  // Approver Slot
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.text(`${approverDept} SIGNATURE:`, halfway + 5, y);
  doc.line(halfway + 5, y + 10, PAGE_WIDTH - MARGIN_RIGHT, y + 10); // line for signature
  doc.setFont('helvetica', 'normal');
  doc.text(`Signatory: ${approvedBy || 'Awaiting Authorization'}`, halfway + 5, y + 14);
  doc.text('Signature Date: ______________________', halfway + 5, y + 18);

  y += 24;

  // Page numbering or footnote
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(99, 102, 241);
  doc.text('SILO SECURE LEDGER SYSTEM', halfway - 25, PAGE_HEIGHT - 10);

  return y;
}

/**
 * 1. Export 30-Day Cumulative Audit Ledger PDF
 */
export function exportCumulativeAuditLedger(cycleCounts: any[], writeOffs: any[]): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const docId = `COMP-LR-${Math.floor(Date.now() / 1000).toString().slice(-6)}`;
  let y = drawDocumentHeader(doc, 'INVENTORY RECONCILIATION & ADJUSTMENT LEDGER (30 DAYS)', docId);

  // Executive overview summary card
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(241, 245, 249); // slate-100
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 26, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('1. EXECUTIVE COMPLIANCE REPORT OVERVIEW', MARGIN_LEFT + 5, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);

  const totalCycleCounts = cycleCounts.length;
  const completedCounts = cycleCounts.filter(cc => cc.status === 'completed').length;
  const totalWriteOffs = writeOffs.length;
  const resolvedWriteOffs = writeOffs.filter(wo => wo.status === 'approved' || wo.status === 'completed').length;
  const totalWriteOffLossVal = writeOffs.reduce((sum, wo) => sum + (wo.total_value_kes || 0), 0);

  doc.text(`• Total scheduled audits mapped: ${totalCycleCounts} Cycle Count Sheets (${completedCounts} fully completed).`, MARGIN_LEFT + 5, y + 12);
  doc.text(`• Total quarantine / waste slips filed: ${totalWriteOffs} Slips (${resolvedWriteOffs} authorized and written off).`, MARGIN_LEFT + 5, y + 16);
  doc.text(`• Cumulative recorded financial loss: ${(totalWriteOffLossVal / 100).toLocaleString()} KES.`, MARGIN_LEFT + 5, y + 20);

  y += 33;

  // Section 2: Active Cycle Counts Table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(79, 70, 229); // text-indigo-600
  doc.text('2. APPROVED BI-WEEKLY CYCLE COUNTS REGISTER', MARGIN_LEFT, y);
  y += 4;

  // Simple Table headers for cycle counts
  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');
  
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('COUNT SLIP ID', MARGIN_LEFT + 3, y + 4.5);
  doc.text('SITE DEPOT', MARGIN_LEFT + 35, y + 4.5);
  doc.text('DATE TRIGGERED', MARGIN_LEFT + 65, y + 4.5);
  doc.text('STATUS', MARGIN_LEFT + 105, y + 4.5);
  doc.text('AUDITORS & NOTES', MARGIN_LEFT + 135, y + 4.5);

  y += 7;

  // List cycle counts
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (cycleCounts.length === 0) {
    doc.text('No cycle counts registered in database.', MARGIN_LEFT + 4, y + 5);
    y += 10;
  } else {
    cycleCounts.forEach((cc, idx) => {
      if (y > PAGE_HEIGHT - 35) {
        doc.addPage();
        y = 20;
      }
      
      // Zebra backgrounds
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(cc.id || 'CC-MOCK', MARGIN_LEFT + 3, y + 4.8);
      
      doc.setFont('helvetica', 'normal');
      doc.text(cc.warehouse_id === 'RGL' ? 'Regal Plaza FP (RGL)' : 'Regen Warehouse (RGN)', MARGIN_LEFT + 35, y + 4.8);
      doc.text(cc.scheduled_date ? cc.scheduled_date.slice(0, 10) : '2026-06-14', MARGIN_LEFT + 65, y + 4.8);
      
      // Highlight completed/pending status
      if (cc.status === 'completed') {
        doc.setTextColor(16, 124, 65); // Green
        doc.setFont('helvetica', 'bold');
        doc.text('VERIFIED & FIXED', MARGIN_LEFT + 105, y + 4.8);
      } else {
        doc.setTextColor(220, 95, 30); // Orange
        doc.setFont('helvetica', 'bold');
        doc.text(cc.status.toUpperCase(), MARGIN_LEFT + 105, y + 4.8);
      }

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(71, 85, 105);
      const noteStr = cc.notes || 'Routine general count';
      doc.text(noteStr.length > 25 ? `${noteStr.slice(0, 22)}...` : noteStr, MARGIN_LEFT + 135, y + 4.8);

      y += 7;
    });
  }

  y += 8;

  // Section 3: Safe Loss Write-Offs
  if (y > PAGE_HEIGHT - 45) {
    doc.addPage();
    y = 20;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(225, 29, 72); // text-rose-600
  doc.text('3. SECURE WASTE WRITE-OFF REGISTER', MARGIN_LEFT, y);
  y += 4;

  // Write-offs table header
  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('SLIP CODE', MARGIN_LEFT + 3, y + 4.5);
  doc.text('SITE DEPOT', MARGIN_LEFT + 35, y + 4.5);
  doc.text('FINANCIAL LOSS', MARGIN_LEFT + 75, y + 4.5);
  doc.text('RECONCILOR (CREATOR)', MARGIN_LEFT + 110, y + 4.5);
  doc.text('CO-SIGNER (APPROVER)', MARGIN_LEFT + 145, y + 4.5);

  y += 7;

  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);

  if (writeOffs.length === 0) {
    doc.text('No active waste write-offs detected in current accounting snapshot.', MARGIN_LEFT + 4, y + 5);
    y += 10;
  } else {
    writeOffs.forEach((wo, idx) => {
      if (y > PAGE_HEIGHT - 35) {
        doc.addPage();
        y = 20;
      }

      // Zebra backgrounds
      if (idx % 2 === 1) {
        doc.setFillColor(254, 242, 242); // slate rose shading
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7, 'F');
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(wo.id || 'WO-MOCK', MARGIN_LEFT + 3, y + 4.8);

      doc.setFont('helvetica', 'normal');
      doc.text(wo.warehouse_id === 'RGL' ? 'Regal Plaza FP' : 'Regen Warehouse', MARGIN_LEFT + 35, y + 4.8);
      
      doc.setTextColor(190, 24, 74);
      doc.setFont('helvetica', 'bold');
      doc.text(`${((wo.total_value_kes || 0) / 100).toLocaleString('en-KE')} KES`, MARGIN_LEFT + 75, y + 4.8);

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.text(wo.created_by || 'U-OPS-A', MARGIN_LEFT + 110, y + 4.8);
      
      if (wo.approved_by) {
        doc.setTextColor(16, 124, 65);
        doc.setFont('helvetica', 'bold');
        doc.text(wo.approved_by, MARGIN_LEFT + 145, y + 4.8);
      } else {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'italic');
        doc.text('AWAITING REVIEW', MARGIN_LEFT + 145, y + 4.8);
      }

      y += 7;
    });
  }

  // Draw final sigs
  drawSignaturesAndFooters(doc, y, 'Auditing System Engine', 'Double Signature Validation');

  doc.save(`Compliance_Adjustments_Ledger_${docId}.pdf`);
}

/**
 * 2. Export Detailed Single Cycle Count Slip Voucher
 */
export function exportCycleCountVoucher(countSheet: any): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const docId = countSheet.id || `CC-RUN-${Math.floor(Math.random() * 9000 + 1000)}`;
  let y = drawDocumentHeader(doc, `VERIFIED CYCLE COUNT VOUCHER (${docId})`, docId);

  // Single slip metadata description blocks
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 22, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  doc.text(`Depot Facility:`, MARGIN_LEFT + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(countSheet.warehouse_id === 'RGL' ? 'Regal Plaza FP (RGL)' : 'Regen Distribution Depot (RGN)', MARGIN_LEFT + 32, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Status:`, MARGIN_LEFT + 5, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(countSheet.status === 'completed' ? 16 : 225, countSheet.status === 'completed' ? 124 : 112, countSheet.status === 'completed' ? 65 : 51);
  doc.text(countSheet.status.toUpperCase(), MARGIN_LEFT + 32, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Snapshot Date:`, MARGIN_LEFT + 110, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(countSheet.scheduled_date ? countSheet.scheduled_date.slice(0, 16) : 'N/A', MARGIN_LEFT + 138, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Audit Segment:`, MARGIN_LEFT + 110, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(countSheet.zone_id ? `Zone ${countSheet.zone_id}` : 'General Full Warehouse Audit', MARGIN_LEFT + 138, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100, 116, 139);
  doc.text(`Notes: ${countSheet.notes || 'Regular periodic audit.'}`, MARGIN_LEFT + 5, y + 17);

  y += 28;

  // Counting Lines table
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(99, 102, 241);
  doc.text('PHYSICAL TO SYSTEM BALANCES MATCHES REPORT:', MARGIN_LEFT, y);
  y += 4.5;

  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SKU DESCRIPTION', MARGIN_LEFT + 3, y + 5);
  doc.text('BIN POSITION', MARGIN_LEFT + 70, y + 5);
  doc.text('SYS STOCK', MARGIN_LEFT + 105, y + 5);
  doc.text('COUNTED QTY', MARGIN_LEFT + 130, y + 5);
  doc.text('ADJUSTED VARIANCE', MARGIN_LEFT + 155, y + 5);

  y += 7.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const lines = countSheet.lines || [];
  if (lines.length === 0) {
    doc.setTextColor(100, 116, 139);
    doc.text('No active item snapshots held on this cycle count.', MARGIN_LEFT + 3, y + 5);
    y += 10;
  } else {
    lines.forEach((line: any, index: number) => {
      if (y > PAGE_HEIGHT - 35) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7.5, 'F');
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(line.sku_name || line.sku_id, MARGIN_LEFT + 3, y + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.text(line.location_code || 'UNASSIGNED', MARGIN_LEFT + 70, y + 5.2);
      
      doc.setFont('helvetica', 'bold');
      doc.text(`${line.system_qty} packs`, MARGIN_LEFT + 105, y + 5.2);
      
      const counted = line.counted_qty !== null ? line.counted_qty : line.system_qty;
      doc.text(`${counted} packs`, MARGIN_LEFT + 130, y + 5.2);

      const varianceValue = counted - line.system_qty;
      if (varianceValue !== 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        const sign = varianceValue > 0 ? '+' : '';
        doc.text(`${sign}${varianceValue} packs`, MARGIN_LEFT + 155, y + 5.2);
      } else {
        doc.setTextColor(22, 101, 52);
        doc.setFont('helvetica', 'normal');
        doc.text('Perfect Match (0)', MARGIN_LEFT + 155, y + 5.2);
      }

      y += 7.5;
    });
  }

  drawSignaturesAndFooters(
    doc, 
    y, 
    'Inventory Officer', 
    countSheet.status === 'completed' ? 'Finance Controller' : 'Finance Officer / Auditor',
    'INVENTORY DEPARTMENT',
    'FINANCE DEPARTMENT'
  );

  doc.save(`Silo_CycleCount_Voucher_${docId}.pdf`);
}

/**
 * 3. Export Detailed Single Write-Off Voucher Slip
 */
export function exportWriteOffVoucher(writeOff: any): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const docId = writeOff.id || `WO-RUN-${Math.floor(Math.random() * 9000 + 1000)}`;
  let y = drawDocumentHeader(doc, `STOCK WRITE-OFF DEDUCTION AUTHORIZATION (${docId})`, docId);

  // Metal detail blocks
  doc.setFillColor(254, 242, 242); // very light soft red shade
  doc.setDrawColor(254, 202, 202);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 26, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(153, 27, 27); // deep dark crimson red

  doc.text(`Authorized Site Depot:`, MARGIN_LEFT + 5, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(writeOff.warehouse_id === 'RGL' ? 'Regal Plaza (RGL)' : 'Regen Central Warehouse (RGN)', MARGIN_LEFT + 42, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.text(`Creation Signature:`, MARGIN_LEFT + 5, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(`Officer Account: ${writeOff.created_by}`, MARGIN_LEFT + 42, y + 11);

  doc.setFont('helvetica', 'normal');
  doc.text(`Total Deduction Value:`, MARGIN_LEFT + 110, y + 6);
  doc.setFont('helvetica', 'bold');
  doc.text(`${((writeOff.total_value_kes || 0)/100).toLocaleString('en-KE')} KES`, MARGIN_LEFT + 145, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.text(`Compliance Status:`, MARGIN_LEFT + 110, y + 11);
  doc.setFont('helvetica', 'bold');
  doc.text(writeOff.status ? writeOff.status.toUpperCase() : 'PENDING APPROVAL', MARGIN_LEFT + 145, y + 11);

  doc.setFont('helvetica', 'italic');
  doc.setTextColor(127, 29, 29);
  doc.text(`Deduction Notes/Remarks: ${writeOff.notes || 'No notes provided. Standard damage waste registration.'}`, MARGIN_LEFT + 5, y + 17);

  y += 32;

  // List of write off items in table format
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(220, 38, 38);
  doc.text('DEDUCTED INVENTORY PRODUCTS LINE ITEMS:', MARGIN_LEFT, y);
  y += 4.5;

  doc.setFillColor(15, 23, 42);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text('SKU DESCRIPTION & CODES', MARGIN_LEFT + 3, y + 5);
  doc.text('BATCH BUNDLE', MARGIN_LEFT + 70, y + 5);
  doc.text('BIN SOURCE', MARGIN_LEFT + 105, y + 5);
  doc.text('QTY DEDUCTED', MARGIN_LEFT + 130, y + 5);
  doc.text('LOSS VALUE (KES)', MARGIN_LEFT + 155, y + 5);

  y += 7.5;

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');

  const lines = writeOff.lines || [];
  if (lines.length === 0) {
    doc.setTextColor(127, 29, 29);
    doc.text('No active item batches entered on this write-off slip.', MARGIN_LEFT + 3, y + 5);
    y += 10;
  } else {
    lines.forEach((line: any, index: number) => {
      if (y > PAGE_HEIGHT - 35) {
        doc.addPage();
        y = 20;
      }

      if (index % 2 === 1) {
        doc.setFillColor(254, 244, 244);
        doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, 7.5, 'F');
      }

      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.text(line.sku_name || line.sku_id, MARGIN_LEFT + 3, y + 5.2);

      doc.setFont('helvetica', 'normal');
      doc.text(line.batch_id || 'UNKNOWN', MARGIN_LEFT + 70, y + 5.2);
      doc.text(line.location_id || 'UNKNOWN', MARGIN_LEFT + 105, y + 5.2);
      
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38);
      doc.text(`${line.qty} packs`, MARGIN_LEFT + 130, y + 5.2);

      doc.setTextColor(127, 29, 29);
      const rowVal = ((line.value_kes || 0) / 100).toLocaleString('en-KE');
      doc.text(`${rowVal} KES`, MARGIN_LEFT + 155, y + 5.2);

      y += 7.5;
    });
  }

  drawSignaturesAndFooters(
    doc, 
    y, 
    writeOff.created_by, 
    writeOff.approved_by
  );

  doc.save(`Silo_WriteOff_Voucher_${docId}.pdf`);
}
