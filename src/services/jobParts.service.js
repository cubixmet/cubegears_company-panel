import { USE_MOCK_API } from '../api/apiConfig';
import apiClient from '../api/apiClient';
import { jobService } from './job.service';
import { stockService } from './stock.service';

const now = () => new Date().toISOString();
const txnNo = (prefix) => `${prefix}-${Date.now().toString().slice(-8)}`;

const num = (value) => Number(value || 0);

export const derivePartLine = (line, stockItem) => {
  const issues = Array.isArray(line.issues) ? line.issues : [];
  const returns = Array.isArray(line.returns) ? line.returns : [];
  const grossIssued = issues.reduce((sum, row) => sum + num(row.qty), 0);
  const returned = returns.reduce((sum, row) => sum + num(row.qty), 0);
  const netIssued = Math.max(0, grossIssued - returned);
  const requestedQty = num(line.requestedQty);
  const pendingQty = Math.max(0, requestedQty - netIssued);
  const qtyOnHand = num(stockItem?.onHand);
  const availableQty = Math.max(0, qtyOnHand - num(stockItem?.reserved));

  let stockState = 'Available';
  if (pendingQty > 0 && availableQty <= 0) stockState = 'Order Required';
  else if (pendingQty > 0 && availableQty < pendingQty) stockState = 'Partial';

  return {
    ...line,
    stockItem,
    qtyOnHand,
    availableQty,
    grossIssued,
    returnedQty: returned,
    netIssued,
    pendingQty,
    stockState
  };
};

const normalizeLegacyParts = (job) => {
  if (Array.isArray(job?.partsWorkflow?.lines)) return job.partsWorkflow.lines;
  return (job?.partsUsed || []).map((item) => ({
    id: item.workflowLineId || `JPL-${item.id || item.partId}`,
    partId: item.partId || '',
    partName: item.name || 'Part',
    partNo: item.sku || '',
    barcode: item.barcode || '',
    brand: item.brand || '',
    requestedQty: num(item.qty || 1),
    sellingPrice: num(item.sellingPrice ?? item.unitPrice ?? 0),
    issuedTo: job.assignedEmployeeName || '',
    lineStatus: 'Open',
    issues: item.status === 'Issued' ? [{
      id: `LEGACY-${item.id}`,
      issueNo: `LEGACY-${item.id}`,
      qty: num(item.qty || 1),
      issuedAt: job.createdDate || now(),
      issuedTo: job.assignedEmployeeName || '',
      issuedBy: 'Existing Record'
    }] : [],
    returns: []
  }));
};

const buildState = async (job) => {
  const stock = await stockService.getStockItems();
  const stockMap = new Map(stock.map((item) => [item.id, item]));
  const raw = normalizeLegacyParts(job);
  const lines = raw.map((line) => derivePartLine(line, stockMap.get(line.partId)));
  const transactions = Array.isArray(job?.partsWorkflow?.transactions) ? job.partsWorkflow.transactions : [];
  const purchaseOrders = Array.isArray(job?.partsWorkflow?.purchaseOrders) ? job.partsWorkflow.purchaseOrders : [];

  const blocking = lines
    .filter((line) => line.lineStatus !== 'Cancelled' && line.pendingQty > 0)
    .map((line) => ({
      lineId: line.id,
      partName: line.partName,
      pendingQty: line.pendingQty,
      reason: `${line.partName}: ${line.pendingQty} pending`
    }));

  return {
    lines,
    transactions,
    purchaseOrders,
    outsideParts: Array.isArray(job?.partsWorkflow?.outsideParts) ? job.partsWorkflow.outsideParts : [],
    canComplete: blocking.length === 0,
    blockingReasons: blocking
  };
};

const persist = async (jobId, state) => {
  const cleanLines = state.lines.map(({ stockItem, qtyOnHand, availableQty, grossIssued, returnedQty, netIssued, pendingQty, stockState, ...line }) => line);
  // Read the latest job when editing stock lines so a stock requirement
  // never overwrites direct purchases saved through the outside-parts API.
  const currentJob = await jobService.getJobById(jobId);
  const previous = currentJob?.partsWorkflow || {};
  return jobService.updateJob(jobId, {
    partsWorkflow: {
      ...previous,
      lines: cleanLines,
      transactions: state.transactions,
      purchaseOrders: state.purchaseOrders,
      outsideParts: previous.outsideParts || state.outsideParts || []
    }
  });
};

