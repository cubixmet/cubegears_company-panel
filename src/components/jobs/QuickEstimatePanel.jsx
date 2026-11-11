import { useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ClipboardList, Download, Package, Pencil, Plus, ReceiptText, Trash2, Wrench, SkipForward } from 'lucide-react';
import { jobService } from '../../services/job.service';
import { WhatsAppManualShareButton } from '../common/WhatsAppManualShareButton';
import { serviceService } from '../../services/service.service';
import { stockCatalogService } from '../../services/stockCatalog.service';
import { EstimateCatalogPicker } from './EstimateCatalogPicker';
import { EstimateAddCatalogModal } from './EstimateAddCatalogModal';
import { buildEstimateCatalogSelection } from './estimateNewCatalog';
import { estimateLineErrors, estimateFormValidation } from './quickEstimateValidation';
import { latestApprovedEstimate } from '../../utils/approvedEstimatePdf';
import { INDIA_STATES, calculateEstimateIndiaGst } from '../../utils/indiaGst';
import { estimateGstOptions, ESTIMATE_ZERO_TAX_TREATMENTS } from './estimateGstRates';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { customerEstimateDeclines } from './customerEstimateDeclines';
import { invoiceTaxMode, invoiceChoiceFromTotalRate } from '../../utils/invoiceTaxUi';

const emptyLine = (type = 'Labour') => ({
  key: String(Date.now()) + '-' + String(Math.random()),
  description: '', type, quantity: '1', unitPrice: '', catalogId: '', catalogCode: '',
  taxRate: type === 'Part' ? '' : '18', hsnSac: type === 'Part' ? '' : '998714'
});
const money = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2
}).format(Number(value) || 0);
const parseItems = (estimate) => (estimate?.items || [])
  .filter((row) => row && !row._pricing && row.description)
  .map((row, index) => ({
    key: String(index),
    description: row.description,
    type: row.type || 'Service',
    quantity: String(row.quantity || 1),
    unitPrice: String(row.unitPrice ?? row.price ?? 0),
    catalogId: row.catalogId || '',
    catalogCode: row.catalogCode || '',
    taxRate: String(row.taxRate ?? (row.type === 'Part' ? '' : '18')),
    taxChoice: row.taxChoice || '',
    taxTreatment: row.taxTreatment || '',
    taxTreatmentConfirmed: row.taxTreatmentConfirmed === true,
    hsnSac: row.hsnSac || ''
  }));
const inspectSuggestions = (findings) => findings.flatMap((item) => {
  const title = item.description || item.title || 'Inspection finding';
  const part = Number(item.estimatedPartCharge ?? item.estimatedCost ?? 0) || 0;
  const labour = Number(item.estimatedLabourCharge || 0);
  const result = [];
  if (labour > 0) result.push({
    ...emptyLine(), type: 'Labour', description: item.recommendedAction || title,
    quantity: '1', unitPrice: String(labour)
  });
  result.push({
    ...emptyLine(), type: part > 0 ? 'Part' : 'Service', description: title,
    quantity: '1', unitPrice: String(part)
  });
  return result;
});

