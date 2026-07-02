import React, { useState } from 'react';
import { UserProfile } from '../types';
import { db } from '../firebase';
import { doc, getDoc } from 'firebase/firestore';
import { KeyRound, User, ChevronRight, HardHat, Shield, Activity, Users } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: UserProfile) => void;
  defaultUsers: UserProfile[];
}

export default function LoginScreen({ onLoginSuccess, defaultUsers }: LoginScreenProps) {
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!username.trim() || !pin) {
      setError('Username dan PIN wajib diisi');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // First check local/synced users array for instant login (0ms lag!)
      const matchedUser = defaultUsers.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase()
      );

      let authenticatedUser: UserProfile | null = null;

      if (matchedUser && matchedUser.pin === pin) {
        authenticatedUser = matchedUser;
      } else {
        // Fallback: directly fetch from Firestore
        const userDocRef = doc(db, 'users', username.trim().toLowerCase());
        const userSnap = await getDoc(userDocRef);
        if (userSnap.exists()) {
          const userData = userSnap.data() as UserProfile;
          if (userData.pin === pin) {
            authenticatedUser = userData;
          }
        }
      }

      if (authenticatedUser) {
        if (!authenticatedUser.active) {
          setError('Akun Anda dinonaktifkan oleh administrator');
          setLoading(false);
          return;
        }

        // Validate Company License
        const userCompId = authenticatedUser.companyId || 'default';
        const compSnap = await getDoc(doc(db, 'companies', userCompId));
        if (compSnap.exists()) {
          const compData = compSnap.data();
          if (compData.status === 'nonaktif' && authenticatedUser.username !== 'admin') {
            setError('Akses ditangguhkan: Izin aplikasi untuk perusahaan Anda telah dinonaktifkan.');
            setLoading(false);
            return;
          }
        }

        onLoginSuccess(authenticatedUser);
        return;
      }
      
      setError('Username atau PIN salah');
    } catch (err: any) {
      console.error(err);
      // Fallback local authentication for smooth offline testing
      const localDefault = defaultUsers.find(
        u => u.username.toLowerCase() === username.trim().toLowerCase()
      );
      if (localDefault && localDefault.pin === pin) {
        onLoginSuccess(localDefault);
      } else {
        setError('Gagal masuk. Periksa koneksi atau database Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSelect = (user: UserProfile) => {
    setUsername(user.username);
    setPin(user.pin);
    setError('');
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-rose-600" />;
      case 'management':
        return <Activity className="w-4 h-4 text-emerald-600" />;
      case 'teknisi':
        return <HardHat className="w-4 h-4 text-amber-600" />;
      default:
        return <Users className="w-4 h-4 text-blue-600" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'management': return 'MTC Management';
      case 'teknisi': return 'MTC Teknisi';
      default: return 'User Departemen';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4" id="login-container">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden" id="login-card-grid">
        
        {/* Left Side: Brand & Visuals */}
        <div className="lg:col-span-4 bg-slate-900 p-6 flex flex-col justify-between text-white relative border-b lg:border-b-0 lg:border-r border-slate-850" id="login-visual-panel">
          
          <div className="relative z-10" id="login-header-logo">
            <div className="flex items-center gap-2.5">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-sans font-bold text-base tracking-tight text-white">MTC-Control</h1>
                <p className="text-[10px] text-slate-400 font-sans font-medium">Sistem Maintenance</p>
              </div>
            </div>
          </div>

          <div className="my-6 relative z-10" id="login-hero-text">
            <h2 className="text-lg font-bold font-sans tracking-tight text-white leading-snug">
              Sistem Pengelola <span className="text-indigo-400 font-extrabold">Maintenance</span>
            </h2>
            <p className="mt-1.5 text-[11px] text-slate-400 leading-relaxed font-normal">
              Aplikasi pengelolaan Work Request (WR) dan Work Order (WO) departemen secara praktis, terintegrasi, dan mudah dipantau.
            </p>
          </div>

          <div className="border-t border-slate-800 pt-4 relative z-10 text-[10px] text-slate-500 font-sans" id="login-footer-info">
            <p>© {new Date().getFullYear()} MTC-Control Division</p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-center bg-white border-t lg:border-t-0 lg:border-l border-slate-200" id="login-form-panel">
          
          <div className="mb-6" id="login-form-tabs">
            <h3 className="text-xl font-bold text-slate-900 font-sans">Selamat Datang</h3>
            <p className="text-sm text-slate-500">Masuk ke dashboard akun MTC Anda</p>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm flex items-center gap-2" id="login-error-alert">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4" id="login-credentials-form">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Username Pengguna</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="input-login-username"
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Masukkan username Anda"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition font-sans"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Kode Keamanan PIN (4-Digit atau lebih)</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <KeyRound className="h-5 w-5 text-slate-400" />
                </div>
                <input
                  id="input-login-pin"
                  type="password"
                  maxLength={10}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="Masukkan PIN keamanan Anda"
                  className="block w-full pl-10 pr-3 py-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white tracking-widest font-mono"
                  required
                />
              </div>
            </div>

            <button
              id="btn-submit-login"
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white font-semibold py-3 px-4 rounded-lg text-sm flex items-center justify-center gap-2 shadow-sm transition duration-150 cursor-pointer"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Memverifikasi PIN...
                </span>
              ) : (
                <>
                  Masuk ke Aplikasi MTC
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
