import { appConfirm } from '../../components/common/appDialogs';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { ResponsiveModalSheet } from '../../components/common/ResponsiveModalSheet';
import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Activity, Clock3, Edit3, IndianRupee, Layers3, Trash2, AlertCircle, FolderTree, Plus, RefreshCw } from "lucide-react";
import {
  ServiceCatalogGrid,
  ServiceFilterToolbar,
  ServiceOverviewStats,
  ServiceCategoriesPanel,
  ServicesHeader,
} from '../../components/services';
import { serviceService } from '../../services/service.service';
import GstRateDropdown from '../../components/common/GstRateDropdown';
import { buildCategoryTreeRows } from '../../utils/serviceHierarchy';
import '../../styles/service-management.css';
import '../../styles/service-borderless-forms.css';
import '../../styles/service-hierarchy.css';
import '../../styles/services-modal-workspace.css';
import '../../styles/services-directory-refined.css';
import '../../styles/service-editor-refined.css';

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0
});

const pricingTypes = ['Fixed', 'Starting', 'Inspection Based'];
const serviceRateMoney = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2
});

const emptyService = {
  code: '',
  name: '',
  category: '',
  categoryId: '',
  pricingType: 'Fixed',
  price: '',
  durationMinutes: '60',
  status: 'active',
  description: '',
  checklistText: '',
  hsnSac: '', taxRate: '18', taxTreatment: 'taxable', unit: 'Job'
};

const emptyCategory = {
  name: '',
  description: '',
  parentId: '',
  status: 'active',
};

const durationLabel = (minutes) => {
  const total = Number(minutes || 0);
  if (!total) return '—';
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
};

const Metric = ({ label, value, icon: Icon, tone = 'primary' }) => (
  <article className="service-metric-card">
    <div className="service-metric-card__top">
      <span>{label}</span>
      <i className={`is-${tone}`}><Icon size={16}/></i>
    </div>
    <strong>{value}</strong>
  </article>
);

const Field = ({ label, children, wide = false, required = false, hint = '' }) => (
  <label className={wide ? 'service-field is-wide' : 'service-field'}>
    <span>{label}{required && <span className="cg-service-required" aria-hidden="true"> *</span>}</span>
    {children}
    {hint && <small className="cg-service-field-hint">{hint}</small>}
  </label>
);

