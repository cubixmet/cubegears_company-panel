import { Link } from 'react-router-dom';
import { Eye, Power, WalletCards } from 'lucide-react';
import { StaffAvatar } from './StaffAvatar';
import { getEmployeeLabel } from './staffDisplay';

const statusTone = (status = '') => status === 'Active'
  ? 'success'
  : ['Probation', 'Notice Period'].includes(status) ? 'warning' : 'danger';

// A compact directory row on desktop and a small readable staff card on mobile.
// This is display-only: all actions still use the existing authorized handlers.
export const StaffDirectoryCard = ({
  staff,
  index,
  onOpen,
  onToggleStatus,
  payPlan,
  canViewPay = false,
  onOpenWages,
}) => {
  const rate = Number(payPlan?.dailyRate);
  const hasRate = payPlan?.dailyRate != null
    && payPlan.dailyRate !== '' && Number.isFinite(rate);

  return (
    <article className="staff-directory-card staff-directory-row">
      <Link className="staff-directory-full-link" to={`/staff-management/staff/${encodeURIComponent(staff.id)}`}
        aria-label={`Open ${staff.name} staff profile`} />
      <div className="staff-directory-cell staff-directory-person" data-label="Staff">
        <StaffAvatar staff={staff} size="md" />
        <div className="staff-directory-person-copy">
          <strong>{staff.name}</strong>
          <span>{getEmployeeLabel(staff, index)} · {staff.role || 'No role'}</span>
        </div>
      </div>
      <div className="staff-directory-cell staff-directory-branch" data-label="Branch">
        <span>{typeof staff.branch === 'object' ? staff.branch?.name || '—' : staff.branch || '—'}</span>
        {staff.shift && <small>{staff.shift}</small>}
      </div>
      <div className="staff-directory-cell staff-directory-contact" data-label="Mobile">
        <span>{staff.phone || '—'}</span>
        <small>{staff.loginStatus || 'Not invited'}</small>
      </div>
      {canViewPay && (
        <div className="staff-directory-cell staff-directory-wage" data-label="Daily wage">
          <span>{hasRate ? `₹${rate.toLocaleString('en-IN')}/day` : 'Not set'}</span>
          {onOpenWages && (
            <button type="button" onClick={onOpenWages} className="staff-row-link">
              <WalletCards size={14} aria-hidden="true" /> Wage account
            </button>
          )}
        </div>
      )}
      <div className="staff-directory-cell staff-directory-status-cell" data-label="Status">
        <span className={`staff-directory-status is-${statusTone(staff.employmentStatus)}`}>
          {staff.employmentStatus || 'Active'}
        </span>
      </div>
      <div className="staff-directory-cell staff-directory-row-actions">
        <button type="button" className="staff-view-button" onClick={onOpen}
          aria-label={`View ${staff.name} profile`}>
          <Eye size={15} aria-hidden="true" />
          View
        </button>
        {onToggleStatus && (
          <button type="button" className={`staff-status-button ${staff.accountStatus === 'Active' ? 'is-danger' : 'is-success'}`}
            aria-label={staff.accountStatus === 'Active' ? `Deactivate ${staff.name}` : `Activate ${staff.name}`}
            title={staff.accountStatus === 'Active' ? 'Deactivate login' : 'Activate login'}
            onClick={onToggleStatus}>
            <Power size={15} aria-hidden="true" />
          </button>
        )}
      </div>
    </article>
  );
};
