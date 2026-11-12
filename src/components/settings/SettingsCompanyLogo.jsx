import { useEffect, useRef, useState } from 'react';
import { ImagePlus, UploadCloud } from 'lucide-react';
import { settingsService } from '../../services/settings.service';

const SUPPORTED_IMAGES = new Set(['image/png', 'image/jpeg', 'image/webp']);

export const SettingsCompanyLogo = ({ canManage = false }) => {
  const inputRef = useRef(null);
  const objectUrlRef = useRef('');
  const mountedRef = useRef(false);
  const requestVersionRef = useRef(0);
  const [preview, setPreview] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const showImage = (blob) => {
    if (!mountedRef.current || !blob || typeof blob.type !== 'string' ||
        !blob.type.startsWith('image/')) return;
    const url = URL.createObjectURL(blob);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = url;
    setPreview(url);
  };

  useEffect(() => {
    mountedRef.current = true;
    const request = ++requestVersionRef.current;
    settingsService.getCompanyLogo()
      .then((blob) => {
        if (mountedRef.current && requestVersionRef.current === request) showImage(blob);
      })
      .catch((cause) => {
        if (mountedRef.current && requestVersionRef.current === request &&
            cause?.status !== 404) {
          setError('Unable to load company logo. You can still try uploading a new one.');
        }
      })
      .finally(() => {
        if (mountedRef.current && requestVersionRef.current === request) setLoading(false);
      });

    return () => {
      mountedRef.current = false;
      requestVersionRef.current += 1;
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    };
  }, []);

  const upload = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || uploading || !canManage) return;
    setMessage('');
    setError('');
    if (!SUPPORTED_IMAGES.has(file.type)) {
      setError('Choose a PNG, JPG or WebP image.');
      return;
    }
    const request = ++requestVersionRef.current;
    setUploading(true);
    try {
      await settingsService.uploadCompanyLogo(file);
      if (!mountedRef.current || requestVersionRef.current !== request) return;
      // The PATCH has persisted the real file. Refresh the private image
      // preview; if serving has not yet been deployed, show the selected image.
      try {
        const savedImage = await settingsService.getCompanyLogo();
        if (!mountedRef.current || requestVersionRef.current !== request) return;
        if (savedImage?.type?.startsWith('image/')) showImage(savedImage);
        else showImage(file);
      } catch {
        if (mountedRef.current && requestVersionRef.current === request) showImage(file);
      }
      if (mountedRef.current && requestVersionRef.current === request) {
        setMessage('Company logo uploaded successfully.');
        // Refresh the authenticated workshop logo in the mobile header.
        window.dispatchEvent(new Event('cubixgear:company-logo-updated'));
      }
    } catch (cause) {
      if (mountedRef.current && requestVersionRef.current === request) {
        setError(cause?.message || 'Logo upload failed. Please try again.');
      }
    } finally {
      if (mountedRef.current && requestVersionRef.current === request) setUploading(false);
    }
  };

  return (
    <section className="settings-logo-panel" aria-label="Workshop company logo">
      <div className="settings-logo-preview" aria-label="Current company logo">
        {preview
          ? <img src={preview} alt="Current company logo" />
          : <ImagePlus size={30} aria-hidden="true" />}
      </div>
      <div className="settings-logo-description">
        <strong>Company Logo</strong>
        <p>{loading ? 'Loading saved logo…' : 'Upload your workshop logo. PNG, JPG or WebP images are supported.'}</p>
        <small>No additional file-size restriction in this form. Hosting and storage limits still apply.</small>
        {canManage && (
          <>
            <input
              ref={inputRef}
              id="settings-company-logo-upload"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              aria-label="Select company logo image"
              disabled={uploading || loading}
              onChange={upload}
              className="settings-logo-file-input"
            />
            <button
              className="settings-secondary-button settings-logo-upload-button"
              type="button"
              disabled={uploading || loading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadCloud size={16} aria-hidden="true" />
              {uploading ? 'Uploading…' : preview ? 'Replace Logo' : 'Upload Logo'}
            </button>
          </>
        )}
        {!canManage && <small>Only a company administrator can change the logo.</small>}
        {message && <span role="status" className="settings-logo-status is-success">{message}</span>}
        {error && <span role="alert" className="settings-logo-status is-error">{error}</span>}
      </div>
    </section>
  );
};
