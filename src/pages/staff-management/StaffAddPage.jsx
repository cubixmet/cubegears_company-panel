import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Copy, MessageCircle, Save, UserPlus } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { roleService } from '../../services/role.service';
import { staffService } from '../../services/staff.service';
import { branchService } from '../../services/branch.service';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { clearFieldValidation, showFormFieldError, showServerFormErrors } from '../../utils/formValidation';
import { copyManualStaffInvite, shareManualStaffInvite } from '../../utils/staffManualInvite';
import '../../styles/staff-mobile-onboarding.css';
import '../../styles/staff-branch-access.css';
import './staffPhoneCountry.css';

const staffCountryCodes = [
  { code: '+91', country: 'India', flag: '🇮🇳', digits: 10 },
  { code: '+971', country: 'UAE', flag: '🇦🇪', digits: 9 },
  { code: '+966', country: 'Saudi Arabia', flag: '🇸🇦', digits: 9 },
  { code: '+974', country: 'Qatar', flag: '🇶🇦', digits: 8 },
  { code: '+968', country: 'Oman', flag: '🇴🇲', digits: 8 },
  { code: '+965', country: 'Kuwait', flag: '🇰🇼', digits: 8 },
  { code: '+973', country: 'Bahrain', flag: '🇧🇭', digits: 8 },
];
const statuses = ['Active', 'Probation', 'Notice Period', 'Inactive', 'Suspended', 'Resigned', 'Terminated'];
const emptyStaff = (loginEnabled) => ({
  name: '', phone: '', branchId: '', allowedBranchIds: [], roleId: '', role: '',
  employmentStatus: 'Active', loginAccessEnabled: loginEnabled,
});

