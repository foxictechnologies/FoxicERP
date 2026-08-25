import { supabase } from "../supabaseClient";

// Only these camelCase fields are ever sent to each table. Anything else on
// a JS object (leftover UI-only fields, stale ids, etc.) is silently
// dropped rather than causing a column-not-found error.
const TABLE_COLUMNS = {
  companies: ["id","name","legalName","ownerName","address","city","state","pin","phone","email","gstin","pan","bankName","bankAccount","bankIfsc","upiId","invoicePrefix","nextInvoiceNumber","purchasePrefix","nextPurchaseNumber","financialYear","defaultGstRate","paymentTerms","termsAndConditions"],
  products: ["id","companyId","name","sku","hsn","category","unit","purchasePrice","sellingPrice","mrp","gstRate","currentStock","reorderLevel"],
  customers: ["id","companyId","name","contact","phone","email","gstin","state","address","pin","creditLimit","paymentTerms"],
  vendors: ["id","companyId","name","contact","phone","email","gstin","state","address","bankName","bankAccount","paymentTerms"],
  invoices: ["id","companyId","number","date","customerId","dueDate","status","items","paidAmount","createdBy","attachmentUrl","taxType"],
  purchases: ["id","companyId","number","date","vendorId","status","items","createdBy","attachmentUrl"],
  payments: ["id","companyId","date","type","partyId","refId","refNumber","amount","method","notes","createdBy","attachmentUrl"],
  expenses: ["id","companyId","date","category","amount","vendor","method","description","createdBy","attachmentUrl"],
  stock_ledger: ["id","companyId","productId","date","type","qty","refId"],
  audit_log: ["id","companyId","userId","userName","role","action","details","timestamp"],
  profiles: ["id","companyId","name","role","status"],
};

const toSnake = (s) => s.replace(/[A-Z]/g, (m) => "_" + m.toLowerCase());
const toCamel = (s) => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function toDb(table, obj) {
  const allowed = TABLE_COLUMNS[table] || Object.keys(obj);
  const out = {};
  allowed.forEach((camelKey) => {
    if (obj[camelKey] !== undefined) out[toSnake(camelKey)] = obj[camelKey];
  });
  return out;
}

function fromDb(row) {
  if (!row) return row;
  const out = {};
  Object.entries(row).forEach(([k, v]) => { out[toCamel(k)] = v; });
  return out;
}

/** Fetch every row of a table (Row-Level Security already scopes this to the caller's company). */
export async function fetchTable(table, orderCol = "created_at", ascending = false) {
  const { data, error } = await supabase.from(table).select("*").order(orderCol, { ascending });
  if (error) { console.error(`fetchTable(${table})`, error); return []; }
  return (data || []).map(fromDb);
}

export async function fetchOne(table, id) {
  const { data, error } = await supabase.from(table).select("*").eq("id", id).maybeSingle();
  if (error) { console.error(`fetchOne(${table})`, error); return null; }
  return fromDb(data);
}

export async function insertRow(table, obj) {
  const { data, error } = await supabase.from(table).insert(toDb(table, obj)).select().single();
  if (error) throw error;
  return fromDb(data);
}

export async function updateRow(table, id, patch) {
  const { data, error } = await supabase.from(table).update(toDb(table, patch)).eq("id", id).select().single();
  if (error) throw error;
  return fromDb(data);
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

/**
 * Atomically adjust a product's stock and write the ledger row via the
 * adjust_stock() Postgres function (see schema-patch-security-fixes.sql).
 * Returns true if the RPC ran, false if it isn't deployed yet (caller can
 * fall back to the older two-step client-side method).
 */
export async function adjustStockRpc(productId, delta, type, refId) {
  const { error } = await supabase.rpc("adjust_stock", { p_product_id: productId, p_delta: delta, p_type: type, p_ref_id: refId });
  if (!error) return true;
  if (error.code === "42883" || /Could not find the function/i.test(error.message || "")) return false;
  throw error;
}

/** Upload a proof-of-billing file (PDF/image) to private Supabase Storage. Returns the storage path (not a public URL, since the bucket is private). */
export async function uploadAttachment(file, companyId) {
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const path = `${companyId}/${Date.now()}-${safeName}`;
  const { error } = await supabase.storage.from("attachments").upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

/** Generate a short-lived signed URL to view/download a stored attachment. */
export async function getAttachmentUrl(path) {
  if (!path) return null;
  const { data, error } = await supabase.storage.from("attachments").createSignedUrl(path, 3600);
  if (error) { console.error("getAttachmentUrl", error); return null; }
  return data.signedUrl;
}