export const getJobPartsWorkflow = async (jobId) => {
  if (!USE_MOCK_API) {
    const [availability, issues, eligibility, transactions] = await Promise.all([
      apiClient.get(`/job-cards/${jobId}/parts/availability`),
      apiClient.get(`/job-cards/${jobId}/issues`, { params: { tab: 'pending' } }),
      apiClient.get(`/job-cards/${jobId}/completion-eligibility`),
      apiClient.get(`/job-cards/${jobId}/parts/transactions`)
    ]);
    return {
      lines: availability?.lines || issues?.lines || [],
      transactions: transactions?.items || transactions || [],
      purchaseOrders: availability?.purchaseOrders || [],
      canComplete: Boolean(eligibility?.can_complete),
      blockingReasons: eligibility?.blocking_reasons || []
    };
  }

  const job = await jobService.getJobById(jobId);
  if (!job) throw new Error('Job card not found.');
  return buildState(job);
};

export const addRequiredPart = async (jobId, payload) => {
  const state = await getJobPartsWorkflow(jobId);
  const stock = await stockService.getStockItemById(payload.partId);
  if (!stock) throw new Error('Select a valid stock item.');

  const line = {
    id: `JPL-${Date.now()}`,
    partId: stock.id,
    partName: stock.partName,
    partNo: stock.sku,
    barcode: payload.barcode || '',
    brand: stock.brand || '',
    requestedQty: Math.max(1, num(payload.requestedQty || 1)),
    sellingPrice: num(payload.sellingPrice ?? stock.sellingPrice),
    issuedTo: payload.issuedTo || '',
    lineStatus: 'Open',
    issues: [],
    returns: []
  };

  state.lines = [derivePartLine(line, stock), ...state.lines];
  state.transactions = [{
    id: txnNo('REQ'),
    type: 'Required',
    partName: line.partName,
    qty: line.requestedQty,
    createdAt: now(),
    createdBy: 'Current User'
  }, ...state.transactions];

  state.canComplete = false;
  state.blockingReasons = [{ lineId: line.id, partName: line.partName, pendingQty: line.requestedQty, reason: `${line.partName}: ${line.requestedQty} pending` }, ...state.blockingReasons];
  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const issueJobParts = async (jobId, lineId, qty, issuedTo = '') => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/job-cards/${jobId}/issues`, { lines: [{ job_card_part_id: lineId, issue_qty: num(qty), issued_to: issuedTo }] });
  }

  const state = await getJobPartsWorkflow(jobId);
  const line = state.lines.find((row) => row.id === lineId);
  if (!line) throw new Error('Part line not found.');

  const issueQty = num(qty);
  if (!(issueQty > 0)) throw new Error('Issue quantity must be greater than zero.');
  if (issueQty > line.pendingQty) throw new Error(`Maximum pending quantity is ${line.pendingQty}.`);
  if (issueQty > line.availableQty) throw new Error(`Only ${line.availableQty} available in stock.`);

  await stockService.issueStock({
    itemId: line.partId,
    partName: line.partName,
    sku: line.partNo,
    quantity: issueQty,
    jobId,
    notes: `Issued from Job Card ${jobId}`
  });

  const issue = {
    id: txnNo('ISS'),
    issueNo: txnNo('ISS'),
    qty: issueQty,
    issuedTo: issuedTo || line.issuedTo || 'Workshop',
    issuedBy: 'Current User',
    issuedAt: now()
  };

  line.issues = [issue, ...(line.issues || [])];
  state.transactions = [{
    id: issue.id,
    type: 'Issue',
    partName: line.partName,
    qty: issueQty,
    reference: issue.issueNo,
    createdAt: issue.issuedAt,
    createdBy: issue.issuedBy
  }, ...state.transactions];

  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const returnJobParts = async (jobId, lineId, qty, disposition = 'Reusable') => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/job-cards/${jobId}/returns`, { lines: [{ job_card_part_id: lineId, return_qty: num(qty), disposition }] });
  }

  const state = await getJobPartsWorkflow(jobId);
  const line = state.lines.find((row) => row.id === lineId);
  if (!line) throw new Error('Part line not found.');

  const returnQty = num(qty);
  if (!(returnQty > 0)) throw new Error('Return quantity must be greater than zero.');
  if (returnQty > line.netIssued) throw new Error(`Maximum return quantity is ${line.netIssued}.`);

  await stockService.returnStock({
    itemId: line.partId,
    quantity: returnQty,
    jobId,
    condition: disposition,
    notes: `Returned from Job Card ${jobId}`
  });

  const ret = {
    id: txnNo('RET'),
    returnNo: txnNo('RET'),
    qty: returnQty,
    disposition,
    returnedBy: 'Current User',
    returnedAt: now()
  };
  line.returns = [ret, ...(line.returns || [])];

  state.transactions = [{
    id: ret.id,
    type: 'Return',
    partName: line.partName,
    qty: returnQty,
    reference: ret.returnNo,
    createdAt: ret.returnedAt,
    createdBy: ret.returnedBy
  }, ...state.transactions];

  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const createJobPurchaseOrder = async (jobId, lineId, payload) => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/job-cards/${jobId}/purchase-orders`, {
      job_card_part_id: lineId,
      vendor_id: payload.vendorId,
      vendor: payload.vendor,
      type: payload.type,
      ordered_qty: num(payload.orderedQty),
      unit_cost: num(payload.unitCost),
      discount: num(payload.discount),
      tax: num(payload.tax)
    });
  }

  const state = await getJobPartsWorkflow(jobId);
  const line = state.lines.find((row) => row.id === lineId);
  if (!line) throw new Error('Part line not found.');
  if (!payload.vendor?.trim()) throw new Error('Vendor is required.');

  const orderedQty = num(payload.orderedQty);
  if (!(orderedQty > 0)) throw new Error('Order quantity must be greater than zero.');

  const po = {
    id: txnNo('PO'),
    poNo: txnNo('PO'),
    jobId,
    lineId,
    partId: line.partId,
    partName: line.partName,
    vendor: payload.vendor.trim(),
    type: payload.type || 'Cash',
    orderDate: payload.orderDate || new Date().toISOString().slice(0, 10),
    requestedQty: line.pendingQty,
    orderedQty,
    unitCost: num(payload.unitCost),
    discount: num(payload.discount),
    tax: num(payload.tax),
    receivedQty: 0,
    status: 'Ordered'
  };

  state.purchaseOrders = [po, ...state.purchaseOrders];
  state.transactions = [{
    id: po.id,
    type: 'Order',
    partName: line.partName,
    qty: orderedQty,
    reference: po.poNo,
    createdAt: now(),
    createdBy: 'Current User'
  }, ...state.transactions];

  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const inwardPurchaseOrder = async (jobId, poId, payload) => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/purchase-orders/${poId}/inwards`, payload);
  }

  const state = await getJobPartsWorkflow(jobId);
  const po = state.purchaseOrders.find((row) => row.id === poId);
  if (!po) throw new Error('Purchase order not found.');

  const inwardQty = num(payload.inwardQty);
  const openQty = Math.max(0, num(po.orderedQty) - num(po.receivedQty));
  if (!(inwardQty > 0)) throw new Error('Inward quantity must be greater than zero.');
  if (inwardQty > openQty) throw new Error(`Only ${openQty} is open on this PO.`);
  if (!payload.billDate) throw new Error('Bill date is required.');

  await stockService.receiveStock({
    itemId: po.partId,
    partName: po.partName,
    quantity: inwardQty,
    supplier: po.vendor,
    invoiceNo: payload.billNo || po.poNo,
    notes: `Inward ${po.poNo} · Rack ${payload.rack || '-'}`
  });

  po.receivedQty = num(po.receivedQty) + inwardQty;
  po.status = po.receivedQty >= po.orderedQty ? 'Received' : 'Partially Received';
  po.billNo = payload.billNo || '';
  po.billDate = payload.billDate;
  po.taxType = payload.taxType || 'GST';
  po.rack = payload.rack || '';
  po.barcode = payload.barcode || `BC-${Date.now().toString().slice(-10)}`;

  const grnNo = txnNo('GRN');
  state.transactions = [{
    id: grnNo,
    type: 'Inward',
    partName: po.partName,
    qty: inwardQty,
    reference: grnNo,
    createdAt: now(),
    createdBy: 'Current User',
    meta: { poNo: po.poNo, billNo: po.billNo, barcode: po.barcode }
  }, ...state.transactions];

  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const cancelRequiredPart = async (jobId, lineId, reason) => {
  if (!reason?.trim()) throw new Error('Cancellation reason is required.');
  const state = await getJobPartsWorkflow(jobId);
  const line = state.lines.find((row) => row.id === lineId);
  if (!line) throw new Error('Part line not found.');
  if (line.netIssued > 0) throw new Error('Return issued quantity before cancelling this requirement.');

  line.lineStatus = 'Cancelled';
  line.cancelReason = reason.trim();
  state.transactions = [{
    id: txnNo('CAN'),
    type: 'Cancelled',
    partName: line.partName,
    qty: line.pendingQty,
    createdAt: now(),
    createdBy: 'Current User',
    meta: { reason: line.cancelReason }
  }, ...state.transactions];

  await persist(jobId, state);
  return getJobPartsWorkflow(jobId);
};

