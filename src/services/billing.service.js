import apiClient from '../api/apiClient';
import { prepareInvoicePayloadForApi } from '../utils/invoicePayload';
import { USE_MOCK_API } from '../api/apiConfig';

const DOCS_KEY = 'cubixgear:billing-documents';
const INVENTORY_KEY = 'cubixgear:inventory';
const STOCK_LEDGER_KEY = 'cubixgear:stock-ledger';
const JOB_PREFILL_KEY = 'cubixgear:invoice-job-prefill';
import { calculateEstimateIndiaGst } from '../utils/indiaGst';
import { invoiceStateCode, localInvoiceDate } from '../utils/invoiceTaxUi';
import { loadDocumentTemplateSettings, resolveDocumentAppearance } from './documentTemplates.service';

const seedDocuments = [
  {
    id: 'INV-2026-27023',
    number: '202627023',
    kind: 'invoice',
    invoiceType: 'gst',
    status: 'Finalized',
    date: '2026-06-03',
    seller: {
      name: 'Fine Polymeric Products LLP',
      address: 'S NO 368, NIDA NO.3 ROAD, NIDA KANJIKODE INDUSTRIAL AREA, PALAKKAD, KERALA-678621',
      phone: '8129231329',
      email: 'finepolymericproducts22@gmail.com',
      gstin: '32AAIFF2342J1ZO',
      state: 'Kerala',
      stateCode: '32'
    },
    customer: {
      name: 'NATION LEATHER',
      phone: '',
      email: '',
      address: '4TH, 124 FLAT 4B USTAD ENAYET KHAN AVENUE, KOLKATA, WEST BENGAL-700017',
      gstin: '19BURPK8273K1ZN',
      state: 'West Bengal',
      stateCode: '19',
      placeOfSupply: '19-West Bengal'
    },
    transportation: {
      vehicleNo: 'OD07AH1556',
      transporterName: ''
    },
    vehicle: { registration: 'OD07AH1556', makeModel: '', odometer: '', vin: '' },
    jobCardNo: '',
    staff: '',
    notes: '',
    items: [
      {
        id: 'FPP-1',
        type: 'Custom Item',
        description: 'Eva Pushout',
        code: '',
        hsnCode: '391590',
        qty: 9000,
        unit: 'KG',
        purchasePrice: 0,
        rate: 30,
        taxRate: 18,
        discount: 0,
        inventoryId: ''
      },
      {
        id: 'FPP-2',
        type: 'Custom Item',
        description: 'Chappal Grinding Sheet',
        code: '',
        hsnCode: '40040000',
        qty: 14450,
        unit: 'KG',
        purchasePrice: 0,
        rate: 25,
        taxRate: 5,
        discount: 0,
        inventoryId: ''
      }
    ],
    discount: 0,
    adjustment: 0.5,
    taxMode: 'igst',
    cgstRate: 0,
    sgstRate: 0,
    igstRate: 18,
    paid: 0,
    paymentMode: 'Credit',
    paymentType: 'Credit',
    paymentTerms: 'Credit',
    termsAndConditions: 'All disputes under this invoice will be settled in Palakkad Jurisdiction only',
    finalizedAt: '2026-06-03T09:00:00.000Z'
  },
  {
    id: 'INV-2026-1001', number: 'INV-2026-1001', kind: 'invoice', invoiceType: 'regular', status: 'Finalized', date: '2026-09-12',
    customer: { name: 'Rahul P', phone: '+91 98765 43210', address: '', gstin: '' },
    vehicle: { registration: 'KL-08-BQ-4581', makeModel: 'Toyota Innova Crysta', odometer: '52,400 km', vin: '' },
    jobCardNo: 'JOB-2048', staff: 'Rahul', notes: 'Periodic maintenance completed.',
    items: [
      { id: 'L1', type: 'Labour', description: 'Periodic service labour', code: '', hsnCode: '998729', qty: 1, unit: 'NOS', purchasePrice: 0, rate: 1200, taxRate: 18, discount: 0, inventoryId: '' },
      { id: 'P1', type: 'Stock Part', description: 'Oil Filter', code: 'FLT-OIL-02', hsnCode: '84212300', qty: 1, unit: 'PCS', purchasePrice: 280, rate: 450, taxRate: 18, discount: 0, inventoryId: 'ITM-1002' }
    ],
    discount: 0, taxMode: 'none', cgstRate: 0, sgstRate: 0, igstRate: 0, paid: 1650, paymentMode: 'UPI', paymentTerms: 'C.O.D', finalizedAt: '2026-09-12T10:00:00.000Z'
  }
];

