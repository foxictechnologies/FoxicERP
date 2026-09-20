export const seedProducts = () => ([
  { id: "prod-1", name: "Wireless Optical Mouse", sku: "ELE-MOU-001", hsn: "8471", category: "Electronics", unit: "PCS", purchasePrice: 320, sellingPrice: 499, mrp: 599, gstRate: 18, currentStock: 86, reorderLevel: 30 },
  { id: "prod-2", name: "Mechanical Keyboard 87-key", sku: "ELE-KEY-002", hsn: "8471", category: "Electronics", unit: "PCS", purchasePrice: 1450, sellingPrice: 2199, mrp: 2499, gstRate: 18, currentStock: 22, reorderLevel: 25 },
  { id: "prod-3", name: "A4 Copier Paper (Ream)", sku: "OFF-PAP-010", hsn: "4802", category: "Office Supplies", unit: "REAM", purchasePrice: 210, sellingPrice: 279, mrp: 320, gstRate: 12, currentStock: 340, reorderLevel: 80 },
  { id: "prod-4", name: "Executive Office Chair", sku: "FUR-CHR-004", hsn: "9401", category: "Furniture", unit: "PCS", purchasePrice: 3800, sellingPrice: 5999, mrp: 6999, gstRate: 18, currentStock: 8, reorderLevel: 10 },
  { id: "prod-5", name: "24\" LED Monitor", sku: "ELE-MON-005", hsn: "8528", category: "Electronics", unit: "PCS", purchasePrice: 6200, sellingPrice: 8999, mrp: 9999, gstRate: 18, currentStock: 31, reorderLevel: 12 },
]);

export const seedCustomers = () => ([
  { id: "cust-1", name: "Nimbus Retail Pvt Ltd", contact: "Ananya Kulkarni", phone: "+91 98765 43210", email: "ananya@nimbusretail.in", gstin: "27AACCN1234E1Z8", state: "Maharashtra", address: "Bandra Kurla Complex, Mumbai", pin: "400051", creditLimit: 200000, paymentTerms: "Net 15" },
  { id: "cust-2", name: "Vertex Solutions", contact: "Rajesh Iyer", phone: "+91 90000 11122", email: "rajesh@vertexsol.com", gstin: "29AAACV5678F1Z2", state: "Karnataka", address: "Whitefield, Bengaluru", pin: "560066", creditLimit: 150000, paymentTerms: "Net 30" },
  { id: "cust-3", name: "Capital Traders", contact: "Sunil Mehta", phone: "+91 99887 76655", email: "sunil@capitaltraders.in", gstin: "07AABCC9012G1Z4", state: "Delhi", address: "Nehru Place, New Delhi", pin: "110019", creditLimit: 100000, paymentTerms: "Net 15" },
]);

export const seedVendors = () => ([
  { id: "vend-1", name: "Prime Electronics Distributors", contact: "Vikas Sharma", phone: "+91 98111 22334", email: "vikas@primeelec.in", gstin: "27AAECP1234K1Z9", state: "Maharashtra", address: "Lamington Road, Mumbai", bankName: "ICICI Bank", bankAccount: "003401567890", paymentTerms: "Net 30" },
  { id: "vend-2", name: "National Paper Mills", contact: "Deepak Rao", phone: "+91 90222 33445", email: "deepak@natpaper.in", gstin: "24AABCN5678L1Z3", state: "Gujarat", address: "GIDC, Vapi", paymentTerms: "Net 15", bankName: "SBI", bankAccount: "20340056789" },
]);

export const seedUsers = () => ([
  { id: "test-user-id", name: "Demo User", role: "Owner", status: "Active", email: "demo@company.com" },
  { id: "user-2", name: "Rohan Verma", role: "Accountant", status: "Active", email: "rohan@company.com" },
  { id: "user-3", name: "Pooja Patel", role: "Sales", status: "Active", email: "pooja@company.com" },
  { id: "user-4", name: "Amit Joshi", role: "Inventory", status: "Active", email: "amit@company.com" }
]);

