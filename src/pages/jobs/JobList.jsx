import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { STATUS_OPTIONS } from '../../components/jobs/jobs.utils';
import {
  JobRecordsPanel,
  JobsHeader,
  JobsStats,
  JobsToolbar,
  VehicleLookupPanel,
} from '../../components/jobs';
import { normalizeRegistration } from '../../components/jobs/jobs.utils';
import { JobBreadcrumbs } from '../../components/jobs/JobBreadcrumbs';
import { JobDirectoryControls } from '../../components/jobs/JobDirectoryControls';
import { sortJobsForDisplay, JOB_SORT_OPTIONS } from '../../components/jobs/jobDirectorySort';
import { RefreshCw, AlertCircle } from 'lucide-react';
import { jobService } from '../../services/job.service';
import { billingService } from '../../services/billing.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { jobInvoiceFor } from '../../utils/jobGstFinance';
import { USE_MOCK_API } from '../../api/apiConfig';
import '../../styles/job-gst-finance.css';
import '../../styles/jobs-dashboard.css';
import '../../styles/jobs-unified-ui.css';
import '../../styles/jobs-directory-controls.css';
import '../../styles/jobs-list-compact.css';

export const JobList = () => {
  const navigate = useNavigate();
  const { can } = useFeatureAccess();
  const canViewInvoices = can('invoices.view');
  const canViewGST = can('gstr.view');
  const canViewPayments = can('payments.view');
  const canCollectPayments = can('payments.create');
  const [searchParams, setSearchParams] = useSearchParams();
  const query = (searchParams.get('q') || '').slice(0, 100);
  const rawStatus = (searchParams.get('status') || '').toLowerCase();
  const status = STATUS_OPTIONS.find((option) =>
    option.toLowerCase().replace(/\s+/g, '-') === rawStatus
  ) || 'All';
  const branch = searchParams.get('branch') || 'all';
  const technician = searchParams.get('technician') || 'all';
  const priority = searchParams.get('priority') || 'all';
  const requestedSort = searchParams.get('sort');
  const sortMode = JOB_SORT_OPTIONS.some(option => option.value === requestedSort) ? requestedSort : 'recent';
  const layout = searchParams.get('layout') === 'cards' ? 'cards' : 'auto';
  const from = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('from') || '') ? searchParams.get('from') : '';
  const to = /^\d{4}-\d{2}-\d{2}$/.test(searchParams.get('to') || '') ? searchParams.get('to') : '';
  // Directly edited URLs can contain a reversed date range. Correct the
  // invalid end date without losing any other existing filters.
  useEffect(() => {
    if (!from || !to || from <= to) return;
    const next = new URLSearchParams(searchParams);
    next.delete('to');
    next.delete('page');
    setSearchParams(next, { replace: true });
  }, [from, to, searchParams, setSearchParams]);
  const changeFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === 'all' || value === 'All') next.delete(key);
    else if (key === 'status') next.set(key, value.toLowerCase().replace(/\s+/g, '-'));
    else next.set(key, value);
    next.delete('page');
    setSearchParams(next);
  };
  const setQuery = (value) => changeFilter('q', value);
  const setStatus = (value) => changeFilter('status', value);
  const setLayout = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value === 'cards') next.set('layout', 'cards');
    else next.delete('layout');
    setSearchParams(next);
  };
  const setSort = (value) => changeFilter('sort', value === 'recent' ? '' : value);
  const [jobs, setJobs] = useState([]);
  const [jobInvoiceRows, setJobInvoiceRows] = useState([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    const loadJobs = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const data = await jobService.getJobs();
        if (active) setJobs(Array.isArray(data) ? data : data?.results || []);
      } catch (err) {
        if (active) {
          setJobs([]);
          setLoadError(err?.message || 'Could not load Job Cards. Check the server and try again.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadJobs();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // One company-scoped invoice read powers the job-list GST/payment status.
  // Never fetch Finance totals for users without the invoice entitlement.
  useEffect(() => {
    if (!canViewInvoices || USE_MOCK_API) {
      setJobInvoiceRows([]);
      setInvoicesError('');
      return undefined;
    }
    let active = true;
    setInvoicesLoading(true);
    setInvoicesError('');
    billingService.list({ kind: 'invoice' })
      .then(response => {
        if (active) setJobInvoiceRows(Array.isArray(response) ? response : response?.results || []);
      })
      .catch(error => {
        if (!active) return;
        setJobInvoiceRows([]);
        setInvoicesError(error?.message || 'Unable to load linked invoice GST and payment status.');
      }).finally(() => { if (active) setInvoicesLoading(false); });
    return () => { active = false; };
  }, [canViewInvoices, reloadKey]);

  const filteredJobs = useMemo(() => {
    const search = query.trim().toLowerCase();

    return jobs.filter((job) => {
      const matchesStatus = status === 'All' || (status === 'Active' ? !['Delivered', 'Cancelled'].includes(job.status) : job.status === status);
      const matchesSearch =
        !search ||
        [
          job.jobNumber,
          job.id,
          job.customerName,
          job.customerPhone,
          job.vehicleReg,
          job.vehicleInfo,
          job.assignedEmployeeName,
        ].some((value) =>
          String(value || '').toLowerCase().includes(search),
        );

      const matchesBranch = branch === 'all' || String(job.branchId || '') === branch;
      const matchesTechnician = technician === 'all' || String(job.assignedEmployeeId || '') === technician;
      const matchesPriority = priority === 'all' || String(job.priority || '').toLowerCase() === priority.toLowerCase();
      const created = String(job.createdDate || job.created_at || '').slice(0, 10);
      const matchesDate = (!from || created >= from) && (!to || created <= to);
      return matchesStatus && matchesSearch && matchesBranch && matchesTechnician && matchesPriority && matchesDate;
    });
  }, [jobs, query, status, branch, technician, priority, from, to]);

  const branchOptions = useMemo(() => [...new Map(
    jobs.filter((job) => job.branchId).map((job) => [String(job.branchId), {
      id: String(job.branchId), label: job.branchName || String(job.branchId)
    }])
  ).values()].sort((a, b) => a.label.localeCompare(b.label)), [jobs]);
  const technicianOptions = useMemo(() => [...new Map(
    jobs.filter((job) => job.assignedEmployeeId).map((job) => [String(job.assignedEmployeeId), {
      id: String(job.assignedEmployeeId), label: job.assignedEmployeeName || 'Technician'
    }])
  ).values()].sort((a, b) => a.label.localeCompare(b.label)), [jobs]);
  const priorityOptions = useMemo(() => [...new Set(jobs.map((job) => job.priority).filter(Boolean))].sort(), [jobs]);
  const sortedJobs = useMemo(() => sortJobsForDisplay(filteredJobs, sortMode), [filteredJobs, sortMode]);
  const pageSize = 15;
  const pageCount = Math.max(1, Math.ceil(sortedJobs.length / pageSize));
  const requestedPage = Number(searchParams.get('page'));
  const currentPage = Number.isSafeInteger(requestedPage) && requestedPage > 0
    ? Math.min(requestedPage, pageCount) : 1;
  const pagedJobs = sortedJobs.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const invoiceByJob = useMemo(
    () => new Map(pagedJobs.map(job => [String(job.id), jobInvoiceFor(jobInvoiceRows, job)])),
    [pagedJobs, jobInvoiceRows]
  );
  const setPage = (value) => {
    const next = new URLSearchParams(searchParams);
    if (value <= 1) next.delete('page');
    else next.set('page', String(Math.min(pageCount, value)));
    setSearchParams(next);
  };
  const resetFilters = () => {
    const next = new URLSearchParams();
    if (layout === 'cards') next.set('layout', 'cards');
    if (sortMode !== 'recent') next.set('sort', sortMode);
    setSearchParams(next);
  };

  const vehicleLookup = useMemo(() => {
    const registrationQuery = normalizeRegistration(query);
    if (registrationQuery.length < 5) return null;

    const candidates = jobs.filter((job) => {
      const registration = normalizeRegistration(job.vehicleReg);
      return (
        registration.includes(registrationQuery) ||
        registrationQuery.includes(registration)
      );
    });

    if (!candidates.length) return null;

    const registration = candidates[0].vehicleReg;
    const sameVehicle = jobs
      .filter(
        (job) =>
          normalizeRegistration(job.vehicleReg) ===
          normalizeRegistration(registration),
      )
      .sort((a, b) =>
        String(b.createdDate || '').localeCompare(String(a.createdDate || '')),
      );

    const currentOpen = sameVehicle.find(
      (job) => !['Delivered', 'Cancelled'].includes(job.status),
    );
    const latest = sameVehicle[0];

    const lastParts = sameVehicle
      .flatMap((job) => job.partsUsed || [])
      .slice(0, 4)
      .map((item) => item.name || item.partName)
      .filter(Boolean);

    const spending = sameVehicle.reduce((sum, job) => {
      const total =
        job.billing?.invoiceTotal ||
        job.estimates?.at(-1)?.grandTotal ||
        0;
      return sum + Number(total || 0);
    }, 0);

    return {
      registration,
      latest,
      sameVehicle,
      currentOpen,
      lastParts,
      spending,
    };
  }, [jobs, query]);

  const counts = useMemo(
    () => ({
      total: jobs.length,
      active: jobs.filter(
        (job) => !['Delivered', 'Cancelled'].includes(job.status),
      ).length,
      waiting: jobs.filter((job) => job.status === 'Waiting for Parts').length,
      ready: jobs.filter((job) => job.status === 'Ready for Delivery').length,
    }),
    [jobs],
  );

  const activeFilters = [
    query && { key: 'q', name: 'Search', value: query },
    status !== 'All' && { key: 'status', name: 'Status', value: status },
    branch !== 'all' && { key: 'branch', name: 'Branch', value: branchOptions.find(option => option.id === branch)?.label || branch },
    technician !== 'all' && { key: 'technician', name: 'Technician', value: technicianOptions.find(option => option.id === technician)?.label || 'Selected technician' },
    priority !== 'all' && { key: 'priority', name: 'Priority', value: priority },
    from && { key: 'from', name: 'From', value: from },
    to && { key: 'to', name: 'To', value: to },
  ].filter(Boolean);

  const openJob = (id) => navigate(`/jobs/${id}`);

  return (
    <div className="jobs-dashboard jobs-unified-ui jobs-list-compact">
      <JobBreadcrumbs />
      <JobsHeader onNavigate={navigate} />
      {!loadError && <JobsStats counts={counts} selectedStatus={status} onFilter={setStatus} />}

      <JobsToolbar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        branch={branch} onBranchChange={(value) => changeFilter('branch', value)} branchOptions={branchOptions}
        technician={technician} onTechnicianChange={(value) => changeFilter('technician', value)}
        technicianOptions={technicianOptions}
        priority={priority} onPriorityChange={(value) => changeFilter('priority', value)} priorityOptions={priorityOptions}
        from={from} to={to}
        onFromChange={(value) => changeFilter('from', value)}
        onToChange={(value) => changeFilter('to', value)}
        resultCount={filteredJobs.length}
        loading={loading} hasError={Boolean(loadError)}
        onReset={resetFilters}
      />

      <JobDirectoryControls
        layout={layout} onLayoutChange={setLayout}
        sort={sortMode} onSortChange={setSort}
        activeFilters={activeFilters}
        onClearFilter={key => changeFilter(key, 'all')}
        onClearAll={resetFilters}
      />

      <VehicleLookupPanel
        lookup={vehicleLookup}
        canViewTotals={canViewPayments}
        onOpenCurrentJob={() =>
          vehicleLookup?.currentOpen
            ? openJob(vehicleLookup.currentOpen.id)
            : null
        }
      />

      {loadError && (
        <div className="jobs-load-error" role="alert">
          <AlertCircle size={19} aria-hidden="true"/>
          <span>{loadError}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={loading}>
            <RefreshCw size={15} aria-hidden="true"/> Retry
          </button>
        </div>
      )}
      {invoicesError && canViewInvoices && <div className="jobs-load-error" role="alert">
        Linked invoices: {invoicesError}
        <button type="button" onClick={() => setReloadKey(value => value + 1)}>Retry</button>
      </div>}
      <JobRecordsPanel
        jobs={pagedJobs}
        layout={layout}
        invoiceByJob={invoiceByJob}
        hasError={Boolean(loadError)}
        showBilling={canViewInvoices && !USE_MOCK_API}
        invoicesLoading={invoicesLoading}
        invoicesError={Boolean(invoicesError)}
        canViewGST={canViewGST}
        canViewPayments={canViewPayments}
        canCollectPayments={canCollectPayments}
        totalCount={filteredJobs.length}
        loading={loading}
        status={status}
        searchTerm={query}
        hasActiveFilters={Boolean(query || status !== 'All' || branch !== 'all' || technician !== 'all' || priority !== 'all' || from || to)}
        onOpenJob={openJob}
      />
      {!loading && !loadError && filteredJobs.length > pageSize && (
        <nav className="jobs-filter-pagination" aria-label="Job list pagination">
          <span>Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, filteredJobs.length)} of {filteredJobs.length}</span>
          <button type="button" aria-label="Previous Job Cards page" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
          <span>Page {currentPage} of {pageCount}</span>
          <button type="button" aria-label="Next Job Cards page" disabled={currentPage >= pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
        </nav>
      )}
      {(canViewGST || canViewPayments) && <nav className="jobs-gst-finance-nav" aria-label="Job GST and finance links">
        <span>Related Billing &amp; Finance</span>
        {canViewGST && <button type="button" onClick={() => navigate('/gstr')}>GST Returns</button>}
        {canViewPayments && <button type="button" onClick={() => navigate('/finance/payments')}>Customer Payments</button>}
        {canViewPayments && <button type="button" onClick={() => navigate('/finance')}>Finance Overview</button>}
      </nav>}
    </div>
  );
};

export default JobList;
