import { useEffect, useState } from "react";
import { useNavigate } from 'react-router-dom';
import { FormPage } from '../../components/common/forms/FormPage';
import { FormSection } from '../../components/common/forms/FormSection';
import { StickyFormFooter } from '../../components/common/forms/StickyFormFooter';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { PhoneInput } from '../../components/common/PhoneInput';
import { customerService } from '../../services/customer.service';
import { CustomerManagementTabs } from '../../components/customers/CustomerManagementTabs';
import { User, Mail, Building, CheckCircle2 } from "lucide-react";

export const AddCustomer = () => {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [formError, setFormError] = useState('');
  const [branches, setBranches] = useState([]);
  const [branchError, setBranchError] = useState('');

  useEffect(() => {
    let active = true;
    customerService.getCustomerBranches()
      .then((rows) => { if (active) setBranches(Array.isArray(rows) ? rows : []); })
      .catch((cause) => { if (active) setBranchError(cause?.message || 'Unable to load workshop branches.'); });
    return () => { active = false; };
  }, []);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    whatsapp: '',
    email: '',
    customerType: 'Individual',
    companyName: '',
    gstNo: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    branch: '',
    notes: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    setFormError('');
    if (!formData.name.trim() || !formData.phone.trim()) {
      setFormError('Customer name and contact number are required.');
      return;
    }
    try {
      setSubmitting(true);
      const duplicate = await customerService.checkDuplicateCustomer({
        phone: formData.phone.trim(), email: formData.email.trim(),
      });
      if (duplicate) {
        setFormError('This contact already belongs to an existing customer. Open the existing profile instead of creating a duplicate.');
        return;
      }
      const created = await customerService.createCustomer({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        whatsapp: (formData.whatsapp || formData.phone).trim(),
        email: formData.email.trim(),
        customerType: formData.customerType === 'Individual' ? 'individual' : 'business',
        companyName: formData.companyName.trim(),
        gstin: formData.gstNo.trim().toUpperCase(),
        address: formData.address.trim(),
        city: formData.city.trim(),
        state: formData.state.trim(),
        pincode: formData.pincode.trim(),
        ...(formData.branch ? { branch: formData.branch } : {}),
        notes: formData.notes.trim(),
      });
      if (!created?.id) throw new Error('The customer API did not return a saved customer reference.');
      setToastMsg('Customer created successfully.');
      navigate(`/customers/${created.id}`);
    } catch (err) {
      setFormError(err?.message || 'Unable to create customer. Check the entered details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <FormPage
      title="Add Customer"
      
    >
      <CustomerManagementTabs />

      {formError && <p role="alert" className="customer-directory-message is-error">{formError}</p>}
      {branchError && <p role="alert" className="customer-directory-message is-error">{branchError}</p>}
      {toastMsg && (
        <div style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {toastMsg}
        </div>
      )}

      <form className="customer-add-form cg-customers" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        
        {/* BASIC INFORMATION */}
        <FormSection
          title="Basic Information"
          
        >
          <div className="form-grid-full">
            <Input
              label="Customer Name"
              required
              icon={User}
              placeholder="e.g. Rahul Kumar"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>

          <PhoneInput
            label="Phone Number"
            required
            placeholder="98765 43210"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
          />

          <PhoneInput
            label="WhatsApp Number"
            placeholder="98765 43210"
            value={formData.whatsapp}
            onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
          />

          <Input
            label="Email Address"
            type="email"
            icon={Mail}
            placeholder="rahul.k@example.com"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
          />

          <Select
            label="Customer Type"
            value={formData.customerType}
            onChange={(e) => setFormData({ ...formData, customerType: e.target.value })}
          >
            <option value="Individual">Individual</option>
            <option value="Company/Fleet">Company / Fleet</option>
            <option value="Insurance">Insurance</option>
            <option value="Dealer/Partner">Dealer / Partner</option>
          </Select>

          {formData.customerType !== 'Individual' && (
            <>
              <Input
                label="Company Name"
                icon={Building}
                placeholder="Apex Logistics Ltd"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
              />
              <Input
                label="GST Number"
                placeholder="32AAAAA0000A1Z5"
                value={formData.gstNo}
                onChange={(e) => setFormData({ ...formData, gstNo: e.target.value })}
              />
            </>
          )}
        </FormSection>

        {/* ADDRESS DETAILS */}
        <FormSection
          title="Address Details"
          
        >
          <div className="form-grid-full">
            <Textarea
              label="Street Address"
              rows={2}
              placeholder="Building name, street details..."
              value={formData.address}
              onChange={(e) => setFormData({ ...formData, address: e.target.value })}
            />
          </div>

          <Input
            label="City"
            value={formData.city}
            onChange={(e) => setFormData({ ...formData, city: e.target.value })}
          />

          <Input
            label="State"
            value={formData.state}
            onChange={(e) => setFormData({ ...formData, state: e.target.value })}
          />

          <Input
            label="PIN Code"
            placeholder="682031"
            value={formData.pincode}
            onChange={(e) => setFormData({ ...formData, pincode: e.target.value })}
          />

          <Select
            label="Assigned Branch"
            value={formData.branch}
            onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
          >
            <option value="">Workshop default branch</option>
            {branches.map((branch) => (
              <option key={branch.id} value={branch.id}>{branch.name}</option>
            ))}
          </Select>
        </FormSection>

        {/* ADDITIONAL PREFERENCES */}
        <FormSection
          title="Additional Preferences"
          
        >
          <div className="form-grid-full">
            <Textarea
              label="Customer Notes & Instructions"
              rows={3}
              placeholder="e.g. Prefers evening delivery, call before replacing parts..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>

          <p className="customer-form-note">
            WhatsApp messages are sent only through the configured workshop messaging workflow.
            Saving a customer does not automatically send a message.
          </p>
        </FormSection>

        {/* STICKY FOOTER */}
        <StickyFormFooter
          statusText="New Customer Profile"
          cancelLabel="Cancel"
          saveLabel="Save Customer"
          isSubmitting={submitting}
          onCancel={() => navigate('/customers/all')}
        />
      </form>
    </FormPage>
  );
};