const ServiceForm = ({
  values,
  setValues,
  categories,
  onSubmit,
  onCancel,
  submitting,
  title,
  error,
  onAddCategory
}) => {
  const selectedCategory = categories.find(item => String(item.id) === String(values.categoryId));
  const price = String(values.price ?? '').trim();
  const isTaxable = (values.taxTreatment || 'taxable') === 'taxable';
  const ready = Boolean(values.name.trim() && values.code.trim() && values.categoryId);

  return (
    <div className="service-form-page cg-services cg-service-editor">
      <p className="cg-service-editor-intro">
        Create a reusable workshop service with its labour charge, tax details and technician checklist.
        <span> Fields marked * are required.</span>
      </p>

      <form className="service-form" onSubmit={onSubmit}>
        {error && <div className="service-form-error" role="alert"><AlertCircle size={17}/>{error}</div>}

        <section className="service-form-section" aria-labelledby="service-info-title">
          <div className="service-section-header">
            <span className="cg-service-section-icon"><Layers3 size={18} aria-hidden="true"/></span>
            <div>
              <h2 id="service-info-title">Basic Details</h2>
              <p>Name, code and catalog organization.</p>
            </div>
          </div>
          <div className="service-form-grid cg-service-editor-basics">
            <Field label="Service Name" wide required>
              <input type="text" required maxLength={180} autoComplete="off"
                value={values.name}
                onChange={event => setValues({...values, name:event.target.value})}
                placeholder="e.g. Front Brake Pad Replacement"/>
            </Field>
            <Field label="Service Code" required hint="Unique code for finding this service.">
              <input type="text" required maxLength={50} autoCapitalize="characters" autoComplete="off"
                value={values.code}
                onChange={event => setValues({...values, code:event.target.value.toUpperCase()})}
                placeholder="e.g. BRAKE-001"/>
            </Field>
            <div className="service-category-select-field">
              <Field label="Category" required>
                <select required value={values.categoryId}
                  onChange={event => {
                    const category = categories.find(item => String(item.id) === String(event.target.value));
                    setValues({...values, categoryId:event.target.value, category:category?.name || ''});
                  }}>
                  <option value="">Select category</option>
                  {categories.map(category =>
                    <option key={category.id} value={category.id}>
                      {'— '.repeat(Math.min(category.depth || 0, 10)) + category.name}
                    </option>)}
                </select>
              </Field>
              {onAddCategory && <button type="button" className="service-add-category-inline"
                onClick={onAddCategory}><Plus size={15} aria-hidden="true"/> Add Category</button>}
            </div>
            <Field label="Status" hint="Inactive services stay saved but are not offered for new jobs.">
              <select value={values.status} onChange={event => setValues({...values, status:event.target.value})}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
          </div>
        </section>

        <section className="service-form-section" aria-labelledby="service-pricing-title">
          <div className="service-section-header">
            <span className="cg-service-section-icon"><IndianRupee size={18} aria-hidden="true"/></span>
            <div>
              <h2 id="service-pricing-title">Pricing & Duration</h2>
              <p>Set the default labour charge and expected time.</p>
            </div>
          </div>
          <div className="service-form-grid cg-service-editor-pricing">
            <Field label="Default Selling Rate (₹)" hint="Base rate before any applicable GST.">
              <input type="number" min="0" max="10000000" step="0.01" inputMode="decimal"
                value={values.price} placeholder="0.00"
                onChange={event => setValues({...values, price:event.target.value})}/>
            </Field>
            <Field label="Pricing Type">
              <select value={values.pricingType}
                onChange={event => setValues({...values, pricingType:event.target.value})}>
                {pricingTypes.map(type => <option key={type} value={type}>{type}</option>)}
              </select>
            </Field>
            <Field label="Estimated Duration (minutes)">
              <input type="number" min="0" step="1" inputMode="numeric"
                value={values.durationMinutes} placeholder="60"
                onChange={event => setValues({...values, durationMinutes:event.target.value})}/>
            </Field>
            <Field label="Unit">
              <input type="text" maxLength={30} value={values.unit || 'Job'}
                placeholder="e.g. Job" onChange={event => setValues({...values, unit:event.target.value})}/>
            </Field>
          </div>

          <div className="cg-service-editor-tax-heading">
            <h3>GST & Classification</h3>
            <p>Use the verified SAC / HSN and GST treatment for the service.</p>
          </div>
          <div className="service-form-grid cg-service-editor-tax">
            <Field label="SAC / HSN" hint="Optional. Enter the correct alphanumeric classification if known.">
              <input type="text" maxLength={20} autoCapitalize="characters" value={values.hsnSac || ''}
                onChange={event => setValues({...values, hsnSac:event.target.value.toUpperCase()})}
                placeholder="SAC / HSN code"/>
            </Field>
            <Field label="GST Treatment">
              <select value={values.taxTreatment || 'taxable'}
                onChange={event => setValues({...values, taxTreatment:event.target.value})}>
                <option value="taxable">Taxable</option>
                <option value="exempt">Exempt</option>
                <option value="nil_rated">Nil-rated</option>
                <option value="non_gst">Non-GST</option>
                <option value="out_of_scope">Out of scope</option>
              </select>
            </Field>
            <div className="cg-service-editor-gst-field">
              <Field label="GST Rate (%)" hint="The selected rate is the total GST percentage, not an extra component.">
                <GstRateDropdown value={values.taxRate ?? ''} selectLabel="Service GST Rate (%)"
                  disabled={!isTaxable}
                  onChange={rate => setValues({...values, taxRate:rate })}/>
              </Field>
            </div>
            {!isTaxable && <p className="cg-service-editor-tax-message" role="status">
              This service is marked {values.taxTreatment?.replaceAll('_', ' ')}. The GST rate is
              retained for future edits but is not selectable for this treatment.
            </p>}
          </div>
        </section>

        <section className="service-form-section" aria-labelledby="service-notes-title">
          <div className="service-section-header">
            <span className="cg-service-section-icon"><FolderTree size={18} aria-hidden="true"/></span>
            <div>
              <h2 id="service-notes-title">Description & Technician Checklist</h2>
              <p>Optional work instructions for mechanics and service advisors.</p>
            </div>
          </div>
          <div className="service-form-grid cg-service-editor-notes">
            <Field label="Description">
              <textarea rows={4} maxLength={2000}
                value={values.description}
                onChange={event => setValues({...values, description:event.target.value})}
                placeholder="Describe the labour and work included…"/>
            </Field>
            <Field label="Checklist — one item per line">
              <textarea rows={4}
                value={values.checklistText}
                onChange={event => setValues({...values, checklistText:event.target.value})}
                placeholder={'Inspect condition\nPerform labour work\nFinal quality check'}/>
            </Field>
          </div>
        </section>

        <div className="cg-service-editor-summary" aria-label="Service details preview">
          <div>
            <span>Service</span>
            <strong>{values.name.trim() || 'Not named yet'}</strong>
            <small>{selectedCategory?.name || 'Category not selected'}</small>
          </div>
          <div><span>Default rate</span><strong>{price && Number.isFinite(Number(price)) ? serviceRateMoney.format(Number(price)) : 'Not set'}</strong></div>
          <div><span>Time</span><strong>{durationLabel(values.durationMinutes)}</strong></div>
        </div>

        <div className="service-form-actions cg-service-editor-actions">
          <button type="button" onClick={onCancel} disabled={submitting}>Cancel</button>
          <button type="submit" className="is-primary" disabled={submitting || !ready}>
            {submitting ? 'Saving…' : title === 'Edit Service' ? 'Save Changes' : 'Create Service'}
          </button>
        </div>
      </form>
    </div>
  );
};