const clone = (value) => JSON.parse(JSON.stringify(value));
const read = (key, fallback = []) => {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);

      if (key === DOCS_KEY && Array.isArray(parsed) && Array.isArray(fallback)) {
        const missingSeeds = fallback.filter((seed) => !parsed.some((row) => row.id === seed.id));
        if (missingSeeds.length) {
          const merged = [...missingSeeds, ...parsed];
          localStorage.setItem(key, JSON.stringify(merged));
          return clone(merged);
        }
      }

      return parsed;
    }
  } catch {
    localStorage.removeItem(key);
  }
  localStorage.setItem(key, JSON.stringify(fallback));
  return clone(fallback);
};
const write = (key, value) => {
  localStorage.setItem(key, JSON.stringify(value));
  return clone(value);
};
const id = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
const today = () => new Date().toISOString().slice(0, 10);

const getJobInvoicePrefill = () => {
  try {
    return JSON.parse(localStorage.getItem(JOB_PREFILL_KEY) || 'null');
  } catch {
    return null;
  }
};

export const blankBillingDocument = (kind = 'invoice', { emptyInputs = false, jobId = '' } = {}) => {
  // A normal New Invoice must start blank even when an old Job Card prefill
  // remains in localStorage. Only an explicit jobId deep link may use it.
  const storedPrefill = USE_MOCK_API && kind === 'invoice' ? getJobInvoicePrefill() : null;
  const linkedJobId = String(jobId || '').trim();
  const prefill = storedPrefill && (
    !emptyInputs || (linkedJobId && String(storedPrefill.jobId) === linkedJobId)
  ) ? storedPrefill : null;
  return {
    kind,
    invoiceType: 'regular', // Replaced by verified workshop registration on create.
    status: 'Draft',
    date: emptyInputs ? localInvoiceDate() : today(),
    seller: { name: emptyInputs ? '' : 'CubixGear Workshop', address: '', phone: '', email: '', gstin: '', state: '', stateCode: '' },
    customer: { name: '', phone: '', address: '', gstin: '', state: '', stateCode: '', placeOfSupply: '', ...(prefill?.customer || {}) },
    vehicle: { registration: '', makeModel: '', odometer: '', vin: '', ...(prefill?.vehicle || {}) },
    jobCardNo: prefill?.jobNumber || prefill?.jobId || '',
    sourceJobId: prefill?.jobId || '',
    staff: '',
    transportation: { vehicleNo: '', transporterName: '', ...(prefill?.transportation || {}) },
    notes: prefill?.jobId ? `Created from Job Card ${prefill.jobNumber || prefill.jobId}` : '',
    items: Array.isArray(prefill?.items)
      ? clone(prefill.items).map((item) => ({ unit: emptyInputs ? '' : 'PCS', hsnCode: '', taxRate: '', ...item }))
      : [],
    discount: emptyInputs ? '' : 0,
    adjustment: '',
    taxMode: emptyInputs ? '' : 'none', cgstRate: emptyInputs ? '' : 9,
    sgstRate: emptyInputs ? '' : 9, igstRate: emptyInputs ? '' : 18,
    paid: '', paymentMode: emptyInputs ? '' : 'Cash',
    paymentType: emptyInputs ? '' : 'Credit', paymentTerms: emptyInputs ? '' : 'C.O.D',
    termsAndConditions: emptyInputs ? '' : 'Thank you for choosing CubixGear.'
  };
};

