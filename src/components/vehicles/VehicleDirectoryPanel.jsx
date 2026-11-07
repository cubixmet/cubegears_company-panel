
import {
  Car,
  ChevronRight,
  ClipboardList,
  Edit3,
  User,
  Wrench,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';
import { getVehicleStatus } from './vehicles.utils';

export const VehicleDirectoryPanel = ({
  vehicles,
  onNavigate,
}) => {
  const { user } = useAuth();
  const canEdit = hasPermission(user, 'vehicles.edit');
  const canCreateJob = hasPermission(user, 'jobs.create');

  return (
    <section className="vehicle-dashboard-directory">
      <header className="vehicle-dashboard-section-title">
        <div>
          <h2>Vehicle Directory</h2>
        </div>
        <span>{vehicles.length} vehicle{vehicles.length === 1 ? '' : 's'}</span>
      </header>

      <div className="vehicle-table-wrap">
        <table className="vehicle-table">
          <thead>
            <tr>
              <th scope="col">Registration</th>
              <th scope="col">Make / Model</th>
              <th scope="col">Customer</th>
              <th scope="col">Last Service</th>
              <th scope="col">Next Service</th>
              <th scope="col">Open Job</th>
              <th scope="col">Status</th>
              <th scope="col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {vehicles.map((vehicle) => {
              const status = getVehicleStatus(vehicle);
              const lastService = vehicle.lastServiceDate || '—';

              return (
                <tr
                  key={vehicle.id}
                  onClick={() => onNavigate(`/vehicles/${vehicle.id}`)}
                  onKeyDown={(event) => {
                    if (event.target === event.currentTarget && event.key === 'Enter') {
                      onNavigate(`/vehicles/${vehicle.id}`);
                    }
                  }}
                  tabIndex={0}
                  aria-label={`Open vehicle ${vehicle.registration || 'profile'}`}
                >
                  <td><strong>{vehicle.registration || 'No Registration'}</strong></td>
                  <td><strong>{vehicle.make} {vehicle.model}</strong>{vehicle.variant && <span>{vehicle.variant}</span>}</td>
                  <td>
                    <strong>{vehicle.customerName}</strong>
                    <span>{vehicle.customerPhone || '—'}</span>
                  </td>
                  <td>{lastService}</td>
                  <td>{vehicle.nextServiceDue || '—'}</td>
                  <td>
                    {vehicle.openJob ? (
                      <button
                        type="button"
                        className="vehicle-table-job"
                        onClick={(event) => {
                          event.stopPropagation();
                          onNavigate(`/jobs/${vehicle.openJob.id}/overview`);
                        }}
                      >
                        <Wrench size={12} />
                        <span>{vehicle.openJob.jobNumber || vehicle.openJob.id}</span>
                      </button>
                    ) : (
                      <span className="vehicle-table-empty">No active job</span>
                    )}
                  </td>
                  <td>
                    <span className={`vehicle-status is-${status.tone}`}>
                      {status.label}
                    </span>
                  </td>
                  <td className="vehicle-directory-actions">
                    <button type="button" aria-label={`View ${vehicle.registration || 'vehicle'}`}
                      onClick={(event) => { event.stopPropagation(); onNavigate(`/vehicles/${vehicle.id}`); }}>
                      View <ChevronRight size={14} aria-hidden="true"/>
                    </button>
                    {canCreateJob && String(vehicle.status || '').toLowerCase() !== 'archived' && String(vehicle.customerStatus || '').toLowerCase() !== 'archived' && <button type="button"
                      aria-label={`New Job Card for ${vehicle.registration || 'vehicle'}`}
                      onClick={(event) => { event.stopPropagation(); onNavigate(`/jobs/new?customerId=${vehicle.customerId || ''}&vehicle=${encodeURIComponent(vehicle.registration || '')}`); }}>
                      New Job
                    </button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="vehicle-mobile-grid">
        {vehicles.map((vehicle) => {
          const status = getVehicleStatus(vehicle);
          const lastService = vehicle.lastServiceDate || '—';
          return (
            <article key={vehicle.id} className="vehicle-mobile-card">
              <div className="vehicle-mobile-card-head">
                <div>
                  <strong>{vehicle.registration || 'No Registration'}</strong>
                  <span>{vehicle.make} {vehicle.model}</span>
                </div>
                <span className={`vehicle-status is-${status.tone}`}>
                  {status.label}
                </span>
              </div>

              <div className="vehicle-owner-row">
                <User size={14} />
                <div>
                  <strong>{vehicle.customerName}</strong>
                  <span>{vehicle.customerPhone || 'No owner contact'}</span>
                </div>
              </div>

              <div className="vehicle-mobile-meta">
                <div><span>Last Service</span><strong>{lastService}</strong></div>
                <div><span>Next Service</span><strong>{vehicle.nextServiceDue || 'Not set'}</strong></div>

              </div>

              {vehicle.openJob && (
                <button
                  type="button"
                  className="vehicle-open-job"
                  onClick={() => onNavigate(`/jobs/${vehicle.openJob.id}/overview`)}
                >
                  <ClipboardList size={13} />
                  <span>{vehicle.openJob.jobNumber || vehicle.openJob.id}</span>
                  <b>{vehicle.openJob.status}</b>
                  <ChevronRight size={13} />
                </button>
              )}

              <div className="vehicle-card-actions">
                <button type="button" onClick={() => onNavigate(`/vehicles/${vehicle.id}`)}>
                  <Car size={13} /> View
                </button>

                {canEdit && (
                  <button type="button" onClick={() => onNavigate(`/vehicles/${vehicle.id}/edit`)}>
                    <Edit3 size={13} /> Edit
                  </button>
                )}

                {canCreateJob && String(vehicle.status || '').toLowerCase() !== 'archived' && String(vehicle.customerStatus || '').toLowerCase() !== 'archived' && (
                  <button
                    type="button"
                    className="is-primary"
                    onClick={() => onNavigate(
                      `/jobs/new?customerId=${vehicle.customerId || ''}&vehicle=${encodeURIComponent(vehicle.registration || '')}`
                    )}
                  >
                    <ClipboardList size={13} /> New Job
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!vehicles.length && (
        <div className="vehicle-dashboard-empty">No vehicles found.</div>
      )}
    </section>
  );
};
