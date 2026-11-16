/** Supplier GSTIN structural validation (not GST portal verification).
 * Keep in sync with the canonical Django supplier GSTIN validator.
 * An unregistered supplier may have a blank GSTIN.
 */
export const SUPPLIER_GST_STATE_CODES = new Set([
  '01', '02', '03', '04', '05', '06', '07', '08', '09',
  '10', '11', '12', '13', '14', '15', '16', '17', '18',
  '19', '20', '21', '22', '23', '24', '26', '27',
  '29', '30', '31', '32', '33', '34', '35', '36', '37', '38',
]);

const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9A-Z]Z[0-9A-Z]$/;

export const normalizeSupplierGstin = value => String(value || '').trim().toUpperCase();

export const supplierGstinError = value => {
  const gstin = normalizeSupplierGstin(value);
  if (!gstin) return '';
  if (gstin.length !== 15) {
    return 'GSTIN must contain exactly 15 characters. Leave blank if the supplier is unregistered.';
  }
  if (!SUPPLIER_GST_STATE_CODES.has(gstin.slice(0, 2))) {
    return 'GSTIN must start with a valid state code (e.g. 32 for Kerala).';
  }
  if (!GSTIN_FORMAT.test(gstin)) {
    return 'Invalid GSTIN format. Verify the state code, PAN, entity code, Z and check character.';
  }
  return '';
};

export const supplierGstinStateCode = value => {
  const gstin = normalizeSupplierGstin(value);
  return gstin && !supplierGstinError(gstin) ? gstin.slice(0, 2) : '';
};
