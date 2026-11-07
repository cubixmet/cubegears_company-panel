import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, Download, Edit3, Plus, Printer, ReceiptText, Trash2, Truck, XCircle } from "lucide-react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { billingService, blankBillingDocument, calculateDocumentTotals } from '../../services/billing.service';
import { normalizeBackendInvoiceTotals } from '../../utils/invoiceBackendTotals';
import { validateInvoiceDraft, extractInvoiceFieldErrors, formatInvoiceValidationError, invoicePreviewFailureMessage, isInvoiceBranchStateMismatch, normalizeHsnSacCode } from '../../utils/invoicePayload';
import { invoiceFieldLabel, invoiceFieldNextStep } from '../../utils/invoiceFieldHelp';
import { applyWorkshopTaxProfile, workshopInvoiceType } from '../../utils/invoiceTaxProfile';
import { formatInvoicePlaceOfSupply, invoiceStateCode, invoiceLineTaxChoices, invoiceTaxMode, invoiceChoiceFromTotalRate, workshopPlaceOfSupply } from '../../utils/invoiceTaxUi';
import '../../styles/invoice-field-validation.css';
import '../../styles/invoice-item-responsive.css';
import '../../styles/invoice-goods-services-layout.css';
import '../../styles/invoice-document-simplified.css';
import { loadDocumentTemplateSettings, resolveDocumentAppearance, templateDefaults } from '../../services/documentTemplates.service';
import '../../styles/invoice-template-sync.css';
import { customerService } from '../../services/customer.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { InvoicePdfShareSheet } from '../../components/invoices/InvoicePdfShareSheet';
import { WhatsAppManualShareButton } from '../../components/common/WhatsAppManualShareButton';
import {
  InvoiceFilterToolbar,
  InvoiceListHeader,
  InvoiceOverviewStats,
  InvoiceRecordsPanel,
  InvoiceTabs,
} from '../../components/invoices';

const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const itemTypes = ['Stock Part', 'Outside Purchase', 'Labour', 'Service', 'Consumable', 'Custom Item'];
const unitOptions = [
  ['PCS', 'PCS — Pieces'], ['NOS', 'NOS — Numbers'], ['SET', 'SET — Set'],
  ['KG', 'KG — Kilograms'], ['G', 'G — Grams'], ['LTR', 'LTR — Litres'],
  ['ML', 'ML — Millilitres'], ['MTR', 'MTR — Metres'], ['CM', 'CM — Centimetres'],
  ['BOX', 'BOX — Box'], ['PACK', 'PACK — Pack'], ['PAIR', 'PAIR — Pair'],
  ['HRS', 'HRS — Hours'], ['MIN', 'MIN — Minutes'], ['DAY', 'DAY — Days'],
  ['JOB', 'JOB — Job'], ['ROLL', 'ROLL — Roll'], ['BOTTLE', 'BOTTLE — Bottle'],
  ['BAG', 'BAG — Bag'], ['TON', 'TON — Tonnes'],
];
const emptyItem = () => ({ id: `ROW-${Date.now()}-${Math.random()}`, type: '', description: '', code: '', hsnCode: '', qty: '', unit: '', purchasePrice: '', rate: '', taxRate: '', discount: '', inventoryId: '' });
const n = (value) => Number(value || 0);
const inputNumber = (value) => (value == null ? '' : String(value));
const parseDecimal = (value) => value === '' ? '' : value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');

const resolveMode = (pathname, id) => {
  if (pathname.endsWith('/new')) return 'create';
  if (pathname.endsWith('/edit')) return 'edit';
  if (pathname.endsWith('/delete')) return 'delete';
  if (id) return 'view';
  return 'list';
};