export function QuickEstimatePanel({
  job, estimates = [], findings = [], canEdit, canReopen = false, wasSkipped = false, onReopen, onSaved, onApprove, onSkip,
  onReject, onShare, onEditInspection, onGoToWork, onDownloadApproved
}) {
  const latest = estimates.at(-1) || null;
  const approvedEstimate = latestApprovedEstimate(estimates);
  // Backend JobActivity receipts survive later quote revisions, unlike the
  // latest-only workflow_progress pointer.
  const declineByEstimate = useMemo(
    () => customerEstimateDeclines(job?.activities),
    [job?.activities]
  );
  const latestDecline = latest?.id
    ? declineByEstimate.get(String(latest.id)) : null;
  const [lines, setLines] = useState([]);
  const [discount, setDiscount] = useState('0');
  const registered = Boolean(job?.gstInfo?.registered);
  const supplierState = job?.gstInfo?.supplierState || '';
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const taxMode = invoiceTaxMode({
    invoiceType: registered ? 'gst' : 'regular',
    seller: { stateCode: supplierState },
    customer: { placeOfSupply },
  });
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [showValidation, setShowValidation] = useState(false);
  const [catalogRequest, setCatalogRequest] = useState(null);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [focusNewLine, setFocusNewLine] = useState(null);
  const [showSkipModal, setShowSkipModal] = useState(false);
  const [skipReason, setSkipReason] = useState('Estimate Not Required');
  const [skipDetails, setSkipDetails] = useState('');
  const [skipError, setSkipError] = useState('');
  const [skipBusy, setSkipBusy] = useState(false);
  const [reopenBusy, setReopenBusy] = useState(false);
  const formRef = useRef(null);
  // Preserve the same operation token across retries. Different quote
  // contents get a new token, preventing accidental duplicate versions.
  const pendingSaveRef = useRef(null);
  const savedEstimateRef = useRef(null);
  const revisedAt = job?.inspection?.revisedAt;
  const stale = !!(latest?.created_at && revisedAt &&
    new Date(latest.created_at).getTime() < new Date(revisedAt).getTime());

  useEffect(() => {
    const pricing = (latest?.items || []).find((row) => row._pricing)?._pricing;
    const previous = parseItems(latest);
    setLines(previous);
    setDiscount(String(pricing?.discount ?? latest?.discount ?? 0));
    setPlaceOfSupply(String(pricing?.gst?.placeOfSupply || job?.gstInfo?.placeOfSupply || ''));
    setChanged(false);
    setFeedback('');
    setShowValidation(false);
    setCatalogRequest(null);
    setCatalogError('');
  }, [job?.id, job?.gstInfo?.placeOfSupply, latest?.id, latest?.updated_at, latest?.status]);

  const amount = useMemo(() => calculateEstimateIndiaGst({
    lines, discount, registered, supplierState, placeOfSupply
  }), [lines, discount, registered, supplierState, placeOfSupply]);

  const legalizeLineGst = (line, mode) => {
    if (!line.taxChoice || line.taxChoice === 'none' || !['cgst_sgst', 'igst'].includes(mode)) return line;
    const options = estimateGstOptions('', mode, job?.gstInfo?.gstRateOptions);
    const picked = options.find(option => option.value === line.taxChoice);
    if (!picked || picked.taxMode === mode) return line;
    // CGST 9% and IGST 18% each mean 18% total, but the jurisdiction
    // determines which tax appears in the estimate's final calculation.
    const replacement = options.find(option => option.taxMode === mode &&
      Number(option.totalRate) === Number(line.taxRate));
    return replacement
      ? { ...line, taxChoice: replacement.value }
      : { ...line, taxChoice: '', taxRate: '' };
  };

  const validation = useMemo(() => {
    const basic = estimateFormValidation(lines, discount, '0');
    if (basic) return basic;
    if (registered && !supplierState) return 'Configure the workshop GSTIN / supplying state in Company Settings.';
    if (registered && !placeOfSupply) return 'Select the legal place-of-supply state.';
    // The tax jurisdiction follows the legal supply state. When a previously
    // chosen label cannot be translated without changing its rate, ask for a
    // new classification instead of showing a technical tax-mode conflict.
    if (registered && lines.some(line => legalizeLineGst(line, taxMode).taxRate === '')) {
      return 'Select a GST rate for each item based on the Place of Supply.';
    }
    if (registered && lines.some(line => String(line.taxRate) === '0' && (
      line.taxChoice !== 'none' || !line.taxTreatment ||
      !line.taxTreatmentConfirmed || !String(line.hsnSac || '').trim()
    ))) {
      return 'No GST requires a specific tax treatment, HSN/SAC and confirmation for each eligible item.';
    }
    if (registered && lines.some((line) => !String(line.taxRate ?? '').trim() ||
      Number(line.taxRate) < 0 || Number(line.taxRate) > 100 ||
      !/^\d+(?:\.\d{1,2})?$/.test(String(line.taxRate)))) {
      return 'Set a valid item-wise GST rate for every work and spare part.';
    }
    return '';
  }, [lines, discount, registered, supplierState, placeOfSupply, taxMode, job?.gstInfo?.gstRateOptions]);

  // Dropdown shows all ten labels, but a quote must use CGST/SGST for
  // intra-state transactions and IGST for inter-state transactions.
  // Normalize the selected label without changing the total tax percentage.
  const legalChoice = (choice, mode) => {
    if (!choice || !['cgst_sgst', 'igst'].includes(mode)) return choice;
    if (choice.taxMode === mode) return choice;
    const available = estimateGstOptions('', mode, job?.gstInfo?.gstRateOptions);
    return available.find(option => option.taxMode === mode &&
      Number(option.totalRate) === Number(choice.totalRate)) || null;
  };

  const chooseGst = (key, selected) => {
    const choice = estimateGstOptions('', taxMode, job?.gstInfo?.gstRateOptions)
      .find(option => option.value === selected);
    setLines(current => current.map(line => line.key === key
      ? legalizeLineGst({ ...line, taxChoice: choice?.value || '',
          taxRate: choice?.totalRate ?? '',
          taxTreatment: selected === 'none' ? '' : 'taxable',
          taxTreatmentConfirmed: false }, taxMode)
      : line));
    setChanged(true);
    setFeedback('');
  };
  const changePlaceOfSupply = (value) => {
    const nextMode = invoiceTaxMode({
      invoiceType: registered ? 'gst' : 'regular',
      seller: { stateCode: supplierState },
      customer: { placeOfSupply: value },
    });
    setPlaceOfSupply(value);
    setLines(current => current.map(line => legalizeLineGst(line, nextMode)));
    setChanged(true);
    setFeedback('');
  };

  const edit = (key, field, value) => {
    setLines((current) => current.map((line) => line.key === key
      ? {
        ...line, [field]: value,
        ...(field === 'description' || field === 'type'
          ? { catalogId: '', catalogCode: '' }
          : {})
      } : line));
    setChanged(true);
    setFeedback('');
  };
  const selectCatalog = (key, item) => {
    setLines((current) => current.map((line) => line.key === key ? { ...line, ...item } : line));
    setChanged(true);
    setFeedback('');
  };
  const validateBeforeDecision = () => {
    if (!validation) return true;
    setShowValidation(true);
    setFeedback('');
    requestAnimationFrame(() => {
      const field = formRef.current?.querySelector('[aria-invalid="true"]');
      field?.focus();
      field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
    return false;
  };

  const saveDraftForDecision = async () => {
    if (!latest || changed || stale || ['Rejected', 'Customer Rejected'].includes(latest.status)) {
      // A declined estimate needs a NEW operation identity even if the
      // customer requests the same amount again; never replay a rejected ID.
      if (latest && ['Rejected', 'Customer Rejected'].includes(latest.status)) {
        pendingSaveRef.current = null;
        savedEstimateRef.current = null;
      }
      const preparedLines = lines.map(line => legalizeLineGst(line, taxMode));
      if (registered && preparedLines.some(line => !String(line.taxRate ?? '').trim())) {
        setShowValidation(true);
        throw new Error('Choose an applicable GST rate for each item before proceeding.');
      }
      const draftId = latest?.status === 'Draft' && !stale
        ? latest.id : (!latest && !stale ? savedEstimateRef.current?.id || null : null);
      const payload = {
        lines: preparedLines.map(({ description, type, quantity, unitPrice, catalogId, taxRate, taxChoice, taxTreatment, taxTreatmentConfirmed, hsnSac }) => ({
          description: description.trim(), type, quantity, unitPrice,
          taxRate: taxRate || '0', taxChoice: taxChoice || '', hsnSac: hsnSac || '',
          ...(taxChoice === 'none' ? { taxTreatment, taxTreatmentConfirmed } : {}),
          ...(catalogId ? { catalogId } : {}),
        })),
        taxPercent: '0', discount,
        gst: { mode: registered ? 'gst' : 'non_gst', placeOfSupply },
      };
      const fingerprint = JSON.stringify(payload);
      if (!pendingSaveRef.current || pendingSaveRef.current.fingerprint !== fingerprint) {
        pendingSaveRef.current = { id: crypto.randomUUID(), fingerprint };
      }
      payload.requestId = pendingSaveRef.current.id;
      const saved = await jobService.saveQuickJobEstimate(job.id, payload, draftId);
      savedEstimateRef.current = { id: saved.id, version: saved.version };
      setChanged(false);
      setShowValidation(false);
      try {
        await onSaved?.();
      } catch {
        setFeedback('Estimate saved. Refresh the Job Card to see the latest quote.');
      }
    }
    const target = savedEstimateRef.current || latest;
    if (!target?.id) throw new Error('Save a valid estimate before proceeding.');
    return target;
  };

  const approve = async () => {
    if (!canEdit || busy || latest?.status === 'Awaiting Customer') return;
    if (!validateBeforeDecision()) return;
    setBusy(true);
    setFeedback('');
    try {
      const target = await saveDraftForDecision();
      await onApprove?.(target.id, target.version);
    } catch (err) {
      setFeedback(err?.message || 'Estimate could not be finalized.');
    } finally {
      setBusy(false);
    }
  };

  const shareForReview = async () => {
    if (!canEdit || busy || !onShare) return;
    if (!validateBeforeDecision()) return;
    setBusy(true);
    setFeedback('');
    try {
      const target = await saveDraftForDecision();
      await onShare(target.id, 'share');
      setFeedback('Estimate shared to the customer portal. Await their response.');
    } catch (err) {
      setFeedback(err?.message || 'Could not share the estimate with the customer.');
    } finally {
      setBusy(false);
    }
  };

  const withdrawReview = async () => {
    if (!canEdit || busy || latest?.status !== 'Awaiting Customer' || !onShare) return;
    setBusy(true);
    setFeedback('');
    try {
      await onShare(latest.id, 'withdraw');
      savedEstimateRef.current = null;
      setFeedback('Estimate withdrawn from customer review. You may edit and re-share it.');
    } catch (err) {
      setFeedback(err?.message || 'Could not withdraw the estimate.');
    } finally {
      setBusy(false);
    }
  };
  const reopenSkippedEstimate = async () => {
    if (!canReopen || reopenBusy || busy || !onReopen) return;
    setReopenBusy(true);
    setFeedback('');
    try {
      await onReopen();
    } catch (error) {
      const data = error?.response?.data;
      setFeedback(data?.estimate || data?.detail || error?.message ||
        'Unable to reopen the estimate after work has started.');
    } finally {
      setReopenBusy(false);
    }
  };

  const confirmSkip = async (event) => {
    event.preventDefault();
    if (!canEdit || busy || skipBusy || !onSkip) return;
    if (skipReason === 'Other' && skipDetails.trim().length < 5) {
      setSkipError('Enter a reason of at least 5 characters.');
      return;
    }
    setSkipBusy(true);
    setSkipError('');
    try {
      await onSkip({ reason: skipReason, details: skipDetails.trim() });
      setShowSkipModal(false);
    } catch (error) {
      setSkipError(error?.response?.data?.detail || error?.response?.data?.reason?.[0] ||
        error?.message || 'Unable to skip this estimate.');
    } finally {
      setSkipBusy(false);
    }
  };

  const addLine = (type, catalogItem = null) => {
    const row = { ...emptyLine(type), ...(catalogItem || {}) };
    setLines((current) => current.length >= 75 ? current : [row, ...current]);
    setFocusNewLine(catalogItem ? null : row.key);
    setChanged(true);
    setFeedback('');
  };

  const openCatalogCreate = (kind, lineKey = null, name = '') => {
    if (!canEdit || busy || catalogSaving) return;
    if (!lineKey && lines.length >= 75) return;
    setCatalogError('');
    setCatalogRequest({ kind, lineKey, name });
  };

  const createCatalogItem = async (draft) => {
    if (!catalogRequest || catalogSaving || !canEdit) return;
    setCatalogSaving(true);
    setCatalogError('');
    try {
      const created = draft.kind === 'part'
        ? await stockCatalogService.createItem({
            partName: draft.name.trim(),
            sku: draft.sku.trim(),
            brand: draft.brand.trim(),
            costPrice: Number(draft.costPrice),
            sellingPrice: Number(draft.price),
            unit: 'Piece',
            minimumStock: 0,
            onHand: 0,
          })
        : await serviceService.createService({
            name: draft.name.trim(),
            code: 'SVC-' + Date.now().toString(36).toUpperCase() + '-' +
              Math.random().toString(36).slice(2, 7).toUpperCase(),
            price: Number(draft.price),
            is_active: true,
          });

      const selection = buildEstimateCatalogSelection(draft, created);
      if (!selection.catalogId) {
        throw new Error('Product was created but its reference was not returned. Refresh the catalogue before retrying.');
      }
      if (catalogRequest.lineKey) {
        selectCatalog(catalogRequest.lineKey, selection);
      } else {
        addLine(selection.type, selection);
      }
      setCatalogRequest(null);
      setCatalogError('');
      setFeedback(draft.kind === 'part'
        ? 'New spare part saved in Stock and added to the estimate.'
        : 'New work saved in Services and added to the estimate.');
    } catch (error) {
      setCatalogError(error?.message || 'Could not create the catalogue item.');
    } finally {
      setCatalogSaving(false);
    }
  };
  const removeLine = (key) => {
    setLines((current) => current.filter((line) => line.key !== key));
    setChanged(true);
    setFeedback('');
  };
  const renderItem = (line, index) => {
    const part = line.type === 'Part';
    const errors = showValidation ? estimateLineErrors(line) : {};
    const invalid = Object.values(errors).some(Boolean);
    return (
      <div className={'job-quick-line' + (invalid ? ' is-invalid' : '')} key={line.key}>
        <div className="job-quick-line-header">
          <strong>{part ? 'Spare Part' : 'Work / Service'} {index + 1}</strong>
          {canEdit && (
            <button
              type="button"
              disabled={busy}
              onClick={() => removeLine(line.key)}
              aria-label={'Remove ' + (part ? 'part ' : 'work item ') + (index + 1)}
              title="Remove item"
            >
              <Trash2 size={15} aria-hidden="true"/>
            </button>
          )}
        </div>
        <div className="job-quick-line-fields">
          <div className="job-quick-description job-quick-name-field">
            <span>{part ? 'Part name' : 'Work description'}</span>
            <EstimateCatalogPicker
              kind={part ? 'part' : 'service'}
              autoFocus={focusNewLine === line.key}
              value={line.description}
              invalid={Boolean(errors.description)}
              disabled={!canEdit || busy}
              onChange={(value) => edit(line.key, 'description', value)}
              onSelect={(item) => selectCatalog(line.key, item)}
              onAddNew={(name) => openCatalogCreate(part ? 'part' : 'service', line.key, name)}
            />
            {errors.description && <small className="job-quick-field-error">{errors.description}</small>}
            {line.catalogId && (
              <small className="job-quick-catalog-selected">
                Selected from {part ? 'stock' : 'services'}{line.catalogCode ? ' · ' + line.catalogCode : ''}
              </small>
            )}
          </div>
          {part ? (
            <span className="job-quick-type-fixed job-quick-field-type">Type <strong>Spare Part</strong></span>
          ) : (
            <label className="job-quick-field-type">Type
              <select value={line.type} disabled={!canEdit || busy} onChange={(event) => edit(line.key, 'type', event.target.value)}>
                <option value="Labour">Labour</option>
                <option value="Service">Service</option>
                <option value="Other">Other Work</option>
              </select>
            </label>
          )}
          <label className="job-quick-field-qty">Qty
            <input
              type="number" min="0.01" max="10000" step="0.01" inputMode="decimal"
              value={line.quantity} disabled={!canEdit || busy}
              aria-invalid={Boolean(errors.quantity)}
              onChange={(event) => edit(line.key, 'quantity', event.target.value)}
            />
            {errors.quantity && <small className="job-quick-field-error">{errors.quantity}</small>}
          </label>
          <label className="job-quick-field-price">{part ? 'Unit Price (₹)' : 'Rate (₹)'}
            <input
              type="number" min="0" max="10000000" step="0.01" inputMode="decimal"
              value={line.unitPrice} disabled={!canEdit || busy} placeholder="0.00"
              aria-invalid={Boolean(errors.unitPrice)}
              onChange={(event) => edit(line.key, 'unitPrice', event.target.value)}
            />
            {errors.unitPrice && <small className="job-quick-field-error">{errors.unitPrice}</small>}
          </label>
          {registered && <>
            <label className="job-quick-field-hsn">HSN / SAC
              <input value={line.hsnSac || ''} maxLength={20}
                placeholder={part ? 'Part HSN' : 'Service SAC'}
                disabled={!canEdit || busy}
                onChange={(event) => edit(line.key, 'hsnSac', event.target.value)} />
            </label>
            <label className="job-quick-field-gst">GST rate (%)
              <select
                className="job-quick-gst-select"
                aria-label={`GST Rate (%) for ${part ? 'spare part' : 'work item'} ${index + 1}`}
                value={line.taxChoice === 'none' ? 'none' : invoiceChoiceFromTotalRate(line.taxRate, taxMode, line.taxChoice, job?.gstInfo?.gstRateOptions)}
                disabled={!canEdit || busy}
                onChange={(event) => chooseGst(line.key, event.target.value)}
              >
                <option value="">Select GST Rate</option>
                {estimateGstOptions(line.taxRate, taxMode, job?.gstInfo?.gstRateOptions).map((choice) => (
                  <option value={choice.value} key={choice.value}>{choice.label}</option>
                ))}
              </select>
            </label>
            {line.taxChoice === 'none' && <div className="job-quick-zero-tax-fields">
              <label>Zero-GST classification
                <select value={line.taxTreatment || ''} disabled={!canEdit || busy}
                  aria-label={'No GST classification for item ' + (index + 1)}
                  onChange={(event) => edit(line.key, 'taxTreatment', event.target.value)}>
                  <option value="">Select legal supply classification</option>
                  {ESTIMATE_ZERO_TAX_TREATMENTS.map((choice) =>
                    <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                </select>
              </label>
              <label className="job-quick-zero-confirm">
                <input type="checkbox" checked={Boolean(line.taxTreatmentConfirmed)}
                  disabled={!canEdit || busy || !line.taxTreatment}
                  onChange={(event) => edit(line.key, 'taxTreatmentConfirmed', event.target.checked)}/>
                I confirm the selected classification applies to this HSN/SAC. No automatic exemption is assumed.
              </label>
            </div>}
          </>}
        </div>
        <div className="job-quick-line-total">
          Amount <strong>{money((Number(line.quantity) || 0) * (Number(line.unitPrice) || 0))}</strong>
        </div>
      </div>
    );
  };

  const addInspection = () => {
    const suggestions = inspectSuggestions(findings);
    if (!suggestions.length) return;
    setLines((current) => [
      ...suggestions.slice(0, Math.max(0, 75 - current.length)), ...current
    ]);
    setChanged(true);
    setFeedback('');
  };

  return (
    <div className="job-quick-estimate" ref={formRef}>
      <header className="job-quick-header">
        <div>
          <span className="job-quick-eyebrow">Job Card / Estimate</span>
          <h2><ReceiptText size={19} aria-hidden="true"/> Quick Estimate</h2>
          <p>Add work or spare parts, review the total and ask for customer approval.</p>
          {wasSkipped && (
            <p role="status">Estimate was skipped. {canReopen
              ? 'Choose Edit Skipped Estimate to reopen it before starting Work.'
              : 'Later work or billing prevents reopening this skipped stage.'}</p>
          )}
          {latest?.status === 'Awaiting Customer' &&
            <p role="status">Shared with customer. The amount is locked until they respond or you withdraw it.</p>}
          {latest?.status === 'Customer Approved' &&
            <p role="status">Customer accepted Estimate V{latest.version} in the secure portal. Confirm to advance the Job Card.</p>}
          {latest?.status === 'Customer Rejected' &&
            <p role="status">Customer declined this quote. Save and share a revised estimate before continuing.</p>}
        </div>
        <div className="job-quick-header-actions">
          {wasSkipped && (
            <button type="button" className="job-quick-outline job-quick-reopen"
              disabled={!canReopen || busy || reopenBusy}
              onClick={reopenSkippedEstimate}>
              <Pencil size={15} aria-hidden="true" />
              {reopenBusy ? 'Reopening…' : 'Edit Skipped Estimate'}
            </button>
          )}
          <button type="button" className="job-quick-outline" onClick={onEditInspection} disabled={!canEdit}>
            <Pencil size={15} aria-hidden="true"/> Edit Inspection
          </button>
        </div>
      </header>

      {latest?.status === 'Customer Rejected' && latestDecline && (
        <section className="job-estimate-customer-feedback" aria-label="Customer revision request">
          <h3>Customer requested an estimate revision</h3>
          <p><strong>Reason:</strong> {latestDecline.reasonLabel}</p>
          {latestDecline.note && <p className="job-estimate-customer-message">{latestDecline.note}</p>}
          <small>Estimate V{latestDecline.version || latest.version} ·
            Decision receipt: {latestDecline.receiptId}</small>
          <p>Update the work/parts above, save a new version, then share it to the customer portal.</p>
        </section>
      )}

      {stale && <p className="job-quick-warning" role="status">
        Inspection has changed. Approve & Continue will save the revised estimate before approval.
      </p>}
      {feedback && <p className="job-quick-feedback" role="status">{feedback}</p>}

      <div className="job-quick-grid">
        <section className="job-quick-panel job-quick-work-parts">
          <div className="job-quick-section-head">
            <div>
              <h3>Work & Parts</h3>
              <p>Add work and spare parts separately. Enter quantity and rate to calculate the total.</p>
            </div>
            <span className="job-quick-count">{lines.length} {lines.length === 1 ? 'item' : 'items'}</span>
          </div>

          <section className="job-quick-item-group" aria-label="Work and labour items">
            <div className="job-quick-group-heading">
              <div>
                <h4><Wrench size={16} aria-hidden="true"/> Work & Labour</h4>
                <p>{money(amount.work)} · {lines.filter((item) => item.type !== 'Part').length} items</p>
              </div>
              {canEdit && <div className="job-quick-group-actions">
                <button type="button" className="job-quick-add-button" disabled={busy || lines.length >= 75} onClick={() => addLine('Labour')}>
                  <Plus size={15} aria-hidden="true"/> Add Work
                </button>
              </div>}
            </div>
            <div className="job-quick-items">
              {lines.filter((line) => line.type !== 'Part').map(renderItem)}
              {!lines.some((line) => line.type !== 'Part') &&
                <p className="job-quick-empty">No work added. Choose Add Work to enter service or labour charges.</p>}
            </div>
          </section>

          <section className="job-quick-item-group" aria-label="Spare part items">
            <div className="job-quick-group-heading">
              <div>
                <h4><Package size={16} aria-hidden="true"/> Spare Parts</h4>
                <p>{money(amount.parts)} · {lines.filter((item) => item.type === 'Part').length} items</p>
              </div>
              {canEdit && <div className="job-quick-group-actions">
                <button type="button" className="job-quick-add-button" disabled={busy || lines.length >= 75} onClick={() => addLine('Part')}>
                  <Plus size={15} aria-hidden="true"/> Add Part
                </button>
              </div>}
            </div>
            <div className="job-quick-items">
              {lines.filter((line) => line.type === 'Part').map(renderItem)}
              {!lines.some((line) => line.type === 'Part') &&
                <p className="job-quick-empty">No spare parts added. Choose Add Part to enter part prices.</p>}
            </div>
          </section>

          {canEdit && findings.length > 0 && (
            <button type="button" className="job-quick-import" disabled={busy} onClick={addInspection}>
              <ClipboardList size={15} aria-hidden="true"/> Add from Inspection Findings
            </button>
          )}
        </section>

        <section className="job-quick-panel job-quick-summary">
          <div className="job-quick-section-head">
            <div><h3>Estimate Total</h3><p>Final calculation</p></div>
          </div>
          <dl className="job-quick-amounts">
            <div><dt>Work & Labour</dt><dd>{money(amount.work)}</dd></div>
            <div><dt>Spare Parts</dt><dd>{money(amount.parts)}</dd></div>
            <div><dt>Subtotal</dt><dd>{money(amount.subtotal)}</dd></div>
            <div className="job-quick-adjustments">
              <label>Discount (₹)
                <input type="number" min="0" step="0.01" value={discount} disabled={!canEdit || busy}
                  aria-invalid={showValidation && validation.startsWith('Discount')}
                  onChange={(e) => { setDiscount(e.target.value); setChanged(true); }}/>
              </label>
              {registered && <label>Place of Supply (India)
                <select value={placeOfSupply} disabled={!canEdit || busy}
                  onChange={(e) => changePlaceOfSupply(e.target.value)}>
                  <option value="">Choose State / UT</option>
                  {INDIA_STATES.map(([code, name]) =>
                    <option key={code} value={code}>{code} — {name}</option>)}
                </select>
              </label>}
            </div>
            {registered ? <>
              <div><dt>Supplier state (GSTIN)</dt><dd>{supplierState || 'Not configured'}</dd></div>
              <div><dt>Taxable amount</dt><dd>{money(amount.taxable)}</dd></div>
              {amount.mode === 'cgst_sgst' && <>
                <div><dt>CGST</dt><dd>{money(amount.cgst)}</dd></div>
                <div><dt>SGST / UTGST</dt><dd>{money(amount.sgst)}</dd></div>
              </>}
              {amount.mode === 'igst' && <div><dt>IGST</dt><dd>{money(amount.igst)}</dd></div>}
            </> : <div><dt>GST</dt><dd>No GST — workshop not registered</dd></div>}
            <div className="job-quick-grand-total"><dt>Total</dt><dd>{money(amount.total)}</dd></div>
          </dl>
          {canEdit ? (
            <div className="job-quick-actions">
              {showValidation && validation && <p className="job-quick-invalid" role="alert">{validation}</p>}
              <div className="job-quick-footer-actions">
                <button type="button" className="job-quick-skip"
                  disabled={busy || skipBusy} onClick={() => { setSkipError(''); setShowSkipModal(true); }}>
                  <SkipForward size={16} aria-hidden="true"/> Skip Estimate
                </button>
              {latest?.status === 'Awaiting Customer' ? (
                <>
                  <div className="job-quote-whatsapp">
                    <WhatsAppManualShareButton
                      targetType="estimate" targetId={latest.id}
                      label="Send Estimate via WhatsApp"
                    />
                    <small>Manual option: review the prepared message and press Send in WhatsApp. Automatic alerts require customer consent and an approved template.</small>
                  </div>
                  <button type="button" className="job-quick-outline"
                    disabled={busy || skipBusy} onClick={withdrawReview}>
                    {busy ? 'Please wait…' : 'Withdraw from customer review'}
                  </button>
                </>
              ) : (
                <>
                  {latest?.status !== 'Customer Approved' && onShare && (
                    <button type="button" className="job-quick-outline"
                      disabled={busy || skipBusy} onClick={shareForReview}>
                      {busy ? 'Please wait…' : 'Save & Share with Customer'}
                    </button>
                  )}
                  {latest?.status !== 'Customer Rejected' && (
                    <button type="button" className="job-quick-approve"
                      disabled={busy || skipBusy} onClick={approve}>
                      <CheckCircle2 size={16} aria-hidden="true"/>
                      {busy ? 'Please wait…' : latest?.status === 'Customer Approved'
                        ? 'Confirm Customer Acceptance & Continue' : 'Approve & Continue'}
                    </button>
                  )}
                </>
              )}
              </div>
            </div>
          ) : (
            <div className="job-quick-actions">
              {approvedEstimate && (
                <button type="button" className="job-quick-approved-download"
                  onClick={() => onDownloadApproved?.(approvedEstimate)}>
                  <Download size={16} aria-hidden="true"/> Download Approved PDF
                </button>
              )}
              <button type="button" className="job-quick-outline" onClick={onGoToWork}>Go to current stage</button>
            </div>
          )}
        </section>
      </div>

      <ResponsiveModalSheet
        isOpen={showSkipModal}
        onClose={() => { if (!skipBusy) setShowSkipModal(false); }}
        title="Skip Estimate" maxWidth="480px">
        <form className="job-estimate-skip-form" onSubmit={confirmSkip}>
          <p>Skipping is not an estimate approval. Existing draft estimates remain in history.
            The reason and authorized user will be recorded in the Job Card audit trail.</p>
          <label>Reason *
            <select value={skipReason} disabled={skipBusy} required
              onChange={(event) => { setSkipReason(event.target.value); setSkipError(''); }}>
              {['Estimate Not Required', 'Quick Service', 'Customer Declined Estimate', 'Other'].map((reason) =>
                <option key={reason} value={reason}>{reason}</option>)}
            </select>
          </label>
          <label>{skipReason === 'Other' ? 'Explain why (required)' : 'Additional notes (optional)'}
            <textarea value={skipDetails} disabled={skipBusy} maxLength={500} rows={3}
              required={skipReason === 'Other'} minLength={skipReason === 'Other' ? 5 : undefined}
              onChange={(event) => setSkipDetails(event.target.value)}
              placeholder="Reason recorded in the audit trail"/>
          </label>
          {skipError && <p className="job-estimate-skip-error" role="alert">{skipError}</p>}
          <div className="job-estimate-skip-actions">
            <button type="button" disabled={skipBusy} onClick={() => setShowSkipModal(false)}>Cancel</button>
            <button type="submit" className="job-estimate-skip-confirm"
              disabled={skipBusy || (skipReason === 'Other' && skipDetails.trim().length < 5)}>
              <SkipForward size={16} aria-hidden="true"/>{skipBusy ? 'Skipping…' : 'Confirm Skip & Continue'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>

      <EstimateAddCatalogModal
        request={catalogRequest}
        saving={catalogSaving}
        error={catalogError}
        onClose={() => { if (!catalogSaving) setCatalogRequest(null); }}
        onCreate={createCatalogItem}
      />

      <details className="job-quick-history">
        <summary>Estimate History ({estimates.length}) <ChevronDown size={15} aria-hidden="true"/></summary>
        <div className="job-quick-history-list">
          {estimates.length ? [...estimates].reverse().map((item) => (
            <div key={item.id || item.version}>
              <span>{'Estimate V' + (typeof item.version === 'number' ? item.version : String(item.version || ''))}</span>
              <strong>{money(item.total ?? item.grandTotal)}</strong>
              <span>{item.approvalStatus || item.status || 'Draft'}</span>
              {item.status === 'Customer Rejected' && declineByEstimate.has(String(item.id)) && (
                <div className="job-estimate-history-feedback">
                  <strong>Customer feedback: {declineByEstimate.get(String(item.id)).reasonLabel}</strong>
                  {declineByEstimate.get(String(item.id)).note &&
                    <p>{declineByEstimate.get(String(item.id)).note}</p>}
                  <small>Receipt: {declineByEstimate.get(String(item.id)).receiptId}</small>
                </div>
              )}
              {canEdit && item.id === latest?.id && item.status === 'Draft' &&
                <button type="button" disabled={busy} onClick={() => onReject?.(item.id)}>Reject</button>}
            </div>
          )) : <p>No previous estimates.</p>}
        </div>
      </details>
    </div>
  );
}

export default QuickEstimatePanel;
