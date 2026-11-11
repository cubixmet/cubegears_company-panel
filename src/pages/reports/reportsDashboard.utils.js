const moneyNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

export const reportMoney = (value) => value === null || value === undefined
  ? '—'
  : new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR', maximumFractionDigits: 2,
  }).format(Number(value));

export const reportShortMoney = (value) => value === null || value === undefined
  ? '—' : new Intl.NumberFormat('en-IN', {
    notation: 'compact', maximumFractionDigits: 1,
  }).format(Number(value));

const readRows = (result) => Array.isArray(result)
  ? result : Array.isArray(result?.results) ? result.results : [];

export const reportRows = readRows;

// Prefer persisted Django money fields over re-computing finalized balances.
// Legacy local billing records do not have persisted totals.
const legacyInvoiceTotal = (row) => {
  if (!Array.isArray(row.items)) return null;
  const items = row.items.map((item) => ({
    taxable: Math.max(0, Number(item.qty || 0) * Number(item.rate || 0) -
      Number(item.discount || 0)),
    taxRate: Number(item.taxRate || 0),
  }));
  const subtotal = items.reduce((sum, item) => sum + item.taxable, 0);
  const taxable = Math.max(0, subtotal - Number(row.discount || 0));
  const ratio = subtotal > 0 ? taxable / subtotal : 0;
  const gst = row.invoiceType === 'gst' && row.taxMode !== 'none'
    ? items.reduce((sum, item) => sum + item.taxable * ratio *
        (item.taxRate || (row.taxMode === 'igst'
          ? Number(row.igstRate || 0)
          : Number(row.cgstRate || 0) + Number(row.sgstRate || 0))) / 100, 0)
    : 0;
  const gross = taxable + gst;
  const adjustment = row.adjustment !== '' && row.adjustment != null
    ? Number(row.adjustment || 0) : Math.round(gross) - gross;
  return Math.round((gross + adjustment) * 100) / 100;
};

export const invoiceAmounts = (row) => {
  const total = moneyNumber(row.total ?? row.totalAmount) ?? legacyInvoiceTotal(row);
  const paid = moneyNumber(row.paid ?? row.paidAmount) ?? 0;
  const recordedBalance = moneyNumber(row.balance ?? row.balanceDue);
  const balance = recordedBalance ??
    (total !== null ? Math.max(0, total - paid) : null);
  return { total, paid, balance: balance !== null ? Math.max(0, balance) : null };
};

export const reportDate = (row, type) => {
  const value = type === 'expense'
    ? row.date || row.expenseDate
    : type === 'payment'
      ? row.date || row.paymentDate
      : row.date || row.invoiceDate;
  return String(value || '').slice(0, 10);
};

export const isWithinReportPeriod = (date, from, to) =>
  Boolean(date) && (!from || date >= from) && (!to || date <= to);

export const reportBranch = (row) => {
  const branch = row.branchName ?? row.branch_name ?? row.branch;
  return typeof branch === 'object' && branch !== null
    ? String(branch.name || branch.id || '')
    : String(branch || '').trim();
};

export const reportStaff = (row) => {
  const staff = row.staff ?? row.staff_name ?? row.recordedBy ?? row.recorded_by;
  return typeof staff === 'object' && staff !== null
    ? String(staff.name || '')
    : String(staff || '').trim();
};

export const reportFilterOptions = (groups = []) => ({
  branches: [...new Set(groups.flatMap((rows) => rows.map(reportBranch).filter(Boolean)))].sort(),
  staff: [...new Set(groups.flatMap((rows) => rows.map(reportStaff).filter(Boolean)))].sort(),
});

export const matchesReportScope = (row, branch, staff) => {
  if (branch !== 'All' && reportBranch(row) !== branch) return false;
  if (staff !== 'All' && reportStaff(row) !== staff) return false;
  return true;
};

export const isRealInvoice = (row) =>
  String(row.kind || 'invoice').toLowerCase() === 'invoice' &&
  !['draft', 'cancelled', 'canceled', 'void'].includes(String(row.status || '').toLowerCase());

export const isRealPayment = (row) =>
  !row.reversed_at && !row.reversedAt &&
  !['pending', 'refunded', 'reversed', 'failed', 'cancelled', 'canceled'].includes(
    String(row.status || 'completed').toLowerCase());

export const isRealExpense = (row) =>
  !['draft', 'cancelled', 'canceled', 'void', 'rejected'].includes(String(row.status || '').toLowerCase());

const round = (number) => Math.round(number * 100) / 100;

export const reportPeriodOptions = (year, month) => {
  const yyyy = Number(year);
  const mm = Number(month);
  if (!Number.isInteger(yyyy) || !Number.isInteger(mm) || mm < 1 || mm > 12 || yyyy < 2000 || yyyy > 2100) {
    return null;
  }
  const last = new Date(yyyy, mm, 0).getDate();
  return {
    from: yyyy + '-' + String(mm).padStart(2, '0') + '-01',
    to: yyyy + '-' + String(mm).padStart(2, '0') + '-' + last,
  };
};

