import { useCallback, useEffect, useState } from 'react';
import { Camera, RefreshCw } from 'lucide-react';
import { vehiclePhotoService } from '../../services/vehiclePhoto.service';
import { LiveVehicleCamera } from './LiveVehicleCamera';
import '../../styles/vehicle-camera-queue.css';

function PrivateVehiclePhoto({ photo, canEdit, onVisibility }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    let imageUrl = '';
    setError('');
    setUrl('');
    vehiclePhotoService.file(photo.id).then((blob) => {
      if (!active) return;
      imageUrl = URL.createObjectURL(blob);
      setUrl(imageUrl);
    }).catch(() => { if (active) setError('Photo unavailable'); });
    return () => {
      active = false;
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [photo.id]);

  const updateVisibility = async (event) => {
    setSaving(true);
    setError('');
    try {
      await onVisibility(photo.id, event.target.checked);
    } catch (cause) {
      setError(cause?.message || 'Could not change customer visibility.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <figure className="vehicle-photo-card">
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" aria-label="Open vehicle photo">
        <img src={url} alt={photo.caption || photo.category} loading="lazy" />
      </a> : <p role="status">{error || 'Loading photo…'}</p>}
      <figcaption>
        <strong>{photo.category} · {photo.phase}</strong>
        <small>{photo.caption || 'Inspection photo'}</small>
        <small>{photo.capturedAt ? new Date(photo.capturedAt).toLocaleString() : ''}</small>
      </figcaption>
      {canEdit && <label className="vehicle-photo-visibility">
        <input type="checkbox" checked={Boolean(photo.published)} disabled={saving}
          onChange={updateVisibility}/>
        {photo.published ? 'Published to customer' : 'Private — publish photo'}
      </label>}
      {error && <p className="vehicle-photo-gallery-error" role="alert">{error}</p>}
    </figure>
  );
}

export function VehiclePhotoGallery({ vehicleId, jobId, canEdit = false, refreshKey = 0 }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!vehicleId && !jobId) return;
    setLoading(true);
    setError('');
    try {
      const result = jobId
        ? await vehiclePhotoService.listForJob(jobId)
        : await vehiclePhotoService.listForVehicle(vehicleId);
      setPhotos(Array.isArray(result) ? result : result?.results || []);
    } catch (cause) {
      setError(cause?.message || 'Unable to load inspection photos.');
    } finally {
      setLoading(false);
    }
  }, [vehicleId, jobId, refreshKey]);

  useEffect(() => { load(); }, [load]);

  const capture = async ({ file, ...metadata }) => {
    setUploading(true);
    setError('');
    try {
      const saved = await vehiclePhotoService.upload({ vehicleId, jobId, file, ...metadata });
      setPhotos((current) => [saved, ...current]);
    } catch (cause) {
      setError(cause?.message || 'Unable to upload photo. Retake and retry.');
    } finally {
      setUploading(false);
    }
  };

  const changeVisibility = async (id, published) => {
    const changed = await vehiclePhotoService.setPublished(id, published);
    setPhotos((current) => current.map((photo) => photo.id === id ? changed : photo));
  };

  return (
    <section className="vehicle-photo-gallery" aria-label="Vehicle inspection photos">
      <div className="vehicle-camera-heading">
        <div><h3><Camera size={18}/> Vehicle Photo Gallery</h3></div>
        {canEdit && <LiveVehicleCamera onCapture={capture} disabled={uploading} />}
      </div>
      {uploading && <p role="status">Uploading captured photo…</p>}
      {error && <div role="alert" className="vehicle-photo-gallery-error">
        {error} <button type="button" onClick={load}>Retry loading</button>
      </div>}
      <div className="vehicle-photo-gallery-toolbar">
        <span>{photos.length} photos</span>
        <button type="button" onClick={load} disabled={loading}><RefreshCw size={16} aria-hidden="true"/> Refresh</button>
      </div>
      {loading ? <p role="status">Loading private photos…</p> : photos.length ? (
        <div className="vehicle-photo-gallery-grid">
          {photos.map((photo) => (
            <PrivateVehiclePhoto key={photo.id} photo={photo} canEdit={canEdit}
              onVisibility={changeVisibility}/>
          ))}
        </div>
      ) : <p className="vehicle-camera-empty">No inspection photos captured yet.</p>}
    </section>
  );
}
