import { validInternationalPhone } from './jobCreateAdapters.js';

export const normalizeCustomerType = value =>
  /business|company|fleet|insurance|dealer|partner/i.test(String(value || ''))
    ? 'Business / Company'
    : 'Individual';

export const normalizeCustomerPhone = value => {
  const input = String(value || '').trim();
  return /^\d{10}$/.test(input) ? '+91' + input : input;
};

export const customerFormDefaults = () => ({
  name: '', phone: '', email: '', customerType: 'Individual',
  companyName: '', gstNo: '', branch: '', address: '',
  city: '', state: '', pincode: '', notes: '',
});

export const toCustomerFormValues = customer => ({
  ...customerFormDefaults(),
  name: customer?.name || '',
  phone: normalizeCustomerPhone(customer?.phone),
  email: customer?.email || '',
  customerType: normalizeCustomerType(customer?.customerType ?? customer?.customer_type),
  companyName: customer?.companyName ?? customer?.company_name ?? '',
  gstNo: customer?.gstNo ?? customer?.gstin ?? '',
  branch: customer?.branchId ?? customer?.branch ?? '',
  address: customer?.address || '',
  city: customer?.city || '',
  state: customer?.state || '',
  pincode: customer?.pincode || '',
  notes: customer?.notes || '',
});

export const validateCustomerContact = values => {
  const errors = {};
  if (!String(values?.name || '').trim()) errors.name = 'Customer name is required.';
  if (!validInternationalPhone(normalizeCustomerPhone(values?.phone))) {
    errors.phone = 'Enter a valid number for the selected country code.';
  }
  return errors;
};

/** The customer only enters one phone. The service/DRF serializer mirrors it
 * to the legacy WhatsApp contact for optional manual sharing. */
export const toCustomerFormPayload = values => ({
  name: String(values.name || '').trim(),
  phone: normalizeCustomerPhone(values.phone),
  email: String(values.email || '').trim(),
  customerType: normalizeCustomerType(values.customerType) === 'Individual'
    ? 'individual' : 'business',
  companyName: normalizeCustomerType(values.customerType) === 'Business / Company'
    ? String(values.companyName || '').trim() : '',
  gstin: normalizeCustomerType(values.customerType) === 'Business / Company'
    ? String(values.gstNo || '').trim().toUpperCase() : '',
  address: String(values.address || '').trim(),
  city: String(values.city || '').trim(),
  state: String(values.state || '').trim(),
  pincode: String(values.pincode || '').trim(),
  ...(values.branch ? { branch: values.branch } : {}),
  notes: String(values.notes || '').trim(),
});
