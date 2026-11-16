import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormPage } from '../../components/common/forms/FormPage';
import { StickyFormFooter } from '../../components/common/forms/StickyFormFooter';
import { CustomerManagementTabs } from '../../components/customers/CustomerManagementTabs';
import { CustomerFormFields } from '../../components/customers/CustomerFormFields';
import { customerService } from '../../services/customer.service';
import {
  customerFormDefaults, toCustomerFormValues,
  toCustomerFormPayload, validateCustomerContact,
} from '../../utils/customerFormModel';

export const EditCustomer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(() => ({
    ...customerFormDefaults(), status: 'active',
  }));
  const [branches, setBranches] = useState([]);
  const [branchError, setBranchError] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.allSettled([
      customerService.getCustomerById(id),
      customerService.getCustomerBranches(),
    ]).then(([customerResult, branchesResult]) => {
      if (!active) return;
      if (customerResult.status === 'fulfilled' && customerResult.value) {
        const customer = customerResult.value;
        setFormData({
          ...toCustomerFormValues(customer),
          status: String(customer.status || '').toLowerCase() === 'archived'
            ? 'archived' : 'active',
        });
      } else {
        setLoadError('Unable to load this customer. Please return to the customer directory.');
      }
      if (branchesResult.status === 'fulfilled') {
        setBranches(Array.isArray(branchesResult.value) ? branchesResult.value : []);
      } else {
        setBranchError('Workshop branch options are unavailable.');
      }
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [id]);

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
    const errors = validateCustomerContact(formData);
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Enter a customer name and valid Phone Number.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      await customerService.updateCustomer(id, {
        ...toCustomerFormPayload(formData), status: formData.status,
      });
      navigate('/customers/' + id);
    } catch (error) {
      setFormError(error?.message || 'Unable to save customer changes.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="customer-empty">Loading customer profile…</div>;
  if (loadError) return <div className="customer-directory-message is-error" role="alert">{loadError}</div>;

  return <FormPage title="Edit Customer">
    <CustomerManagementTabs/>
    {formError && <p role="alert" className="customer-directory-message is-error">{formError}</p>}
    <form className="customer-edit-form cg-customers cg-customer-standard-form"
      onSubmit={submit}>
      <CustomerFormFields values={formData} onChange={change} errors={fieldErrors}
        branches={branches} branchError={branchError}
        disabled={submitting} showStatus/>
      <StickyFormFooter
        statusText="Customer Details"
        cancelLabel="Cancel" saveLabel="Update Customer"
        isSubmitting={submitting} onCancel={() => navigate('/customers/' + id)}
      />
    </form>
  </FormPage>;
};