export const buildReportSummary = ({
  invoices = [], payments = [], expenses = [], stock = [],
  from = '', to = '', branch = 'All', staff = 'All',
  available = { invoices: true, payments: true, expenses: true, stock: true },
} = {}) => {
  const scoped = (rows, kind) => rows.filter((row) =>
    isWithinReportPeriod(reportDate(row, kind), from, to) &&
    matchesReportScope(row, branch, staff));
  const invoiceRows = available.invoices
    ? scoped(invoices.filter(isRealInvoice), 'invoice') : [];
  const paymentRows = available.payments
    ? scoped(payments.filter(isRealPayment), 'payment') : [];
  const expenseRows = available.expenses
    ? scoped(expenses.filter(isRealExpense), 'expense') : [];

  const sales = round(invoiceRows.reduce((sum, inv) => sum + (invoiceAmounts(inv).total || 0), 0));
  const outstanding = round(invoiceRows.reduce((sum, inv) => sum + (invoiceAmounts(inv).balance || 0), 0));
  // Outgoing customer refunds reduce cash received; reversed receipts never count.
  const collected = round(paymentRows.reduce((sum, item) =>
    sum + (String(item.direction || 'IN').toUpperCase() === 'OUT' ? -1 : 1) *
      (moneyNumber(item.amount) || 0), 0));
  // Recognized operating expenses and paid cash expenses are different metrics.
  const expenseTotal = round(expenseRows.reduce((sum, item) => sum + (moneyNumber(item.amount) || 0), 0));
  const expensePaidTotal = round(expenseRows.reduce((sum, item) =>
    // Live Django sends paidAmount explicitly, including zero. Only legacy
    // demo records with no paid field use their historical Paid status.
    sum + (moneyNumber(item.paidAmount ?? item.paid_amount ??
      (String(item.status || '').toLowerCase() === 'paid' ? item.amount : 0)) || 0), 0));
  const stockRows = available.stock && branch === 'All' && staff === 'All' ? stock : [];
  // Stock is a current snapshot, not a historical date-scoped financial series.
  const stockValue = round(stockRows.reduce((sum, row) =>
    sum + (moneyNumber(row.onHand) || 0) * (moneyNumber(row.costPrice) || 0), 0));
  const lowStock = stockRows.filter((row) =>
    (moneyNumber(row.onHand) || 0) - (moneyNumber(row.reserved) || 0) <=
    (moneyNumber(row.minimumStock) || 0));

  const categoryMap = new Map();
  expenseRows.forEach((row) => {
    const key = String(row.category || 'Uncategorised');
    categoryMap.set(key, round((categoryMap.get(key) || 0) + (moneyNumber(row.amount) || 0)));
  });
  const expenseCategories = [...categoryMap].map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);

  return {
    invoiceRows, paymentRows, expenseRows, sales, outstanding, collected,
    expenseTotal, expensePaidTotal, netCash: round(collected - expensePaidTotal), stockValue, lowStock,
    expenseCategories, stockRows, available,
    comparable: branch === 'All' && staff === 'All',
  };
};

export const reportChartBuckets = (report, from, to) => {
  if (!from || !to || from > to) return [];
  const start = new Date(from + 'T00:00:00Z');
  const end = new Date(to + 'T00:00:00Z');
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  const days = Math.round((end - start) / 86400000) + 1;
  const mode = days > 62 ? 'month' : days > 14 ? 'week' : 'day';
  const buckets = new Map();
  const keyOf = (date) => {
    if (mode === 'month') return date.slice(0, 7);
    if (mode === 'day') return date;
    const d = new Date(date + 'T00:00:00Z');
    const offset = Math.floor((d - start) / 86400000 / 7);
    return String(offset);
  };
  const step = mode === 'month' ? 30 : mode === 'week' ? 7 : 1;
  for (let i = 0; i < days; i += step) {
    const current = new Date(start.getTime() + i * 86400000);
    const date = current.toISOString().slice(0, 10);
    const key = keyOf(date);
    const label = mode === 'month' ? current.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      : mode === 'week' ? 'W' + (Number(key) + 1) : String(current.getUTCDate());
    if (!buckets.has(key)) buckets.set(key, { key, label, billed: 0, collected: 0, expenses: 0 });
  }
  // For months use exact calendar increments: the 30-day approximation above
  // could skip February or produce two buckets in a 31-day calendar month.
  if (mode === 'month') {
    buckets.clear();
    const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 7);
      buckets.set(key, { key, label: cursor.toLocaleDateString('en-IN', {
        month: 'short', year: '2-digit', timeZone: 'UTC',
      }), billed: 0, collected: 0, expenses: 0 });
      cursor.setUTCMonth(cursor.getUTCMonth() + 1);
    }
  }
  for (const [rows, field, kind, amount] of [
    [report.invoiceRows, 'billed', 'invoice', (row) => invoiceAmounts(row).total],
    [report.paymentRows, 'collected', 'payment', (row) =>
      (String(row.direction || 'IN').toUpperCase() === 'OUT' ? -1 : 1) *
      (moneyNumber(row.amount) || 0)],
    [report.expenseRows, 'expenses', 'expense', (row) => moneyNumber(row.amount) || 0],
  ]) {
    rows.forEach((row) => {
      const bucket = buckets.get(keyOf(reportDate(row, kind)));
      if (bucket) bucket[field] += amount(row);
    });
  }
  return [...buckets.values()].map((row) => ({
    ...row, billed: round(row.billed), collected: round(row.collected), expenses: round(row.expenses),
  }));
};
