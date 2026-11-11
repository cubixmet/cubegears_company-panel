import { appConfirm } from '../../components/common/appDialogs';
import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from 'react-router-dom';
import { customerService } from '../../services/customer.service';
import { CustomerTrackingLinkPanel } from '../../components/customers/CustomerTrackingLinkPanel';
import { CustomerWhatsAppConsent } from '../../components/customers/CustomerWhatsAppConsent';
import { CustomerCreditLedgerPanel } from '../../components/customers/CustomerCreditLedgerPanel';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import '../../styles/customer-tracking-link.css';
import { paymentService } from '../../services/payment.service';
import { financeService } from '../../services/finance.service';
import { assertFinanceAccount, financeAccountsForChannel, isFinanceAccount, accountChannel } from '../../utils/financeCashBank';
import '../../styles/customer-profile-polished.css';
import '../../styles/customer-workspace-compact.css';
import {
  customerProfileFinancials, activeCustomerInvoices, customerInvoiceLabel,
  customerInvoiceTotal, customerInvoiceBalance, customerVisitLabel,
  profileCustomerType, profileMoney,
} from './customerProfile.utils';
import { customerContactLinks } from '../../components/jobs/customerContact.utils';
import { Wallet } from 'lucide-react';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { AmountInput } from '../../components/common/AmountInput';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { User, Phone, Mail, MapPin, Car, ClipboardCheck, FileText, CreditCard, Clock, Plus, Wrench, Edit, Pencil, Archive, MoreVertical, Calendar, Building, CheckCircle2, MessageSquare, Trash2, Upload } from "lucide-react";

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
  const [editWhatsapp, setEditWhatsapp] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editState, setEditState] = useState('');
  const [editPincode, setEditPincode] = useState('');
  const [editType, setEditType] = useState('Individual');
  const [editCompany, setEditCompany] = useState('');
  const [editGst, setEditGst] = useState('');
  const [editBranch, setEditBranch] = useState('');

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

  // Service History filter state
  const [serviceSearch, setServiceSearch] = useState('');
  const [serviceVehicleFilter, setServiceVehicleFilter] = useState('All');
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
        setEditPhone(cust.phone || '');
        setEditWhatsapp(cust.whatsapp || cust.phone || '');
        setEditEmail(cust.email || '');
        setEditAddress(cust.address || '');
        setEditCity(cust.city || '');
        setEditState(cust.state || '');
        setEditPincode(cust.pincode || '');
        setEditType(profileCustomerType(cust.customerType || cust.customer_type));
        setEditCompany(cust.companyName || cust.company_name || '');
        setEditGst(cust.gstNo || cust.gstin || '');
        setEditBranch(cust.branchName || cust.branch || '');
        setDocuments(Array.isArray(cust.documents) ? cust.documents : []);

        setNotesList(cust.notes ? [{ id: 'customer-note', text: cust.notes, addedBy: 'Workshop team', date: cust.createdAt || '' }] : []);

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

  const handleEditCustomerSubmit = async (e) => {
    e.preventDefault();
    if (editSaving) return;
    setEditSaving(true);
    setEditFormError('');
    setEditFieldErrors({});
    try {
    const updated = await customerService.updateCustomer(customer.id, {
      name: editName,
      phone: editPhone,
      whatsapp: editWhatsapp,
      email: editEmail,
      address: editAddress,
      city: editCity,
      state: editState,
      pincode: editPincode,
      customerType: editType === 'Business' ? 'business' : 'individual',
      companyName: editCompany,
      gstin: editGst
    });
    setCustomer(updated);
    showToast('Customer profile updated.');
    setIsEditCustomerOpen(false);
    } catch (error) {
      const data = error?.response?.data || error?.data;
      const fields = ['name', 'phone', 'whatsapp', 'email', 'customerType', 'companyName', 'gstNo'];
      const aliases = { customer_type: 'customerType', company_name: 'companyName', gstin: 'gstNo' };
      const next = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        for (const [key, value] of Object.entries(data)) {
          const field = aliases[key] || key;
          if (fields.includes(field)) next[field] = Array.isArray(value) ? String(value[0]) : String(value);
        }
      }
      setEditFieldErrors(next);
      setEditFormError(error?.message || 'Unable to save customer. Check the highlighted fields.');
      requestAnimationFrame(() => {
        const first = Object.keys(next)[0];
        const input = first && editFormRef.current?.querySelector(`[data-customer-field="${first}"]`);
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddNoteSubmit = async (e) => {
    e.preventDefault();
    if (!newNoteText.trim()) return;
    const noteObj = {
      id: Date.now(),
      text: newNoteText,
      addedBy: 'Service Advisor',
      date: new Date().toISOString().replace('T', ' ').substring(0, 16)
    };
    setNotesList([noteObj, ...notesList]);
    setIsAddNoteOpen(false);
    setNewNoteText('');
    showToast('Customer note saved.');
  };

  const handleAddDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!docName.trim()) return;

    const nextDocument = {
      id: `CDOC-${Date.now()}`,
      name: docName.trim(),
      type: docType,
      vehicleReg: docVehicle,
      expiryDate: docExpiry,
      status: docStatus,
      fileName: docFileName,
      uploadedDate: new Date().toISOString().split('T')[0]
    };

    const nextDocuments = [nextDocument, ...documents];
    await customerService.updateCustomer(customer.id, { documents: nextDocuments });
    setDocuments(nextDocuments);
    setDocName('');
    setDocType('Vehicle RC');
    setDocVehicle('');
    setDocExpiry('');
    setDocStatus('Valid');
    setDocFileName('');
    setIsAddDocumentOpen(false);
    showToast('Customer document added.');
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
  const { billed: totalBilled, paid: totalPaid, outstanding: totalOutstanding } =
    customerProfileFinancials(invoices, invoicesAvailable);
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
                const targetVehicle = vehicles[0]?.regNo || '';
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
          { label: 'Invoices', value: invoicesAvailable ? String(activeCustomerInvoices(invoices).length) : '—',
            icon: FileText, tone: 'blue' },
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
      <div id="customer-profile-sections" className="customer-profile-content" style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        
        {/* 4. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                    <span style={{ color: 'var(--text-muted)' }}>WhatsApp</span>
                    <strong style={{ color: 'var(--success)' }}>{customer.whatsapp || customer.phone || '—'}</strong>
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
                    <span style={{ color: 'var(--text-muted)' }}>City / State</span>
                    <strong style={{ color: 'var(--text-primary)' }}>{[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ') || '—'}</strong>
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

        {/* 6. VEHICLES TAB */}
        {activeTab === 'vehicles' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Linked Vehicles</h3>
                    </div>
              <button
                onClick={() => setIsAddVehicleOpen(true)}
                style={{ height: '38px', padding: '0 14px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Add Vehicle
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {vehicles.map((v) => (
                <div key={v.id} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <span style={{ fontSize: '15px', fontWeight: '800', color: 'var(--primary)' }}>{v.regNo}</span>
                      <h4 style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', margin: '2px 0 0 0' }}>{v.makeModel}</h4>
                    </div>
                    <span style={{ fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                      {v.fuelType}
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>
                    <div>Type: <strong style={{ color: 'var(--text-primary)' }}>{v.vehicleType}</strong></div>
                    <div>Trans: <strong style={{ color: 'var(--text-primary)' }}>{v.transmission}</strong></div>
                    <div>Year: <strong style={{ color: 'var(--text-primary)' }}>{v.year}</strong></div>
                    <div>Current KM: <strong style={{ color: 'var(--text-primary)' }}>{v.kilometres || '—'}</strong></div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                    <button
                      onClick={() => navigate(`/vehicles/${v.id}`)}
                      style={{ flex: 1, height: '34px', borderRadius: '8px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      View Vehicle
                    </button>
                    <button
                      onClick={() => navigate(`/jobs/new?customerId=${customer.id}&vehicle=${encodeURIComponent(v.regNo)}`)}
                      style={{ flex: 1, height: '34px', borderRadius: '8px', border: 'none', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)', fontSize: '12px', fontWeight: '700', cursor: 'pointer' }}
                    >
                      Create Job
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 7. JOBS TAB */}
        {activeTab === 'jobs' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Job Card History</h3>
                
              </div>
              <button
                onClick={() => navigate(`/jobs/new?customerId=${customer.id}`)}
                style={{ height: '38px', padding: '0 14px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Create Job Card
              </button>
            </div>

            {/* Cards for Mobile & Desktop */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {jobs.map((j) => (
                <div
                  key={j.id}
                  onClick={() => navigate(`/jobs/${j.id}`)}
                  style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', cursor: 'pointer', transition: 'border-color 160ms ease' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{j.jobNumber}</strong>
                      <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '6px', backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' }}>
                        {j.status}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      {j.vehicleInfo || j.vehicleReg} ({j.vehicleReg})
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      Date: {j.createdDate} • Complaint: {j.customerComplaint || 'Engine vibration'}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '4px', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: j.paymentStatus === 'Paid' ? 'var(--success)' : 'var(--warning)' }}>
                      {j.paymentStatus || 'Partially Paid'}
                    </span>
                    <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{formatINR(j.billing?.invoiceTotal || 12500)}</strong>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/jobs/${j.id}`);
                      }}
                      style={{ padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)', backgroundColor: 'var(--surface)', color: 'var(--primary)', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', marginTop: '2px' }}
                    >
                      View Job
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 8. SERVICE HISTORY TAB */}
        {activeTab === 'service-history' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Chronological Service History</h3>
                
              </div>

              {/* Filters Toolbar */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Select
                  value={serviceVehicleFilter}
                  onChange={(e) => setServiceVehicleFilter(e.target.value)}
                  containerStyle={{ width: '180px' }}
                >
                  <option value="All">All Vehicles</option>
                  {vehicles.map(v => <option key={v.id} value={v.regNo}>{v.regNo}</option>)}
                </Select>
              </div>
            </div>

            {/* Timeline Cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {jobs
                .filter(j => serviceVehicleFilter === 'All' || j.vehicleReg === serviceVehicleFilter)
                .map((j) => (
                  <div key={j.id} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Calendar size={15} style={{ color: 'var(--primary)' }} />
                        <strong style={{ fontSize: '13.5px', color: 'var(--text-primary)' }}>{j.createdDate}</strong>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>• {j.vehicleInfo || 'Toyota Innova'} ({j.vehicleReg})</span>
                      </div>
                      <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--primary)' }}>{j.jobNumber}</span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', fontSize: '12.5px' }}>
                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11.5px', marginBottom: '4px' }}>Services Performed:</strong>
                        <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-primary)' }}>
                          {(j.services?.length ? j.services : j.labourRecords || []).slice(0, 5).map((service, index) => (
                            <li key={service.id || index}>{service.serviceName || service.service || 'Workshop labour'}</li>
                          ))}
                          {!(j.services?.length || j.labourRecords?.length) ? <li>No labour items recorded</li> : null}
                        </ul>
                      </div>

                      <div>
                        <strong style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '11.5px', marginBottom: '4px' }}>Parts Installed:</strong>
                        <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--text-primary)' }}>
                          {(j.partsUsed || []).slice(0, 5).map((part, index) => (
                            <li key={part.id || index}>{part.name || part.partName || 'Part'}</li>
                          ))}
                          {!j.partsUsed?.length ? <li>No replacement parts recorded</li> : null}
                        </ul>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)', paddingTop: '8px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                      <div>Technician: <strong style={{ color: 'var(--text-primary)' }}>{j.serviceAdvisor || j.assignedEmployeeName || '—'}</strong></div>
                      <div>
                        Labour: <strong>{formatINR((j.labourRecords || []).reduce((sum, item) => sum + Number(item.customerCharge || 0), 0))}</strong> • Parts: <strong>{formatINR((j.partsUsed || []).reduce((sum, item) => sum + Number(item.total || (Number(item.qty || 0) * Number(item.unitPrice || 0))), 0))}</strong> • <strong style={{ color: 'var(--primary)', fontSize: '14px' }}>Total: {formatINR(j.billing?.invoiceTotal || j.estimates?.at(-1)?.grandTotal || 0)}</strong>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 9. INVOICES TAB & 10. FINANCIAL SUMMARY */}
        {activeTab === 'invoices' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Customer Invoices</h3>
                
              </div>
              <button
                onClick={() => navigate(`/invoices/create?customerId=${customer.id}`)}
                style={{ height: '38px', padding: '0 14px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Create Invoice
              </button>
            </div>

            {/* Financial Summary Strip */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', backgroundColor: 'var(--surface-2)', padding: '12px', borderRadius: '12px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Billed</span>
                <strong style={{ fontSize: '16px', color: 'var(--primary)' }}>{formatINR(totalBilled)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Total Paid</span>
                <strong style={{ fontSize: '16px', color: 'var(--success)' }}>{formatINR(totalPaid)}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>Outstanding Balance</span>
                <strong style={{ fontSize: '16px', color: totalOutstanding > 0 ? 'var(--danger)' : 'var(--text-primary)' }}>{formatINR(totalOutstanding)}</strong>
              </div>
            </div>

            {/* Invoices List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {invoices.map((inv, idx) => (
                <div key={idx} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{customerInvoiceLabel(inv)}</strong> {inv.jobNumber ? `(Job ${inv.jobNumber})` : ''}
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Date: {inv.date} • Vehicle: {inv.vehicle}
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: inv.status === 'Paid' ? 'var(--success)' : 'var(--warning)' }}>
                      {inv.status}
                    </span>
                    <strong style={{ fontSize: '15px', color: 'var(--primary)' }}>{customerInvoiceTotal(inv)}</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Balance: {customerInvoiceBalance(inv)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 11. PAYMENTS TAB */}
        {activeTab === 'payments' && (
          <>
          <CustomerCreditLedgerPanel customerId={customer.id} onChanged={loadCustomerData}/>
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Payment Records</h3>
                
              </div>
              <button
                onClick={() => { setPaymentError(''); setIsRecordPaymentOpen(true); }}
                style={{ height: '38px', padding: '0 14px', borderRadius: '10px', backgroundColor: 'var(--success)', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Record Payment
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {payments.map((p) => (
                <div key={p.id} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{p.method}</strong>
                      <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '6px', backgroundColor: 'var(--surface-3)', color: 'var(--text-secondary)' }}>
                        {p.invoiceNo || '—'}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Date: {p.date} • Ref: {p.reference} • Recorded by: {p.recordedBy || '—'}
                    </div>
                  </div>
                  <strong style={{ fontSize: '16px', color: p.direction === 'OUT' ? 'var(--danger)' : 'var(--success)' }}>
                    {p.direction === 'OUT' ? '−' : '+'}{formatINR(p.amount)}
                  </strong>
                </div>
              ))}
            </div>
          </div>
          </>
        )}

        {/* 12. NOTES TAB */}
        {activeTab === 'notes' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Staff Internal Notes</h3>
                
              </div>
              <button
                onClick={() => setIsAddNoteOpen(true)}
                style={{ height: '38px', padding: '0 14px', borderRadius: '10px', backgroundColor: 'var(--primary)', color: '#ffffff', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={15} /> Add Note
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {notesList.map((n) => (
                <div key={n.id} style={{ backgroundColor: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: '12px', padding: '14px', fontSize: '13px' }}>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500', lineHeight: 1.4 }}>"{n.text}"</div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '6px', borderTop: '1px solid var(--border)', paddingTop: '6px' }}>
                    Added by <strong>{n.addedBy}</strong> • {n.date}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DOCUMENTS TAB */}
        {activeTab === 'documents' && (
          <div className="customer-profile-documents">
            <div className="customer-profile-documents__head">
              <div>
                <h3>Customer & Vehicle Documents</h3>
                
              </div>
              <button onClick={() => setIsAddDocumentOpen(true)}>
                <Plus size={15}/> Add Document
              </button>
            </div>

            {documents.length ? (
              <div className="customer-document-grid">
                {documents.map((document) => (
                  <article key={document.id} className="customer-document-card">
                    <div className="customer-document-card__head">
                      <span><FileText size={16}/></span>
                      <div>
                        <strong>{document.name}</strong>
                        <small>{document.type}{document.vehicleReg ? ` · ${document.vehicleReg}` : ''}</small>
                      </div>
                      <b className={`is-${String(document.status || 'valid').toLowerCase().replaceAll(' ', '-')}`}>
                        {document.status || 'Valid'}
                      </b>
                    </div>
                    <div className="customer-document-meta">
                      <div><span>Uploaded</span><strong>{document.uploadedDate || '—'}</strong></div>
                      <div><span>Expiry</span><strong>{document.expiryDate || 'No expiry'}</strong></div>
                      <div><span>File</span><strong>{document.fileName || 'Metadata only'}</strong></div>
                    </div>
                    <button className="customer-document-delete" onClick={() => deleteDocument(document.id)}>
                      <Trash2 size={13}/> Delete
                    </button>
                  </article>
                ))}
              </div>
            ) : (
              <div className="customer-empty">No customer or vehicle documents uploaded yet.</div>
            )}
          </div>
        )}

        {/* 13. ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>Full Audit & Activity Timeline</h3>
              
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', paddingLeft: '22px' }}>
              <div style={{ position: 'absolute', left: '8px', top: '10px', bottom: '10px', width: '2px', backgroundColor: 'var(--border)' }} />
              {activity.map((act, idx) => (
                <div key={idx} style={{ position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '-22px', top: '4px', width: '12px', height: '12px', borderRadius: '50%', backgroundColor: 'var(--primary)', border: '2px solid var(--surface)' }} />
                  <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--primary)' }}>{act.time || act.created_at || '—'}</span>
                  <h4 style={{ fontSize: '13.5px', fontWeight: '700', color: 'var(--text-primary)', margin: '2px 0' }}>{act.type || act.activity_type || 'Customer Activity'}</h4>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>{act.desc || act.description || '—'}</p>
                </div>
              ))}
            </div>
          </div>
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
                {customerInvoiceLabel(inv)} — Due {customerInvoiceBalance(inv)}
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
          className="customer-profile-edit-form"
          style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {editFormError && <p className="customer-profile-form-error" role="alert">{editFormError}</p>}
          <Input label="Customer Name" required data-customer-field="name" error={editFieldErrors.name} value={editName} onChange={(e) => setEditName(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Input label="Phone Number" required data-customer-field="phone" error={editFieldErrors.phone} value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
            <Input label="WhatsApp Number" data-customer-field="whatsapp" error={editFieldErrors.whatsapp} value={editWhatsapp} onChange={(e) => setEditWhatsapp(e.target.value)} />
          </div>

          <Input label="Email Address" type="email" data-customer-field="email" error={editFieldErrors.email} value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <Select label="Customer Type" data-customer-field="customerType" error={editFieldErrors.customerType} value={editType} onChange={(e) => setEditType(e.target.value)}>
              <option value="Individual">Individual</option>
              <option value="Business">Business</option>
            </Select>


          </div>

          {editType === 'Business' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <Input label="Company Name" data-customer-field="companyName" error={editFieldErrors.companyName} value={editCompany} onChange={(e) => setEditCompany(e.target.value)} />
              <Input label="GST Number" data-customer-field="gstNo" error={editFieldErrors.gstNo} value={editGst} onChange={(e) => setEditGst(e.target.value)} />
            </div>
          )}

          <Textarea label="Address" rows={2} value={editAddress} onChange={(e) => setEditAddress(e.target.value)} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <Input label="City" value={editCity} onChange={(e) => setEditCity(e.target.value)} />
            <Input label="State" value={editState} onChange={(e) => setEditState(e.target.value)} />
            <Input label="PIN Code" value={editPincode} onChange={(e) => setEditPincode(e.target.value)} />
          </div>

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
              {vehicles.map((vehicle)=><option key={vehicle.id} value={vehicle.regNo}>{vehicle.regNo}</option>)}
            </Select>
            <Input label="Expiry Date" type="date" value={docExpiry} onChange={(e)=>setDocExpiry(e.target.value)}/>
            <Select label="Status" value={docStatus} onChange={(e)=>setDocStatus(e.target.value)}>
              <option>Valid</option>
              <option>Expiring Soon</option>
              <option>Expired</option>
              <option>Archived</option>
            </Select>
          </div>
          <label className="customer-document-upload">
            <Upload size={16}/>
            <span>{docFileName || 'Choose attachment'}</span>
            <input type="file" onChange={(e)=>setDocFileName(e.target.files?.[0]?.name || '')}/>
          </label>
          <button className="customer-document-save" type="submit">Save Document</button>
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

