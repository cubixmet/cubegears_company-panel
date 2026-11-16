import { recordLabel } from '../../utils/recordReferences.js';

import { Briefcase } from 'lucide-react';

export const StaffAssignmentsPanel = ({ assignments, staff }) => (
  <section className="staff-dashboard-assignments">
    <header className="staff-dashboard-section-title">
      <div>
        <h2>Active Job Assignments</h2>
        <p>Mechanic and supervisor workload from current job cards.</p>
      </div>
      <Briefcase size={15} />
    </header>

    <div className="staff-dashboard-assignment-grid">
      {assignments.map((job) => {
        const person = staff.find((item) => item.id === job.staffId);
        return (
          <article key={job.id} className="staff-dashboard-assignment-card">
            <div className="staff-dashboard-assignment-head">
              <strong>{recordLabel(job.id)}</strong>
              <span>{job.status}</span>
            </div>
            <h3>{job.vehicle}</h3>
            <p>{job.work}</p>
            <div className="staff-dashboard-assignment-meta">
              <span>{person?.name || 'Assigned Staff'}</span>
              <b>{job.bookedHours}h</b>
            </div>
            <div className="staff-dashboard-progress">
              <i style={{ width: `${job.progress}%` }} />
            </div>
          </article>
        );
      })}

      {!assignments.length && (
        <div className="staff-dashboard-empty">No active job assignments.</div>
      )}
    </div>
  </section>
);
