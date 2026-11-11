
import { Edit3, Eye, Tag, Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

const statusClass=(status='')=>String(status).toLowerCase()==='active'?'is-active':'is-inactive';

export const ServiceCatalogGrid = ({ services, formatMoney, durationLabel, onView, onEdit, onDelete, hasFilters = false, onReset }) => {
  const { user } = useAuth();
  const canEdit=hasPermission(user,'services.edit');
  const canDelete=hasPermission(user,'services.delete');

  if(!services.length) return (
    <div className="service-empty cg-service-empty" role="status">
      <strong>{hasFilters ? 'No matching services' : 'No services yet'}</strong>
      <p>{hasFilters ? 'Try another service name, category or status.' : 'Add your first workshop service to start the catalog.'}</p>
      {hasFilters && <button type="button" onClick={onReset}>Clear filters</button>}
    </div>
  );

  return (
    <div className="service-card-grid">
      {services.map(service=>(
        <article
          key={service.id}
          className="service-catalog-card"
        >
          <div className="service-catalog-card__head">
            <div><span>{service.code}</span>
              <button type="button" className="service-catalog-card__title" onClick={()=>onView(service)}
                aria-label={'View service ' + service.name}>{service.name}</button>
            </div>
            <b className={'service-status '+statusClass(service.status)}>{service.status||'active'}</b>
          </div>
          <div className="service-category-chip"><Tag size={14} aria-hidden="true"/>{service.category || 'Uncategorized'}</div>
          <div className="service-card-values">
            <div><span>Labour Charge</span><strong>{formatMoney(service.price||0)}</strong></div>
            <div><span>Duration</span><strong>{durationLabel(service.durationMinutes)}</strong></div>
            <div><span>Pricing</span><strong>{service.pricingType||'Fixed'}</strong></div>
          </div>
          <p>{service.description||'No description added. Open the service for pricing and checklist details.'}</p>
          <div className="service-card-actions">
            <button onClick={e=>{e.stopPropagation();onView(service);}}><Eye size={13}/> View</button>
            {canEdit&&<button onClick={e=>{e.stopPropagation();onEdit(service);}}><Edit3 size={13}/> Edit</button>}
            {canDelete&&<button className="is-danger" onClick={e=>{e.stopPropagation();onDelete(service);}}><Trash2 size={13}/> Delete</button>}
          </div>
        </article>
      ))}
    </div>
  );
};