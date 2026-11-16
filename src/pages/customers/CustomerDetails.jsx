import { appConfirm } from '../../components/common/appDialogs';
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customer.service';
import { CustomerFormFields } from '../../components/customers/CustomerFormFields';
import {
  normalizeCustomerPhone, toCustomerFormPayload, validateCustomerContact,
} from '../../utils/customerFormModel';
import { CustomerTrackingLinkPanel } from '../../components/customers/CustomerTrackingLinkPanel';
import { CustomerWhatsAppConsent } from '../../components/customers/CustomerWhatsAppConsent';
import { CustomerCreditLedgerPanel } from '../../components/customers/CustomerCreditLedgerPanel';
import { CustomerVehicleFinancePanel } from '../../components/customers/CustomerVehicleFinancePanel';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/customer-tracking-link.css';
import { paymentService } from '../../services/payment.service';
import { financeService } from '../../services/finance.service';
import { assertFinanceAccount, financeAccountsForChannel, isFinanceAccount, accountChannel } from '../../utils/financeCashBank';
import '../../styles/customer-profile-polished.css';
import '../../styles/customer-workspace-compact.css';
import {
  activeCustomerInvoices, customerProfileFinancials, customerInvoiceLabel,
  customerInvoiceTotal, customerInvoiceBalance, customerVisitLabel,
  profileCustomerType, profileMoney,
} from './customerProfile.utils';
import { customerContactLinks } from '../../components/jobs/customerContact.utils';
import { invoiceMoney } from './customerDirectoryMoney.js';
import { buildCustomerVehicleFinances, vehicleRegistration, vehicleMakeModel, resolveCustomerVehicleId, customerProfileDate } from './customerVehicleFinancials';
import '../../styles/customer-profile-tabs.css';
import { Wallet } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { AmountInput } from '../../components/common/AmountInput';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { User, Phone, Mail, MapPin, Car, ClipboardCheck, FileText, CreditCard, Clock, Plus, Wrench, Edit, Pencil, Archive, MoreVertical, Calendar, Building, CheckCircle2, MessageSquare, Trash2, ReceiptText, ExternalLink } from "lucide-react";

