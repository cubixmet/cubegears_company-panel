import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { appConfirm } from '../common/appDialogs';
import { jobService } from '../../services/job.service';
import {
  savedJobServices, serviceLineCharge, totalCustomerServiceCharges,
} from '../../utils/jobWorkServiceCharges';
import '../../styles/job-work-saved-services.css';

const money = value => new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format(Number(value) || 0);

export function JobWorkSavedServices({ job, canEdit = false, onChanged }) {
  const items = savedJobServices(job);
  const total = totalCustomerServiceCharges(job);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const removeService = async item => {
    if (!canEdit || removingId || !job?.id || !item?.id) return;
    const confirm = await appConfirm(
      `Remove "${item.service || 'this service'}" from this Job Card? The customer charge will be removed from draft invoice suggestions. This action is recorded in the Job Activity log.`,
      { title: 'Remove saved service', confirmLabel: 'Remove Service', tone: 'danger' },
    );
    if (!confirm) return;
    setRemovingId(item.id);
    setError('');
    setNotice('');
    try {
      const result = await jobService.removeJobService(job.id, item.id);
      await onChanged?.(result?.job);
      setNotice('Service removed from this Job Card. Activity history has been preserved.');
    } catch (err) {
      const data = err?.response?.data;
      setError(data?.workId || data?.stage || data?.detail || err?.message ||
        'Unable to remove this service. Check the Job Card stage and invoice status.');
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="job-work-saved-services" aria-label="Saved job services">
      <header className="job-work-saved-header">
        <div>
          <h3>Added Services</h3>
          <p>Customer charges recorded for this job. Not direct workshop costs.</p>
        </div>
        <span className="job-work-saved-count">{items.length} {items.length === 1 ? 'service' : 'services'}</span>
      </header>
      {error && <p className="job-work-saved-error" role="alert">{error}</p>}
      {notice && <p className="job-work-saved-notice" role="status">{notice}</p>}
      {items.length ? (
        <div className="job-work-saved-list">
          {items.map(item => (
            <article className="job-work-saved-row" key={item.id}>
              <div className="job-work-saved-info">
                <strong>{item.service || 'Service'}</strong>
                <small>{item.serviceCode || 'Service'} · Qty {item.quantity || 1}
                  {' '}× {money(item.customerRate)}</small>
                {item.mechanicName && <small>Mechanic: {item.mechanicName}</small>}
                {Number(item.agreedWorkerCharge || 0) > 0 &&
                  <small>Agreed worker charge: {money(item.agreedWorkerCharge)} — not yet paid</small>}
              </div>
              <div className="job-work-saved-actions">
                <strong>{money(serviceLineCharge(item))}</strong>
                {canEdit && (
                  <button type="button" className="job-work-saved-remove"
                    disabled={Boolean(removingId)}
                    onClick={() => removeService(item)}
                    aria-label={`Remove ${item.service || 'service'} from Job Card`}>
                    <Trash2 size={15} aria-hidden="true" />
                    {removingId === item.id ? 'Removing…' : 'Remove'}
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="job-work-saved-empty">No services added yet. Use Add Service above to record a customer charge.</p>
      )}
      <div className="job-work-saved-total">
        <span>Customer Service Charges <small>Not part of Total Cost</small></span>
        <strong>{money(total)}</strong>
      </div>
    </section>
  );
}

export default JobWorkSavedServices;
