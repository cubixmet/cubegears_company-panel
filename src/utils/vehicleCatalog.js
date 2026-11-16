/** Make/model selector data. The Django catalog is authoritative in real API
 * mode; these starter choices also keep the form usable in mock/offline mode.
 */
export const STARTER_VEHICLE_CATALOG = [
  { make: 'Toyota', models: ['Innova', 'Innova Crysta', 'Innova Hycross', 'Fortuner', 'Etios', 'Glanza', 'Camry'] },
  { make: 'Maruti Suzuki', models: ['Alto', 'Swift', 'Dzire', 'Baleno', 'Brezza', 'Ertiga', 'Wagon R', 'Fronx', 'Grand Vitara'] },
  { make: 'Hyundai', models: ['Grand i10 Nios', 'i20', 'Creta', 'Venue', 'Verna', 'Aura', 'Exter'] },
  { make: 'Tata', models: ['Tiago', 'Altroz', 'Punch', 'Nexon', 'Harrier', 'Safari'] },
  { make: 'Mahindra', models: ['Bolero', 'Scorpio', 'Scorpio N', 'XUV3XO', 'XUV700', 'Thar'] },
  { make: 'Honda', models: ['City', 'Amaze', 'Jazz', 'Elevate'] },
  { make: 'Kia', models: ['Seltos', 'Sonet', 'Carens', 'Syros'] },
  { make: 'Renault', models: ['Kwid', 'Triber', 'Kiger', 'Duster'] },
  { make: 'Nissan', models: ['Magnite', 'Micra', 'Kicks'] },
  { make: 'Volkswagen', models: ['Polo', 'Vento', 'Virtus', 'Taigun'] },
  { make: 'Skoda', models: ['Rapid', 'Kushaq', 'Slavia'] },
  { make: 'Ford', models: ['Figo', 'EcoSport', 'Endeavour'] },
  { make: 'MG', models: ['Hector', 'Astor', 'Comet EV', 'ZS EV'] },
  { make: 'BMW', models: ['3 Series', '5 Series', 'X1', 'X3'] },
  { make: 'Mercedes-Benz', models: ['C-Class', 'E-Class', 'GLA', 'GLC'] },
  { make: 'Royal Enfield', models: ['Classic 350', 'Bullet 350', 'Hunter 350', 'Himalayan'] },
  { make: 'Yamaha', models: ['FZ-S', 'R15', 'MT-15', 'Fascino'] },
  { make: 'Bajaj', models: ['Pulsar', 'Dominar', 'Platina', 'Avenger'] },
  { make: 'TVS', models: ['Apache RTR', 'Jupiter', 'Ntorq', 'Raider'] },
  { make: 'Hero', models: ['Splendor Plus', 'Passion', 'HF Deluxe', 'Xpulse'] },
];

export const cleanVehicleCatalogName = (value) =>
  String(value ?? '').trim().replace(/\s+/g, ' ');

export const mergeVehicleCatalog = (...catalogs) => {
  const rows = new Map();
  for (const group of catalogs) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      const name = cleanVehicleCatalogName(entry?.make);
      if (!name) continue;
      const key = name.toLocaleLowerCase();
      if (!rows.has(key)) rows.set(key, { make: name, models: new Map() });
      const row = rows.get(key);
      for (const candidate of Array.isArray(entry?.models) ? entry.models : []) {
        const model = cleanVehicleCatalogName(candidate);
        if (model) row.models.set(model.toLocaleLowerCase(), row.models.get(model.toLocaleLowerCase()) || model);
      }
    }
  }
  return [...rows.values()]
    .sort((a, b) => a.make.localeCompare(b.make))
    .map((row) => ({
      make: row.make,
      models: [...row.models.values()].sort((a, b) => a.localeCompare(b)),
    }));
};
