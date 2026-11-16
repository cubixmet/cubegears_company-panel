import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Trash2, UploadCloud, X, Expand } from 'lucide-react';
import { LiveVehicleCamera } from './LiveVehicleCamera';
import '../../styles/vehicle-camera-queue.css';

function QueuedPhoto({ item, onRemove, disabled, uploadingPhotoId }) {
  const [url, setUrl] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);
  const previewButtonRef = useRef(null);
  const closeButtonRef = useRef(null);
  useEffect(() => {
    const objectUrl = URL.createObjectURL(item.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [item.file]);

  useEffect(() => {
    if (!previewOpen) return undefined;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();
    const handleKey = (event) => {
      if (event.key === 'Escape') setPreviewOpen(false);
      // The lightbox has one focusable close control, so prevent tabbing
      // behind it while open.
      if (event.key === 'Tab') {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = originalOverflow;
      previewButtonRef.current?.focus();
    };
  }, [previewOpen]);

  const isUploading = uploadingPhotoId === item.id;
  const status = isUploading ? 'Uploading…' : 'Ready to upload';
  const category = item.category || 'Additional';
  const phase = item.phase === 'after' ? 'After Service'
    : item.phase === 'progress' ? 'In Progress' : 'Before Service';
  const description = item.caption || item.notes || 'No photo notes';
  return (
    <figure className="vehicle-camera-queued">
      <div className="vehicle-camera-thumbnail">
        {url && <button type="button" ref={previewButtonRef}
          className="vehicle-camera-preview-button"
          onClick={() => setPreviewOpen(true)}
          aria-label={'Preview ' + category + ' vehicle photo'}>
          <img src={url} alt={item.caption || category + ' vehicle photo'} loading="lazy"/>
          <span className="vehicle-camera-zoom"><Expand size={15} aria-hidden="true"/> Preview</span>
        </button>}
      </div>
      <figcaption>
        <strong>{category} · {phase}</strong>
        <small title={description}>{description}</small>
        <span className={isUploading ? 'vehicle-camera-upload-status is-uploading' : 'vehicle-camera-upload-status'} role="status">{status}</span>
      </figcaption>
      <button type="button" className="vehicle-camera-remove-photo" onClick={() => onRemove(item.id)}
        disabled={disabled} aria-label={'Remove ' + category + ' vehicle photo'} title="Remove photo">
        <Trash2 size={17} aria-hidden="true"/>
      </button>
      {previewOpen && url && createPortal(
        <div className="vehicle-camera-lightbox" role="dialog" aria-modal="true"
          aria-label="Vehicle photo preview"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setPreviewOpen(false); }}>
          <div className="vehicle-camera-lightbox-content">
            <button type="button" ref={closeButtonRef}
              className="vehicle-camera-lightbox-close"
              onClick={() => setPreviewOpen(false)} aria-label="Close photo preview"><X size={20}/></button>
            <img className="vehicle-camera-preview-image" src={url}
              alt={item.caption || category + ' vehicle photo (full-size preview)'}/>
            <div className="vehicle-camera-lightbox-caption">
              <strong>{category} · {phase}</strong><span>{description}</span>
            </div>
          </div>
        </div>, document.body
      )}
    </figure>
  );
}

export function VehicleCameraQueue({ photos = [], onChange, disabled = false, uploading = 0, uploadTotal = 0, uploadingPhotoId = null, hideDescription = false, hideHeading = false }) {
  const [category, setCategory] = useState('additional');
  const [phase, setPhase] = useState('before');
  const [caption, setCaption] = useState('');
  const [uploadError, setUploadError] = useState('');

  const addUploads = (event) => {
    const picked = Array.from(event.target.files || []);
    setUploadError('');
    const accepted = picked.filter((file) =>
      ['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
      && file.size > 0 && file.size <= 10 * 1024 * 1024
    );
    if (accepted.length !== picked.length) {
      setUploadError('Select JPEG, PNG or WebP images smaller than 10 MB each. Unsupported photos were skipped.');
    }
    if (accepted.length) {
      onChange((current) => [...current, ...accepted.map((file) => ({
        id: 'upload-' + Date.now() + '-' + Math.random().toString(36).slice(2),
        file, category, phase, caption: caption.trim(), notes: caption.trim(),
      }))]);
    }
    event.target.value = '';
  };
  const add = ({ file, ...metadata }) => {
    onChange((current) => [...current, {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file, ...metadata,
    }]);
  };
  const remove = (id) => onChange((current) => current.filter((item) => item.id !== id));
  return (
    <section className="vehicle-camera-queue" aria-label="Vehicle camera photos">
      <div className={`vehicle-camera-heading${hideHeading ? ' is-heading-hidden' : ''}`}>
        {!hideHeading && <div><h3><Camera size={18}/> Vehicle Inspection Photos</h3>
          {!hideDescription && <p>Capture photos using the mobile camera. All uploads stay private until published.</p>}</div>}
        <div className="vehicle-photo-add-actions">
          <LiveVehicleCamera onCapture={add} disabled={disabled} count={photos.length}/>
          <label className="vehicle-gallery-upload-label">
            <UploadCloud size={17} aria-hidden="true"/> Upload Photos
            <input type="file" accept="image/*" multiple disabled={disabled}
              onChange={addUploads} aria-label="Upload vehicle photos from gallery"/>
          </label>
        </div>
      </div>
      <div className="vehicle-gallery-upload-metadata">
        <label>Upload Photo Category
          <select value={category} disabled={disabled} onChange={(event) => setCategory(event.target.value)}>
            <option value="front">Front View</option><option value="rear">Rear View</option>
            <option value="left">Left Side</option><option value="right">Right Side</option>
            <option value="interior">Interior</option><option value="dashboard">Dashboard</option>
            <option value="engine">Engine</option><option value="damage">Damage</option>
            <option value="additional">Other</option>
          </select>
        </label>
        <label>Service Phase
          <select value={phase} disabled={disabled} onChange={(event) => setPhase(event.target.value)}>
            <option value="before">Before Service</option><option value="progress">In Progress</option>
            <option value="after">After Service</option>
          </select>
        </label>
        <label>Photo Notes
          <input value={caption} disabled={disabled} maxLength={255}
            onChange={(event) => setCaption(event.target.value)} placeholder="Optional notes for gallery photos"/>
        </label>
      </div>
      {uploadError && <p className="vehicle-photo-gallery-error" role="alert">{uploadError}</p>}
      <div className="vehicle-camera-counter" role="status">{photos.length} photo{photos.length === 1 ? '' : 's'} ready to attach to this Job Card</div>
      {photos.length ? (
        <div className="vehicle-camera-queue-grid">
          {photos.map((item) => <QueuedPhoto key={item.id} item={item} onRemove={remove} disabled={disabled} uploadingPhotoId={uploadingPhotoId} />)}
        </div>
      ) : <p className="vehicle-camera-empty">No photos captured yet. Photos are optional.</p>}
      {uploading > 0 && <p role="status">Saving photo {uploading} of {uploadTotal || photos.length}…</p>}
    </section>
  );
}
