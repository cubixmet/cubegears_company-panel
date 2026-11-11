import { ClipboardCheck, CreditCard, Wrench } from 'lucide-react';

export function JobCreateGuide() {
  return <div className="job-create-guide" role="note">
    <ClipboardCheck size={18} aria-hidden="true"/>
    <span>Start with the customer and vehicle, enter each complaint, then review everything before saving the Job Card.
      Assign staff and add photos if needed.</span>
  </div>;
}

export function JobDetailGuide() {
  return <div className="job-detail-guide" role="note">
    <Wrench size={18} aria-hidden="true"/>
    <span>Follow the steps below to finish the job. Inspection and estimate may be skipped when permitted.
      <CreditCard size={14} aria-hidden="true" className="job-detail-guide-inline"/>
      Customer payments must be recorded separately in Finance.</span>
  </div>;
}
