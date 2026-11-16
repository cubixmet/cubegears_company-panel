import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import SupplierSelectField from '../common/SupplierSelectField';
import { defaultEstimateCatalogGst, validateEstimateCatalogDraft } from './estimateNewCatalog';
import { estimateGstOptions, ESTIMATE_ZERO_TAX_TREATMENTS } from './estimateGstRates';
import '../../styles/estimate-catalog-gst.css';

const emptyDraft = (kind, initialName = '', registered = false, taxMode = 'unknown', gstRateOptions = null) => ({
  kind, name: initialName, sku: '', costPrice: '', price: '', brand: '', supplier: '',
  workType: 'Labour', code: '',
  ...defaultEstimateCatalogGst(registered, taxMode, gstRateOptions),
});

const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);

export function EstimateAddCatalogModal({
  request, saving, error, onClose, onCreate,
  registered = false, taxMode = 'unknown', gstRateOptions = null,
}) {
  const [draft, setDraft] = useState(() => emptyDraft('service'));
  const [fieldErrors, setFieldErrors] = useState({});

  useEffect(() => {
    if (!request) return;
    setDraft(emptyDraft(request.kind, request.name || '', registered, taxMode, gstRateOptions));
    setFieldErrors({});
  }, [request, registered, taxMode, gstRateOptions]);

  const isPart = request?.kind === 'part';
  const gstOptions = estimateGstOptions('', taxMode, gstRateOptions)
    .filter((option) => option.value === 'none'
      || taxMode === 'unknown' || option.taxMode === taxMode);
  const taxablePrice = Number(draft.price) || 0;
  const taxAmount = registered ? taxablePrice * (Number(draft.taxRate) || 0) / 100 : 0;
  const chooseGst = (selected) => {
    const choice = gstOptions.find((option) => option.value === selected);
    setDraft((current) => ({
      ...current,
      taxChoice: choice?.value || '',
      taxRate: choice ? String(choice.totalRate) : '',
      taxTreatment: selected === 'none' ? '' : 'taxable',
      taxTreatmentConfirmed: false,
    }));
    setFieldErrors((current) => ({
      ...current,
      taxChoice: undefined,
      taxTreatment: undefined,
      taxTreatmentConfirmed: undefined,
    }));
  };
  const change = (field, value) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => ({ ...current, [field]: undefined }));
  };
  const submit = (event) => {
    event.preventDefault();
    if (saving) return;
    const errors = validateEstimateCatalogDraft(draft, { registered });
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    onCreate(draft);
  };

  return (
    <ResponsiveModalSheet
      isOpen={Boolean(request)}
      onClose={() => { if (!saving) onClose(); }}
      title={isPart ? 'Add New Spare Part' : 'Add New Work / Service'}
      maxWidth="520px"
    >
      <form className="job-estimate-create-form" onSubmit={submit}>
        <p className="job-estimate-create-intro">
          {isPart
            ? 'Save this part to the stock catalogue and add it to the estimate. Starting stock is zero.'
            : 'Save this work to the service catalogue and add it to the estimate.'}
        </p>
        {error && <p className="job-estimate-create-error" role="alert">{error}</p>}
        <label>
          {isPart ? 'Part Name *' : 'Work / Service Name *'}
          <input autoFocus required maxLength={isPart ? 180 : 160}
            value={draft.name} onChange={(event) => change('name', event.target.value)}
            aria-invalid={Boolean(fieldErrors.name)} placeholder={isPart ? 'e.g. Air Filter' : 'e.g. Brake Service'}/>
          {fieldErrors.name && <small role="alert">{fieldErrors.name}</small>}
        </label>
        {isPart ? (
          <>
            <div className="job-estimate-create-two">
              <label>SKU / Part Number *
                <input required maxLength={80} value={draft.sku} onChange={(event) => change('sku', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.sku)} placeholder="e.g. FIL-001"/>
                {fieldErrors.sku && <small role="alert">{fieldErrors.sku}</small>}
              </label>
              <label>Brand
                <input maxLength={100} value={draft.brand} onChange={(event) => change('brand', event.target.value)}
                  placeholder="Optional"/>
              </label>
            </div>
            <SupplierSelectField label="Supplier" value={draft.supplier}
              valueMode="id" disabled={saving}
              onChange={supplier => change('supplier', supplier)}/>
            <div className="job-estimate-create-two">
              <label>Purchase Cost / Unit (₹) *
                <input required type="number" min="0" max="10000000" step="0.01"
                  value={draft.costPrice} onChange={(event) => change('costPrice', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.costPrice)} placeholder="0.00"/>
                {fieldErrors.costPrice && <small role="alert">{fieldErrors.costPrice}</small>}
              </label>
              <label>Selling Price / Unit (₹) *
                <input required type="number" min="0" max="10000000" step="0.01"
                  value={draft.price} onChange={(event) => change('price', event.target.value)}
                  aria-invalid={Boolean(fieldErrors.price)} placeholder="0.00"/>
                {fieldErrors.price && <small role="alert">{fieldErrors.price}</small>}
              </label>
            </div>
            <p className="job-estimate-create-note">
              This creates a product with 0 available stock and links the selected supplier.
              To receive purchased quantity, open the supplier's Purchase Bill and post it
              (Cash/Bank payment, advance or credit). Creating a quote does not debit an account.
            </p>
          </>
        ) : (
          <div className="job-estimate-create-two">
            <label>Work Type
              <select value={draft.workType} onChange={(event) => change('workType', event.target.value)}>
                <option value="Labour">Labour</option>
                <option value="Service">Service</option>
                <option value="Other">Other Work</option>
              </select>
            </label>
            <label>Work Rate (₹) *
              <input required type="number" min="0" max="10000000" step="0.01"
                value={draft.price} onChange={(event) => change('price', event.target.value)}
                aria-invalid={Boolean(fieldErrors.price)} placeholder="0.00"/>
              {fieldErrors.price && <small role="alert">{fieldErrors.price}</small>}
            </label>
          </div>
        )}
        <fieldset className="job-estimate-create-tax">
          <legend>GST &amp; HSN / SAC</legend>
          {registered ? (
            <>
              <div className="job-estimate-create-two">
                <label>GST Rate (%) *
                  <select required value={draft.taxChoice} disabled={saving}
                    aria-invalid={Boolean(fieldErrors.taxChoice)}
                    onChange={(event) => chooseGst(event.target.value)}>
                    <option value="">Select GST rate</option>
                    {gstOptions.map((choice) =>
                      <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                  </select>
                  {fieldErrors.taxChoice && <small role="alert">{fieldErrors.taxChoice}</small>}
                </label>
                <label>{isPart ? 'HSN Code' : 'SAC Code'}
                  <input value={draft.hsnSac} maxLength={20} disabled={saving}
                    placeholder={isPart ? 'Part HSN' : 'Service SAC'}
                    aria-invalid={Boolean(fieldErrors.hsnSac)}
                    onChange={(event) => change('hsnSac', event.target.value)}/>
                  {fieldErrors.hsnSac && <small role="alert">{fieldErrors.hsnSac}</small>}
                </label>
              </div>
              {draft.taxChoice === 'none' && (
                <div className="job-estimate-create-zero">
                  <label>Zero-GST classification *
                    <select required value={draft.taxTreatment} disabled={saving}
                      aria-invalid={Boolean(fieldErrors.taxTreatment)}
                      onChange={(event) => change('taxTreatment', event.target.value)}>
                      <option value="">Select applicable classification</option>
                      {ESTIMATE_ZERO_TAX_TREATMENTS.filter((option) =>
                        !isPart || option.value !== 'out_of_scope'
                      ).map((option) =>
                        <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                    {fieldErrors.taxTreatment && <small role="alert">{fieldErrors.taxTreatment}</small>}
                  </label>
                  <label className="job-estimate-create-confirm">
                    <input type="checkbox" checked={draft.taxTreatmentConfirmed} disabled={saving}
                      onChange={(event) => change('taxTreatmentConfirmed', event.target.checked)}/>
                    I confirm this classification applies to the selected HSN / SAC.
                  </label>
                  {fieldErrors.taxTreatmentConfirmed &&
                    <small role="alert">{fieldErrors.taxTreatmentConfirmed}</small>}
                </div>
              )}
              <p className="job-estimate-create-note">
                18% is an editable starting preset, not the rate for every part.
                Verify the applicable GST rate and HSN/SAC before saving.
              </p>
              <div className="job-estimate-create-tax-summary" aria-live="polite">
                <span>Base / unit <strong>{money(taxablePrice)}</strong></span>
                <span>GST / unit <strong>{money(taxAmount)}</strong></span>
                <span>With GST / unit <strong>{money(taxablePrice + taxAmount)}</strong></span>
              </div>
              <p className="job-estimate-create-note">Prices entered above exclude GST.
                GST is calculated once in the Estimate total; it is not added to the saved selling price.</p>
            </>
          ) : (
            <p className="job-estimate-create-note">
              No GST — workshop is not GST registered. Update company tax settings to enable item-wise GST.
            </p>
          )}
        </fieldset>
        <div className="job-estimate-create-actions">
          <button type="button" className="job-estimate-create-cancel" disabled={saving} onClick={onClose}>Cancel</button>
          <button type="submit" className="job-estimate-create-save" disabled={saving}>
            <Plus size={16} aria-hidden="true"/>{saving ? 'Saving…' : isPart ? 'Save Part & Add' : 'Save Work & Add'}
          </button>
        </div>
      </form>
    </ResponsiveModalSheet>
  );
}