export const seedInvoices = () => ([
  {
    id: "inv-101",
    companyId: "test-company-id",
    number: "INV-101",
    date: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
    customerId: "cust-1",
    dueDate: new Date(Date.now() + 10 * 86400000).toISOString().split("T")[0],
    status: "Sent",
    items: [
      { productId: "prod-1", qty: 10, rate: 499, discount: 0 },
      { productId: "prod-2", qty: 2, rate: 2199, discount: 0 }
    ],
    paidAmount: 2000,
    createdBy: "test-user-id",
    taxType: "auto"
  },
  {
    id: "inv-102",
    companyId: "test-company-id",
    number: "INV-102",
    date: new Date(Date.now() - 12 * 86400000).toISOString().split("T")[0],
    customerId: "cust-2",
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    status: "Paid",
    items: [
      { productId: "prod-5", qty: 3, rate: 8999, discount: 500 }
    ],
    paidAmount: 31267,
    createdBy: "test-user-id",
    taxType: "auto"
  },
  {
    id: "inv-103",
    companyId: "test-company-id",
    number: "INV-103",
    date: new Date(Date.now() - 25 * 86400000).toISOString().split("T")[0],
    customerId: "cust-3",
    dueDate: new Date(Date.now() - 5 * 86400000).toISOString().split("T")[0],
    status: "Overdue",
    items: [
      { productId: "prod-3", qty: 20, rate: 279, discount: 0 },
      { productId: "prod-4", qty: 1, rate: 5999, discount: 0 }
    ],
    paidAmount: 0,
    createdBy: "test-user-id",
    taxType: "auto"
  }
]);

export const seedPurchases = () => ([
  {
    id: "pur-201",
    companyId: "test-company-id",
    number: "PO-201",
    date: new Date(Date.now() - 8 * 86400000).toISOString().split("T")[0],
    vendorId: "vend-1",
    status: "Received",
    items: [
      { productId: "prod-1", qty: 50, rate: 320 },
      { productId: "prod-2", qty: 15, rate: 1450 }
    ],
    createdBy: "test-user-id"
  }
]);

export const seedExpenses = () => ([
  {
    id: "exp-301",
    companyId: "test-company-id",
    date: new Date(Date.now() - 2 * 86400000).toISOString().split("T")[0],
    category: "Electricity",
    amount: 4500,
    vendor: "MSEDCL Electricity Board",
    method: "Net Banking",
    description: "Office power bill for current month",
    createdBy: "test-user-id"
  },
  {
    id: "exp-302",
    companyId: "test-company-id",
    date: new Date(Date.now() - 7 * 86400000).toISOString().split("T")[0],
    category: "Internet",
    amount: 1899,
    vendor: "Airtel Broadband",
    method: "UPI",
    description: "High speed fiber plan",
    createdBy: "test-user-id"
  }
]);

export const seedPayments = () => ([
  {
    id: "pay-401",
    companyId: "test-company-id",
    date: new Date(Date.now() - 4 * 86400000).toISOString().split("T")[0],
    type: "In",
    partyId: "cust-1",
    refNumber: "INV-101",
    amount: 2000,
    method: "UPI",
    notes: "Advance part payment via GPay",
    createdBy: "test-user-id"
  },
  {
    id: "pay-402",
    companyId: "test-company-id",
    date: new Date(Date.now() - 10 * 86400000).toISOString().split("T")[0],
    type: "In",
    partyId: "cust-2",
    refNumber: "INV-102",
    amount: 31267,
    method: "Bank Transfer",
    notes: "Full invoice clearance",
    createdBy: "test-user-id"
  }
]);

export const seedTickets = () => ([
  {
    id: "tick-501",
    companyId: "test-company-id",
    ticketNumber: "TCK-1001",
    name: "Rahul Mehra",
    email: "rahul@techpark.in",
    phone: "+91 98220 12345",
    subject: "Bulk enquiry for 50 LED Monitors",
    message: "We need a quotation for 50 units of 24 inch monitors with corporate GST invoice.",
    source: "Website",
    status: "new",
    priority: "high",
    assignedTo: "user-3",
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
]);

export const seedTasks = () => ([
  {
    id: "task-601",
    companyId: "test-company-id",
    title: "Follow up on overdue payment #INV-103",
    description: "Call Sunil Mehta at Capital Traders regarding ₹13,638 pending payment.",
    status: "todo",
    priority: "urgent",
    category: "Accounts & GST",
    assignedTo: "user-2",
    dueDate: new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-602",
    companyId: "test-company-id",
    title: "Send quotation for 50 LED Monitors",
    description: "Prepare and dispatch formal quote for Ticket #TCK-1001.",
    status: "in_progress",
    priority: "high",
    category: "Sales",
    assignedTo: "user-3",
    dueDate: new Date(Date.now() + 2 * 86400000).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-603",
    companyId: "test-company-id",
    title: "Restock Executive Office Chairs",
    description: "Current stock is 8, which is below reorder level (10). Raise PO to Prime Distributors.",
    status: "review",
    priority: "medium",
    category: "Inventory",
    assignedTo: "user-4",
    dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: "task-604",
    companyId: "test-company-id",
    title: "Monthly GSTR-1 & 3B Reconciliation",
    description: "Cross check sales register with E-way bills and tally tax liability.",
    status: "completed",
    priority: "high",
    category: "Accounts & GST",
    assignedTo: "user-2",
    dueDate: new Date(Date.now() - 3 * 86400000).toISOString().split("T")[0],
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
]);
