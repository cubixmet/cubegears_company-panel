import { invoiceStateCode, invoiceTaxMode } from './invoiceTaxUi.js';

/**
 * Build a clean Django invoice payload without changing the editable draft.
 * DRF DecimalField rejects blank strings, and UUIDField rejects "".
 */

const numberField = (value, label, { blank = '0', positive = false, min = 0, max = null, integerDigits = 10 } = {}) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    if (blank === null) throw new Error(label + ' is required.');
    value = blank;
  }
  const text = String(value).trim();
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(text)) {
    throw new Error('Enter a valid number for ' + label + '.');
  }
  const numeric = Number(text);
  if (!Number.isFinite(numeric)) throw new Error('Enter a valid number for ' + label + '.');
  if (positive ? numeric <= 0 : numeric < min || (max !== null && numeric > max)) {
    throw new Error(label + (positive ? ' must be greater than zero.' : ' is out of range.'));
  }
  if (max !== null && numeric > max) throw new Error(label + ' is out of range.');
  const parts = text.replace(/^-/, '').split('.');
  if ((parts[1] || '').length > 2 || parts[0].replace(/^0+/, '').length > integerDigits) {
    throw new Error(label + ' must fit within ' + integerDigits + ' digits and 2 decimal places.');
  }
  return text;
};


// HSN/SAC is stored as text by Django: retain leading zeroes and allow
// letters (for user-entered internal/service classifications), maximum 30 chars.
export const normalizeHsnSacCode = (value) =>
  String(value ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 30);

export const validateInvoiceDraft = (draft) => {
  const errors = {};
  if (!draft.date || !/^\d{4}-\d{2}-\d{2}$/.test(String(draft.date))) {
    errors.date = 'Select a valid invoice date.';
  }
  // GST percentages can be selected before entering the customer's state,
  // but the legal Place of Supply must be valid when saving the document.
  const suppliedPlace = draft.customer?.placeOfSupply ||
    draft.customer?.stateCode || draft.customer?.state || '';
  if (draft.invoiceType === 'gst') {
    if (!invoiceStateCode(suppliedPlace)) {
      errors['customer.placeOfSupply'] = 'Enter a valid Place of Supply state before saving.';
    } else if (invoiceTaxMode(draft) === 'unknown') {
      // Do not blame a valid Place of Supply when the workshop's GSTIN / state
      // is missing or cannot be verified from Company Settings.
      errors['seller.gstin'] = 'Verify the workshop GSTIN and state in Company Settings before saving.';
    }
  }
  if (!String(draft.customer?.name || '').trim()) errors['customer.name'] = 'Customer name is required.';
  if (!draft.items?.length) errors.items = 'Add at least one item.';
  const check = (path, value, label, options) => {
    try { numberField(value, label, options); }
    catch (error) { errors[path] = error.message; }
  };
  // Receipts can only come from the real Payments workflow after finalization.
  // A draft's input must not change paid/balance in Django.
  check('discount', draft.discount, 'Invoice discount');
  check('adjustment', draft.adjustment, 'Adjustment', { min: -9999999999 });
  for (const key of ['cgstRate', 'sgstRate', 'igstRate']) {
    check(key, draft[key], key, { max: 100, integerDigits: 3 });
  }
  (draft.items || []).forEach((item, index) => {
    const path = 'items.' + index;
    if (!item.type) errors[path + '.type'] = 'Select item type.';
    if (!item.unit) errors[path + '.unit'] = 'Select item unit.';
    if (!String(item.description || '').trim() && item.type !== 'Stock Part') {
      errors[path + '.description'] = 'Item name / description is required.';
    }
    if (draft.invoiceType === 'gst' && !String(item.hsnCode || '').trim()) {
      errors[path + '.hsnCode'] = 'HSN / SAC is required for GST invoices.';
    }
    if (String(item.hsnCode || '') && !/^[A-Za-z0-9]{1,30}$/.test(String(item.hsnCode))) {
      errors[path + '.hsnCode'] = 'HSN / SAC must contain letters or digits only (maximum 30 characters).';
    }
    if (item.type === 'Stock Part' && !item.inventoryId) {
      errors[path + '.inventoryId'] = 'Select a stock item.';
    }
    check(path + '.qty', item.qty, 'Item ' + (index + 1) + ' quantity', { blank: null, positive: true });
    check(path + '.rate', item.rate, 'Item ' + (index + 1) + ' price per unit');
    check(path + '.purchasePrice', item.purchasePrice, 'Item ' + (index + 1) + ' purchase price');
    check(path + '.discount', item.discount, 'Item ' + (index + 1) + ' discount');
    check(path + '.taxRate', item.taxRate, 'Item ' + (index + 1) + ' GST rate', {
      blank: draft.invoiceType === 'gst' ? null : '0',
      max: 100, integerDigits: 3,
    });
  });
  return errors;
};

