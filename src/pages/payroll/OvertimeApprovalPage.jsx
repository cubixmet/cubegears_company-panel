import { recordLabel } from '../../utils/recordReferences.js';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, RefreshCcw, Search, ShieldCheck, X, XCircle } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { appConfirm } from '../../components/common/appDialogs';
import { attendanceManagerService } from '../../services/attendanceManager.service';
import { useFeatureAccess } from '../../context/FeatureAccessContext';
import { DailyWageNav, rupees } from './DailyWagePage';
import {
  PAYROLL_MONTHS, filterOvertimeApprovals, pendingOvertime,
  overtimeHours, overtimeAmount, overtimeWorkDate, validOvertimeRate,
} from './overtimeApproval.utils';
import './daily-wage.css';
import './daily-wage-readable.css';
import './overtime-approvals.css';
import './daily-wage-compact.css';

const showDate = value => {
  if (!value) return '—';
  const date = new Date(value + 'T00:00:00');
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-IN',{
    day:'2-digit',month:'short',year:'numeric',
  });
};

export function OvertimeApprovalPage() {
  const { can } = useFeatureAccess();
  const canViewTeam = can('attendance.team.view');
  const canApproveOvertime = can('attendance.overtime.approve');
  const [params, setParams] = useSearchParams();
  const month = params.get('month') || 'All';
  const year = params.get('year') || 'All';
  const branch = params.get('branch') || 'All';
  const staff = params.get('staff') || 'All';
  const [query, setQuery] = useState('');
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState(null);
  const [decision, setDecision] = useState('');
  const [rate, setRate] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [decisionError, setDecisionError] = useState('');

  const load = useCallback(async () => {
    if (!canViewTeam) return [];
    const data = await attendanceManagerService.getApprovals();
    return pendingOvertime(Array.isArray(data) ? data : data?.results || []);
  }, [canViewTeam]);

  useEffect(() => {
    if (!canViewTeam) { setLoading(false); return; }
    let mounted = true;
    setLoading(true);
    setLoadError('');
    load().then(rows => { if (mounted) setRequests(rows); })
      .catch(error => {
        if (mounted) setLoadError(error?.response?.data?.message ||
          error?.data?.message || error?.message || 'Unable to load overtime approvals.');
      }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [load, refresh, canViewTeam]);

  const rows = useMemo(() => filterOvertimeApprovals(requests, {
    month,year,branch,staff,search:query,
  }), [requests,month,year,branch,staff,query]);

  const branchOptions = useMemo(() => [...new Map(requests
    .filter(r => r.branchId || r.branchName || r.branch)
    .map(r => [String(r.branchId || r.branchName || r.branch),r.branchName || r.branch || 'Branch']))
    .entries()], [requests]);

  const staffOptions = useMemo(() => [...new Map(
    filterOvertimeApprovals(requests,{month,year,branch}).map(r => [
      String(r.employeeId || r.staffId),r.staffName || r.staffId || 'Staff',
    ]),
  ).entries()], [requests,month,year,branch]);

  const years = useMemo(() => [...new Set([
    new Date().getFullYear(),
    ...requests.map(row => Number(String(row.payrollMonth || row.date || row.affectedDate || '').slice(0,4))),
    Number(year),
  ].filter(value => Number.isInteger(value) && value >= 2000 && value <= 2100))]
    .sort((a,b)=>b-a),[requests,year]);

  const hasActiveFilters = Boolean(query.trim())
    || [month, year, branch, staff].some(value => value !== 'All');

  const clearFilters = () => {
    setQuery('');
    setParams(current => {
      const next = new URLSearchParams(current);
      ['month', 'year', 'branch', 'staff'].forEach(field => next.set(field, 'All'));
      return next;
    });
  };

  const setFilter = (field,value) => {
    setParams(old => {
      const next = new URLSearchParams(old);
      next.set(field,value);
      if (field === 'branch') next.set('staff','All');
      return next;
    });
  };

  const openDecision = (row,action) => {
    if (!canApproveOvertime || row.canReview === false) return;
    setSelected(row);
    setDecision(action);
    setRate(row.rate > 0 ? String(row.rate) : '');
    setNote('');
    setDecisionError('');
  };

  const closeDecision = () => {
    if (saving) return;
    setSelected(null);
    setDecision('');
    setRate('');
    setNote('');
    setDecisionError('');
  };

  const submitDecision = async event => {
    event.preventDefault();
    if (!canApproveOvertime || !selected || !decision || saving) return;
    if (selected.canReview === false) {
      setDecisionError(selected.reviewBlockReason || 'Another authorized manager must review this request.');
      return;
    }
    if (decision === 'approve' && !validOvertimeRate(rate)) {
      setDecisionError('Enter a positive hourly overtime rate with at most two decimal places.');
      return;
    }
    if (decision === 'reject' && !note.trim()) {
      setDecisionError('Rejection reason is required.');
      return;
    }
    const label = decision === 'approve' ?
      `Approve ${overtimeHours(selected).toFixed(2)} hours for ${rupees(overtimeAmount(selected,rate))}?` :
      `Reject overtime request by ${selected.staffName || 'staff member'}?`;
    const confirmed = await appConfirm(label,{
      title: decision === 'approve' ? 'Approve Overtime' : 'Reject Overtime',
      confirmLabel:decision === 'approve' ? 'Confirm Approval' : 'Confirm Rejection',
      tone:decision === 'reject' ? 'danger' : 'normal',
    });
    if (!confirmed) return;
    setSaving(true);
    setDecisionError('');
    setNotice('');
    try {
      await attendanceManagerService.updateApprovalStatus(selected.id,decision,note.trim(),
        decision === 'approve' ? { rate:Number(rate) } : {});
      // The endpoint is a Pending queue: only refresh after mutation and do not
      // re-post if a refresh fails. Show success even if network refresh fails.
      setSelected(null);
      setDecision('');
      setRequests(current => current.filter(row => row.id !== selected.id));
      setNotice(decision === 'approve' ?
        'Overtime approved. Hourly rate and approved amount were saved.' :
        'Overtime rejected and the employee was notified.');
      setRefresh(value => value + 1);
    } catch(error) {
      setDecisionError(error?.response?.data?.message ||
        error?.data?.message || error?.message || 'Unable to review overtime. Please retry.');
    } finally {
      setSaving(false);
    }
  };

  if (!canViewTeam) return <main className="dw-page"><p role="alert">Team Attendance View permission required.</p></main>;
  return (
    <main className="dw-page dashboard-page dw-overtime-page">
      <header className="dw-header dashboard-heading">
        <div className="dashboard-heading-copy">
          <h1>Overtime Approvals</h1>
        </div>
        <button className="dw-button" type="button" onClick={() => setRefresh(v=>v+1)} disabled={loading}>
          <RefreshCcw size={17} aria-hidden="true"/> {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>
      <DailyWageNav selected="overtime"/>
      {!canViewTeam ? (
        <section className="dw-card dw-overtime-info" role="alert">
          Team Attendance View permission is required to see overtime requests.
        </section>
      ) : (
        <>
          {notice && <p className="dw-overtime-notice" role="status"><CheckCircle2 size={18}/>{notice}</p>}
          {loadError && <p className="dw-alert" role="alert">{loadError}
            <button className="dw-button" onClick={()=>setRefresh(v=>v+1)} type="button">Retry</button>
          </p>}
          <section className="dw-card" aria-labelledby="dw-overtime-title">
            <div className="dw-card-head">
              <div><h2 id="dw-overtime-title">Pending Requests</h2></div>
              <span role="status" aria-live="polite">{loading || loadError ? '—' : rows.length} pending · {loading || loadError ? '—' : rows.reduce((sum,row)=>sum+overtimeHours(row),0).toFixed(2)} hours</span>
            </div>
            <div className="dw-overtime-filters">
              <label>Month
                <select aria-label="Overtime month" value={month} onChange={e=>setFilter('month',e.target.value)}>
                  <option value="All">All Months</option>
                  {PAYROLL_MONTHS.map(name=><option value={name} key={name}>{name}</option>)}
                </select>
              </label>
              <label>Year
                <select aria-label="Overtime year" value={year} onChange={e=>setFilter('year',e.target.value)}>
                  <option value="All">All Years</option>
                  {years.map(item=><option value={item} key={item}>{item}</option>)}
                </select>
              </label>
              <label>Branch
                <select aria-label="Overtime branch" value={branch}
                  onChange={e=>setFilter('branch',e.target.value)}>
                  <option value="All">All Branches</option>
                  {branchOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}
                  {branch!=='All' && !branchOptions.some(([id,name])=>
                    id===branch || name===branch) && <option value={branch}>{branch}</option>}
                </select>
              </label>
              <label>Staff
                <select aria-label="Overtime staff" value={staff} onChange={e=>setFilter('staff',e.target.value)}>
                  <option value="All">All Staff</option>
                  {staffOptions.map(([id,name])=><option key={id} value={id}>{name}</option>)}
                  {staff!=='All' && !staffOptions.some(([id])=>id===staff) && <option value={staff}>{staff}</option>}
                </select>
              </label>
              <label className="dw-overtime-search-label">Search
                <span className="dw-overtime-search"><Search size={17} aria-hidden="true"/>
                  <input value={query} onChange={e=>setQuery(e.target.value)} type="search"
                    aria-label="Search overtime requests" placeholder="Staff, date or reason"/>
                </span>
              </label>
              {hasActiveFilters && (
                <div className="dw-overtime-filter-actions">
                  <button className="dw-button dw-clear-filters" type="button" onClick={clearFilters}>
                    <X size={15} aria-hidden="true"/> Clear Filters
                  </button>
                </div>
              )}
            </div>
            {loading ? <p className="dw-empty" role="status">Loading pending overtime…</p> :
              loadError ? <p className="dw-empty">Unable to display pending overtime. Use Retry above.</p> :
              !rows.length ? <div className="dw-empty">
                No pending overtime requests for the selected filters.
                {hasActiveFilters && <button type="button" className="dw-button dw-clear-filters" onClick={clearFilters}><X size={15} aria-hidden="true"/> Clear Filters</button>}
              </div> :
              <div className="dw-overtime-list">
                {rows.map(row=>(
                  <article className="dw-overtime-card" key={row.id}>
                    <div className="dw-overtime-card-head">
                      <div><strong>{row.staffName || 'Staff'}</strong>
                        <small>{recordLabel(row.staffId, 'Employee')} · {row.branchName || row.branch || 'Workshop'}</small></div>
                      <span className="dw-pending">Pending</span>
                    </div>
                    <div className="dw-overtime-facts">
                      <span><CalendarDays size={15}/> {showDate(overtimeWorkDate(row))}</span>
                      <span><Clock3 size={15}/> {overtimeHours(row).toFixed(2)} hours</span>
                      <span>{row.rate > 0 ? `Saved rate ${rupees(row.rate)}/hr` : 'Hourly rate required'}</span>
                    </div>
                    <p className="dw-overtime-reason">{row.reason || 'No reason provided.'}</p>
                    {!canApproveOvertime ?
                      <p className="dw-overtime-blocked" role="status">Overtime Approval permission required to review this request.</p> : row.canReview === false ?
                      <p className="dw-overtime-blocked" role="status">
                        <ShieldCheck size={17}/>{row.reviewBlockReason || 'Another manager must review this request.'}
                      </p> :
                      <div className="dw-overtime-actions">
                        <button type="button" className="dw-button is-primary"
                          onClick={()=>openDecision(row,'approve')}><CheckCircle2 size={17}/> Approve</button>
                        <button type="button" className="dw-button dw-overtime-reject"
                          onClick={()=>openDecision(row,'reject')}><XCircle size={17}/> Reject</button>
                      </div>}
                  </article>
                ))}
              </div>}
          </section>
          <details className="dw-overtime-help"><summary>About overtime payments</summary>
            <p>Overtime approvals are separate from Daily Wage extra earnings. Approving overtime does not create a duplicate wage entry.</p>
          </details>
        </>
      )}
      <ResponsiveModalSheet isOpen={Boolean(selected)} onClose={closeDecision}
        title={decision === 'approve' ? 'Approve Overtime' : 'Reject Overtime'} maxWidth="520px">
        {selected && <form className="dw-overtime-decision-form" onSubmit={submitDecision}>
          <p><strong>{selected.staffName}</strong> · {showDate(overtimeWorkDate(selected))} · {overtimeHours(selected).toFixed(2)} hours</p>
          {decision === 'approve' && <>
            <label>Hourly Overtime Rate (₹) *
              <input type="number" inputMode="decimal" min="0.01" max="99999999"
                step="0.01" required value={rate} disabled={saving}
                onChange={e=>setRate(e.target.value)} placeholder="Enter hourly rate"/>
            </label>
            <div className="dw-overtime-preview">Calculated Overtime Pay
              <strong>{validOvertimeRate(rate) ? rupees(overtimeAmount(selected,rate)) : '—'}</strong>
            </div>
          </>}
          <label>{decision === 'reject' ? 'Rejection Reason *' : 'Manager Note (optional)'}
            <textarea rows={3} value={note} disabled={saving}
              required={decision==='reject'} onChange={e=>setNote(e.target.value)}
              placeholder={decision==='reject' ? 'Explain why the request is rejected' : 'Add a note for the employee'}/>
          </label>
          {decisionError && <p className="dw-alert" role="alert">{decisionError}</p>}
          <div className="dw-overtime-dialog-actions">
            <button type="button" className="dw-button" disabled={saving} onClick={closeDecision}>Cancel</button>
            <button className={decision==='approve' ? 'dw-button is-primary' : 'dw-button dw-overtime-reject'}
              type="submit" disabled={saving}>
              {saving ? 'Saving…' : decision==='approve' ? 'Approve Overtime' : 'Reject Overtime'}
            </button>
          </div>
        </form>}
      </ResponsiveModalSheet>
    </main>
  );
}
