import { recordLabel } from '../../utils/recordReferences.js';
import { useEffect, useState } from 'react';
import { Download, FileText, Share2 } from 'lucide-react';
import { ResponsiveModalSheet } from '../common/ResponsiveModalSheet';
import { eWayBillService } from '../../services/eWayBill.service';
import '../../styles/invoice-pdf-share-sheet.css';

const supportsFileShare = (file) => {
  if (!file || typeof navigator.share !== 'function') return false;
  try {
    return typeof navigator.canShare !== 'function'
      || navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
};

/** Same mobile bottom-sheet layout as Invoice PDF, using a real saved EWB PDF. */
export function EWayBillPdfShareSheet({ document, onClose }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const id = document?.id;
  const documentNo = recordLabel(document?.documentNo || id, 'E-Way Bill');

  useEffect(() => {
    if (!id) return undefined;
    let active = true;
    setBusy(true);
    setFile(null);
    setError('');
    setNotice('');
    eWayBillService.getPdfFile(document)
      .then((nextFile) => { if (active) setFile(nextFile); })
      .catch((err) => {
        if (active) setError(err?.message || 'Unable to prepare the E-Way Bill PDF.');
      })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  // Reload only when the document ID changes or the user retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, attempt]);

  if (!id) return null;

  const nativeShare = supportsFileShare(file);
  const save = () => {
    if (!file) return;
    try {
      eWayBillService.savePdfFile(file);
      setError('');
      setNotice('PDF download started.');
    } catch (err) {
      setError(err?.message || 'Could not download the PDF.');
    }
  };

  const share = () => {
    if (!file || !nativeShare || sharing) return;
    setError('');
    setNotice('');
    setSharing(true);
    try {
      // The native iPhone share menu needs direct user activation. The
      // document is already fetched before this button becomes enabled.
      const result = navigator.share({
        files: [file], title: documentNo, text: 'E-Way Bill PDF',
      });
      Promise.resolve(result).then(() => {
        setSharing(false);
        onClose();
      }).catch((err) => {
        setSharing(false);
        if (err?.name !== 'AbortError') {
          setError(err?.message || 'Sharing is unavailable. Download the PDF instead.');
        }
      });
    } catch (err) {
      setSharing(false);
      if (err?.name !== 'AbortError') {
        setError(err?.message || 'Sharing is unavailable. Download the PDF instead.');
      }
    }
  };

  return (
    <ResponsiveModalSheet isOpen onClose={onClose} title="Share E-Way Bill PDF" maxWidth="460px">
      <div className="invoice-pdf-share-panel">
        <div className="invoice-pdf-share-file">
          <span className="invoice-pdf-share-file-icon"><FileText size={23} aria-hidden="true"/></span>
          <div>
            <strong>{file?.name || 'EWayBill-' + documentNo + '.pdf'}</strong>
            <span>Saved E-Way Bill · PDF document</span>
          </div>
        </div>
        {!document?.ewayBillNo && (
          <p className="invoice-pdf-share-info">
            Local document only — not an officially generated NIC E-Way Bill.
          </p>
        )}
        {busy && <p role="status" className="invoice-pdf-share-info">Preparing saved PDF…</p>}
        {error && <div role="alert" className="invoice-pdf-share-error">
          <p>{error}</p>
          {!file && <button type="button" onClick={() => setAttempt((count) => count + 1)}>Try again</button>}
        </div>}
        {notice && <p role="status" className="invoice-pdf-share-info">{notice}</p>}
        {!busy && file && !nativeShare && (
          <p className="invoice-pdf-share-info">
            Native sharing is not supported here. Download the PDF to share from your device.
          </p>
        )}
        <div className="invoice-pdf-share-actions">
          <button type="button" className="invoice-pdf-share-primary" onClick={share}
            disabled={busy || sharing || !nativeShare}>
            <Share2 size={20} aria-hidden="true"/>
            {sharing ? 'Opening share menu…' : 'Share PDF'}
          </button>
          <button type="button" className="invoice-pdf-share-download" onClick={save}
            disabled={busy || sharing || !file}>
            <Download size={20} aria-hidden="true"/> Download PDF
          </button>
          <button type="button" className="invoice-pdf-share-cancel" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </ResponsiveModalSheet>
  );
}