export const calculateDocumentTotals = (doc) => {
  // A billing line's own discount is removed before invoice-wide discount.
  // Share the same line-wise paise rounding as Job Card previews and Django.
  const rows = (doc.items || []).map((item) => ({
    item,
    taxable: Math.max(0, Number(item.qty || 0) * Number(item.rate || 0) -
      Number(item.discount || 0)),
  }));
  // Accept a 2-digit state code OR a state name (e.g. "Kerala").
  // String.slice(0, 2) used to turn "Kerala" into "Ke", causing the
  // GST preview to lose its tax calculation even with a valid state.
  const supplier = invoiceStateCode(
    doc.seller?.gstin?.slice(0, 2) || doc.seller?.stateCode || doc.seller?.state,
  );
  const suppliedPlace = String(
    doc.customer?.placeOfSupply || doc.customer?.stateCode || doc.customer?.state || '',
  ).trim();
  const placeOfSupply = invoiceStateCode(suppliedPlace) ||
    (!suppliedPlace ? supplier : '');
  const documentDiscount = Number(doc.discount || 0);
  const gst = calculateEstimateIndiaGst({
    lines: rows.map(({ item, taxable }) => ({
      type: item.type || 'Service', quantity: 1, unitPrice: taxable,
      taxRate: item.taxRate,
    })),
    discount: documentDiscount,
    registered: doc.invoiceType === 'gst',
    supplierState: supplier,
    placeOfSupply,
  });
  const taxGroups = new Map();
  gst.taxRows.forEach((row, index) => {
    const rate = Number(rows[index]?.item.taxRate || 0);
    const key = gst.mode + ':' + rate;
    const current = taxGroups.get(key) || {
      type: gst.mode === 'igst' ? 'IGST' : 'CGST + SGST',
      rate, taxable: 0, tax: 0,
    };
    current.taxable += row.taxable;
    current.tax += row.cgst + row.sgst + row.igst;
    taxGroups.set(key, current);
  });
  // Line totals use the same GST and invoice-discount allocation as the
  // grand total. This prevents the estimate, invoice and print preview from
  // showing a pre-tax amount while the backend saves a GST-inclusive amount.
  const lineTotals = gst.taxRows.map((row) => ({
    taxable: row.taxable,
    gst: row.cgst + row.sgst + row.igst,
    total: Number((row.taxable + row.cgst + row.sgst + row.igst).toFixed(2)),
  }));
  const adjustment = Number(doc.adjustment || 0);
  const total = Number((gst.total + adjustment).toFixed(2));
  const paid = Number(doc.paid || 0);
  return {
    lineTotals,
    itemSubtotal: gst.subtotal,
    documentDiscount,
    taxable: gst.taxable,
    cgst: gst.cgst,
    sgst: gst.sgst,
    igst: gst.igst,
    taxMode: gst.mode,
    taxGroups: Array.from(taxGroups.values()),
    adjustment,
    rounding: adjustment,
    total,
    paid,
    balance: Math.max(0, Number((total - paid).toFixed(2))),
  };
};

const nextNumber = (kind, docs) => {
  const prefix = kind === 'estimate' ? 'EST' : 'INV';
  const year = new Date().getFullYear();
  const count = docs.filter((d) => d.kind === kind).length + 1;
  return `${prefix}-${year}-${String(count).padStart(4, '0')}`;
};

const applyStockMovement = (doc, direction) => {
  const inventory = read(INVENTORY_KEY, []);
  const ledger = read(STOCK_LEDGER_KEY, []);
  const movements = [];
  for (const item of doc.items || []) {
    if (item.type !== 'Stock Part' || !item.inventoryId) continue;
    const qty = Number(item.qty || 0);
    const index = inventory.findIndex((row) => String(row.id) === String(item.inventoryId));
    if (index < 0) continue;
    const current = Number(inventory[index].onHand || 0);
    const next = direction === 'issue' ? current - qty : current + qty;
    if (direction === 'issue' && next < 0) throw new Error(`${inventory[index].name} has only ${current} in stock.`);
    inventory[index] = { ...inventory[index], onHand: next };
    movements.push({ id: id('LED'), date: new Date().toISOString(), documentId: doc.id, documentNo: doc.number, inventoryId: item.inventoryId, itemName: inventory[index].name, qty: direction === 'issue' ? -qty : qty, action: direction === 'issue' ? 'Invoice Finalized' : 'Invoice Cancelled' });
  }
  write(INVENTORY_KEY, inventory);
  write(STOCK_LEDGER_KEY, [...movements, ...ledger]);
};

const safePdfName = (value) => String(value || 'invoice')
  .replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 80) || 'invoice';

/**
 * Fetch a saved, tenant-authorized PDF exactly once for sharing/downloading.
 * Never build financial documents from unsaved editor state.
 */