export function InvoiceRoutePage() {
  const location = useLocation();
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const { id } = useParams();
  const mode = resolveMode(location.pathname, id);
  const kindFromUrl = new URLSearchParams(location.search).get('kind') === 'estimate' ? 'estimate' : 'invoice';

  const [documents, setDocuments] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [activeTab, setActiveTab] = useState(kindFromUrl);
  const [listQuery, setListQuery] = useState('');
  const [listStatus, setListStatus] = useState('All');
  const [form, setForm] = useState(() => blankBillingDocument(kindFromUrl, {
    emptyInputs: mode === 'create',
    jobId: new URLSearchParams(location.search).get('jobId'),
  }));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfShareInvoice, setPdfShareInvoice] = useState(null);
  const [documentAppearance, setDocumentAppearance] = useState(templateDefaults);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const invoiceEditorRef = useRef(null);
  const [attemptedSubmit, setAttemptedSubmit] = useState(0);
  const [workshopTaxProfile, setWorkshopTaxProfile] = useState(null);
  const [workshopTaxError, setWorkshopTaxError] = useState('');
  const [workshopTaxLoading, setWorkshopTaxLoading] = useState(false);
  const [workshopTaxRetry, setWorkshopTaxRetry] = useState(0);
  const newInvoiceTaxReady = mode !== 'create' || Boolean(workshopTaxProfile);
  const appliedTaxMode = invoiceTaxMode(form);
  const taxChoices = invoiceLineTaxChoices(appliedTaxMode, workshopTaxProfile?.gstRateOptions);
  const [verifiedTotals, setVerifiedTotals] = useState(null);
  const [backendPreviewError, setBackendPreviewError] = useState('');
  const [branchStateMismatch, setBranchStateMismatch] = useState(false);
  const [jobDraftWarnings, setJobDraftWarnings] = useState([]);
  const [jobDraftLoading, setJobDraftLoading] = useState(false);
  // GST/HSN gaps are shown next to their fields. Issued-stock information is
  // already accounted for by the server draft and needs no warning banner.
  const actionableJobDraftWarnings = jobDraftWarnings.filter((notice) =>
    !/^(?:Previously issued stock is shown|Verify HSN\/SAC and applicable GST for every drafted item)/i.test(String(notice))
  );
  const registrationMismatch = branchStateMismatch || Boolean(workshopTaxProfile?.registrationStateMismatch);
  const previewFingerprint = useMemo(() => JSON.stringify({
    invoiceType: form.invoiceType,
    sellerGstin: form.seller?.gstin || '',
    placeOfSupply: form.customer?.placeOfSupply || form.customer?.state || '',
    items: (form.items || []).map(({ qty, rate, discount, taxRate }) =>
      ({ qty, rate, discount, taxRate })),
    discount: form.discount, adjustment: form.adjustment, paid: form.paid,
  }), [form]);

  // After Save/Finalize or an API validation error, focus the first invalid
  // field, including an individual row in the Goods / Services list.
  useEffect(() => {
    if (!attemptedSubmit) return undefined;
    const firstField = Object.keys(fieldErrors)[0];
    const candidates = invoiceEditorRef.current?.querySelectorAll('[data-invoice-field]') || [];
    const target = Array.from(candidates).find((node) => node.dataset.invoiceField === firstField)
      || invoiceEditorRef.current?.querySelector('[aria-invalid="true"]')
      || invoiceEditorRef.current?.querySelector('[data-invoice-error-summary]');
    if (!target) return undefined;
    const frame = window.requestAnimationFrame(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      if (target.matches('input,select,textarea') && !target.readOnly && !target.disabled) target.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [attemptedSubmit, fieldErrors]);

  useEffect(() => {
    let active = true;
    loadDocumentTemplateSettings().then((next) => {
      if (active) setDocumentAppearance(next);
    }).catch(() => {
      if (active) setDocumentAppearance(templateDefaults);
    });
    return () => { active = false; };
  }, []);

  // Stock and Customers are separate paid modules. A user with Invoices
  // access must never lose the invoice screen because either lookup is denied.
  const loadReferences = async () => {
    const [stock, customerRows] = await Promise.allSettled([
      can('stock.view') ? billingService.inventory() : Promise.resolve([]),
      can('customers.view') ? customerService.getCustomers({ status: 'Active' }) : Promise.resolve([])
    ]);
    setInventory(stock.status === 'fulfilled' && Array.isArray(stock.value) ? stock.value : []);
    setCustomers(customerRows.status === 'fulfilled' && Array.isArray(customerRows.value) ? customerRows.value : []);
  };

  const loadList = async ({ withReferences = false } = {}) => {
    setLoading(true);
    try {
      // Listing invoices is a standalone invoices.view operation.
      const docs = await billingService.list();
      setDocuments(Array.isArray(docs) ? docs : []);
      if (withReferences) await loadReferences();
      else {
        setInventory([]);
        setCustomers([]);
      }
    } catch (e) {
      setError(e?.message || 'Unable to load billing data.');
    } finally {
      setLoading(false);
    }
  };

  const loadDocument = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const doc = await billingService.get(id);
      if (!doc) setError('Invoice / estimate not found.');
      else setForm(JSON.parse(JSON.stringify(doc)));
      // Viewing a document does not require Stock or Customers entitlements.
      if (mode === 'edit') await loadReferences();
      else {
        setInventory([]);
        setCustomers([]);
      }
    } catch (e) {
      setError(e?.message || 'Unable to load document.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setError('');
    setFieldErrors({});
    setActiveTab(kindFromUrl);
    if (mode === 'list') loadList();
    else if (mode === 'create') {
      setSelectedCustomerId('');
      setForm(blankBillingDocument(kindFromUrl, {
        emptyInputs: true,
        jobId: new URLSearchParams(location.search).get('jobId'),
      }));
      loadList({ withReferences: true });
    } else loadDocument();
  }, [location.pathname, location.search, id]);

  // Job Card is an explicit server-scoped link, not a browser-local draft.
  // No invoice is created until the user reviews and clicks Save Draft.
  useEffect(() => {
    const jobId = new URLSearchParams(location.search).get('jobId');
    if (mode !== 'create' || kindFromUrl !== 'invoice' || !jobId) {
      setJobDraftWarnings([]);
      setJobDraftLoading(false);
      return undefined;
    }
    let active = true;
    setJobDraftWarnings([]);
    setJobDraftLoading(true);
    billingService.getJobInvoiceDraft(jobId).then((draft) => {
      if (!active) return;
      if (draft.existingInvoiceId) {
        navigate('/invoices/' + encodeURIComponent(draft.existingInvoiceId), { replace: true });
        return;
      }
      // GSTIN, invoiceType, and applicable tax are set independently by the
      // verified workshop profile, never imported from Job Card claims.
      setForm((old) => ({
        ...old, sourceJobId: draft.jobId, jobCardNo: draft.jobNumber,
        customer: { ...old.customer, ...(draft.customer || {}) },
        vehicle: { ...old.vehicle, ...(draft.vehicle || {}) },
        items: (draft.items || []).map((item) => ({
          ...item, inventoryId: '',
        })),
        notes: draft.jobNumber ? 'Draft from Job Card ' + draft.jobNumber : old.notes,
      }));
      setJobDraftWarnings(draft.warnings || []);
    }).catch((err) => {
      if (!active) return;
      const data = err?.response?.data || {};
      setError(data?.jobId || data?.detail || err?.message ||
        'Unable to load verified Job Card charges.');
    }).finally(() => { if (active) setJobDraftLoading(false); });
    return () => { active = false; };
  }, [mode, kindFromUrl, location.search, navigate]);

  useEffect(() => {
    if (mode !== 'create') return undefined;
    let active = true;
    setWorkshopTaxProfile(null);
    setWorkshopTaxError('');
    setWorkshopTaxLoading(true);
    // Only Django Company Settings decide which invoice type is legal.
    billingService.getGstContext().then((context) => {
      if (!active) return;
      workshopInvoiceType(context);
      setWorkshopTaxProfile(context);
      setForm((old) => applyWorkshopTaxProfile({
        ...old,
        seller: {
          ...old.seller,
          name: context.companyName || old.seller?.name,
          address: [context.companyAddress, context.companyCity, context.companyPincode].filter(Boolean).join(', '),
          phone: context.companyPhone || '',
          email: context.companyEmail || '',
          state: context.companyState || '',
          stateCode: invoiceStateCode(context.supplierState) ||
            invoiceStateCode(context.gstin?.slice(0, 2)) ||
            invoiceStateCode(context.companyState),
        },
        customer: {
          ...old.customer,
          placeOfSupply: old.customer?.placeOfSupply || workshopPlaceOfSupply(context),
        },
      }, context));
    }).catch((e) => {
      if (active) setWorkshopTaxError(e?.message || 'Unable to verify workshop GST registration. Retry verification.');
    }).finally(() => {
      if (active) setWorkshopTaxLoading(false);
    });
    return () => { active = false; };
  }, [mode, location.search, workshopTaxRetry]);

  // Browser arithmetic is an immediate preview while typing. Once Django
  // answers, use its authoritative Decimal results for both item rows and totals.
  const localTotals = useMemo(() => calculateDocumentTotals(form), [form]);
  const totals = useMemo(() => {
    const fromBackend = mode === 'view' ? form.calculation : (
      verifiedTotals?.fingerprint === previewFingerprint ? verifiedTotals.data : null
    );
    return normalizeBackendInvoiceTotals(fromBackend, localTotals) || localTotals;
  }, [localTotals, form.calculation, verifiedTotals, previewFingerprint, mode]);

  useEffect(() => {
    if (!['create', 'edit'].includes(mode) || !newInvoiceTaxReady) return undefined;
    const validItems = (form.items || []).length > 0 &&
      form.items.every((row) => Number(row.qty) > 0 && Number(row.rate) >= 0 &&
        (form.invoiceType !== 'gst' || String(row.taxRate ?? '').trim() !== ''));
    const validSupply = form.invoiceType !== 'gst' ||
      Boolean(invoiceStateCode(form.customer?.placeOfSupply ||
        form.customer?.stateCode || form.customer?.state));
    if (!validItems || !validSupply) {
      setBackendPreviewError('');
      setBranchStateMismatch(false);
      return undefined;
    }
    let active = true;
    const request = window.setTimeout(() => {
      billingService.previewTotals(form).then((response) => {
        if (!active) return;
        setVerifiedTotals({ fingerprint: previewFingerprint, data: response });
        setBackendPreviewError('');
        setBranchStateMismatch(false);
      }).catch((error) => {
        if (!active) return;
        if (isInvoiceBranchStateMismatch(error)) {
          setBranchStateMismatch(true);
          setBackendPreviewError('');
        } else {
          setBranchStateMismatch(false);
          setBackendPreviewError(invoicePreviewFailureMessage(error));
        }
      });
    }, 450);
    return () => {
      active = false;
      window.clearTimeout(request);
    };
  }, [mode, newInvoiceTaxReady, previewFingerprint]);



  const activeDocuments = useMemo(
    () => documents.filter((document) => document.kind === activeTab),
    [documents, activeTab],
  );

  const listStatuses = useMemo(
    () => [...new Set(activeDocuments.map((document) => document.status).filter(Boolean))],
    [activeDocuments],
  );

  const filteredDocs = useMemo(() => {
    const search = listQuery.trim().toLowerCase();

    return activeDocuments.filter((document) => {
      const matchesStatus =
        listStatus === 'All' || document.status === listStatus;

      const matchesSearch =
        !search ||
        [
          document.number,
          document.id,
          document.customer?.name,
          document.customer?.phone,
          document.vehicle?.registration,
          document.transportation?.vehicleNo,
          document.jobCardNo,
        ].some((value) =>
          String(value || '').toLowerCase().includes(search),
        );

      return matchesStatus && matchesSearch;
    });
  }, [activeDocuments, listQuery, listStatus]);

  useEffect(() => {
    const shouldPrint = new URLSearchParams(location.search).get('print') === '1';
    if (mode !== 'view' || loading || !shouldPrint || !form?.id) return;
    const timer = window.setTimeout(() => window.print(), 250);
    return () => window.clearTimeout(timer);
  }, [mode, loading, location.search, form?.id]);

  const update = (path, value) => {
    setFieldErrors((old) => {
      if (!old[path]) return old;
      const next = { ...old };
      delete next[path];
      return next;
    });
    setForm((old) => {
      if (!path.includes('.')) return { ...old, [path]: value };
      const [group, key] = path.split('.');
      if (path === 'customer.state') {
        return { ...old, customer: {
          ...old.customer, state: value,
          placeOfSupply: formatInvoicePlaceOfSupply(value) || workshopPlaceOfSupply(workshopTaxProfile),
        } };
      }
      return { ...old, [group]: { ...old[group], [key]: value } };
    });
  };

  const formatCustomerAddress = (customer) => {
    return [
      customer?.address,
      customer?.city,
      customer?.pincode
    ].filter(Boolean).join(', ');
  };

  const selectCustomer = (customerId) => {
    setSelectedCustomerId(customerId);

    if (!customerId) {
      // Manual customer mode: keep the form editable and clear customer-linked values.
      setForm((old) => ({
        ...old,
        customer: {
          name: '',
          phone: '',
          email: '',
          address: '',
          gstin: '',
          state: '',
          stateCode: '',
          placeOfSupply: workshopPlaceOfSupply(workshopTaxProfile)
        },
        transportation: {
          ...(old.transportation || {}),
          vehicleNo: ''
        },
        vehicle: {
          registration: '',
          makeModel: '',
          odometer: '',
          vin: ''
        }
      }));
      return;
    }

    const customer = customers.find((row) => String(row.id) === String(customerId));
    if (!customer) return;
    // Autofilling an existing customer satisfies the customer identity fields.
    setFieldErrors((old) => Object.fromEntries(
      Object.entries(old).filter(([field]) => !field.startsWith('customer.'))
    ));

    const displayName = customer.companyName || customer.name || '';
    const fullAddress = formatCustomerAddress(customer);

    setForm((old) => ({
      ...old,
      customer: {
        ...(old.customer || {}),
        id: customer.id,
        name: displayName,
        phone: customer.phone || '',
        email: customer.email || '',
        address: fullAddress,
        gstin: customer.gstNo || customer.gstin || '',
        state: customer.state || '',
        stateCode: customer.stateCode || '',
        placeOfSupply: formatInvoicePlaceOfSupply(
          customer.stateCode || customer.state || workshopPlaceOfSupply(workshopTaxProfile)
        )
      }
    }));

  };

  const chooseItemGst = (rowId, selection) => {
    const item = taxChoices.find(choice => choice.value === selection);
    setForm(old => ({
      ...old,
      items: old.items.map(row => row.id === rowId ? {
        ...row, taxChoice: item?.value || '',
        taxRate: item?.totalRate || '',
      } : row),
    }));
    setFieldErrors(old => {
      const next = { ...old };
      const index = form.items.findIndex(row => row.id === rowId);
      delete next[`items.${index}.taxRate`];
      return next;
    });
  };

  const updateItem = (rowId, key, value) => {
    const rowIndex = form.items.findIndex((row) => row.id === rowId);
    const path = `items.${rowIndex}.${key}`;
    setFieldErrors((old) => {
      if (!old[path]) return old;
      const next = { ...old };
      delete next[path];
      return next;
    });
    setForm((old) => ({
      ...old,
      items: old.items.map((row) => row.id === rowId ? { ...row, [key]: value } : row)
    }));
  };

  const chooseInventory = (rowId, inventoryId) => {
    const stock = inventory.find((item) => String(item.id) === String(inventoryId));
    const index = form.items.findIndex((item) => item.id === rowId);
    if (stock && index >= 0) {
      setFieldErrors((old) => Object.fromEntries(
        Object.entries(old).filter(([field]) => ![
          'inventoryId', 'description', 'hsnCode', 'unit', 'rate', 'type',
        ].some((key) => field === `items.${index}.${key}`))
      ));
    }
    setForm((old) => ({
      ...old,
      items: old.items.map((row) => row.id === rowId ? {
        ...row,
        inventoryId,
        type: 'Stock Part',
        description: stock?.name || '',
        code: stock?.sku || '',
        hsnCode: normalizeHsnSacCode(stock?.hsnCode || stock?.hsn || ''),
        unit: stock?.unit || 'PCS',
        purchasePrice: stock?.cost ? String(stock.cost) : '',
        rate: stock?.price ? String(stock.price) : '',
        taxRate: form.invoiceType === 'gst' ? stock?.taxRate ?? 18 : 0
      } : row)
    }));
  };

  const removeInvoiceItem = (rowId) => {
    const index = form.items.findIndex((row) => row.id === rowId);
    if (index < 0) return;
    // Keep error messages attached to the correct row after index shifts.
    setFieldErrors((old) => {
      const next = {};
      Object.entries(old).forEach(([field, message]) => {
        const match = /^items\.(\d+)\.(.+)$/.exec(field);
        if (!match) { next[field] = message; return; }
        const row = Number(match[1]);
        if (row === index) return;
        next[`items.${row > index ? row - 1 : row}.${match[2]}`] = message;
      });
      return next;
    });
    setForm((old) => ({ ...old, items: old.items.filter((item) => item.id !== rowId) }));
  };

  const jumpToInvoiceField = (field) => {
    const candidates = invoiceEditorRef.current?.querySelectorAll('[data-invoice-field]') || [];
    const target = Array.from(candidates).find((node) => node.dataset.invoiceField === field)
      || (field?.startsWith('items.') ? invoiceEditorRef.current?.querySelector('[data-invoice-field="items"]') : null)
      || invoiceEditorRef.current?.querySelector('[data-invoice-error-summary]');
    if (!target) return;
    target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
    const focusTarget = target.matches('input,select,textarea,button')
      ? target : target.querySelector('input,select,textarea,button');
    if (focusTarget && !focusTarget.readOnly && !focusTarget.disabled) focusTarget.focus({ preventScroll: true });
  };

  const validate = () => {
    if (!form.date) return 'Select an invoice date.';
    if (!form.customer?.name?.trim()) return 'Customer / company name is required.';
    if (!form.items?.length) return 'Add at least one item.';
    if (form.items.some((row) => !row.type)) return 'Select an item source / type.';
    if (form.items.some((row) => !row.unit)) return 'Select a unit for every item.';
    if (form.items.some((row) => !row.description?.trim() && row.type !== 'Stock Part')) return 'Enter an item / service description.';
    if (form.invoiceType === 'gst' && form.items.some((row) => !String(row.hsnCode || '').trim())) return 'HSN / SAC is required for every GST invoice item.';
    if (form.invoiceType === 'gst' && form.items.some((row) => {
      if (!row.taxChoice) return false;
      const choice = taxChoices.find(option => option.value === row.taxChoice);
      return !choice || choice.taxMode !== appliedTaxMode ||
        Number(choice.totalRate) !== Number(row.taxRate);
    })) return 'Selected GST component conflicts with Place of Supply or the item tax rate.';
    return '';
  };

  const highlightInvalidFields = () => setAttemptedSubmit((value) => value + 1);

  const save = async () => {
    if (!newInvoiceTaxReady) {
      setError('Verify workshop GST registration before saving.');
      highlightInvalidFields();
      return;
    }
    const draft = mode === 'create' ? applyWorkshopTaxProfile(form, workshopTaxProfile) : form;
    const invalidInputs = validateInvoiceDraft(draft);
    setFieldErrors(invalidInputs);
    const validation = validate();
    if (validation || Object.keys(invalidInputs).length) {
      setError(validation || Object.values(invalidInputs)[0] || 'Correct the highlighted invoice fields before saving.');
      highlightInvalidFields();
      return;
    }
    setError('');
    setSaving(true);
    try {
      const saved = await billingService.saveDraft(draft);
      navigate(`/invoices/${saved.id}`, { replace: true });
    } catch (e) {
      setFieldErrors(extractInvoiceFieldErrors(e));
      setError(formatInvoiceValidationError(e));
      highlightInvalidFields();
    } finally {
      setSaving(false);
    }
  };

  const finalize = async () => {
    if (!newInvoiceTaxReady) {
      setError('Verify workshop GST registration before finalizing.');
      highlightInvalidFields();
      return;
    }
    const draft = mode === 'create' ? applyWorkshopTaxProfile(form, workshopTaxProfile) : form;
    const invalidInputs = validateInvoiceDraft(draft);
    setFieldErrors(invalidInputs);
    const validation = validate();
    if (validation || Object.keys(invalidInputs).length) {
      setError(validation || Object.values(invalidInputs)[0] || 'Correct the highlighted invoice fields before saving.');
      highlightInvalidFields();
      return;
    }
    setError('');
    setSaving(true);
    try {
      let current = draft;
      if (!current.id) current = await billingService.saveDraft(current);
      const done = await billingService.finalize(current.id);
      navigate(`/invoices/${done.id}`, { replace: true });
    } catch (e) {
      setFieldErrors(extractInvoiceFieldErrors(e));
      setError(formatInvoiceValidationError(e));
      highlightInvalidFields();
    } finally {
      setSaving(false);
    }
  };

  const cancelDocument = async () => {
    setSaving(true);
    try {
      const done = await billingService.cancel(id);
      setForm(done);
      navigate(`/invoices/${done.id}`, { replace: true });
    } catch (e) {
      setError(e?.message || 'Unable to cancel document.');
    } finally {
      setSaving(false);
    }
  };

  const convertEstimate = async () => {
    if (form.kind !== 'estimate' || !id) return;

    setSaving(true);
    setError('');

    try {
      const invoice = await billingService.convertEstimateToInvoice(id);
      navigate(`/invoices/${invoice.id}/edit`, { replace: true });
    } catch (e) {
      setError(e?.message || 'Unable to convert estimate to invoice.');
    } finally {
      setSaving(false);
    }
  };

  const downloadPdf = (documentToDownload) => {
    if (!documentToDownload?.id) {
      setError('Save the invoice before sharing its PDF.');
      return;
    }
    setError('');
    setPdfShareInvoice(documentToDownload);
  };
  const shareSheet = pdfShareInvoice?.id ? (
    <InvoicePdfShareSheet
      key={pdfShareInvoice.id}
      invoice={pdfShareInvoice}
      onClose={() => setPdfShareInvoice(null)}
      onLoadingChange={setPdfLoading}
    />
  ) : null;

  if (mode === 'list') return (
    <div className="billing-page billing-list-dashboard invoice-dashboard">
      <InvoiceListHeader
        activeTab={activeTab}
        onCreate={() => navigate(`/invoices/new?kind=${activeTab}`)}
      />

      <InvoiceTabs
        activeTab={activeTab}
        onChange={(kind) => {
          setListStatus('All');
          navigate(`/invoices?kind=${kind}`);
        }}
        onEWayBills={() => navigate('/invoices/e-way-bills')}
      />

      <InvoiceOverviewStats
        activeTab={activeTab}
        documents={activeDocuments}
        calculateTotals={calculateDocumentTotals}
        formatMoney={(value) => money.format(value || 0)}
      />

      <InvoiceFilterToolbar
        query={listQuery}
        onQueryChange={setListQuery}
        status={listStatus}
        onStatusChange={setListStatus}
        statuses={listStatuses}
        resultCount={filteredDocs.length}
      />

      {error && <div className="billing-error">{error}</div>}

      <InvoiceRecordsPanel
        documents={filteredDocs}
        loading={loading}
        activeTab={activeTab}
        calculateTotals={calculateDocumentTotals}
        formatMoney={(value) => money.format(value || 0)}
        onView={(document) => navigate(`/invoices/${document.id}`)}
        onPdf={(document) => downloadPdf(document)}
        onEdit={(document) => navigate(`/invoices/${document.id}/edit`)}
      />
      {shareSheet}
    </div>
  );

  if (mode === 'delete') return (
    <div className="billing-page">
      <header className="billing-page-head"><div><span className="billing-kicker">DOCUMENT HISTORY</span><h1>{form.number || id}</h1><p>Document ID: {id}</p></div></header>
      {error && <div className="billing-error">{error}</div>}
      {loading ? <div className="billing-empty">Loading…</div> : <section className="billing-card"><h3>Keep invoice audit history</h3><p>Invoice numbers, payment references and issued PDFs must remain available. Draft documents can be cancelled, but never permanently deleted.</p><div className="billing-head-actions"><button type="button" className="bill-btn secondary" onClick={() => navigate(`/invoices/${id}`)}>Back to document</button></div></section>}
    </div>
  );

  if (mode === 'view') return (
    <div className="billing-page invoice-view-page">
      <div className="billing-editor-head no-print">
        <div>
          <span className="billing-kicker">{form.kind === 'estimate' ? 'ESTIMATE / QUOTATION' : 'INVOICE'}</span>
          <h1>{form.number || id}</h1>
          <p>ID: {id} · Status: {form.status}</p>
        </div>

        <div className="billing-head-actions">
          {form.kind === "invoice" && (form.finalizedAt || ["Finalized", "Paid", "Issued"].includes(form.status)) && form.status !== "Cancelled" && <WhatsAppManualShareButton targetType="invoice" targetId={form.id || id} />}
          {form.status === 'Draft' && (
            <button className="bill-btn secondary" onClick={() => navigate(`/invoices/${id}/edit`)}>
              <Edit3 size={16}/>Edit
            </button>
          )}

          {form.kind === 'estimate' && form.status !== 'Converted' && form.status !== 'Cancelled' && (
            <button className="bill-btn" disabled={saving} onClick={convertEstimate}>
              <ReceiptText size={16}/>{saving ? 'Converting…' : 'Convert to Sale Invoice'}
            </button>
          )}

          {form.kind === 'estimate' && form.status === 'Converted' && form.convertedToInvoiceId && (
            <button className="bill-btn" onClick={() => navigate(`/invoices/${form.convertedToInvoiceId}`)}>
              <ReceiptText size={16}/>Open {form.convertedToInvoiceNo || 'Invoice'}
            </button>
          )}

          {form.kind === 'invoice' && (
            <button className="bill-btn secondary" onClick={() => navigate(`/invoices/e-way-bills/new?invoiceId=${encodeURIComponent(id)}`)}>
              <Truck size={16}/>E-Way Bill
            </button>
          )}

          <button className="bill-btn secondary" onClick={() => window.print()}>
            <Printer size={16}/>Print
          </button>
          <button className="bill-btn" type="button" disabled={loading || pdfLoading || !form.id}
            onClick={() => downloadPdf(form)}>
            <Download size={16}/>{pdfLoading ? 'Generating PDF…' : 'Download Invoice PDF'}
          </button>

          {form.status === 'Draft' && (
            <button className="bill-btn secondary" disabled={saving} onClick={cancelDocument}>
              <XCircle size={16}/>Cancel
            </button>
          )}

          {form.kind === 'invoice' && form.status !== 'Cancelled' && form.status !== 'Draft' && (
            <button type="button" className="bill-btn" onClick={() => navigate(`/payments/new?invoiceId=${encodeURIComponent(form.id || id)}`)}>
              <ReceiptText size={16}/>Record Payment
            </button>
          )}
        </div>
      </div>

      {form.kind === 'estimate' && form.status === 'Converted' && form.convertedToInvoiceId && (
        <div className="estimate-converted-banner no-print">
          <div>
            <strong>Converted to Invoice</strong>
            <span>This quotation is now linked to {form.convertedToInvoiceNo || form.convertedToInvoiceId}. No re-entry is required.</span>
          </div>
          <button className="bill-btn" onClick={() => navigate(`/invoices/${form.convertedToInvoiceId}`)}>
            Open Invoice
          </button>
        </div>
      )}

      {error && <div className="billing-error no-print">{error}</div>}
      {loading ? <div className="billing-empty">Loading…</div> : <InvoicePrint doc={form} totals={totals} appearance={resolveDocumentAppearance(form.kind, documentAppearance, form.templateSnapshot, Boolean(form.finalizedAt || ['Finalized', 'Paid', 'Issued', 'Converted'].includes(form.status)))}/>}
      {shareSheet}
    </div>
  );

  return (
    <div className="billing-page" ref={invoiceEditorRef}>
      <div className="billing-editor-head no-print">
        <div>
          <span className="billing-kicker">{form.kind === 'estimate' ? 'ESTIMATE' : 'TAX / SALES INVOICE'}</span>
          <h1>{mode === 'edit' ? `Edit ${form.number || id}` : form.kind === 'estimate' ? 'New Estimate' : 'New Invoice'}</h1>
          <p>{mode === 'edit' ? `Editing ID: ${id}` : form.invoiceType === 'gst' ? 'GST Tax Invoice based on verified Company Settings.' : 'Normal Invoice without GST, based on Company Settings.'}</p>
        </div>
        <div className="billing-head-actions">
          <button type="button" className="bill-btn secondary" onClick={() => navigate(`/invoices?kind=${form.kind === 'estimate' ? 'estimate' : 'invoice'}`)}>Back to List</button>
          <button className="bill-btn secondary" disabled={saving || jobDraftLoading || !newInvoiceTaxReady} onClick={save}>Save Draft</button>
          <button className="bill-btn secondary" type="button" disabled={!form.id || saving || pdfLoading}
            title={form.id ? 'Download saved invoice (unsaved edits are not included)' : 'Save Draft first to download PDF'}
            onClick={() => downloadPdf(form)}>
            <Download size={16}/>{pdfLoading ? 'Generating PDF…' : 'Download Saved PDF'}
          </button>
          <button className="bill-btn" disabled={saving || jobDraftLoading || !newInvoiceTaxReady} onClick={finalize}>
            <CheckCircle2 size={16}/>{form.kind === 'estimate' ? 'Issue Estimate' : 'Finalize Invoice'}
          </button>
        </div>
      </div>

      {mode === 'create' && workshopTaxLoading && <p role="status" className="billing-empty">Verifying workshop GST registration…</p>}
      {mode === 'create' && workshopTaxError && <div className="billing-error no-print" role="alert">
        {workshopTaxError}
        <button type="button" className="bill-btn secondary" onClick={() => setWorkshopTaxRetry((n) => n + 1)}>Retry Verification</button>
      </div>}
      {jobDraftLoading && <p className="billing-empty no-print" role="status">Loading verified Job Card charges…</p>}
      {actionableJobDraftWarnings.length > 0 && (
        <details className="invoice-job-review no-print" aria-label="Job Card billing review">
          <summary>Job Card review required ({actionableJobDraftWarnings.length})</summary>
          <ul>{actionableJobDraftWarnings.map((notice, index) => <li key={index}>{notice}</li>)}</ul>
        </details>
      )}
      {error && <div className="billing-error no-print" role="alert" data-invoice-error-summary>{error}</div>}
      {Object.keys(fieldErrors).length > 0 && <section className="invoice-error-checklist no-print" aria-label="Invoice fields needing correction">
        <h3>{Object.keys(fieldErrors).length} field{Object.keys(fieldErrors).length === 1 ? '' : 's'} need correction</h3>
        <p>Select any error to go directly to that field. Corrected fields disappear from the list.</p>
        <ol>{Object.entries(fieldErrors).map(([field, message]) => (
          <li key={field}>
            <button type="button" onClick={() => field === 'seller.gstin' ? navigate('/account/company') : jumpToInvoiceField(field)}>
              <strong>{invoiceFieldLabel(field)}</strong>
              <span>{message}</span>
              <small>{invoiceFieldNextStep(field)}</small>
            </button>
          </li>
        ))}</ol>
      </section>}

      {loading && mode === 'edit' ? <div className="billing-empty">Loading…</div> : <>
        <div className="invoice-source-grid invoice-source-grid--compact no-print">
          <section className="billing-card invoice-seller-card">
            <span className="billing-kicker">SELLER / FROM</span>
            <h3>Business Details</h3>
            <label>Business Name
              <input value={form.seller?.name || ''} readOnly aria-readonly="true" placeholder="Business / company name"/>
            </label>
            <label>Address
              <textarea value={form.seller?.address || ''} readOnly aria-readonly="true" placeholder="Registered / dispatch address"/>
            </label>
            <div className="invoice-two-col">
              <label>Phone
                <input value={form.seller?.phone || ''} readOnly aria-readonly="true" placeholder="+91"/>
              </label>
              <label>Email
                <input type="email" value={form.seller?.email || ''} readOnly aria-readonly="true" placeholder="accounts@example.com"/>
              </label>
            </div>
            <label>GSTIN
              <input data-invoice-field="seller.gstin" value={form.seller?.gstin || ''} readOnly aria-readonly="true" aria-invalid={Boolean(fieldErrors['seller.gstin'])} placeholder="Not GST registered"/>
              {fieldErrors['seller.gstin'] && <small className="invoice-input-error" role="alert">{fieldErrors['seller.gstin']}</small>}
            </label>
            <div className="invoice-two-col">
              <label>State
                <input value={form.seller?.state || ''} readOnly aria-readonly="true"
                  aria-invalid={registrationMismatch} placeholder="Kerala"/>
                {registrationMismatch && <small className="invoice-input-error" role="alert">
                  {workshopTaxProfile?.registrationStateMismatch
                    ? `Supplying ${workshopTaxProfile.stateSource === 'branch' ? 'branch' : 'company'} state (${workshopTaxProfile.supplyingState || 'Not specified'}) does not match the GSTIN state (${workshopTaxProfile.supplierState}).`
                    : 'Supplying branch state and company GSTIN state do not match.'}
                  {' '}
                  <button type="button" className="invoice-settings-link" onClick={() => navigate(
                    workshopTaxProfile?.stateSource === 'branch' && workshopTaxProfile?.branchId
                      ? '/account/company?branchId=' + encodeURIComponent(workshopTaxProfile.branchId) + '#workshop-branches'
                      : '/account/company#workshop-branches'
                  )}>Review branch settings</button>
                </small>}
              </label>
              <label>State Code
                <input value={form.seller?.stateCode || ''} readOnly aria-readonly="true" placeholder="32"/>
              </label>
            </div>
          </section>

          <section className="billing-card invoice-customer-card">
            <span className="billing-kicker">BILL TO</span>
            <h3>Customer Details</h3>

            <label>Phone / Existing Customer
              <select
                value={selectedCustomerId}
                onChange={(e) => selectCustomer(e.target.value)}
              >
                <option value="">New / Manual Customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.phone || 'No phone'} · {customer.companyName || customer.name}
                  </option>
                ))}
              </select>
            </label>

            {selectedCustomerId && (
              <div className="invoice-autofill-note">
                Existing customer selected — billing details are filled automatically.
              </div>
            )}

            <label>Name
              <input data-invoice-field="customer.name" aria-invalid={Boolean(fieldErrors['customer.name'])} value={form.customer?.name || ''} onChange={(e) => update('customer.name', e.target.value)} placeholder="Customer / Company name"/>
              {fieldErrors['customer.name'] && <small className="invoice-input-error" role="alert">{fieldErrors['customer.name']}</small>}
            </label>

            <label>Phone
              <input inputMode="tel" value={form.customer?.phone || ''} onChange={(e) => update('customer.phone', e.target.value)} placeholder="+91"/>
            </label>

            <label>Email
              <input type="email" value={form.customer?.email || ''} onChange={(e) => update('customer.email', e.target.value)} placeholder="customer@example.com"/>
            </label>

            <label>Address
              <textarea value={form.customer?.address || ''} onChange={(e) => update('customer.address', e.target.value)} placeholder="Billing address"/>
            </label>

            <label>GSTIN
              <input value={form.customer?.gstin || ''} onChange={(e) => update('customer.gstin', e.target.value.toUpperCase())} placeholder=""/>
            </label>

            <div className="invoice-two-col">
              <label>State
                <input value={form.customer?.state || ''} onChange={(e) => update('customer.state', e.target.value)} placeholder=""/>
              </label>

            </div>
            <div className="invoice-essential-fields">
              <label>Invoice Date
                <input data-invoice-field="date" type="date" value={form.date || ''} required aria-invalid={Boolean(fieldErrors.date)}
                  onChange={(e) => update('date', e.target.value)}/>
                {fieldErrors.date && <small className="invoice-input-error" role="alert">{fieldErrors.date}</small>}
              </label>
              <label>Place of Supply
                <input data-invoice-field="customer.placeOfSupply" aria-label="Place of Supply" value={form.customer?.placeOfSupply || ''}
                  aria-invalid={Boolean(fieldErrors['customer.placeOfSupply'])}
                  onChange={(e) => update('customer.placeOfSupply', formatInvoicePlaceOfSupply(e.target.value))}
                  placeholder="e.g. 32-Kerala" autoComplete="off"/>
                {fieldErrors['customer.placeOfSupply'] && <small className="invoice-input-error" role="alert">{fieldErrors['customer.placeOfSupply']}</small>}
              </label>
            </div>
          </section>

        </div>

        <section className="billing-card no-print billing-items-card invoice-sale-items" data-invoice-field="items">
          <div className="billing-section-head">
            <div><span className="billing-kicker">ITEMS</span><h3>Goods / Services</h3></div>
            <button className="bill-btn" onClick={() => update('items', [...form.items, emptyItem()])}><Plus size={16}/>Add Item</button>
          </div>

          <div className="invoice-sale-head">
            <span>Item Name</span>
            <span>HSN / SAC</span>
            <span>Qty</span>
            <span>Unit</span>
            <span>Price / Unit</span>
            <span>GST Rate</span>
            <span>Amount (Incl. GST)</span>
            <span></span>
          </div>

          {form.invoiceType === 'gst' && <div className="invoice-tax-summary" aria-live="polite">
            <span>{appliedTaxMode === 'cgst_sgst'
              ? 'GST · CGST + SGST'
              : appliedTaxMode === 'igst'
                ? 'GST · IGST'
                : 'GST · Rate selection available'}</span>
          </div>}
          {!form.items.length && (
            <div className="invoice-items-empty">
              <ReceiptText size={24} aria-hidden="true" />
              <strong>No goods or services added</strong>
              <p>Add an item to calculate the amount and applicable GST automatically.</p>
              <button type="button" className="bill-btn" onClick={() => update('items', [...form.items, emptyItem()])}>
                <Plus size={16}/> Add first item
              </button>
            </div>
          )}
          <div className="invoice-sale-editor">
            {form.items.map((row, index) => {
              const base = Math.max(0, n(row.qty) * n(row.rate) - n(row.discount));
              const rate = form.invoiceType === 'gst' && !['none', 'unknown'].includes(appliedTaxMode) ? n(row.taxRate) : 0;
              const lineAmount = base + (base * rate / 100);
              const linkedGstDraft = mode === 'create' && Boolean(form.sourceJobId) && form.invoiceType === 'gst';
              const hsnNeedsReview = linkedGstDraft && !String(row.hsnCode || '').trim();
              const gstNeedsReview = linkedGstDraft && (row.taxRate === '' || row.taxRate == null);

              return <div className="invoice-sale-row" key={row.id}>
                <div className="invoice-item-main-cell">
                  <div className="invoice-field-wrap invoice-item-type-field">
                    <span className="invoice-mobile-label">Type</span>
                    <select data-invoice-field={`items.${index}.type`} aria-label="Type" aria-invalid={Boolean(fieldErrors[`items.${index}.type`])} value={row.type || ''} onChange={(e) => updateItem(row.id, 'type', e.target.value)}>
                    <option value="">Select type</option>
                    {itemTypes.map((type) => <option key={type}>{type}</option>)}
                    </select>
                  {fieldErrors[`items.${index}.type`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.type`]}</small>}
                  </div>
                  <div className="invoice-field-wrap invoice-item-name-field">
                    <span className="invoice-mobile-label">{row.type === 'Stock Part' ? 'Stock item' : 'Item / Service name'}</span>
                    {row.type === 'Stock Part'
                    ? <select data-invoice-field={`items.${index}.inventoryId`} aria-label="Stock item" aria-invalid={Boolean(fieldErrors[`items.${index}.inventoryId`])} value={row.inventoryId || ''} onChange={(e) => chooseInventory(row.id, e.target.value)}>
                        <option value="">Select stock item</option>
                        {inventory.map((item) => <option key={item.id} value={item.id}>{item.name} · {item.sku} · Stock {item.onHand}</option>)}
                      </select>
                    : <input data-invoice-field={`items.${index}.description`} aria-label="Item name" aria-invalid={Boolean(fieldErrors[`items.${index}.description`])} value={row.description || ''} onChange={(e) => updateItem(row.id, 'description', e.target.value)} placeholder="Item / service name"/>
                  }
                  {fieldErrors[`items.${index}.inventoryId`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.inventoryId`]}</small>}
                  {fieldErrors[`items.${index}.description`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.description`]}</small>}
                  </div>
                </div>
                <div className="invoice-field-wrap invoice-hsn-field">
                  <span className="invoice-mobile-label">HSN / SAC</span>
                  <input data-invoice-field={`items.${index}.hsnCode`} type="text" inputMode="text" maxLength={30} autoComplete="off" aria-label="HSN or SAC code" aria-invalid={Boolean(fieldErrors[`items.${index}.hsnCode`] || hsnNeedsReview)} value={row.hsnCode ?? ''} onChange={(e) => updateItem(row.id, 'hsnCode', normalizeHsnSacCode(e.target.value))} placeholder="e.g. 998729"/>
                  {fieldErrors[`items.${index}.hsnCode`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.hsnCode`]}</small>}
                  {!fieldErrors[`items.${index}.hsnCode`] && hsnNeedsReview && <small className="invoice-input-error">HSN / SAC required</small>}
                </div>
                <div className="invoice-field-wrap invoice-qty-field">
                  <span className="invoice-mobile-label">Quantity</span>
                  <input data-invoice-field={`items.${index}.qty`} className="plain-number-input" aria-label="Quantity" aria-invalid={Boolean(fieldErrors[`items.${index}.qty`])} inputMode="decimal" value={inputNumber(row.qty)} placeholder="" onChange={(e) => updateItem(row.id, 'qty', parseDecimal(e.target.value))}/>
                  {fieldErrors[`items.${index}.qty`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.qty`]}</small>}
                </div>
                <div className="invoice-field-wrap invoice-unit-field">
                  <span className="invoice-mobile-label">Unit</span>
                  <select data-invoice-field={`items.${index}.unit`} aria-label="Unit" aria-invalid={Boolean(fieldErrors[`items.${index}.unit`])} value={row.unit || ''} onChange={(e) => updateItem(row.id, 'unit', e.target.value)}>
                  <option value="">Select unit</option>
                  {unitOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                  </select>
                  {fieldErrors[`items.${index}.unit`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.unit`]}</small>}
                </div>
                <div className="invoice-field-wrap invoice-price-field">
                  <span className="invoice-mobile-label">Price / Unit (₹)</span>
                  <input data-invoice-field={`items.${index}.rate`} className="plain-number-input" aria-label="Price per unit" aria-invalid={Boolean(fieldErrors[`items.${index}.rate`])} inputMode="decimal" value={inputNumber(row.rate)} onChange={(e) => updateItem(row.id, 'rate', parseDecimal(e.target.value))} placeholder="₹ 0.00"/>
                  {fieldErrors[`items.${index}.rate`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.rate`]}</small>}
                </div>
                <div className="invoice-field-wrap invoice-tax-field">
                  <span className="invoice-mobile-label">GST rate</span>
                  <select
                    data-invoice-field={`items.${index}.taxRate`}
                    aria-label="GST rate"
                    aria-invalid={Boolean(fieldErrors[`items.${index}.taxRate`] || gstNeedsReview)}
                    disabled={form.invoiceType !== 'gst'}
                    value={form.invoiceType === 'gst' ? invoiceChoiceFromTotalRate(
                        row.taxRate, appliedTaxMode, row.taxChoice, workshopTaxProfile?.gstRateOptions
                      ) : ''}
                      onChange={(e) => chooseItemGst(row.id, e.target.value)}
                    >
                      <option value="">{form.invoiceType !== 'gst' ? 'No GST' : 'Select GST rate'}</option>
                      {taxChoices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
                      {row.taxRate !== '' && row.taxRate != null &&
                        !taxChoices.some((choice) => Number(choice.totalRate) === Number(row.taxRate)) &&
                        <option value={`saved:${row.taxRate}`}>{row.taxRate}% — saved classification</option>}
                  </select>
                  {fieldErrors[`items.${index}.taxRate`] && <small className="invoice-input-error" role="alert">{fieldErrors[`items.${index}.taxRate`]}</small>}
                  {!fieldErrors[`items.${index}.taxRate`] && gstNeedsReview && <small className="invoice-input-error">Select applicable GST rate</small>}
                </div>
                <div className="invoice-item-amount">
                  <span className="invoice-mobile-label">Total (incl. GST)</span>
                  <strong className="billing-line-total">{money.format(totals.lineTotals[index]?.total ?? lineAmount)}</strong>
                  <div className="invoice-mobile-tax-breakdown">
                    <span>Taxable: {money.format(totals.lineTotals[index]?.taxable ?? base)}</span>
                    <span>GST: {money.format(totals.lineTotals[index]?.gst ?? (lineAmount - base))}</span>
                  </div>
                </div>
                <div className="invoice-item-row-actions">
                  <span className="invoice-mobile-item-number">Item {String(index + 1).padStart(2, '0')}</span>
                  <button type="button" aria-label={`Remove item ${index + 1}`} className="bill-icon-btn" onClick={() => removeInvoiceItem(row.id)}>
                    <Trash2 size={16}/><span className="invoice-mobile-remove-label">Remove</span>
                  </button>
                </div>
                {Object.entries(fieldErrors).filter(([field]) =>
                  field.startsWith(`items.${index}.`) && ['purchasePrice', 'discount'].includes(field.split('.').pop())
                ).map(([field, message]) => (
                  <div className="invoice-item-validation-summary" role="alert" key={field}>{field.split('.').pop()}: {message}</div>
                ))}
              </div>;
            })}
          </div>
        </section>

        <div className="invoice-bottom-grid no-print">
          <section className="billing-card">
            <span className="billing-kicker">PAYMENT & TERMS</span>
            <h3>Invoice Terms</h3>
            <div className="invoice-two-col">
              <label>GST Type (automatic)
                <input readOnly aria-readonly="true" value={appliedTaxMode === 'none' ? 'None — Normal Invoice' : appliedTaxMode === 'cgst_sgst' ? 'CGST + SGST (same-state supply)' : appliedTaxMode === 'igst' ? 'IGST (inter-state supply)' : 'GST rate ready — verify supply state before saving'} />
                <small>Tax type follows your GST registration and legal place of supply. Pick the correct HSN/SAC rate on each item.</small>
              </label>
              <label>Payment Type
                <select value={form.paymentType || ''} onChange={(e) => update('paymentType', e.target.value)}>
                  <option value="">Select payment type</option>
                  <option>Credit</option>
                  <option>Cash</option>
                  <option>Advance</option>
                </select>
              </label>
              <label>Payment Mode
                <select value={form.paymentMode || ''} onChange={(e) => update('paymentMode', e.target.value)}>
                  <option value="">Select payment mode</option>
                  <option>Cash</option><option>UPI</option><option>Card</option><option>Bank Transfer</option><option>Cheque</option>
                </select>
              </label>
              <label>Received ₹ (posted payments only)
                <input data-invoice-field="paid" className="plain-number-input" value={inputNumber(form.paid) || '0'} readOnly aria-label="Recorded payments" title="Record receipts in Customer Payments after finalizing the invoice."/>
                <small>Payments must be recorded in Customer Payments and linked to an invoice and cash/bank account. Drafts do not receive funds.</small>
              </label>
              <label>Adjustment ₹
                <input data-invoice-field="adjustment" className="plain-number-input" inputMode="decimal" aria-invalid={Boolean(fieldErrors['adjustment'])} value={form.adjustment ?? ''} onChange={(e) => update('adjustment', e.target.value === '' ? '' : parseDecimal(e.target.value))} placeholder="Auto"/>
                {fieldErrors['adjustment'] && <small className="invoice-input-error" role="alert">{fieldErrors['adjustment']}</small>}
              </label>
              <label>Discount ₹
                <input data-invoice-field="discount" className="plain-number-input" inputMode="decimal" aria-invalid={Boolean(fieldErrors['discount'])} value={inputNumber(form.discount)} onChange={(e) => update('discount', parseDecimal(e.target.value))} placeholder="0.00"/>
                {fieldErrors['discount'] && <small className="invoice-input-error" role="alert">{fieldErrors['discount']}</small>}
              </label>
            </div>
            <label>Terms and Conditions
              <textarea value={form.termsAndConditions || ''} onChange={(e) => update('termsAndConditions', e.target.value)} placeholder="Invoice terms and conditions"/>
            </label>
            <label>Notes
              <textarea value={form.notes || ''} onChange={(e) => update('notes', e.target.value)} placeholder="Optional notes"/>
            </label>
          </section>

          <section className="billing-card invoice-live-summary">
            <span className="billing-kicker">AMOUNTS</span>
            {backendPreviewError && <p className="invoice-backend-preview-error" role="status">{backendPreviewError}</p>}
            {!backendPreviewError && verifiedTotals?.fingerprint === previewFingerprint &&
              <p className="invoice-backend-preview-ok"><CheckCircle2 size={14}/> Calculated</p>}
            <h3>{form.kind === 'estimate' ? 'Estimate Summary' : 'Invoice Summary'}</h3>
            <div><span>Sub Total</span><strong>{money.format(totals.itemSubtotal)}</strong></div>
            {totals.documentDiscount > 0 && <div><span>Discount</span><strong>- {money.format(totals.documentDiscount)}</strong></div>}
            <div><span>Taxable Amount</span><strong>{money.format(totals.taxable)}</strong></div>
            {totals.taxMode === 'cgst_sgst' && <>
              <div><span>CGST (included in total)</span><strong>{money.format(totals.cgst)}</strong></div>
              <div><span>SGST (included in total)</span><strong>{money.format(totals.sgst)}</strong></div>
            </>}
            {totals.taxMode === 'igst' && <div><span>IGST (included in total)</span><strong>{money.format(totals.igst)}</strong></div>}
            <div><span>Total GST</span><strong>{money.format(totals.cgst + totals.sgst + totals.igst)}</strong></div>
            <div><span>Adjustment</span><strong>{money.format(totals.adjustment)}</strong></div>
            <div className="grand"><span>Grand Total (incl. GST)</span><strong>{money.format(totals.total)}</strong></div>
            <div><span>Received</span><strong>{money.format(totals.paid)}</strong></div>
            <div><span>Balance</span><strong>{money.format(totals.balance)}</strong></div>
          </section>
        </div>

        <InvoicePrint doc={form} totals={totals} appearance={resolveDocumentAppearance(form.kind, documentAppearance, form.templateSnapshot, Boolean(form.finalizedAt || ['Finalized', 'Paid', 'Issued', 'Converted'].includes(form.status)))}/>
      </>}
      {shareSheet}
    </div>
  );
}

function amountToIndianWords(value) {
  const number = Math.round(Number(value || 0));
  if (!number) return 'Zero Rupees only';

  const ones = ['', 'One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
  const tens = ['', '', 'Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
  const two = (n) => n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ''}`;
  const three = (n) => `${n >= 100 ? `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ' ' : ''}` : ''}${two(n % 100)}`;

  let n = number;
  const parts = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;

  if (crore) parts.push(`${three(crore)} Crore`);
  if (lakh) parts.push(`${three(lakh)} Lakh`);
  if (thousand) parts.push(`${three(thousand)} Thousand`);
  if (n) parts.push(three(n));

  return `${parts.join(' ')} Rupees only`;
}

