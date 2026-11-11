/** Expense amount is tax-INCLUSIVE in the existing Django Expense model.
 * Selecting a GST rate changes the informational tax component, not the
 * amount paid. GST returns/ITC still require the original tax documents.
 */
export const expenseIncludedGst = (gross, rate) => {
  const amount = Number(gross);
  const percent = Number(rate);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isFinite(percent) ||
      percent < 0 || percent > 100) return '';
  const grossPaise = Math.round(amount * 100);
  // Round to the nearest paise; never charge GST again when settling.
  return (Math.round(grossPaise * percent / (100 + percent)) / 100).toFixed(2);
};
