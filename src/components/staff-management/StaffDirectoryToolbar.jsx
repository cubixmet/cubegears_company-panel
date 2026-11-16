import { useEffect, useState } from "react";
import { Plus, Search } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { branchService } from '../../services/branch.service';

export const StaffDirectoryToolbar = ({
  query,
  onQueryChange,
  branch,
  onBranchChange,
  status,
  onStatusChange,
  onAdd,
}) => {
  const { user } = useAuth();
  const [branches, setBranches] = useState([]);

  useEffect(() => {
    branchService.getBranches()
      .then((rows) =>
        setBranches(
          (Array.isArray(rows) ? rows : []).filter(
            (item) => item.is_active !== false,
          ),
        ),
      )
      .catch(() => setBranches([]));
  }, []);

  return (
    <section className="staff-directory-toolbar">
      <label className="staff-directory-search">
        <Search size={18} aria-hidden="true" />
        <input
          type="search"
          aria-label="Search employees"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search name, ID, role or mobile number"
        />
      </label>

      <select aria-label="Filter staff by branch" value={branch} onChange={(event) => onBranchChange(event.target.value)}>
        <option value="All">All Branches</option>
        {branches.map((item) => (
          <option key={item.id} value={item.name}>
            {item.name}
          </option>
        ))}
      </select>

      <select aria-label="Filter staff by status" value={status} onChange={(event) => onStatusChange(event.target.value)}>
        <option value="All">All Status</option>
        <option value="Active">Active</option>
        <option value="Probation">Probation</option>
        <option value="Notice Period">Notice Period</option>
        <option value="Suspended">Suspended</option>
        <option value="Resigned">Resigned</option>
        <option value="Terminated">Terminated</option>
        <option value="Inactive">Inactive</option>
      </select>

      {hasPermission(user, 'staff.create') && (
        <button type="button" className="staff-add-button" onClick={onAdd}>
          <Plus size={16} aria-hidden="true" />
          Add Staff
        </button>
      )}
    </section>
  );
};