export const getBillingPdfFile = async (savedInvoice) => {
  const documentId = typeof savedInvoice === 'object' ? savedInvoice?.id : savedInvoice;
  const number = typeof savedInvoice === 'object' ? savedInvoice?.number : '';
  if (!documentId) throw new Error('Save the invoice before downloading its PDF.');
  if (USE_MOCK_API) {
    throw new Error('Official invoice PDF download requires the connected Django backend.');
  }
  const pdf = await apiClient.get('/billing/documents/' + encodeURIComponent(documentId) + '/pdf', {
    responseType: 'blob',
    // Old Django deployments can negotiate JSON before returning PDF bytes.
    headers: { Accept: 'application/pdf, application/json' }
  });
  if (!(pdf instanceof Blob) || (pdf.type && !pdf.type.includes('pdf'))) {
    throw new Error('The server did not return a valid invoice PDF.');
  }
  const filename = safePdfName(number || documentId) + '.pdf';
  return new File([pdf], filename, { type: 'application/pdf' });
};

/** Save the already-fetched PDF locally, without another API call. */
export const saveBillingPdfFile = (file) => {
  if (!(file instanceof File) || file.type !== 'application/pdf') {
    throw new Error('The PDF file is not ready to download.');
  }
  const url = URL.createObjectURL(file);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = file.name;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Some browsers need the blob URL to survive until the download starts.
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  return file.name;
};

/** Existing direct download API is retained for other billing workflows. */
export const downloadBillingPdf = async (savedInvoice) => {
  const file = await getBillingPdfFile(savedInvoice);
  return saveBillingPdfFile(file);
};

