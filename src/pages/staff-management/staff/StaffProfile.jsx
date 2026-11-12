import '../../../styles/staff-payment-settings.css';
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  Clock3,
  Copy,
  FilePlus2,
  FileText,
  Gauge,
  Lock,
  Pencil,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Unlock,
  User,
  WalletCards,
  Settings2,
  Wrench,
} from 'lucide-react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  StaffAttendanceCalendar,
  StaffAvatar,
  StaffDocumentAddSheet,
  StaffProfileEditSheet,
} from '../../../components/staff-management';
import { EmployeePayConfigurationSheet } from '../../../components/payroll/EmployeePayConfigurationSheet';
import { ResponsiveModalSheet } from '../../../components/common/ResponsiveModalSheet';
import { getEmployeeLabel } from '../../../components/staff-management/staffDisplay';
import { useAuth } from '../../../hooks/useAuth';
import { useFeatureAccess } from '../../../context/FeatureAccessContext';
import { staffInviteDeliveryMessage, staffInviteErrorMessage } from '../../../utils/staffInviteDelivery';
import { attendanceManagerService } from '../../../services/attendanceManager.service';
import { jobService } from '../../../services/job.service';
import { roleService } from '../../../services/role.service';
import { staffService } from '../../../services/staff.service';
import { copyManualStaffInvite, shareManualStaffInvite } from '../../../utils/staffManualInvite';
import '../../../styles/staff-mobile-onboarding.css';
import { staffManagementService } from '../../../services/staffManagement.service';
import { dailyWageService } from '../../../services/dailyWage.service';

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const currentMonthValue = () => new Date().toISOString().slice(0, 7);

const displayText = (value, fallback = '—') => {
  if (value === null || value === undefined || value === '') return fallback;

  if (typeof value === 'string' || typeof value === 'number') {
    return String(value);
  }

  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }

  if (Array.isArray(value)) {
    const text = value
      .map((item) => displayText(item, ''))
      .filter(Boolean)
      .join(', ');
    return text || fallback;
  }

  if (typeof value === 'object') {
    const preferredKeys = [
      'description',
      'name',
      'title',
      'label',
      'code',
      'status',
      'value',
    ];

    for (const key of preferredKeys) {
      const candidate = value[key];
      if (
        candidate !== null &&
        candidate !== undefined &&
        candidate !== '' &&
        (typeof candidate === 'string' || typeof candidate === 'number')
      ) {
        return String(candidate);
      }
    }

    const primitiveValues = Object.values(value)
      .filter(
        (item) =>
          item !== null &&
          item !== undefined &&
          item !== '' &&
          (typeof item === 'string' || typeof item === 'number'),
      )
      .map(String);

    return primitiveValues.join(' · ') || fallback;
  }

  return String(value);
};


const TABS = [
  ['Overview', User],
  ['Attendance', CalendarDays],
  ['Assigned Work', BriefcaseBusiness],
  ['Payroll', WalletCards],
  ['Documents', FileText],
];

const InfoItem = ({ label, value, icon: Icon }) => (
  <div className="staff360-info-item">
    {Icon ? <Icon size={14} /> : null}
    <div>
      <span>{label}</span>
      <strong>{displayText(value)}</strong>
    </div>
  </div>
);

const normalizeDocument = (document = {}) => ({
  ...document,
  name: document.name || document.title || 'Document',
  type: document.type || document.document_type || 'Document',
  uploadedDate:
    document.uploadedDate ||
    document.created_at?.slice?.(0, 10) ||
    '—',
  uploadedBy: document.uploadedBy || document.uploaded_by || 'Admin',
  fileUrl: document.fileUrl || document.file_url || '',
  expiryDate: document.expiryDate || document.expiry_date || '',
  staffId:
    document.staffId ||
    document.employee ||
    document.employeeId ||
    document.employee_id,
});

const normalizeActivity = (item = {}) => ({
  ...item,
  actor: displayText(item.actorName || item.actor, 'System'),
  timestamp:
    item.created_at ||
    item.timestamp ||
    '',
  details: displayText(
    item.details ||
      [item.oldValue, item.newValue].filter(Boolean).join(' → '),
    '',
  ),
});

