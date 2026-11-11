import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Edit3, Eye, Plus, Printer, Download, Trash2, Truck, Search, IndianRupee, FileClock } from "lucide-react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  blankEWayBill,
  calculateEWayTotals,
  eWayBillService,
  validateEWayBill
} from '../../services/eWayBill.service';
import { billingService } from '../../services/billing.service';
import { invoiceStateCode, invoiceLineTaxChoices, invoiceChoiceFromTotalRate } from '../../utils/invoiceTaxUi';
import { INDIA_STATES } from '../../utils/indiaGst.js';
import { eWayTaxMode, eWayTotalGstRate, eWaySetGstRate, eWayReconcileGst, eWayGstinStateCode, eWayRecipientWithGstin } from '../../utils/eWayGst';
import { DocumentFormHeader } from '../../components/common/DocumentFormShell';
import { EWayBillPdfShareSheet } from '../../components/invoices/EWayBillPdfShareSheet';
import { validateEWayForPreparation, parseEWayApiErrors } from '../../utils/eWayFormValidation';
import '../../styles/e-way-input-validation.css';
import { InvoiceTabs, InvoiceFilterToolbar } from '../../components/invoices';
import '../../styles/invoice-unified-ui.css';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const n = (value) => Number(value || 0);
const dec = (value) => String(value ?? '').replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
const formatEwbNo = (value) => {
  const digits = String(value || '').replace(/\D/g, '');
  return digits ? digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim() : '';
};
const newItem = () => ({
  id: `EWI-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  productName: '',
  description: '',
  hsnCode: '',
  qty: 1,
  unit: 'PCS',
  taxableValue: '',
  cgstRate: '',
  sgstRate: '',
  igstRate: '',
  cessRate: ''
});

const resolveMode = (pathname, id) => {
  if (pathname.endsWith('/new')) return 'create';
  if (pathname.endsWith('/edit')) return 'edit';
  if (pathname.endsWith('/delete')) return 'delete';
  if (id) return 'view';
  return 'list';
};

export function EWayBillPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { ewbId } = useParams();
  const mode = resolveMode(location.pathname, ewbId);

  const [rows, setRows] = useState([]);
  const [form, setForm] = useState(blankEWayBill());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfShareOpen, setPdfShareOpen] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const eWayEditorRef = useRef(null);
  const [listQuery, setListQuery] = useState('');
  const [listStatus, setListStatus] = useState('All');
  const [supplyingParty, setSupplyingParty] = useState(null);
  const [gstRateOptions, setGstRateOptions] = useState(null);
  const [supplyingError, setSupplyingError] = useState('');
  const [supplyingLoading, setSupplyingLoading] = useState(false);

  const statuses = useMemo(
    () => [...new Set(rows.map((row) => row.status).filter(Boolean))].sort(),
    [rows],
  );
  const filteredRows = useMemo(() => {
    const query = listQuery.trim().toLowerCase();
    return rows.filter((row) => {
      if (listStatus !== 'All' && row.status !== listStatus) return false;
      if (!query) return true;
      return [
        row.documentNo, row.ewayBillNo, row.jobCardNo, row.documentType,
        row.supplyType, row.from?.tradeName, row.from?.gstin,
        row.to?.tradeName, row.to?.gstin, row.transport?.vehicleNo,
      ].some((value) => String(value ?? '').toLowerCase().includes(query));
    });
  }, [rows, listQuery, listStatus]);
  const totalDocumentValue = useMemo(
    () => rows.reduce((total, row) => total + calculateEWayTotals(row).totalValue, 0),
    [rows],
  );

  const totals = useMemo(() => calculateEWayTotals(form), [form]);
  const gstMode = eWayTaxMode(form);
  const taxChoices = invoiceLineTaxChoices(gstMode, gstRateOptions);
  const showFieldError = (key) => fieldErrors[key]
    ? <small className="eway-input-error" role="alert">{fieldErrors[key]}</small> : null;
  const clearField = (key) => setFieldErrors((current) => {
    if (!current[key] && !current.items) return current;
    const next = { ...current };
    delete next[key];
    delete next.items;
    return next;
  });
  useEffect(() => {
    const key = Object.keys(fieldErrors)[0];
    if (!key || !['create', 'edit'].includes(mode)) return;
    const target = [...(eWayEditorRef.current?.querySelectorAll('[data-eway-field]') || [])]
      .find((element) => element.getAttribute('data-eway-field') === key);
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    target.focus({ preventScroll: true });
  }, [fieldErrors, mode]);
  const isOutward = form.supplyType === 'Outward';

  const loadList = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await eWayBillService.list();
      setRows(Array.isArray(result) ? result : Array.isArray(result?.results) ? result.results : []);
    } catch (e) {
      setRows([]);
      setError(e?.message || 'Unable to load E-Way Bills. Check the server and try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadOne = async () => {
    setLoading(true);
    try {
      const doc = await eWayBillService.get(ewbId);
      if (!doc) setError('E-Way Bill not found.');
      else setForm(() => {
        const current = JSON.parse(JSON.stringify(doc));
        if (!eWayGstinStateCode(current.to?.gstin)) return current;
        const next = { ...current,
          to: eWayRecipientWithGstin(current.to, current.to.gstin) };
        return { ...next, items: eWayReconcileGst(next.items, eWayTaxMode(next)) };
      });
    } catch (e) {
      setError(e?.message || 'Unable to load E-Way Bill.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    if (mode === 'list') loadList();
    else if (mode === 'create') {
      const invoiceId = new URLSearchParams(location.search).get('invoiceId');
      if (!invoiceId) {
        setForm(blankEWayBill());
        setLoading(false);
      } else {
        setLoading(true);
        billingService.get(invoiceId)
          .then((invoice) => {
            if (!invoice) throw new Error('Source invoice not found.');
            const base = blankEWayBill();
            const goods = (invoice.items || [])
              .filter((item) => ['Stock Part', 'Outside Purchase', 'Consumable', 'Custom Item'].includes(item.type))
              .map((item, index) => eWaySetGstRate({
                id: `EWI-PREFILL-${index}-${Date.now()}`,
                productName: item.description || 'Goods',
                description: item.code || '',
                hsnCode: item.hsnCode || '',
                qty: Number(item.qty || 1),
                unit: item.unit || 'PCS',
                taxableValue: Math.max(0, Number(item.qty || 0) * Number(item.rate || 0) - Number(item.discount || 0)),
                cgstRate: '', sgstRate: '', igstRate: '', cessRate: ''
              }, Number(item.taxRate || 0), invoice.taxMode));

            setForm((previous) => ({
              ...base,
              from: previous.from?.tradeName ? previous.from : base.from,
              documentType: invoice.invoiceType === 'gst' ? 'Tax Invoice' : 'Bill of Supply',
              documentNo: invoice.number || invoice.id || '',
              documentDate: invoice.date || base.documentDate,
              invoiceId: invoice.id || '',
              jobCardNo: invoice.jobCardNo || '',
              to: {
                ...base.to,
                gstin: invoice.customer?.gstin || 'URP',
                tradeName: invoice.customer?.name || '',
                address: invoice.customer?.address || '',
                place: invoice.customer?.placeOfSupply || '',
                stateCode: eWayGstinStateCode(invoice.customer?.gstin)
                  || invoiceStateCode(invoice.customer?.placeOfSupply || invoice.customer?.stateCode || invoice.customer?.state)
                  || base.to.stateCode
              },
              items: goods.length ? goods : base.items,
              notes: invoice.number ? `Created from CubixGear invoice ${invoice.number}` : ''
            }));
          })
          .catch((e) => setError(e?.message || 'Unable to prefill from invoice.'))
          .finally(() => setLoading(false));
      }
    } else loadOne();
  }, [location.pathname, location.search, ewbId]);

  useEffect(() => {
    if (!['create', 'edit'].includes(mode)) return undefined;
    let active = true;
    setSupplyingLoading(true);
    setSupplyingError('');
    eWayBillService.getFromContext().then((context) => {
      if (!active) return;
      if (!context?.from) {
        setSupplyingError('Company Settings must include the correct workshop GSTIN, address, place, PIN and state.');
        return;
      }
      setSupplyingParty(context.from);
      setGstRateOptions(context.gstRateOptions || null);
      setForm((old) => {
        if (old.supplyType !== 'Outward') return old;
        const next = { ...old, from: context.from };
        return { ...next, items: eWayReconcileGst(next.items, eWayTaxMode(next)) };
      });
    }).catch((err) => {
      if (active) setSupplyingError(err?.message || 'Cannot load supplying workshop details.');
    }).finally(() => {
      if (active) setSupplyingLoading(false);
    });
    return () => { active = false; };
  }, [mode]);

  const update = (key, value) => {
    clearField(key);
    setForm((old) => {
    if (key === 'supplyType') {
      // Inward: vendor dispatches goods; their FROM must remain editable.
      // Outward: the workshop identity is always read-only and server-derived.
      if (value === 'Inward' && old.supplyType !== 'Inward') {
        return { ...old, supplyType: value,
          from: { gstin: '', tradeName: '', address: '', place: '', pincode: '', stateCode: '' },
          to: supplyingParty || old.to };
      }
      if (value === 'Outward' && old.supplyType !== 'Outward') {
        return { ...old, supplyType: value, from: supplyingParty || old.from,
          to: { gstin: '', tradeName: '', address: '', place: '', pincode: '', stateCode: '' } };
      }
    }
    return { ...old, [key]: value };
    });
  };
  const updateGroup = (group, key, value) => {
    clearField(group + '.' + key);
    setForm((old) => {
    // FROM is locked for outward supplies in UI AND Django serializer.
    if (group === 'from' && old.supplyType === 'Outward') return old;
    if (group === 'to' && key === 'stateCode' && eWayGstinStateCode(old.to?.gstin)) return old;
    const next = { ...old, [group]: { ...old[group], [key]: value } };
    if (group === 'to' && key === 'gstin') {
      next.to = eWayRecipientWithGstin(old.to, value);
    }
    if ((key === 'stateCode' && ['to', 'from'].includes(group)) ||
        (group === 'to' && key === 'gstin')) {
      next.items = eWayReconcileGst(next.items, eWayTaxMode(next));
    }
    return next;
    });
  };
  const updateItem = (itemId, key, value) => {
    const index = form.items.findIndex((item) => item.id === itemId);
    clearField('items.' + index + '.' + key);
    setForm((old) => ({
    ...old,
    items: old.items.map((item) => item.id === itemId ? { ...item, [key]: value } : item)
    }));
  };
  const updateItemGst = (itemId, selected) => setForm((old) => {
    const choice = taxChoices.find(entry => entry.value === selected);
    return {
      ...old, items: old.items.map(item => item.id === itemId
        ? { ...eWaySetGstRate(item, choice?.totalRate ?? '', eWayTaxMode(old)),
            gstChoice: choice?.value || '' } : item),
    };
  });
  const selectedItemGst = (item) => {
    const rate = eWayTotalGstRate(item);
    if (!item.gstChoice && !rate) return '';
    return invoiceChoiceFromTotalRate(rate, gstMode, item.gstChoice, gstRateOptions);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      const saved = await eWayBillService.save(form);
      navigate(`/invoices/e-way-bills/${saved.id}`, { replace: true });
    } catch (e) {
      const parsed = parseEWayApiErrors(e);
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const submit = async () => {
    if (isOutward && (!supplyingParty || supplyingLoading || supplyingError)) {
      return setError('Verify Company / Branch Settings before preparing an outward E-Way Bill.');
    }
    const illegalGstChoice = (form.items || []).some(item => {
      if (!item.gstChoice) return false;
      const choice = taxChoices.find(option => option.value === item.gstChoice);
      return !choice || choice.taxMode !== gstMode ||
        Number(choice.totalRate) !== eWayTotalGstRate(item);
    });
    if (illegalGstChoice) {
      return setError('Selected CGST / SGST / IGST does not match dispatch and destination states.');
    }
    const invalidFields = validateEWayForPreparation(form);
    if (Object.keys(invalidFields).length) {
      setFieldErrors(invalidFields);
      setError('Complete the highlighted fields before preparing for API.');
      return;
    }
    const validation = validateEWayBill(form);
    if (validation) return setError(validation);

    setSaving(true);
    setError('');
    setFieldErrors({});
    try {
      let current = form;
      if (!current.id) current = await eWayBillService.save(current);
      const result = await eWayBillService.submit(current.id);
      setForm(result);
      navigate(`/invoices/e-way-bills/${result.id}`, { replace: true });
    } catch (e) {
      const parsed = parseEWayApiErrors(e);
      setFieldErrors(parsed.fieldErrors);
      setError(parsed.message);
    } finally {
      setSaving(false);
    }
  };

  const openPdfShare = () => {
    if (!form?.id) {
      setError('Save the E-Way Bill draft before downloading its PDF.');
      return;
    }
    setError('');
    setPdfShareOpen(true);
  };
  const pdfShareSheet = pdfShareOpen && form?.id
    ? <EWayBillPdfShareSheet document={form} onClose={() => setPdfShareOpen(false)}/>
    : null;

  const remove = async () => {
    setSaving(true);
    try {
      await eWayBillService.remove(ewbId);
      navigate('/invoices/e-way-bills', { replace: true });
    } catch (e) {
      setError(e?.message || 'Unable to delete E-Way Bill.');
      setSaving(false);
    }
  };

  if (mode === 'list') {
    return (
      <div className="billing-page billing-ui-unified billing-list-dashboard invoice-dashboard billing-eway-list">
        <header className="invoice-dashboard-header">
          <div>
            <h1>E-Way Bills</h1>
            <p>Track workshop goods movement documents and preparation status.</p>
          </div>
          <div className="invoice-dashboard-header-actions">
            <button type="button" className="bill-btn" onClick={() => navigate('/invoices/e-way-bills/new')}>
              <Plus size={16} aria-hidden="true"/> New E-Way Bill
            </button>
          </div>
        </header>

        <InvoiceTabs
          activeTab="eway"
          onChange={(kind) => navigate(`/invoices?kind=${kind}`)}
          onEWayBills={() => navigate('/invoices/e-way-bills')}
        />

        <section className="invoice-dashboard-stats" aria-label="E-Way Bill overview">
          {[
            { label: 'Total Documents', value: rows.length, meta: 'saved transport records', Icon: Truck },
            { label: 'Draft', value: rows.filter((row) => row.status === 'Draft').length, meta: 'editable drafts', Icon: FileClock },
            { label: 'Ready for API', value: rows.filter((row) => row.status === 'Ready for API').length, meta: 'not proof of NIC generation', Icon: CheckCircle2 },
            { label: 'Total Goods Value', value: money.format(totalDocumentValue), meta: 'sum of document values', Icon: IndianRupee },
          ].map(({ label, value, meta, Icon }) => (
            <article key={label} className="invoice-dashboard-stat-card">
              <div className="invoice-dashboard-stat-top">
                <div>
                  <span>{label}</span>
                  <strong>{value}</strong>
                </div>
                <i aria-hidden="true"><Icon size={16}/></i>
              </div>
              <small>{meta}</small>
            </article>
          ))}
        </section>

        <InvoiceFilterToolbar
          query={listQuery}
          onQueryChange={setListQuery}
          status={listStatus}
          onStatusChange={setListStatus}
          statuses={statuses}
          resultCount={filteredRows.length}
          placeholder="Search document, sender, recipient, GSTIN or vehicle"
        />

        <p className="billing-eway-notice">
          CubixGear drafts and “Ready for API” documents are not official GST portal E-Way Bills.
          An official E-Way Bill number must be issued by the authorized NIC/GST system.
        </p>

        {error && <div className="billing-error invoice-list-error" role="alert">
          <span>{error}</span>
          <button type="button" className="bill-btn secondary" onClick={() => void loadList()} disabled={loading}>Retry</button>
        </div>}

        <section className="billing-card billing-list-card billing-eway-records" aria-label="E-Way Bill records">
          <header className="invoice-dashboard-section-title">
            <div>
              <h2>E-Way Bill Records</h2>
              <p>Document numbers, movement details, values and current status.</p>
            </div>
            <span>{filteredRows.length} record{filteredRows.length === 1 ? '' : 's'}</span>
          </header>

          {loading ? (
            <div className="billing-empty" role="status">Loading E-Way Bills…</div>
          ) : error ? null : filteredRows.length === 0 ? (
            <div className="billing-empty">
              <Search size={18} aria-hidden="true"/>
              <span>{rows.length ? 'No E-Way Bills match these filters.' : 'No E-Way Bills yet. Create a draft to get started.'}</span>
            </div>
          ) : (
            <div className="billing-doc-list">
              {filteredRows.map((row) => {
                const total = calculateEWayTotals(row).totalValue;
                return (
                  <article className="billing-doc-row" key={row.id}>
                    <button type="button" className="billing-doc-main" onClick={() => navigate(`/invoices/e-way-bills/${row.id}`)}>
                      <strong>{row.documentNo || row.id}</strong>
                      <span>{row.supplyType || 'Movement'} · {row.from?.tradeName || 'From'} → {row.to?.tradeName || 'To'}</span>
                    </button>
                    <div className="billing-doc-meta">
                      <span>{row.documentDate || '—'}</span>
                      <strong>{money.format(total)}</strong>
                    </div>
                    <span className="billing-status">{row.status || 'Draft'}</span>
                    <div className="billing-list-actions">
                      <button type="button" aria-label={`View ${row.documentNo || row.id}`} title="View" onClick={() => navigate(`/invoices/e-way-bills/${row.id}`)}><Eye size={16}/></button>
                      {row.status === 'Draft' && (
                        <button type="button" aria-label={`Edit ${row.documentNo || row.id}`} title="Edit" onClick={() => navigate(`/invoices/e-way-bills/${row.id}/edit`)}><Edit3 size={16}/></button>
                      )}
                      {row.status === 'Draft' && <button type="button" aria-label={`Delete ${row.documentNo || row.id}`} title="Delete Draft" className="danger" onClick={() => navigate(`/invoices/e-way-bills/${row.id}/delete`)}><Trash2 size={16}/></button>}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    );
  }

  if (mode === 'delete') {
    return (
      <div className="billing-page billing-ui-unified">
        <header className="billing-page-head">
          <div><span className="billing-kicker">DELETE E-WAY BILL</span><h1>{form.documentNo || ewbId}</h1></div>
        </header>
        {error && <div className="billing-error">{error}</div>}
        <section className="billing-card">
          <h3>Delete this local E-Way Bill draft?</h3>
          <p>This only deletes the CubixGear record. It does not cancel an E-Way Bill already generated on the GST portal.</p>
          <div className="billing-head-actions">
            <button type="button" className="bill-btn secondary"
              onClick={() => navigate('/invoices/e-way-bills')}>Keep Draft</button>
            <button className="bill-btn danger" disabled={saving || form.status !== 'Draft'} onClick={remove}><Trash2 size={16}/>{saving ? 'Deleting…' : 'Delete Draft'}</button>
          </div>
        </section>
      </div>
    );
  }

  if (mode === 'view') {
    return (
      <div className="billing-page billing-ui-unified invoice-view-page">
        <div className="billing-editor-head eway-editor-head no-print">
          <div className="eway-title-block">
            <div className="eway-title-copy">
              <span className="billing-kicker">E-WAY BILL</span>
              <h1>{form.documentNo || form.id}</h1>
              <p>{form.supplyType} · {form.status}</p>
            </div>
          </div>
          <div className="billing-head-actions">
            <button type="button" className="bill-btn secondary"
              onClick={() => navigate('/invoices/e-way-bills')}>Back to List</button>
            {form.status === 'Draft' && <button className="bill-btn secondary" onClick={() => navigate(`/invoices/e-way-bills/${ewbId}/edit`)}><Edit3 size={16}/>Edit</button>}
            <button className="bill-btn secondary" onClick={() => window.print()}><Printer size={16}/>Print</button>
            <button className="bill-btn" onClick={openPdfShare}><Download size={16}/>Download PDF</button>
            {form.status === 'Draft' && <button className="bill-btn" disabled={saving} onClick={submit}><CheckCircle2 size={16}/>Prepare for API</button>}
          </div>
        </div>

        {error && <div className="billing-error no-print">{error}</div>}
        {loading ? <div className="billing-empty">Loading…</div> : <EWayBillPrint doc={form} totals={totals}/>}
        {pdfShareSheet}
      </div>
    );
  }

  return (
    <div ref={eWayEditorRef} className="billing-page billing-ui-unified">
      <DocumentFormHeader
        eyebrow="E-WAY BILL"
        title={mode === 'edit' ? 'Edit E-Way Bill' : 'Create E-Way Bill'}
        description="Enter the sender, receiver, goods and transport details. Save a local draft before preparing for the official portal."
        actions={
          <>
            <button className="bill-btn secondary" type="button" onClick={() => window.print()}>
              <Printer size={16}/>Preview
            </button>
            <button className="bill-btn" type="button" onClick={openPdfShare}>
              <Download size={16}/>Download PDF
            </button>
            <button className="bill-btn secondary" disabled={saving} onClick={save}>
              Save Draft
            </button>
            <button className="bill-btn" disabled={saving} onClick={submit}>
              <CheckCircle2 size={16}/>{saving ? 'Working…' : 'Prepare for API'}
            </button>
          </>
        }
      />

      {error && <div className="billing-error no-print" role="alert">{error}</div>}

      <div className="no-print grid gap-4">
        <section className="billing-card">
          <div className="mb-4">
            <span className="billing-kicker">SECTION 1</span>
            <h3>1. E-WAY BILL Details</h3>
            <p className="m-0 text-xs text-muted">Basic E-Way Bill document and movement information.</p>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label>Supply Type
              <select value={form.supplyType} onChange={(e) => update('supplyType', e.target.value)}> 
                <option>Outward</option>
                <option>Inward</option>
              </select>
            </label>

            <label>Sub Supply Type
              <select value={form.subSupplyType} onChange={(e) => update('subSupplyType', e.target.value)}>
                {['Supply','Import','Export','Job Work','SKD/CKD','Recipient Not Known','Line Sales','Sales Return','Exhibition or Fairs','For Own Use','Others'].map((x) => <option key={x}>{x}</option>)}
              </select>
            </label>

            <label>Transaction Type
              <select value={form.transactionType} onChange={(e) => update('transactionType', e.target.value)}>
                <option>Regular</option>
                <option>Bill To - Ship To</option>
                <option>Bill From - Dispatch From</option>
                <option>Combination</option>
              </select>
            </label>

            <label>Transport Mode
              <select value={form.transport.mode} onChange={(e) => updateGroup('transport', 'mode', e.target.value)}>
                <option>Road</option>
                <option>Rail</option>
                <option>Air</option>
                <option>Ship</option>
              </select>
            </label>

            <label>Document Type
              <select value={form.documentType} onChange={(e) => update('documentType', e.target.value)}>
                <option>Tax Invoice</option>
                <option>Bill of Supply</option>
                <option>Delivery Challan</option>
                <option>Bill of Entry</option>
                <option>Others</option>
              </select>
            </label>

            <label>Document Number
              <input data-eway-field="documentNo" aria-invalid={Boolean(fieldErrors.documentNo)}
                value={form.documentNo} onChange={(e) => update('documentNo', e.target.value)} placeholder="Invoice / Challan No."/>
              {showFieldError('documentNo')}
            </label>

            <label>Document Date
              <input data-eway-field="documentDate" aria-invalid={Boolean(fieldErrors.documentDate)}
                type="date" value={form.documentDate} onChange={(e) => update('documentDate', e.target.value)}/>
              {showFieldError('documentDate')}
            </label>

            <label>Approx Distance (km)
              <input data-eway-field="transport.distanceKm" aria-invalid={Boolean(fieldErrors['transport.distanceKm'])}
                inputMode="numeric" value={form.transport.distanceKm} onChange={(e) => updateGroup('transport', 'distanceKm', dec(e.target.value))} placeholder="0"/>
              {showFieldError('transport.distanceKm')}
            </label>
          </div>
        </section>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="billing-card">
            <span className="billing-kicker">SECTION 2 · FROM</span>
            <h3>2. Address Details · Dispatch / Bill From</h3>
            {isOutward && <p className="eway-from-source-note" role="status">
              {supplyingLoading ? 'Loading workshop address…'
                : 'Auto-filled from Company / Branch Settings · Read-only'}
            </p>}
            {isOutward && supplyingError && <p role="alert" className="eway-from-error">
              {supplyingError} <button type="button" onClick={() => navigate('/account/company')}>Open Company Settings</button>
            </p>}

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>GSTIN / URP
                <input data-eway-field="from.gstin" aria-invalid={Boolean(fieldErrors['from.gstin'])} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.gstin || ''} onChange={(e) => updateGroup('from', 'gstin', e.target.value.toUpperCase())} placeholder="GSTIN / URP"/>
              {showFieldError('from.gstin')}
              </label>
              <label>Trade Name
                <input data-eway-field="from.tradeName" aria-invalid={Boolean(fieldErrors['from.tradeName'])} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.tradeName || ''} onChange={(e) => updateGroup('from', 'tradeName', e.target.value)} placeholder="Workshop / company"/>
              {showFieldError('from.tradeName')}
              </label>
              <label className="sm:col-span-2">Address
                <textarea data-eway-field="from.address" aria-invalid={Boolean(fieldErrors['from.address'])} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.address || ''} onChange={(e) => updateGroup('from', 'address', e.target.value)} placeholder="Dispatch address"/>
              {showFieldError('from.address')}
              </label>
              <label>Place
                <input data-eway-field="from.place" aria-invalid={Boolean(fieldErrors['from.place'])} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.place || ''} onChange={(e) => updateGroup('from', 'place', e.target.value)} placeholder="Place"/>
              {showFieldError('from.place')}
              </label>
              <label>PIN Code
                <input data-eway-field="from.pincode" aria-invalid={Boolean(fieldErrors['from.pincode'])} inputMode="numeric" maxLength={6} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.pincode || ''} onChange={(e) => updateGroup('from', 'pincode', e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="680001"/>
              {showFieldError('from.pincode')}
              </label>
              <label>State Code
                <input data-eway-field="from.stateCode" aria-invalid={Boolean(fieldErrors['from.stateCode'])} inputMode="numeric" maxLength={2} readOnly={isOutward} aria-readonly={isOutward} value={form.from?.stateCode || ''} onChange={(e) => updateGroup('from', 'stateCode', e.target.value.replace(/\D/g, '').slice(0,2))} placeholder="32"/>
              {showFieldError('from.stateCode')}
              </label>
            </div>
          </section>

          <section className="billing-card">
            <span className="billing-kicker">SECTION 2 · TO</span>
            <h3>2. Address Details · Bill To / Ship To</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>GSTIN / URP
                <input data-eway-field="to.gstin" aria-invalid={Boolean(fieldErrors['to.gstin'])} value={form.to?.gstin || ''} onChange={(e) => updateGroup('to', 'gstin', e.target.value.toUpperCase())} placeholder="GSTIN / URP"/>
              {showFieldError('to.gstin')}
              </label>
              <label>Trade Name
                <input data-eway-field="to.tradeName" aria-invalid={Boolean(fieldErrors['to.tradeName'])} value={form.to?.tradeName || ''} onChange={(e) => updateGroup('to', 'tradeName', e.target.value)} placeholder="Customer / destination"/>
              {showFieldError('to.tradeName')}
              </label>
              <label className="sm:col-span-2">Address
                <textarea data-eway-field="to.address" aria-invalid={Boolean(fieldErrors['to.address'])} value={form.to?.address || ''} onChange={(e) => updateGroup('to', 'address', e.target.value)} placeholder="Ship-to address"/>
              {showFieldError('to.address')}
              </label>
              <label>Place
                <input data-eway-field="to.place" aria-invalid={Boolean(fieldErrors['to.place'])} value={form.to?.place || ''} onChange={(e) => updateGroup('to', 'place', e.target.value)} placeholder="Place"/>
              {showFieldError('to.place')}
              </label>
              <label>PIN Code
                <input data-eway-field="to.pincode" aria-invalid={Boolean(fieldErrors['to.pincode'])} inputMode="numeric" maxLength={6} value={form.to?.pincode || ''} onChange={(e) => updateGroup('to', 'pincode', e.target.value.replace(/\D/g, '').slice(0,6))} placeholder="PIN"/>
              {showFieldError('to.pincode')}
              </label>
              <label>State Code
                <select aria-label="TO State Code" data-eway-field="to.stateCode" aria-invalid={Boolean(fieldErrors['to.stateCode'])} value={form.to?.stateCode || ''}
                  disabled={Boolean(eWayGstinStateCode(form.to?.gstin))}
                  onChange={(e) => updateGroup('to', 'stateCode', e.target.value)}>
                  <option value="">Select destination state</option>
                  {INDIA_STATES.map(([code, name]) => (
                    <option key={code} value={code}>{code} — {name}</option>
                  ))}
                </select>
                {eWayGstinStateCode(form.to?.gstin)
                  ? <small role="status">Auto-filled from customer GSTIN</small>
                  : <small>Select state for URP or customers without a registered GSTIN</small>}
                {showFieldError('to.stateCode')}
              </label>
            </div>
          </section>
        </div>

        <section className="eway-goods-card rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
          <div className="eway-goods-head mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-primary">SECTION 3</span>
              <h3 className="mt-1 text-base font-extrabold text-content">3. Goods Details</h3>
              <p className="mt-1 text-xs leading-5 text-muted">
                Add goods, HSN, quantity, taxable value and applicable GST rates.
              </p>
            </div>

            <button
              type="button"
              className="eway-add-goods inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-content shadow-sm transition hover:bg-surface-2"
              onClick={() => update('items', [...form.items, newItem()])}
            >
              <Plus size={16}/>Add Goods
            </button>
          </div>

          <div className="eway-goods-list space-y-4">
            {form.items.map((item, index) => (
              <article key={item.id} className="eway-goods-item rounded-2xl border border-line bg-surface-2 p-3 sm:p-4">
                <div className="eway-goods-item-head mb-4 flex items-center justify-between gap-3">
                  <strong className="text-[11px] font-extrabold uppercase tracking-[0.06em] text-muted">
                    Item {index + 1}
                  </strong>

                  <button
                    type="button"
                    className="eway-goods-delete grid size-9 shrink-0 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-600 transition hover:bg-red-100"
                    aria-label="Remove goods item"
                    onClick={() => update('items', form.items.filter((x) => x.id !== item.id))}
                  >
                    <Trash2 size={16}/>
                  </button>
                </div>

                <div className="eway-goods-fields grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[110px_minmax(180px,1.25fr)_minmax(180px,1.25fr)_90px_100px_150px]">
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">HSN / Item Code
                    <input
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      data-eway-field={`items.${index}.hsnCode`} aria-invalid={Boolean(fieldErrors[`items.${index}.hsnCode`])}
                      type="text"
                      inputMode="text"
                      maxLength={16}
                      value={item.hsnCode}
                      onChange={(e) => updateItem(item.id, 'hsnCode', e.target.value.replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 16))}
                      placeholder="8708 or AB12"
                    />
                    {showFieldError(`items.${index}.hsnCode`)}
                    <small className="text-muted text-[11px] leading-4">
                      Letters allowed in drafts. Official HSN for API preparation must be 2–8 digits.
                    </small>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">Product Name
                    <input
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      data-eway-field={`items.${index}.productName`} aria-invalid={Boolean(fieldErrors[`items.${index}.productName`])}
                      value={item.productName}
                      onChange={(e) => updateItem(item.id, 'productName', e.target.value)}
                      placeholder={`Item ${index + 1} name`}
                    />
                    {showFieldError(`items.${index}.productName`)}
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">Description
                    <input
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Description"
                    />
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">Quantity
                    <input
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      inputMode="decimal"
                      data-eway-field={`items.${index}.qty`} aria-invalid={Boolean(fieldErrors[`items.${index}.qty`])}
                      value={item.qty}
                      onChange={(e) => updateItem(item.id, 'qty', dec(e.target.value))}
                      placeholder="1"
                    />
                    {showFieldError(`items.${index}.qty`)}
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">Unit
                    <select
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      data-eway-field={`items.${index}.unit`} aria-invalid={Boolean(fieldErrors[`items.${index}.unit`])}
                      value={item.unit}
                      onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                    >
                      <option>PCS</option><option>SET</option><option>UNT</option><option>KGS</option><option>LTR</option><option>BOX</option><option>OTH</option>
                    </select>
                    {showFieldError(`items.${index}.unit`)}
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">Taxable Value
                    <input
                      className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content outline-none transition placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                      inputMode="decimal"
                      data-eway-field={`items.${index}.taxableValue`} aria-invalid={Boolean(fieldErrors[`items.${index}.taxableValue`])}
                      value={item.taxableValue}
                      onChange={(e) => updateItem(item.id, 'taxableValue', dec(e.target.value))}
                      placeholder="0.00"
                    />
                    {showFieldError(`items.${index}.taxableValue`)}
                  </label>
                </div>

                <div className="eway-goods-tax mt-4 rounded-xl border border-line bg-surface p-3 sm:p-4">
                  <div className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.06em] text-muted">
                    GST &amp; CESS
                  </div>
                  <div className="eway-goods-tax-grid grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">
                      GST Rate (%)
                      <select aria-label="GST rate" value={selectedItemGst(item)}
                        onChange={(e) => updateItemGst(item.id, e.target.value)}
                        className="h-11 w-full min-w-0 rounded-xl border border-line bg-surface px-3 text-sm font-medium text-content">
                        <option value="">Select GST rate</option>
                        {selectedItemGst(item).startsWith('saved:') &&
                          <option value={selectedItemGst(item)}>{eWayTotalGstRate(item)}% — saved classification</option>}
                        {taxChoices.map((choice) =>
                          <option value={choice.value} key={choice.value}>{choice.label}</option>)}
                      </select>
                    </label>
                    <label className="flex min-w-0 flex-col gap-1.5 text-xs font-semibold text-secondary">
                      CESS Rate (%)
                      <input aria-label="CESS rate" inputMode="decimal"
                        value={item.cessRate}
                        onChange={(e) => updateItem(item.id, 'cessRate', dec(e.target.value))}
                        placeholder="0" />
                    </label>
                  </div>

                </div>
              </article>
            ))}
          </div>

          <div className="eway-goods-totals mt-5 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              ['Taxable', totals.taxableValue],
              ['CGST', totals.cgst],
              ['SGST', totals.sgst],
              ['IGST', totals.igst],
              ['CESS', totals.cess]
            ].map(([label, value]) => (
              <div key={label} className="flex min-h-[88px] flex-col justify-between rounded-xl border border-line bg-surface-2 p-3">
                <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-muted">{label}</span>
                <strong className="mt-2 text-base font-black text-content">{money.format(value)}</strong>
              </div>
            ))}

            <label className="flex min-h-[88px] flex-col justify-between rounded-xl border border-line bg-surface-2 p-2.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted">
              CESS Non-Advol
              <input
                className="mt-2 h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold normal-case tracking-normal text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                inputMode="decimal"
                value={form.cessNonAdvolAmount || ''}
                onChange={(e) => update('cessNonAdvolAmount', dec(e.target.value))}
                placeholder="0.00"
              />
            </label>

            <label className="flex min-h-[88px] flex-col justify-between rounded-xl border border-line bg-surface-2 p-2.5 text-[10px] font-extrabold uppercase tracking-[0.04em] text-muted">
              Other Amount
              <input
                className="mt-2 h-10 w-full rounded-lg border border-line bg-surface px-2.5 text-sm font-semibold normal-case tracking-normal text-content outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                inputMode="decimal"
                value={form.otherAmount || ''}
                onChange={(e) => update('otherAmount', dec(e.target.value))}
                placeholder="0.00"
              />
            </label>

            <div className="flex min-h-[88px] flex-col justify-between rounded-xl border border-primary bg-primary-soft p-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.05em] text-primary">Total</span>
              <strong className="mt-2 text-lg font-black text-primary">{money.format(totals.totalValue)}</strong>
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <section className="billing-card">
            <span className="billing-kicker">SECTION 4</span>
            <h3>4. Transportation Details</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>Transporter ID / GSTIN
                <input value={form.transport.transporterId} onChange={(e) => updateGroup('transport', 'transporterId', e.target.value.toUpperCase())} placeholder="Transporter ID"/>
              </label>
              <label>Transporter Name
                <input value={form.transport.transporterName} onChange={(e) => updateGroup('transport', 'transporterName', e.target.value)} placeholder="Transporter name"/>
              </label>
              <label>Transport Document No.
                <input data-eway-field="transport.transportDocNo" aria-invalid={Boolean(fieldErrors['transport.transportDocNo'])}
                  value={form.transport.transportDocNo} onChange={(e) => updateGroup('transport', 'transportDocNo', e.target.value)} placeholder="LR / GR / RR / AWB / BL"/>
                {showFieldError('transport.transportDocNo')}
              </label>
              <label>Transport Document Date
                <input type="date" value={form.transport.transportDocDate} onChange={(e) => updateGroup('transport', 'transportDocDate', e.target.value)}/>
              </label>
            </div>
          </section>

          <section className="billing-card">
            <span className="billing-kicker">SECTION 5</span>
            <h3>5. Vehicle Details</h3>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label>Vehicle Number
                <input data-eway-field="transport.vehicleNo" aria-invalid={Boolean(fieldErrors['transport.vehicleNo'])}
                  value={form.transport.vehicleNo} onChange={(e) => updateGroup('transport', 'vehicleNo', e.target.value.toUpperCase())} placeholder="KL08AB1234"/>
                {showFieldError('transport.vehicleNo')}
              </label>
              <label>Vehicle Type
                <select value={form.transport.vehicleType || 'Regular'} onChange={(e) => updateGroup('transport', 'vehicleType', e.target.value)}>
                  <option>Regular</option>
                  <option>Over Dimensional Cargo</option>
                </select>
              </label>
              <label>Entered From
                <input value={form.enteredFrom || ''} onChange={(e) => update('enteredFrom', e.target.value.toUpperCase())} placeholder="Place"/>
              </label>
              <label>Entered By
                <input value={form.enteredBy || ''} onChange={(e) => update('enteredBy', e.target.value.toUpperCase())} placeholder="GSTIN / User"/>
              </label>
              <label>CEWB No. (optional)
                <input value={form.cewbNo || ''} onChange={(e) => update('cewbNo', e.target.value)} placeholder="—"/>
              </label>
              <label>Portal
                <input value={form.portal || '1'} onChange={(e) => update('portal', e.target.value)} placeholder="1"/>
              </label>
            </div>
          </section>
        </div>

        <section className="billing-card">
          <span className="billing-kicker">NOTES</span>
          <h3>Remarks</h3>
          <label className="!mb-0">Remarks / Notes
            <textarea value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Optional transport / goods movement remarks"/>
          </label>
        </section>
      </div>

      <div className="eway-print-only">
        <EWayBillPrint doc={form} totals={totals}/>
      </div>
      {pdfShareSheet}
    </div>
  );
}

function PartyCard({ title, data, onChange }) {
  return (
    <section className="billing-card">
      <h3>{title}</h3>
      <label>GSTIN / URP<input value={data.gstin || ''} onChange={(e) => onChange('gstin', e.target.value.toUpperCase())}/></label>
      <label>Trade Name<input value={data.tradeName || ''} onChange={(e) => onChange('tradeName', e.target.value)}/></label>
      <label>Address<textarea value={data.address || ''} onChange={(e) => onChange('address', e.target.value)}/></label>
      <label>Place<input value={data.place || ''} onChange={(e) => onChange('place', e.target.value)}/></label>
      <label>PIN Code<input inputMode="numeric" maxLength={6} value={data.pincode || ''} onChange={(e) => onChange('pincode', e.target.value.replace(/\D/g, '').slice(0,6))}/></label>
      <label>State Code<input inputMode="numeric" value={data.stateCode || ''} onChange={(e) => onChange('stateCode', e.target.value.replace(/\D/g, '').slice(0,2))}/></label>
    </section>
  );
}


function ScannableQRCode({ image, value }) {
  if (image) return <img src={image} alt="Official E-Way Bill QR" />;

  return (
    <div className="eway-code-empty">
      <strong>QR</strong>
      <span>{value ? 'QR data received — image must come from NIC/API response' : 'Available after NIC generation'}</span>
    </div>
  );
}

function ScannableBarcode({ image, value }) {
  if (image) return <img className="eway-barcode-image" src={image} alt="Official E-Way Bill barcode" />;

  return (
    <div className="eway-code-empty">
      {value ? 'Barcode image must come from NIC/API response' : 'Barcode available after NIC generation'}
    </div>
  );
}

function EWayBillPrint({ doc, totals }) {
  const plain = (value) => Number(value || 0).toFixed(2);
  const dateTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('en-IN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  const ratePart = (value) => Number(value || 0) > 0 ? Number(value).toFixed(3) : 'NE';
  const ewbReady = Boolean(doc.ewayBillNo);
  const qrImage = doc.qrCodeDataUrl || (doc.qrCodeBase64 ? `data:image/png;base64,${doc.qrCodeBase64}` : '');
  const qrValue = doc.qrCodeText || doc.ewayBillNo || '';
  const barcodeValue = doc.ewayBillNo || '';
  const barcodeImage = doc.barcodeDataUrl || (doc.barcodeBase64 ? `data:image/png;base64,${doc.barcodeBase64}` : '');

  return (
    <section className="eway-print-sheet eway-official-model">
      <div className="eway-official-top">
        <div>
          <h2>e-Way Bill</h2>
          <span className="eway-local-badge">{ewbReady ? 'API GENERATED RECORD' : 'LOCAL PREVIEW · READY FOR NIC API'}</span>
        </div>
        <div className={`eway-qr-placeholder${qrImage || qrValue ? ' has-image' : ''}`} aria-label="E-Way Bill QR">
          <ScannableQRCode value={qrValue} image={qrImage} />
        </div>
      </div>

      <div className="eway-pdf-section">
        <div className="eway-pdf-section-title">1. E-WAY BILL Details</div>
        <div className="eway-detail-grid primary">
          <div><span>eWay Bill No:</span><strong>{formatEwbNo(doc.ewayBillNo) || 'Pending NIC generation'}</strong></div>
          <div><span>Generated Date:</span><strong>{dateTime(doc.generatedAt)}</strong></div>
          <div><span>Generated By:</span><strong>{doc.generatedBy || '—'}</strong></div>
          <div><span>Valid Upto:</span><strong>{doc.validUntil || '—'}</strong></div>
        </div>
        <div className="eway-detail-grid secondary">
          <div><span>Mode:</span><strong>{doc.transport?.mode || '—'}</strong></div>
          <div><span>Approx Distance:</span><strong>{doc.transport?.distanceKm ? `${doc.transport.distanceKm}km` : '—'}</strong></div>
          <div><span>Type:</span><strong>{doc.supplyType || '—'} - {doc.subSupplyType || '—'}</strong></div>
          <div><span>Document Details:</span><strong>{doc.documentType || '—'} - {doc.documentNo || 'DRAFT'} - {doc.documentDate || '—'}</strong></div>
          <div><span>Transaction type:</span><strong>{doc.transactionType || '—'}</strong></div>
          <div><span>Portal:</span><strong>{doc.portal || '1'}</strong></div>
        </div>
      </div>

      <div className="eway-pdf-section">
        <div className="eway-pdf-section-title">2. Address Details</div>
        <div className="eway-address-grid">
          <div className="eway-address-box">
            <h4>From</h4>
            <span>GSTIN : {doc.from?.gstin || '—'}</span>
            <strong>{doc.from?.tradeName || '—'}</strong>
            <span>{doc.from?.stateCode ? `State Code: ${doc.from.stateCode}` : ''}</span>
            <b>:: Dispatch From ::</b>
            <span>{doc.from?.address || '—'}</span>
            <span>{[doc.from?.place, doc.from?.pincode].filter(Boolean).join(', ') || '—'}</span>
          </div>
          <div className="eway-address-box">
            <h4>To</h4>
            <span>GSTIN : {doc.to?.gstin || '—'}</span>
            <strong>{doc.to?.tradeName || '—'}</strong>
            <span>{doc.to?.stateCode ? `State Code: ${doc.to.stateCode}` : ''}</span>
            <b>:: Ship To ::</b>
            <span>{doc.to?.address || '—'}</span>
            <span>{[doc.to?.place, doc.to?.pincode].filter(Boolean).join(', ') || '—'}</span>
          </div>
        </div>
      </div>

      <div className="eway-pdf-section">
        <div className="eway-pdf-section-title">3. Goods Details</div>
        <div className="eway-goods-table">
          <div className="head">
            <span>HSN Code</span>
            <span>Product Name & Desc.</span>
            <span>Quantity</span>
            <span>Taxable Amount Rs.</span>
            <span>Tax Rate (C+S+I+Cess+Cess Non.Advol)</span>
          </div>
          {(doc.items || []).map((item, index) => (
            <div className="row" key={item.id || index}>
              <span>{item.hsnCode || '—'}</span>
              <span><strong>{item.productName || '—'}</strong>{item.description ? ` · ${item.description}` : ''}</span>
              <span>{plain(item.qty)}<small>{item.unit || 'PCS'}</small></span>
              <span>{plain(item.taxableValue)}</span>
              <span>{ratePart(item.cgstRate)}+{ratePart(item.sgstRate)}+{ratePart(item.igstRate)}+{ratePart(item.cessRate)}+0.00</span>
            </div>
          ))}
        </div>

        <div className="eway-tax-strip">
          <div><span>Tot. Tax'ble Amt</span><strong>{plain(totals.taxableValue)}</strong></div>
          <div><span>CGST Amt</span><strong>{plain(totals.cgst)}</strong></div>
          <div><span>SGST Amt</span><strong>{plain(totals.sgst)}</strong></div>
          <div><span>IGST Amt</span><strong>{plain(totals.igst)}</strong></div>
          <div><span>CESS Amt</span><strong>{plain(totals.cess)}</strong></div>
          <div><span>CESS Non.Advol Amt</span><strong>{plain(totals.cessNonAdvol)}</strong></div>
          <div><span>Other Amt</span><strong>{plain(totals.otherAmount)}</strong></div>
          <div><span>Total Inv.Amt</span><strong>{plain(totals.totalValue)}</strong></div>
        </div>
      </div>

      <div className="eway-pdf-section">
        <div className="eway-pdf-section-title">4. Transportation Details</div>
        <div className="eway-transport-row">
          <div><span>Transporter ID & Name :</span><strong>{[doc.transport?.transporterId, doc.transport?.transporterName].filter(Boolean).join(' · ') || '—'}</strong></div>
          <div><span>Transporter Doc. No & Date :</span><strong>{[doc.transport?.transportDocNo, doc.transport?.transportDocDate].filter(Boolean).join(' · ') || '—'}</strong></div>
        </div>
      </div>

      <div className="eway-pdf-section">
        <div className="eway-pdf-section-title">5. Vehicle Details</div>
        <div className="eway-vehicle-table">
          <div className="head">
            <span>Mode</span>
            <span>Vehicle / Trans Doc No & Dt.</span>
            <span>From</span>
            <span>Entered Date</span>
            <span>Entered By</span>
            <span>CEWB No. (If any)</span>
            <span>Multi Veh.Info (If any)</span>
            <span>Portal</span>
          </div>
          <div className="row">
            <span>{doc.transport?.mode || '—'}</span>
            <span>{doc.transport?.vehicleNo || doc.transport?.transportDocNo || '—'}</span>
            <span>{doc.enteredFrom || doc.from?.place || '—'}</span>
            <span>{dateTime(doc.generatedAt || doc.updatedAt || doc.createdAt)}</span>
            <span>{doc.enteredBy || doc.generatedBy || doc.from?.gstin || '—'}</span>
            <span>{doc.cewbNo || '-'}</span>
            <span>{doc.multiVehicleInfo || '-'}</span>
            <span>{doc.portal || '1'}</span>
          </div>
        </div>
      </div>

      <div className="eway-barcode-placeholder">
        <ScannableBarcode value={barcodeValue} image={barcodeImage} />
        <span>{formatEwbNo(doc.ewayBillNo) || 'NIC E-Way Bill barcode after generation'}</span>
      </div>

      <div className="eway-disclaimer">
        CubixGear local preview. Official E-Way Bill number, QR/barcode, generated date and validity must come from the GST/NIC API response.
      </div>
    </section>
  );
}

export default EWayBillPage;
