/**
 * pages/InvoiceView.jsx
 * -------------------------------------------------------------------------
 * The read-only, print-friendly invoice view — this is what "View proof" /
 * clicking an invoice row opens. Includes the GST breakup table, amount in
 * words, bank details, and (if the business has a UPI ID set and there's a
 * balance due) the scan-to-pay QR code.
 * -------------------------------------------------------------------------
 */

import React, { useRef, useState } from "react";
import { Printer, Download } from "lucide-react";
import { T } from "../lib/constants";
import { INR, INR2, fmtDate, numToWordsIndian } from "../lib/format";
import { Modal, Badge, Btn } from "../components/ui";
import { statusTone } from "../components/ui";
import AttachmentLink from "../components/AttachmentLink";
import UpiQr from "../components/UpiQr";

export default function InvoiceView({ inv, onClose, ctx }) {
  const contentRef = useRef(null);
  const [exporting, setExporting] = useState(false);
  if (!inv) return null;

  // Renders the invoice DOM node to a canvas and lays it out across A4
  // pages. jspdf/html2canvas are lazy-loaded so they don't bloat the main
  // bundle for users who never export.
  const exportPdf = async () => {
    const el = contentRef.current;
    if (!el || exporting) return;
    setExporting(true);
    try {
      const [{ default: JsPDF }, { default: html2canvas }] = await Promise.all([
        import("jspdf"),
        import("html2canvas"),
      ]);
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
      const pdf = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = 210, pageH = 297, margin = 8;
      const usableH = pageH - margin * 2;
      const imgW = pageW - margin * 2;
      const imgH = (canvas.height * imgW) / canvas.width;
      const img = canvas.toDataURL("image/jpeg", 0.95);
      let remaining = imgH, offset = 0;
      while (remaining > 0) {
        pdf.addImage(img, "JPEG", margin, margin - offset, imgW, imgH);
        remaining -= usableH;
        offset += usableH;
        if (remaining > 0) pdf.addPage();
      }
      const safeName = String(inv.number).replace(/[^a-zA-Z0-9.\-_]/g, "_");
      pdf.save(`${safeName}.pdf`);
    } catch (e) { alert("Could not export PDF: " + e.message); }
    setExporting(false);
  };

  const cust = ctx.getCustomer(inv.customerId);
  const totals = ctx.invoiceTotals(inv);
  const bal = ctx.invoiceBalance(inv);
  return (
    <Modal open={!!inv} onClose={onClose} title="Tax Invoice" width="max-w-2xl">
      <div ref={contentRef} className="invoice-print-area" style={{ background: "#ffffff" }}>
      <div className="flex justify-between items-start mb-5 pb-4" style={{ borderBottom: `1px solid ${T.border}` }}>
        <div><div className="font-semibold text-lg" style={{ color: T.navy, fontFamily: "Lexend, sans-serif" }}>{ctx.company.legalName}</div><div className="text-xs mt-1" style={{ color: T.inkFaint }}>{ctx.company.address}, {ctx.company.city}, {ctx.company.state} - {ctx.company.pin}</div><div className="text-xs" style={{ color: T.inkFaint }}>GSTIN: {ctx.company.gstin}</div></div>
        <Badge tone={statusTone(inv.status)}>{inv.status}</Badge>
      </div>
      <div className="grid grid-cols-2 gap-4 mb-4 text-xs">
        <div><div className="font-medium mb-1" style={{ color: T.inkSoft }}>BILL TO</div><div className="font-medium" style={{ color: T.ink }}>{cust?.name}</div><div style={{ color: T.inkFaint }}>{cust?.address}</div><div style={{ color: T.inkFaint }}>GSTIN: {cust?.gstin || "Unregistered"}</div></div>
        <div className="text-right"><div><span style={{ color: T.inkFaint }}>Invoice date: </span>{fmtDate(inv.date)}</div>{inv.dueDate && <div><span style={{ color: T.inkFaint }}>Due date: </span>{fmtDate(inv.dueDate)}</div>}<div><span style={{ color: T.inkFaint }}>Place of supply: </span>{cust?.state}</div><div className="font-medium" style={{ color: T.ink }}>Invoice no: {inv.number}</div></div>
      </div>
      <table className="w-full text-xs mb-4">
        <thead><tr style={{ background: T.borderSoft }}>{["Item", "HSN", "Qty", "Rate", "Amount", "GST", "Total"].map((h) => <th key={h} className="text-left px-2 py-1.5 font-medium" style={{ color: T.inkSoft }}>{h}</th>)}</tr></thead>
        <tbody>{totals.lines.map((l, i) => <tr key={i} style={{ borderBottom: `1px solid ${T.borderSoft}` }}><td className="px-2 py-1.5">{l.product.name}</td><td className="px-2 py-1.5">{l.product.hsn}</td><td className="px-2 py-1.5">{l.qty} {l.product.unit}</td><td className="px-2 py-1.5">{INR2(l.rate)}</td><td className="px-2 py-1.5">{INR2(l.lineTaxable)}</td><td className="px-2 py-1.5">{INR2(l.igst + l.cgst + l.sgst)} ({l.gstRate}%)</td><td className="px-2 py-1.5 font-medium">{INR2(l.lineTotal)}</td></tr>)}</tbody>
      </table>
      <div className="flex justify-end mb-4">
        <div className="w-56 text-sm">
          {totals.discount > 0 && <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>Gross</span><span>{INR2(totals.taxable + totals.discount)}</span></div>}
          {totals.discount > 0 && <div className="flex justify-between py-0.5"><span style={{ color: T.emerald }}>Discount</span><span style={{ color: T.emerald }}>− {INR2(totals.discount)}</span></div>}
          <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>Taxable value</span><span>{INR2(totals.taxable)}</span></div>
          <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>GST</span><span>{INR2(totals.igst + totals.cgst + totals.sgst)}</span></div>
          <div className="flex justify-between py-0.5"><span style={{ color: T.inkSoft }}>Round off</span><span>{INR2(totals.roundOff)}</span></div>
          <div className="flex justify-between font-semibold text-base pt-1.5 mt-1" style={{ borderTop: `1px solid ${T.border}` }}><span>Grand total</span><span>{INR(totals.grandTotal)}</span></div>
          {bal > 0 && <div className="flex justify-between mt-1" style={{ color: T.red }}><span>Balance due</span><span>{INR(bal)}</span></div>}
        </div>
      </div>
      <div className="text-xs mb-4" style={{ color: T.inkFaint }}>Amount in words: {numToWordsIndian(totals.grandTotal)}</div>
      <div className="grid grid-cols-2 gap-4 text-xs mb-4">
        <div><div className="font-medium mb-1" style={{ color: T.inkSoft }}>BANK DETAILS</div><div style={{ color: T.inkFaint }}>{ctx.company.bankName}</div><div style={{ color: T.inkFaint }}>A/C <span className="font-semibold" style={{ color: T.ink }}>{ctx.company.bankAccount}</span></div>{ctx.company.bankIfsc && <div style={{ color: T.inkFaint }}>IFSC <span className="font-semibold" style={{ color: T.ink }}>{ctx.company.bankIfsc}</span></div>}</div>
        <div><div className="font-medium mb-1" style={{ color: T.inkSoft }}>TERMS</div><div style={{ color: T.inkFaint }}>{ctx.company.termsAndConditions}</div></div>
      </div>
      {ctx.company.upiId && bal > 0 && (
        <div className="flex justify-center mb-4">
          <UpiQr upiId={ctx.company.upiId} payeeName={ctx.company.legalName} amount={bal} note={inv.number} />
        </div>
      )}
      </div>
      <div className="no-print flex justify-between items-center gap-2">
        <AttachmentLink path={inv.attachmentUrl} label="View attached proof" />
        <div className="flex justify-end gap-2"><Btn variant="secondary" icon={Printer} onClick={() => window.print()}>Print</Btn><Btn variant="secondary" icon={Download} onClick={exportPdf} disabled={exporting}>{exporting ? "Exporting…" : "Export PDF"}</Btn></div>
      </div>
    </Modal>
  );
}