export const ServiceList = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const canCreate = hasPermission(user, 'services.create');
  const canEdit = hasPermission(user, 'services.edit');
  const canDelete = hasPermission(user, 'services.delete');

  const isNew = location.pathname === '/services/new';
  const isEdit = Boolean(id && location.pathname.endsWith('/edit'));
  const isDelete = Boolean(id && location.pathname.endsWith('/delete'));
  const isDetail = Boolean(id && !isEdit && !isDelete && location.pathname !== '/services');
  const serviceModalOpen = isNew || isEdit || isDetail || isDelete;

  const [services, setServices] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formDirty, setFormDirty] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showCategories, setShowCategories] = useState(false);
  const [focusedService, setFocusedService] = useState(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const hasActiveFilters = Boolean(query.trim() || categoryFilter !== 'All' || statusFilter !== 'All');
  const resetCatalogFilters = () => {
    setQuery('');
    setCategoryFilter('All');
    setStatusFilter('All');
  };
  const [form, setForm] = useState(emptyService);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryForm, setCategoryForm] = useState(emptyCategory);
  const [categoryError, setCategoryError] = useState('');
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [categoryOpenedFromService, setCategoryOpenedFromService] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [serviceRows, categoryRows] = await Promise.all([
        serviceService.getServices(),
        serviceService.getServiceCategories()
      ]);
      setServices(serviceRows);
      setCategories(categoryRows);
      return true;
    } catch (error) {
      setLoadError(error?.message || 'Unable to load workshop services. Please try again.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (location.state?.serviceNotice) {
      setNotice(location.state.serviceNotice);
    }
  }, [location.state]);

  useEffect(() => {
    if (isNew) {
      setForm(emptyService);
      setFormDirty(false);
      setFormError('');
    }
  }, [isNew]);

  useEffect(() => {
    if (!isEdit || !id) return;
    const service = services.find((item)=>String(item.id)===String(id)) || focusedService;
    if (!service || String(service.id) !== String(id)) return;
    setForm({
      code: service.code || '',
      name: service.name || '',
      category: service.category || '',
      categoryId: service.categoryId || categories.find((category)=>category.name===service.category)?.id || '',
      pricingType: service.pricingType || 'Fixed',
      price: service.price ?? '',
      durationMinutes: service.durationMinutes ?? '',
      status: service.status || 'active',
      description: service.description || '',
      checklistText: Array.isArray(service.checklist)
        ? service.checklist.join('\n')
        : service.checklistText || '',
      hsnSac: service.hsnSac || '', taxRate: service.taxRate ?? '18',
      taxTreatment: service.taxTreatment || 'taxable', unit: service.unit || 'Job'
    });
    setFormError('');
    setFormDirty(false);
  }, [isEdit, id, services, focusedService]);

  useEffect(() => {
    if (isNew && !form.categoryId && categories.length) {
      setForm((current)=>({
        ...current,
        categoryId: categories[0].id,
        category: categories[0].name
      }));
    }
  }, [isNew, categories, form.categoryId]);

  const categoryTree = useMemo(() => buildCategoryTreeRows(categories), [categories]);

  const selectedService = useMemo(
    () => services.find((service)=>String(service.id)===String(id)) ||
      (String(focusedService?.id) === String(id) ? focusedService : null),
    [services, id, focusedService]
  );

  useEffect(() => {
    if (!id || !serviceModalOpen || services.some((row) => String(row.id) === String(id))) return;
    let active = true;
    serviceService.getServiceById(id).then((row) => {
      if (active) setFocusedService(row);
    }).catch((error) => {
      if (active) setActionError(error?.message || 'Unable to load this service.');
    });
    return () => { active = false; };
  }, [id, serviceModalOpen, services]);

  const changeForm = (value) => {
    setForm(value);
    setFormDirty(true);
    setFormError('');
  };

  const closeServiceModal = async () => {
    if (submitting || deleting) return;
    if ((isEdit || isNew) && formDirty &&
        !await appConfirm('Discard your unsaved service changes?', {
          title: 'Discard changes?',
          confirmLabel: 'Discard',
          tone: 'danger',
        })) return;
    setActionError('');
    setFormError('');
    navigate('/services');
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services.filter((service) => {
      const queryMatch = !q || [service.code, service.name, service.category, service.description]
        .some((value)=>String(value || '').toLowerCase().includes(q));
      const categoryMatch = categoryFilter === 'All' || service.category === categoryFilter;
      const statusMatch = statusFilter === 'All' || String(service.status).toLowerCase() === statusFilter.toLowerCase();
      return queryMatch && categoryMatch && statusMatch;
    });
  }, [services, query, categoryFilter, statusFilter]);

  const metrics = useMemo(() => ({
    total: services.length,
    active: services.filter((service)=>String(service.status).toLowerCase()==='active').length,
    categories: categories.length,
    averagePrice: services.length
      ? services.reduce((sum, service)=>sum+Number(service.price || 0),0) / services.length
      : 0
  }), [services, categories]);

  const saveService = async (event) => {
    event.preventDefault();
    if (submitting || !canCreate && !isEdit || isEdit && !canEdit) return;
    setFormError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        price: Number(form.price || 0),
        durationMinutes: Number(form.durationMinutes || 0),
        checklist: form.checklistText
          .split('\n')
          .map((item)=>item.trim())
          .filter(Boolean)
      };
      if (!payload.code || !payload.name || !payload.categoryId) {
        setFormError('Enter a service code, name and category before saving.');
        return;
      }
      if (!Number.isFinite(payload.price) || payload.price < 0 ||
          !Number.isFinite(payload.durationMinutes) || payload.durationMinutes < 0) {
        setFormError('Charge and duration must be valid, non-negative numbers.');
        return;
      }
      if (isEdit && id) {
        await serviceService.updateService(id, payload);
      } else {
        await serviceService.createService(payload);
      }
      setFormDirty(false);
      await load();
      navigate('/services', { state: { serviceNotice: isEdit ? 'Service updated successfully.' : 'New service added successfully.' } });
    } catch (error) {
      setFormError(error?.message || 'Unable to save the service. Review the details and retry.');
    } finally {
      setSubmitting(false);
    }
  };

  const openCategoryDialog = (category = null, parentId = '', fromService = false) => {
    setCategoryOpenedFromService(fromService);
    setEditingCategoryId(category?.id || null);
    setCategoryForm(category
      ? { name: category.name || '', description: category.description || '',
          parentId: category.parentId || '', status: category.status || 'active' }
      : { ...emptyCategory, parentId: parentId || '' });
    setCategoryError('');
    setCategoryDialogOpen(true);
  };

  const closeCategoryDialog = () => {
    if (categorySaving) return;
    setCategoryDialogOpen(false);
    setEditingCategoryId(null);
    setCategoryOpenedFromService(false);
    setCategoryForm(emptyCategory);
    setCategoryError('');
  };

  const saveCategory = async (event) => {
    event.preventDefault();
    if (categorySaving) return;
    setCategoryError('');
    setCategorySaving(true);
    try {
      const payload = {
        ...categoryForm,
        name: categoryForm.name.trim(),
        parentId: categoryForm.parentId || '',
      };
      if (!payload.name) {
        setCategoryError('Please enter a category name.');
        return;
      }
      let saved;
      if (editingCategoryId) {
        saved = await serviceService.updateServiceCategory(editingCategoryId, payload);
      } else {
        saved = await serviceService.createServiceCategory(payload);
      }
      setCategories(await serviceService.getServiceCategories());
      if (categoryOpenedFromService && saved?.id) {
        changeForm({ ...form, categoryId: saved.id, category: saved.name || payload.name });
      }
      setCategoryDialogOpen(false);
      setEditingCategoryId(null);
      setCategoryOpenedFromService(false);
      setCategoryForm(emptyCategory);
      setNotice(editingCategoryId ? 'Category updated.' : 'Category created.');
    } catch (error) {
      setCategoryError(error?.message || 'Unable to add category.');
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteService = async (service) => {
    if (!service || deleting || !canDelete) return;
    setActionError('');
    setDeleting(true);
    try {
      await serviceService.deleteService(service.id);
      await load();
      navigate('/services', { state: { serviceNotice: `${service.name} deleted.` } });
    } catch (error) {
      setActionError(error?.message || 'Could not delete this service. It may be used on an existing job.');
    } finally {
      setDeleting(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!canDelete || !await appConfirm(`Delete category "${category.name}"? Categories with services or subcategories cannot be deleted.`, {
      title: 'Delete category?',
      confirmLabel: 'Delete category',
      tone: 'danger',
    })) return;
    try {
      await serviceService.deleteServiceCategory(category.id);
      setCategories(await serviceService.getServiceCategories());
      setNotice('Category deleted.');
      setActionError('');
    } catch (error) {
      setActionError(error?.message || 'Could not delete this category.');
    }
  };


  const checklist = Array.isArray(selectedService?.checklist) ? selectedService.checklist : [];
  const editingService = isNew || isEdit;

  return (
    <div className="service-management-page cg-services service-dashboard cg-services-refined">
      <ServicesHeader
        onAdd={()=>navigate('/services/new')}
        onAddCategory={()=>openCategoryDialog()}
      />

      {(location.state?.serviceNotice || notice) && (
        <div className="service-workspace-success" role="status">{location.state?.serviceNotice || notice}</div>
      )}
      {loadError && (
        <div className="service-workspace-error" role="alert">
          <AlertCircle size={18}/>
          <span>{loadError}</span>
          <button type="button" onClick={()=>void load()}><RefreshCw size={16}/> Retry</button>
        </div>
      )}
      {actionError && (
        <div className="service-workspace-error" role="alert">
          <AlertCircle size={18}/><span>{actionError}</span>
          <button type="button" onClick={()=>setActionError('')}>Dismiss</button>
        </div>
      )}
      {loading && <div className="service-workspace-loading" role="status">
        <RefreshCw size={18} className="service-spinning"/> Loading workshop services…
      </div>}

      <ServiceOverviewStats
        metrics={metrics}
        formatMoney={(value)=>money.format(value || 0)}
      />

      <ServiceFilterToolbar
        query={query}
        onQueryChange={setQuery}
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        categories={categoryTree}
        onReset={resetCatalogFilters}
      />

      <div className="service-workspace-list-head">
        <div><h2>Service Catalog</h2>
          <p>{filtered.length} of {services.length} services</p>
        </div>
        <button type="button" className="service-workspace-manage"
          aria-expanded={showCategories} aria-controls="service-categories-section"
          onClick={()=>setShowCategories((open)=>!open)}>
          <FolderTree size={17}/>{showCategories ? 'Hide Categories' : 'Manage Categories'}
        </button>
      </div>
      {!loading && <ServiceCatalogGrid
        services={filtered}
        formatMoney={(value)=>money.format(value || 0)}
        durationLabel={durationLabel}
        onView={(service)=>navigate(`/services/${service.id}`)}
        onEdit={(service)=>navigate(`/services/${service.id}/edit`)}
        onDelete={(service)=>navigate(`/services/${service.id}/delete`)}
        hasFilters={hasActiveFilters}
        onReset={resetCatalogFilters}
      />}
      {!loading && !services.length && canCreate && !loadError && (
        <button type="button" className="service-workspace-empty-add" onClick={()=>navigate('/services/new')}>
          <Plus size={18}/> Add your first workshop service
        </button>
      )}
      {showCategories && (
        <div id="service-categories-section" className="service-workspace-categories">
          <ServiceCategoriesPanel
            categories={categories} services={services}
            onAdd={(parentId)=>openCategoryDialog(null,parentId)}
            onEdit={(category)=>openCategoryDialog(category)}
            onDelete={deleteCategory}
          />
        </div>
      )}

      <ResponsiveModalSheet
        isOpen={serviceModalOpen}
        onClose={closeServiceModal}
        title={isNew ? 'Add Service' : isEdit ? 'Edit Service' : isDelete ? 'Delete Service' : 'Service Details'}
        maxWidth={editingService ? '900px' : '840px'}
      >
        {(editingService && (!isEdit || selectedService)) ? (
          <ServiceForm
            values={form} setValues={changeForm} categories={categoryTree}
            onSubmit={saveService} onCancel={closeServiceModal}
            submitting={submitting}
            title={isEdit ? 'Edit Service' : 'Add Service'}
            error={formError}
            onAddCategory={canCreate ? ()=>openCategoryDialog(null, '', true) : undefined}
          />
        ) : isDetail && selectedService ? (
                <div className="service-management-page service-detail-page cg-services">
        <header className="service-detail-header">
          <div>
            <span>{selectedService.code}</span>
            <h1>{selectedService.name}</h1>
            <p>{selectedService.category} · {selectedService.pricingType || 'Fixed'}</p>
          </div>
          <div className="service-detail-actions">
            {canEdit && <button type="button" onClick={()=>navigate(`/services/${selectedService.id}/edit`)}><Edit3 size={14}/> Edit</button>}
            {canDelete && <button type="button" className="is-danger" onClick={()=>navigate(`/services/${selectedService.id}/delete`)}><Trash2 size={14}/> Delete</button>}
          </div>
        </header>

        <div className="service-detail-kpis">
          <div><IndianRupee size={16}/><span>Labour Charge</span><strong>{money.format(selectedService.price || 0)}</strong></div>
          <div><Clock3 size={16}/><span>Duration</span><strong>{durationLabel(selectedService.durationMinutes)}</strong></div>
          <div><Layers3 size={16}/><span>Category</span><strong>{selectedService.category}</strong></div>
          <div><Activity size={16}/><span>Status</span><strong>{selectedService.status || 'active'}</strong></div>
        </div>

        <div className="service-two-column">
          <section className="service-panel">
            <div className="service-section-header">
              <div>
                <h2>Service Details</h2>
                
              </div>
            </div>
            <div className="service-info-grid">
              <div><span>Code</span><strong>{selectedService.code}</strong></div>
              <div><span>Pricing Type</span><strong>{selectedService.pricingType || 'Fixed'}</strong></div>
              <div><span>Category</span><strong>{selectedService.category}</strong></div>
              <div><span>Duration</span><strong>{durationLabel(selectedService.durationMinutes)}</strong></div>
              <div><span>Labour Charge</span><strong>{money.format(selectedService.price || 0)}</strong></div>
              <div><span>Status</span><strong>{selectedService.status || 'active'}</strong></div>
            </div>

            <div className="service-description-box">
              {selectedService.description || 'No service description added yet.'}
            </div>
          </section>

          <section className="service-panel">
            <div className="service-section-header">
              <div>
                <h2>Technician Checklist</h2>
                
              </div>
            </div>

            <div className="service-checklist">
              {checklist.length ? checklist.map((item,index)=>(
                <div key={`${item}-${index}`}>
                  <span>{index+1}</span>
                  <strong>{item}</strong>
                </div>
              )) : <div className="service-empty">No checklist items configured.</div>}
            </div>
          </section>
        </div>
      </div>
        ) : isDelete && selectedService ? (
          <div className="service-workspace-delete">
            <div className="service-workspace-delete-icon"><Trash2 size={24}/></div>
            <h3>Delete “{selectedService.name}”?</h3>
            <p>This will remove the service from the catalog. Services used in job records may not be removable.</p>
            <div className="service-workspace-delete-actions">
              <button type="button" disabled={deleting} onClick={closeServiceModal}>Keep Service</button>
              <button type="button" disabled={deleting || !canDelete} className="is-danger"
                onClick={()=>void deleteService(selectedService)}>
                {deleting ? 'Deleting…' : 'Delete Service'}
              </button>
            </div>
          </div>
        ) : (
          <div className="service-workspace-loading" role="status">
            {actionError || (loading ? 'Loading service details…' : 'Service not found. Close this window and refresh the list.')}
          </div>
        )}
        {actionError && <div role="alert" className="service-form-error">{actionError}</div>}
      </ResponsiveModalSheet>

      <ResponsiveModalSheet
        isOpen={categoryDialogOpen}
        onClose={closeCategoryDialog}
        title={editingCategoryId ? 'Edit Category' : 'Add Category'}
        maxWidth="560px"
      >
        <form className="service-category-form" onSubmit={saveCategory}>
          {categoryError && <div className="service-form-error" role="alert">{categoryError}</div>}
          <Field label="Category Name">
            <input
              required
              maxLength={150}
              value={categoryForm.name}
              onChange={event=>setCategoryForm({...categoryForm,name:event.target.value})}
              placeholder="e.g. Engine Services"
            />
          </Field>
          <Field label="Parent Category">
            <select
              value={categoryForm.parentId}
              onChange={event=>setCategoryForm({...categoryForm,parentId:event.target.value})}
            >
              <option value="">Main Category (root)</option>
              {categoryTree.map(category => (
                <option key={category.id} value={category.id}>
                  {'— '.repeat(Math.min(category.depth || 0, 10)) + category.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Description">
            <textarea
              rows={3}
              value={categoryForm.description}
              onChange={event=>setCategoryForm({...categoryForm,description:event.target.value})}
              placeholder="Optional"
            />
          </Field>
          <Field label="Status">
            <select
              value={categoryForm.status}
              onChange={event=>setCategoryForm({...categoryForm,status:event.target.value})}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </Field>
          <div className="service-form-actions">
            <button type="button" onClick={closeCategoryDialog} disabled={categorySaving}>Cancel</button>
            <button type="submit" className="is-primary" disabled={categorySaving || !categoryForm.name.trim()}>
              {categorySaving ? 'Saving...' : editingCategoryId ? 'Save Changes' : 'Add Category'}
            </button>
          </div>
        </form>
      </ResponsiveModalSheet>
    </div>
  );
};

export default ServiceList;