export const getOutsideJobParts = async (jobId) => {
  if (!USE_MOCK_API) {
    const result = await apiClient.get(`/job-cards/${jobId}/outside-parts`);
    return Array.isArray(result?.items) ? result.items : [];
  }
  const job = await jobService.getJobById(jobId);
  return job?.partsWorkflow?.outsideParts || [];
};

export const buyOutsideJobPart = async (jobId, payload) => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/job-cards/${jobId}/outside-parts`, payload);
  }
  const job = await jobService.getJobById(jobId);
  if (!job) throw new Error('Job Card not found.');
  const workflow = job.partsWorkflow || {};
  const previous = workflow.outsideParts || [];
  const found = previous.find((entry) => entry.requestId === payload.requestId);
  if (found) return found;
  const requested = {
    ...payload, id: `OUT-${Date.now()}`, status: 'Pending Approval',
    quotedTotal: (Number(payload.quantity) * Number(payload.unitCost) *
      (1 + Number(payload.purchaseGstRate || 0) / 100)).toFixed(2),
    totalCost: '0.00', totalSelling: '0.00',
    createdAt: now(), createdBy: 'Current User'
  };
  await jobService.updateJob(jobId, {
    partsWorkflow: { ...workflow, outsideParts: [requested, ...previous] }
  });
  return requested;
};

export const decideOutsideJobPart = async (jobId, purchaseId, decision) => {
  if (!USE_MOCK_API) {
    return apiClient.post(`/job-cards/${jobId}/outside-parts/${purchaseId}/decision`, { decision });
  }
  const job = await jobService.getJobById(jobId);
  const old = job?.partsWorkflow || {};
  const purchase = old.outsideParts?.find((item) => item.id === purchaseId);
  if (!purchase || purchase.status !== 'Pending Approval') throw new Error('Request is no longer pending approval.');
  const changed = { ...purchase, status: decision === 'approve' ? 'Approved' : 'Rejected', decisionAt: now() };
  await jobService.updateJob(jobId, {
    partsWorkflow: { ...old, outsideParts: old.outsideParts.map((item) => item.id === purchaseId ? changed : item) }
  });
  return changed;
};

export const completeOutsideJobPart = async (jobId, purchaseId, form) => {
  if (!USE_MOCK_API) {
    const payload = new FormData();
    payload.append('invoiceNo', form.invoiceNo);
    payload.append('unitCost', String(form.unitCost));
    payload.append('paymentType', String(form.paymentType || 'Credit'));
    if (form.accountId) payload.append('accountId', String(form.accountId));
    payload.append('bill', form.bill);
    return apiClient.post(`/job-cards/${jobId}/outside-parts/${purchaseId}/complete`, payload, {
      headers: { 'Content-Type': undefined }
    });
  }
  const job = await jobService.getJobById(jobId);
  const old = job?.partsWorkflow || {};
  const purchase = old.outsideParts?.find((item) => item.id === purchaseId);
  if (!purchase || purchase.status !== 'Approved') throw new Error('Approval is required.');
  if (!form.bill) throw new Error('Supplier invoice file is required.');
  const qty = Number(purchase.quantity);
  const actualCost = Number(form.unitCost);
  const gstRate = Number(purchase.purchaseGstRate || 0);
  const gross = qty * actualCost * (1 + gstRate / 100);
  if (gross > Number(purchase.quotedTotal)) throw new Error('Actual amount exceeds approved quote.');
  const result = {
    ...purchase, status: 'Purchased', invoiceNo: form.invoiceNo,
    unitCost: String(actualCost), totalCost: gross.toFixed(2),
    purchaseGstAmount: (qty * actualCost * gstRate / 100).toFixed(2),
    paymentType: form.paymentType || 'Credit', paymentStatus: form.paymentType === 'Credit' ? 'Unpaid' : 'Paid',
    accountId: form.accountId || '',
    totalSelling: (qty * Number(purchase.sellingPrice)).toFixed(2),
    usedAt: now(), billId: 'demo-upload'
  };
  await jobService.updateJob(jobId, {
    partsWorkflow: { ...old, outsideParts: old.outsideParts.map((item) => item.id === purchaseId ? result : item) }
  });
  return result;
};

export const downloadOutsidePartBill = async (jobId, purchaseId) => {
  if (USE_MOCK_API) throw new Error('Supplier bill downloads are not available in demo mode.');
  return apiClient.get(`/job-cards/${jobId}/outside-parts/${purchaseId}/bill`, {
    responseType: 'blob'
  });
};

export const jobPartsService = {
  get: getJobPartsWorkflow,
  addRequiredPart,
  issue: issueJobParts,
  returnPart: returnJobParts,
  createOrder: createJobPurchaseOrder,
  inward: inwardPurchaseOrder,
  cancelRequiredPart,
  getOutsideJobParts,
  buyOutsideJobPart,
  decideOutsideJobPart,
  completeOutsideJobPart,
  downloadOutsidePartBill
};

export default jobPartsService;
