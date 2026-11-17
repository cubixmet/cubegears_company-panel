import { useEffect, useId, useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { vehicleCatalogService } from '../../services/vehicleCatalog.service';
import {
  STARTER_VEHICLE_CATALOG, cleanVehicleCatalogName, mergeVehicleCatalog,
} from '../../utils/vehicleCatalog';
import { splitVehicleMakeModel } from '../../utils/jobCreateAdapters';
import { Select } from '../common/Select';

/** Controlled Make → Model selector shared by Job Cards and vehicle registration. */
export function VehicleMakeModelPicker({
  make = '', model = '', customerVehicles = [], onMakeChange, onModelChange,
  disabled = false, outlined = false, fieldErrors = {}, persistCustomOptions = true,
}) {
  const id = useId();
  const [catalog, setCatalog] = useState(STARTER_VEHICLE_CATALOG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [addKind, setAddKind] = useState('');
  const [draft, setDraft] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await vehicleCatalogService.getCatalog();
      setCatalog((current) => mergeVehicleCatalog(current, response?.makes));
    } catch {
      setError('Saved vehicle models could not be loaded. Check your connection and retry.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const options = useMemo(() => {
    const vehicles = customerVehicles.map((vehicle) => {
      const values = splitVehicleMakeModel(vehicle);
      return { make: values.make, models: values.model ? [values.model] : [] };
    });
    return mergeVehicleCatalog(
      catalog,
      vehicles,
      make ? [{ make, models: model ? [model] : [] }] : [],
    );
  }, [catalog, customerVehicles, make, model]);

  const selectedMake = options.find(
    (item) => item.make.toLocaleLowerCase() === make.toLocaleLowerCase()
  )?.make || make;
  const models = useMemo(
    () => options.find((item) => item.make.toLocaleLowerCase() === make.toLocaleLowerCase())?.models || [],
    [options, make],
  );
  const selectedModel = models.find((item) => item.toLocaleLowerCase() === model.toLocaleLowerCase()) || model;

  const openAdd = (kind) => {
    if (disabled || saving) return;
    setAddKind(kind);
    setDraft('');
    setError('');
  };

  const saveChoice = async () => {
    if (!addKind || disabled || saving) return;
    const name = cleanVehicleCatalogName(draft);
    if (!name || name.length > 80 || /[\x00-\x1f\x7f]/.test(draft)) {
      setError('Enter a valid name (maximum 80 characters).');
      return;
    }
    if (addKind === 'model' && !make) {
      setError('Select a Make before adding a Model.');
      return;
    }

    const existing = addKind === 'make'
      ? options.find((item) => item.make.toLocaleLowerCase() === name.toLocaleLowerCase())?.make
      : models.find((item) => item.toLocaleLowerCase() === name.toLocaleLowerCase());
    if (existing) {
      if (addKind === 'make') onMakeChange(existing);
      else onModelChange(existing);
      setAddKind('');
      setDraft('');
      setError('');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const choice = { make: addKind === 'make' ? name : make, model: addKind === 'model' ? name : '' };
      const result = persistCustomOptions ? await vehicleCatalogService.addEntry(choice.make, choice.model) : choice;
      const selectedMake = result?.make || choice.make;
      const selectedModel = result?.model || choice.model;
      setCatalog((current) => mergeVehicleCatalog(current, [
        { make: selectedMake, models: selectedModel ? [selectedModel] : [] },
      ]));
      if (addKind === 'make') onMakeChange(selectedMake);
      else onModelChange(selectedModel);
      setAddKind('');
      setDraft('');
    } catch (cause) {
      setError(cause?.message || 'Unable to save this vehicle option. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const Choice = outlined ? Select : 'select';
  const fieldClass = outlined ? 'flex min-w-0 flex-col gap-1' : 'job-vehicle-catalog-field';
  const headingClass = outlined ? 'flex justify-end' : 'job-vehicle-catalog-heading';
  const addButtonClass = outlined
    ? 'inline-flex min-h-11 items-center gap-1 px-2 text-sm font-semibold text-primary disabled:opacity-50'
    : 'job-vehicle-add-option';
  const formButtonClass = outlined
    ? 'inline-flex min-h-11 items-center gap-1 rounded-xl border border-line px-3 text-sm font-semibold disabled:opacity-50'
    : '';

  return (
    <>
      <div className={fieldClass} data-vehicle-field={outlined ? 'make' : undefined}>
        <div className={headingClass}>
          {!outlined && <label htmlFor={id + '-make'}>Make</label>}
          <button type="button" className={addButtonClass} disabled={disabled || saving}
            onClick={() => openAdd('make')}><Plus size={15} aria-hidden="true" /> Add Make</button>
        </div>
        <Choice id={id + '-make'} name="vehicleMake" value={selectedMake} disabled={disabled || saving}
          {...(outlined ? { label: 'Make / Manufacturer', error: fieldErrors.make, required: true } : { 'aria-label': 'Vehicle make' })}
          onChange={(event) => { onMakeChange(event.target.value); setAddKind(''); setError(''); }}>
          <option value="">Select Make</option>
          {options.map((entry) => <option key={entry.make} value={entry.make}>{entry.make}</option>)}
        </Choice>
      </div>

      <div className={fieldClass} data-vehicle-field={outlined ? 'model' : undefined}>
        <div className={headingClass}>
          {!outlined && <label htmlFor={id + '-model'}>Model</label>}
          <button type="button" className={addButtonClass}
            disabled={disabled || saving || !make}
            onClick={() => openAdd('model')}><Plus size={15} aria-hidden="true" /> Add Model</button>
        </div>
        <Choice id={id + '-model'} name="vehicleModel" value={selectedModel}
          disabled={disabled || saving || !make}
          {...(outlined ? { label: 'Model', error: fieldErrors.model, required: true } : { 'aria-label': 'Vehicle model' })}
          onChange={(event) => { onModelChange(event.target.value); setAddKind(''); setError(''); }}>
          <option value="">{make ? 'Select Model' : 'Select Make first'}</option>
          {models.map((item) => <option key={item} value={item}>{item}</option>)}
        </Choice>
      </div>

      {(addKind || error || loading) && (
        <div className={outlined ? 'col-span-full grid min-w-0 gap-2 text-sm' : 'job-vehicle-catalog-feedback'}>
          {loading && <span role="status">Loading saved makes and models…</span>}
          {addKind && (
            <div className={outlined ? 'grid min-w-0 gap-2' : 'job-vehicle-catalog-add'}>
              <label htmlFor={id + '-new'}>
                {addKind === 'make' ? 'New Make' : `New Model for ${make}`}
              </label>
              <div className={outlined ? 'flex flex-wrap items-center gap-2' : 'job-vehicle-catalog-add-row'}>
                <input id={id + '-new'} type="text" maxLength={80}
                  className={outlined ? 'min-h-11 min-w-0 flex-1 basis-48 rounded-xl border border-line bg-[var(--field-bg)] px-3 text-base text-content' : undefined}
                  value={draft} disabled={saving}
                  placeholder={addKind === 'make' ? 'e.g. Isuzu' : 'e.g. D-Max'}
                  onChange={(event) => { setDraft(event.target.value); setError(''); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveChoice();
                    }
                  }}/>
                <button type="button" className={outlined ? formButtonClass + ' bg-primary text-white' : 'is-save'} disabled={saving || !draft.trim()}
                  onClick={() => void saveChoice()}>
                  <Check size={15} aria-hidden="true" /> {saving ? 'Saving…' : persistCustomOptions ? 'Save' : addKind === 'make' ? 'Use Make' : 'Use Model'}
                </button>
                <button type="button" className={formButtonClass} disabled={saving}
                  onClick={() => { setAddKind(''); setDraft(''); setError(''); }}>
                  <X size={15} aria-hidden="true" /> Cancel
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className={outlined ? 'flex flex-wrap items-center gap-2 text-danger' : 'job-vehicle-catalog-error'} role="alert">
              <span>{error}</span>
              {!addKind && <button type="button" className={formButtonClass} onClick={() => void load()} disabled={loading}>
                <RotateCcw size={15} aria-hidden="true" /> Retry
              </button>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