function InvoicePrint({ doc, totals, appearance = templateDefaults }) {
  const selected = appearance.selectedTemplate || 'modern';
  const isCustom = selected === 'custom';
  const rows = doc.items || [];
  const taxGroups = totals.taxGroups || [];

  const seller = doc.seller || {};
  const sellerState = seller.stateCode && seller.state ? `${seller.stateCode}-${seller.state}` : (seller.state || '');
  const sellerName = seller.name || 'CubixGear Workshop';
  const sellerInitials = sellerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
  const documentTitle = doc.kind === 'estimate'
    ? 'Estimate / Quotation'
    : doc.invoiceType === 'gst'
      ? 'Tax Invoice'
      : 'Invoice';

  return <section className={`invoice-print-sheet invoice-sale-print invoice-reference-print invoice-creative-template invoice-style-${selected} invoice-accent-${appearance.accent || 'teal'} ${appearance.compactTable ? 'invoice-density-compact' : ''}`}>
    <div className="invoice-creative-topbar">
      <span>{appearance.showOriginal !== false ? 'ORIGINAL' : ''}</span>
      <span>{doc.status || 'Draft'}</span>
    </div>

    <div className="invoice-creative-head">
      <div className="invoice-creative-brand">
        {appearance.showBusinessLogo !== false && appearance.businessLogo
          ? <img className="invoice-creative-logo" src={appearance.businessLogo} alt="Business logo"/>
          : appearance.showSellerMark !== false && <div className="invoice-creative-mark">{sellerInitials || 'CG'}</div>}
        <div className="invoice-reference-company-copy">
          <strong>{sellerName}</strong>
          <span>{seller.address || 'Company address'}</span>
          <div className="invoice-creative-contact">
            {seller.phone && <span>Phone: {seller.phone}</span>}
            {seller.email && <span>Email: {seller.email}</span>}
          </div>
          <span>GSTIN: {seller.gstin || 'Configure GSTIN'}{sellerState ? ` · ${sellerState}` : ''}</span>
        </div>
      </div>

      <div className="invoice-creative-docmeta">
        <span>{documentTitle}</span>
        <strong>{doc.number || 'DRAFT'}</strong>
        <small>{doc.date || '—'}</small>
      </div>
    </div>

    <div className="invoice-sale-title invoice-creative-title">
      {documentTitle}
      {isCustom && appearance.customHeader &&
        (doc.kind === 'invoice' && doc.invoiceType === 'gst' || !/tax invoice/i.test(appearance.customHeader)) &&
        <small className="invoice-creative-subheading">{appearance.customHeader}</small>}
    </div>

    <div className="invoice-sale-info">
      <div>
        <strong>Bill To</strong>
        <b>{doc.customer?.name || '—'}</b>
        <span>{doc.customer?.address || '—'}</span>
        {doc.customer?.gstin && <span>GSTIN Number: {doc.customer.gstin}</span>}
        {(doc.customer?.state || doc.customer?.stateCode) && <span>State: {doc.customer?.stateCode ? `${doc.customer.stateCode}-${doc.customer?.state || ''}` : doc.customer?.state}</span>}
      </div>
      {appearance.customShowTransport !== false &&
        (doc.transportation?.vehicleNo || doc.transportation?.transporterName || doc.vehicle?.registration) && <div>
        <strong>Transportation Details</strong>
        <span>Vehicle Number: {doc.transportation?.vehicleNo || doc.vehicle?.registration || '—'}</span>
        {doc.transportation?.transporterName && <span>Transporter: {doc.transportation.transporterName}</span>}
      </div>}
      <div className="invoice-sale-info-right">
        <strong>{doc.kind === 'estimate' ? 'Estimate Details' : 'Invoice Details'}</strong>
        <span>{doc.kind === 'estimate' ? 'Estimate No.' : 'Invoice No.'}: {doc.number || 'DRAFT'}</span>
        <span>Date: {doc.date || '—'}</span>
        <span>Place of Supply: {doc.customer?.placeOfSupply || doc.customer?.state || '—'}</span>
      </div>
    </div>

    <div className="invoice-sale-table">
      <div className="invoice-sale-table-head">
        <span>#</span><span>Item Name</span><span>HSN / SAC</span><span>Quantity</span><span>Unit</span><span>Price / Unit</span><span>GST</span><span>Amount</span>
      </div>
      {rows.map((row, index) => {
        const taxable = Math.max(0, n(row.qty) * n(row.rate) - n(row.discount));
        const rate = doc.invoiceType === 'gst' && doc.taxMode !== 'none'
          ? (row.taxRate === '' || row.taxRate == null
              ? (doc.taxMode === 'igst' ? n(doc.igstRate) : n(doc.cgstRate) + n(doc.sgstRate))
              : n(row.taxRate))
          : 0;
        const tax = taxable * rate / 100;
        return <div className="invoice-sale-table-row" key={row.id || index}>
          <span>{index + 1}</span>
          <strong>{row.description || row.code || 'Item'}</strong>
          <span>{row.hsnCode || '—'}</span>
          <span>{row.qty || 0}</span>
          <span>{row.unit || 'PCS'}</span>
          <span>{money.format(n(row.rate))}</span>
          <span>{rate ? <>{money.format(tax)}<small>({rate}%)</small></> : '—'}</span>
          <strong>{money.format(totals.lineTotals[index]?.total ?? taxable + tax)}</strong>
        </div>;
      })}
      <div className="invoice-sale-table-total">
        <span></span><strong>Total</strong><span></span>
        <strong>{rows.reduce((sum,row)=>sum+n(row.qty),0)}</strong>
        <span></span><span></span>
        <strong>{money.format(totals.cgst + totals.sgst + totals.igst)}</strong>
        <strong>{money.format(totals.total - totals.adjustment)}</strong>
      </div>
    </div>

    <div className="invoice-sale-lower">
      <div className="invoice-sale-left">
        {appearance.customShowTaxTable !== false && taxGroups.length > 0 && <div className="invoice-sale-tax-table">
          <div className="head"><span>Tax type</span><span>Taxable amount</span><span>Rate</span><span>Tax amount</span></div>
          {taxGroups.map((group, index) => <div className="row" key={index}>
            <span>{group.type}</span>
            <span>{money.format(group.taxable)}</span>
            <span>{group.rate}%</span>
            <span>{money.format(group.tax)}</span>
          </div>)}
        </div>}

        <div className="invoice-sale-blue-box">
          <strong>{doc.kind === 'estimate' ? 'Estimate Amount In Words' : 'Invoice Amount In Words'}</strong>
          <span>{amountToIndianWords(totals.total)}</span>
        </div>

        <div className="invoice-sale-blue-box compact">
          <strong>Payment Type</strong>
          <span>{doc.paymentType || 'Credit'}</span>
        </div>

        {appearance.showTerms !== false && <div className="invoice-sale-blue-box">
          <strong>Terms and conditions</strong>
          <span>{doc.termsAndConditions || appearance.termsText || 'All disputes under this document will be subject to local jurisdiction.'}</span>
        </div>}
        {appearance.showBankDetails !== false && [appearance.bankName, appearance.bankAccountNumber, appearance.bankUpi].some(Boolean) && (
          <div className="invoice-sale-blue-box invoice-bank-details">
            <strong>Bank &amp; Payment Details</strong>
            <span>{[appearance.bankName, appearance.bankAccountName, appearance.bankAccountNumber, appearance.bankIfsc, appearance.bankUpi].filter(Boolean).join(' · ')}</span>
          </div>
        )}
        {isCustom && appearance.customFooter && <div className="invoice-sale-blue-box compact">
          <span>{appearance.customFooter}</span>
        </div>}
      </div>

      <div className="invoice-sale-amounts">
        <div className="title">Amounts</div>
        <div><span>Sub Total</span><strong>{money.format(totals.itemSubtotal + totals.cgst + totals.sgst + totals.igst)}</strong></div>
        <div><span>Adjustment</span><strong>{money.format(totals.adjustment)}</strong></div>
        <div className="grand"><span>Total</span><strong>{money.format(totals.total)}</strong></div>
        <div><span>Received</span><strong>{money.format(totals.paid)}</strong></div>
        <div><span>Balance</span><strong>{money.format(totals.balance)}</strong></div>
      </div>
    </div>

    {appearance.showSignature !== false && <div className="invoice-sale-sign">
      <span>For: {seller.name || 'CubixGear Workshop'}</span>
      <strong>{appearance.authorizedSignatory || 'Authorized Signatory'}</strong>
    </div>}
  </section>;
}

