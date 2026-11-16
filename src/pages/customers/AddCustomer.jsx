import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormPage } from '../../components/common/forms/FormPage';
import { StickyFormFooter } from '../../components/common/forms/StickyFormFooter';
import { CustomerManagementTabs } from '../../components/customers/CustomerManagementTabs';
import { CustomerFormFields } from '../../components/customers/CustomerFormFields';
import { customerService } from '../../services/customer.service';
import {
  customerFormDefaults, toCustomerFormPayload, validateCustomerContact,
} from '../../utils/customerFormModel';

export const AddCustomer = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState(customerFormDefaults);
  const [branches, setBranches] = useState([]);
  const [branchError, setBranchError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    customerService.getCustomerBranches()
      .then(rows => { if (active) setBranches(Array.isArray(rows) ? rows : []); })
      .catch(error => {
        if (active) setBranchError(error?.message || 'Unable to load workshop branches.');
      });
    return () => { active = false; };
  }, []);

  const change = (field, value) => {
    setFormData(previous => ({ ...previous, [field]: value }));
    setFieldErrors(previous => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const submit = async event => {
    event.preventDefault();
    if (submitting) return;
    setFormError('');
    const errors = validateCustomerContact(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Enter a customer name and valid Phone Number.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = toCustomerFormPayload(formData);
      const duplicate = await customerService.checkDuplicateCustomer({
        phone: payload.phone, email: payload.email,
      });
      if (duplicate) {
        setFormError('A customer already uses this contact. Open the existing customer profile instead.');
        return;
      }
      const created = await customerService.createCustomer(payload);
      if (!created?.id) throw new Error('Customer could not be saved. No customer ID was returned.');
      navigate('/customers/' + created.id);
    } catch (error) {
      setFormError(error?.message || 'Unable to create customer. Check the entered details.');
    } finally {
      setSubmitting(false);
    }
  };

  return <FormPage title="Add Customer">
    <CustomerManagementTabs/>
    {formError && <p role="alert" className="customer-directory-message is-error">{formError}</p>}
    <form className="customer-add-form cg-customers cg-customer-standard-form"
      onSubmit={submit}>
      <CustomerFormFields values={formData} onChange={change} errors={fieldErrors}
        branches={branches} branchError={branchError} disabled={submitting}/>
      <StickyFormFooter
        statusText="New Customer"
        cancelLabel="Cancel" saveLabel="Save Customer"
        isSubmitting={submitting} onCancel={() => navigate('/customers')}
      />
    </form>
  </FormPage>;
};