export const StaffProfile = ({ staffId: staffIdProp }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { staffId: routeStaffId } = useParams();
  const staffId = staffIdProp || routeStaffId;
  const { user } = useAuth();
  const { can } = useFeatureAccess();

  const [staff, setStaff] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [loading, setLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState('');
  const [inviteNotice, setInviteNotice] = useState(() => staffInviteDeliveryMessage(location.state?.whatsappInviteStatus));
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState(null);
  const [errorRequestId, setErrorRequestId] = useState(null);
  const [supportWarning, setSupportWarning] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [inviteBusy, setInviteBusy] = useState(false);

  const [roles, setRoles] = useState([]);
  const [teams, setTeams] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [skills, setSkills] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [activities, setActivities] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [jobsError, setJobsError] = useState('');

  const [attendanceMonth, setAttendanceMonth] = useState(currentMonthValue());
  const [attendanceCalendar, setAttendanceCalendar] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [documentOpen, setDocumentOpen] = useState(false);
  const [paymentSettingsOpen, setPaymentSettingsOpen] = useState(false);
  const [wageRateOpen, setWageRateOpen] = useState(false);
  const [paymentSettingsBusy, setPaymentSettingsBusy] = useState(false);
  const [paymentSettingsError, setPaymentSettingsError] = useState('');
  const [paymentStructure, setPaymentStructure] = useState(null);

  const isOwnProfile =
    Boolean(user?.employeeProfileId) &&
    String(user.employeeProfileId) === String(staffId);

  const canEdit = can('staff.edit');
  const canManageLogin = canEdit && can('company.manage');
  const canReadRoles = can('company.manage');
  const canViewJobs = can('jobs.view');
  const canManageAttendance = can('attendance.manage');
  const canViewPayroll = can('payroll.view');
  const canManagePayroll = can('payroll.edit');
  const canEditWageRate = canViewPayroll && can('payroll.rates.manage');
  const canRecordWagePayment = canViewPayroll && can('payroll.payments.record');
  const canEditPaymentSettings = canEditWageRate || canRecordWagePayment;
  // The owner and system administrators manage their own password under
  // Account Security. Django correctly rejects a staff invitation for them.
  const canResetStaffPassword = canManageLogin && !isOwnProfile &&
    !['owner', 'super admin', 'platform admin'].includes(String(staff?.role || '').trim().toLowerCase());
  const visibleTabs = TABS.filter(([tab]) =>
    !['Assigned Work', 'Performance'].includes(tab) || canViewJobs
  ).filter(([tab]) =>
    tab !== 'Attendance' || canManageAttendance || isOwnProfile
  ).filter(([tab]) =>
    tab !== 'Payroll' || canViewPayroll || canManagePayroll || isOwnProfile
  );

  const showToast = (message) => {
    setToastMsg(message);
    window.setTimeout(() => setToastMsg(''), 2600);
  };

  const loadStaff = async () => {
    const profile = isOwnProfile
      ? await staffService.getMyStaff()
      : await staffService.getStaffById(staffId);
    setStaff(profile);
    return profile;
  };

  const loadSupportData = async (profile) => {
    // Role editing is loaded separately after a permission check.
    // Keep these indices aligned: teams, shifts, skills, documents, activities.
    const tasks = [
      staffManagementService.getTeams(),
      staffManagementService.getShifts(),
      staffManagementService.getSkills(),
      staffManagementService.getDocuments(),
      staffService.getActivities(profile.id),
    ];

    const results = await Promise.allSettled(tasks);
    const value = (index, fallback = []) =>
      results[index]?.status === 'fulfilled'
        ? results[index].value
        : fallback;
    setSupportWarning(results.some(result => result.status === 'rejected')
      ? 'Some optional profile information could not load. The staff record is still available.'
      : '');

    setTeams(Array.isArray(value(0)) ? value(0) : []);
    setShifts(Array.isArray(value(1)) ? value(1) : []);
    setSkills(Array.isArray(value(2)) ? value(2) : []);

    const allDocuments = Array.isArray(value(3)) ? value(3) : [];
    setDocuments(
      allDocuments
        .map(normalizeDocument)
        .filter((document) =>
          String(document.staffId || '') === String(profile.id),
        ),
    );

    setActivities(
      (Array.isArray(value(4)) ? value(4) : []).map(normalizeActivity),
    );

  };

  const refreshAll = async () => {
    setLoading(true);
    setError('');
    setErrorStatus(null);
    setErrorRequestId(null);
    try {
      const profile = await loadStaff();
      await loadSupportData(profile);
    } catch (requestError) {
      setError(requestError?.message || 'Unable to load staff profile.');
      setErrorStatus(requestError?.status || null);
      setErrorRequestId(requestError?.requestId || null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Do not show a previous employee's details while a new route loads.
    setStaff(null);
    refreshAll();
  }, [staffId]);

  useEffect(() => {
    if (!canViewJobs && ['Assigned Work', 'Performance'].includes(activeTab)) {
      setActiveTab('Overview');
    }
  }, [activeTab, canViewJobs]);

  // Roles are administrator-only; ordinary staff must not make forbidden
  // /roles/ requests on profile load.
  useEffect(() => {
    if (!staff?.id || !canReadRoles) {
      setRoles([]);
      return undefined;
    }
    let alive = true;
    roleService.getRoles()
      .then((rows) => { if (alive) setRoles(Array.isArray(rows) ? rows : []); })
      .catch(() => { if (alive) setRoles([]); });
    return () => { alive = false; };
  }, [staff?.id, canReadRoles]);

  // Jobs is a separate, optionally paid module: never request /jobs on a
  // free Staff profile. Fetch real jobs only when a permitted work tab opens.
  useEffect(() => {
    if (!staff?.id || !canViewJobs || !['Assigned Work', 'Performance'].includes(activeTab)) {
      setJobs([]);
      setJobsError('');
      setJobsLoading(false);
      return undefined;
    }
    let alive = true;
    setJobs([]);
    setJobsError('');
    setJobsLoading(true);
    jobService.getJobs({ liveOnly: true })
      .then((allJobs) => {
        if (!alive) return;
        const linkedUser = staff.user;
        const matched = (Array.isArray(allJobs) ? allJobs : []).filter((job) =>
          [job.technician, job.technicianId, job.assignedEmployee,
           job.assignedEmployeeId, job.staffId].some((value) =>
            String(value || '') === String(linkedUser || staff.id)
          )
        );
        setJobs(matched);
      })
      .catch((err) => { if (alive) setJobsError(err?.message || 'Unable to load assigned work.'); })
      .finally(() => { if (alive) setJobsLoading(false); });
    return () => { alive = false; };
  }, [staff?.id, staff?.user, activeTab, canViewJobs]);

  useEffect(() => {
    if (!staff || !canManageAttendance) {
      setAttendanceCalendar(null);
      return;
    }

    const [year, month] = attendanceMonth.split('-').map(Number);
    attendanceManagerService
      .getMonthlyCalendar(month, year)
      .then(setAttendanceCalendar)
      .catch(() => setAttendanceCalendar(null));
  }, [staff?.id, attendanceMonth, canManageAttendance]);

  const attendanceEmployee = useMemo(() => {
    const rows = attendanceCalendar?.employees || [];
    return rows.find((row) =>
      String(row.employeeId || '') === String(staff?.id || '') ||
      String(row.staffId || '') === String(staff?.employeeId || ''),
    );
  }, [attendanceCalendar, staff]);

  const attendanceSummary = useMemo(() => {
    const days = Object.values(attendanceEmployee?.days || {});
    const count = (status) =>
      days.filter((day) => day.status === status).length;

    return {
      present: count('Present'),
      absent: count('Absent'),
      leave: count('On Leave'),
      late: days.filter((day) => Number(day.lateMinutes || 0) > 0).length,
      weeklyOff: count('Weekly Off'),
      holidays: count('Holiday'),
    };
  }, [attendanceEmployee]);

  const performance = useMemo(() => {
    const completed = jobs.filter((job) => job.status === 'Delivered');
    const labourRevenue = completed.reduce(
      (sum, job) =>
        sum + Number(job.labourTotal || job.labour_total || 0),
      0,
    );
    const ratings = jobs
      .map((job) => Number(job.customerRating || job.customer_rating || 0))
      .filter((rating) => rating > 0);

    return {
      jobsCompleted: completed.length,
      labourRevenue,
      productiveHours: jobs.reduce(
        (sum, job) => sum + Number(job.bookedHours || job.productiveHours || 0),
        0,
      ),
      utilization: 0,
      comebackJobs: jobs.filter((job) => job.isComeback || job.comeback).length,
      customerRating: ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0,
      averageLabourValue: completed.length
        ? labourRevenue / completed.length
        : 0,
    };
  }, [jobs, staff]);

  const handleSendInvite = async () => {
    if (inviteBusy || !canResetStaffPassword || !staff?.id) return;
    setInviteBusy(true);
    setInviteError('');
    setInviteNotice('');
    try {
      const handoff = await shareManualStaffInvite(
        () => staffService.sendLoginInvite(staff.id, {
          manualOnly: true,
          replace: staff.loginStatus === 'Active',
        }),
        { phone: staff.phone, staffName: staff.name, workshopName: user?.company?.name },
      );
      setInviteNotice(handoff.localOnlyLink
        ? 'WhatsApp opened, but the setup URL is localhost. Set backend FRONTEND_URL to the public HTTPS company-panel address before the employee opens the link.'
        : 'Password link is ready in WhatsApp. Review it and press Send to share manually.');
      await refreshAll();
    } catch (requestError) {
      setInviteError(staffInviteErrorMessage(requestError));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (inviteBusy || !canResetStaffPassword || !staff?.id) return;
    setInviteBusy(true);
    setInviteError('');
    setInviteNotice('');
    try {
      await copyManualStaffInvite(
        () => staffService.sendLoginInvite(staff.id, {
          manualOnly: true,
          replace: staff.loginStatus === 'Active',
        }),
        { phone: staff.phone, staffName: staff.name, workshopName: user?.company?.name },
      );
      setInviteNotice('Setup message copied. Paste it into the staff WhatsApp chat and manually press Send.');
      await refreshAll();
    } catch (cause) {
      setInviteError(staffInviteErrorMessage(cause));
    } finally {
      setInviteBusy(false);
    }
  };

  const handleToggleAccount = async () => {
    try {
      await staffService.setLoginAccess(staff.id, staff.loginStatus === 'Disabled' || staff.loginStatus === 'Not Invited');
      showToast(staff.loginStatus === 'Disabled'
        ? 'Login enabled. Share a new setup link if required.'
        : 'Login disabled. Employment and payroll records are unchanged.');
      await refreshAll();
    } catch (requestError) {
      setInviteError(requestError?.message || 'Unable to change login access.');
    }
  };

  const openPaymentSettings = () => {
    if (!canEditPaymentSettings || !staff?.id) return;
    setPaymentSettingsError('');
    setPaymentSettingsOpen(true);
  };

  const openWageRateSettings = async () => {
    if (!canEditWageRate || paymentSettingsBusy || !staff?.id) return;
    setPaymentSettingsBusy(true);
    setPaymentSettingsError('');
    try {
      const account = await dailyWageService.account(staff.id);
      setPaymentStructure({
        employee: { id: staff.id, name: staff.name },
        staffId: staff.id,
        staffName: staff.name,
        dailyRate: account?.currentRate ?? account?.dailyRate ?? '',
      });
      setPaymentSettingsOpen(false);
      setWageRateOpen(true);
    } catch (cause) {
      setPaymentSettingsError(cause?.message || 'Unable to load daily wage rate.');
    } finally {
      setPaymentSettingsBusy(false);
    }
  };

  const openCashBankPayment = (method) => {
    if (!canRecordWagePayment || !staff?.id) return;
    setPaymentSettingsOpen(false);
    navigate(`/staff/${staff.id}/wages`, {
      state: { openPayment: true, paymentMethod: method },
    });
  };

  const handleEdit = async (payload) => {
    await staffService.updateStaff(staff.id, payload);
    showToast('Staff profile updated.');
    await refreshAll();
  };

  const handleAddDocument = async (payload) => {
    await staffManagementService.createDocument(staff.id, payload);
    showToast('Document added.');
    await refreshAll();
  };

  if (loading && !staff) {
    return <div className="staff-workshop-empty" role="status">Loading staff profile…</div>;
  }

  if (!staff) {
    return (
      <section className="staff-workshop-empty" role="alert">
        <p>{error || 'Staff profile not found.'}</p>
        {errorRequestId && <p>Support reference: {errorRequestId}</p>}
        {errorStatus !== 401 && errorStatus !== 403 && (
          <button type="button" className="staff360-secondary-button" onClick={refreshAll}>
            Retry Loading Profile
          </button>
        )}
      </section>
    );
  }

  return (
    <div className="staff-profile staff360">
      {error && (
        <div className="staff-directory-message is-error" role="alert">
          <span>{error}{errorRequestId ? ` · Reference: ${errorRequestId}` : ''}</span>
          {errorStatus !== 401 && errorStatus !== 403 && (
            <button type="button" onClick={refreshAll} disabled={loading}>
              {loading ? 'Retrying…' : 'Retry'}
            </button>
          )}
        </div>
      )}
      {supportWarning && (
        <div className="staff-directory-message" role="status">
          {supportWarning}
          <button type="button" onClick={refreshAll} disabled={loading}>Retry</button>
        </div>
      )}
      {toastMsg && <div className="staff360-toast" role="status">{toastMsg}</div>}
      {inviteError && (
        <div className="staff-directory-message is-error" role="alert">
          <span>{inviteError}</span>
          <button type="button" aria-label="Dismiss invite error" onClick={() => setInviteError('')}>Dismiss</button>
        </div>
      )}
      {inviteNotice && (
        <div className="staff-directory-message" role="status">
          <span>{inviteNotice}</span>
          <button type="button" aria-label="Dismiss WhatsApp invitation notice" onClick={() => setInviteNotice('')}>Dismiss</button>
        </div>
      )}
      {paymentSettingsError && (
        <div className="staff-directory-message is-error" role="alert">
          <span>{paymentSettingsError}</span>
          <button type="button" onClick={() => setPaymentSettingsError('')}>Dismiss</button>
        </div>
      )}



      <section className="staff-profile-hero staff360-hero">
        <div className="staff360-person">
          <StaffAvatar staff={staff} size="lg" />
          <div>
            <div className="staff360-name-row">
              <h3>{staff.name}</h3>
              <span className={'staff360-status is-' + String(staff.employmentStatus || '').toLowerCase().replaceAll(' ', '-')}>
                {staff.employmentStatus}
              </span>
            </div>
            <p>
              {getEmployeeLabel(staff)} · {displayText(staff.role, 'No Role')} · {displayText(staff.department, 'Unassigned Team')}
            </p>
            <div className="staff360-contact-line">
              <span><Phone size={12}/>{staff.phone || 'No phone'}</span>
            </div>
          </div>
        </div>

        {(canEdit || canEditPaymentSettings) && (
          <div className="staff360-hero-actions">
            {canEditPaymentSettings && (
              <button type="button" className="staff360-secondary-button staff360-payment-settings"
                onClick={openPaymentSettings} disabled={paymentSettingsBusy}
                aria-label={`Payment Settings for ${staff.name}`}>
                <Settings2 size={15} aria-hidden="true" />
                {paymentSettingsBusy ? 'Loading…' : 'Payment Settings'}
              </button>
            )}
            {canEdit && (
              <button type="button" className="staff360-secondary-button" onClick={() => setEditOpen(true)}>
                <Pencil size={14}/> Edit Profile
              </button>
            )}
            {isOwnProfile && (
              <button type="button" className="staff360-secondary-button"
                onClick={() => navigate('/account/security')}>
                <Settings2 size={14} aria-hidden="true" /> Account Security
              </button>
            )}
            {canResetStaffPassword && (
              <>
                <button type="button" onClick={handleSendInvite}
                  disabled={inviteBusy || staff.loginStatus === 'Disabled'}
                  title={staff.loginStatus === 'Disabled' ? 'Enable staff login first' : undefined}
                  className="staff360-secondary-button staff360-manual-reset"
                  aria-label={staff.loginStatus === 'Active'
                    ? 'Send password reset link manually via WhatsApp'
                    : 'Send password setup link manually via WhatsApp'}>
                  <Send size={14} aria-hidden="true"/>
                  {inviteBusy ? 'Preparing link…' : staff.loginStatus === 'Active'
                    ? 'Send Reset Link via WhatsApp' : 'Resend via WhatsApp'}
                </button>
                <details className="staff360-more-actions">
                  <summary>More</summary>
                  <div>
                    <button type="button" className="staff360-secondary-button"
                      disabled={inviteBusy || staff.loginStatus === 'Disabled'}
                      onClick={handleCopyInvite}>
                      <Copy size={14}/> Copy Password Link Message
                    </button>
                    <button type="button" onClick={handleToggleAccount} className="staff360-secondary-button">
                      {staff.loginStatus === 'Disabled' ? <Unlock size={14}/> : <Lock size={14}/>}
                      {staff.loginStatus === 'Disabled' ? 'Enable login' : 'Disable login'}
                    </button>
                  </div>
                </details>
              </>
            )}
          </div>
        )}
      </section>

      <nav className="staff-profile-tabs staff360-tabs" aria-label="Staff profile sections">
        <div className="scroll-hidden">
          {visibleTabs.map(([tab, Icon]) => (
            <button
              type="button"
              key={tab}
              className={activeTab === tab ? 'is-active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              <Icon size={12} />
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <section className="staff-profile-panel staff360-panel">
        {activeTab === 'Overview' && (
          <div className="staff360-overview">
            <div className="staff360-overview-commandbar">
              <div>
                <strong>Employee details</strong>
              </div>

            </div>

            <div className="staff360-section">
              <div className="staff360-section__title"><User size={15}/> Personal & Employment</div>
              <div className="staff360-info-grid">
                <InfoItem label="Employee Number" value={getEmployeeLabel(staff)} icon={ShieldCheck} />
                <InfoItem label="Full Name" value={staff.name} icon={User} />
                <InfoItem label="Phone" value={staff.phone} icon={Phone} />
                <InfoItem label="Joining Date" value={staff.joiningDate} icon={CalendarDays} />
                <InfoItem label="Status" value={staff.employmentStatus} icon={ShieldCheck} />
              </div>
            </div>

            <div className="staff360-section">
              <div className="staff360-section__title"><Building2 size={15}/> Workshop Assignment</div>
              <div className="staff360-info-grid">
                <InfoItem label="Role" value={staff.role} icon={ShieldCheck} />
                <InfoItem label="Team / Department" value={staff.department} icon={Building2} />
                <InfoItem label="Branch" value={staff.branch?.name || staff.branch} icon={Building2} />
                <InfoItem label="Shift" value={staff.shift} icon={Clock3} />
                <InfoItem label="Login Status" value={staff.loginStatus} icon={ShieldCheck} />
              </div>
            </div>

            {Boolean(staff.skills?.length) && <div className="staff360-section">
              <div className="staff360-section__title"><Wrench size={15}/> Skills</div>
              <div className="staff-chip-row">
                {staff.skills?.length
                  ? staff.skills.map((skill, index) => {
                      const label = displayText(skill, 'Skill');
                      return <span key={String(skill?.id || skill?.name || label || index)}>{label}</span>;
                    })
                  : null}
              </div>
            </div>}

          </div>
        )}

        {activeTab === 'Attendance' && (
          <div className="staff360-tab-stack">
            {canManageAttendance ? (
              <>
                <div className="staff360-metric-grid is-six">
                  <div><span>Present</span><strong>{attendanceSummary.present}</strong></div>
                  <div><span>Absent</span><strong>{attendanceSummary.absent}</strong></div>
                  <div><span>Leave</span><strong>{attendanceSummary.leave}</strong></div>
                  <div><span>Weekly Off</span><strong>{attendanceSummary.weeklyOff}</strong></div>
                  <div><span>Holiday</span><strong>{attendanceSummary.holidays}</strong></div>
                  <div><span>Shift</span><strong>{displayText(staff.shift)}</strong></div>
                </div>

                <StaffAttendanceCalendar
                  monthValue={attendanceMonth}
                  onMonthChange={setAttendanceMonth}
                  calendar={attendanceCalendar}
                  employee={attendanceEmployee}
                  onDayOpen={(date) =>
                    navigate(
                      `/attendance-manager/team-review/${encodeURIComponent(staff.employeeId || staff.id)}/${date}`,
                    )
                  }
                />
              </>
            ) : (
              <div className="staff-workshop-empty">
                Attendance calendar is available to attendance managers.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Assigned Work' && (
          <div className="staff360-tab-stack">
            {jobsLoading && <div className="staff-workshop-empty" role="status">Loading assigned work…</div>}
            {jobsError && <div className="staff-directory-message is-error" role="alert">{jobsError}</div>}
            {!jobsLoading && !jobsError && <>
            <div className="staff360-work-summary">
              <div><span>Total Assigned</span><strong>{jobs.length}</strong></div>
              <div><span>In Progress</span><strong>{jobs.filter((job) => job.status === 'In Progress').length}</strong></div>
              <div><span>Waiting Parts</span><strong>{jobs.filter((job) => job.status === 'Waiting for Parts' || job.status === 'Waiting Parts').length}</strong></div>
              <div><span>Completed</span><strong>{jobs.filter((job) => job.status === 'Delivered' || job.status === 'Completed').length}</strong></div>
            </div>

            <div className="staff360-job-list">
              {jobs.map((job) => (
                <article key={job.id} className="staff360-job-card">
                  <div>
                    <span>{job.jobNumber || job.id}</span>
                    <strong>{displayText(job.vehicle || job.vehicleReg || job.vehicleInfo, 'Vehicle')}</strong>
                    <p>{displayText(job.work || job.notes, 'Assigned workshop work')}</p>
                  </div>

                  <div className="staff360-job-side">
                    <b>{displayText(job.status, 'Assigned')}</b>
                    <span>
                      {job.bookedHours
                        ? `${job.bookedHours}h assigned`
                        : money(job.labourTotal || job.labour_total || 0) + ' labour'}
                    </span>
                  </div>

                  {Number(job.progress) >= 0 && job.progress !== undefined && (
                    <div className="staff-progress">
                      <i style={{ width: `${Math.min(100, Number(job.progress || 0))}%` }} />
                    </div>
                  )}

                  <div className="staff360-job-feedback">
                    <span>Customer Feedback</span>
                    <strong>
                      {Number(job.customerRating || job.customer_rating || 0) > 0
                        ? `${job.customerRating || job.customer_rating}/5`
                        : 'No feedback'}
                    </strong>
                    {(job.customerFeedback || job.customer_feedback) && (
                      <p>{displayText(job.customerFeedback || job.customer_feedback, '')}</p>
                    )}
                  </div>

                  {canViewJobs && (
                    <button type="button" onClick={() => navigate(`/jobs/${job.id}/overview`)}>
                      Open Job
                    </button>
                  )}
                </article>
              ))}

              {!jobs.length && (
                <div className="staff-workshop-empty">
                  No jobs are currently linked to this staff member.
                </div>
              )}
            </div>
            </>}
          </div>
        )}

        {activeTab === 'Performance' && (
          <div className="staff360-tab-stack">
            {jobsLoading && <div className="staff-workshop-empty" role="status">Loading performance data…</div>}
            {jobsError && <div className="staff-directory-message is-error" role="alert">{jobsError}</div>}
            {!jobsLoading && !jobsError && <>
            <div className="staff360-metric-grid">
              <div><span>Jobs Completed</span><strong>{performance.jobsCompleted}</strong></div>
              <div><span>Labour Revenue</span><strong>{money(performance.labourRevenue)}</strong></div>
              <div><span>Avg Labour / Job</span><strong>{money(performance.averageLabourValue || (performance.jobsCompleted ? performance.labourRevenue / performance.jobsCompleted : 0))}</strong></div>
              <div><span>Productive Hours</span><strong>{Number(performance.productiveHours || 0).toFixed(1)}h</strong></div>
              <div><span>Comeback Jobs</span><strong>{performance.comebackJobs}</strong></div>
              <div>
                <span>Customer Feedback</span>
                <strong>
                  {performance.customerRating
                    ? Number(performance.customerRating).toFixed(1)
                    : '—'} <Star size={12}/>
                </strong>
              </div>
            </div>

            <div className="staff360-note-card">
              <Gauge size={16}/>
              <div>
                <strong>Performance is work-linked</strong>
                <span>Completed jobs, labour value, comeback jobs and available customer ratings are used here.</span>
              </div>
            </div>
            </>}
          </div>
        )}

        {activeTab === 'Payroll' && (
          <div className="staff360-tab-stack">
            {canViewPayroll || isOwnProfile ? (
              <div className="staff360-pay-config-command">
                <div>
                  <WalletCards size={17}/>
                  <div>
                    <strong>Salary &amp; payments</strong>
                  </div>
                </div>
                <button type="button" onClick={() => navigate(`/staff/${staff.id}/wages`)}>
                  <WalletCards size={14}/> Open Wage Account
                </button>
              </div>
            ) : (
              <div className="staff-workshop-empty">Payroll access is not assigned to your role.</div>
            )}
          </div>
        )}

        {activeTab === 'Documents' && (
          <div className="staff360-tab-stack">
            <div className="staff360-document-head">
              <div>
                <strong>Employment Documents</strong>
                <span>ID proof, licences, certificates, offer letters and contracts.</span>
              </div>
              <div className="staff360-document-actions">
                <span className={documents.length ? 'is-complete' : 'is-missing'}>
                  {documents.length ? `${documents.length} files` : 'No files'}
                </span>
                {canEdit && (
                  <button type="button" onClick={() => setDocumentOpen(true)}>
                    <FilePlus2 size={13}/>
                    Add Document
                  </button>
                )}
              </div>
            </div>

            {documents.length ? (
              <div className="staff360-document-list">
                {documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.fileUrl || undefined}
                    target={doc.fileUrl ? '_blank' : undefined}
                    rel="noreferrer"
                    onClick={(event) => {
                      if (!doc.fileUrl) event.preventDefault();
                    }}
                  >
                    <FileText size={15}/>
                    <div>
                      <strong>{doc.name}</strong>
                      <span>
                        {doc.type} · {doc.uploadedDate}
                        {doc.expiryDate ? ` · Expires ${doc.expiryDate}` : ''}
                      </span>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div className="staff-workshop-empty">
                No staff documents added yet.
              </div>
            )}
          </div>
        )}

        {activeTab === 'Activity History' && (
          <div className="staff360-activity-list">
            {activities.length ? (
              activities.map((item) => (
                <div key={item.id}>
                  <span className="staff360-activity-icon"><Activity size={14}/></span>
                  <div>
                    <strong>{displayText(item.action, 'Activity')}</strong>
                    {item.details && <p>{displayText(item.details, '')}</p>}
                    <small>
                      {item.actor || 'System'}
                      {item.timestamp
                        ? ` · ${new Date(item.timestamp).toLocaleString('en-IN')}`
                        : ''}
                    </small>
                  </div>
                </div>
              ))
            ) : (
              <div className="staff-workshop-empty">No activity history available.</div>
            )}
          </div>
        )}
      </section>

      {canEditPaymentSettings && (
        <ResponsiveModalSheet isOpen={paymentSettingsOpen}
          onClose={() => setPaymentSettingsOpen(false)}
          title={`Payment Settings · ${staff.name}`} maxWidth="540px">
          <div className="staff-payment-settings-menu">
            {paymentSettingsError && <p className="staff-directory-message is-error" role="alert">{paymentSettingsError}</p>}
            {canEditWageRate && (
              <button type="button" onClick={openWageRateSettings} disabled={paymentSettingsBusy}>
                <Settings2 size={17} aria-hidden="true" />
                <span><strong>Daily Wage Rate</strong><small>Set the rate and effective date</small></span>
              </button>
            )}
            {canRecordWagePayment && (
              <>
                <p>Pay an outstanding wage using an existing funded account. Each confirmed payment updates the wage and financial ledgers once.</p>
                <div className="staff-payment-settings-ways">
                  <button type="button" onClick={() => openCashBankPayment('Cash')}>
                    <WalletCards size={17} aria-hidden="true" /> Cash Payment
                  </button>
                  <button type="button" onClick={() => openCashBankPayment('Bank Transfer')}>
                    <WalletCards size={17} aria-hidden="true" /> Bank Payment
                  </button>
                </div>
              </>
            )}
          </div>
        </ResponsiveModalSheet>
      )}
      {canEditWageRate && (
        <EmployeePayConfigurationSheet
          isOpen={wageRateOpen}
          onClose={() => setWageRateOpen(false)}
          structure={paymentStructure}
          onSaved={() => {
            setWageRateOpen(false);
            showToast('Daily wage rate updated.');
          }}
        />
      )}

      {canEdit && (
        <>
          <StaffProfileEditSheet
            open={editOpen}
            onClose={() => setEditOpen(false)}
            staff={staff}
            roles={roles}
            canAssignRole={can('company.manage')}
            teams={teams}
            shifts={shifts}
            skills={skills}
            onSave={handleEdit}
          />

          <StaffDocumentAddSheet
            open={documentOpen}
            onClose={() => setDocumentOpen(false)}
            onSave={handleAddDocument}
          />
        </>
      )}
    </div>
  );
};
