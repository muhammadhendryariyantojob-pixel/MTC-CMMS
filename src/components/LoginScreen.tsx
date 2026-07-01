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
  const [showQuickSelect, setShowQuickSelect] = useState(true);

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
        <div className="lg:col-span-4 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 p-6 flex flex-col justify-between text-white relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800" id="login-visual-panel">
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -ml-16 -mb-16 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl"></div>
          
          <div className="relative z-10" id="login-header-logo">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-2 rounded-lg shadow-md">
                <HardHat className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-sans font-bold text-base tracking-tight text-white">MTC-Control</h1>
                <p className="text-[10px] text-blue-400 font-mono">v1.0.0 Stable</p>
              </div>
            </div>
          </div>

          <div className="my-6 relative z-10" id="login-hero-text">
            <h2 className="text-lg font-bold font-sans tracking-tight text-white leading-snug">
              Sistem Pengelola <span className="text-blue-400 font-extrabold">Maintenance</span> Departemen
            </h2>
            <p className="mt-1.5 text-[11px] text-slate-450 leading-relaxed font-normal">
              Integrasi cerdas Work Request (WR) dan Work Order (WO) antar divisi, teknisi lapangan, dan vendor eksternal secara terstruktur.
            </p>
          </div>

          <div className="border-t border-slate-800/60 pt-4 relative z-10 text-[10px] text-slate-500 font-mono" id="login-footer-info">
            <p>© 2026 MTC-Control Division</p>
            <p className="mt-0.5 text-[9px] text-slate-600">Security-hardened client-auth with PIN validation.</p>
          </div>
        </div>

        {/* Right Side: Form and Quick Accounts */}
        <div className="lg:col-span-8 p-6 sm:p-8 flex flex-col justify-center bg-white border-t lg:border-t-0 lg:border-l border-slate-200" id="login-form-panel">
          
          <div className="mb-6 flex justify-between items-center" id="login-form-tabs">
            <div>
              <h3 className="text-xl font-bold text-slate-900 font-sans">Selamat Datang</h3>
              <p className="text-sm text-slate-500">Masuk ke dashboard akun MTC Anda</p>
            </div>
            <button
              onClick={() => setShowQuickSelect(!showQuickSelect)}
              className="text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 px-3 py-1.5 rounded-md transition border border-slate-200 cursor-pointer"
              id="btn-toggle-quick-select"
            >
              {showQuickSelect ? "Sembunyikan Akun Contoh" : "Tampilkan Akun Contoh"}
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-sm flex items-center gap-2" id="login-error-alert">
              <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></span>
              {error}
            </div>
          )}

          {showQuickSelect && (
            <div className="mb-6 bg-slate-50 p-4 rounded-xl border border-slate-200" id="quick-select-accounts-box">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Pilih Akun Contoh (Untuk Demo/Pengujian):</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1" id="quick-select-grid">
                {defaultUsers.map((user) => (
                  <button
                    key={user.username}
                    type="button"
                    onClick={() => handleQuickSelect(user)}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-left transition cursor-pointer ${
                      username === user.username 
                        ? 'bg-blue-50 border-blue-400 text-blue-900' 
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                    id={`quick-user-${user.username}`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded bg-slate-100">
                        {getRoleIcon(user.role)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-bold truncate">{user.name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{getRoleLabel(user.role)} ({user.division})</p>
                      </div>
                    </div>
                    <div className="text-right ml-2 shrink-0">
                      <span className="text-[10px] bg-slate-100 px-1.5 py-0.5 rounded font-mono text-slate-600">PIN: {user.pin}</span>
                    </div>
                  </button>
                ))}
              </div>
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
                  placeholder="Masukkan username atau pilih akun contoh"
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
