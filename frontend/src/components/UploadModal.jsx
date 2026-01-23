import { useState, useEffect, useRef } from 'react';
import api from '../services/api';

export default function UploadModal({ isOpen, onClose, onSuccess }) {
  const [accounts, setAccounts] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      resetState();
    }
  }, [isOpen]);

  const loadAccounts = async () => {
    try {
      const response = await api.getAccounts();
      setAccounts(response.data.accounts);
    } catch (err) {
      console.error('Failed to load accounts:', err);
    }
  };

  const resetState = () => {
    setSelectedFile(null);
    setSelectedAccount('');
    setResult(null);
    setError(null);
    setUploading(false);
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleFile = (file) => {
    if (file.name.endsWith('.csv')) {
      setSelectedFile(file);
      setError(null);
    } else {
      setError('Please select a CSV file');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !selectedAccount) {
      setError('Please select a file and account');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const response = await api.uploadCSV(selectedFile, selectedAccount);
      setResult(response.data);
      if (onSuccess) {
        onSuccess(response.data);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-tiffany px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Upload CSV</h2>
          <button
            onClick={onClose}
            className="text-white hover:text-tiffany-100 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!result ? (
            <>
              {/* File Drop Zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragActive
                    ? 'border-tiffany bg-tiffany-light'
                    : 'border-gray-300 hover:border-tiffany'
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <svg className="w-12 h-12 mx-auto text-tiffany mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                {selectedFile ? (
                  <p className="text-charcoal font-medium">{selectedFile.name}</p>
                ) : (
                  <>
                    <p className="text-charcoal font-medium">
                      Drop your CSV file here
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      or click to browse
                    </p>
                  </>
                )}
              </div>

              {/* Account Selector */}
              <div className="mt-6">
                <label className="block text-sm font-medium text-charcoal mb-2">
                  Select Account
                </label>
                <select
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-tiffany focus:border-transparent"
                >
                  <option value="">Choose an account...</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                  {error}
                </div>
              )}

              {/* Upload Button */}
              <button
                onClick={handleUpload}
                disabled={uploading || !selectedFile || !selectedAccount}
                className="w-full mt-6 px-6 py-3 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </>
                ) : (
                  'Upload'
                )}
              </button>
            </>
          ) : (
            /* Success Result */
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-charcoal mb-2">Upload Complete!</h3>
              <p className="text-gray-600 mb-4">{result.message}</p>

              <div className="bg-tiffany-light rounded-lg p-4 text-left">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Total Rows:</span>
                    <span className="ml-2 font-medium">{result.total_rows}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Imported:</span>
                    <span className="ml-2 font-medium text-green-600">{result.processed_rows}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Skipped:</span>
                    <span className="ml-2 font-medium text-amber-600">{result.skipped_rows}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Net Amount:</span>
                    <span className="ml-2 font-medium">${result.summary?.net_amount}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="mt-6 px-6 py-3 bg-tiffany text-white font-medium rounded-lg hover:bg-tiffany-dark transition-colors"
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
