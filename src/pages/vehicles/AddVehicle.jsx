import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from 'react-router-dom';
import { FormPage } from '../../components/common/forms/FormPage';
import { FormSection } from '../../components/common/forms/FormSection';
import { StickyFormFooter } from '../../components/common/forms/StickyFormFooter';
import { Input } from '../../components/common/Input';
import { Select } from '../../components/common/Select';
import { Textarea } from '../../components/common/Textarea';
import { SearchableSelect } from '../../components/common/forms/SearchableSelect';
import { FileUpload } from '../../components/common/forms/FileUpload';
import { customerService } from '../../services/customer.service';
import { vehicleService } from '../../services/vehicle.service';
import { vehiclePhotoService } from '../../services/vehiclePhoto.service';
import { VehicleCameraQueue } from '../../components/vehicles/VehicleCameraQueue';
import { Car, Calendar, Gauge, ShieldCheck, CheckCircle2 } from 'lucide-react';
import '../../styles/vehicle-management.css';
import '../../styles/vehicle-camera-form-responsive.css';
import '../../styles/vehicle-compact-cleanup.css';
import { extractVehicleFieldErrors, focusFirstVehicleError, requiredVehicleFields } from './vehicleFormValidation';

export const AddVehicle = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const preselectedCustId = searchParams.get('customerId') || '';

  const [customers, setCustomers] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState('');
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [savedVehicleId, setSavedVehicleId] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(0);
  const [fieldErrors, setFieldErrors] = useState({});
  const [customerLoadError, setCustomerLoadError] = useState('');
  const [customerReloadKey, setCustomerReloadKey] = useState(0);
  const formRef = useRef(null);

  const [formData, setFormData] = useState({
    customerId: preselectedCustId,
    regNo: '',
    make: '',
    model: '',
    variant: '',
    year: '',
    fuelType: '',
    transmission: '',
    color: '',
    odometer: '',
    vin: '',
    engineNo: '',
    lastServiceDate: '',
    nextServiceDue: '',
    insuranceExpiry: '',
    notes: ''
  });

  useEffect(() => {
    let active = true;
    setCustomerLoadError('');
    customerService.getCustomers()
      .then((rows) => { if (active) setCustomers(Array.isArray(rows) ? rows : []); })
      .catch((cause) => { if (active) setCustomerLoadError(cause?.message || 'Unable to load customers.'); });
    return () => { active = false; };
  }, [customerReloadKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;
    const invalid = savedVehicleId ? {} : requiredVehicleFields(formData, customers);
    if (Object.keys(invalid).length) {
      setFieldErrors(invalid);
      setError('Check the highlighted vehicle fields.');
      requestAnimationFrame(() => focusFirstVehicleError(formRef.current, invalid));
      return;
    }
    setSubmitting(true);
    setFieldErrors({});
    setError('');
    setToastMsg('');
    try {
      let vehicleId = savedVehicleId;
      if (!vehicleId) {
        const selectedCustomer = customers.find((customer) => String(customer.id) === String(formData.customerId));
        const payload = {
          ...formData,
          customerName: selectedCustomer?.name || '',
        };
        const created = await vehicleService.createVehicle(payload);
        vehicleId = created?.id;
        if (!vehicleId) throw new Error('Vehicle was saved but no vehicle reference was returned.');
        setSavedVehicleId(vehicleId);
      }

      // Do not discard captured files on validation or network failures.
      // Subsequent Save clicks resume uploads without creating duplicate vehicles.
      for (let i = 0; i < photos.length; i += 1) {
        const photo = photos[i];
        setUploadingPhoto(i + 1);
        await vehiclePhotoService.upload({ vehicleId, ...photo });
        setPhotos((items) => items.filter((entry) => entry.id !== photo.id));
      }
      setUploadingPhoto(0);
      setToastMsg(photos.length ? 'Vehicle and inspection photos saved.' : 'Vehicle saved.');
      navigate(`/vehicles/${vehicleId}`);
    } catch (cause) {
      const next = extractVehicleFieldErrors(cause);
      setFieldErrors(next);
      setError(cause?.message || 'Unable to save vehicle or photos. Retry to continue without duplication.');
      requestAnimationFrame(() => focusFirstVehicleError(formRef.current, next));
    } finally {
      setUploadingPhoto(0);
      setSubmitting(false);
    }
  };

  const customerOptions = customers.map(c => ({
    value: c.id,
    label: `${c.name} (${c.phone || 'No phone'})`
  }));

  return (
    <div className="vehicle-form-page cg-vehicles">
    <FormPage
      title="Add Vehicle"
      
    >
      {customerLoadError && <div role="alert" className="vehicle-dashboard-error">
        {customerLoadError} <button type="button" onClick={() => setCustomerReloadKey((key) => key + 1)}>Retry customers</button>
      </div>}
      {error && <div role="alert" className="vehicle-dashboard-error">{error} {savedVehicleId && 'The vehicle was saved; retry to upload remaining photos.'}</div>}
      {toastMsg && (
        <div style={{ backgroundColor: 'var(--success)', color: '#ffffff', padding: '10px 14px', borderRadius: '10px', fontSize: '13px', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={16} />
          {toastMsg}
        </div>
      )}

      <form ref={formRef} className="vehicle-form" noValidate onSubmit={handleSubmit}
        onInvalid={(event) => {
          event.target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          event.target?.focus();
        }}>
        
        {/* CUSTOMER SELECTION */}
        <FormSection
          title="Select Customer Owner"
          
        >
          <div className="form-grid-full" data-vehicle-field="customerId">
            <SearchableSelect
              label="Customer Owner"
              required
              error={fieldErrors.customerId}
              disabled={Boolean(customerLoadError) || Boolean(savedVehicleId)}
              options={customerOptions}
              value={formData.customerId}
              onChange={(val) => { setFormData({ ...formData, customerId: val }); setFieldErrors((prev) => ({ ...prev, customerId: '' })); }}
              placeholder="Search customer by name or phone..."
            />
          </div>
        </FormSection>

        {/* VEHICLE INFORMATION */}
        <FormSection
          title="Vehicle Specifications"
          
        >
          <div className="form-grid-full">
            <Input
              label="Registration Number"
              data-vehicle-field="regNo"
              error={fieldErrors.regNo}
              required
              icon={Car}
              placeholder="e.g. KL 10 AB 1234"
              value={formData.regNo}
              onChange={(e) => setFormData({ ...formData, regNo: e.target.value })}
            />
          </div>

          <Input
            label="Make / Manufacturer"
            data-vehicle-field="make"
            error={fieldErrors.make}
            required
            placeholder="Toyota"
            value={formData.make}
            onChange={(e) => setFormData({ ...formData, make: e.target.value })}
          />

          <Input
            label="Model"
            data-vehicle-field="model"
            error={fieldErrors.model}
            required
            placeholder="Innova 2.5V"
            value={formData.model}
            onChange={(e) => setFormData({ ...formData, model: e.target.value })}
          />

          <Input
            label="Variant / Edition" data-vehicle-field="variant" error={fieldErrors.variant}
            placeholder="2.5V VX Seven Seater"
            value={formData.variant}
            onChange={(e) => setFormData({ ...formData, variant: e.target.value })}
          />

          <Input
            label="Manufacturing Year" data-vehicle-field="year" error={fieldErrors.year}
            placeholder="2021"
            value={formData.year}
            onChange={(e) => setFormData({ ...formData, year: e.target.value })}
          />

          <Select
            label="Fuel Type" data-vehicle-field="fuelType" error={fieldErrors.fuelType}
            value={formData.fuelType}
            onChange={(e) => setFormData({ ...formData, fuelType: e.target.value })}
          >
            <option value="">Select fuel type</option>
            <option value="Diesel">Diesel</option>
            <option value="Petrol">Petrol</option>
            <option value="EV / Electric">EV / Electric</option>
            <option value="CNG / Hybrid">CNG / Hybrid</option>
          </Select>

          <Select
            label="Transmission" data-vehicle-field="transmission" error={fieldErrors.transmission}
            value={formData.transmission}
            onChange={(e) => setFormData({ ...formData, transmission: e.target.value })}
          >
            <option value="">Select transmission</option>
            <option value="Manual">Manual</option>
            <option value="Automatic">Automatic</option>
          </Select>

          <Input
            label="Exterior Colour" data-vehicle-field="color" error={fieldErrors.color}
            placeholder="Pearl White"
            value={formData.color}
            onChange={(e) => setFormData({ ...formData, color: e.target.value })}
          />

          <Input
            label="Current Odometer Reading" data-vehicle-field="odometer" error={fieldErrors.odometer}
            icon={Gauge}
            placeholder="1,24,500 km"
            value={formData.odometer}
            onChange={(e) => setFormData({ ...formData, odometer: e.target.value })}
          />

          <Input
            label="VIN / Chassis Number" data-vehicle-field="vin" error={fieldErrors.vin}
            placeholder="MBJ112233445566"
            value={formData.vin}
            onChange={(e) => setFormData({ ...formData, vin: e.target.value })}
          />

          <Input
            label="Engine Number" data-vehicle-field="engineNo" error={fieldErrors.engineNo}
            placeholder="ENG9081234"
            value={formData.engineNo}
            onChange={(e) => setFormData({ ...formData, engineNo: e.target.value })}
          />
        </FormSection>

        <FormSection title="Vehicle Inspection Camera">
          <VehicleCameraQueue photos={photos} onChange={setPhotos} disabled={submitting} uploading={uploadingPhoto}/>
        </FormSection>

        {/* SERVICE & INSURANCE DATES */}
        <FormSection
          title="Service & Insurance History"
          
        >
          <Input
            label="Last Service Date" data-vehicle-field="lastServiceDate" error={fieldErrors.lastServiceDate}
            type="date"
            icon={Calendar}
            value={formData.lastServiceDate}
            onChange={(e) => setFormData({ ...formData, lastServiceDate: e.target.value })}
          />

          <Input
            label="Next Service Due Date" data-vehicle-field="nextServiceDue" error={fieldErrors.nextServiceDue}
            type="date"
            icon={Calendar}
            value={formData.nextServiceDue}
            onChange={(e) => setFormData({ ...formData, nextServiceDue: e.target.value })}
          />

          <Input
            label="Insurance Expiry Date" data-vehicle-field="insuranceExpiry" error={fieldErrors.insuranceExpiry}
            type="date"
            icon={ShieldCheck}
            value={formData.insuranceExpiry}
            onChange={(e) => setFormData({ ...formData, insuranceExpiry: e.target.value })}
          />

          <div className="form-grid-full">
            <FileUpload label="Upload Registration RC / Insurance Document" />
          </div>

          <div className="form-grid-full">
            <Textarea
              label="Vehicle Condition & Staff Notes" data-vehicle-field="notes" error={fieldErrors.notes}
              rows={3}
              placeholder="e.g. Minor dent on left rear door, aftermarket alloy wheels..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            />
          </div>
        </FormSection>

        {/* STICKY FOOTER */}
        <StickyFormFooter
          statusText={savedVehicleId ? 'Saved · upload remaining photos' : 'New Vehicle Registration'}
          cancelLabel="Cancel"
          saveLabel="Save Vehicle"
          isSubmitting={submitting}
          onCancel={() => navigate('/vehicles')}
        />
      </form>
    </FormPage>
    </div>
  );
};
