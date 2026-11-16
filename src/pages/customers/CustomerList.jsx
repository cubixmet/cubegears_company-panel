import { appConfirm } from '../../components/common/appDialogs';
import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search } from '../../components/common/Search';
import { Select } from '../../components/common/Select';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import '../../styles/customer-workshop-form.css';
import '../../styles/customer-workspace-compact.css';
import '../../styles/customer-directory-refined.css';
import { customerService } from '../../services/customer.service';
import { CustomerFormFields } from '../../components/customers/CustomerFormFields';
import {
  normalizeCustomerType, normalizeCustomerPhone, toCustomerFormPayload,
  validateCustomerContact,
} from '../../utils/customerFormModel';
import { customerInvoiceMoney, customerStatusLabel, formatCustomerMoney } from './customerDirectoryMoney';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { CustomerContactActions } from '../../components/customers/CustomerContactActions';
import { Users, Plus, Filter, Edit, AlertTriangle } from "lucide-react";

export const CustomerList = () => {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canCreateCustomer = can('customers.create');
  const canEditCustomer = can('customers.edit');
  const canViewCustomerMoney = can('invoices.view');
  const [searchParams, setSearchParams] = useSearchParams();
  const search = (searchParams.get('q') || '').slice(0, 120);
  const statusFilter = searchParams.get('status') || 'All';
  const branchFilter = searchParams.get('branch') || 'All';
  const typeFilter = searchParams.get('type') || 'All';
  const updateFilter = (name, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'All') next.delete(name);
    else next.set(name, value);
    next.delete('page');
    setSearchParams(next, { replace: name === 'q' });
  };
  const setSearch = (value) => updateFilter('q', value);
  const setStatusFilter = (value) => updateFilter('status', value);
  const setBranchFilter = (value) => updateFilter('branch', value);
  const setTypeFilter = (value) => updateFilter('type', value);
  const resetFilters = () => setSearchParams(new URLSearchParams());
  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'All' || branchFilter !== 'All' || typeFilter !== 'All');
  const activeFilterCount = [statusFilter !== 'All', branchFilter !== 'All', typeFilter !== 'All'].filter(Boolean).length;


  // Core Data State
  const [customers, setCustomers] = useState([]);
  const [remoteSearchIds, setRemoteSearchIds] = useState(null);
  const [branchChoices, setBranchChoices] = useState([]);
  const [branchLoadError, setBranchLoadError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Filters State
  const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);

  // Add / Edit Customer Modal State
  const [isAddCustomerOpen, setIsAddCustomerOpen] = useState(false);
  const [formBusy, setFormBusy] = useState(false);
  const [duplicateChecking, setDuplicateChecking] = useState(false);
  const [formError, setFormError] = useState('');
  const [formFieldErrors, setFormFieldErrors] = useState({});
  const customerFormRef = useRef(null);
  const [editingCustomerId, setEditingCustomerId] = useState(null);

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [customerType, setCustomerType] = useState('Individual');
  const [companyName, setCompanyName] = useState('');
  const [gstNo, setGstNo] = useState('');
  const [branch, setBranch] = useState('');
  const [notes, setNotes] = useState('');

  // Duplicate Check Modal State
  const [duplicateFound, setDuplicateFound] = useState(null);
  const [isDuplicateModalOpen, setIsDuplicateModalOpen] = useState(false);

  // Actions Popover / Menu State
  const [activeMenuCustomer, setActiveMenuCustomer] = useState(null);

  // Toast feedback
  const [toastMsg, setToastMsg] = useState('');

  // Load the directory once; filtering is local and never refetches all linked jobs on each keystroke.
  useEffect(() => {
    fetchCustomers();
    let active = true;
    customerService.getCustomerBranches()
      .then((rows) => { if (active) setBranchChoices(rows); })
      .catch((error) => {
        if (active) setBranchLoadError(error?.message || 'Unable to load workshop branches.');
      });
    return () => { active = false; };
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const response = await customerService.getCustomers();
      const data = Array.isArray(response) ? response : (response?.results || []);

      let partialErrors = 0;
      let enriched = [];
      if (USE_MOCK_API) {
        // Preserve existing rich local demo fixtures; the live app never
        // issues three subresource requests per customer.
        enriched = await Promise.all(data.map(async (customer) => {
        // Optional vehicle/job permissions or endpoint errors should never hide
        // the entire customer directory or misrepresent unpaid invoice amounts as zero.
        const [vehicleResult, jobResult, invoiceResult] = await Promise.allSettled([
          customerService.getCustomerVehicles(customer.id),
          customerService.getCustomerJobs(customer.id),
          customerService.getCustomerInvoices(customer.id),
        ]);
        const rows = (result) => {
          if (result.status !== 'fulfilled') return [];
          return Array.isArray(result.value) ? result.value
            : (Array.isArray(result.value?.results) ? result.value.results : []);
        };
        const vehicles = rows(vehicleResult);
        const jobs = rows(jobResult);
        let money = { totalSpent: null, outstanding: null, moneyAvailable: false };
        if (invoiceResult.status === 'fulfilled') {
          try {
            const invoiceRows = Array.isArray(invoiceResult.value)
              ? invoiceResult.value : invoiceResult.value?.results;
            money = customerInvoiceMoney(invoiceRows);
          } catch {
            partialErrors += 1;
          }
        } else {
          partialErrors += 1;
        }
        if (vehicleResult.status === 'rejected' || jobResult.status === 'rejected') {
          partialErrors += 1;
        }

        return {
          ...customer,
          status: customerStatusLabel(customer.status),
          customerType: customer.customerType || customer.customer_type || 'Individual',
          vehicleCount: vehicleResult.status === 'fulfilled' ? vehicles.length : null,
          jobsCount: jobResult.status === 'fulfilled' ? jobs.length : null,
          ...money,
          __vehicles: vehicles,
          __jobs: jobs,
        };
      }));


      } else {
        let summary = null;
        try {
          const result = await customerService.getCustomerDirectorySummary();
          if (!Array.isArray(result?.results)) throw new Error('Invalid directory summary.');
          summary = new Map(result.results.map(row => [String(row.customerId), row]));
        } catch {
          partialErrors += 1;
        }
        enriched = data.map(customer => {
          const details = summary?.get(String(customer.id));
          const spent = details?.moneyAvailable && details.totalSpent != null
            ? Number(details.totalSpent) : null;
          const due = details?.moneyAvailable && details.outstanding != null
            ? Number(details.outstanding) : null;
          const moneyAvailable = Boolean(details?.moneyAvailable &&
            Number.isFinite(spent) && Number.isFinite(due));
          return {
            ...customer,
            status: customerStatusLabel(customer.status),
            customerType: customer.customerType || customer.customer_type || 'Individual',
            vehicleCount: details?.vehiclesAvailable ? details.vehicleCount : null,
            jobsCount: details?.jobsAvailable ? details.jobsCount : null,
            totalSpent: moneyAvailable ? spent : null,
            outstanding: moneyAvailable ? Math.max(0, due) : null,
            moneyAvailable,
          };
        });
      }
      setCustomers(enriched);
      setLoadError(partialErrors
        ? 'Some linked customer records could not load. Missing invoice balances are shown as — instead of ₹0. Please check permissions or retry.'
        : '');
    } catch (e) {
      console.error(e);
      setLoadError(e?.message || 'Could not load customers. Check the backend connection.');
    } finally {
      setLoading(false);
    }
  };

  // Registration/VIN and job-number matches are resolved by Django with
  // vehicles.view / jobs.view permissions, not by leaking subresource data.
  useEffect(() => {
    if (!search.trim() || USE_MOCK_API) { setRemoteSearchIds(null); return undefined; }
    let active = true;
    setRemoteSearchIds(null);
    const timer = setTimeout(() => {
      customerService.getCustomers({ search: search.trim() })
        .then(value => {
          if (!active) return;
          const rows = Array.isArray(value) ? value : value?.results || [];
          setRemoteSearchIds(new Set(rows.map(item => String(item.id))));
        })
        .catch(() => { if (active) setRemoteSearchIds(null); });
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  const availableBranches = useMemo(() => [...new Set(
    branchChoices.map((item) => item.name).filter(Boolean)
  )].sort(), [branchChoices]);
  const availableTypes = useMemo(() => [...new Set(
    customers.map((item) => normalizeCustomerType(item.customerType)).filter(Boolean)
  )].sort(), [customers]);
  const availableStatuses = useMemo(() => [...new Set(
    customers.map((item) => item.status).filter(Boolean)
  )].sort(), [customers]);
  const visibleCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    return customers.filter((customer) => {
      if (statusFilter !== 'All' && (customer.status || '').toLowerCase() !== statusFilter.toLowerCase()) return false;
      if (branchFilter !== 'All' && String(customer.branchName || '') !== branchFilter) return false;
      if (typeFilter !== 'All' && normalizeCustomerType(customer.customerType).toLowerCase() !== typeFilter.toLowerCase()) return false;
      if (!q) return true;
      return [customer.name, customer.email, customer.phone, customer.whatsapp, customer.companyName]
        .some((value) => String(value || '').toLowerCase().includes(q)) ||
        customer.__vehicles?.some((vehicle) =>
          [vehicle.regNo, vehicle.vin].some((value) => String(value || '').toLowerCase().includes(q))) ||
        customer.__jobs?.some((job) =>
          [job.jobNumber, job.id, job.vehicleReg].some((value) => String(value || '').toLowerCase().includes(q))) ||
        remoteSearchIds?.has(String(customer.id));
    });
  }, [customers, search, statusFilter, branchFilter, typeFilter, remoteSearchIds]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const openCustomer = (customer) => navigate(`/customers/${customer.id}`);
  const isInteractiveTarget = (target) => target?.closest('a, button, input, select, textarea, [role="button"]');
  const handleCustomerClick = (event, customer) => {
    if (isInteractiveTarget(event.target)) return;
    openCustomer(customer);
  };
  const handleCustomerKeyDown = (event, customer) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      openCustomer(customer);
    }
  };

  const openAddModal = () => {
    setEditingCustomerId(null);
    setFormError('');
    setFormFieldErrors({});
    resetForm();
    setIsAddCustomerOpen(true);
  };

  const openEditModal = (c) => {
    setFormError('');
    setFormFieldErrors({});
    setEditingCustomerId(c.id);
    setName(c.name || '');
    setPhone(normalizeCustomerPhone(c.phone));
    setEmail(c.email || '');
    setAddress(c.address || '');
    setCity(c.city || '');
    setState(c.state || '');
    setPincode(c.pincode || '');
    setCustomerType(normalizeCustomerType(c.customerType));
    setCompanyName(c.companyName || '');
    setGstNo(c.gstNo || '');
    setBranch(c.branchId || c.branch || '');
    setNotes(c.notes || '');
    setIsAddCustomerOpen(true);
  };

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setAddress('');
    setCity('');
    setState('');
    setPincode('');
    setCustomerType('Individual');
    setCompanyName('');
    setGstNo('');
    setBranch('');
    setNotes('');
  };

  const customerFormValues = {
    name, phone, email, address, city, state, pincode, customerType,
    companyName, gstNo, branch, notes,
  };
  const updateCustomerFormField = (field, value) => {
    const setters = {
      name: setName, phone: setPhone, email: setEmail, address: setAddress,
      city: setCity, state: setState, pincode: setPincode,
      customerType: setCustomerType, companyName: setCompanyName, gstNo: setGstNo,
      branch: setBranch, notes: setNotes,
    };
    setters[field]?.(value);
    setFormFieldErrors(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (formBusy || duplicateChecking) return;
    setFormError('');

    const errors = validateCustomerContact(customerFormValues);
    if (Object.keys(errors).length) {
      setFormFieldErrors(errors);
      setFormError('Enter the customer name and a valid Phone Number.');
      requestAnimationFrame(() => customerFormRef.current
        ?.querySelector('[data-customer-field="' + Object.keys(errors)[0] + '"]')?.focus());
      return;
    }
    const payload = toCustomerFormPayload(customerFormValues);

    // If creating a new customer, perform duplicate check first
    if (!editingCustomerId) {
      setDuplicateChecking(true);
      try {
        const match = await customerService.checkDuplicateCustomer(payload);
        if (match) {
          setDuplicateFound(match);
          setIsDuplicateModalOpen(true);
          return;
        }
      } catch (error) {
        setFormError(error?.message || 'Could not check existing customers. Please retry.');
        return;
      } finally {
        setDuplicateChecking(false);
      }
    }

    await saveCustomer(payload);
  };

  const saveCustomer = async (payload) => {
    if (formBusy) return;
    setFormBusy(true);
    setFormError('');
    setFormFieldErrors({});
    try {
      if (editingCustomerId) {
        await customerService.updateCustomer(editingCustomerId, payload);
        showToast('Customer information updated.');
      } else {
        await customerService.createCustomer(payload);
        showToast('New customer created successfully.');
      }
      setIsAddCustomerOpen(false);
      setIsDuplicateModalOpen(false);
      resetForm();
      await fetchCustomers();
    } catch (error) {
      const data = error?.response?.data || error?.data;
      const next = {};
      if (data && typeof data === 'object' && !Array.isArray(data)) {
        const fields = ['name', 'phone', 'email', 'customerType',
          'branch', 'companyName', 'gstNo', 'address', 'city', 'state', 'pincode'];
        const aliases = { customer_type: 'customerType', company_name: 'companyName', gstin: 'gstNo', whatsapp: 'phone' };
        for (const [key, value] of Object.entries(data)) {
          const field = aliases[key] || key;
          if (fields.includes(field)) next[field] = Array.isArray(value) ? String(value[0]) : String(value);
        }
      }
      setFormFieldErrors(next);
      setFormError(error?.message || 'Unable to save customer. Check the highlighted fields.');
      requestAnimationFrame(() => {
        const first = Object.keys(next)[0];
        const input = first && customerFormRef.current?.querySelector(`[data-customer-field="${first}"]`);
        input?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        input?.focus();
      });
    } finally {
      setFormBusy(false);
    }
  };

  const handleArchive = async (id) => {
    if (await appConfirm('Archive this customer profile? Customer record will remain in job history.')) {
      await customerService.archiveCustomer(id);
      showToast('Customer archived.');
      fetchCustomers();
    }
  };


  return (
    <div className="customer-directory-page cg-customers cg-directory-refined">
      
      {/* Toast Banner */}
      {toastMsg && (
        <div style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600' }}>
          {toastMsg}
        </div>
      )}

      <header className="cg-directory-header">
        <div className="cg-directory-heading">
          <span className="cg-directory-eyebrow">WORKSHOP DIRECTORY</span>
          <h1>Customers</h1>
          <p>Customer profiles, vehicles and service records.</p>
        </div>
        <button type="button" className="cg-directory-add mobile-full-width-btn"
          onClick={openAddModal} disabled={!canCreateCustomer}
          title={!canCreateCustomer ? 'Customer creation permission required' : undefined}>
          <Plus size={18} aria-hidden="true"/> Add Customer
        </button>
      </header>

      {loadError && <div role="alert" className="customer-directory-error">{loadError} <button type="button" onClick={fetchCustomers}>Retry</button></div>}

      {/* SEARCH + FILTERS TOOLBAR */}
      <section className="customer-directory-toolbar" aria-label="Customer search and filters">
        <div className="cg-directory-toolbar-row">
          <div className="cg-directory-search">
            <Search aria-label="Search customers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, phone, email or vehicle..."
            />
          </div>
          
          {/* Desktop Filter Dropdowns */}
          <div className="desktop-filters-row" style={{ display: 'flex', gap: '8px' }}>
            <Select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              containerStyle={{ width: '130px', marginBottom: 0 }}
            >
              <option value="All">All Status</option>
              {availableStatuses.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>

            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              containerStyle={{ width: '140px', marginBottom: 0 }}
            >
              <option value="All">All Types</option>
              {availableTypes.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <Select aria-label="Branch filter"
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              containerStyle={{ width: '145px', marginBottom: 0 }}>
              <option value="All">All Branches</option>
              {availableBranches.map((value) => <option key={value} value={value}>{value}</option>)}
            </Select>
            <button type="button" className="customer-directory-reset" onClick={resetFilters}>Reset Filters</button>
          </div>

          {/* Mobile Filter Button */}
          <button
            className="mobile-filter-trigger" type="button"
            aria-label={activeFilterCount ? `Filters, ${activeFilterCount} active` : 'Filter customers'}
            onClick={() => setIsFilterSheetOpen(true)}
            style={{ height: '44px', padding: '0 14px', borderRadius: '11px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
          >
            <Filter size={16} aria-hidden="true"/> Filters{activeFilterCount ? ` (${activeFilterCount})` : ''}
          </button>
        </div>
        {hasActiveFilters && (
          <div className="cg-directory-active-filters" aria-label="Active customer filters">
            {search.trim() && <button type="button" onClick={() => setSearch('')}
              aria-label="Clear customer search">Search: {search.trim()} <span aria-hidden="true">×</span></button>}
            {statusFilter !== 'All' && <button type="button" onClick={() => setStatusFilter('All')}
              aria-label="Clear status filter">Status: {statusFilter} <span aria-hidden="true">×</span></button>}
            {typeFilter !== 'All' && <button type="button" onClick={() => setTypeFilter('All')}
              aria-label="Clear customer type filter">Type: {typeFilter} <span aria-hidden="true">×</span></button>}
            {branchFilter !== 'All' && <button type="button" onClick={() => setBranchFilter('All')}
              aria-label="Clear branch filter">Branch: {branchFilter} <span aria-hidden="true">×</span></button>}
            <button type="button" className="cg-directory-clear-all" onClick={resetFilters}>Clear all</button>
          </div>
        )}
      </section>

      {/* CUSTOMER LIST: DESKTOP TABLE & MOBILE CARDS */}
      <div className="customer-directory-list-heading">
        <div><h2>All Customers</h2><span className="customer-directory-count">{loading || (loadError && !customers.length) ? '—' : `${visibleCustomers.length} of ${customers.length} customers`}</span></div>
        <span className="customer-directory-heading-spacer" aria-hidden="true" />
      </div>
      {loading ? (
        <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading customers directory...</div>
      ) : loadError && customers.length === 0 ? null : visibleCustomers.length === 0 ? (
        <div style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '40px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
          <Users size={36} style={{ color: 'var(--text-muted)' }} />
          <strong style={{ fontSize: '15px', color: 'var(--text-primary)' }}>No customers found.</strong>
          {hasActiveFilters ? (
            <button type="button" className="cg-directory-empty-action" onClick={resetFilters}>Clear filters</button>
          ) : (
            <button type="button" className="cg-directory-empty-action" onClick={openAddModal}
              disabled={!canCreateCustomer} title={!canCreateCustomer ? 'Customer creation permission required' : undefined}>
              <Plus size={16} aria-hidden="true"/> Add First Customer
            </button>
          )}
        </div>
      ) : (
        <>
          {/* DESKTOP TABLE */}
          <div className="desktop-customers-table" role="region" aria-label="Customer directory table" tabIndex={0}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--surface-2)', borderBottom: '1px solid var(--border)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '600' }}>
                  <th style={{ padding: '12px 14px' }}>Customer</th>
                  <th style={{ padding: '12px 14px' }}>Phone Number</th>
                  <th style={{ padding: '12px 14px' }}>Customer Type</th>
                  <th style={{ padding: '12px 14px' }}>Vehicles</th>
                  <th style={{ padding: '12px 14px' }}>Job Cards</th>
                  <th style={{ padding: '12px 14px' }}>Outstanding</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleCustomers.map((c) => (
                  <tr key={c.id} className="customer-directory-row" tabIndex={0} aria-label={`Open ${c.name} profile`}
                    onClick={(event) => handleCustomerClick(event, c)}
                    onKeyDown={(event) => handleCustomerKeyDown(event, c)}
                    style={{ borderBottom: '1px solid var(--border)', transition: 'background-color 0.15s ease' }}>
                    <td style={{ padding: '12px 14px' }}>
                      <div className="cg-directory-person">
                        <span className="cg-directory-avatar" aria-hidden="true">{String(c.name || 'C').trim().charAt(0).toUpperCase()}</span>
                        <span className="cg-directory-person-copy">
                          <Link to={`/customers/${c.id}`} className="cg-directory-name">{c.name}</Link>
                          <small>{c.email || c.phone || 'Customer'}</small>
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <div className="customer-directory-phone">{c.phone || 'No phone number'}</div>
                      <CustomerContactActions customer={c} compact />
                    </td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{c.customerType || 'Individual'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{c.vehicleCount ?? '—'}</td>
                    <td style={{ padding: '12px 14px', color: 'var(--text-secondary)' }}>{c.jobsCount ?? '—'}</td>
                    <td title={!c.moneyAvailable ? 'Invoice balance unavailable' : undefined}
                      style={{ padding: '12px 14px', fontWeight: '700', color: c.outstanding === null ? 'var(--text-muted)' : c.outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                      {canViewCustomerMoney ? formatCustomerMoney(c.outstanding) : 'Restricted'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span className={`cg-directory-status ${c.status === 'Active' ? 'is-active' : ''}`}><span aria-hidden="true"/>{c.status}</span>
                    </td>
                    <td style={{ padding: '12px 14px', textAlign: 'right' }}>
                      <button
                        onClick={(event) => { event.stopPropagation(); openCustomer(c); }}
                        className="cg-directory-view-action" aria-label={`View ${c.name} profile`}
                      >
                        View
                      </button>
                      <button
                        onClick={(event) => { event.stopPropagation(); openEditModal(c); }}
                        disabled={!canEditCustomer}
                        title={!canEditCustomer ? 'Customer edit permission required' : undefined}
                        aria-label={`Edit ${c.name}`} className="cg-directory-edit-action"
                      >
                        <Edit size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* MOBILE CARDS VIEW */}
          <div className="mobile-customers-cards">
            {visibleCustomers.map((c) => (
              <div key={c.id} tabIndex={0} role="link" className="customer-directory-card"
                aria-label={`Open ${c.name} profile`}
                onClick={(event) => handleCustomerClick(event, c)}
                onKeyDown={(event) => handleCustomerKeyDown(event, c)}
                style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div className="cg-directory-card-header">
                  <span className="cg-directory-avatar" aria-hidden="true">{String(c.name || 'C').trim().charAt(0).toUpperCase()}</span>
                  <div className="cg-directory-card-identity">
                    <h3>{c.name}</h3>
                    <span>{c.phone || 'No phone number'}</span>
                  </div>
                  <span className={`cg-directory-status ${c.status === 'Active' ? 'is-active' : ''}`}><span aria-hidden="true"/>{c.status}</span>
                </div>

                <div className="customer-directory-card__summary" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', backgroundColor: 'var(--surface-2)', padding: '10px', borderRadius: '10px', fontSize: '12px' }}>
                  <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Vehicles & Jobs</span><strong>{c.vehicleCount ?? '—'} Vehicles • {c.jobsCount ?? '—'} Jobs</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Last Visit</span><strong>{c.lastVisit || '—'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Customer Type</span><strong>{c.customerType || 'Individual'}</strong></div>
                  <div><span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px' }}>Outstanding</span><strong title={!c.moneyAvailable ? 'Invoice balance unavailable' : undefined}
                    style={{ color: c.outstanding === null ? 'var(--text-muted)' : c.outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>{canViewCustomerMoney ? formatCustomerMoney(c.outstanding) : 'Restricted'}</strong></div>
                </div>

                <CustomerContactActions customer={c} />
                <div style={{ display: 'flex', gap: '8px', paddingTop: '4px' }}>
                  <button
                    onClick={(event) => { event.stopPropagation(); openCustomer(c); }}
                    className="cg-directory-mobile-view" aria-label={`View ${c.name} profile`}
                  >
                    View Customer
                  </button>
                  <button
                    onClick={(event) => { event.stopPropagation(); openEditModal(c); }}
                        disabled={!canEditCustomer}
                        title={!canEditCustomer ? 'Customer edit permission required' : undefined}
                    className="cg-directory-mobile-edit" aria-label={`Edit ${c.name}`}
                  >
                    <Edit size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* MODAL / SHEET: ADD OR EDIT CUSTOMER */}
      <ResponsiveModalSheet
        isOpen={isAddCustomerOpen}
        onClose={() => setIsAddCustomerOpen(false)}
        title={editingCustomerId ? "Edit Customer Details" : "Add Workshop Customer"}
        className="cg-workshop-customer-modal"
        maxWidth="620px"
        footer={
          <div className="customer-directory-form-actions">
            <button
              type="button"
              onClick={() => setIsAddCustomerOpen(false)}
              disabled={formBusy || duplicateChecking}
              className="customer-directory-form-cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="cg-workshop-customer-editor"
              className="customer-directory-form-submit"
              disabled={formBusy || duplicateChecking}
            >
              {formBusy ? "Saving…" : duplicateChecking ? "Checking…" : editingCustomerId ? "Save Changes" : "Create Customer"}
            </button>
          </div>
        }
      >
        <form id="cg-workshop-customer-editor" ref={customerFormRef}
          className="customer-directory-form cg-customer-standard-form"
          onSubmit={handleFormSubmit}
          onInvalid={(event) => {
            event.target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            event.target?.focus();
          }}>
          {formError && <p className="customer-directory-error" role="alert">{formError}</p>}
          <CustomerFormFields values={customerFormValues} labelLayout="above"
            onChange={updateCustomerFormField} errors={formFieldErrors}
            branches={branchChoices} branchError={branchLoadError}
            disabled={formBusy || duplicateChecking}
          />
        </form>
      </ResponsiveModalSheet>

      {/* MODAL: DUPLICATE WARNING */}
      <ResponsiveModalSheet
        isOpen={isDuplicateModalOpen}
        onClose={() => setIsDuplicateModalOpen(false)}
        title="Possible Existing Customer Found"
        maxWidth="460px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {formError && <p className="customer-directory-error" role="alert">{formError}</p>}
          <div style={{ backgroundColor: 'var(--warning-soft)', padding: '12px', borderRadius: '10px', border: '1px solid var(--warning-soft)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertTriangle size={20} style={{ color: 'var(--warning)', flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: 'var(--text-primary)' }}>
              A customer with matching phone or email already exists in your database.
            </span>
          </div>

          {duplicateFound && (
            <div style={{ backgroundColor: 'var(--surface-2)', padding: '12px', borderRadius: '10px', fontSize: '13px' }}>
              <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{duplicateFound.name}</strong>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{duplicateFound.phone} • {duplicateFound.email}</div>
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => {
                setIsDuplicateModalOpen(false);
                setIsAddCustomerOpen(false);
                navigate(`/customers/${duplicateFound?.id}`);
              }}
              style={{ flex: 1, height: '44px', borderRadius: '11px', border: '1px solid var(--border)', backgroundColor: 'var(--surface-2)', color: 'var(--primary)', fontWeight: '700' }}
            >
              View Existing
            </button>
            <button
              type="button"
              disabled={formBusy}
              onClick={() => {
                const payload = toCustomerFormPayload(customerFormValues);
                saveCustomer(payload);
              }}
              style={{ flex: 1, height: '44px', borderRadius: '11px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: '700' }}
            >
              {formBusy ? 'Saving…' : 'Continue Anyway'}
            </button>
          </div>
        </div>
      </ResponsiveModalSheet>

      {/* BOTTOM SHEET: MOBILE FILTERS */}
      <ResponsiveModalSheet
        isOpen={isFilterSheetOpen}
        onClose={() => setIsFilterSheetOpen(false)}
        title="Filter Customers"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Select
            label="Customer Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
            <option value="Archived">Archived</option>
          </Select>

          <Select
            label="Customer Type"
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="All">All Types</option>
            {availableTypes.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>

          <Select
            label="Branch"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
          >
            <option value="All">All Branches</option>
            {availableBranches.map((value) => <option key={value} value={value}>{value}</option>)}
          </Select>

          <button
            onClick={() => setIsFilterSheetOpen(false)}
            style={{ height: '44px', borderRadius: '11px', border: 'none', backgroundColor: 'var(--primary)', color: '#ffffff', fontWeight: '700', marginTop: '6px' }}
          >
            Apply Filters
          </button>
        </div>
      </ResponsiveModalSheet>

      <style>{`
        @media (max-width: 767px) {
          .mobile-full-width-btn {
            width: 100% !important;
          }
          .desktop-filters-row {
            display: none !important;
          }
          .desktop-customers-table {
            display: none !important;
          }
          .mobile-customers-cards {
            display: flex !important;
          }
          .mobile-filter-trigger {
            display: flex !important;
          }
        }
        @media (min-width: 768px) {
          .mobile-customers-cards {
            display: none !important;
          }
          .mobile-filter-trigger {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
