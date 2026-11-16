import { useEffect, useId, useMemo, useState } from 'react';
import { Check, Plus, RotateCcw, X } from 'lucide-react';
import { vehicleCatalogService } from '../../services/vehicleCatalog.service';
import {
  STARTER_VEHICLE_CATALOG, cleanVehicleCatalogName, mergeVehicleCatalog,
} from '../../utils/vehicleCatalog';
import { splitVehicleMakeModel } from '../../utils/jobCreateAdapters';

/** Controlled Make -> Model selector. New values are saved by the authenticated
 * Django API; no vehicle record is created until the Job Card is submitted. */
export function VehicleMakeModelPicker({
  make = '', model = '', customerVehicles = [], onMakeChange, onModelChange,
  disabled = false,
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
      setCatalog(mergeVehicleCatalog(STARTER_VEHICLE_CATALOG, response?.makes));
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
      const result = await vehicleCatalogService.addEntry(addKind === 'make' ? name : make,
        addKind === 'model' ? name : '');
      const selectedMake = result?.make || (addKind === 'make' ? name : make);
      const selectedModel = result?.model || (addKind === 'model' ? name : '');
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

  return (
    <>
      <div className="job-vehicle-catalog-field">
        <div className="job-vehicle-catalog-heading">
          <label htmlFor={id + '-make'}>Make</label>
          <button type="button" className="job-vehicle-add-option" disabled={disabled || saving}
            onClick={() => openAdd('make')}><Plus size={15} aria-hidden="true" /> Add Make</button>
        </div>
        <select id={id + '-make'} name="vehicleMake" value={selectedMake} disabled={disabled || saving}
          onChange={(event) => { onMakeChange(event.target.value); setAddKind(''); setError(''); }}
          aria-label="Vehicle make">
          <option value="">Select Make</option>
          {options.map((entry) => <option key={entry.make} value={entry.make}>{entry.make}</option>)}
        </select>
      </div>

      <div className="job-vehicle-catalog-field">
        <div className="job-vehicle-catalog-heading">
          <label htmlFor={id + '-model'}>Model</label>
          <button type="button" className="job-vehicle-add-option"
            disabled={disabled || saving || !make}
            onClick={() => openAdd('model')}><Plus size={15} aria-hidden="true" /> Add Model</button>
        </div>
        <select id={id + '-model'} name="vehicleModel" value={selectedModel}
          disabled={disabled || saving || !make}
          aria-label="Vehicle model"
          onChange={(event) => { onModelChange(event.target.value); setAddKind(''); setError(''); }}>
          <option value="">{make ? 'Select Model' : 'Select Make first'}</option>
          {models.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {(addKind || error || loading) && (
        <div className="job-vehicle-catalog-feedback">
          {loading && <span role="status">Loading saved makes and models…</span>}
          {addKind && (
            <div className="job-vehicle-catalog-add">
              <label htmlFor={id + '-new'}>
                {addKind === 'make' ? 'New Make' : `New Model for ${make}`}
              </label>
              <div className="job-vehicle-catalog-add-row">
                <input id={id + '-new'} type="text" maxLength={80}
                  value={draft} disabled={saving}
                  placeholder={addKind === 'make' ? 'e.g. Isuzu' : 'e.g. D-Max'}
                  onChange={(event) => { setDraft(event.target.value); setError(''); }}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      void saveChoice();
                    }
                  }}/>
                <button type="button" className="is-save" disabled={saving || !draft.trim()}
                  onClick={() => void saveChoice()}>
                  <Check size={15} aria-hidden="true" /> {saving ? 'Saving…' : 'Save'}
                </button>
                <button type="button" disabled={saving}
                  onClick={() => { setAddKind(''); setDraft(''); setError(''); }}>
                  <X size={15} aria-hidden="true" /> Cancel
                </button>
              </div>
            </div>
          )}
          {error && (
            <div className="job-vehicle-catalog-error" role="alert">
              <span>{error}</span>
              {!addKind && <button type="button" onClick={() => void load()} disabled={loading}>
                <RotateCcw size={15} aria-hidden="true" /> Retry
              </button>}
            </div>
          )}
        </div>
      )}
    </>
  );
}
