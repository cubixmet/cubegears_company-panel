import { appConfirm } from '../common/appDialogs';
import { useEffect, useMemo, useRef, useState } from "react";
import { CheckCircle2, ClipboardList, HardHat, Plus, RefreshCcw, Search, TrendingUp, Trash2, Wallet, X } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { outsideLabourService } from '../../services/outsideLabour.service';
import { showFormFieldError, showServerFormErrors } from '../../utils/formValidation';

const formatMoney = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value || 0));

const blank = (jobId = '') => ({
  job: jobId, workerName: '', workerPhone: '', workDescription: '',
  customerCharge: '', workerCharge: '', markPaid: false,
  paymentMethod: 'Cash', paymentReference: '',
});

const errorText = (error) => {
  const data = error?.response?.data;
  if (typeof data?.detail === 'string') return data.detail;
  if (typeof data?.message === 'string') return data.message;
  if (data && typeof data === 'object') {
    const first = Object.values(data)[0];
    if (Array.isArray(first) && first[0]) return String(first[0]);
    if (typeof first === 'string') return first;
  }
  return error?.message || 'Unable to save outside labour.';
};

export const OutsideLabourPanel = ({
  jobId,
  jobs = [],
  onChanged,
  formOpen,
  onFormOpenChange,
  refreshVersion = 0,
  hideToolbar = false,
  closeAfterSave = false,
  compactJobMode = false,
  showRecordsWhileEditing = false,
}) => {
  const { user } = useAuth();
  const formRef = useRef(null);
  const canView = hasPermission(user, 'expenses.view');
  const canCreate = hasPermission(user, 'expenses.create');
  const canDelete = hasPermission(user, 'expenses.delete');
  const [rows, setRows] = useState([]);
  const [knownWorkers, setKnownWorkers] = useState([]);
  const [workerOptionsOpen, setWorkerOptionsOpen] = useState(false);
  const [form, setForm] = useState(() => blank(jobId));
  const [payTarget, setPayTarget] = useState(null);
  const [payMethod, setPayMethod] = useState('Cash');
  const [payReference, setPayReference] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('All');
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(Boolean(jobId));
  const controlledForm = typeof formOpen === 'boolean';
  const isFormOpen = controlledForm ? formOpen : showForm;
  const toggleForm = () => {
    if (controlledForm) onFormOpenChange?.(!formOpen);
    else setShowForm((previous) => !previous);
  };
  const set = (key, value) => {
    setError('');
    setForm((previous) => ({ ...previous, [key]: value }));
  };

  const refresh = async () => {
    if (!canView) { setLoading(false); return; }
    setLoading(true);
    setError('');
    try {
      const records = await outsideLabourService.list(jobId ? { job: jobId } : {});
      setRows(records);
      // Suggestions are sourced from company-scoped outside labour history, not regular employees.
      if (jobId && canCreate) {
        try {
          setKnownWorkers(await outsideLabourService.list());
        } catch {
          setKnownWorkers(records);
        }
      } else {
        setKnownWorkers(records);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    setForm(blank(jobId));
    if (!controlledForm) setShowForm(Boolean(jobId));
    refresh();
  }, [jobId, canView]);

  useEffect(() => {
    if (refreshVersion > 0) refresh();
  }, [refreshVersion]);

  const totals = useMemo(() => rows.reduce((value, row) => {
    value.customer += Number(row.customerCharge || 0);
    value.worker += Number(row.workerCharge || 0);
    if (row.status === 'Paid') value.paid += Number(row.workerCharge || 0);
    else value.pending += Number(row.workerCharge || 0);
    return value;
  }, { customer: 0, worker: 0, pending: 0, paid: 0 }), [rows]);

  const visibleRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => (
      (filter === 'All' || row.status === filter)
      && (!term || [
        row.workerName, row.workerPhone, row.workDescription, row.jobNumber, row.vehicleReg, row.quickServiceDescription,
      ].some((field) => String(field || '').toLowerCase().includes(term)))
    ));
  }, [rows, filter, search]);

  const workerSuggestions = useMemo(() => {
    const unique = new Map();
    for (const record of knownWorkers) {
      const name = String(record.workerName || '').trim();
      const phone = String(record.workerPhone || '').trim();
      if (!name) continue;
      const key = name.toLocaleLowerCase() + '|' + phone;
      if (!unique.has(key)) unique.set(key, { name, phone });
    }
    const query = form.workerName.trim().toLocaleLowerCase();
    return [...unique.values()].filter((worker) => !query || worker.name.toLocaleLowerCase().includes(query)).slice(0, 8);
  }, [knownWorkers, form.workerName]);

  const selectWorker = (worker) => {
    setForm((previous) => ({ ...previous, workerName: worker.name, workerPhone: worker.phone || previous.workerPhone }));
    setWorkerOptionsOpen(false);
  };

  const save = async (event) => {
    event.preventDefault();
    if (saving || !canCreate) return;
    if (!form.job || !form.workerName.trim() || !form.workDescription.trim()) {
      const invalidField = !form.job ? 'job' : !form.workerName.trim() ? 'workerName' : 'workDescription';
      showFormFieldError(formRef.current, invalidField, 'This field is required.');
      setError('Choose Job Card, worker name, and work description.');
      return;
    }
    const amount = Number(form.workerCharge);
    const customerAmount = Number(form.customerCharge || 0);
    if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(customerAmount) || customerAmount < 0) {
      showFormFieldError(formRef.current,
        !Number.isFinite(amount) || amount <= 0 ? 'workerCharge' : 'customerCharge',
        'Enter a valid amount. Worker charge must be greater than zero.');
      setError('Enter a positive worker charge and a valid customer labour charge.');
      return;
    }
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const created = await outsideLabourService.create({
        job: form.job, workerName: form.workerName.trim(), workerPhone: form.workerPhone.trim(),
        workDescription: form.workDescription.trim(), customerCharge: customerAmount,
        workerCharge: amount,
      });
      if (form.markPaid) {
        try {
          await outsideLabourService.markPaid(created.id, {
            paymentMethod: form.paymentMethod,
            paymentReference: form.paymentReference.trim(),
          });
          setNotice('Outside labour saved and payment recorded in Expenses.');
        } catch (paymentError) {
          setNotice('Outside labour saved as Pending. Payment was not recorded.');
          setError(errorText(paymentError));
        }
      } else {
        setNotice('Outside labour saved as Pending. Pay when money is actually given.');
      }
      setForm(blank(jobId));
      if (controlledForm) onFormOpenChange?.(closeAfterSave ? false : Boolean(jobId));
      else setShowForm(Boolean(jobId));
      await refresh();
      onChanged?.();
    } catch (err) {
      showServerFormErrors(formRef.current, err, {
        worker_name: 'workerName', worker_phone: 'workerPhone',
        work_description: 'workDescription', customer_charge: 'customerCharge',
        worker_charge: 'workerCharge',
      });
      setError(errorText(err));
    } finally {
      setSaving(false);
    }
  };

  const pay = async (row) => {
    if (saving || !canCreate) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await outsideLabourService.markPaid(row.id, {
        paymentMethod: payMethod, paymentReference: payReference.trim(),
      });
      setPayTarget(null);
      setPayReference('');
      setNotice('Payment recorded once in Expenses.');
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    } finally { setSaving(false); }
  };

  const remove = async (row) => {
    if (!canDelete || !await appConfirm('Remove this unpaid outside labour record?')) return;
    setSaving(true);
    setError('');
    try {
      await outsideLabourService.remove(row.id);
      await refresh();
      onChanged?.();
    } catch (err) {
      setError(errorText(err));
    } finally { setSaving(false); }
  };

  if (!canView) {
    return (
      <section className="outside-labour-panel">
        <h2>Outside Labour</h2>
        <p>You need Expenses View permission to see outside workers and their manual charges.</p>
      </section>
    );
  }

  return (
    <section className="outside-labour-panel outside-labour-dashboard">
      {!compactJobMode && (
      <header className="outside-labour-header">
        <div className="outside-labour-header-copy">
          <span className="outside-labour-title-icon" aria-hidden="true"><HardHat size={19}/></span>
          <div>
            <h2>{jobId ? 'Outside Labour' : 'Freelance Work Overview'}</h2>
            
          </div>
        </div>
        {!hideToolbar && (
          <div className="outside-labour-toolbar">
            <button className="outside-labour-refresh" type="button" onClick={refresh} disabled={saving || loading}>
              <RefreshCcw size={16} aria-hidden="true"/> Refresh
            </button>
            {canCreate && (
              <button
                className="dashboard-button is-primary outside-labour-add-trigger"
                type="button"
                onClick={toggleForm}
                aria-expanded={isFormOpen}
              >
                {isFormOpen ? <X size={16} aria-hidden="true"/> : <Plus size={16} aria-hidden="true"/>}
                {isFormOpen ? 'Close Form' : 'Add Outside Labour'}
              </button>
            )}
          </div>
        )}
      </header>
      )}

      {!compactJobMode && (
      <>
      <div className="dashboard-stats outside-labour-stats" aria-label="Outside Labour financial summary">
        {[
          { label: 'Customer Labour', value: totals.customer, Icon: ClipboardList, meta: 'Reference amount' },
          { label: 'Worker Cost', value: totals.worker, Icon: HardHat, meta: 'Total outside work' },
          { label: 'Pending Payment', value: totals.pending, Icon: Wallet, meta: 'Outstanding worker dues' },
          { label: 'Paid Expenses', value: totals.paid, Icon: CheckCircle2, meta: 'Recorded payments' },
          { label: 'Labour Margin', value: totals.customer - totals.worker, Icon: TrendingUp, meta: 'Before overheads' },
        ].map(({ label, value, Icon, meta }) => (
          <article key={label} className="dashboard-stat-card outside-labour-stat-card">
            <div className="stat-top">
              <div className="stat-copy">
                <span className="stat-label">{label}</span>
                <strong className="stat-value">{formatMoney(value)}</strong>
              </div>
              <span className="stat-icon" aria-hidden="true"><Icon size={16}/></span>
            </div>
            <span className="stat-meta">{meta}</span>
          </article>
        ))}
      </div>
      <small className="outside-labour-note">Customer Labour is reference-only, not an extra invoice item. Labour Margin excludes parts, tax and overheads.</small>
      </>
      )}

      {notice && <p className="outside-labour-notice" role="status">{notice}</p>}
      {error && <p className="outside-labour-error" role="alert">{error}</p>}

      {canCreate && isFormOpen && (
        <form ref={formRef} className="outside-labour-form operations-card" onSubmit={save}>
          <div className="outside-labour-form-heading">
            <span className="outside-labour-form-icon" aria-hidden="true"><Plus size={17}/></span>
            <div>
              <h3>{compactJobMode ? 'Add Outside Staff' : 'Add Outside Labour'}</h3>
              
            </div>
          </div>
          <div className="outside-labour-form-grid">
            {!jobId && (
              <label>Job Card *
                <select name="job" required value={form.job} onChange={(event) => set('job', event.target.value)}>
                  <option value="">Select Job Card</option>
                  {jobs.map((job) => (
                    <option key={job.id} value={job.id}>
                      {job.jobNumber || 'Job Card'} · {job.vehicleReg || job.customerName || 'Vehicle'}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="outside-worker-picker">
              <label htmlFor="outside-worker-name">Worker Name *</label>
              <div className="outside-worker-search-field">
                <Search size={16} aria-hidden="true"/>
                <input id="outside-worker-name" name="workerName" required maxLength={160}
                  autoComplete="off" role="combobox" aria-autocomplete="list"
                  aria-expanded={workerOptionsOpen && workerSuggestions.length > 0}
                  aria-controls="outside-worker-options"
                  value={form.workerName}
                  onFocus={() => setWorkerOptionsOpen(true)}
                  onBlur={() => window.setTimeout(() => setWorkerOptionsOpen(false), 120)}
                  onChange={(event) => { set('workerName', event.target.value); setWorkerOptionsOpen(true); }}
                  placeholder="Search or enter new worker name"/>
              </div>
              {workerOptionsOpen && workerSuggestions.length > 0 && (
                <div id="outside-worker-options" role="listbox" className="outside-worker-options">
                  {workerSuggestions.map((worker) => (
                    <button key={worker.name + worker.phone} type="button" role="option"
                      aria-selected={form.workerName === worker.name}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectWorker(worker)}>
                      <strong>{worker.name}</strong>
                      {worker.phone && <small>{worker.phone}</small>}
                    </button>
                  ))}
                </div>
              )}
              <small>Choose an existing outside worker or type a new name to add one with this job.</small>
            </div>
            <label>Phone (optional)
              <input name="workerPhone" type="tel" maxLength={30} value={form.workerPhone} onChange={(event) => set('workerPhone', event.target.value)} placeholder="Worker mobile"/>
            </label>
            <label>Work Description *
              <input name="workDescription" required maxLength={300} value={form.workDescription} onChange={(event) => set('workDescription', event.target.value)} placeholder="Bumper painting / denting"/>
            </label>
            <label>Customer Labour Charge (₹)
              <input name="customerCharge" type="number" min="0" step="0.01" value={form.customerCharge} onChange={(event) => set('customerCharge', event.target.value)} placeholder="3500"/>
            </label>
            <label>Pay Worker (₹) *
              <input name="workerCharge" required type="number" min="0.01" step="0.01" value={form.workerCharge} onChange={(event) => set('workerCharge', event.target.value)} placeholder="2000"/>
            </label>
          </div>
          <label className="outside-labour-paid-check">
            <input type="checkbox" checked={form.markPaid} onChange={(event) => set('markPaid', event.target.checked)}/>
            <span>Already paid this worker — record expense now</span>
          </label>
          {form.markPaid && (
            <div className="outside-labour-form-grid">
              <label>Payment Method *
                <select value={form.paymentMethod} onChange={(event) => set('paymentMethod', event.target.value)}>
                  {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'].map((value) => <option key={value}>{value}</option>)}
                </select>
              </label>
              <label>Payment Reference (optional)
                <input value={form.paymentReference} maxLength={120} onChange={(event) => set('paymentReference', event.target.value)} placeholder="Transaction / receipt number"/>
              </label>
            </div>
          )}
          <button type="submit" className="outside-labour-primary" disabled={saving || (!jobId && !jobs.length)}>
            <Plus size={16}/>{saving ? 'Saving…' : form.markPaid ? 'Save & Record Payment' : 'Save Pending Labour'}
          </button>
        </form>
      )}

      {(!compactJobMode || !isFormOpen || showRecordsWhileEditing) && (
      <section className="outside-labour-records operations-card">
      <div className="outside-labour-list-head operations-header">
        <div><h3>Outside Labour Records</h3><span>{rows.length} total · {visibleRows.length} shown</span></div>
        <div className="outside-labour-list-filters" role="group" aria-label="Payment status filter">
          {['All', 'Pending', 'Paid'].map((value) => (
            <button key={value} type="button" aria-pressed={filter === value} onClick={() => setFilter(value)} className={filter === value ? 'is-selected' : ''}>{value}</button>
          ))}
        </div>
      </div>
      <div className="outside-labour-record-tools">
        <label className="outside-labour-search">
          <Search size={17} aria-hidden="true"/>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search worker, Job Card or work"
            aria-label="Search outside labour records"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} aria-label="Clear outside labour search">
              <X size={15}/>
            </button>
          )}
        </label>
        <div className="outside-labour-record-count" aria-live="polite">
          {visibleRows.length} of {rows.length} records
        </div>
      </div>
      {loading ? <p className="outside-labour-empty">Loading outside labour…</p>
        : !visibleRows.length ? <p className="outside-labour-empty">{rows.length ? 'No records match the selected status.' : 'No outside staff added.'}</p>
        : <div className="outside-labour-list">
          <div className="outside-labour-list-columns" aria-hidden="true"><span>Worker / Job</span><span>Labour Charges</span><span>Status & Actions</span></div>
          {visibleRows.map((row) => (
            <article key={row.id} className="outside-labour-entry">
              <div className="outside-labour-entry-main">
                <strong>{row.workerName}</strong>
                <span>{row.jobNumber || (row.quickServiceDescription ? `Quick Service · ${row.quickServiceDescription}` : 'Quick Service')} · {row.workDescription}</span>
                {row.workerPhone && <small>{row.workerPhone}</small>}
              </div>
              <div className="outside-labour-entry-money">
                <span>Customer {formatMoney(row.customerCharge)}</span>
                <strong>Worker {formatMoney(row.workerCharge)}</strong>
                <small>Margin {formatMoney(Number(row.customerCharge || 0) - Number(row.workerCharge || 0))}</small>
              </div>
              <div className="outside-labour-entry-actions">
                <span className={`outside-labour-status ${row.status === 'Paid' ? 'is-paid' : 'is-pending'}`}>{row.status}</span>
                {row.status === 'Pending' && canCreate && (
                  payTarget === row.id ? (
                    <div className="outside-labour-pay-controls">
                      <label>Method
                        <select value={payMethod} onChange={(event) => setPayMethod(event.target.value)}>
                          {['Cash', 'UPI', 'Bank Transfer', 'Cheque', 'Other'].map((value) => <option key={value}>{value}</option>)}
                        </select>
                      </label>
                      <label>Reference
                        <input maxLength={120} value={payReference} onChange={(event) => setPayReference(event.target.value)} placeholder="Optional"/>
                      </label>
                      <button type="button" className="outside-labour-primary" onClick={() => pay(row)} disabled={saving}><CheckCircle2 size={14}/> Confirm Paid</button>
                      <button type="button" onClick={() => setPayTarget(null)}>Cancel</button>
                    </div>
                  ) : <button type="button" onClick={() => setPayTarget(row.id)}>Mark Paid</button>
                )}
                {row.status === 'Pending' && canDelete && (
                  <button className="outside-labour-remove" type="button" onClick={() => remove(row)} disabled={saving}>
                    <Trash2 size={14}/> Remove
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>}
      </section>
      )}
    </section>
  );
};
