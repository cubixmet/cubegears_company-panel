import { useEffect, useMemo, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { RefreshCcw, X } from 'lucide-react';
import {
  StaffDirectoryCard,
  StaffDirectoryToolbar,
} from '../../components/staff-management';
import { getEmployeeLabel } from '../../components/staff-management/staffDisplay';
import { dailyWageService } from '../../services/dailyWage.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { staffService } from '../../services/staff.service';

export const Staff = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canViewPayroll = hasPermission(user, 'payroll.view');
  const canManagePayroll = hasPermission(user, 'payroll.edit');
  const canEditStaff = hasPermission(user, 'staff.edit');
  const [staffList, setStaffList] = useState([]);
  const [payPlans, setPayPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [error, setError] = useState('');

  const loadStaff = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await staffService.getStaff({ liveOnly: true });
      setStaffList(Array.isArray(data) ? data : []);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load staff.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStaff();
  }, []);

  const loadPayPlans = async () => {
    if (!canViewPayroll && !canManagePayroll) return;
    try {
      const ledger = await dailyWageService.dashboard();
      setPayPlans(Array.isArray(ledger?.employees) ? ledger.employees : []);
    } catch (error) {
      console.error('Unable to load staff daily wage rates', error);
      setPayPlans([]);
    }
  };

  useEffect(() => {
    loadPayPlans();
  }, [canViewPayroll, canManagePayroll]);

  const currentPlans = useMemo(() => new Map(
    payPlans.map((row) => [String(row.id), { dailyRate: row.dailyRate }]),
  ), [payPlans]);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLowerCase();

    return staffList.filter((item, index) => {
      const matchesSearch =
        !query ||
        [
          item.name,
          item.designation,
          item.role,
          item.department,
          getEmployeeLabel(item, index),
          item.employeeId,
          item.phone,
          typeof item.branch === 'object' ? item.branch?.name : item.branch,
        ].some((value) =>
          String(value || '').toLowerCase().includes(query),
        );

      const matchesBranch =
        selectedBranch === 'All' || item.branch === selectedBranch;

      const matchesStatus =
        selectedStatus === 'All' || item.employmentStatus === selectedStatus;

      return matchesSearch && matchesBranch && matchesStatus;
    });
  }, [staffList, search, selectedBranch, selectedStatus]);


  const hasActiveFilters = Boolean(search.trim()) || selectedBranch !== 'All' || selectedStatus !== 'All';

  const clearFilters = () => {
    setSearch('');
    setSelectedBranch('All');
    setSelectedStatus('All');
  };

  const handleToggleStatus = async (id) => {
    try {
      await staffService.toggleAccountStatus(id);
      await loadStaff();
    } catch (requestError) {
      setError(requestError?.message || 'Unable to update staff status.');
    }
  };

  return (
    <div className="staff-directory">
      <StaffDirectoryToolbar
        query={search}
        onQueryChange={setSearch}
        branch={selectedBranch}
        onBranchChange={setSelectedBranch}
        status={selectedStatus}
        onStatusChange={setSelectedStatus}
        onAdd={() => navigate('/staff-management/add')}
      />

      {error && (
        <div className="staff-directory-message is-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={loadStaff} disabled={loading}>
            <RefreshCcw size={15} aria-hidden="true" /> Retry
          </button>
        </div>
      )}

      <div className="staff-directory-results" role="status" aria-live="polite">
        <span>{loading ? 'Loading staff…' : error ? 'Staff data unavailable' : `${filteredStaff.length} of ${staffList.length} employees`}</span>
        {hasActiveFilters && (
          <button type="button" className="staff-directory-clear-filters" onClick={clearFilters}>
            <X size={15} aria-hidden="true" /> Clear Filters
          </button>
        )}
      </div>
      {loading ? (
        <div className="staff-workshop-empty">Loading staff…</div>
      ) : error ? (
        <div className="staff-workshop-empty">Staff could not be loaded. Use Retry above.</div>
      ) : filteredStaff.length ? (
        <div className={`staff-card-grid staff-directory-table ${canViewPayroll || canManagePayroll ? 'has-wages' : 'without-wages'}`}>
          <div className="staff-directory-table-header" aria-hidden="true">
            <span>Employee</span><span>Branch / Shift</span><span>Mobile / Login</span>
            {(canViewPayroll || canManagePayroll) && <span>Daily wage</span>}
            <span>Status</span><span>Actions</span>
          </div>
          {filteredStaff.map((staff, index) => (
            <StaffDirectoryCard
              key={staff.id}
              staff={staff}
              index={index}
              onOpen={() => navigate(`/staff-management/staff/${staff.id}`)}
              onToggleStatus={canEditStaff ? () => handleToggleStatus(staff.id) : undefined}
              payPlan={currentPlans.get(String(staff.id))}
              canViewPay={canViewPayroll || canManagePayroll}
              onConfigurePay={undefined}
              onOpenWages={canViewPayroll ? () => navigate(`/staff/${staff.id}/wages`) : undefined}
            />
          ))}
        </div>
      ) : (
        <div className="staff-workshop-empty">
          {hasActiveFilters ? 'No staff match these filters.' : 'No staff added yet.'}
          {hasActiveFilters && (
            <button type="button" className="staff-directory-clear-filters" onClick={clearFilters}>
              <X size={15} aria-hidden="true" /> Clear Filters
            </button>
          )}
        </div>
      )}


    </div>
  );
};