export const extractInvoiceFieldErrors = (error) => {
  if (!error?.data || typeof error.data !== 'object') return error?.fieldErrors || {};
  const fields = {};
  const walk = (value, path) => {
    if (Array.isArray(value)) {
      if (value.every((item) => typeof item === 'string')) {
        fields[path] = value.join(' ');
      } else {
        value.forEach((item, index) => walk(item, path ? path + '.' + index : String(index)));
      }
    } else if (value && typeof value === 'object') {
      Object.entries(value).forEach(([key, item]) => walk(item, path ? path + '.' + key : key));
    } else if (value !== undefined && value !== null && path) {
      fields[path] = String(value);
    }
  };
  walk(error.data, '');
  return fields;
};

export const prepareInvoicePayloadForApi = (draft) => {
  const fieldErrors = validateInvoiceDraft(draft);
  if (Object.keys(fieldErrors).length) {
    const error = new Error('Correct the highlighted invoice fields before saving.');
    error.fieldErrors = fieldErrors;
    throw error;
  }
  const gst = draft.invoiceType === 'gst';
  // taxMode is calculated by Django from workshop GSTIN and legal place of supply.
  // A new draft may contain taxMode: '' for display; never send that blank or a
  // user-edited tax mode to the invoice serializer.
  const {
    taxMode: _ignoredTaxMode, paid: _serverPaid, balance: _serverBalance,
    status: _serverStatus, total: _serverTotal, taxable: _serverTaxable,
    cgst: _serverCgst, sgst: _serverSgst, igst: _serverIgst,
    finalizedAt: _serverFinalized, cancelledAt: _serverCancelled,
    finalized_at: _finalized, cancelled_at: _cancelled,
    templateSnapshot: _serverTemplate, ...editableDraft
  } = draft;
  return {
    ...editableDraft,
    discount: numberField(draft.discount, 'Invoice discount'),
    adjustment: numberField(draft.adjustment, 'Adjustment', { min: -9999999999 }),
    cgstRate: numberField(draft.cgstRate, 'CGST rate', { max: 100, integerDigits: 3 }),
    sgstRate: numberField(draft.sgstRate, 'SGST rate', { max: 100, integerDigits: 3 }),
    igstRate: numberField(draft.igstRate, 'IGST rate', { max: 100, integerDigits: 3 }),
    items: (draft.items || []).map((item, index) => {
      const label = 'Item ' + (index + 1);
      return {
        ...item,
        hsnCode: String(item.hsnCode ?? ''),
        qty: numberField(item.qty, label + ' quantity', { blank: null, positive: true }),
        rate: numberField(item.rate, label + ' price per unit'),
        purchasePrice: numberField(item.purchasePrice, label + ' purchase price'),
        discount: numberField(item.discount, label + ' discount'),
        taxRate: numberField(item.taxRate, label + ' GST rate', {
          blank: gst ? null : '0', max: 100, integerDigits: 3,
        }),
        // No stock selected is null, not an invalid empty UUID.
        inventoryId: item.inventoryId || null,
      };
    }),
  };
};

export const formatInvoiceValidationError = (error) => {
  const payload = error?.data;
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return error?.message || 'Unable to save invoice.';
  }
  const messages = [];
  const collect = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((entry, index) => {
        collect(entry, typeof entry === 'object' && entry !== null ? path + '[' + (index + 1) + ']' : path);
      });
    } else if (value !== null && typeof value === 'object') {
      Object.entries(value).forEach(([key, entry]) => collect(entry, path ? path + '.' + key : key));
    } else if (value !== null && value !== undefined && String(value).trim()) {
      messages.push((path ? path + ': ' : '') + String(value));
    }
  };
  for (const [key, value] of Object.entries(payload)) {
    collect(value, key === 'non_field_errors' || key === 'detail' ? '' : key);
  }
  return messages.join(' | ') || error?.message || 'Unable to save invoice.';
};


/**
 * Django rejects a branch whose state differs from the company's GSTIN.
 * This is a seller setup error, not an invalid customer Place of Supply.
 * Keep the validation visible beside the seller state instead of repeating a
 * long, raw API error in the invoice amount preview.
 */
export const isInvoiceBranchStateMismatch = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  const details = error?.data?.gst ?? error?.response?.data?.gst ?? '';
  return status === 400 && /workshop branch state differs from company gstin/i.test(
    Array.isArray(details) ? details.join(' ') : String(details),
  );
};

/** Explain why an authoritative invoice preview was rejected. */
export const invoicePreviewFailureMessage = (error) => {
  const status = Number(error?.status || error?.response?.status || 0);
  if (status === 404) {
    return 'Backend GST preview API is missing. Pull the latest Django backend and restart port 8000.';
  }
  if (status === 401) {
    return 'Your session has expired. Sign in again to verify invoice amounts.';
  }
  if (status === 403) {
    return 'Your account does not have permission to calculate invoice totals.';
  }
  if (status === 400) {
    const details = formatInvoiceValidationError(error);
    if (details && !/^request failed with status code 400$/i.test(details)) {
      return 'Invoice preview needs correction: ' + details;
    }
    return 'Invoice preview was rejected. Check the highlighted invoice fields and workshop GST settings.';
  }
  return 'Backend calculation unavailable. Live amounts shown are provisional until the API reconnects.';
};
