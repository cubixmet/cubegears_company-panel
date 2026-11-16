import { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, CameraOff, Check, RefreshCw, SwitchCamera, X } from 'lucide-react';
import { createPortal } from 'react-dom';
import '../../styles/live-vehicle-camera.css';

export const VEHICLE_PHOTO_CATEGORIES = [
  ['front', 'Front View'], ['rear', 'Rear View'], ['left', 'Left Side'],
  ['right', 'Right Side'], ['interior', 'Interior'], ['dashboard', 'Dashboard'],
  ['engine', 'Engine Bay'], ['odometer', 'Odometer'],
  ['damage', 'Existing Damage'], ['additional', 'Additional'],
];

export function LiveVehicleCamera({ onCapture, disabled = false, count = 0 }) {
  const videoRef = useRef(null);
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const streamRef = useRef(null);
  // Generation counter invalidates late getUserMedia() promises after close/switch.
  const cameraGeneration = useRef(0);
  const previewRef = useRef('');
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [facing, setFacing] = useState('environment');
  const [cameras, setCameras] = useState([]);
  const [preview, setPreview] = useState('');
  const [file, setFile] = useState(null);
  const [category, setCategory] = useState('front');
  const [phase, setPhase] = useState('before');
  const [caption, setCaption] = useState('');

  const stopStream = useCallback(() => {
    cameraGeneration.current += 1;
    const stream = streamRef.current;
    streamRef.current = null;
    stream?.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const clearPreview = () => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
    setFile(null);
  };

  const close = useCallback(() => {
    stopStream();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = '';
    setPreview('');
    setFile(null);
    setOpen(false);
    setError('');
  }, [stopStream]);

  useEffect(() => {
    if (!open) return undefined;

    // The dialog is portaled to body so it cannot be clipped by Job Card panels.
    // Inert the application beneath it while preserving the existing camera state.
    const previouslyFocused = document.activeElement;
    const appRoot = document.getElementById('root');
    const wasInert = appRoot?.inert;
    const previousOverflow = document.body.style.overflow;
    if (appRoot) appRoot.inert = true;
    document.body.style.overflow = 'hidden';
    closeButtonRef.current?.focus();

    const onKey = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = Array.from(dialogRef.current?.querySelectorAll(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
      ) || []).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialogRef.current?.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      if (appRoot) appRoot.inert = wasInert;
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [open, close]);

  useEffect(() => () => {
    stopStream();
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
  }, [stopStream]);

  const startCamera = async (nextFacing = facing) => {
    setError('');
    setLoading(true);
    stopStream();
    const generation = cameraGeneration.current;
    if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
      setError('Live camera requires HTTPS (or localhost) and a supported browser.');
      setLoading(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: nextFacing }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      if (generation !== cameraGeneration.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const devices = await navigator.mediaDevices.enumerateDevices?.();
      setCameras((devices || []).filter((d) => d.kind === 'videoinput'));
    } catch (cause) {
      if (generation !== cameraGeneration.current) return;
      stopStream();
      setLoading(false);
      const reason = cause?.name === 'NotAllowedError'
        ? 'Camera access denied. Enable camera permission in browser settings.'
        : 'Camera unavailable. Close other apps using the camera and try again.';
      setError(reason);
    } finally {
      if (generation === cameraGeneration.current) setLoading(false);
    }
  };

  const openCamera = () => {
    if (disabled) return;
    setOpen(true);
    setError('');
    // Mount the dialog's video before calling getUserMedia.
  };

  useEffect(() => {
    if (!open || file) return undefined;
    startCamera(facing);
    // Camera switches are explicitly driven by switchCamera(), not effect reruns.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const switchCamera = async () => {
    const next = facing === 'environment' ? 'user' : 'environment';
    setFacing(next);
    clearPreview();
    await startCamera(next);
  };

  const capture = () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || !video.videoWidth || !video.videoHeight) {
      setError('Camera not ready. Try again.');
      return;
    }
    setError('');
    const scale = Math.min(1, 2000 / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob || !streamRef.current) {
        if (!blob) setError('Photo capture failed. Retake it.');
        return;
      }
      const filename = `vehicle-${Date.now()}.jpg`;
      const photo = new File([blob], filename, { type: 'image/jpeg' });
      clearPreview();
      previewRef.current = URL.createObjectURL(photo);
      setPreview(previewRef.current);
      setFile(photo);
      stopStream();
    }, 'image/jpeg', 0.85);
  };

  const retake = () => {
    clearPreview();
    startCamera(facing);
  };

  const discard = () => {
    clearPreview();
    close();
  };

  const save = (captureAnother = false) => {
    if (!file) return;
    onCapture?.({ file, category, phase, caption: caption.trim(), notes: caption.trim() });
    clearPreview();
    setCaption('');
    if (captureAnother) {
      startCamera(facing);
    } else {
      close();
    }
  };

  return (
    <>
      <button type="button" className="live-camera-trigger" onClick={openCamera} disabled={disabled}>
        <Camera size={17} aria-hidden="true" /> Open Live Camera
      </button>
      {open && createPortal(
        <div className="live-camera-overlay" role="dialog" aria-modal="true" aria-label="Vehicle live camera">
          <div className="live-camera-panel" ref={dialogRef}>
          <div className="live-camera-toolbar">
            <strong>Vehicle Camera <span className="live-camera-count">{count} captured</span></strong>
            <button type="button" ref={closeButtonRef} onClick={close} aria-label="Close camera"><X size={22}/></button>
          </div>
          <div className="live-camera-stage">
            <video ref={videoRef} autoPlay playsInline muted hidden={Boolean(preview)} />
            {preview && <img src={preview} alt="Captured vehicle photo preview" />}
            {preview && <span className="live-camera-preview-badge">Photo preview · not saved yet</span>}
            {loading && <div className="live-camera-status" role="status">Starting camera…</div>}
            {error && <div className="live-camera-error" role="alert">{error}</div>}
            {!file && !loading && !streamRef.current && (
              <CameraOff size={30} aria-hidden="true" />
            )}
          </div>
          <div className="live-camera-controls">
            <label>Category
              <select value={category} onChange={(e) => setCategory(e.target.value)}>
                {VEHICLE_PHOTO_CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label>Service Phase
              <select value={phase} onChange={(e) => setPhase(e.target.value)}>
                <option value="before">Before Service</option>
                <option value="progress">Work Progress</option>
                <option value="after">After Service</option>
              </select>
            </label>
            <label className="live-camera-caption">Inspection Notes
              <input value={caption} maxLength={255} onChange={(e) => setCaption(e.target.value)} placeholder="Optional photo caption" />
            </label>
          </div>
          <div className="live-camera-footer">
            <div className={`live-camera-action-row${file ? ' is-preview' : ' is-live'}`}>
              {!file && <>
                <button type="button" className="live-camera-switch" onClick={switchCamera} disabled={loading} title={cameras.length > 1 ? 'Switch physical camera' : 'Toggle front/rear camera'}><SwitchCamera size={18} aria-hidden="true"/> <span>Switch</span></button>
                <button type="button" className="live-camera-shutter" onClick={capture} disabled={loading || !!error} aria-label="Capture vehicle photo"><Camera size={25} aria-hidden="true"/> <span>Capture</span></button>
                {error && <button type="button" onClick={() => startCamera(facing)}><RefreshCw size={17}/> Retry</button>}
              </>}
              {file && <>
                <button type="button" onClick={retake}><RefreshCw size={18}/> Retake</button>
                <button type="button" onClick={discard} aria-label="Delete captured photo"><X size={18}/> Delete</button>
                <button type="button" className="is-primary" onClick={() => save(false)}><Check size={18}/> Save Photo</button>
                <button type="button" onClick={() => save(true)}><Camera size={18}/> Capture Another</button>
              </>}
            </div>
          </div>
          </div>
        </div>, document.body
      )}
    </>
  );
}
