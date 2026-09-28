import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Bus, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import axios from 'axios';

const BusConfirmationPublic = () => {
  const { id, token } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('idle'); // idle, success, error
  const [message, setMessage] = useState('');
  const [bookingData, setBookingData] = useState(null);

  // Consider fetching basic booking info if needed, or rely solely on ID/token
  // Usually, we just want them to click a button. However, it's nice to show what they are confirming.
  // For simplicity, we just show generic confirmation based on ID/token since we don't have a specific public GET by ID/Token endpoint yet.
  // Although, they already read the WA message, so a clean simple UI is sufficient.

  useEffect(() => {
    // Optionally fetch data if a new endpoint was made, otherwise just wait for user action
  }, [id, token]);

  const handleConfirm = async (decision) => {
    try {
      setLoading(true);
      setStatus('idle');
      setMessage('');

      // Replace with your actual API endpoint based on Vite environment variables setup in your app
      const apiUrl = import.meta.env.VITE_API_URL || '/api';
      const response = await axios.post(`${apiUrl}/bus-bookings/public/confirm-bus/${id}/${token}`, {
        decision
      });

      setStatus('success');
      setMessage(response.data.message || 'Konfirmasi berhasil dicatat.');
    } catch (err) {
      console.error(err);
      setStatus('error');
      setMessage(err.response?.data?.error || 'Terjadi kesalahan saat memproses konfirmasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-100">
        <div className="bg-gradient-to-r from-emerald-600 to-emerald-800 p-6 text-center text-white relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Bus className="w-24 h-24" />
          </div>
          <div className="relative z-10 flex flex-col items-center">
            <div className="bg-white/20 p-3 rounded-full mb-4">
              <Bus className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold">Konfirmasi Jadwal Bus</h1>
            <p className="text-emerald-100 mt-2 text-sm">Validasi Keberangkatan Armada</p>
          </div>
        </div>

        <div className="p-6">
          {status === 'idle' && (
            <div className="text-center">
              <p className="text-slate-600 mb-8">
                Silakan konfirmasi apakah jadwal perjalanan bus ini tetap dilaksanakan (JADI) atau dibatalkan (BATAL).
              </p>
              
              <div className="space-y-4">
                <button
                  onClick={() => handleConfirm('JADI')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white py-4 px-6 rounded-xl font-medium transition-all focus:ring-4 focus:ring-emerald-100 disabled:opacity-70 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6" />
                      <span className="text-lg">YA, JADWAL TETAP JADI</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleConfirm('BATAL')}
                  disabled={loading}
                  className="w-full flex items-center justify-center space-x-2 bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 py-4 px-6 rounded-xl font-medium transition-all focus:ring-4 focus:ring-red-50 disabled:opacity-70 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-6 h-6 animate-spin text-red-500" />
                  ) : (
                    <>
                      <XCircle className="w-6 h-6" />
                      <span className="text-lg">MAAF, JADWAL BATAL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-10 h-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2">Terima Kasih!</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <p className="text-sm text-slate-400">Notifikasi telah diteruskan ke Staff Kendaraan.</p>
              <p className="text-sm text-slate-400 mt-2">Anda sudah boleh menutup halaman ini.</p>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-6">
              <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-10 h-10 text-red-600" />
              </div>
              <h2 className="text-xl font-bold text-slate-800 mb-2">Konfirmasi Gagal</h2>
              <p className="text-slate-600 mb-6">{message}</p>
              <button
                onClick={() => setStatus('idle')}
                className="text-emerald-600 hover:text-emerald-700 font-medium"
              >
                Coba Lagi
              </button>
            </div>
          )}
        </div>
      </div>
      
      <div className="mt-8 text-center text-slate-400 text-sm">
        <p>Sistem Manajemen Aset &copy; {new Date().getFullYear()}</p>
      </div>
    </div>
  );
};

export default BusConfirmationPublic;
