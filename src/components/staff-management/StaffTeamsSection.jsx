import { useEffect, useMemo, useRef, useState } from "react";
import { Building2, Plus, Save, UserPlus, UsersRound } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { BranchCreateSheet } from './BranchCreateSheet';
import { branchService } from '../../services/branch.service';
import { staffManagementService } from '../../services/staffManagement.service';
import { staffService } from '../../services/staff.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { clearFieldValidation, showFormFieldError, showServerFormErrors } from '../../utils/formValidation';

export const StaffTeamsSection = ({ staff = [], teams = [], setTeams, setStaff }) => {
  const { user } = useAuth();
  const canManageBranches = hasPermission(user, 'company.manage');
  const [branches, setBranches] = useState([]);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [branchFormOpen, setBranchFormOpen] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [teamSuccess, setTeamSuccess] = useState('');
  const teamFormRef = useRef(null);
  const [teamStaffTarget, setTeamStaffTarget] = useState(null);
  const [teamStaffSelection, setTeamStaffSelection] = useState([]);
  const [savingTeamStaff, setSavingTeamStaff] = useState(false);
  const [teamStaffError, setTeamStaffError] = useState('');
  const [teamForm, setTeamForm] = useState({
    name: '',
    leadUserId: '',
    leadName: '',
    branchId: '',
    description: '',
  });

  const activeStaff = useMemo(
    () => staff.filter((item) =>
      ['Active', 'Probation', 'Notice Period'].includes(item.employmentStatus),
    ),
    [staff],
  );

  const loadBranches = async () => {
    const rows = await branchService.getBranches();
    const next = (Array.isArray(rows) ? rows : []).filter(
      (item) => item.is_active !== false,
    );
    setBranches(next);
    setTeamForm((current) => ({
      ...current,
      branchId: current.branchId || next[0]?.id || '',
    }));
    return next;
  };

  useEffect(() => {
    loadBranches();
  }, []);

  const createTeam = async (event) => {
    event.preventDefault();
    if (savingTeam) return;
    if (!teamForm.name.trim()) {
      showFormFieldError(teamFormRef.current, 'name', 'Team name is required.');
      return;
    }

    setSavingTeam(true);
    setTeamError('');
    setTeamSuccess('');
    try {
      const branch = branches.find(
        (item) => String(item.id) === String(teamForm.branchId),
      );

      await staffManagementService.createTeam({
        ...teamForm,
        branchName: branch?.name || 'All Branches',
      });

      const nextTeams = await staffManagementService.getTeams();
      setTeams(nextTeams);
      setTeamForm({
        name: '',
        leadUserId: '',
        leadName: '',
        branchId: branches[0]?.id || '',
        description: '',
      });
      setTeamFormOpen(false);
      setTeamSuccess('Team saved successfully.');
    } catch (cause) {
      showServerFormErrors(teamFormRef.current, cause, {
        name: 'name', branchId: 'branchId', leadUserId: 'leadUserId',
      });
      setTeamError(cause?.message || 'Unable to save team.');
    } finally {
      setSavingTeam(false);
    }
  };

  const toggleTeamStaff = (staffId) => {
    setTeamStaffSelection((current) =>
      current.includes(staffId)
        ? current.filter((id) => id !== staffId)
        : [...current, staffId],
    );
  };

  const assignTeamStaff = async (event) => {
    event.preventDefault();
    if (!teamStaffTarget || !teamStaffSelection.length || savingTeamStaff) return;

    setSavingTeamStaff(true);
    setTeamStaffError('');
    try {
      await staffManagementService.assignStaffToTeam(
        teamStaffTarget.id,
        teamStaffSelection,
      );
      setTeamStaffSelection([]);
      setTeamStaffTarget(null);
      const [nextTeams, nextStaff] = await Promise.all([
        staffManagementService.getTeams(),
        staffService.getStaff(),
      ]);
      setTeams(nextTeams);
      if (setStaff) setStaff(nextStaff);
    } catch (cause) {
      setTeamStaffError(cause?.message || 'Team assignment was not saved.');
    } finally {
      setSavingTeamStaff(false);
    }
  };

  const assignedCount = teams.reduce(
    (sum, team) =>
      sum + staff.filter((person) => String(person.teamId || '') === String(team.id)).length,
    0,
  );

  return (
    <div className="staff-dashboard-subpage">
      <section className="staff-subpage-header">
        <div>
          <h2>Departments & Teams</h2>
          <p>Organize workshop staff by team, team lead and branch.</p>
        </div>

        <div className="staff-subpage-actions">
          {canManageBranches && (
            <button
              type="button"
              className="staff-secondary-action"
              onClick={() => setBranchFormOpen(true)}
            >
              <Building2 size={14} />
              Add Branch
            </button>
          )}
          <button
            type="button"
            className="staff-primary-action"
            onClick={() => setTeamFormOpen(true)}
          >
            <Plus size={14} />
            Add Team
          </button>
        </div>
      </section>

      {teamSuccess && <div className="staff-action-success" role="status">{teamSuccess}</div>}
      <section className="staff-subpage-kpis">
        <article><UsersRound size={15}/><span>Total Teams</span><strong>{teams.length}</strong></article>
        <article><UserPlus size={15}/><span>Assigned Staff</span><strong>{assignedCount}</strong></article>
        <article><Building2 size={15}/><span>Active Branches</span><strong>{branches.length}</strong></article>
        <article><UsersRound size={15}/><span>Unassigned</span><strong>{Math.max(activeStaff.length - assignedCount, 0)}</strong></article>
      </section>

      <div className="staff-team-grid">
        {teams.map((team) => {
          const members = staff.filter((item) => String(item.teamId || '') === String(team.id));
          return (
            <article key={team.id} className="staff-workshop-panel staff-team-card">
              <div className="staff-team-card__head">
                <div>
                  <h3>{team.name}</h3>
                  <p>Lead: {team.lead || 'Not Assigned'}</p>
                </div>
                <span>{members.length}</span>
              </div>

              <div className="staff-team-card__meta">
                <span>{team.branchName || team.branch || 'All Branches'}</span>
                {team.description ? <p>{team.description}</p> : null}
              </div>

              <div className="staff-team-members">
                {members.length ? members.map((member) => (
                  <div key={member.id} className="staff-team-member">
                    {member.photo ? (
                      <img src={member.photo} alt="" />
                    ) : (
                      <span className="staff-team-member__avatar">
                        {member.name?.slice(0, 1)}
                      </span>
                    )}
                    <div>
                      <strong>{member.name}</strong>
                      <span>{member.role || 'No role'}</span>
                    </div>
                  </div>
                )) : (
                  <div className="staff-workshop-empty is-compact">No staff assigned.</div>
                )}
              </div>

              <button
                type="button"
                className="staff-team-assign-button"
                onClick={() => {
                  setTeamStaffTarget(team);
                  setTeamStaffSelection([]);
                }}
              >
                <UserPlus size={14}/>
                Add Staff
              </button>
            </article>
          );
        })}
      </div>

      <ResponsiveModalSheet
        isOpen={teamFormOpen}
        onClose={() => setTeamFormOpen(false)}
        title="Add Workshop Team"
        maxWidth="620px"
      >
        <form ref={teamFormRef} className="staff-crud-form" noValidate onSubmit={createTeam}
          onChange={event => clearFieldValidation(event.target)}>
          {teamError && <div className="staff-directory-message is-error" role="alert">{teamError}</div>}
          <label>
            Team / Department Name *
            <input
              name="name"
              required
              value={teamForm.name}
              onChange={(e) =>
                setTeamForm((old) => ({ ...old, name: e.target.value }))
              }
              placeholder="e.g. Diesel Team"
            />
          </label>

          <div className="staff-crud-form__grid">
            <label>
              Team Lead
              <select name="leadUserId"
                value={teamForm.leadUserId}
                onChange={(e) => {
                  const person = activeStaff.find(
                    (item) => String(item.user || '') === e.target.value,
                  );
                  setTeamForm((old) => ({
                    ...old,
                    leadUserId: e.target.value,
                    leadName: person?.name || '',
                  }));
                }}
              >
                <option value="">Not Assigned</option>
                {activeStaff
                  .filter((person) => person.user && (!teamForm.branchId || String(person.branchId || '') === String(teamForm.branchId)))
                  .map((person) => (
                    <option key={person.id} value={person.user}>
                      {person.name} · {person.role || 'No role'}
                    </option>
                  ))}
              </select>
            </label>

            <label>
              Branch
              <div className="staff-branch-select-row">
                <select name="branchId"
                  value={teamForm.branchId}
                  onChange={(e) =>
                    setTeamForm((old) => ({
                      ...old,
                      branchId: e.target.value,
                      leadUserId: '',
                      leadName: '',
                    }))
                  }
                >
                  <option value="">All Branches</option>
                  {branches.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
                {canManageBranches && (
                  <button
                    type="button"
                    className="staff-inline-create-button"
                    onClick={() => setBranchFormOpen(true)}
                  >
                    + Branch
                  </button>
                )}
              </div>
            </label>
          </div>

          <label>
            Description
            <textarea
              rows={3}
              value={teamForm.description}
              onChange={(e) =>
                setTeamForm((old) => ({
                  ...old,
                  description: e.target.value,
                }))
              }
              placeholder="What this team handles in the workshop"
            />
          </label>

          <div className="staff-crud-form__actions">
            <button
              type="button"
              className="staff-crud-cancel-button"
              onClick={() => setTeamFormOpen(false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="staff-crud-save-button"
              disabled={savingTeam}
            >
              <Save size={14}/>
              {savingTeam ? 'Creating...' : 'Create Team'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>

      <ResponsiveModalSheet
        isOpen={Boolean(teamStaffTarget)}
        onClose={() => {
          setTeamStaffTarget(null);
          setTeamStaffSelection([]);
          setTeamStaffError('');
        }}
        title={teamStaffTarget ? `Add Staff to ${teamStaffTarget.name}` : 'Add Staff'}
        maxWidth="620px"
      >
        <form className="staff-crud-form" onSubmit={assignTeamStaff}>
          <div className="staff-assignment-note">
            Selected staff will move to <strong>{teamStaffTarget?.name}</strong>. Staff must belong to the team's branch.
          </div>
          {teamStaffError && <div className="staff-directory-message is-error" role="alert">{teamStaffError}</div>}

          <fieldset className="staff-crud-assignment-fieldset">
            <legend>Select Staff</legend>
            <div className="staff-crud-check-grid">
              {activeStaff
                .filter((person) => String(person.teamId || '') !== String(teamStaffTarget?.id) &&
                  (!teamStaffTarget?.branchId || String(person.branchId || '') === String(teamStaffTarget.branchId)))
                .map((person) => (
                  <label key={person.id} className="staff-crud-check">
                    <input
                      type="checkbox"
                      checked={teamStaffSelection.includes(person.id)}
                      onChange={() => toggleTeamStaff(person.id)}
                    />
                    <span>
                      <strong>{person.name}</strong>
                      <small>{person.role || 'No role'} · {person.branch || 'No branch'}</small>
                    </span>
                  </label>
                ))}
            </div>
          </fieldset>

          <div className="staff-crud-form__actions">
            <button
              type="button"
              className="staff-crud-cancel-button"
              onClick={() => setTeamStaffTarget(null)}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="staff-crud-save-button"
              disabled={!teamStaffSelection.length || savingTeamStaff}
            >
              <UserPlus size={14}/>
              {savingTeamStaff ? 'Assigning...' : 'Add Staff'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>

      <BranchCreateSheet
        isOpen={canManageBranches && branchFormOpen}
        onClose={() => setBranchFormOpen(false)}
        onCreate={async (data) => {
          const created = await branchService.createBranch(data);
          const next = await loadBranches();
          if (created?.id) {
            setTeamForm((old) => ({ ...old, branchId: created.id }));
          } else if (next[0]?.id) {
            setTeamForm((old) => ({ ...old, branchId: next[0].id }));
          }
        }}
      />
    </div>
  );
};
