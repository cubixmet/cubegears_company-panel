import { Users, Mail, Building2, LockKeyhole } from 'lucide-react';
import { Input } from '../common/Input';
import { Select } from '../common/Select';
import { Textarea } from '../common/Textarea';
import { CountryPhoneField } from '../common/CountryPhoneField';
import { normalizeCustomerType } from '../../utils/customerFormModel';
import '../../styles/customer-unified-fields.css';

/** One customer create/edit UI across the directory modal and standalone pages.
 * Only one phone input is presented. The same saved number supports
 * optional manual WhatsApp links; no automatic message is ever sent.
 */
export function CustomerFormFields({
  values, onChange, errors = {}, branches = [], branchError = '',
  disabled = false, showStatus = false, labelLayout = 'floating',
}) {
  const set = field => value => onChange(field, value);
  const fieldProps = field => ({
    'data-customer-field': field,
    error: errors[field] || '',
    disabled,
  });
  const isBusiness = normalizeCustomerType(values.customerType) === 'Business / Company';
  const preferredBranch = String(values.branch || branches[0]?.id || '');
  return <div className="cg-customer-unified-fields">
    <section className="cg-customer-unified-section" aria-label="Customer contact details">
      <div className="cg-customer-unified-section-heading">
        <strong>Contact Details</strong>
        <span>Only name and phone are required.</span>
      </div>
      <Input label="Customer Name" labelPosition={labelLayout} required icon={Users} autoComplete="name"
        {...fieldProps('name')} value={values.name || ''}
        placeholder="Customer full name" onChange={e => set('name')(e.target.value)} />
      <div className="cg-customer-contact-row">
        <div className="cg-customer-unified-phone">
          <CountryPhoneField label="Phone Number" required
            {...fieldProps('phone')} value={values.phone || ''}
            onChange={set('phone')}/>
          <p className="cg-customer-contact-hint">
            One contact number for calls and optional manual WhatsApp sharing.
          </p>
        </div>
        <Input label="Email Address" labelPosition={labelLayout} type="email" icon={Mail}
          autoComplete="email" {...fieldProps('email')} value={values.email || ''}
          placeholder="Email (optional)" onChange={e => set('email')(e.target.value)} />
      </div>
    </section>

    <section className="cg-customer-unified-section" aria-label="Customer classification">
      <div className="cg-customer-unified-section-heading">
        <strong>Customer Details</strong>
        <span>Business and branch details.</span>
      </div>
      <div className="cg-customer-unified-grid customer-directory-form-grid">
        <Select label="Customer Type" labelPosition={labelLayout} {...fieldProps('customerType')}
          value={normalizeCustomerType(values.customerType)}
          onChange={e => set('customerType')(e.target.value)}>
          <option value="Individual">Individual</option>
          <option value="Business / Company">Business / Company</option>
        </Select>
        {branches.length === 1
          ? <div className="cg-customer-branch-assignment"
              aria-label={`Assigned Branch: ${branches[0].name}. Automatic staff branch.`}>
              <span className="cg-stacked-label">Assigned Branch</span>
              <div className="cg-customer-branch-locked">
                <Building2 size={16} aria-hidden="true" />
                <strong>{branches[0].name}</strong>
                <LockKeyhole size={15} aria-hidden="true" />
              </div>
            </div>
          : <Select label="Assigned Branch" labelPosition={labelLayout} {...fieldProps('branch')}
              value={preferredBranch} onChange={e => set('branch')(e.target.value)}>
              {!branches.length && <option value="">No authorized branch available</option>}
              {branches.map(branch =>
                <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </Select>}
      </div>
      {branchError && <p className="cg-customer-unified-error" role="alert">{branchError}</p>}
      {isBusiness && <div className="cg-customer-unified-grid customer-directory-form-grid">
        <Input label="Company Name" labelPosition={labelLayout} icon={Building2}
          {...fieldProps('companyName')} value={values.companyName || ''}
          placeholder="Registered business name" onChange={e => set('companyName')(e.target.value)}/>
        <Input label="GST Number (optional)" labelPosition={labelLayout} maxLength={15}
          {...fieldProps('gstNo')} value={values.gstNo || ''}
          placeholder="GSTIN if registered" onChange={e => set('gstNo')(e.target.value.toUpperCase())}/>
      </div>}
      {showStatus && <Select label="Customer Status" labelPosition={labelLayout} value={values.status || 'active'}
        {...fieldProps('status')} onChange={e => set('status')(e.target.value)}>
        <option value="active">Active</option>
        <option value="archived">Archived</option>
      </Select>}
    </section>

    <section className="cg-customer-unified-section" aria-label="Customer address and notes">
      <div className="cg-customer-unified-section-heading">
        <strong>Address & Notes</strong>
        <span>Optional invoice and service details.</span>
      </div>
      <div className="cg-customer-address-row">
        <Textarea label="Address" labelPosition={labelLayout} rows={2} {...fieldProps('address')}
          value={values.address || ''} placeholder="Building, street and address"
          onChange={e => set('address')(e.target.value)}/>
        <div className="cg-customer-pin-only">
          <Input label="PIN Code" labelPosition={labelLayout} inputMode="numeric" autoComplete="postal-code" maxLength={12}
            {...fieldProps('pincode')} value={values.pincode || ''}
            placeholder="PIN (optional)" onChange={e => set('pincode')(e.target.value)}/>
        </div>
      </div>
      <Textarea label="Customer Notes & Preferences" labelPosition={labelLayout} rows={2}
        {...fieldProps('notes')} value={values.notes || ''}
        placeholder="Service instructions (optional)"
        onChange={e => set('notes')(e.target.value)}/>
    </section>
  </div>;
}

export default CustomerFormFields;
