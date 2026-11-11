// Mirrors the Django document-template settings contract. No credentials or tenant data logged.
export const templateFieldLabels = {
  invoiceTemplate: 'Invoice Template', estimateTemplate: 'Estimate Template',
  accent: 'Accent', businessLogo: 'Business Logo',
  businessName: 'Business / Brand Name', businessLegalName: 'Legal Business Name',
  businessGstin: 'GSTIN', businessPhone: 'Phone', businessEmail: 'Email',
  businessAddress: 'Registered Address', businessState: 'State',
  businessStateCode: 'State Code', businessWebsite: 'Website', businessPan: 'PAN',
  bankName: 'Bank Name', bankAccountName: 'Account Name',
  bankAccountNumber: 'Account Number', bankIfsc: 'IFSC', bankUpi: 'UPI ID',
  authorizedSignatory: 'Authorised Signatory', termsText: 'Terms & Conditions',
  customName: 'Template Name', customHeader: 'Document Heading',
  customFooter: 'Footer Note',
};
const booleanFields = new Set([
  'showOriginal','showSellerMark','compactTable','customShowTransport',
  'customShowTaxTable','showBusinessLogo','showBankDetails','showGstin','showPan','showWebsite','showTerms','showSignature'
]);
const largeFields = new Set(['businessAddress','termsText','customFooter']);
const templates = new Set(['modern','classic','minimal','custom']);
const accents = new Set(['teal','blue','graphite']);
export const validateDocumentTemplateSettings = (settings) => {
  const errors = {};
  for (const [key, value] of Object.entries(settings || {})) {
    const label = templateFieldLabels[key] || key;
    if (booleanFields.has(key)) {
      if (typeof value !== 'boolean') errors[key] = label + ' must be enabled or disabled.';
      continue;
    }
    if (typeof value !== 'string') {
      errors[key] = label + ' must contain text.';
      continue;
    }
    const limit = key === 'businessLogo' ? 360000 : largeFields.has(key) ? 2000 : 255;
    if (value.length > limit) errors[key] = label + ' must be ' + limit + ' characters or fewer.';
    if ((key === 'invoiceTemplate' || key === 'estimateTemplate') && !templates.has(value)) {
      errors[key] = 'Choose a valid ' + label.toLowerCase() + '.';
    }
    if (key === 'accent' && !accents.has(value)) errors[key] = 'Choose a valid accent.';
    if (key === 'businessLogo' && value) {
      const match = /^data:image\/(?:png|jpeg|webp);base64,([a-zA-Z0-9+/]+={0,2})$/.exec(value);
      if (!match) errors[key] = 'Upload a PNG, JPG or WEBP image (not a link).';
      else {
        const encoded = match[1];
        const bytes = encoded.length * 3 / 4 - (encoded.endsWith('==') ? 2 : encoded.endsWith('=') ? 1 : 0);
        if (bytes > 250 * 1024) errors[key] = 'Logo must be 250 KB or smaller.';
      }
    }
  }
  return errors;
};

export const templateApiFieldErrors = (error) => {
  const raw = error?.data;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result = {};
  for (const [key, value] of Object.entries(raw)) {
    if (['detail','message','non_field_errors'].includes(key)) continue;
    if (Array.isArray(value)) result[key] = value.map(String).join(' ');
    else if (typeof value === 'string') result[key] = value;
  }
  return result;
};

export const templateErrorSummary = (errors, fallback = 'Unable to save company invoice templates.') => {
  const entries = Object.entries(errors);
  if (!entries.length) return fallback;
  return entries.map(([key, value]) => (templateFieldLabels[key] || key) + ': ' + value).join(' | ');
};
