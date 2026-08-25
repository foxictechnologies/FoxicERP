export const seedProducts = () => ([
  { name: "Wireless Optical Mouse", sku: "ELE-MOU-001", hsn: "8471", category: "Electronics", unit: "PCS", purchasePrice: 320, sellingPrice: 499, mrp: 599, gstRate: 18, currentStock: 86, reorderLevel: 30 },
  { name: "Mechanical Keyboard 87-key", sku: "ELE-KEY-002", hsn: "8471", category: "Electronics", unit: "PCS", purchasePrice: 1450, sellingPrice: 2199, mrp: 2499, gstRate: 18, currentStock: 22, reorderLevel: 25 },
  { name: "A4 Copier Paper (Ream)", sku: "OFF-PAP-010", hsn: "4802", category: "Office Supplies", unit: "REAM", purchasePrice: 210, sellingPrice: 279, mrp: 320, gstRate: 12, currentStock: 340, reorderLevel: 80 },
  { name: "Executive Office Chair", sku: "FUR-CHR-004", hsn: "9401", category: "Furniture", unit: "PCS", purchasePrice: 3800, sellingPrice: 5999, mrp: 6999, gstRate: 18, currentStock: 8, reorderLevel: 10 },
  { name: "24\" LED Monitor", sku: "ELE-MON-005", hsn: "8528", category: "Electronics", unit: "PCS", purchasePrice: 6200, sellingPrice: 8999, mrp: 9999, gstRate: 18, currentStock: 31, reorderLevel: 12 },
]);

export const seedCustomers = () => ([
  { name: "Nimbus Retail Pvt Ltd", contact: "Ananya Kulkarni", phone: "+91 98765 43210", email: "ananya@nimbusretail.in", gstin: "27AACCN1234E1Z8", state: "Maharashtra", address: "Bandra Kurla Complex, Mumbai", pin: "400051", creditLimit: 200000, paymentTerms: "Net 15" },
  { name: "Vertex Solutions", contact: "Rajesh Iyer", phone: "+91 90000 11122", email: "rajesh@vertexsol.com", gstin: "29AAACV5678F1Z2", state: "Karnataka", address: "Whitefield, Bengaluru", pin: "560066", creditLimit: 150000, paymentTerms: "Net 30" },
  { name: "Capital Traders", contact: "Sunil Mehta", phone: "+91 99887 76655", email: "sunil@capitaltraders.in", gstin: "07AABCC9012G1Z4", state: "Delhi", address: "Nehru Place, New Delhi", pin: "110019", creditLimit: 100000, paymentTerms: "Net 15" },
]);

export const seedVendors = () => ([
  { name: "Prime Electronics Distributors", contact: "Vikas Sharma", phone: "+91 98111 22334", email: "vikas@primeelec.in", gstin: "27AAECP1234K1Z9", state: "Maharashtra", address: "Lamington Road, Mumbai", bankName: "ICICI Bank", bankAccount: "003401567890", paymentTerms: "Net 30" },
  { name: "National Paper Mills", contact: "Deepak Rao", phone: "+91 90222 33445", email: "deepak@natpaper.in", gstin: "24AABCN5678L1Z3", state: "Gujarat", address: "GIDC, Vapi", paymentTerms: "Net 15", bankName: "SBI", bankAccount: "20340056789" },
]);
