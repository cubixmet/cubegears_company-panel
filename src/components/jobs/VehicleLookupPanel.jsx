
import { Car, History, WalletCards, Wrench } from 'lucide-react';
import { jobMoney } from './jobs.utils';

const LookupStat = ({ icon: Icon, label, value }) => (
  <div className="jobs-lookup-stat">
    <span><Icon size={13} />{label}</span>
    <strong>{value}</strong>
  </div>
);

export const VehicleLookupPanel = ({ lookup, onOpenCurrentJob, canViewTotals = false }) => {
  if (!lookup) return null;

  return (
    <section className="jobs-vehicle-lookup">
      <div className="jobs-vehicle-lookup-head">
        <div>
          <span className="jobs-vehicle-reg"><Car size={14} />{lookup.registration}</span>
          <h2>{lookup.latest.customerName || 'Customer'} · {lookup.latest.vehicleInfo || 'Vehicle'}</h2>
          <p>{lookup.latest.customerPhone || 'No phone number'}</p>
        </div>

        {lookup.currentOpen && (
          <button type="button" className="jobs-primary-button" onClick={onOpenCurrentJob}>
            Open Current Job
          </button>
        )}
      </div>

      <div className="jobs-vehicle-stats">
        <LookupStat icon={History} label="Recorded Visits" value={lookup.sameVehicle.length} />
        <LookupStat icon={Wrench} label="Last Status" value={lookup.latest.status} />
        {canViewTotals && <LookupStat icon={WalletCards} label="Recorded Job Totals" value={jobMoney.format(lookup.spending)} />}
        <LookupStat icon={Car} label="Last Service" value={lookup.latest.createdDate || '—'} />
      </div>

      <div className="jobs-parts-history">
        <span>Last Replaced / Used Parts</span>
        <strong>
          {lookup.lastParts.length
            ? lookup.lastParts.join(' · ')
            : 'No parts history found'}
        </strong>
      </div>
    </section>
  );
};
