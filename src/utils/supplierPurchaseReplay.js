/**
 * A lost HTTP response does not mean a supplier purchase failed. Reconcile
 * only against a posted bill with the exact requested supplier, invoice,
 * purchase lines, GST and initial paid amount. Never submit stock or money
 * a second time while checking a possible replay.
 */
const cents = value => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.round((amount + Number.EPSILON) * 100) : null;
};
const text = value => String(value ?? '').trim();
const matchingLine = (stored, requested, placeOfSupply) =>
  text(stored?.itemId) === text(requested?.itemId) &&
  text(stored?.description).toLowerCase() === text(requested?.description).toLowerCase() &&
  cents(stored?.quantity) === cents(requested?.quantity) &&
  cents(stored?.purchaseRate) === cents(requested?.purchaseRate) &&
  cents(stored?.gstRate) === cents(requested?.gstRate) &&
  text(stored?.gstTreatment) === text(requested?.gstTreatment) &&
  (!placeOfSupply || text(stored?.placeOfSupply) === text(placeOfSupply));

export function findPostedSupplierBillReplay(bills, request) {
  if (!Array.isArray(bills) || !request || !text(request.invoiceNumber) ||
      !Array.isArray(request.items) || !request.items.length) return null;

  return bills.find(bill =>
    text(bill?.postingStatus) === 'Posted' &&
    text(bill?.supplierId) === text(request.supplierId) &&
    text(bill?.invoiceNumber).toLowerCase() === text(request.invoiceNumber).toLowerCase() &&
    text(bill?.invoiceDate) === text(request.invoiceDate) &&
    cents(bill?.total) !== null && cents(bill?.total) === cents(request.total) &&
    cents(bill?.paid) !== null && cents(bill?.paid) === cents(request.paidNow) &&
    Array.isArray(bill?.items) &&
    bill.items.length === request.items.length &&
    bill.items.every((item, index) =>
      matchingLine(item, request.items[index], request.placeOfSupply))
  ) || null;
}
