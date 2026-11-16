import { useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, ClipboardCheck, Save, ShieldCheck, SkipForward, XCircle } from 'lucide-react';
import { jobService } from '../../services/job.service';
import { USE_MOCK_API } from '../../api/apiConfig';
import { useAuth } from '../../hooks/useAuth';
import {
  makeQcDraft, qcInspectorForMode, qcFormErrors, qcHasErrors, qcPayload, qcSummary,
} from './qualityCheckValidation';
import '../../styles/job-quality-check.css';

export function JobQualityCheckPanel({ job, canEdit, onSaved, onCompleted }) {
  const { user } = useAuth();
  const loggedInName = String(user?.name || '').trim();
  const original = (USE_MOCK_API ? job?.qualityCheck : job?.qc) || {};
  const [draft, setDraft] = useState(() => makeQcDraft(original, loggedInName));
  const [errors, setErrors] = useState(null);
  const [busy, setBusy] = useState(false);
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [dirty, setDirty] = useState(false);
  const [showSkip, setShowSkip] = useState(false);
  const [skipReason, setSkipReason] = useState('');
  const formRef = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    const savedQc = (USE_MOCK_API ? job?.qualityCheck : job?.qc) || {};
    setDraft(makeQcDraft(savedQc, loggedInName));
    setDirty(false);
    setErrors(null);
  }, [job?.id, job?.qc, job?.qualityCheck]);

  // /auth/me may resolve after the QC page mounts. Fill only a blank inspector:
  // never overwrite an existing saved name or unsaved checklist/notes.
  useEffect(() => {
    if (!loggedInName) return;
    setDraft((current) => current.inspector
      ? current : { ...current, inspector: loggedInName });
  }, [loggedInName]);

  // The current editor is always the authenticated inspector. Read-only QC
  // retains the inspector who signed the previously saved result.
  const inspectorName = qcInspectorForMode(draft.inspector, loggedInName, canEdit);
  const submissionDraft = { ...draft, inspector: inspectorName };
  const summary = qcSummary(draft);
  const canSkip = summary.fail === 0 && !['Fail', 'Failed', 'Rework Required'].includes(original.status);
  const change = (update) => {
    setDraft((current) => ({ ...current, ...update }));
    setDirty(true);
    setErrors(null);
    setServerError('');
    setSuccess('');
  };
  const changeItem = (itemId, status) => {
    change({
      checklist: draft.checklist.map((item) => item.id === itemId
        ? { ...item, status } : item),
    });
  };

  const submit = async (mode) => {
    if (!canEdit || lockRef.current || busy) return;
    const invalid = qcFormErrors(submissionDraft, mode);
    if (qcHasErrors(invalid)) {
      setErrors(invalid);
      setSuccess('');
      requestAnimationFrame(() => {
        const field = formRef.current?.querySelector('[aria-invalid="true"]');
        field?.focus();
        field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }
    lockRef.current = true;
    setBusy(true);
    setErrors(null);
    setServerError('');
    setSuccess('');
    try {
      const qc = qcPayload(submissionDraft, mode === 'Draft' ? 'Pending' : mode);
      await jobService.updateJob(job.id, USE_MOCK_API
        ? { qualityCheck: qc } : { qc });

      if (mode === 'Pass') {
        const result = await jobService.completeJobStage(job.id, 'qc');
        await onCompleted?.(result);
      } else {
        await onSaved?.();
        setDirty(false);
        setSuccess(mode === 'Draft'
          ? 'Quality Check draft saved.'
          : 'QC failed and rework details saved. The job remains in QC.');
      }
    } catch (err) {
      const response = err?.response?.data;
      const detail = response?.qc || response?.stage || response?.message ||
        response?.status || response?.detail || err?.message;
      setServerError(typeof detail === 'string' ? detail :
        'Unable to save Quality Check. Please try again.');
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  const skip = async (event) => {
    event.preventDefault();
    const reason = skipReason.trim();
    if (!canEdit || !canSkip || dirty || lockRef.current || reason.length < 3 || reason.length > 160) return;
    lockRef.current = true;
    setBusy(true);
    setErrors(null);
    setServerError('');
    setSuccess('');
    try {
      const result = await jobService.completeJobStage(job.id, 'qc', { skipQC: true, reason });
      setShowSkip(false);
      await onCompleted?.(result);
    } catch (err) {
      setServerError(err?.message || 'Unable to skip Quality Check.');
    } finally {
      lockRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="job-qc-layout" ref={formRef}>
      <section className="job-qc-card" aria-labelledby="job-qc-checklist-title">
        <header className="job-qc-heading">
          <div className="job-qc-heading-title">
            <div className="job-qc-symbol"><ShieldCheck size={19} aria-hidden="true"/></div>
            <div>
              <h2 id="job-qc-checklist-title">Quality Check</h2>
              <p>Review every item before submitting the result.</p>
            </div>
          </div>
          <span className="job-qc-count">{summary.pass}/{summary.total} Passed</span>
        </header>

        <div className="job-qc-progress" role="group" aria-label="Quality Check progress">
          <span className="job-qc-progress-pass">{summary.pass} Passed</span>
          <span className="job-qc-progress-fail">{summary.fail} Failed</span>
          <span className="job-qc-progress-pending">{summary.pending} Pending</span>
        </div>

        {errors?.form && <p className="job-qc-error" role="alert"><AlertCircle size={15}/>{errors.form}</p>}

        <div className="job-qc-checks">
          {draft.checklist.map((item, index) => {
            const invalid = Boolean(errors?.items?.[item.id]);
            return (
              <div className={'job-qc-check' + (invalid ? ' is-invalid' : '')} key={item.id}>
                <div className="job-qc-check-description">
                  <span className="job-qc-check-index">{String(index + 1).padStart(2, '0')}</span>
                  <label htmlFor={'job-qc-status-' + item.id}>{item.item}</label>
                </div>
                <div className="job-qc-check-control">
                  <select id={'job-qc-status-' + item.id} value={item.status}
                    disabled={!canEdit || busy}
                    aria-invalid={invalid}
                    aria-describedby={invalid ? 'job-qc-error-' + item.id : undefined}
                    onChange={(event) => changeItem(item.id, event.target.value)}>
                    <option value="Pending">Pending</option>
                    <option value="Pass">Pass</option>
                    <option value="Fail">Fail</option>
                  </select>
                  {invalid && <small id={'job-qc-error-' + item.id} className="job-qc-field-error">
                    {errors.items[item.id]}
                  </small>}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="job-qc-card job-qc-result" aria-labelledby="job-qc-result-title">
        <header className="job-qc-heading">
          <div className="job-qc-heading-title">
            <div className="job-qc-symbol"><ClipboardCheck size={19} aria-hidden="true"/></div>
            <div>
              <h2 id="job-qc-result-title">Road Test & Result</h2>
              <p>Inspector and final QC remarks.</p>
            </div>
          </div>
        </header>

        <div className="job-qc-field job-qc-inspector-display">
          <span id="job-qc-inspector-label" className="job-qc-inspector-label">
            QC Inspector <span aria-hidden="true">*</span>
          </span>
          <output className="job-qc-inspector-name" aria-labelledby="job-qc-inspector-label">
            {inspectorName || 'Account name unavailable'}
          </output>
          {errors?.inspector
            ? <small id="job-qc-inspector-error" className="job-qc-field-error" role="alert">{errors.inspector}</small>
            : <small id="job-qc-inspector-hint">{canEdit
              ? 'Automatically assigned from your login.'
              : 'Inspector recorded when this QC was saved.'}</small>}
        </div>

        <div className="job-qc-field">
          <label htmlFor="job-qc-road-notes">Road Test Notes / Rework Reason</label>
          <textarea id="job-qc-road-notes" rows={5} maxLength={2000}
            value={draft.testDriveNotes} disabled={!canEdit || busy}
            placeholder="Enter test result, issues found or required rework..."
            aria-invalid={Boolean(errors?.testDriveNotes)}
            aria-describedby={errors?.testDriveNotes ? 'job-qc-notes-error' : undefined}
            onChange={(event) => change({ testDriveNotes: event.target.value })}/>
          {errors?.testDriveNotes
            ? <small id="job-qc-notes-error" className="job-qc-field-error">{errors.testDriveNotes}</small>
            : <small>Required when submitting QC Failed.</small>}
          <span className="job-qc-character-count">{draft.testDriveNotes.length}/2000</span>
        </div>

        {serverError && <div className="job-qc-error" role="alert"><AlertCircle size={16}/>{serverError}</div>}
        {success && <p className="job-qc-success" role="status"><CheckCircle2 size={16}/>{success}</p>}

        <div className="job-qc-submit-actions">
          {canEdit ? (
            <>
              <button type="button" className="job-qc-save" disabled={busy || !dirty}
                onClick={() => submit('Draft')}>
                <Save size={16} aria-hidden="true"/>{busy ? 'Saving…' : 'Save QC Draft'}
              </button>
              <div className="job-qc-decision-actions">
                <button type="button" className="job-qc-pass" disabled={busy}
                  onClick={() => submit('Pass')}>
                  <CheckCircle2 size={16} aria-hidden="true"/>{busy ? 'Saving…' : 'QC Passed'}
                </button>
                <button type="button" className="job-qc-fail" disabled={busy}
                  onClick={() => submit('Rework Required')}>
                  <XCircle size={16} aria-hidden="true"/>{busy ? 'Saving…' : 'QC Failed'}
                </button>
              </div>
              {canSkip && !showSkip && <button type="button" className="job-qc-save" disabled={busy}
                onClick={() => { setErrors(null); setServerError(''); setShowSkip(true); }}>
                <SkipForward size={16} aria-hidden="true" /> Skip QC
              </button>}
              {canSkip && showSkip && <form className="job-qc-submit-actions" onSubmit={skip} aria-label="Confirm Skip QC">
                <label className="job-qc-field" htmlFor="job-qc-skip-reason">
                  Reason for skipping
                  <textarea id="job-qc-skip-reason" rows={2} required minLength={3} maxLength={160}
                    value={skipReason} disabled={busy} onChange={(event) => setSkipReason(event.target.value)} />
                </label>
                {dirty && <p className="job-qc-hint">Save QC Draft first to keep any checklist edits.</p>}
                <div className="job-qc-decision-actions">
                  <button type="button" className="job-qc-save" disabled={busy} onClick={() => setShowSkip(false)}>Cancel</button>
                  <button type="submit" className="job-qc-save" disabled={busy || dirty || skipReason.trim().length < 3}>
                    {busy ? 'Saving…' : 'Confirm Skip & Continue'}
                  </button>
                </div>
              </form>}
              <p className="job-qc-hint">Resolve any failed checks before proceeding to billing.</p>
            </>
          ) : <p className="job-qc-hint">Quality Check is read-only outside the QC stage.</p>}
        </div>
        <div className="job-qc-current">
          <span>Last saved status</span>
          <strong>{original.status || 'Pending'}</strong>
        </div>
        {original.status === 'Skipped' && original.skipReason && <p className="job-qc-hint">{original.skipReason}</p>}
      </section>
    </div>
  );
}

export default JobQualityCheckPanel;
