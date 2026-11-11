import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, CheckCircle2, ClipboardCheck, Plus, RefreshCcw, Search, SkipForward, Trash2, Wrench } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { jobInspectionService, DEFAULT_INSPECTION_CATEGORIES } from '../../services/jobInspection.service';
import { vehiclePhotoService } from '../../services/vehiclePhoto.service';
import { VehiclePhotoGallery } from '../vehicles/VehiclePhotoGallery';

const SKIP_REASONS = [
  'Quick Service',
  'Customer Declined Inspection',
  'Inspection Not Required',
  'Other',
];

const inspected = (value) => ['Good', 'Needs Attention', 'Critical'].includes(value);
const reviewed = (value) => inspected(value) || value === 'Not Applicable';

const newFinding = () => ({
  description: '', severity: 'Medium', recommendedAction: '', estimatedCost: ''
});

const formatMoney = (number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(number) || 0);

export function JobInspectionPanel({ job, onChanged, canCorrect = false, canEdit = false, canReopen = false, startEditing = false, onDoneEditing }) {
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedGroup, setSelectedGroup] = useState(DEFAULT_INSPECTION_CATEGORIES[0].id);
  const [editing, setEditing] = useState(startEditing);
  const [finding, setFinding] = useState(newFinding());
  const [diagnostic, setDiagnostic] = useState({ code: '', description: '' });
  const [skipConfirmOpen, setSkipConfirmOpen] = useState(false);
  const [skipChoice, setSkipChoice] = useState(SKIP_REASONS[0]);
  const [skipOther, setSkipOther] = useState('');
  const skipInFlight = useRef(false);

  const reload = useCallback(async () => {
    const result = await jobInspectionService.getInspection(job.id);
    setInspection(result || { status: 'Not Started', checklist: {}, findings: [], photos: [], diagnosticScan: { codes: [] } });
    return result;
  }, [job.id]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    jobInspectionService.getInspection(job.id)
      .then((result) => {
        if (active) setInspection(result || { status: 'Not Started', checklist: {}, findings: [], photos: [], diagnosticScan: { codes: [] } });
      })
      .catch((e) => { if (active) setError(e?.message || 'Could not load inspection.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [job.id]);

  const perform = async (label, operation) => {
    if (busy) return false;
    setBusy(label);
    setError('');
    try {
      // Users can record a check immediately: start the backend inspection
      // first, then save the actual choice. Keep the existing audit/workflow
      // transition and never fabricate an inspection locally.
      if (['check', 'finding', 'diagnostic', 'photo'].includes(label) &&
          inspection && !['In Progress', 'Completed', 'Skipped'].includes(inspection.status)) {
        await jobInspectionService.startInspection(job.id);
      }
      await operation();
      await reload();
      await onChanged?.(label);
      return true;
    } catch (e) {
      setError(e?.message || 'Unable to save inspection.');
      return false;
    } finally {
      setBusy('');
    }
  };

  const checklist = inspection?.checklist || {};
  const items = useMemo(() => [...new Set(DEFAULT_INSPECTION_CATEGORIES.flatMap((group) => group.items))], []);
  const total = items.length;
  const completed = items.filter((item) => inspected(checklist[item])).length;
  const applicableSkipped = items.filter((item) => checklist[item] === 'Not Applicable').length;
  const reviewedCount = completed + applicableSkipped;
  const good = items.filter((item) => checklist[item] === 'Good').length;
  const attention = items.filter((item) => ['Needs Attention', 'Critical'].includes(checklist[item])).length;
  const findings = inspection?.findings || [];
  const photos = inspection?.photos || [];
  const codes = inspection?.diagnosticScan?.codes || [];
  const isCompleted = inspection?.status === 'Completed';
  const isSkipped = inspection?.status === 'Skipped';
  const isStarted = inspection?.status === 'In Progress' || isCompleted;
  const editable = canEdit && Boolean(inspection) && !isSkipped && (!isCompleted || (canCorrect && editing));
  const maySkip = canEdit && !isCompleted && !isSkipped && inspection?.skipAllowed !== false;
  const skipBlockedReason = inspection?.skipBlockedReason || 'Inspection cannot be skipped in this stage.';
  const skipReason = skipChoice === 'Other' ? skipOther.trim() : skipChoice;
  const progress = total ? Math.round((reviewedCount / total) * 100) : 0;
  const activeGroups = DEFAULT_INSPECTION_CATEGORIES.map((group) => ({
    ...group,
    items: group.items.filter((item) => item.toLowerCase().includes(search.trim().toLowerCase()) || group.name.toLowerCase().includes(search.trim().toLowerCase()))
  })).filter((group) => group.items.length);

  const visibleGroup = activeGroups.find((group) => group.id === selectedGroup) || activeGroups[0];
  const groupPosition = activeGroups.findIndex((group) => group.id === visibleGroup?.id);

  const submitSkip = async (event) => {
    event.preventDefault();
    if (skipInFlight.current || busy || !maySkip) return;
    if (skipReason.length < 3 || skipReason.length > 160) {
      setError('Enter a skip reason between 3 and 160 characters.');
      return;
    }
    skipInFlight.current = true;
    try {
      const success = await perform('skip', () => jobInspectionService.skipInspection(job.id, skipReason));
      if (success) {
        setSkipConfirmOpen(false);
        setSkipOther('');
      }
    } finally {
      skipInFlight.current = false;
    }
  };

  const saveFinding = async (event) => {
    event.preventDefault();
    if (!finding.description.trim()) {
      setError('Describe the finding before saving.');
      return;
    }
    const saved = await perform('finding', () => jobInspectionService.addFinding(job.id, {
      ...finding,
      title: finding.description.trim(),
      description: finding.description.trim(),
      estimatedCost: finding.estimatedCost === '' ? null : Number(finding.estimatedCost),
      estimatedPartCharge: Number(finding.estimatedCost) || 0
    }));
    if (saved) setFinding(newFinding());
  };

  const saveDiagnostic = async (event) => {
    event.preventDefault();
    if (!diagnostic.code.trim()) return;
    const saved = await perform('diagnostic', () => jobInspectionService.addDiagnosticCode(job.id, {
      code: diagnostic.code.trim().toUpperCase(), description: diagnostic.description.trim()
    }));
    if (saved) setDiagnostic({ code: '', description: '' });
  };

  const savePhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size <= 0 || file.size > 10 * 1024 * 1024) {
      setError('Choose a JPEG, PNG or WebP image under 10 MB.');
      return;
    }
    await perform('photo', async () => {
      // Only the private Django file endpoint stores image bytes. The
      // inspection JSON contains a server-verified reference, not Base64.
      const uploaded = await vehiclePhotoService.upload({
        jobId: job.id, file, category: 'damage', phase: 'before',
        caption: file.name.slice(0, 255), published: true,
      });
      if (!uploaded?.id) throw new Error('Private photo upload was not confirmed.');
      await jobInspectionService.addInspectionPhoto(job.id, { photoId: uploaded.id });
    });
  };


  if (loading) return <div className="cg-inspection-loading" role="status">Loading vehicle inspection…</div>;

  return (
    <div className="cg-inspection" aria-label="Vehicle inspection">
      <section className="cg-inspection-overview">
        <div className="cg-inspection-overview-top">
          <div className="cg-inspection-overview-copy">
            <span className="cg-inspection-kicker">Vehicle inspection</span>
            <h3>{job.vehicleReg || job.vehicle?.registration || 'Vehicle'} <span>· {inspection?.status || 'Not Started'}</span></h3>
            <p>{isSkipped
              ? 'Inspection skipped with an audit trail. Existing checks, findings and photos are preserved.'
              : 'Check the vehicle, record issues, then complete inspection to continue.'}</p>
            {isSkipped && <div className="cg-inspection-skipped-detail" role="status">
              <strong>Skipped</strong>
              <span>Reason: {inspection.skipReason}</span>
              <span>{inspection.skippedBy || 'Authorized staff'} · {inspection.skippedAt ? new Date(inspection.skippedAt).toLocaleString() : 'Time unavailable'}</span>
            </div>}
          </div>
          <div className="cg-inspection-header-actions">
            <button type="button" className="cg-inspection-icon-button" aria-label="Refresh inspection" disabled={!!busy} onClick={() => perform('refresh', async () => {})}><RefreshCcw size={16} /></button>
            {isSkipped && canEdit && (
              <button type="button" className="cg-inspection-primary cg-inspection-reopen"
                disabled={!canReopen || !!busy}
                title={!canReopen ? 'Reopen the skipped Estimate first, or return before later stages have been completed.' : 'Restore this skipped inspection to editing'}
                onClick={() => perform('reopen', () => jobInspectionService.reopenInspection(job.id))}>
                <ClipboardCheck size={16} aria-hidden="true" />
                {busy === 'reopen' ? 'Reopening…' : 'Edit Skipped Inspection'}
              </button>
            )}
            {isCompleted && canCorrect && (
              <button type="button" className="cg-inspection-primary" disabled={!!busy}
                onClick={() => {
                  if (editing) onDoneEditing?.();
                  else setEditing(true);
                }}>
                {editing ? 'Done editing · Back to Estimate' : 'Edit Inspection'}
              </button>
            )}
          </div>
        </div>
        <div className="cg-inspection-stats" aria-label="Inspection summary">
          <div><span>Checked</span><strong>{completed} / {total}</strong></div>
          <div><span>Good</span><strong>{good}</strong></div>
          <div><span>Needs attention</span><strong>{attention}</strong></div>
          <div><span>Findings / N/A</span><strong>{findings.length} / {applicableSkipped}</strong></div>
        </div>
        <div className="cg-inspection-progress-head">
          <span>Checklist progress</span>
          <strong>{progress}%</strong>
        </div>
        <div className="cg-inspection-progress-track" role="progressbar" aria-label="Inspection checklist progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={reviewedCount}>
          <div style={{ width: progress + '%' }} />
        </div>
      </section>

      {error && <div className="cg-inspection-error" role="alert">{error}</div>}
      {!isStarted && !isSkipped && !canEdit && (
        <p className="cg-inspection-hint" role="status">Inspection is read-only for your role or the current job stage.</p>
      )}

      <section className="cg-inspection-checklist">
        <div className="cg-inspection-section-heading">
          <div>
            <h3><ClipboardCheck size={17} aria-hidden="true"/> Inspection checklist</h3>
            <p>Choose a category and tap a condition to save each check.</p>
          </div>
          <label className="cg-inspection-search">
            <Search size={16} aria-hidden="true"/>
            <input aria-label="Search inspection items" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search checks"/>
          </label>
        </div>
        {!isStarted && !isSkipped && canEdit && <p className="cg-inspection-hint">Choose Good, Attention, Critical or N/A to automatically start inspection and save your check.</p>}
        {isSkipped && <p className="cg-inspection-hint">Skipped — saved results are preserved. No unchecked items were marked Good. {canReopen ? 'Choose Edit Skipped Inspection above to continue.' : 'If Estimate was also skipped, reopen Estimate first. Completed work cannot be rolled back.'}</p>}
        <div className="cg-inspection-category-row">
          <label htmlFor="cg-inspection-category">Category</label>
          <select
            id="cg-inspection-category"
            value={visibleGroup?.id || ''}
            onChange={(e) => setSelectedGroup(e.target.value)}
            disabled={!activeGroups.length}
          >
            {activeGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name} ({group.items.filter((item) => reviewed(checklist[item])).length}/{group.items.length})
              </option>
            ))}
          </select>
          <span>{activeGroups.length ? groupPosition + 1 + ' / ' + activeGroups.length : 'No categories'}</span>
        </div>
        {visibleGroup ? (
          <div className="cg-inspection-check-rows">
            {visibleGroup.items.map((item) => {
              const selected = checklist[item] || 'Not Checked';
              return (
                <div key={item} className="cg-inspection-check-row">
                  <div className="cg-inspection-check-name">
                    <span>{item}</span>
                    <small>{selected === 'Not Checked' ? 'Not checked' : selected}</small>
                  </div>
                  <div className="cg-inspection-condition-actions" role="group" aria-label={item + ' condition'}>
                    {['Good', 'Needs Attention', 'Critical', 'Not Applicable'].map((status) => (
                      <button
                        type="button"
                        key={status}
                        disabled={!editable || !!busy}
                        aria-pressed={selected === status}
                        className={['cg-inspection-condition', status === 'Good' ? 'is-good' : status === 'Critical' ? 'is-critical' : status === 'Not Applicable' ? 'is-na' : 'is-attention', selected === status ? 'is-selected' : ''].join(' ')}
                        onClick={() => perform('check', () => jobInspectionService.updateChecklistItem(job.id, item, status))}
                      >
                        {status === 'Needs Attention' ? 'Attention' : status === 'Not Applicable' ? 'N/A' : status}
                      </button>
                    ))}
                    {selected !== 'Not Checked' && editable && (
                      <button type="button" className="cg-inspection-reset" aria-label={'Clear ' + item} title="Clear check" disabled={!editable || !!busy || !isStarted} onClick={() => perform('check', () => jobInspectionService.updateChecklistItem(job.id, item, 'Not Checked'))}>×</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="cg-inspection-empty">No checklist items match this search.</p>
        )}
        <div className="cg-inspection-category-footer">
          <span>{visibleGroup ? visibleGroup.items.filter((item) => reviewed(checklist[item])).length + ' of ' + visibleGroup.items.length + ' reviewed in this category' : 'Try another search'}</span>
          <button type="button" disabled={!visibleGroup || groupPosition >= activeGroups.length - 1} onClick={() => setSelectedGroup(activeGroups[groupPosition + 1].id)}>
            Next category <span aria-hidden="true">→</span>
          </button>
        </div>
      </section>

      <section className="cg-inspection-findings">
        <div className="cg-inspection-section-heading">
          <div>
            <h3><Wrench size={17} aria-hidden="true"/> Findings</h3>
            <p>Record issues that need repair or a customer estimate.</p>
          </div>
          <span className="cg-inspection-count">{findings.length} recorded</span>
        </div>
        {findings.length > 0 ? (
          <div className="cg-inspection-findings-list">
            {findings.map((item) => (
              <article key={item.id} className="cg-inspection-finding-card">
                <div className="cg-inspection-finding-body">
                  <strong>{item.description || item.title}</strong>
                  <small>{item.severity || 'Medium'} priority · {formatMoney(item.estimatedPartCharge ?? item.estimatedCost)}</small>
                  {item.recommendedAction && <p>{item.recommendedAction}</p>}
                </div>
                <div className="cg-inspection-finding-actions">
                  <button type="button" disabled={!!busy || item.addedToEstimate} onClick={() => perform('estimate', () => jobInspectionService.addFindingToEstimate(job.id, item.id))}>{item.addedToEstimate ? 'For estimate' : 'Mark for estimate'}</button>
                  {editable && <button type="button" disabled={!!busy} onClick={() => perform('delete', () => jobInspectionService.deleteFinding(job.id, item.id))} aria-label={'Delete finding ' + (item.description || item.title)}><Trash2 size={14}/></button>}
                </div>
              </article>
            ))}
          </div>
        ) : <p className="cg-inspection-empty">No issues recorded. You can complete a good-condition inspection without findings.</p>}
        <details className="cg-inspection-expand">
          <summary><Plus size={16} aria-hidden="true"/> Add finding</summary>
          <form onSubmit={saveFinding} className="cg-inspection-form">
            <label>Issue / damage
              <textarea required rows={3} placeholder="Describe the issue" value={finding.description} onChange={(e) => setFinding({ ...finding, description: e.target.value })}/>
            </label>
            <div className="cg-inspection-two-fields">
              <label>Severity
                <select value={finding.severity} onChange={(e) => setFinding({ ...finding, severity: e.target.value })}>
                  {['Low', 'Medium', 'High', 'Critical'].map((value) => <option key={value} value={value}>{value}</option>)}
                </select>
              </label>
              <label>Estimated parts cost (₹)
                <input type="number" min="0" step="0.01" placeholder="0" value={finding.estimatedCost} onChange={(e) => setFinding({ ...finding, estimatedCost: e.target.value })}/>
              </label>
            </div>
            <label>Recommended action
              <input placeholder="Repair, replace, inspect" value={finding.recommendedAction} onChange={(e) => setFinding({ ...finding, recommendedAction: e.target.value })}/>
            </label>
            <button type="submit" className="cg-inspection-primary" disabled={!editable || !!busy || !finding.description.trim()}>{busy === 'finding' ? 'Saving…' : 'Save finding'}</button>
          </form>
        </details>
      </section>

      <details className="cg-inspection-expand cg-inspection-attachments">
        <summary><Camera size={16} aria-hidden="true"/> Photos & Diagnostics <span>{photos.length + codes.length} added</span></summary>
        <div className="cg-inspection-attachment-content">
          <section>
            <h4>Inspection photos</h4>
            <p>Capture or upload a JPEG, PNG or WebP image (max 10 MB). Photos remain private until you explicitly publish them.</p>
            <label className={'cg-inspection-upload ' + (!editable || busy ? 'is-disabled' : '')}>
              <Camera size={16}/> Take / upload photo
              <input type="file" accept="image/*" capture="environment" disabled={!editable || !!busy} onChange={savePhoto}/>
            </label>
            <VehiclePhotoGallery jobId={job.id} canEdit={editable} canPublish={canEdit} refreshKey={photos.length} />
          </section>
          <section>
            <h4>Diagnostic codes</h4>
            <form onSubmit={saveDiagnostic} className="cg-inspection-form">
              <label>Fault code
                <input value={diagnostic.code} onChange={(e) => setDiagnostic({ ...diagnostic, code: e.target.value })} placeholder="e.g. P0300"/>
              </label>
              <label>Description
                <input value={diagnostic.description} onChange={(e) => setDiagnostic({ ...diagnostic, description: e.target.value })} placeholder="Fault description"/>
              </label>
              <button type="submit" disabled={!editable || !!busy || !diagnostic.code.trim()}>Add diagnostic code</button>
            </form>
            {!!codes.length && <div className="cg-inspection-code-list">{codes.map((code) => <div key={code.id}><strong>{code.code}</strong><span>{code.description || 'No description'}</span></div>)}</div>}
          </section>
        </div>
      </details>

      <footer className="cg-inspection-footer">
        <div>
          <strong>{isSkipped ? 'Inspection skipped' : isCompleted ? 'Inspection completed' : !isStarted ? 'Choose a condition to begin' : completed ? 'Ready to finish inspection' : 'Check the vehicle to continue'}</strong>
          <p>{isSkipped ? 'Reason: ' + (inspection.skipReason || 'Not supplied')
            : isCompleted
              ? canCorrect ? 'Use Edit Inspection to correct checks before estimate approval.' : 'Inspection is approved and read-only.'
              : 'Complete requires at least one checked result. Skip requires a reason.'}</p>
        </div>
        {isSkipped ? (
          <span className="cg-inspection-done is-skipped"><SkipForward size={16} /> Skipped</span>
        ) : isCompleted ? (
          <span className="cg-inspection-done"><CheckCircle2 size={16}/> {editing ? 'Editing' : 'Completed'}</span>
        ) : (
          <div className="cg-inspection-footer-actions">
            <button type="button" className="cg-inspection-secondary"
              disabled={!maySkip || !!busy}
              title={!maySkip ? skipBlockedReason : 'Skip without completing checklist'}
              onClick={() => { setError(''); setSkipConfirmOpen(true); }}>
              <SkipForward size={16} aria-hidden="true" /> Skip Inspection
            </button>
            <button type="button" className="cg-inspection-primary"
              disabled={!canEdit || !inspection || !!busy || !isStarted || completed === 0}
              onClick={() => perform('complete', () => jobInspectionService.completeInspection(job.id, true))}>
              <CheckCircle2 size={16} aria-hidden="true"/>
              {busy === 'complete' ? 'Finishing…' : 'Complete Inspection'}
            </button>
          </div>
        )}
      </footer>
      {!maySkip && !isSkipped && !isCompleted && <p className="cg-inspection-skip-policy" role="status">{skipBlockedReason}</p>}
      <ResponsiveModalSheet
        isOpen={skipConfirmOpen}
        onClose={() => { if (!busy) setSkipConfirmOpen(false); }}
        title="Confirm Skip Inspection"
        maxWidth="460px"
      >
        <form className="cg-inspection-skip-form" onSubmit={submitSkip}>
          <p>This skips the inspection stage without marking unchecked items Good. Your existing photos, results and findings remain saved.</p>
          <label htmlFor="cg-inspection-skip-reason">Skip Reason</label>
          <select id="cg-inspection-skip-reason" value={skipChoice}
            disabled={!!busy} onChange={(event) => setSkipChoice(event.target.value)}>
            {SKIP_REASONS.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
          </select>
          {skipChoice === 'Other' && (
            <label htmlFor="cg-inspection-skip-other">Describe the reason
              <textarea id="cg-inspection-skip-other" value={skipOther}
                minLength={3} maxLength={160} required disabled={!!busy}
                placeholder="Why is inspection not needed?"
                onChange={(event) => setSkipOther(event.target.value)} />
            </label>
          )}
          {error && <p className="cg-inspection-error" role="alert">{error}</p>}
          <div className="cg-inspection-skip-modal-actions">
            <button type="button" disabled={!!busy} className="cg-inspection-secondary" onClick={() => setSkipConfirmOpen(false)}>Cancel</button>
            <button type="submit" disabled={!!busy || skipReason.length < 3 || skipReason.length > 160} className="cg-inspection-primary">
              {busy === 'skip' ? 'Skipping…' : 'Confirm Skip Inspection'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>
    </div>
  );
}

export default JobInspectionPanel;
