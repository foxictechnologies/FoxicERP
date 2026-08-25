/**
 * components/UpiQr.jsx
 * -------------------------------------------------------------------------
 * Renders a scan-to-pay UPI QR code for an invoice's outstanding balance.
 * Encodes a standard `upi://pay` deep link — any UPI app (GPay, PhonePe,
 * Paytm, etc.) can scan this and pre-fill the payment to the business's
 * own UPI ID, for the exact amount still owed.
 *
 * Requires the business to have set a UPI ID in Settings -> Bank details.
 * Renders nothing if there's no UPI ID or nothing owed (amount <= 0) —
 * see the call site in InvoiceView.jsx for that guard.
 * -------------------------------------------------------------------------
 */

import React from "react";
import { QRCodeSVG } from "qrcode.react";
import { T } from "../lib/constants";
import { INR } from "../lib/format";

export default function UpiQr({ upiId, payeeName, amount, note }) {
  if (!upiId || !amount || amount <= 0) return null;
  const uri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(payeeName || "")}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(note || "")}`;
  return (
    <div className="flex flex-col items-center gap-1.5 p-3 rounded-xl" style={{ background: T.borderSoft }}>
      <QRCodeSVG value={uri} size={112} bgColor="#ffffff" fgColor={T.ink} />
      <div className="text-[11px] text-center" style={{ color: T.inkFaint }}>Scan to pay {INR(amount)} via UPI<br />to {upiId}</div>
    </div>
  );
}
