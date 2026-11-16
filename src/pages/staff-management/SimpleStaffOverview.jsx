import { useEffect, useMemo, useState } from "react";
import { ChevronRight, Plus, RefreshCcw, Search, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { staffService } from '../../services/staff.service';

const ACTIVE_STATUSES = new Set(['active', 'probation', 'notice period']);

const normalizedStatus = (value) => String(value || '').trim().toLowerCase();
const readable = (value) => typeof value === 'string' && value.trim() ? value.trim() : '—';

export const SimpleStaffOverview = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canAdd = hasPermission(user, 'staff.create');
  const canManageRoles = hasPermission(user, 'company.manage');
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        // Overview always reads the real tenant employee API, including
        // when a developer opted into mock mode for unrelated screens.
        const rows = await staffService.getStaff({ liveOnly: true });
        if (active) setStaff(Array.isArray(rows) ? rows : []);
      } catch (requestError) {
        if (active) {
          setStaff([]);
          setError(requestError?.message || 'Unable to load staff from the server.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [reload]);

  const stats = useMemo(() => {
    const active = staff.filter(person => ACTIVE_STATUSES.has(normalizedStatus(person.employmentStatus))).length;
    const pendingSetup = staff.filter(person => person.loginStatus === 'Pending Password Setup').length;
    const teams = new Set(staff.map(person => person.teamId || person.department).filter(Boolean)).size;
    const roles = new Set(staff.map(person => person.roleId || person.role).filter(Boolean)).size;
    return { total: staff.length, active, other: staff.length - active, pendingSetup, teams, roles };
  }, [staff]);

  const matchingStaff = useMemo(() => {
    const search = query.toLowerCase().trim();
    if (!search) return staff;
    return staff.filter(person => [
      person.name,
      person.employeeId,
      person.displayEmployeeNo,
      person.role,
      person.department,
      person.branch,
    ].some(value => String(value || '').toLowerCase().includes(search)));
  }, [staff, query]);

  return (
    <div className="staff-simple-overview">
      <header className="staff-simple-toolbar">
        <div className="staff-simple-toolbar-actions">
          <button type="button" className="staff-simple-secondary" onClick={() => setReload(value => value + 1)} disabled={loading}>
            <RefreshCcw size={16} aria-hidden="true" /> Refresh
          </button>
          {canManageRoles && (
            <button type="button" className="staff-simple-secondary" onClick={() => navigate('/staff-management/roles')}>
              <ShieldCheck size={17} /> Roles & Permissions
            </button>
          )}
          {canAdd && (
            <button type="button" className="staff-simple-primary" onClick={() => navigate('/staff-management/add')}>
              <Plus size={17} /> Add Staff
            </button>
          )}
        </div>
      </header>

      {error && (
        <div className="staff-simple-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReload(value => value + 1)}>
            <RefreshCcw size={16} /> Retry
          </button>
        </div>
      )}

      <section className="staff-simple-metrics" aria-label="Staff totals">
        <article><span><Users size={18} aria-hidden="true" /> Total Staff</span><strong>{loading || error ? '—' : stats.total}</strong></article>
        <article><span><UserCheck size={18} aria-hidden="true" /> Active Staff</span><strong>{loading || error ? '—' : stats.active}</strong></article>
        <article><span><UserX size={18} aria-hidden="true" /> Other Status</span><strong>{loading || error ? '—' : stats.other}</strong></article>
        <article><span><ShieldCheck size={18} aria-hidden="true" /> Pending Password Setup</span><strong>{loading || error ? '—' : stats.pendingSetup}</strong></article>
        <article><span><Users size={18} aria-hidden="true" /> Teams</span><strong>{loading || error ? '—' : stats.teams}</strong></article>
        <article><span><ShieldCheck size={18} aria-hidden="true" /> Roles</span><strong>{loading || error ? '—' : stats.roles}</strong></article>
      </section>

      <section className="staff-simple-list" aria-label="Staff directory preview">
        <div className="staff-simple-list-head">
          <div>
            <h3>Employees</h3>
            <p role="status" aria-live="polite">
              {loading ? 'Loading staff…' : error ? 'Unable to load staff' : `${matchingStaff.length} of ${staff.length} staff`}
            </p>
          </div>
          <button type="button" onClick={() => navigate('/staff-management/staff')}>
            View All Staff <ChevronRight size={17} aria-hidden="true" />
          </button>
        </div>
        <label className="staff-simple-search">
          <Search size={18} aria-hidden="true" />
          <input type="search" value={query} onChange={event => setQuery(event.target.value)}
            placeholder="Search name, ID, role or branch"
            aria-label="Search staff" />
        </label>
        {loading ? (
          <div className="staff-simple-empty" role="status">Loading staff records…</div>
        ) : error ? (
          <div className="staff-simple-empty">Staff records could not be loaded.</div>
        ) : !matchingStaff.length ? (
          <div className="staff-simple-empty">
            {query ? 'No staff match your search.' : 'No staff added yet.'}
            {!query && canAdd && <button type="button" onClick={() => navigate('/staff-management/add')}>Add your first staff member</button>}
          </div>
        ) : (
          <div className="staff-simple-rows">
            {matchingStaff.slice(0, 8).map(person => (
              <button type="button" className="staff-simple-person" key={person.id}
                onClick={() => navigate(`/staff-management/staff/${person.id}`)}
                aria-label={`View ${readable(person.name)} profile`}>
                <span className="staff-simple-avatar" aria-hidden="true">{String(person.name || '?').trim().charAt(0).toUpperCase()}</span>
                <span className="staff-simple-person-details">
                  <strong>{readable(person.name)}</strong>
                  <small>{readable(person.displayEmployeeNo || person.employeeId)} · {readable(person.role)}</small>
                </span>
                <span className="staff-simple-person-branch" title={readable(person.branch)}>{readable(person.branch)}</span>
                <span className={`staff-simple-status${ACTIVE_STATUSES.has(normalizedStatus(person.employmentStatus)) ? ' is-active' : ''}`} title={readable(person.employmentStatus)}>
                  {readable(person.employmentStatus)}
                </span>
                <ChevronRight className="staff-simple-person-arrow" size={18} aria-hidden="true" />
              </button>
            ))}
            {matchingStaff.length > 8 && <p className="staff-simple-more">Showing 8 of {matchingStaff.length} matching staff. Use View All Staff for the full list.</p>}
          </div>
        )}
      </section>
    </div>
  );
};
