
import { Plus } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { hasPermission } from '../../utils/permissions';

export const VehiclesHeader = ({ onAddVehicle }) => {
  const { user } = useAuth();

  return (
    <header className="vehicle-dashboard-header">
      <div className="cg-vehicle-heading">
        <span className="cg-vehicle-eyebrow">WORKSHOP DIRECTORY</span>
        <h1>Vehicles</h1>
        <p>Vehicle records, owners and service updates.</p>
      </div>

      <div className="vehicle-dashboard-header-actions">
        {hasPermission(user, 'vehicles.create') && (
          <button type="button" className="vehicle-primary-button" onClick={onAddVehicle}>
            <Plus size={17} aria-hidden="true"/>
            Add Vehicle
          </button>
        )}
      </div>
    </header>
  );
};
