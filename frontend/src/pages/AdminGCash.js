import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { toast } from 'react-toastify';

const API_BASE = process.env.REACT_APP_API_URL || '/api';
const serverBase = API_BASE.replace('/api', '');

const AdminGCash = () => {
  const [gcashFile, setGcashFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [currentQR, setCurrentQR] = useState(null);
  const [loadingCurrent, setLoadingCurrent] = useState(true);

  useEffect(() => {
    api.get('/payments/gcash-qr')
      .then(data => setCurrentQR(data.qrURL || null))
      .catch(() => {})
      .finally(() => setLoadingCurrent(false));
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setGcashFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!gcashFile) return toast.error('Please select a QR code image first.');
    setUploadingQR(true);
    try {
      const formData = new FormData();
      formData.append('gcashQR', gcashFile);
      await api.uploadFile('/payments/upload-gcash-qr', formData);
      toast.success('✅ GCash QR code uploaded successfully!');
      // Refresh current QR display
      const data = await api.get('/payments/gcash-qr');
      setCurrentQR(data.qrURL || null);
      setGcashFile(null);
      setPreviewUrl(null);
    } catch (err) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploadingQR(false);
    }
  };

  const resolveUrl = (url) => {
    if (!url) return null;
    return url.startsWith('http') ? url : `${serverBase}${url}`;
  };

  return (
    <div style={{ padding: '32px 0 60px' }}>
      <div className="container" style={{ maxWidth: 760 }}>

        {/* Page header */}
        <div style={styles.pageHeader}>
          <div>
            <h1 style={styles.title}>GCash Payment Setup</h1>
            <p style={styles.subtitle}>
              Upload the official GCash QR code that passengers will scan to send payment.
              This QR is shown to every passenger during the checkout process.
            </p>
          </div>
        </div>

        <div style={styles.grid}>

          {/* Current QR */}
          <div className="card" style={styles.card}>
            <div style={styles.cardTitle}>📲 Current QR Code</div>
            <p style={styles.cardDesc}>This is the QR code passengers currently see on the payment page.</p>
            <div style={styles.qrDisplayBox}>
              {loadingCurrent ? (
                <div className="spinner" />
              ) : currentQR ? (
                <>
                  <img
                    src={resolveUrl(currentQR)}
                    alt="Current GCash QR"
                    style={styles.qrImage}
                  />
                  <div style={styles.qrActiveLabel}>✅ Active</div>
                </>
              ) : (
                <div style={styles.qrEmpty}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📵</div>
                  <div style={styles.qrEmptyText}>No QR code uploaded yet</div>
                  <div style={styles.qrEmptyHint}>Passengers will see a placeholder until you upload one.</div>
                </div>
              )}
            </div>
          </div>

          {/* Upload new QR */}
          <div className="card" style={styles.card}>
            <div style={styles.cardTitle}>📤 Upload New QR Code</div>
            <p style={styles.cardDesc}>
              Upload a new GCash QR image to replace the current one.
              The new QR will immediately appear on the passenger payment page.
            </p>

            <div style={styles.uploadArea}>
              <label style={styles.fileLabel}>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <div style={styles.fileLabelInner}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" style={styles.previewImg} />
                  ) : (
                    <>
                      <div style={{ fontSize: 36, marginBottom: 10 }}>🖼️</div>
                      <div style={styles.filePrompt}>Click to choose a QR image</div>
                      <div style={styles.fileHint}>JPG, PNG, WebP · max 2 MB</div>
                    </>
                  )}
                </div>
              </label>
            </div>

            {gcashFile && (
              <div style={styles.selectedFile}>
                📎 {gcashFile.name} ({(gcashFile.size / 1024).toFixed(0)} KB)
              </div>
            )}

            <button
              className="btn-success"
              onClick={handleUpload}
              disabled={!gcashFile || uploadingQR}
              style={{ width: '100%', padding: '13px', fontSize: 15, marginTop: 16 }}
            >
              {uploadingQR ? '⏳ Uploading…' : '📤 Upload & Activate QR'}
            </button>
          </div>
        </div>

        {/* Info box */}
        <div style={styles.infoBox}>
          <div style={styles.infoTitle}>ℹ️ How this works</div>
          <ul style={styles.infoList}>
            <li>When a passenger books a flight and reaches the payment step, they see this QR code.</li>
            <li>They scan it in the GCash app, send the exact amount shown, then screenshot the receipt.</li>
            <li>They upload that screenshot as their payment proof.</li>
            <li>You then review and approve or reject the proof from the <strong>Manage Bookings</strong> page.</li>
          </ul>
        </div>

      </div>
    </div>
  );
};

const styles = {
  pageHeader: { marginBottom: 32 },
  title: { fontFamily: 'Montserrat, sans-serif', fontSize: 28, fontWeight: 800, color: '#003399', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', lineHeight: 1.6, maxWidth: 560 },

  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 },
  card: { padding: 24 },
  cardTitle: { fontFamily: 'Montserrat, sans-serif', fontWeight: 800, fontSize: 16, color: '#003399', marginBottom: 8 },
  cardDesc: { fontSize: 13, color: '#666', marginBottom: 20, lineHeight: 1.6 },

  qrDisplayBox: {
    background: '#f8faff',
    border: '2px dashed #dde4ff',
    borderRadius: 12,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  qrImage: { width: 160, height: 160, objectFit: 'contain', borderRadius: 8 },
  qrActiveLabel: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: 700,
    color: '#007744',
    background: '#e6fff3',
    border: '1px solid #00cc66',
    padding: '4px 14px',
    borderRadius: 20,
  },
  qrEmpty: { textAlign: 'center' },
  qrEmptyText: { fontSize: 15, fontWeight: 700, color: '#888', marginBottom: 6 },
  qrEmptyHint: { fontSize: 13, color: '#aaa' },

  uploadArea: { marginBottom: 8 },
  fileLabel: { cursor: 'pointer', display: 'block' },
  fileLabelInner: {
    border: '2px dashed #99aadd',
    borderRadius: 12,
    padding: '24px 16px',
    textAlign: 'center',
    background: '#f8faff',
    transition: 'border-color 0.2s',
    minHeight: 140,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: { width: 130, height: 130, objectFit: 'contain', borderRadius: 8 },
  filePrompt: { fontSize: 14, fontWeight: 600, color: '#003399', marginBottom: 4 },
  fileHint: { fontSize: 12, color: '#999' },
  selectedFile: {
    fontSize: 12,
    color: '#555',
    background: '#f0f4ff',
    border: '1px solid #dde4ff',
    borderRadius: 6,
    padding: '6px 12px',
  },

  infoBox: {
    background: '#f0f8ff',
    border: '1.5px solid #99ccff',
    borderRadius: 12,
    padding: '20px 24px',
  },
  infoTitle: { fontWeight: 700, fontSize: 14, color: '#0055cc', marginBottom: 12 },
  infoList: {
    paddingLeft: 20,
    fontSize: 13,
    color: '#555',
    lineHeight: 2,
  },
};

export default AdminGCash;