export const billingService = {
  downloadPdf: downloadBillingPdf,
  getPdfFile: getBillingPdfFile,
  savePdfFile: saveBillingPdfFile,
  async previewTotals(document) {
    if (!USE_MOCK_API) {
      return apiClient.post('/billing/documents/preview', {
        kind: document.kind,
        invoiceType: document.invoiceType,
        customer: { placeOfSupply: document.customer?.placeOfSupply ||
          document.customer?.stateCode || document.customer?.state || '' },
        items: (document.items || []).map(({ qty, rate, discount, taxRate }) =>
          ({ qty, rate, discount, taxRate })),
        discount: document.discount,
        adjustment: document.adjustment,
        paid: document.paid,
      });
    }
    return calculateDocumentTotals(document);
  },
  async getJobInvoiceDraft(jobId) {
    if (!jobId) throw new Error('Select a Job Card first.');
    if (USE_MOCK_API) throw new Error('Verified Job Card invoice drafts require the live backend.');
    return apiClient.get('/billing/documents/job-draft', { params: { jobId } });
  },
  async getGstContext() {
    if (!USE_MOCK_API) return apiClient.get('/billing/documents/gst-context');
    return { registered: false, gstin: '', supplierState: '', companyName: 'Sample Workshop' };
  },
  async list(params = {}) {
    if (!USE_MOCK_API) return apiClient.get('/billing/documents', { params });
    return read(DOCS_KEY, seedDocuments);
  },
  async get(documentId) {
    if (!USE_MOCK_API) return apiClient.get(`/billing/documents/${documentId}`);
    return read(DOCS_KEY, seedDocuments).find((row) => row.id === documentId) || null;
  },
  async saveDraft(payload) {
    if (!USE_MOCK_API) {
      const clean = prepareInvoicePayloadForApi(payload);
      return payload.id ? apiClient.put(`/billing/documents/${payload.id}`, clean) : apiClient.post('/billing/documents', clean);
    }
    const docs = read(DOCS_KEY, seedDocuments);
    if (payload.id) {
      const next = docs.map((row) => row.id === payload.id ? { ...row, ...payload, updatedAt: new Date().toISOString() } : row);
      write(DOCS_KEY, next);
      return clone(next.find((row) => row.id === payload.id));
    }
    const document = { ...blankBillingDocument(payload.kind), ...payload, id: id(payload.kind === 'estimate' ? 'EST' : 'INV'), number: nextNumber(payload.kind || 'invoice', docs), status: 'Draft', createdAt: new Date().toISOString() };
    write(DOCS_KEY, [document, ...docs]);
    try { localStorage.removeItem(JOB_PREFILL_KEY); } catch { /* noop */ }
    return clone(document);
  },
  async finalize(documentId) {
    if (!USE_MOCK_API) return apiClient.post(`/billing/documents/${documentId}/finalize`);
    const docs = read(DOCS_KEY, seedDocuments);
    const doc = docs.find((row) => row.id === documentId);
    if (!doc) throw new Error('Document not found.');
    if (doc.kind === 'invoice' && doc.status !== 'Finalized' && doc.status !== 'Paid') applyStockMovement(doc, 'issue');
    const status = doc.kind === 'estimate' ? 'Issued' : 'Finalized';
    const settings = await loadDocumentTemplateSettings();
    const nextDoc = {
      ...doc, status, finalizedAt: new Date().toISOString(),
      templateSnapshot: resolveDocumentAppearance(doc.kind, settings),
    };
    write(DOCS_KEY, docs.map((row) => row.id === documentId ? nextDoc : row));
    return clone(nextDoc);
  },
  async cancel(documentId, reason) {
    const cleanReason = String(reason ?? '').trim();
    if (cleanReason.length < 5 || cleanReason.length > 500) {
      throw new Error('Provide a cancellation reason between 5 and 500 characters.');
    }
    if (!USE_MOCK_API) return apiClient.post(
      `/billing/documents/${encodeURIComponent(documentId)}/cancel`,
      { reason: cleanReason },
    );
    const docs = read(DOCS_KEY, seedDocuments);
    const doc = docs.find((row) => row.id === documentId);
    if (!doc) throw new Error('Document not found.');
    if (doc.status === 'Cancelled') return clone(doc);
    if (doc.status !== 'Draft') throw new Error('Issued documents cannot be cancelled without a reversal.');
    const nextDoc = {
      ...doc, status: 'Cancelled', cancelledAt: new Date().toISOString(),
      cancellationReason: cleanReason,
    };
    write(DOCS_KEY, docs.map((row) => row.id === documentId ? nextDoc : row));
    return clone(nextDoc);
  },
  async remove() {
    // All saved invoice numbers remain part of the financial audit trail.
    // Drafts are cancelled with reasons; issued documents need reversals.
    throw new Error('Saved invoices and estimates cannot be deleted. Cancel an unissued draft instead.');
  },
  async convertEstimateToInvoice(estimateId) {
    if (!USE_MOCK_API) {
      return apiClient.post(`/billing/documents/${estimateId}/convert-to-invoice`);
    }

    const docs = read(DOCS_KEY, seedDocuments);
    const estimate = docs.find((row) => row.id === estimateId);

    if (!estimate) throw new Error('Estimate / quotation not found.');
    if (estimate.kind !== 'estimate') throw new Error('Only estimates can be converted to invoices.');

    // Prevent duplicate sales from the same quotation.
    if (estimate.convertedToInvoiceId) {
      const existingInvoice = docs.find((row) => row.id === estimate.convertedToInvoiceId);
      if (existingInvoice) return clone(existingInvoice);
    }

    const {
      id: _id,
      number: _number,
      status: _status,
      finalizedAt: _finalizedAt,
      cancelledAt: _cancelledAt,
      templateSnapshot: _templateSnapshot,
      convertedAt: _convertedAt,
      convertedToInvoiceId: _convertedToInvoiceId,
      convertedToInvoiceNo: _convertedToInvoiceNo,
      ...copy
    } = estimate;

    const invoiceId = id('INV');
    const invoiceNumber = nextNumber('invoice', docs);
    const now = new Date().toISOString();

    const invoice = {
      ...blankBillingDocument('invoice'),
      ...clone(copy),
      id: invoiceId,
      number: invoiceNumber,
      kind: 'invoice',
      invoiceType: estimate.invoiceType || 'regular',
      status: 'Draft',
      date: today(),
      sourceEstimateId: estimate.id,
      sourceEstimateNo: estimate.number,
      paid: '',
      createdAt: now,
      updatedAt: now
    };

    const convertedEstimate = {
      ...estimate,
      status: 'Converted',
      convertedAt: now,
      convertedToInvoiceId: invoice.id,
      convertedToInvoiceNo: invoice.number,
      updatedAt: now
    };

    const nextDocs = docs.map((row) => row.id === estimateId ? convertedEstimate : row);
    write(DOCS_KEY, [invoice, ...nextDocs]);

    return clone(invoice);
  },
  async inventory() {
    if (!USE_MOCK_API) return apiClient.get('/inventory');
    return read(INVENTORY_KEY, []);
  }
};
