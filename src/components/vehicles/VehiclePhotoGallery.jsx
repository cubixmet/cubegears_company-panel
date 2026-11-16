import { useCallback, useEffect, useState } from 'react';
import { Camera, RefreshCw, UploadCloud, Eye, EyeOff } from 'lucide-react';
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
      <span className={'vehicle-photo-visibility-badge ' + (photo.published ? 'is-published' : 'is-private')}>
        {photo.published ? <Eye size={13} aria-hidden="true"/> : <EyeOff size={13} aria-hidden="true"/>}
        {photo.published ? 'Published to Customer' : 'Private'}
      </span>
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
          onChange={updateVisibility} aria-label={photo.published
            ? 'Unpublish photo from customer portal' : 'Publish photo to customer portal'}/>
        {saving ? 'Updating visibility…' : photo.published
          ? 'Published to Customer' : 'Publish to Customer'}
      </label>}
      {error && <p className="vehicle-photo-gallery-error" role="alert">{error}</p>}
    </figure>
  );
}

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const MAX_BATCH_SIZE = 8;

export function VehiclePhotoGallery({ vehicleId, jobId, canEdit = false, canPublish = canEdit, refreshKey = 0 }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [category, setCategory] = useState('additional');
  const [phase, setPhase] = useState('before');
  const [caption, setCaption] = useState('');
  // The workshop has opted to publish new vehicle photos by default.
  // Server-side permission checks still gate every published upload.
  // Existing private photos are never published without a separate staff action.
  const [publishNewPhotos, setPublishNewPhotos] = useState(Boolean(canPublish));
  const [visibilityFilter, setVisibilityFilter] = useState('all');
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
      const saved = await vehiclePhotoService.upload({
        vehicleId, jobId, file, ...metadata,
        published: Boolean(canPublish && publishNewPhotos),
      });
      setPhotos((current) => [saved, ...current]);
    } catch (cause) {
      setError(cause?.message || 'Unable to upload photo. Retake and retry.');
    } finally {
      setUploading(false);
    }
  };

  const uploadFromDevice = async (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length || uploading || !canEdit) return;

    setError('');
    if (files.length > MAX_BATCH_SIZE) {
      setError('Select up to 8 photos at a time.');
      return;
    }
    if (files.some(file => !ACCEPTED_TYPES.has(file.type) || file.size < 1 || file.size > MAX_FILE_SIZE)) {
      setError('Use JPEG, PNG or WebP images smaller than 10 MB each.');
      return;
    }
    setUploading(true);
    let completed = 0;
    try {
      for (const file of files) {
        setUploadProgress(`Uploading ${completed + 1} of ${files.length}…`);
        const saved = await vehiclePhotoService.upload({
          vehicleId, jobId, file, category, phase,
          caption: caption.trim().slice(0, 255),
          published: Boolean(canPublish && publishNewPhotos),
        });
        setPhotos(current => [saved, ...current.filter(photo => photo.id !== saved.id)]);
        completed += 1;
      }
      setCaption('');
      setUploadProgress(`${completed} photo${completed === 1 ? '' : 's'} ${canPublish && publishNewPhotos ? 'published to customer' : 'saved privately'}.`);
    } catch (cause) {
      setError(`${completed} of ${files.length} uploaded. ${cause?.message || 'Could not upload remaining photos.'}`);
      setUploadProgress('');
    } finally {
      setUploading(false);
    }
  };

  const changeVisibility = async (id, published) => {
    const changed = await vehiclePhotoService.setPublished(id, published);
    setPhotos((current) => current.map((photo) => photo.id === id ? changed : photo));
  };

  const publishedCount = photos.filter(photo => photo.published === true).length;
  const privateCount = photos.length - publishedCount;
  const visiblePhotos = visibilityFilter === 'published'
    ? photos.filter(photo => photo.published === true)
    : visibilityFilter === 'private'
      ? photos.filter(photo => photo.published !== true)
      : photos;

  return (
    <section className="vehicle-photo-gallery" aria-label="Vehicle inspection photos">
      <div className="vehicle-camera-heading">
        <div><h3><Camera size={18}/> Vehicle Photo Gallery</h3>
          <p>{canPublish
            ? 'New photos are published to this customer’s secure portal by default. Turn publishing off before uploading to save them privately.'
            : 'Only authorized workshop staff can publish photos to the customer portal.'}</p></div>
        {canEdit && <div className="vehicle-photo-add-actions">
          <LiveVehicleCamera onCapture={capture} disabled={uploading} count={photos.length}/>
          <label className="vehicle-gallery-upload-label">
            <UploadCloud size={17} aria-hidden="true"/> Upload Photos
            <input type="file" accept="image/jpeg,image/png,image/webp" multiple
              onChange={uploadFromDevice} disabled={uploading}
              aria-label="Upload workshop vehicle photos"/>
          </label>
        </div>}
      </div>
      {canEdit && <div className="vehicle-gallery-upload-metadata" aria-label="Photo upload details">
        <label>Photo Category
          <select value={category} onChange={event => setCategory(event.target.value)} disabled={uploading}>
            <option value="additional">Additional Photo</option>
            <option value="front">Front View</option><option value="rear">Rear View</option>
            <option value="left">Left Side</option><option value="right">Right Side</option>
            <option value="interior">Interior</option><option value="dashboard">Dashboard</option>
            <option value="engine">Engine</option><option value="odometer">Odometer</option>
            <option value="damage">Existing Damage</option>
          </select>
        </label>
        <label>Service Phase
          <select value={phase} onChange={event => setPhase(event.target.value)} disabled={uploading}>
            <option value="before">Before Service</option>
            <option value="progress">Work in Progress</option>
            <option value="after">After Service</option>
          </select>
        </label>
        <label>Caption (optional)
          <input value={caption} maxLength={255} disabled={uploading}
            onChange={event => setCaption(event.target.value)}
            placeholder="Describe vehicle photo"/>
        </label>
        {canPublish && <label className="vehicle-photo-upload-publish">
          <input type="checkbox" checked={publishNewPhotos} disabled={uploading}
            onChange={event => setPublishNewPhotos(event.target.checked)}/>
          <span>{publishNewPhotos ? 'Published to Customer' : 'Save privately'}</span>
        </label>}
      </div>}
      {uploadProgress && <p className="vehicle-photo-gallery-progress" role="status">{uploadProgress}</p>}
      {uploading && !uploadProgress && <p role="status">Uploading captured photo…</p>}
      {error && <div role="alert" className="vehicle-photo-gallery-error">
        {error} <button type="button" onClick={load}>Retry loading</button>
      </div>}
      <div className="vehicle-photo-gallery-toolbar">
        <div className="vehicle-photo-share-counts" aria-label="Photo publishing summary">
          <span><strong>{photos.length}</strong> Photos</span>
          <span className="is-published"><Eye size={14} aria-hidden="true"/> {publishedCount} Published to Customer</span>
          <span><EyeOff size={14} aria-hidden="true"/> {privateCount} Private</span>
        </div>
        <div className="vehicle-photo-gallery-toolbar-actions">
          <label htmlFor="vehicle-photo-visibility-filter">Show</label>
          <select id="vehicle-photo-visibility-filter" value={visibilityFilter}
            onChange={event => setVisibilityFilter(event.target.value)}>
            <option value="all">All Photos</option>
            <option value="published">Published to Customer</option>
            <option value="private">Private Photos</option>
          </select>
          <button type="button" onClick={load} disabled={loading}>
            <RefreshCw size={16} aria-hidden="true"/> Refresh
          </button>
        </div>
      </div>
      {loading ? <p role="status">Loading vehicle photos…</p> : visiblePhotos.length ? (
        <div className="vehicle-photo-gallery-grid">
          {visiblePhotos.map((photo) => (
            <PrivateVehiclePhoto key={photo.id} photo={photo} canEdit={canPublish}
              onVisibility={changeVisibility}/>
          ))}
        </div>
      ) : <p className="vehicle-camera-empty">
        {photos.length ? 'No photos match this filter.' : 'No vehicle photos captured yet.'}
      </p>}
    </section>
  );
}
