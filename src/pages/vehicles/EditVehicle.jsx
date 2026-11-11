import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from 'react-router-dom';
import { FormPage } from '../../components/common/forms/FormPage';
import { FormSection } from '../../components/common/forms/FormSection';
import { StickyFormFooter } from '../../components/common/forms/StickyFormFooter';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { SearchableSelect } from '../../components/common/forms/SearchableSelect';
import { customerService } from '../../services/customer.service';
import { vehicleService } from '../../services/vehicle.service';
import { Car, Calendar, Gauge, ShieldCheck } from 'lucide-react';
import '../../styles/vehicle-management.css';
import '../../styles/vehicle-compact-cleanup.css';
import { extractVehicleFieldErrors, focusFirstVehicleError, requiredVehicleFields } from './vehicleFormValidation';

export const EditVehicle = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const formRef = useRef(null);
  const [formData, setFormData] = useState({
    customerId: '',
    regNo: '',
    make: '',
    model: '',
    variant: '',
    year: '',
    fuelType: 'Petrol',
    transmission: 'Manual',
    color: '',
    odometer: '',
    vin: '',
    engineNo: '',
    lastServiceDate: '',
    nextServiceDue: '',
    insuranceExpiry: '',
    notes: '',
    status: 'Active'
  });

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setLoadError('');

    Promise.all([
      vehicleService.getVehicleById(id),
      customerService.getCustomers()
    ]).then(([vehicle, customerRows]) => {
      if (!alive) return;
      if (!vehicle) throw new Error('Vehicle not found.');
      setCustomers(Array.isArray(customerRows) ? customerRows : []);
      if (vehicle) {
        setFormData({
          customerId: vehicle.customerId || '',
          regNo: vehicle.registration || '',
          make: vehicle.make || '',
          model: vehicle.model || '',
          variant: vehicle.variant || '',
          year: vehicle.year || '',
          fuelType: vehicle.fuelType || 'Petrol',
          transmission: vehicle.transmission || 'Manual',
          color: vehicle.color || '',
          odometer: vehicle.odometer || '',
          vin: vehicle.vin || '',
          engineNo: vehicle.engineNo || '',
          lastServiceDate: vehicle.lastServiceDate || '',
          nextServiceDue: vehicle.nextServiceDue || '',
          insuranceExpiry: vehicle.insuranceExpiry || '',
          notes: vehicle.notes || '',
          status: vehicle.status || 'Active'
        });
      }
    }).catch((cause) => {
      if (alive) setLoadError(cause?.message || 'Unable to load vehicle details.');
    }).finally(() => {
      if (alive) setLoading(false);
    });

    return () => { alive = false; };
  }, [id, reloadKey]);

  const customerOptions = customers.map((customer) => ({
    value: customer.id,
    label: `${customer.name} (${customer.phone || 'No phone'})`
  }));

  const submit = async (event) => {
    event.preventDefault();
    if (submitting) return;
    const invalid = requiredVehicleFields(formData, customers);
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      setFormError('Check the highlighted vehicle fields.');
      requestAnimationFrame(() => focusFirstVehicleError(formRef.current, invalid));
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    setFormError('');
    try {
      const selectedCustomer = customers.find((customer) => String(customer.id) === String(formData.customerId));
      await vehicleService.updateVehicle(id, {
        ...formData,
        customerName: selectedCustomer?.name || ''
      });
      navigate(`/vehicles/${id}`);
    } catch (cause) {
      const next = extractVehicleFieldErrors(cause);
      setFieldErrors(next);
      setFormError(cause?.message || 'Unable to update vehicle.');
      requestAnimationFrame(() => focusFirstVehicleError(formRef.current, next));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="vehicle-empty" role="status">Loading vehicle...</div>;
  if (loadError) return <div className="vehicle-dashboard-error" role="alert">
    {loadError} <button type="button" onClick={() => setReloadKey((key) => key + 1)}>Retry</button>
  </div>;

  return (
    <div className="vehicle-form-page cg-vehicles">
      <FormPage
        title="Edit Vehicle"
      >
        {formError && <div className="vehicle-dashboard-error" role="alert">{formError}</div>}
        <form ref={formRef} className="vehicle-form" noValidate onSubmit={submit}
          onInvalid={(event) => {
            event.target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            event.target?.focus();
          }}>
          <FormSection title="Customer Owner">
            <div className="form-grid-full" data-vehicle-field="customerId">
              <SearchableSelect
                label="Customer Owner"
                required
                error={fieldErrors.customerId}
                options={customerOptions}
                value={formData.customerId}
                onChange={(value) => setFormData({ ...formData, customerId: value })}
                placeholder="Search customer by name or phone..."
              />
            </div>
            <Select label="Vehicle Status" data-vehicle-field="status" error={fieldErrors.status} value={formData.status} onChange={(e)=>setFormData({...formData,status:e.target.value})}>
              <option>Active</option>
              <option>Inactive</option>
            </Select>
          </FormSection>

          <FormSection title="Vehicle Specifications">
            <div className="form-grid-full">
              <Input label="Registration Number" required data-vehicle-field="regNo" error={fieldErrors.regNo} icon={Car} value={formData.regNo} onChange={(e)=>setFormData({...formData,regNo:e.target.value})}/>
            </div>
            <Input label="Make / Manufacturer" required data-vehicle-field="make" error={fieldErrors.make} value={formData.make} onChange={(e)=>setFormData({...formData,make:e.target.value})}/>
            <Input label="Model" required data-vehicle-field="model" error={fieldErrors.model} value={formData.model} onChange={(e)=>setFormData({...formData,model:e.target.value})}/>
            <Input label="Variant / Edition" data-vehicle-field="variant" error={fieldErrors.variant} value={formData.variant} onChange={(e)=>setFormData({...formData,variant:e.target.value})}/>
            <Input label="Manufacturing Year" data-vehicle-field="year" error={fieldErrors.year} value={formData.year} onChange={(e)=>setFormData({...formData,year:e.target.value})}/>
            <Select label="Fuel Type" data-vehicle-field="fuelType" error={fieldErrors.fuelType} value={formData.fuelType} onChange={(e)=>setFormData({...formData,fuelType:e.target.value})}>
              <option>Petrol</option>
              <option>Diesel</option>
              <option>EV / Electric</option>
              <option>CNG / Hybrid</option>
            </Select>
            <Select label="Transmission" data-vehicle-field="transmission" error={fieldErrors.transmission} value={formData.transmission} onChange={(e)=>setFormData({...formData,transmission:e.target.value})}>
              <option>Manual</option>
              <option>Automatic</option>
              <option>CVT</option>
              <option>DCT</option>
            </Select>
            <Input label="Exterior Colour" data-vehicle-field="color" error={fieldErrors.color} value={formData.color} onChange={(e)=>setFormData({...formData,color:e.target.value})}/>
            <Input label="Current Odometer Reading" data-vehicle-field="odometer" error={fieldErrors.odometer} icon={Gauge} value={formData.odometer} onChange={(e)=>setFormData({...formData,odometer:e.target.value})}/>
            <Input label="VIN / Chassis Number" data-vehicle-field="vin" error={fieldErrors.vin} value={formData.vin} onChange={(e)=>setFormData({...formData,vin:e.target.value})}/>
            <Input label="Engine Number" data-vehicle-field="engineNo" error={fieldErrors.engineNo} value={formData.engineNo} onChange={(e)=>setFormData({...formData,engineNo:e.target.value})}/>
          </FormSection>

          <FormSection title="Service & Insurance">
            <Input label="Last Service Date" data-vehicle-field="lastServiceDate" error={fieldErrors.lastServiceDate} type="date" icon={Calendar} value={formData.lastServiceDate} onChange={(e)=>setFormData({...formData,lastServiceDate:e.target.value})}/>
            <Input label="Next Service Due Date" data-vehicle-field="nextServiceDue" error={fieldErrors.nextServiceDue} type="date" icon={Calendar} value={formData.nextServiceDue} onChange={(e)=>setFormData({...formData,nextServiceDue:e.target.value})}/>
            <Input label="Insurance Expiry Date" data-vehicle-field="insuranceExpiry" error={fieldErrors.insuranceExpiry} type="date" icon={ShieldCheck} value={formData.insuranceExpiry} onChange={(e)=>setFormData({...formData,insuranceExpiry:e.target.value})}/>
            <div className="form-grid-full">
              <Textarea label="Vehicle Condition & Notes" data-vehicle-field="notes" error={fieldErrors.notes} rows={3} value={formData.notes} onChange={(e)=>setFormData({...formData,notes:e.target.value})}/>
            </div>
          </FormSection>

          <StickyFormFooter
            statusText={`Editing ${formData.regNo || id}`}
            cancelLabel="Cancel"
            saveLabel="Update Vehicle"
            isSubmitting={submitting}
            onCancel={() => navigate(`/vehicles/${id}`)}
          />
        </form>
      </FormPage>
    </div>
  );
};

export default EditVehicle;