export const StaffAddPage = () => {
  const navigate = useNavigate();
  const formRef = useRef(null);
  const { user } = useAuth();
  const canManageLogins = hasPermission(user, 'company.manage');
  const [form, setForm] = useState(() => emptyStaff(canManageLogins));
  const [countryCode, setCountryCode] = useState('+91');
  const currentCountry = staffCountryCodes.find(country => country.code === countryCode);
  const localPhone = form.phone.startsWith(countryCode) ? form.phone.slice(countryCode.length) : form.phone;
  const [roles, setRoles] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [createdStaff, setCreatedStaff] = useState(null);
  const [invitationReady, setInvitationReady] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareMessage, setShareMessage] = useState('');
  const [shareError, setShareError] = useState('');

  const set = (key, value) => {
    setError('');
    setForm(current => ({ ...current, [key]: value }));
  };

  useEffect(() => {
    let mounted = true;
    Promise.all([roleService.getAssignableRoles(), branchService.getBranches()])
      .then(([roleRows, branchRows]) => {
        if (!mounted) return;
        setRoles((Array.isArray(roleRows) ? roleRows : [])
          .filter(role => role.status !== 'Inactive' && !role.isProtected && !role.is_system));
        setBranches((Array.isArray(branchRows) ? branchRows : [])
          .filter(branch => branch.is_active !== false));
      })
      .catch(cause => { if (mounted) setError(cause?.message || 'Unable to load roles or branches.'); })
      .finally(() => { if (mounted) setLoadingOptions(false); });
    return () => { mounted = false; };
  }, []);

  const submit = async event => {
    event.preventDefault();
    if (saving) return;
    if (!form.name.trim()) {
      showFormFieldError(formRef.current, 'name', 'Full name is required.');
      return;
    }
    const mobile = `${countryCode}${localPhone.replace(/\D/g, '')}`;
    if (localPhone.length !== currentCountry.digits || !/^\+[1-9]\d{7,14}$/.test(mobile)) {
      showFormFieldError(formRef.current, 'phone', `Enter a valid ${currentCountry.digits}-digit ${currentCountry.country} mobile number.`);
      return;
    }
    if (!form.roleId || !roles.some(role => String(role.id) === String(form.roleId))) {
      showFormFieldError(formRef.current, 'role', 'Choose an active company role.');
      return;
    }

      if (canManageLogins && form.loginAccessEnabled && (!form.branchId ||
        !form.allowedBranchIds.includes(form.branchId))) {
        showFormFieldError(formRef.current, 'branchId', 'Select a primary branch before assigning staff access.');
        return;
      }
    setSaving(true);
    setError('');
    try {
      const created = await staffService.createStaff({
        ...form, name: form.name.trim(), phone: mobile,
        loginAccessEnabled: canManageLogins,
      });
      // Do not retain raw setup capability in React UI state, browser storage
      // or route query params; retrieve it only for an explicit Share gesture.
      const { setupLink: unusedBearerLink, ...safeRecord } = created || {};
      void unusedBearerLink;
      setCreatedStaff(safeRecord);
      setInvitationReady(Boolean(created?.setupLink) && created?.whatsappInviteStatus === 'manual');
      setShareError(created?.invitationError || '');
    } catch (cause) {
      showServerFormErrors(formRef.current, cause, {
        roleId: 'role', role: 'role', phone: 'phone', name: 'name',
        branchId: 'branchId', employmentStatus: 'employmentStatus',
      });
      setError(cause?.message || 'Unable to create staff. Check the highlighted fields.');
    } finally {
      setSaving(false);
    }
  };

  const share = async () => {
    if (sharing || !createdStaff?.id) return;
    setShareError('');
    setShareMessage('');
    setSharing(true);
    try {
      const handoff = await shareManualStaffInvite(
        () => staffService.sendLoginInvite(createdStaff.id),
        { phone: createdStaff.phone, staffName: createdStaff.name, workshopName: user?.company?.name },
      );
      setShareMessage(handoff.localOnlyLink
        ? 'WhatsApp opened, but the setup link uses localhost. Configure backend FRONTEND_URL with the public HTTPS company-panel URL before sharing.'
        : 'WhatsApp opened — press Send manually to share the invitation.');
    } catch (cause) {
      setShareError(cause?.message || 'Unable to prepare WhatsApp sharing.');
    } finally {
      setSharing(false);
    }
  };

  const copyInvite = async () => {
    if (sharing || !createdStaff?.id) return;
    setSharing(true);
    setShareError('');
    setShareMessage('');
    try {
      await copyManualStaffInvite(
        () => staffService.sendLoginInvite(createdStaff.id),
        { phone: createdStaff.phone, staffName: createdStaff.name, workshopName: user?.company?.name },
      );
      setShareMessage('Setup message copied. Paste it only into the registered staff WhatsApp chat and press Send manually.');
    } catch (cause) {
      setShareError(cause?.message || 'Unable to copy the setup message.');
    } finally {
      setSharing(false);
    }
  };

  const regenerateInvite = async () => {
    if (sharing || !createdStaff?.id) return;
    setSharing(true);
    setShareError('');
    setShareMessage('');
    try {
      const invitation = await staffService.sendLoginInvite(createdStaff.id, { replace: true });
      const ready = Boolean(invitation?.setupLink) && invitation?.whatsappInviteStatus === 'manual';
      setInvitationReady(ready);
      setShareMessage(ready ? 'Secure setup link is ready. Use Share on WhatsApp or Copy Setup Message.' : '');
      if (!ready) setShareError('Setup link could not be generated. Check workshop settings and retry.');
    } catch (cause) {
      setInvitationReady(false);
      setShareError(cause?.message || 'Could not regenerate the secure setup link.');
    } finally {
      setSharing(false);
    }
  };

  if (createdStaff) {
    return (
      <section className="staff-add-page staff-manual-invite-result" aria-label="Staff creation complete">
        <div className="staff-form-panel">
          <h2 className="staff-action-success" role="status">
            <CheckCircle2 size={20}/> Staff Created Successfully
          </h2>
          <dl className="staff-manual-invite-details">
            <div><dt>Name</dt><dd>{createdStaff.name}</dd></div>
            <div><dt>Mobile</dt><dd>{createdStaff.phone}</dd></div>
            <div><dt>Login Status</dt><dd>{createdStaff.loginStatus}</dd></div>
            <div><dt>Invitation</dt><dd>{invitationReady ? 'Ready to Share' : 'Setup Link Not Ready'}</dd></div>
          </dl>
          {shareError && <div className="staff-directory-message is-error" role="alert">{shareError}</div>}
          {shareMessage && <div className="staff-directory-message" role="status">{shareMessage}</div>}
          <div className="staff-manual-invite-actions">
            {canManageLogins && createdStaff.loginStatus === 'Pending Password Setup' && invitationReady && (
              <>
              <button type="button" className="staff-save-button" disabled={sharing} onClick={share}>
                <MessageCircle size={17}/>{sharing ? 'Preparing…' : 'Share on WhatsApp'}
              </button>
              <button type="button" className="staff360-secondary-button" disabled={sharing} onClick={copyInvite}>
                <Copy size={17}/> Copy Setup Message
              </button>
              </>
            )}
            {canManageLogins && createdStaff.loginStatus === 'Pending Password Setup' && (
              <button type="button" className="staff360-secondary-button" disabled={sharing} onClick={regenerateInvite}>
                Regenerate Setup Link
              </button>
            )}
            <button type="button" className="staff360-secondary-button"
              onClick={() => navigate('/staff-management/staff/' + createdStaff.id)}>
              View Staff Profile
            </button>
            <button type="button" className="staff360-secondary-button" onClick={() => {
              setForm(emptyStaff(canManageLogins));
              setCountryCode('+91');
              setCreatedStaff(null);
              setInvitationReady(false);
              setShareError('');
              setShareMessage('');
            }}>Add Another Staff</button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form ref={formRef} className="staff-add-page" noValidate onSubmit={submit}
      onChange={event => clearFieldValidation(event.target)}>
      <section className="staff-add-page__header">
        <h2>Add Staff</h2>
        <button className="staff-save-button" type="submit" disabled={saving || loadingOptions}>
          <Save size={16}/>{saving ? 'Saving…' : 'Save Staff'}
        </button>
      </section>

      {error && <div className="staff-directory-message is-error" role="alert">{error}</div>}
      <div className="staff-add-layout">
        <div className="staff-add-main">
          <section className="staff-form-panel">
            <div className="staff-form-panel__title"><UserPlus size={17}/>Staff Details</div>
            <div className="staff-form-grid">
              <label>Full Name *
                <input name="name" required autoComplete="name" value={form.name}
                  onChange={event => set('name', event.target.value)} placeholder="Full name"/>
              </label>
              <div className="staff-phone-field">
                <label htmlFor="staff-mobile-number">Mobile Number with Country Code *</label>
                <div className="staff-phone-field__row">
                  <select aria-label="Mobile country code" value={countryCode}
                    onChange={event => {
                      const nextCode = event.target.value;
                      setCountryCode(nextCode);
                      set('phone', localPhone ? nextCode + localPhone : '');
                    }}>
                    {staffCountryCodes.map(country => (
                      <option key={country.code} value={country.code}>
                        {country.flag} {country.code} {country.country}
                      </option>
                    ))}
                  </select>
                  <input id="staff-mobile-number" name="phone" type="tel" required
                    autoComplete="tel-national" inputMode="numeric"
                    value={localPhone}
                    maxLength={currentCountry.digits}
                    onChange={event => set('phone', countryCode + event.target.value.replace(/\D/g, '').slice(0, currentCountry.digits))}
                    placeholder={`${currentCountry.digits}-digit mobile number`}/>
                </div>
              </div>
              <label>Branch
                <select name="branchId" value={form.branchId} onChange={event => {
                  const next = event.target.value;
                  setForm(current => ({
                    ...current, branchId: next,
                    allowedBranchIds: next
                      ? [next, ...(current.allowedBranchIds || []).filter(
                          id => id !== current.branchId && id !== next)].slice(0, 3)
                      : [],
                  }));
                }}>
                  <option value="">Unassigned</option>
                  {branches.map(branch => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
              </label>
              <label>Company Role *
                <select name="role" required value={form.roleId} onChange={event => {
                  const role = roles.find(item => String(item.id) === event.target.value);
                  setForm(current => ({ ...current, roleId: role?.id || '', role: role?.name || '' }));
                }}>
                  <option value="">Choose role</option>
                  {roles.map(role => <option key={role.id} value={role.id}>{role.name}</option>)}
                </select>
              </label>
              <label>Employment Status
                <select name="employmentStatus" value={form.employmentStatus}
                  onChange={event => set('employmentStatus', event.target.value)}>
                  {statuses.map(status => <option key={status}>{status}</option>)}
                </select>
              </label>
            </div>
            {canManageLogins && form.loginAccessEnabled && form.branchId && branches.length > 1 &&
              <fieldset className="staff-branch-access">
                <legend>Staff Branch Access (up to 3 branches)</legend>
                <p>Primary branch is always included. Only assigned branches appear in customer records.</p>
                <div>
                  {branches.map(branch => {
                    const selected = form.allowedBranchIds.includes(String(branch.id));
                    const locked = String(branch.id) === String(form.branchId);
                    return <label key={branch.id}>
                      <input type="checkbox" checked={selected} disabled={locked ||
                        (!selected && form.allowedBranchIds.length >= 3)}
                        onChange={event => setForm(current => ({
                          ...current, allowedBranchIds: event.target.checked
                            ? [...current.allowedBranchIds, String(branch.id)]
                            : current.allowedBranchIds.filter(id => id !== String(branch.id)),
                        }))}/>
                      {branch.name}{locked ? ' (Primary)' : ''}
                    </label>;
                  })}
                </div>
              </fieldset>}
            {!loadingOptions && !roles.length &&
              <p className="staff-directory-message is-error" role="alert">
                No roles available. {canManageLogins && <Link to="/staff-management/roles">Create Role</Link>}
              </p>}
          </section>

        </div>
      </div>
    </form>
  );
};
