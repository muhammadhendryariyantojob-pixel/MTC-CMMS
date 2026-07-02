import React, { useState } from 'react';
import { PreventiveMaintenance, UserProfile, CompanyBranch, WorkRequest } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import { generateWRNumber } from '../dbHelper';
import { 
  ShieldCheck, 
  Plus, 
  Calendar, 
  Clock, 
  RefreshCcw, 
  FileText, 
  Check, 
  Trash2, 
  Search, 
  Settings, 
  Wrench, 
  MapPin, 
  Activity, 
  AlertCircle, 
  X, 
  Download 
} from 'lucide-react';
import { exportToExcelCSV } from '../utils';

interface PreventiveMaintenanceScreenProps {
  pmSchedules: PreventiveMaintenance[];
  currentUser: UserProfile;
  branches?: CompanyBranch[];
  onRefresh: () => void;
}

export default function PreventiveMaintenanceScreen({ 
  pmSchedules, 
  currentUser, 
  branches = [], 
  onRefresh 
}: PreventiveMaintenanceScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFrequency, setFilterFrequency] = useState('all');
  const [submitting, setSubmitting] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'info' | 'warning';
    alertOnly?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Form State
  const [namaAlat, setNamaAlat] = useState('');
  const [kodeAlat, setKodeAlat] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [frekuensi, setFrekuensi] = useState<PreventiveMaintenance['frekuensi']>('bulanan');
  const [hariInterval, setHariInterval] = useState(30);
  const [tanggalTerakhir, setTanggalTerakhir] = useState('');
  const [tanggalBerikutnya, setTanggalBerikutnya] = useState('');
  const [otomatisWR, setOtomatisWR] = useState(true);

  const isAdmin = currentUser.role === 'admin';

  const handleAddPM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaAlat.trim() || !tanggalBerikutnya) return;

    setSubmitting(true);
    const pmId = 'PM-' + Date.now();
    const companyId = currentUser.companyId || 'default';
    const cabangId = currentUser.cabangId || 'pusat';

    const newPM: PreventiveMaintenance = {
      id: pmId,
      namaAlat,
      kodeAlat: kodeAlat || undefined,
      lokasi: lokasi || undefined,
      deskripsi: deskripsi || undefined,
      frekuensi,
      hariInterval: frekuensi === 'custom' ? hariInterval : undefined,
      tanggalTerakhirPengecekan: tanggalTerakhir || undefined,
      tanggalBerikutnyaPengecekan: tanggalBerikutnya,
      otomatisWR,
      status: 'aktif',
      createdAt: new Date().toISOString(),
      companyId,
      cabangId
    };

    try {
      await setDoc(doc(db, 'preventive_maintenance', pmId), newPM);
      
      // If otomatisWR is enabled and date is already due, or optionally we can auto-generate the first WR
      if (otomatisWR) {
        const today = new Date().toISOString().split('T')[0];
        if (tanggalBerikutnya <= today) {
          await generateAutoWR(newPM);
        }
      }

      setShowAddForm(false);
      // Reset form
      setNamaAlat('');
      setKodeAlat('');
      setLokasi('');
      setDeskripsi('');
      setFrekuensi('bulanan');
      setHariInterval(30);
      setTanggalTerakhir('');
      setTanggalBerikutnya('');
      setOtomatisWR(true);
      onRefresh();
    } catch (err) {
      console.error('Error creating PM schedule:', err);
      alert('Gagal menambahkan jadwal Preventive Maintenance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePM = (id: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Jadwal PM',
      message: 'Apakah Anda yakin ingin menghapus jadwal Preventive Maintenance ini secara permanen?',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'preventive_maintenance', id));
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err) {
          console.error('Error deleting PM:', err);
          alert('Gagal menghapus jadwal PM.');
        }
      },
      onCancel: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleToggleStatus = async (pm: PreventiveMaintenance) => {
    const nextStatus = pm.status === 'aktif' ? 'nonaktif' : 'aktif';
    try {
      await updateDoc(doc(db, 'preventive_maintenance', pm.id), { status: nextStatus });
      onRefresh();
    } catch (err) {
      console.error('Error toggling status:', err);
    }
  };

  // Helper to calculate the next check date based on frequency
  const calculateNextDate = (lastDateStr: string, freq: PreventiveMaintenance['frekuensi'], intervalDays?: number) => {
    const d = new Date(lastDateStr);
    if (isNaN(d.getTime())) return '';
    
    switch (freq) {
      case 'harian':
        d.setDate(d.getDate() + 1);
        break;
      case 'mingguan':
        d.setDate(d.getDate() + 7);
        break;
      case 'bulanan':
        d.setMonth(d.getMonth() + 1);
        break;
      case 'tahunan':
        d.setFullYear(d.getFullYear() + 1);
        break;
      case 'custom':
        d.setDate(d.getDate() + (intervalDays || 30));
        break;
    }
    return d.toISOString().split('T')[0];
  };

  const handleLastDateChange = (dateVal: string) => {
    setTanggalTerakhir(dateVal);
    if (dateVal) {
      const calculated = calculateNextDate(dateVal, frekuensi, hariInterval);
      setTanggalBerikutnya(calculated);
    }
  };

  const generateAutoWR = async (pm: PreventiveMaintenance) => {
    const wrId = 'WR-' + Date.now();
    const nomorWR = await generateWRNumber(pm.companyId || 'default', currentUser.division || 'MTC');
    
    const newWR: WorkRequest = {
      id: wrId,
      nomorWR,
      masalah: `[PREVENTIVE MAINTENANCE DUE] Pengecekan rutin terjadwal (${pm.frekuensi}) untuk alat: ${pm.namaAlat}. ${pm.deskripsi || ''}`,
      tindakan: `Lakukan checklist standar maintenance preventif dan verifikasi operasi mesin.`,
      namaPengaju: 'Sistem PM Otomatis',
      tanggalArea: `${pm.tanggalBerikutnyaPengecekan} - ${pm.lokasi || 'Lokasi Terdaftar'}`,
      namaMesin: pm.namaAlat,
      tanggalPengajuan: new Date().toISOString().split('T')[0],
      divisiPengaju: 'MTC',
      status: 'pending',
      prioritas: 'sedang',
      tujuan: 'perawatan',
      tindakanMaintenance: 'sendiri',
      createdAt: new Date().toISOString(),
      companyId: pm.companyId,
      cabangId: pm.cabangId
    };

    // Save WR to Firestore
    await setDoc(doc(db, 'work_requests', wrId), newWR);
  };

  const handleManualTriggerWR = (pm: PreventiveMaintenance) => {
    setDialogConfig({
      isOpen: true,
      title: 'Terbitkan Work Request',
      message: `Terbitkan Work Request (WR) perbaikan untuk alat ${pm.namaAlat} sekarang?`,
      confirmLabel: 'Ya, Terbitkan',
      cancelLabel: 'Batal',
      variant: 'info',
      onConfirm: async () => {
        try {
          await generateAutoWR(pm);
          
          // Calculate next check date after issuing current one
          const nextDate = calculateNextDate(pm.tanggalBerikutnyaPengecekan, pm.frekuensi, pm.hariInterval);
          await updateDoc(doc(db, 'preventive_maintenance', pm.id), {
            tanggalTerakhirPengecekan: pm.tanggalBerikutnyaPengecekan,
            tanggalBerikutnyaPengecekan: nextDate
          });

          alert(`Work Request (WR) berhasil diterbitkan untuk alat: ${pm.namaAlat}. Jadwal pengecekan berikutnya telah diperbarui ke ${nextDate}.`);
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err) {
          console.error('Error triggering manual WR:', err);
          alert('Gagal menerbitkan WR.');
        }
      },
      onCancel: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const filteredPM = pmSchedules.filter(pm => {
    const matchesSearch = pm.namaAlat.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (pm.kodeAlat && pm.kodeAlat.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (pm.lokasi && pm.lokasi.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFreq = filterFrequency === 'all' || pm.frekuensi === filterFrequency;
    return matchesSearch && matchesFreq;
  });

  const handleExportCSV = () => {
    const headers = ['Nama Alat', 'Kode Alat', 'Lokasi', 'Frekuensi', 'Terakhir Pengecekan', 'Berikutnya Pengecekan', 'Status', 'Otomatis WR'];
    const keys = ['namaAlat', 'kodeAlat', 'lokasi', 'frekuensi', 'tanggalTerakhirPengecekan', 'tanggalBerikutnyaPengecekan', 'status', 'otomatisWR'];
    exportToExcelCSV(filteredPM, headers, keys, 'Laporan_Preventive_Maintenance');
  };

  return (
    <div className="space-y-6" id="pm-screen-container">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900" id="pm-header-panel">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            Preventive Maintenance (PM)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Kelola jadwal pengecekan berkala aset pabrik secara otomatis atau manual guna mencegah downtime tidak terduga.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 animate-fadeIn"
            id="btn-add-pm-schedule"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Batal Tambah' : 'Tambah Jadwal Alat'}
          </button>
        )}
      </div>

      {/* Slide / Dropdown Add PM Form */}
      {showAddForm && isAdmin && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6 animate-fadeIn" id="pm-add-form-container">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Pendaftaran Asset & Penjadwalan PM Baru
            </h3>
            <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600">
              HANYA ADMINISTRATOR
            </span>
          </div>

          <form onSubmit={handleAddPM} className="grid grid-cols-1 md:grid-cols-2 gap-5" id="pm-creation-form">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nama Alat / Asset Mesin *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chiller Utama, Motor Pump 03, Blower Exhaust"
                  value={namaAlat}
                  onChange={(e) => setNamaAlat(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Kode Alat (ID Aset)</label>
                  <input
                    type="text"
                    placeholder="MTC-CHL-001"
                    value={kodeAlat}
                    onChange={(e) => setKodeAlat(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Area / Lokasi Kerja</label>
                  <input
                    type="text"
                    placeholder="Gedung A Lantai 2"
                    value={lokasi}
                    onChange={(e) => setLokasi(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Deskripsi Instruksi Pengecekan</label>
                <textarea
                  rows={2}
                  placeholder="Instruksi checklist: Cek filter oli, bersihkan bearing, ukur voltase dinamo..."
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Frekuensi Pengecekan *</label>
                  <select
                    value={frekuensi}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setFrekuensi(val);
                      if (tanggalTerakhir) {
                        setTanggalBerikutnya(calculateNextDate(tanggalTerakhir, val, hariInterval));
                      }
                    }}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="harian">Harian (Setiap Hari)</option>
                    <option value="mingguan">Mingguan (Tiap Minggu)</option>
                    <option value="bulanan">Bulanan (Tiap Bulan)</option>
                    <option value="tahunan">Tahunan (Tiap Tahun)</option>
                    <option value="custom">Custom (Interval Hari)</option>
                  </select>
                </div>

                {frekuensi === 'custom' && (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Interval (Hari)</label>
                    <input
                      type="number"
                      min="1"
                      value={hariInterval}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setHariInterval(val);
                        if (tanggalTerakhir) {
                          setTanggalBerikutnya(calculateNextDate(tanggalTerakhir, 'custom', val));
                        }
                      }}
                      className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tanggal Terakhir Dicek</label>
                  <input
                    type="date"
                    value={tanggalTerakhir}
                    onChange={(e) => handleLastDateChange(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Tanggal Berikutnya *</label>
                  <input
                    type="date"
                    required
                    value={tanggalBerikutnya}
                    onChange={(e) => setTanggalBerikutnya(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>
              </div>

              <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-indigo-950 block">Otomatis Menjadi Work Request (WR)</span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">
                    Terbitkan lembar Work Request perbaikan di sistem otomatis saat jatuh tempo pengerjaan.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={otomatisWR}
                    onChange={(e) => setOtomatisWR(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 flex justify-end gap-2" id="pm-form-actions">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Jadwal PM'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between shadow-2xs" id="pm-filters-panel">
        <div className="relative flex-1 w-full max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari alat, kode aset, lokasi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {['all', 'harian', 'mingguan', 'bulanan', 'tahunan', 'custom'].map((freq) => (
            <button
              key={freq}
              onClick={() => setFilterFrequency(freq)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition uppercase cursor-pointer ${
                filterFrequency === freq 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {freq}
            </button>
          ))}

          <button
            onClick={handleExportCSV}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>EXPORT CSV</span>
          </button>
        </div>
      </div>

      {/* Schedule cards */}
      {filteredPM.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2 shadow-2xs">
          <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
          <p>Tidak ada aset PM yang ditemukan atau terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5" id="pm-schedule-grid">
          {filteredPM.map((pm) => {
            const today = new Date().toISOString().split('T')[0];
            const isDue = pm.tanggalBerikutnyaPengecekan <= today;
            const isScheduleActive = pm.status === 'aktif';

            return (
              <div 
                key={pm.id} 
                className={`bg-white rounded-xl border transition p-5 flex flex-col justify-between shadow-2xs hover:shadow-sm duration-150 ${
                  isDue && isScheduleActive
                    ? 'border-rose-300 ring-2 ring-rose-50' 
                    : 'border-slate-200'
                }`}
              >
                <div className="space-y-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-bold font-mono text-slate-400 block uppercase">{pm.kodeAlat || pm.id}</span>
                      <h4 className="text-sm font-extrabold text-slate-800 mt-0.5">{pm.namaAlat}</h4>
                    </div>
                    <span className={`text-[9px] font-extrabold uppercase px-2.5 py-1 rounded-full border ${
                      isScheduleActive 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}>
                      {pm.status}
                    </span>
                  </div>

                  {pm.deskripsi && (
                    <p className="text-xs text-slate-500 italic line-clamp-2 leading-relaxed">"{pm.deskripsi}"</p>
                  )}

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-150 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">Terakhir Dicek</span>
                      <span className="font-semibold text-slate-700 block mt-0.5">{pm.tanggalTerakhirPengecekan || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">Jatuh Tempo</span>
                      <span className={`font-extrabold block mt-0.5 ${isDue && isScheduleActive ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
                        {pm.tanggalBerikutnyaPengecekan}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-1">
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                      {pm.frekuensi}
                    </span>
                    <span className="flex items-center gap-1 font-semibold text-slate-400">
                      <MapPin className="w-3.5 h-3.5" />
                      {pm.lokasi || 'Pusat'}
                    </span>
                  </div>

                  {pm.otomatisWR && isScheduleActive && (
                    <div className="bg-indigo-50/60 border border-indigo-100 p-2.5 rounded-lg flex items-center gap-2 text-[10px] text-indigo-900 font-medium">
                      <RefreshCcw className="w-3.5 h-3.5 text-indigo-500 animate-spin" style={{ animationDuration: '6s' }} />
                      <span>Sistem Otomatis: WR akan diterbitkan saat jatuh tempo.</span>
                    </div>
                  )}

                  {isDue && isScheduleActive && (
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-rose-900 font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">JADWAL TELAH JATUH TEMPO!</span> Alat ini memerlukan pengecekan mendesak.
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex gap-2">
                    {isAdmin && (
                      <button
                        onClick={() => handleToggleStatus(pm)}
                        className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition cursor-pointer ${
                          isScheduleActive
                            ? 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                            : 'bg-emerald-600 hover:bg-emerald-500 border-transparent text-white'
                        }`}
                      >
                        {isScheduleActive ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    )}

                    {isDue && isScheduleActive && (
                      <button
                        onClick={() => handleManualTriggerWR(pm)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                      >
                        <Wrench className="w-3 h-3" /> Terbitkan WR
                      </button>
                    )}
                  </div>

                  {isAdmin && (
                    <button
                      onClick={() => handleDeletePM(pm.id)}
                      className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-100 cursor-pointer"
                      title="Hapus Alat"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel}
        cancelLabel={dialogConfig.cancelLabel}
        variant={dialogConfig.variant}
        alertOnly={dialogConfig.alertOnly}
        onConfirm={dialogConfig.onConfirm}
        onCancel={dialogConfig.onCancel}
      />

    </div>
  );
}