export const CustomerDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const featureAccess = useFeatureAccess();
  const tabRailRef = useRef(null);

  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [toastMsg, setToastMsg] = useState('');

  // Sub-resource state
  const [vehicles, setVehicles] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [activity, setActivity] = useState([]);

  // Modals state
  const [isAddVehicleOpen, setIsAddVehicleOpen] = useState(false);
  const [isAddNoteOpen, setIsAddNoteOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const [isRecordPaymentOpen, setIsRecordPaymentOpen] = useState(false);
  const [isEditCustomerOpen, setIsEditCustomerOpen] = useState(false);
  const [editSaving, setEditSaving] = useState(false);
  const [editFormError, setEditFormError] = useState('');
  const [editFieldErrors, setEditFieldErrors] = useState({});
  const editFormRef = useRef(null);
  const [isAddDocumentOpen, setIsAddDocumentOpen] = useState(false);

  // New Vehicle form state
  const [vRegNo, setVRegNo] = useState('');
  const [vMake, setVMake] = useState('');
  const [vModel, setVModel] = useState('');
  const [vType, setVType] = useState('Car / SUV');
  const [vFuel, setVFuel] = useState('Petrol');
  const [vTransmission, setVTransmission] = useState('Manual');
  const [vYear, setVYear] = useState('');
  const [vColor, setVColor] = useState('');
  const [vVin, setVVin] = useState('');
  const [vKm, setVKm] = useState('');
  const [vNotes, setVNotes] = useState('');

  // Record Payment form state
  const [payInvoiceNo, setPayInvoiceNo] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [paymentSaving, setPaymentSaving] = useState(false);
  const [paymentError, setPaymentError] = useState('');
  const [payMethod, setPayMethod] = useState('Cash');
  const [payRef, setPayRef] = useState('');
  const [payNotes, setPayNotes] = useState('');
  const [payAccountId, setPayAccountId] = useState('');
  const [payAccounts, setPayAccounts] = useState([]);
  const [payRequestKey, setPayRequestKey] = useState(() => globalThis.crypto?.randomUUID?.() || `customer-payment-${Date.now()}`);

  useEffect(() => {
    if (!isRecordPaymentOpen) return undefined;
    let active = true;
    financeService.listAccounts().then(rows => {
      if (active) setPayAccounts(Array.isArray(rows) ? rows.filter(isFinanceAccount) : []);
    }).catch(error => {
      if (active) setPaymentError(error?.message || 'Unable to load Cash / Bank accounts.');
    });
    return () => { active = false; };
  }, [isRecordPaymentOpen]);

  // Edit Customer form state
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editType, setEditType] = useState('Individual');
  const [editCompany, setEditCompany] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editBranch, setEditBranch] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBranches, setEditBranches] = useState([]);
  const [editBranchesError, setEditBranchesError] = useState('');

  const parseNotes = noteText => String(noteText || '').split(/\n(?=\[\d{4}-\d{2}-\d{2}\] )/)
    .filter(Boolean).map((entry, index) => {
      const match = entry.match(/^\[(\d{4}-\d{2}-\d{2})\] ([\s\S]*)$/);
      return { id: index, text: match ? match[2] : entry,
        addedBy: 'Workshop team', date: match ? match[1] : '' };
    });

  // Customer Note form state
  const [newNoteText, setNewNoteText] = useState('');
  const [notesList, setNotesList] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState('Vehicle RC');
  const [docVehicle, setDocVehicle] = useState('');
  const [docExpiry, setDocExpiry] = useState('');
  const [docStatus, setDocStatus] = useState('Valid');
  const [docFileName, setDocFileName] = useState('');
  const [documentSaving, setDocumentSaving] = useState(false);

  // Service History filter state
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceVehicleFilter, setServiceVehicleFilter] = useState('All');
  const [financeVehicleFilter, setFinanceVehicleFilter] = useState('');
  const [invoiceVehicleFilter, setInvoiceVehicleFilter] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [invoicesAvailable, setInvoicesAvailable] = useState(false);
  const [vehiclesAvailable, setVehiclesAvailable] = useState(false);
  const [jobsAvailable, setJobsAvailable] = useState(false);

  useEffect(() => {
    loadCustomerData();
  }, [id]);

  const loadCustomerData = async () => {
    setLoading(true);
    try {
      const targetId = id;
      setLoadError('');
      const cust = await customerService.getCustomerById(targetId);
      if (cust) {
        setCustomer(cust);
        setEditName(cust.name || '');
        setEditPhone(normalizeCustomerPhone(cust.phone));
        setEditEmail(cust.email || '');
        setEditAddress(cust.address || '');
        setEditCity(cust.city || '');
        setEditState(cust.state || '');
        setEditPincode(cust.pincode || '');
        setEditType(profileCustomerType(cust.customerType || cust.customer_type));
        setEditCompany(cust.companyName || cust.company_name || '');
        setEditGst(cust.gstNo || cust.gstin || '');
        setEditBranch(cust.branchId || cust.branch || '');
        setEditNotes(cust.notes || '');
        setDocuments(Array.isArray(cust.documents) ? cust.documents : []);

        setNotesList(parseNotes(cust.notes));

        // A missing optional subresource must not make the entire customer profile fail.
        const loaders = [
          customerService.getCustomerVehicles(targetId),
          customerService.getCustomerJobs(targetId),
          customerService.getCustomerInvoices(targetId),
          customerService.getCustomerPayments(targetId),
          customerService.getCustomerActivity(targetId),
        ];
        const result = await Promise.allSettled(loaders);
        const rows = (index) => {
          if (result[index].status !== 'fulfilled') return [];
          const value = result[index].value;
          return Array.isArray(value) ? value : (Array.isArray(value?.results) ? value.results : []);
        };
        setVehicles(rows(0));
        setJobs(rows(1));
        setInvoices(rows(2));
        setVehiclesAvailable(result[0].status === 'fulfilled');
        setJobsAvailable(result[1].status === 'fulfilled');
        setInvoicesAvailable(result[2].status === 'fulfilled');
        setPayments(rows(3));
        setActivity(rows(4));
        if (result.some((entry) => entry.status === 'rejected')) {
          setLoadError('Some related customer records could not be loaded.');
        }
      }
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Customer profile could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const formatINR = profileMoney;

  const handleTabClick = (tabId, event) => {
    setActiveTab(tabId);
    if (event && event.currentTarget && tabRailRef.current) {
      event.currentTarget.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  };

  const handleAddVehicleSubmit = async (e) => {
    e.preventDefault();
    if (!vRegNo.trim()) return;
    const odometer = Number(String(vKm || '0').replace(/,/g, '').trim());
    if (!Number.isInteger(odometer) || odometer < 0) {
      showToast('Enter a valid nonnegative odometer reading.');
      return;
    }
    await customerService.addCustomerVehicle(customer.id, {
      regNo: vRegNo.trim(),
      make: vMake.trim(),
      model: vModel.trim(),
      fuelType: vFuel,
      transmission: vTransmission,
      year: vYear ? Number(vYear) : null,
      color: vColor.trim(),
      vin: vVin.trim(),
      kilometres: odometer,
      notes: vNotes.trim(),
    });
    showToast('New vehicle registered to customer.');
    setIsAddVehicleOpen(false);
    setVRegNo('');
    loadCustomerData();
  };

  const handleRecordPaymentSubmit = async (e) => {
    e.preventDefault();
    if (paymentSaving) return;
    const selectedInvoice = activeCustomerInvoices(invoices).find(
      (invoice) => String(invoice.id) === String(payInvoiceNo)
    );
    const amount = Number(payAmount);
    const balance = Number(selectedInvoice?.balance ?? selectedInvoice?.balanceDue);
    if (!selectedInvoice) return setPaymentError('Select an existing customer invoice.');
    try {
      assertFinanceAccount(payAccounts, payAccountId, payMethod);
    } catch (error) {
      return setPaymentError(error.message);
    }
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(balance) || amount > balance) {
      return setPaymentError('Enter a payment amount greater than zero and not exceeding the invoice balance.');
    }
    setPaymentSaving(true);
    setPaymentError('');
    try {
      await paymentService.createPayment({
        customer: customer.id,
        invoice: selectedInvoice.id,
        date: new Date().toISOString().slice(0, 10),
        method: payMethod,
        amount: amount.toFixed(2),
        reference: payRef.trim(),
        notes: payNotes.trim(),
        status: 'Completed',
        direction: 'IN',
        account: payAccountId,
        idempotency_key: payRequestKey,
      });
      setIsRecordPaymentOpen(false);
      setPayAmount('');
      setPayInvoiceNo('');
      setPayRef('');
      setPayNotes('');
      setPayAccountId('');
      setPayRequestKey(globalThis.crypto?.randomUUID?.() || `customer-payment-${Date.now()}`);
      showToast('Customer receipt linked to invoice and account ledger.');
      await loadCustomerData();
    } catch (err) {
      setPaymentError(err?.response?.data?.message || err?.response?.data?.amount?.[0]
        || err?.message || 'Unable to save payment. Please retry.');
    } finally {
      setPaymentSaving(false);
    }
  };

  useEffect(() => {
    if (!isEditCustomerOpen) return undefined;
    let active = true;
    customerService.getCustomerBranches()
      .then(rows => { if (active) setEditBranches(Array.isArray(rows) ? rows : []); })
      .catch(error => { if (active) setEditBranchesError(error?.message || 'Unable to load branches.'); });
    return () => { active = false; };
  }, [isEditCustomerOpen]);

  const editCustomerFormValues = {
    name: editName, phone: editPhone, email: editEmail,
    address: editAddress, city: editCity, state: editState,
    pincode: editPincode, customerType: editType,
    companyName: editCompany, gstNo: editGst, branch: editBranch, notes: editNotes,
  };
  const updateEditCustomerField = (field, value) => {
    const setters = {
      name: setEditName, phone: setEditPhone, email: setEditEmail,
      address: setEditAddress, city: setEditCity, state: setEditState,
      pincode: setEditPincode, customerType: setEditType,
      companyName: setEditCompany, gstNo: setEditGst,
      branch: setEditBranch, notes: setEditNotes,
    };
    setters[field]?.(value);
    setEditFieldErrors(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleEditCustomerSubmit = async (event) => {
    event.preventDefault();
    if (editSaving) return;
    const errors = validateCustomerContact(editCustomerFormValues);
    setEditFieldErrors(errors);
    if (Object.keys(errors).length) {
      setEditFormError('Enter the customer name and a valid Phone Number.');
      return;
    }
    setEditSaving(true);
    setEditFormError('');
    try {
      const updated = await customerService.updateCustomer(customer.id,
        toCustomerFormPayload(editCustomerFormValues));
      setCustomer(updated);
      showToast('Customer profile updated.');
      setIsEditCustomerOpen(false);
    } catch (error) {
      const data = error?.response?.data || error?.data;
      const fields = ['name', 'phone', 'email', 'customerType', 'companyName',
        'gstNo', 'branch', 'address', 'city', 'state', 'pincode', 'notes'];
      const aliases = {
        customer_type: 'customerType', company_name: 'companyName',
        gstin: 'gstNo', whatsapp: 'phone',
      };
      const next = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [key, value] of Object.entries(data)) {
          const field = aliases[key] || key;
          if (fields.includes(field)) {
            next[field] = Array.isArray(value) ? String(value[0]) : String(value);
          }
        }
      }
      setEditFieldErrors(next);
      setEditFormError(error?.message || 'Unable to save customer. Check the highlighted fields.');
      requestAnimationFrame(() => {
        const first = Object.keys(next)[0];
        const input = first && editFormRef.current?.querySelector('[data-customer-field="' + first + '"]');
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddNoteSubmit = async event => {
    event.preventDefault();
    if (noteSaving || !newNoteText.trim()) return;
    setNoteSaving(true);
    try {
      const datedNote = '[' + new Date().toISOString().slice(0,10) + '] ' + newNoteText.trim();
      const notes = [String(customer.notes || '').trim(), datedNote].filter(Boolean).join('\n');
      const updated = await customerService.updateCustomer(customer.id, { notes });
      setCustomer(updated);
      setNotesList(parseNotes(notes));
      setEditNotes(notes);
      setIsAddNoteOpen(false);
      setNewNoteText('');
      showToast('Customer note saved to the profile.');
    } catch (error) {
      showToast(error?.message || 'Could not save customer note.');
    } finally {
      setNoteSaving(false);
    }
  };

  const handleAddDocumentSubmit = async event => {
    event.preventDefault();
    if (documentSaving || !docName.trim()) return;
    setDocumentSaving(true);
    const nextDocument = {
      id: 'CDOC-' + Date.now(),
      name: docName.trim(),
      type: docType,
      vehicleReg: docVehicle,
      expiryDate: docExpiry,
      status: docStatus,
      fileName: docFileName.trim(),
      uploadedDate: new Date().toISOString().split('T')[0],
    };
    try {
      const nextDocuments = [nextDocument, ...documents];
      const updated = await customerService.updateCustomer(customer.id, { documents: nextDocuments });
      setCustomer(updated);
      setDocuments(Array.isArray(updated.documents) ? updated.documents : nextDocuments);
      setDocName('');
      setDocType('Vehicle RC');
      setDocVehicle('');
      setDocExpiry('');
      setDocStatus('Valid');
      setDocFileName('');
      setIsAddDocumentOpen(false);
      showToast('Document reference saved.');
    } catch (error) {
      showToast(error?.message || 'Unable to save document reference.');
    } finally {
      setDocumentSaving(false);
    }
  };

  const deleteDocument = async (documentId) => {
    if (!await appConfirm('Delete this customer document record?')) return;
    const nextDocuments = documents.filter((document) => document.id !== documentId);
    await customerService.updateCustomer(customer.id, { documents: nextDocuments });
    setDocuments(nextDocuments);
    showToast('Customer document removed.');
  };

  const handleRestoreCustomer = async () => {
    if (!customer || !await appConfirm(`Restore customer ${customer.name} to active status?`)) return;
    try {
      await customerService.restoreCustomer(customer.id);
      showToast('Customer restored.');
      await loadCustomerData();
    } catch (cause) {
      showToast(cause?.message || 'Unable to restore customer.');
    }
  };

  const handleArchiveCustomer = async () => {
    if (await appConfirm(`Are you sure you want to archive ${customer.name}? This will preserve historical records.`)) {
      await customerService.archiveCustomer(customer.id);
      showToast('Customer archived.');
      navigate('/customers');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '80px', backgroundColor: 'var(--surface-2)', borderRadius: '14px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', height: '90px' }}>
          <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: '12px' }} />
          <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: '12px' }} />
          <div style={{ backgroundColor: 'var(--surface-2)', borderRadius: '12px' }} />
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="customer-profile-unavailable">
        <h2>Customer profile unavailable</h2>
        <p>{loadError || 'The customer does not exist or you do not have access.'}</p>
        <div>
          <button type="button" onClick={loadCustomerData}>Retry</button>
        </div>
      </div>
    );
  }

  // The invoice already includes its paid and remaining balance; counting
  // separate payments again would double count receipts.
  const financeModel = buildCustomerVehicleFinances({ vehicles, jobs, invoices, invoicesAvailable });
  const { billed: totalBilled, paid: totalPaid, outstanding: totalOutstanding } = financeModel.overall;
  const finalInvoices = financeModel.finalizedInvoices;
  const invoiceForJob = job => finalInvoices.find(inv =>
    String(inv.jobId || inv.job_id || inv.sourceJobId || inv.source_job_id || '') === String(job.id));
  const openVehicleFinance = vehicleId => {
    setFinanceVehicleFilter(vehicleId || '');
    setActiveTab('finance');
    tabRailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
  const filteredInvoices = invoiceVehicleFilter
    ? invoices.filter(invoice => resolveCustomerVehicleId(invoice, vehicles, jobs) === invoiceVehicleFilter)
    : invoices;
  const filteredInvoiceTotals = customerProfileFinancials(filteredInvoices, invoicesAvailable);
  const lastVisitDate = customerVisitLabel(customer, jobs);
  const contact = customerContactLinks({ customerPhone: customer.phone, customerWhatsapp: customer.whatsapp });
  const statusLabel = String(customer.status || '').trim() || '—';
  const archived = statusLabel.toLowerCase() === 'archived';
  const payableInvoices = activeCustomerInvoices(invoices).filter(
    (inv) => Number(inv.balance ?? inv.balanceDue ?? 0) > 0
  );

  const tabs = [
    { id: 'overview', label: 'Overview', icon: User },
    { id: 'vehicles', label: `Vehicles (${vehicles.length})`, icon: Car },
    { id: 'jobs', label: `Jobs (${jobs.length})`, icon: ClipboardCheck },
    { id: 'service-history', label: 'Service History', icon: Wrench },
    { id: 'invoices', label: `Invoices (${invoices.length})`, icon: FileText },
    { id: 'finance', label: 'Finance Summary', icon: Wallet },
    { id: 'payments', label: `Payments (${payments.length})`, icon: CreditCard },
    { id: 'notes', label: `Notes (${notesList.length})`, icon: MessageSquare },
    { id: 'documents', label: `Documents (${documents.length})`, icon: FileText },
    { id: 'activity', label: 'Activity', icon: Clock }
  ];

  return (
    <div className="customer-profile-page cg-customers" style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', paddingBottom: '90px' }}>
      
      {/* TOAST FEEDBACK */}
      {toastMsg && (
        <div style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {toastMsg}
        </div>
      )}

      {loadError && <div className="customer-profile-partial-error" role="status">{loadError} <button type="button" onClick={loadCustomerData}>Retry</button></div>}

      {/* Clean customer identity header — never show a raw internal UUID. */}
      <header className="customer-profile-header customer-profile-hero">
        <div className="customer-profile-hero__main">
          <div className="customer-profile-identity">
            <div className="customer-profile-avatar" aria-hidden="true">
              {String(customer.name || 'C').trim().split(/\s+/).slice(0, 2)
                .map((name) => name.charAt(0).toUpperCase()).join('')}
            </div>
            <div className="customer-profile-identity__text">
              <div className="customer-profile-name-row">
                <h1>{customer.name || 'Customer'}</h1>
                <span className={'customer-profile-status ' + (statusLabel.toLowerCase() === 'active' ? 'is-active' : 'is-archived')}>
                  <span aria-hidden="true"/> {statusLabel}
                </span>
              </div>
              <p>
                {profileCustomerType(customer.customerType || customer.customer_type)}
                <span aria-hidden="true"> · </span>
                Last visit: {lastVisitDate}
              </p>
            </div>
          </div>

          <div className="customer-profile-actions">
            {archived && (
              <button type="button" className="customer-profile-action is-secondary" onClick={handleRestoreCustomer}>
                Restore Customer
              </button>
            )}
            <button type="button" className="customer-profile-action is-secondary"
              onClick={() => setIsEditCustomerOpen(true)}>
              <Pencil size={16} aria-hidden="true"/> Edit Profile
            </button>
            <button type="button" className="customer-profile-action is-secondary"
              disabled={archived}
              onClick={() => setIsAddVehicleOpen(true)}>
              <Car size={16} aria-hidden="true"/> Add Vehicle
            </button>
            <button type="button" className="customer-profile-action is-primary"
              disabled={archived}
              onClick={() => {
                const targetVehicle = vehicles[0] ? vehicleRegistration(vehicles[0]) : '';
                navigate('/jobs/new?customerId=' + customer.id +
                  '&customerName=' + encodeURIComponent(customer.name) +
                  '&vehicle=' + encodeURIComponent(targetVehicle));
              }}>
              <Plus size={17} aria-hidden="true"/> New Job Card
            </button>
            <button type="button" className="customer-profile-action is-icon"
              title="More customer actions" aria-label="More customer actions"
              onClick={() => setIsMoreMenuOpen(true)}>
              <MoreVertical size={18} aria-hidden="true"/>
            </button>
          </div>
        </div>

        <div className="customer-profile-hero__contacts">
          {contact.callUrl ? (
            <a className="customer-contact-action is-call" href={contact.callUrl}>
              <Phone size={16} aria-hidden="true"/>
              <span>Call</span>
              <strong>{customer.phone}</strong>
            </a>
          ) : (
            <span className="customer-contact-action is-unavailable">
              <Phone size={15} aria-hidden="true"/> No phone number
            </span>
          )}
          {contact.whatsappUrl ? (
            <a className="customer-contact-action is-whatsapp"
              href={contact.whatsappUrl} target="_blank" rel="noopener noreferrer">
              <MessageSquare size={16} aria-hidden="true"/> WhatsApp
            </a>
          ) : (
            <span className="customer-contact-action is-unavailable">
              <MessageSquare size={15} aria-hidden="true"/> WhatsApp unavailable
            </span>
          )}
          {customer.email && (
            <a className="customer-contact-action is-email" href={'mailto:' + customer.email}>
              <Mail size={15} aria-hidden="true"/>
              {customer.email}
            </a>
          )}
          {customer.branchName && (
            <span className="customer-profile-header-meta">
              <Building size={15} aria-hidden="true"/> {customer.branchName}
            </span>
          )}
          {(customer.createdAt || customer.created_at) && (
            <span className="customer-profile-header-meta">
              <Calendar size={15} aria-hidden="true"/>
              Since {new Date(customer.createdAt || customer.created_at).toLocaleDateString('en-IN')}
            </span>
          )}
        </div>
      </header>

      <section className="customer-profile-kpis" aria-label="Customer overview statistics">
        {[
          { label: 'Vehicles', value: vehiclesAvailable ? String(vehicles.length) : '—',
            icon: Car, tone: 'neutral' },
          { label: 'Job Cards', value: jobsAvailable ? String(jobs.length) : '—',
            icon: ClipboardCheck, tone: 'neutral' },
          { label: 'Invoices', value: invoicesAvailable ? String(finalInvoices.length) : '—',
            icon: FileText, tone: 'blue' },
          { label: 'Total Invoiced', value: formatINR(totalBilled), icon: ReceiptText, tone: 'blue' },
          { label: 'Received', value: formatINR(totalPaid), icon: CreditCard, tone: 'green' },
          { label: 'Outstanding', value: formatINR(totalOutstanding),
            icon: Wallet, tone: totalOutstanding > 0 ? 'danger' : 'neutral' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <div className={'customer-profile-stat is-' + item.tone} key={item.label}>
              <div className="customer-profile-stat__heading">
                <span>{item.label}</span>
                <Icon size={17} aria-hidden="true"/>
              </div>
              <strong title={item.value}>{item.value}</strong>
            </div>
          );
        })}
      </section>

      <nav className="customer-profile-tabs" aria-label="Customer details sections">
        <div ref={tabRailRef} className="customer-profile-tabs__rail scroll-hidden" role="tablist">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = activeTab === t.id;
            return (
              <button type="button" key={t.id}
                id={'customer-tab-' + t.id}
                role="tab" aria-selected={isActive}
                aria-controls={'customer-profile-sections'}
                onClick={(e) => handleTabClick(t.id, e)}
                className={isActive ? 'is-active' : ''}>
                <Icon size={16} aria-hidden="true"/>
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* TAB CONTENT PANELS */}
      <div id="customer-profile-sections" className="customer-profile-content" role="tabpanel"
        aria-labelledby={'customer-tab-' + activeTab} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 4. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="cg-profile-overview">
            <CustomerVehicleFinancePanel model={financeModel}
              mode="overview" invoicesAvailable={invoicesAvailable}
              vehiclesAvailable={vehiclesAvailable} jobsAvailable={jobsAvailable}
              onOpenFinance={openVehicleFinance}
              onViewVehicle={vehicleId => navigate('/vehicles/' + vehicleId)}
              onViewInvoice={invoiceId => navigate('/invoices/' + invoiceId)}
              onSelectVehicle={setFinanceVehicleFilter}/>
            <CustomerTrackingLinkPanel
              key={customer.id}
              customerId={customer.id}
              canManage={featureAccess.can('customers.edit')}
            />
            <CustomerWhatsAppConsent
              customerId={customer.id}
              canManage={featureAccess.can('customers.edit')}
            />
            
            {/* Detailed Profile Information */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '14px' }} className="overview-details-grid">
              <style>{`
                @media (max-width: 767px) {
                  .overview-details-grid {
                    grid-template-columns: 1fr !important;
                  }
                }
              `}</style>

              <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={16} style={{ color: 'var(--primary)' }} /> Customer & Contact Details
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Full Name</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{customer.name}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Phone Number</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{customer.phone}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Email</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{customer.email || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Customer Type</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{profileCustomerType(customer.customerType || customer.customer_type)}</strong>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <MapPin size={16} style={{ color: 'var(--primary)' }} /> Address & Workshop Details
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '13px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Address</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{customer.address || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>PIN Code</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{customer.pincode || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Company / GST</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{customer.companyName || customer.company_name || '—'} {(customer.gstNo || customer.gstin) ? `(${customer.gstNo || customer.gstin})` : ''}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: '6px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Primary Branch</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{customer.branchName || '—'}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Status</span>
                    <span style={{ color: archived ? 'var(--text-secondary)' : 'var(--text-primary)', fontWeight: '600' }}>{statusLabel}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* 17. Recent Activity Overview */}
            <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>Recent Customer Activity</h3>
                <button
                  onClick={() => setActiveTab('activity')}
                  style={{ background: 'none', border: 'none', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                >
                  View All Activity →
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {!activity.length && <p className="customer-empty">No activity recorded yet.</p>}
                {activity.slice(0, 5).map((act, idx) => (
                  <div key={idx} style={{ backgroundColor: 'var(--surface-2)', padding: '10px 12px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--primary)' }} />
                      <div>
                        <strong style={{ color: 'var(--text-primary)' }}>{act.type}</strong>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{act.desc}</div>
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{act.time || act.created_at || '—'}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VEHICLES — one customer may own multiple vehicles; amounts stay separate. */}
        {activeTab === 'vehicles' && (
          <div className="cg-profile-stack">
            <div className="cg-profile-pane-header">
              <div><h3>Linked Vehicles</h3><p>Open each vehicle or review its verified service and invoice totals.</p></div>
              <button type="button" className="cg-profile-action-primary" disabled={archived}
                onClick={() => setIsAddVehicleOpen(true)}><Plus size={16}/> Add Vehicle</button>
            </div>
            <CustomerVehicleFinancePanel model={financeModel} mode="vehicles"
              vehiclesAvailable={vehiclesAvailable} jobsAvailable={jobsAvailable}
              invoicesAvailable={invoicesAvailable}
              onOpenFinance={openVehicleFinance}
              onSelectVehicle={setFinanceVehicleFilter}
              onViewVehicle={vehicleId => navigate('/vehicles/' + vehicleId)}
              onViewInvoice={invoiceId => navigate('/invoices/' + invoiceId)}/>
          </div>
        )}

        {/* JOBS — no invented price or demo complaint fallback. */}
        {activeTab === 'jobs' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Job Card History</h3><p>Service jobs for every vehicle linked to this customer.</p></div>
              <button type="button" className="cg-profile-action-primary" disabled={archived}
                onClick={() => navigate('/jobs/new?customerId=' + customer.id)}>
                <Plus size={16}/> Create Job Card
              </button>
            </div>
            {!jobsAvailable ? <p className="cg-profile-empty">Job cards could not be loaded.</p>
              : !jobs.length ? <p className="cg-profile-empty">No job cards recorded for this customer yet.</p>
              : <div className="cg-profile-record-list">
                {jobs.map(job => {
                  const invoice = invoiceForJob(job);
                  return <article className="cg-profile-record" key={job.id}>
                    <div className="cg-profile-record-main">
                      <div className="cg-profile-record-title">
                        <strong>{job.jobNumber || 'Job Card'}</strong>
                        <span className="cg-profile-record-status">{job.status || '—'}</span>
                      </div>
                      <span>{[job.vehicleInfo, job.vehicleReg].filter(Boolean).join(' · ') || 'Vehicle unavailable'}</span>
                      <small>{customerProfileDate(job.createdDate || job.created_at)}
                        {' · '}{job.customerComplaint || 'No complaint recorded'}</small>
                    </div>
                    <div className="cg-profile-record-right">
                      <span>{invoice ? 'Finalized invoice' : 'Not yet invoiced'}</span>
                      <strong>{invoicesAvailable && invoice
                        ? formatINR(invoice.total ?? invoice.totalAmount ?? null) : '—'}</strong>
                      <button type="button" onClick={() => navigate('/jobs/' + job.id)}>
                        Open Job <ExternalLink size={14}/>
                      </button>
                    </div>
                  </article>;
                })}
              </div>}
          </section>
        )}

        {/* SERVICE HISTORY — real service records, no mock prices. */}
        {activeTab === 'service-history' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Service History</h3><p>Chronological visits, labour and parts across linked vehicles.</p></div>
              <div className="cg-profile-toolbar">
                <input type="search" aria-label="Search service history"
                  value={serviceSearch} placeholder="Job, vehicle or complaint"
                  onChange={event => setServiceSearch(event.target.value)}/>
                <select aria-label="Filter service history by vehicle"
                  value={serviceVehicleFilter} onChange={event => setServiceVehicleFilter(event.target.value)}>
                  <option value="All">All Vehicles</option>
                  {vehicles.map(vehicle => <option key={vehicle.id}
                    value={vehicleRegistration(vehicle)}>{vehicleRegistration(vehicle) || 'Vehicle'}</option>)}
                </select>
              </div>
            </div>
            {!jobsAvailable ? <p className="cg-profile-empty">Service history could not be loaded.</p>
              : (() => {
                const filtered = jobs.filter(job => {
                  const registration = String(job.vehicleReg || '');
                  const vehicleMatches = serviceVehicleFilter === 'All'
                    || registration.replace(/[\s-]/g, '').toUpperCase() === serviceVehicleFilter.replace(/[\s-]/g, '').toUpperCase();
                  const query = serviceSearch.trim().toLowerCase();
                  const textMatches = !query || [
                    job.jobNumber, registration, job.vehicleInfo, job.customerComplaint,
                  ].some(value => String(value || '').toLowerCase().includes(query));
                  return vehicleMatches && textMatches;
                });
                return filtered.length ? <div className="cg-profile-service-list">
                  {filtered.map(job => {
                    const serviceLines = job.services || job.labourRecords || [];
                    const parts = job.partsUsed || job.parts || [];
                    const issued = invoiceForJob(job);
                    return <article className="cg-profile-service-card" key={job.id}>
                      <div className="cg-profile-service-card-head">
                        <div>
                          <strong>{job.jobNumber || 'Job Card'}</strong>
                          <span>{customerProfileDate(job.createdDate || job.created_at)}
                            {' · '}{job.vehicleReg || job.vehicleInfo || 'Vehicle unavailable'}</span>
                        </div>
                        <span className="cg-profile-record-status">{job.status || '—'}</span>
                      </div>
                      <div className="cg-profile-service-columns">
                        <div><h4>Services</h4>
                          {serviceLines.length
                            ? <ul>{serviceLines.slice(0,5).map((item,index) =>
                              <li key={item.id || index}>{item.serviceName || item.service || item.name || 'Labour'}</li>)}</ul>
                            : <p>No labour items recorded</p>}
                        </div>
                        <div><h4>Parts</h4>
                          {parts.length
                            ? <ul>{parts.slice(0,5).map((item,index) =>
                              <li key={item.id || index}>{item.itemName || item.name || item.partName || 'Part'}</li>)}</ul>
                            : <p>No parts recorded</p>}
                        </div>
                      </div>
                      <div className="cg-profile-service-footer">
                        <span>{issued ? 'Finalized invoice: ' +
                          formatINR(issued.total ?? issued.totalAmount ?? null) : 'No finalized invoice'}</span>
                        <button type="button" onClick={() => navigate('/jobs/' + job.id)}>
                          Open Job <ExternalLink size={15}/>
                        </button>
                      </div>
                    </article>;
                  })}
                </div> : <p className="cg-profile-empty">
                  No service visits match the current filters.</p>;
              })()}
          </section>
        )}

        {/* INVOICES — all vehicle invoices belong to one customer ledger. */}
        {activeTab === 'invoices' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Customer Invoices</h3>
                <p>Includes invoices for all linked vehicles, plus direct customer sales.</p>
              </div>
              <button type="button" className="cg-profile-action-primary" disabled={archived}
                onClick={() => navigate('/invoices/create?customerId=' + customer.id)}>
                <Plus size={16}/> Create Invoice
              </button>
            </div>
            <div className="cg-profile-toolbar">
              <label htmlFor="cg-customer-invoice-vehicle">Vehicle</label>
              <select id="cg-customer-invoice-vehicle" value={invoiceVehicleFilter}
                onChange={event => setInvoiceVehicleFilter(event.target.value)}>
                <option value="">All Vehicles &amp; Direct Invoices</option>
                {vehicles.map(vehicle => <option value={vehicle.id} key={vehicle.id}>
                  {vehicleRegistration(vehicle) || vehicleMakeModel(vehicle)}
                </option>)}
              </select>
            </div>
            <div className="cg-profile-financial-strip">
              <div><span>Invoiced</span><strong>{formatINR(filteredInvoiceTotals.billed)}</strong></div>
              <div><span>Received</span><strong>{formatINR(filteredInvoiceTotals.paid)}</strong></div>
              <div><span>Outstanding</span><strong>{formatINR(filteredInvoiceTotals.outstanding)}</strong></div>
            </div>
            {!invoicesAvailable ? <p className="cg-profile-empty">Invoice data could not be loaded.</p>
              : !filteredInvoices.length ? <p className="cg-profile-empty">No invoices for this selection.</p>
              : <div className="cg-profile-record-list">
                {filteredInvoices.map((invoice,index) => {
                  const linkedId = resolveCustomerVehicleId(invoice, vehicles, jobs);
                  const linkedVehicle = vehicles.find(v => String(v.id) === linkedId);
                  const money = invoiceMoney(invoice);
                  return <article className="cg-profile-record" key={invoice.id || index}>
                    <div className="cg-profile-record-main">
                      <div className="cg-profile-record-title">
                        <strong>{customerInvoiceLabel(invoice)}</strong>
                        <span className="cg-profile-record-status">{invoice.status || '—'}</span>
                      </div>
                      <span>{customerProfileDate(invoice.date || invoice.created_at)}
                        {' · '}{linkedVehicle ? vehicleRegistration(linkedVehicle) : 'Direct / unlinked vehicle'}
                      </span>
                      <small>{invoice.jobCardNo || invoice.jobNumber
                        ? 'Job: ' + (invoice.jobCardNo || invoice.jobNumber) : 'Customer invoice'}</small>
                    </div>
                    <div className="cg-profile-record-money">
                      <div><span>Total</span><strong>{customerInvoiceTotal(invoice)}</strong></div>
                      <div><span>Paid</span><strong>{formatINR(money.paid)}</strong></div>
                      <div><span>Due</span><strong>{customerInvoiceBalance(invoice)}</strong></div>
                    </div>
                    {invoice.id && <button type="button" className="cg-profile-open-icon"
                      onClick={() => navigate('/invoices/' + invoice.id)}
                      aria-label={'Open invoice ' + customerInvoiceLabel(invoice)}>
                      <ExternalLink size={16}/>
                    </button>}
                  </article>;
                })}
              </div>}
          </section>
        )}

        {/* FINANCE SUMMARY — drill down from customer to vehicle, without new accounting writes. */}
        {activeTab === 'finance' && (
          <CustomerVehicleFinancePanel model={financeModel} mode="finance"
            invoicesAvailable={invoicesAvailable}
            vehiclesAvailable={vehiclesAvailable} jobsAvailable={jobsAvailable}
            selectedVehicleId={financeVehicleFilter}
            onSelectVehicle={setFinanceVehicleFilter}
            onOpenFinance={openVehicleFinance}
            onViewVehicle={vehicleId => navigate('/vehicles/' + vehicleId)}
            onViewInvoice={invoiceId => navigate('/invoices/' + invoiceId)}/>
        )}

        {/* PAYMENTS — separate receipt history; invoice paid already includes applied receipts. */}
        {activeTab === 'payments' && (
          <div className="cg-profile-stack">
            <CustomerCreditLedgerPanel customerId={customer.id} onChanged={loadCustomerData}/>
            <section className="cg-profile-pane">
              <div className="cg-profile-pane-header">
                <div><h3>Payment Records</h3>
                  <p>Actual money in/out. Payments applied to invoices are already included in the Received total.</p>
                </div>
                <button type="button" className="cg-profile-action-primary" disabled={archived}
                  onClick={() => { setPaymentError(''); setIsRecordPaymentOpen(true); }}>
                  <Plus size={16}/> Record Payment
                </button>
              </div>
              <div className="cg-profile-financial-strip">
                <div><span>Invoice Receipts</span><strong>{formatINR(totalPaid)}</strong></div>
                <div><span>Invoice Due</span><strong>{formatINR(totalOutstanding)}</strong></div>
                <div><span>Payment Records</span><strong>{payments.length}</strong></div>
              </div>
              {!payments.length ? <p className="cg-profile-empty">
                No payment receipts or refunds have been recorded yet.</p>
              : <div className="cg-profile-record-list">
                  {payments.map((payment,index) => {
                    const target = invoices.find(invoice =>
                      String(invoice.id) === String(payment.invoiceId || payment.invoice || '') ||
                      (payment.invoiceNo && customerInvoiceLabel(invoice) === payment.invoiceNo));
                    const linkedId = target ? resolveCustomerVehicleId(target, vehicles, jobs) : null;
                    const linkedVehicle = vehicles.find(v => String(v.id) === linkedId);
                    const outgoing = String(payment.direction || '').toUpperCase() === 'OUT';
                    return <article className="cg-profile-record" key={payment.id || index}>
                      <div className="cg-profile-record-main">
                        <div className="cg-profile-record-title">
                          <strong>{payment.invoiceNo || (outgoing ? 'Refund / Outgoing' : 'Customer Receipt')}</strong>
                          <span className="cg-profile-record-status">{payment.method || 'Payment'}</span>
                        </div>
                        <span>{customerProfileDate(payment.date || payment.created_at)}
                          {' · '}{linkedVehicle ? vehicleRegistration(linkedVehicle) : 'Customer level'}
                        </span>
                        <small>{payment.reference ? 'Reference: ' + payment.reference : 'No reference'}
                          {' · '}{payment.recordedBy || 'Workshop team'}</small>
                      </div>
                      <div className={'cg-profile-record-amount ' + (outgoing ? 'is-out' : 'is-in')}>
                        {outgoing ? '−' : '+'}{formatINR(payment.amount)}
                      </div>
                    </article>;
                  })}
                </div>}
            </section>
          </div>
        )}

        {/* NOTES — persisted as dated text on the customer master record. */}
        {activeTab === 'notes' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Staff Notes &amp; Preferences</h3>
                <p>Internal customer preferences saved to the customer profile.</p>
              </div>
              <button type="button" className="cg-profile-action-primary" disabled={archived}
                onClick={() => setIsAddNoteOpen(true)}><Plus size={16}/> Add Note</button>
            </div>
            {!notesList.length ? <p className="cg-profile-empty">No customer notes saved.</p>
              : <div className="cg-profile-note-list">
                  {notesList.map(note => <article className="cg-profile-note" key={note.id}>
                    <p>{note.text}</p>
                    <span>{note.addedBy}{note.date ? ' · ' + note.date : ''}</span>
                  </article>)}
                </div>}
          </section>
        )}

        {/* DOCUMENT REFERENCES — metadata only; no binary upload is implied. */}
        {activeTab === 'documents' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Customer &amp; Vehicle Documents</h3>
                <p>Record document references and expiry dates. Files are not uploaded here.</p>
              </div>
              <button type="button" className="cg-profile-action-primary" disabled={archived}
                onClick={() => setIsAddDocumentOpen(true)}><Plus size={16}/> Add Reference</button>
            </div>
            {!documents.length ? <p className="cg-profile-empty">
              No document references saved for this customer.</p>
              : <div className="cg-profile-documents">
                {documents.map(document => <article className="cg-profile-document" key={document.id}>
                  <div className="cg-profile-document-main">
                    <div className="cg-profile-document-title">
                      <FileText size={18} aria-hidden="true"/>
                      <strong>{document.name}</strong>
                      <span className="cg-profile-record-status">{document.status || '—'}</span>
                    </div>
                    <p>{document.type || 'Reference'}
                      {document.vehicleReg ? ' · ' + document.vehicleReg : ' · Customer level'}</p>
                    <div className="cg-profile-document-details">
                      <span>Recorded: {customerProfileDate(document.uploadedDate)}</span>
                      <span>Expiry: {customerProfileDate(document.expiryDate)}</span>
                      <span>File name: {document.fileName || 'Not recorded'}</span>
                    </div>
                  </div>
                  <button className="cg-profile-delete-action" type="button"
                    disabled={archived} onClick={() => deleteDocument(document.id)}>
                    <Trash2 size={15}/> Delete Record
                  </button>
                </article>)}
              </div>}
          </section>
        )}

        {/* ACTIVITY — server audit events, no invented entries. */}
        {activeTab === 'activity' && (
          <section className="cg-profile-pane">
            <div className="cg-profile-pane-header">
              <div><h3>Customer Activity</h3><p>Recorded service events and workshop updates.</p></div>
            </div>
            {!activity.length ? <p className="cg-profile-empty">
              No recorded activity for this customer.</p>
            : <div className="cg-profile-timeline">
                {activity.map((event,index) => <article className="cg-profile-event" key={event.id || index}>
                  <span className="cg-profile-event-dot" aria-hidden="true"/>
                  <div>
                    <time>{event.time || customerProfileDate(event.created_at)}</time>
                    <h4>{event.type || event.activity_type || 'Customer Activity'}</h4>
                    <p>{event.desc || event.description || '—'}</p>
                  </div>
                </article>)}
              </div>}
          </section>
        )}

      </div>

      {/* MODAL / SHEET: RECORD PAYMENT */}
      <ResponsiveModalSheet
        isOpen={isRecordPaymentOpen}
        onClose={() => setIsRecordPaymentOpen(false)}
        title="Record Customer Payment"
        maxWidth="480px"
      >
        <form onSubmit={handleRecordPaymentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {paymentError && <p className="customer-profile-form-error" role="alert">{paymentError}</p>}
          <Select label="Invoice *" value={payInvoiceNo}
            onChange={(event) => { setPayInvoiceNo(event.target.value); setPaymentError(''); }}>
            <option value="">Select unpaid invoice</option>
            {payableInvoices.map((inv) => (
              <option key={inv.id} value={inv.id}>
                {customerInvoiceLabel(inv)}
                {' · '}{(() => {
                  const matchId = resolveCustomerVehicleId(inv, vehicles, jobs);
                  const vehicle = vehicles.find(item => String(item.id) === matchId);
                  return vehicle ? vehicleRegistration(vehicle) : 'Direct / unlinked';
                })()}
                {' · Due '}{customerInvoiceBalance(inv)}
              </option>
            ))}
          </Select>
          {payableInvoices.length === 0 && (
            <p className="customer-profile-form-info">No outstanding finalized invoices to pay.</p>
          )}

          <Select label="Receive Into Account *" value={payAccountId}
            onChange={event => { setPayAccountId(event.target.value); setPaymentError(''); }}>
            <option value="">Select {payMethod} account</option>
            {financeAccountsForChannel(payAccounts, payMethod).map(account => (
              <option key={account.id} value={account.id}>
                {account.name} ({accountChannel(account.kind)})
              </option>
            ))}
          </Select>
          {!payAccounts.length && <p className="customer-profile-form-info">
            No active account available. Create an account under Finance → Bank & Cash Accounts.
          </p>}
          <AmountInput
            label="Payment Amount"
            required
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            placeholder="5000"
          />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select
              label="Payment Method"
              value={payMethod}
              onChange={(e) => { setPayMethod(e.target.value); setPayAccountId(''); }}
            >
              <option value="Cash">Cash</option>
              <option value="Bank">Bank</option>
            </Select>

            <Input
              label="Reference / Transaction ID"
              value={payRef}
              onChange={(e) => setPayRef(e.target.value)}
              placeholder="UPI/9812304/APEX"
            />
          </div>

          <Textarea
            label="Payment Notes"
            rows={2}
            value={payNotes}
            onChange={(e) => setPayNotes(e.target.value)}
            placeholder="Received advance payment..."
          />

          <button type="submit" disabled={paymentSaving || payableInvoices.length === 0 || !payAccountId}
            className="customer-profile-primary-action">
            {paymentSaving ? 'Saving Payment…' : 'Confirm & Save Payment'}
          </button>
        </form>
      </ResponsiveModalSheet>

      {/* MODAL / SHEET: ADD VEHICLE */}
      <ResponsiveModalSheet
        isOpen={isAddVehicleOpen}
        onClose={() => setIsAddVehicleOpen(false)}
        title={`Add Vehicle for ${customer.name}`}
        maxWidth="520px"
      >
        <form onSubmit={handleAddVehicleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Input label="Registration Number" required icon={Car} value={vRegNo} onChange={(e) => setVRegNo(e.target.value)} placeholder="e.g. KL 10 AB 1234" />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input label="Make" required value={vMake} onChange={(e) => setVMake(e.target.value)} placeholder="e.g. Toyota" />
            <Input label="Model" required value={vModel} onChange={(e) => setVModel(e.target.value)} placeholder="e.g. Innova" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select label="Vehicle Type" value={vType} onChange={(e) => setVType(e.target.value)}>
              <option value="Car / SUV">Car / SUV</option>
              <option value="MPV">MPV</option>
              <option value="Hatchback">Hatchback</option>
              <option value="Sedan">Sedan</option>
              <option value="Commercial Truck">Commercial Truck</option>
            </Select>

            <Select label="Fuel Type" value={vFuel} onChange={(e) => setVFuel(e.target.value)}>
              <option value="Petrol">Petrol</option>
              <option value="Diesel">Diesel</option>
              <option value="EV / Electric">EV / Electric</option>
              <option value="CNG / Hybrid">CNG / Hybrid</option>
            </Select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select label="Transmission" value={vTransmission} onChange={(e) => setVTransmission(e.target.value)}>
              <option value="Manual">Manual</option>
              <option value="Automatic">Automatic</option>
            </Select>
            <Input label="Current Kilometres" value={vKm} onChange={(e) => setVKm(e.target.value)} placeholder="e.g. 124500" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input label="Manufacturing Year" value={vYear} onChange={(e) => setVYear(e.target.value)} placeholder="e.g. 2021" />
            <Input label="VIN / Chassis Number" value={vVin} onChange={(e) => setVVin(e.target.value)} placeholder="MBJ11223344" />
          </div>

          <Textarea label="Vehicle Notes" rows={2} value={vNotes} onChange={(e) => setVNotes(e.target.value)} placeholder="Scratch on rear bumper..." />

          <button type="submit" style={{ height: '44px', borderRadius: '11px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: '700', marginTop: '6px', cursor: 'pointer' }}>
            Register & Link Vehicle
          </button>
        </form>
      </ResponsiveModalSheet>

      {/* MODAL / SHEET: EDIT CUSTOMER */}
      <ResponsiveModalSheet
        isOpen={isEditCustomerOpen}
        onClose={() => setIsEditCustomerOpen(false)}
        title="Edit Customer Profile"
        maxWidth="520px"
      >
        <form ref={editFormRef} onSubmit={handleEditCustomerSubmit}
          onInvalid={(event) => {
            event.target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            event.target?.focus();
          }}
          className="customer-profile-edit-form cg-customer-standard-form"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {editFormError && <p className="customer-profile-form-error" role="alert">{editFormError}</p>}
          <CustomerFormFields values={editCustomerFormValues}
            onChange={updateEditCustomerField}
            errors={editFieldErrors} branches={editBranches}
            branchError={editBranchesError} disabled={editSaving}/>

          <button type="submit" disabled={editSaving} style={{ height: '44px', borderRadius: '11px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: '700', marginTop: '6px', cursor: 'pointer' }}>
            {editSaving ? 'Saving…' : 'Save Profile Changes'}
          </button>
        </form>
      </ResponsiveModalSheet>

      {/* MODAL / SHEET: ADD NOTE */}
      <ResponsiveModalSheet
        isOpen={isAddNoteOpen}
        onClose={() => setIsAddNoteOpen(false)}
        title="Add Customer Preference / Note"
        maxWidth="460px"
      >
        <form onSubmit={handleAddNoteSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Textarea label="Note Details" required rows={3} value={newNoteText} onChange={(e) => setNewNoteText(e.target.value)} placeholder="e.g. Prefers evening delivery..." />
          <button type="submit" style={{ height: '44px', borderRadius: '11px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: '700', cursor: 'pointer' }}>
            Save Staff Note
          </button>
        </form>
      </ResponsiveModalSheet>

      <ResponsiveModalSheet
        isOpen={isAddDocumentOpen}
        onClose={() => setIsAddDocumentOpen(false)}
        title="Add Customer Document"
        maxWidth="520px"
      >
        <form className="customer-document-form" onSubmit={handleAddDocumentSubmit}>
          <Input label="Document Name" required value={docName} onChange={(e)=>setDocName(e.target.value)} placeholder="Toyota Innova RC"/>
          <div className="customer-document-form__grid">
            <Select label="Document Type" value={docType} onChange={(e)=>setDocType(e.target.value)}>
              <option>Vehicle RC</option>
              <option>Insurance</option>
              <option>Company Document</option>
              <option>GST / Tax Document</option>
              <option>Attachment</option>
            </Select>
            <Select label="Vehicle" value={docVehicle} onChange={(e)=>setDocVehicle(e.target.value)}>
              <option value="">Customer / Company level</option>
              {vehicles.map(vehicle => <option key={vehicle.id} value={vehicleRegistration(vehicle)}>
                  {vehicleRegistration(vehicle) || vehicleMakeModel(vehicle)}
                </option>)}
            </Select>
            <Input label="Expiry Date" type="date" value={docExpiry} onChange={(e)=>setDocExpiry(e.target.value)}/>
            <Select label="Status" value={docStatus} onChange={(e)=>setDocStatus(e.target.value)}>
              <option>Valid</option>
              <option>Expiring Soon</option>
              <option>Expired</option>
              <option>Archived</option>
            </Select>
          </div>
          <Input label="File name (reference only)" value={docFileName}
            onChange={event => setDocFileName(event.target.value)}
            placeholder="For example, insurance.pdf"/>
          <p className="cg-profile-form-note">This saves reference details and expiry information only.
            No file is uploaded or stored.</p>
          <button className="customer-document-save" type="submit" disabled={documentSaving}>
            {documentSaving ? 'Saving…' : 'Save Document Reference'}
          </button>
        </form>
      </ResponsiveModalSheet>

      {/* MODAL / SHEET: MORE ACTIONS MENU */}
      <ResponsiveModalSheet
        isOpen={isMoreMenuOpen}
        onClose={() => setIsMoreMenuOpen(false)}
        title="Customer Actions"
        maxWidth="400px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <button
            onClick={() => {
              setIsMoreMenuOpen(false);
              setIsEditCustomerOpen(true);
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <Edit size={16} /> Edit Customer Profile
          </button>

          <button
            onClick={() => {
              setIsMoreMenuOpen(false);
              navigate(`/invoices/create?customerId=${customer.id}`);
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <FileText size={16} /> Create Invoice
          </button>

          <button
            onClick={() => {
              setIsMoreMenuOpen(false);
              setPaymentError('');
              setIsRecordPaymentOpen(true);
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', fontWeight: '600', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <CreditCard size={16} /> Record Payment
          </button>

          <button
            onClick={() => {
              setIsMoreMenuOpen(false);
              handleArchiveCustomer();
            }}
            style={{ width: '100%', padding: '12px', borderRadius: '10px', border: '1px solid var(--danger-soft)', backgroundColor: 'var(--danger-soft)', color: 'var(--danger)', fontWeight: '700', textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <Archive size={16} /> Archive Customer
          </button>
        </div>
      </ResponsiveModalSheet>

    </div>
  );
};

