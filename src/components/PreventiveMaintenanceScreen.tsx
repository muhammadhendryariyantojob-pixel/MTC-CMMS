import React, { useState } from 'react';
import { PreventiveMaintenance, UserProfile, CompanyBranch, WorkRequest, Asset } from '../types';
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
  Download,
  Car,
  History,
  Gauge,
  Pencil,
  FolderPlus
} from 'lucide-react';
import { exportToExcelCSV, hasPermission } from '../utils';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip
} from 'recharts';

interface PreventiveMaintenanceScreenProps {
  pmSchedules: PreventiveMaintenance[];
  currentUser: UserProfile;
  branches?: CompanyBranch[];
  assets?: Asset[];
  onRefresh: () => void;
}

const cleanObject = (obj: any): any => {
  const copy = { ...obj };
  Object.keys(copy).forEach(key => {
    if (copy[key] === undefined || (typeof copy[key] === 'number' && isNaN(copy[key]))) {
      delete copy[key];
    }
  });
  return copy;
};

const getLocalDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export default function PreventiveMaintenanceScreen({ 
  pmSchedules, 
  currentUser, 
  branches = [], 
  assets = [],
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
  const [customIntervalUnit, setCustomIntervalUnit] = useState<PreventiveMaintenance['customIntervalUnit']>('hari');
  const [tanggalTerakhir, setTanggalTerakhir] = useState('');
  const [tanggalBerikutnya, setTanggalBerikutnya] = useState('');
  const [otomatisWR, setOtomatisWR] = useState(true);
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false);
  const [createAsset, setCreateAsset] = useState(false);
  const [assetKategori, setAssetKategori] = useState('Produksi');
  const [assetKritikalitas, setAssetKritikalitas] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');

  // Vehicle-specific states
  const [isVehicle, setIsVehicle] = useState(false);
  const [vehicleTrackingMode, setVehicleTrackingMode] = useState<'kilometer' | 'runhour' | 'cycles'>('kilometer');
  const [vehicleLastReading, setVehicleLastReading] = useState<number>(0);
  const [vehicleIntervalReading, setVehicleIntervalReading] = useState<number>(5000);
  const [vehicleTargetReading, setVehicleTargetReading] = useState<number>(5000);

  // Periodic entry & logs states
  const [selectedPmForReading, setSelectedPmForReading] = useState<PreventiveMaintenance | null>(null);
  const [newReadingValue, setNewReadingValue] = useState<string>('');
  const [showReadingHistory, setShowReadingHistory] = useState<boolean>(false);
  const [historyChartFilter, setHistoryChartFilter] = useState<'hari' | 'bulan' | 'tahun'>('hari');

  // Edit asset states
  const [editingPm, setEditingPm] = useState<PreventiveMaintenance | null>(null);
  const [editNamaAlat, setEditNamaAlat] = useState('');
  const [editKodeAlat, setEditKodeAlat] = useState('');
  const [editLokasi, setEditLokasi] = useState('');
  const [editDeskripsi, setEditDeskripsi] = useState('');
  const [editFrekuensi, setEditFrekuensi] = useState<PreventiveMaintenance['frekuensi']>('bulanan');
  const [editHariInterval, setEditHariInterval] = useState(30);
  const [editCustomIntervalUnit, setEditCustomIntervalUnit] = useState<PreventiveMaintenance['customIntervalUnit']>('hari');
  const [editTanggalTerakhir, setEditTanggalTerakhir] = useState('');
  const [editTanggalBerikutnya, setEditTanggalBerikutnya] = useState('');
  const [editOtomatisWR, setEditOtomatisWR] = useState(true);
  const [editIsVehicle, setEditIsVehicle] = useState(false);
  const [editVehicleTrackingMode, setEditVehicleTrackingMode] = useState<'kilometer' | 'runhour' | 'cycles'>('kilometer');
  const [editVehicleIntervalReading, setEditVehicleIntervalReading] = useState<number>(5000);
  const [editVehicleTargetReading, setEditVehicleTargetReading] = useState<number>(5000);
  const [showEditAssetSuggestions, setShowEditAssetSuggestions] = useState(false);
  const [editCreateAsset, setEditCreateAsset] = useState(false);
  const [editAssetKategori, setEditAssetKategori] = useState('Produksi');
  const [editAssetKritikalitas, setEditAssetKritikalitas] = useState<'critical' | 'high' | 'medium' | 'low'>('medium');

  const handleStartEdit = (pm: PreventiveMaintenance) => {
    setEditingPm(pm);
    setEditNamaAlat(pm.namaAlat || '');
    setEditKodeAlat(pm.kodeAlat || '');
    setEditLokasi(pm.lokasi || '');
    setEditDeskripsi(pm.deskripsi || '');
    setEditFrekuensi(pm.frekuensi || 'bulanan');
    setEditHariInterval(pm.hariInterval || 30);
    setEditCustomIntervalUnit(pm.customIntervalUnit || 'hari');
    setEditTanggalTerakhir(pm.tanggalTerakhirPengecekan || '');
    setEditTanggalBerikutnya(pm.tanggalBerikutnyaPengecekan || '');
    setEditOtomatisWR(pm.otomatisWR !== false);
    setEditIsVehicle(!!pm.isVehicle);
    setEditVehicleTrackingMode(pm.vehicleTrackingMode || 'kilometer');
    setEditVehicleIntervalReading(pm.vehicleIntervalReading || 5000);
    setEditVehicleTargetReading(pm.vehicleTargetReading || 5000);
    setEditCreateAsset(false);
    setEditAssetKategori('Produksi');
    setEditAssetKritikalitas('medium');
  };

  const handleEditLastDateChange = (dateVal: string) => {
    setEditTanggalTerakhir(dateVal);
    if (dateVal) {
      const calculated = calculateNextDate(dateVal, editFrekuensi, editHariInterval, editCustomIntervalUnit);
      setEditTanggalBerikutnya(calculated);
    }
  };

  const handleUpdatePM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPm) return;
    if (!editNamaAlat.trim() || (!editIsVehicle && !editTanggalBerikutnya)) return;

    setSubmitting(true);
    const updatedPM: any = {
      namaAlat: editNamaAlat,
      kodeAlat: editKodeAlat || null,
      lokasi: editLokasi || null,
      deskripsi: editDeskripsi || null,
      frekuensi: editIsVehicle ? editFrekuensi : (editFrekuensi || 'bulanan'),
      hariInterval: editFrekuensi === 'custom' ? editHariInterval : null,
      customIntervalUnit: editFrekuensi === 'custom' ? editCustomIntervalUnit : null,
      tanggalTerakhirPengecekan: editTanggalTerakhir || null,
      tanggalBerikutnyaPengecekan: editTanggalBerikutnya || null,
      otomatisWR: editOtomatisWR,
      isVehicle: editIsVehicle,
      vehicleTrackingMode: editIsVehicle ? editVehicleTrackingMode : null,
      vehicleIntervalReading: editIsVehicle ? Number(editVehicleIntervalReading) : null,
      vehicleTargetReading: editIsVehicle ? Number(editVehicleTargetReading) : null,
    };

    try {
      await updateDoc(doc(db, 'preventive_maintenance', editingPm.id), cleanObject(updatedPM));

      if (editCreateAsset && !isAssetRegisteredEdit) {
        const assetId = 'A-' + Date.now();
        const newAsset: Asset = {
          id: assetId,
          code: editKodeAlat || '',
          name: editNamaAlat,
          category: editAssetKategori,
          location: editLokasi || '',
          status: 'running',
          criticality: editAssetKritikalitas as any,
          companyId: currentUser.companyId || 'default',
          cabangId: currentUser.cabangId || 'pusat',
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'assets', assetId), cleanObject(newAsset));
      }

      setEditingPm(null);
      setDialogConfig({
        isOpen: true,
        title: 'Sukses',
        message: 'Aset Preventive Maintenance berhasil diperbarui.',
        alertOnly: true,
        onConfirm: () => {
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
        },
      });
      onRefresh();
    } catch (error) {
      console.error('Error updating PM:', error);
      alert('Gagal memperbarui aset.');
    } finally {
      setSubmitting(false);
    }
  };

  const isAdmin = currentUser.role === 'admin';
  const canManagePMAssets = hasPermission(currentUser, 'canManagePMAssets');
  const canInputReading = hasPermission(currentUser, 'canInputPMReading');

  const handleAddPM = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaAlat.trim() || (!isVehicle && !tanggalBerikutnya)) return;

    setSubmitting(true);
    const pmId = 'PM-' + Date.now();
    const companyId = currentUser.companyId || 'default';
    const cabangId = currentUser.cabangId || 'pusat';

    // Set a default date if not provided (especially for vehicles that might track by KM/RH only, then we leave it blank/optional)
    const nextDate = tanggalBerikutnya || undefined;

    const newPM: PreventiveMaintenance = {
      id: pmId,
      namaAlat,
      kodeAlat: kodeAlat || undefined,
      lokasi: lokasi || undefined,
      deskripsi: deskripsi || undefined,
      frekuensi: isVehicle ? frekuensi : (frekuensi || 'bulanan'),
      hariInterval: frekuensi === 'custom' ? hariInterval : undefined,
      customIntervalUnit: frekuensi === 'custom' ? customIntervalUnit : undefined,
      tanggalTerakhirPengecekan: tanggalTerakhir || undefined,
      tanggalBerikutnyaPengecekan: nextDate,
      otomatisWR,
      status: 'aktif',
      createdAt: new Date().toISOString(),
      companyId,
      cabangId,
      // Vehicle monitoring fields
      isVehicle,
      vehicleTrackingMode: isVehicle ? vehicleTrackingMode : undefined,
      vehicleLastReading: isVehicle ? Number(vehicleLastReading) : undefined,
      vehicleIntervalReading: isVehicle ? Number(vehicleIntervalReading) : undefined,
      vehicleTargetReading: isVehicle ? Number(vehicleTargetReading) : undefined,
      vehicleReadingHistory: isVehicle ? [
        {
          id: 'VR-init-' + Date.now(),
          tanggal: getLocalDateString(),
          nilai: Number(vehicleLastReading),
          petugas: currentUser.name || currentUser.username
        }
      ] : undefined
    };

    try {
      await setDoc(doc(db, 'preventive_maintenance', pmId), cleanObject(newPM));
      
      if (createAsset && !isAssetRegisteredAdd) {
        const assetId = 'A-' + Date.now();
        const newAsset: Asset = {
          id: assetId,
          code: kodeAlat || '',
          name: namaAlat,
          category: assetKategori,
          location: lokasi || '',
          status: 'running',
          criticality: assetKritikalitas as any,
          companyId,
          cabangId,
          createdAt: new Date().toISOString()
        };
        await setDoc(doc(db, 'assets', assetId), cleanObject(newAsset));
      }

      // If otomatisWR is enabled and date is already due, or optionally we can auto-generate the first WR
      if (otomatisWR) {
        const today = getLocalDateString();
        const isReadingDue = isVehicle && Number(vehicleLastReading) >= Number(vehicleTargetReading);
        const isDateDue = nextDate ? nextDate <= today : false;
        if (isDateDue || isReadingDue) {
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
      // Reset vehicle fields
      setIsVehicle(false);
      setVehicleTrackingMode('kilometer');
      setVehicleLastReading(0);
      setVehicleIntervalReading(5000);
      setVehicleTargetReading(5000);
      setCreateAsset(false);
      setAssetKategori('Produksi');
      setAssetKritikalitas('medium');
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
  const calculateNextDate = (
    lastDateStr: string | undefined, 
    freq: PreventiveMaintenance['frekuensi'] | undefined, 
    intervalValue?: number,
    intervalUnit?: PreventiveMaintenance['customIntervalUnit']
  ) => {
    if (!lastDateStr) return '';
    const d = new Date(lastDateStr);
    if (isNaN(d.getTime())) return '';
    if (!freq || freq === 'none') return '';
    
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
      case 'custom': {
        const val = intervalValue || 30;
        const unit = intervalUnit || 'hari';
        if (unit === 'hari') {
          d.setDate(d.getDate() + val);
        } else if (unit === 'minggu') {
          d.setDate(d.getDate() + val * 7);
        } else if (unit === 'bulan') {
          d.setMonth(d.getMonth() + val);
        } else if (unit === 'tahun') {
          d.setFullYear(d.getFullYear() + val);
        }
        break;
      }
    }
    return d.toISOString().split('T')[0];
  };

  const formatReading = (val: number | undefined, mode: 'kilometer' | 'runhour' | 'cycles' | undefined) => {
    if (val === undefined) return '0';
    if (mode === 'runhour') {
      return val.toLocaleString('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    return val.toLocaleString('id-ID');
  };

  const handleLastDateChange = (dateVal: string) => {
    setTanggalTerakhir(dateVal);
    if (dateVal) {
      const calculated = calculateNextDate(dateVal, frekuensi, hariInterval, customIntervalUnit);
      setTanggalBerikutnya(calculated);
    }
  };

  const generateAutoWR = async (pm: PreventiveMaintenance) => {
    const wrId = 'WR-' + Date.now();
    const nomorWR = await generateWRNumber('MTC', pm.companyId || 'default');
    
    const isVeh = pm.isVehicle;
    const trackingLabel = pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH';
    
    const masalah = isVeh
      ? `[TUNE UP VEHICLE DUE] Pemakaian kendaraan ${pm.namaAlat} telah mencapai target service (${formatReading(pm.vehicleTargetReading, pm.vehicleTrackingMode)} ${trackingLabel}). ${pm.deskripsi || ''}`
      : `[PREVENTIVE MAINTENANCE DUE] Pengecekan rutin terjadwal (${pm.frekuensi === 'custom' ? `Tiap ${pm.hariInterval || 30} ${pm.customIntervalUnit || 'hari'}` : pm.frekuensi}) untuk alat: ${pm.namaAlat}. ${pm.deskripsi || ''}`;
      
    const tindakan = isVeh
      ? `Lakukan tune up dan perawatan berkala kendaraan (ganti oli mesin, filter, tune up, cek busi/injektor, rem, dll).`
      : `Lakukan checklist standar maintenance preventif dan verifikasi operasi mesin.`;

    const newWR: WorkRequest = {
      id: wrId,
      nomorWR,
      masalah,
      tindakan,
      namaPengaju: isVeh ? 'Sistem PM Otomatis (Vehicle)' : 'Sistem PM Otomatis',
      tanggalArea: pm.lokasi || (isVeh ? 'Pool Kendaraan' : 'Lokasi Terdaftar'),
      namaMesin: pm.namaAlat,
      tanggalPengajuan: getLocalDateString(),
      divisiPengaju: 'MTC',
      status: 'pending',
      prioritas: 'sedang',
      tujuan: 'perawatan',
      tindakanMaintenance: 'sendiri',
      createdAt: new Date().toISOString(),
      companyId: pm.companyId,
      cabangId: pm.cabangId
    };

    // Save WR to Firestore with cleanObject
    await setDoc(doc(db, 'work_requests', wrId), cleanObject(newWR));
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
          const nextDate = calculateNextDate(pm.tanggalBerikutnyaPengecekan, pm.frekuensi, pm.hariInterval, pm.customIntervalUnit);
          await updateDoc(doc(db, 'preventive_maintenance', pm.id), cleanObject({
            tanggalTerakhirPengecekan: pm.tanggalBerikutnyaPengecekan || getLocalDateString(),
            tanggalBerikutnyaPengecekan: nextDate || undefined
          }));

          alert(`Work Request (WR) berhasil diterbitkan untuk alat: ${pm.namaAlat}.`);
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

  const handleUpdateVehicleReading = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPmForReading) return;
    
    const newVal = Number(newReadingValue);
    if (isNaN(newVal) || newVal < 0) {
      alert('Masukkan nilai yang valid dan positif.');
      return;
    }

    if (selectedPmForReading.vehicleLastReading !== undefined && newVal < selectedPmForReading.vehicleLastReading) {
      if (!window.confirm(`Nilai baru (${newVal}) lebih kecil dari nilai terakhir (${selectedPmForReading.vehicleLastReading}). Anda yakin?`)) {
        return;
      }
    }

    try {
      const history = selectedPmForReading.vehicleReadingHistory || [];
      const newEntry = {
        id: 'VR-' + Date.now(),
        tanggal: getLocalDateString(),
        nilai: newVal,
        petugas: currentUser.name || currentUser.username
      };
      
      const updatedHistory = [newEntry, ...history];

      // Check if it triggers due state
      const targetReading = selectedPmForReading.vehicleTargetReading || 0;
      const isNowDue = newVal >= targetReading;
      
      const updateData: Partial<PreventiveMaintenance> = {
        vehicleLastReading: newVal,
        vehicleReadingHistory: updatedHistory
      };

      await updateDoc(doc(db, 'preventive_maintenance', selectedPmForReading.id), cleanObject(updateData));

      if (isNowDue && selectedPmForReading.otomatisWR && selectedPmForReading.status === 'aktif') {
        const wrId = 'WR-' + Date.now();
        const nomorWR = await generateWRNumber('MTC', selectedPmForReading.companyId || 'default');
        
        const trackingLabel = selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : 'Run Hour';
        const problemDescription = `[TUNE UP VEHICLE DUE] Pemakaian kendaraan ${selectedPmForReading.namaAlat} telah mencapai ${newVal} ${trackingLabel} (Target: ${targetReading} ${trackingLabel}). ${selectedPmForReading.deskripsi || ''}`;
        
        const newWR: WorkRequest = {
          id: wrId,
          nomorWR,
          masalah: problemDescription,
          tindakan: `Lakukan tune up dan perawatan berkala kendaraan (ganti oli mesin, filter, tune up, cek busi/injektor, rem, dll).`,
          namaPengaju: 'Sistem PM Otomatis (Vehicle)',
          tanggalArea: selectedPmForReading.lokasi || 'Pool Kendaraan',
          namaMesin: selectedPmForReading.namaAlat,
          tanggalPengajuan: getLocalDateString(),
          divisiPengaju: 'MTC',
          status: 'pending',
          prioritas: 'sedang',
          tujuan: 'perawatan',
          tindakanMaintenance: 'sendiri',
          createdAt: new Date().toISOString(),
          companyId: selectedPmForReading.companyId,
          cabangId: selectedPmForReading.cabangId
        };

        await setDoc(doc(db, 'work_requests', wrId), cleanObject(newWR));

        // Calculate next target reading
        const interval = selectedPmForReading.vehicleIntervalReading || 5000;
        const nextTarget = newVal + interval;
        await updateDoc(doc(db, 'preventive_maintenance', selectedPmForReading.id), cleanObject({
          vehicleTargetReading: nextTarget,
          tanggalTerakhirPengecekan: getLocalDateString(),
          tanggalBerikutnyaPengecekan: calculateNextDate(getLocalDateString(), selectedPmForReading.frekuensi, selectedPmForReading.hariInterval, selectedPmForReading.customIntervalUnit) || undefined
        }));

        alert(`Nilai diperbarui! Pemakaian mencapai target ${targetReading} ${trackingLabel}.\n\nWork Request (WR) ${nomorWR} untuk TUNE UP telah diterbitkan otomatis, dan target pemeliharaan berikutnya diperbarui ke ${nextTarget} ${trackingLabel}.`);
      } else {
        alert('Nilai pemakaian berkala berhasil disimpan!');
      }

      setSelectedPmForReading(null);
      setNewReadingValue('');
      onRefresh();
    } catch (err) {
      console.error('Error updating vehicle reading:', err);
      alert('Gagal mengupdate pemakaian.');
    }
  };

  const getChartData = () => {
    if (!selectedPmForReading || !selectedPmForReading.vehicleReadingHistory) return [];
    
    // Sort reading history chronologically (ascending date)
    const sortedHistory = [...selectedPmForReading.vehicleReadingHistory].sort(
      (a, b) => new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime()
    );

    // Calculate incremental usage
    const historyWithUsage = sortedHistory.map((item, index) => {
      const prevVal = index > 0 ? sortedHistory[index - 1].nilai : item.nilai;
      const usage = Math.max(0, item.nilai - prevVal);
      return {
        ...item,
        usage,
      };
    });

    const groups: { [key: string]: { usage: number; cumulative: number; key: string; label: string } } = {};

    historyWithUsage.forEach(item => {
      if (!item.tanggal) return;
      let key = '';
      let label = '';
      if (historyChartFilter === 'hari') {
        key = item.tanggal; // YYYY-MM-DD
        // Format to readable DD/MM
        const parts = item.tanggal.split('-');
        label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : item.tanggal;
      } else if (historyChartFilter === 'bulan') {
        key = item.tanggal.substring(0, 7); // YYYY-MM
        const parts = key.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const mIdx = parseInt(parts[1], 10) - 1;
        label = parts.length === 2 && mIdx >= 0 && mIdx < 12 ? `${months[mIdx]} ${parts[0].substring(2)}` : key;
      } else {
        key = item.tanggal.substring(0, 4); // YYYY
        label = key;
      }

      if (!groups[key]) {
        groups[key] = { usage: 0, cumulative: 0, key, label };
      }
      groups[key].usage += item.usage;
      groups[key].cumulative = item.nilai;
    });

    return Object.values(groups).sort((a, b) => a.key.localeCompare(b.key));
  };

  const filteredPM = pmSchedules.filter(pm => {
    const matchesSearch = pm.namaAlat.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (pm.kodeAlat && pm.kodeAlat.toLowerCase().includes(searchQuery.toLowerCase())) ||
                          (pm.lokasi && pm.lokasi.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFreq = filterFrequency === 'all' || pm.frekuensi === filterFrequency;
    return matchesSearch && matchesFreq;
  });

  const filteredAssetsForSuggestions = namaAlat.trim() === '' 
    ? assets 
    : assets.filter(asset => 
        asset.name.toLowerCase().includes(namaAlat.toLowerCase()) ||
        (asset.code && asset.code.toLowerCase().includes(namaAlat.toLowerCase()))
      );

  const filteredAssetsForEditSuggestions = editNamaAlat.trim() === '' 
    ? assets 
    : assets.filter(asset => 
        asset.name.toLowerCase().includes(editNamaAlat.toLowerCase()) ||
        (asset.code && asset.code.toLowerCase().includes(editNamaAlat.toLowerCase()))
      );

  const isAssetRegisteredAdd = assets.some(a => a.name.toLowerCase() === namaAlat.trim().toLowerCase());
  const isAssetRegisteredEdit = assets.some(a => a.name.toLowerCase() === editNamaAlat.trim().toLowerCase());

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
        {canManagePMAssets && (
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
      {showAddForm && canManagePMAssets && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6 animate-fadeIn" id="pm-add-form-container">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Pendaftaran Asset & Penjadwalan PM Baru
            </h3>
            <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600">
              {isAdmin ? 'ROLE ADMINISTRATOR' : 'IZIN PENGELOLA PM'}
            </span>
          </div>

          <form onSubmit={handleAddPM} className="grid grid-cols-1 md:grid-cols-2 gap-5" id="pm-creation-form">
            <div className="space-y-4">
              <div className="relative">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nama Alat / Asset Mesin *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Chiller Utama, Motor Pump 03, Blower Exhaust"
                  value={namaAlat}
                  onChange={(e) => {
                    setNamaAlat(e.target.value);
                    setShowAssetSuggestions(true);
                  }}
                  onFocus={() => setShowAssetSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowAssetSuggestions(false), 200)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
                
                {showAssetSuggestions && filteredAssetsForSuggestions.length > 0 && (
                  <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-[100] divide-y divide-slate-100">
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50">
                      Rekomendasi Asset Terdaftar:
                    </div>
                    {filteredAssetsForSuggestions.map((asset) => (
                      <button
                        key={asset.id}
                        type="button"
                        onMouseDown={() => {
                          setNamaAlat(asset.name);
                          setKodeAlat(asset.code || '');
                          setLokasi(asset.location || '');
                          setShowAssetSuggestions(false);
                        }}
                        className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition flex flex-col gap-0.5 cursor-pointer"
                      >
                        <span className="text-xs font-bold text-slate-800">{asset.name}</span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400">
                          <span className="font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">{asset.code || '-'}</span>
                          <span>•</span>
                          <span>{asset.location || 'Tanpa Lokasi'}</span>
                          <span>•</span>
                          <span className="capitalize">{asset.category || 'Umum'}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
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

              {/* Jadikan Asset Toggle */}
              {!isAssetRegisteredAdd && (
                <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                        <FolderPlus className="w-4 h-4 text-emerald-600" />
                        Jadikan Asset
                      </span>
                      <span className="text-[10px] text-emerald-600 mt-0.5 block leading-relaxed">
                        Aktifkan untuk menambahkan alat ini ke dalam daftar Master Asset secara otomatis.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={createAsset}
                        onChange={(e) => setCreateAsset(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>

                  {createAsset && (
                    <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-emerald-200/50">
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Kategori Asset *</label>
                        <select
                          value={assetKategori}
                          onChange={(e) => setAssetKategori(e.target.value)}
                          className="block w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 transition"
                        >
                          <option value="Produksi">Produksi</option>
                          <option value="Kelistrikan">Kelistrikan</option>
                          <option value="Utilitas">Utilitas</option>
                          <option value="Sarana">Sarana</option>
                          <option value="IT">IT</option>
                          <option value="Lainnya">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Kritikalitas *</label>
                        <select
                          value={assetKritikalitas}
                          onChange={(e) => setAssetKritikalitas(e.target.value as any)}
                          className="block w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 transition"
                        >
                          <option value="low">Low (Rendah)</option>
                          <option value="medium">Medium (Sedang)</option>
                          <option value="high">High (Tinggi)</option>
                          <option value="critical">Critical (Kritis)</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Vehicle Toggle */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    <Activity className="w-4 h-4 text-indigo-600 animate-pulse" />
                    Jadwal Berbasis Pemakaian / Sensor (Usage Metric / Vehicle)?
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">
                    Aktifkan jika aset membutuhkan monitoring berbasis pemakaian seperti jam kerja (Run Hour), siklus mesin (Cycles), atau kilometer kendaraan.
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isVehicle}
                    onChange={(e) => {
                      setIsVehicle(e.target.checked);
                      if (e.target.checked) {
                        // Default to 6 months next check date
                        if (!tanggalBerikutnya) {
                          setTanggalBerikutnya(new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0]);
                        }
                      }
                    }}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {isVehicle && (
                <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-4 animate-fadeIn">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1">
                    <Settings className="w-3.5 h-3.5 text-amber-600" />
                    Konfigurasi Monitoring Berbasis Pemakaian (Usage Metric)
                  </h4>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">Metode Monitoring *</label>
                      <select
                        value={vehicleTrackingMode}
                        onChange={(e) => {
                          const val = e.target.value as 'kilometer' | 'runhour' | 'cycles';
                          setVehicleTrackingMode(val);
                          // Set sensible defaults based on selection
                          if (val === 'kilometer') {
                            setVehicleIntervalReading(5000);
                            setVehicleTargetReading(vehicleLastReading + 5000);
                          } else if (val === 'runhour') {
                            setVehicleIntervalReading(500);
                            setVehicleTargetReading(vehicleLastReading + 500);
                          } else {
                            setVehicleIntervalReading(1000);
                            setVehicleTargetReading(vehicleLastReading + 1000);
                          }
                        }}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                      >
                        <option value="runhour">Per Jam Kerja / Run Hour (RH) [e.g. Tiap 500 Jam]</option>
                        <option value="cycles">Per Siklus Mesin / Cycles [e.g. Tiap 1000 Siklus]</option>
                        <option value="kilometer">Per Kilometer Kendaraan (KM)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        {vehicleTrackingMode === 'kilometer' ? 'Kilometer Terakhir' : vehicleTrackingMode === 'runhour' ? 'Jam Kerja Terakhir (RH)' : 'Siklus Terakhir (Cycles)'} *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={vehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                        required
                        value={vehicleLastReading}
                        onChange={(e) => {
                          const last = Number(e.target.value);
                          setVehicleLastReading(last);
                          setVehicleTargetReading(Number((last + vehicleIntervalReading).toFixed(2)));
                        }}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Interval Service ({vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'})
                      </label>
                      <input
                        type="number"
                        min="0.01"
                        step={vehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                        required
                        value={vehicleIntervalReading}
                        onChange={(e) => {
                          const interval = Number(e.target.value);
                          setVehicleIntervalReading(interval);
                          setVehicleTargetReading(Number((vehicleLastReading + interval).toFixed(2)));
                        }}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Target Berikutnya ({vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'})
                      </label>
                      <input
                        type="number"
                        min="0"
                        step={vehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                        required
                        value={vehicleTargetReading}
                        onChange={(e) => setVehicleTargetReading(Number(Number(e.target.value).toFixed(2)))}
                        className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Frekuensi Pengecekan {isVehicle ? '(Opsional)' : '*'}
                  </label>
                  <select
                    value={frekuensi}
                    onChange={(e) => {
                      const val = e.target.value as any;
                      setFrekuensi(val);
                      if (tanggalTerakhir) {
                        setTanggalBerikutnya(calculateNextDate(tanggalTerakhir, val, hariInterval, customIntervalUnit));
                      }
                    }}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                  >
                    {isVehicle && <option value="none">Tidak Ada (Hanya Berdasarkan Pemakaian)</option>}
                    <option value="harian">Harian (Setiap Hari)</option>
                    <option value="mingguan">Mingguan (Tiap Minggu)</option>
                    <option value="bulanan">Bulanan (Tiap Bulan)</option>
                    <option value="tahunan">Tahunan (Tiap Tahun)</option>
                    <option value="custom">Custom (Pilihan Interval)</option>
                  </select>
                </div>

                {frekuensi === 'custom' && (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Interval</label>
                      <input
                        type="number"
                        min="1"
                        value={hariInterval}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          setHariInterval(val);
                          if (tanggalTerakhir) {
                            setTanggalBerikutnya(calculateNextDate(tanggalTerakhir, 'custom', val, customIntervalUnit));
                          }
                        }}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Satuan</label>
                      <select
                        value={customIntervalUnit}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setCustomIntervalUnit(val);
                          if (tanggalTerakhir) {
                            setTanggalBerikutnya(calculateNextDate(tanggalTerakhir, 'custom', hariInterval, val));
                          }
                        }}
                        className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                      >
                        <option value="hari">Hari</option>
                        <option value="minggu">Minggu</option>
                        <option value="bulan">Bulan</option>
                        <option value="tahun">Tahun</option>
                      </select>
                    </div>
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
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    Tanggal Berikutnya {isVehicle ? '(Opsional)' : '*'}
                  </label>
                  <input
                    type="date"
                    required={!isVehicle}
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
            const isDateDue = pm.tanggalBerikutnyaPengecekan ? pm.tanggalBerikutnyaPengecekan <= today : false;
            const isReadingDue = pm.isVehicle && pm.vehicleLastReading !== undefined && pm.vehicleTargetReading !== undefined && pm.vehicleLastReading >= pm.vehicleTargetReading;
            const isDue = isDateDue || isReadingDue;
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
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold font-mono text-slate-400 block uppercase">{pm.kodeAlat || pm.id}</span>
                        {pm.isVehicle && (
                          <span className="bg-amber-100 text-amber-800 text-[9px] font-extrabold px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Car className="w-2.5 h-2.5" /> VEHICLE
                          </span>
                        )}
                      </div>
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

                  {/* Vehicle statistics panel */}
                  {pm.isVehicle && (
                    <div className="bg-amber-50/50 border border-amber-200/80 p-3 rounded-xl space-y-2 text-slate-800">
                      <div className="flex justify-between items-center text-[10px] font-bold text-amber-900 uppercase">
                        <span className="flex items-center gap-1">
                          <Gauge className="w-3.5 h-3.5 text-amber-700" />
                          Pemakaian ({pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'Run Hour'})
                        </span>
                        {canInputReading && (
                          <button
                            onClick={() => {
                              setSelectedPmForReading(pm);
                              setNewReadingValue(pm.vehicleLastReading?.toString() || '0');
                              setShowReadingHistory(false);
                            }}
                            className="bg-amber-600 hover:bg-amber-700 text-white px-2 py-1 rounded font-extrabold text-[9px] uppercase tracking-wider transition cursor-pointer"
                          >
                            Isi Terakhir
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-medium text-slate-700">
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-bold">Terakhir</span>
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            {formatReading(pm.vehicleLastReading, pm.vehicleTrackingMode)} {pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] text-slate-400 block uppercase font-bold font-mono">Target Service</span>
                          <span className="font-mono text-xs font-extrabold text-slate-900">
                            {formatReading(pm.vehicleTargetReading, pm.vehicleTrackingMode)} {pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'}
                          </span>
                        </div>
                      </div>

                      {pm.vehicleTargetReading && pm.vehicleLastReading !== undefined && (() => {
                        const sisa = Math.max(0, pm.vehicleTargetReading - pm.vehicleLastReading);
                        const interval = pm.vehicleIntervalReading || (pm.vehicleTrackingMode === 'runhour' ? 250 : 5000);
                        const sisaPercent = Math.min(100, Math.max(0, (sisa / interval) * 100));
                        return (
                          <div className="space-y-1">
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/50">
                              <div 
                                className={`h-full rounded-full transition-all duration-300 ${isReadingDue || sisaPercent <= 10 ? 'bg-rose-500' : sisaPercent <= 30 ? 'bg-amber-500' : 'bg-indigo-600'}`}
                                style={{ width: `${sisaPercent}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[9px] text-slate-500 font-bold font-mono">
                              <span className="text-amber-800">Sisa: {formatReading(sisa, pm.vehicleTrackingMode)} {pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'}</span>
                              <span className={isReadingDue || sisaPercent <= 10 ? 'text-rose-600 font-extrabold animate-pulse' : sisaPercent <= 30 ? 'text-amber-600' : 'text-indigo-600'}>
                                {Math.round(sisaPercent)}%
                              </span>
                            </div>
                          </div>
                        );
                      })()}

                      {pm.vehicleReadingHistory && pm.vehicleReadingHistory.length > 0 && (
                        <button
                          onClick={() => {
                            setSelectedPmForReading(pm);
                            setShowReadingHistory(true);
                          }}
                          className="text-[9px] text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 underline transition cursor-pointer mt-1"
                        >
                          <History className="w-3.5 h-3.5 text-indigo-500" /> Lihat Riwayat Pemakaian
                        </button>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-150 text-[11px]">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">Terakhir Dicek</span>
                      <span className="font-semibold text-slate-700 block mt-0.5">{pm.tanggalTerakhirPengecekan || '-'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-bold">Jatuh Tempo</span>
                      <span className={`font-extrabold block mt-0.5 ${isDateDue && isScheduleActive ? 'text-rose-600 animate-pulse' : 'text-slate-700'}`}>
                        {pm.tanggalBerikutnyaPengecekan}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 pt-1">
                    <span className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded font-bold uppercase">
                      {pm.frekuensi === 'custom' 
                        ? `Tiap ${pm.hariInterval || 30} ${pm.customIntervalUnit || 'hari'}` 
                        : (pm.frekuensi === 'none' ? 'Hanya Pemakaian' : pm.frekuensi)}
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

                  {isDateDue && isScheduleActive && (
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-rose-900 font-medium">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">JADWAL TELAH JATUH TEMPO (TANGGAL)!</span> Alat ini memerlukan pengecekan mendesak.
                      </div>
                    </div>
                  )}

                  {isReadingDue && isScheduleActive && (
                    <div className="bg-rose-50 border border-rose-200 p-2.5 rounded-lg flex items-start gap-2 text-[10px] text-rose-900 font-medium animate-pulse">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">JATUH TEMPO BATAS PEMAKAIAN!</span> {`Kendaraan memerlukan service (Pemakaian ${formatReading(pm.vehicleLastReading, pm.vehicleTrackingMode)} >= Target ${formatReading(pm.vehicleTargetReading, pm.vehicleTrackingMode)}).`}
                      </div>
                    </div>
                  )}
                </div>

                 <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex gap-2">
                    {canManagePMAssets && (
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

                  <div className="flex items-center gap-1">
                    {isAdmin && (
                      <button
                        onClick={() => handleStartEdit(pm)}
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition border border-transparent hover:border-indigo-100 cursor-pointer"
                        title="Ubah / Edit Aset"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {canManagePMAssets && (
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
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Update Reading / Log Berkala */}
      {selectedPmForReading && !showReadingHistory && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto animate-fadeIn transition-all duration-200" 
          id="modal-update-reading-overlay"
          onClick={() => setSelectedPmForReading(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md my-4 sm:my-8 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Gauge className="w-4 h-4 text-indigo-600" />
                  Update Pemakaian Berkala
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Aset: {selectedPmForReading.namaAlat}
                </p>
              </div>
              <button 
                onClick={() => setSelectedPmForReading(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateVehicleReading} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                  Nilai {selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'Kilometer' : 'Run Hour'} Terakhir *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="0"
                    step={selectedPmForReading.vehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                    placeholder="Masukkan nilai saat ini..."
                    value={newReadingValue}
                    onChange={(e) => setNewReadingValue(e.target.value)}
                    className="block w-full pl-3 pr-16 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-sm focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono"
                  />
                  <span className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-xs font-bold text-slate-400 pointer-events-none uppercase font-mono">
                    {selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : selectedPmForReading.vehicleTrackingMode === 'runhour' ? 'RH' : 'Cycles'}
                  </span>
                </div>
                 <span className="text-[10px] text-slate-500 mt-1.5 block">
                  Nilai sebelumnya: <strong className="text-slate-700 font-mono">{formatReading(selectedPmForReading.vehicleLastReading, selectedPmForReading.vehicleTrackingMode)}</strong>. Target service berikutnya: <strong className="text-indigo-600 font-mono">{formatReading(selectedPmForReading.vehicleTargetReading, selectedPmForReading.vehicleTrackingMode)}</strong>.
                </span>
              </div>

              <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100 text-[10px] text-slate-600 space-y-1">
                <span className="font-extrabold text-indigo-950 block">💡 Informasi Alur</span>
                <p className="leading-relaxed">
                  Jika nilai baru mencapai atau melampaui target <strong className="font-mono">{formatReading(selectedPmForReading.vehicleTargetReading, selectedPmForReading.vehicleTrackingMode)} {selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : selectedPmForReading.vehicleTrackingMode === 'runhour' ? 'RH' : 'Cycles'}</strong>, sistem otomatis akan menerbitkan lembar <strong>Work Request (WR)</strong> atau <strong>Work Order (WO)</strong> perawatan untuk alat ini dan memajukan target sejauh <strong className="font-mono">+{formatReading(selectedPmForReading.vehicleIntervalReading, selectedPmForReading.vehicleTrackingMode)} {selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : selectedPmForReading.vehicleTrackingMode === 'runhour' ? 'RH' : 'Cycles'}</strong>.
                </p>
              </div>

              <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => setSelectedPmForReading(null)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer"
                >
                  Simpan Pemakaian
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Lihat Riwayat Pemakaian */}
      {selectedPmForReading && showReadingHistory && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto animate-fadeIn transition-all duration-200" 
          id="modal-reading-history-overlay"
          onClick={() => {
            setSelectedPmForReading(null);
            setShowReadingHistory(false);
          }}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-4xl my-4 sm:my-8 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <History className="w-4 h-4 text-indigo-600" />
                  Riwayat Pemakaian Berkala (Vehicle)
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  Aset: <strong className="text-slate-700">{selectedPmForReading.namaAlat}</strong> ({selectedPmForReading.kodeAlat || selectedPmForReading.id})
                </p>
              </div>
              <button 
                onClick={() => {
                  setSelectedPmForReading(null);
                  setShowReadingHistory(false);
                }}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
              {/* TWO PANEL GRID */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* PANEL 1: CHART OF VEHICLE USAGE */}
                <div className="space-y-4 bg-slate-50/50 p-4 rounded-xl border border-slate-200">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                        <Activity className="w-3.5 h-3.5 text-indigo-500" />
                        Grafik Naik Turun Penggunaan
                      </h4>
                      <p className="text-[10px] text-slate-500">Pemakaian baru per periode ({selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'})</p>
                    </div>
                    {/* FILTER TOGGLES */}
                    <div className="flex bg-slate-200/60 p-1 rounded-lg self-start sm:self-auto border border-slate-200">
                      {(['hari', 'bulan', 'tahun'] as const).map((filter) => (
                        <button
                          key={filter}
                          type="button"
                          onClick={() => setHistoryChartFilter(filter)}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md capitalize transition-all cursor-pointer ${
                            historyChartFilter === filter
                              ? 'bg-indigo-600 text-white shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/40'
                          }`}
                        >
                          {filter === 'hari' ? 'Hari' : filter === 'bulan' ? 'Bulan' : 'Tahun'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* CHART CONTAINER */}
                  <div className="h-[220px] w-full pt-2">
                    {(() => {
                      const chartData = getChartData();
                      if (chartData.length === 0) {
                        return (
                          <div className="h-full flex flex-col items-center justify-center text-slate-400 text-xs gap-1 font-mono">
                            <Activity className="w-6 h-6 text-slate-300 animate-pulse" />
                            <span>Tidak ada data grafik pemakaian</span>
                          </div>
                        );
                      }
                      const trackingMode = selectedPmForReading.vehicleTrackingMode;
                      const trackingLabel = trackingMode === 'kilometer' ? 'KM' : 'RH';
                      return (
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 5 }}>
                            <defs>
                              <linearGradient id="colorUsage" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2}/>
                                <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                            <XAxis 
                              dataKey="label" 
                              stroke="#64748b" 
                              fontSize={9} 
                              tickLine={false} 
                              axisLine={{ stroke: '#cbd5e1' }}
                            />
                            <YAxis 
                              stroke="#64748b" 
                              fontSize={9} 
                              tickLine={false} 
                              axisLine={{ stroke: '#cbd5e1' }}
                              tickFormatter={(v) => formatReading(v, trackingMode)}
                            />
                            <Tooltip
                              content={({ active, payload }) => {
                                if (active && payload && payload.length) {
                                  const data = payload[0].payload;
                                  return (
                                    <div className="bg-white p-2.5 border border-slate-200 rounded-lg shadow-md text-[10px] space-y-1">
                                      <p className="font-bold text-slate-800">{data.key}</p>
                                      <p className="text-indigo-600 font-semibold">
                                        Pemakaian: {formatReading(data.usage, trackingMode)} {trackingLabel}
                                      </p>
                                      <p className="text-slate-500">
                                        Odometer: {formatReading(data.cumulative, trackingMode)} {trackingLabel}
                                      </p>
                                    </div>
                                  );
                                }
                                return null;
                              }}
                            />
                            <Area 
                              type="monotone" 
                              dataKey="usage" 
                              stroke="#4f46e5" 
                              strokeWidth={2}
                              fillOpacity={1} 
                              fill="url(#colorUsage)" 
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      );
                    })()}
                  </div>
                </div>

                {/* PANEL 2: HISTORY LOGS LIST */}
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-indigo-500" />
                    Log Riwayat Pembacaan
                  </h4>
                  <div className="max-h-[260px] overflow-y-auto border border-slate-150 rounded-xl divide-y divide-slate-100 bg-slate-50/30">
                    {!selectedPmForReading.vehicleReadingHistory || selectedPmForReading.vehicleReadingHistory.length === 0 ? (
                      <div className="p-8 text-center text-slate-400 text-xs">
                        Belum ada riwayat pemakaian tercatat.
                      </div>
                    ) : (
                      selectedPmForReading.vehicleReadingHistory.map((item, idx) => (
                        <div key={item.id || idx} className="p-3 flex justify-between items-center text-xs hover:bg-slate-50">
                          <div className="space-y-0.5">
                            <span className="font-bold text-slate-800 font-mono text-sm">
                              {formatReading(item.nilai, selectedPmForReading.vehicleTrackingMode)} <span className="text-[10px] font-normal text-slate-400 uppercase font-sans">{selectedPmForReading.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'}</span>
                            </span>
                            <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                              <span>Oleh: {item.petugas || 'Sistem'}</span>
                            </div>
                          </div>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-100 border border-slate-200 px-2 py-0.5 rounded">
                            {item.tanggal}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>

              <div className="flex justify-end border-t border-slate-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPmForReading(null);
                    setShowReadingHistory(false);
                  }}
                  className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Tutup
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Edit / Ubah Aset PM */}
      {editingPm && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-start sm:items-center justify-center p-2 sm:p-4 z-[100] overflow-y-auto animate-fadeIn transition-all duration-200" 
          id="modal-edit-pm-overlay"
          onClick={() => setEditingPm(null)}
        >
          <div 
            className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl my-4 sm:my-8 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[85vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-50 border-b border-slate-100 px-6 py-4 flex justify-between items-center shrink-0">
              <div>
                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1.5">
                  <Pencil className="w-4 h-4 text-indigo-600" />
                  Ubah / Edit Aset & Penjadwalan PM
                </h3>
                <p className="text-[10px] text-slate-500 font-medium mt-0.5">
                  ID Aset: {editingPm.id}
                </p>
              </div>
              <button 
                onClick={() => setEditingPm(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                title="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdatePM} className="flex-1 overflow-y-auto p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-4">
                  <div className="relative">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nama Alat / Asset Mesin *</label>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: Chiller Utama, Motor Pump 03"
                      value={editNamaAlat}
                      onChange={(e) => {
                        setEditNamaAlat(e.target.value);
                        setShowEditAssetSuggestions(true);
                      }}
                      onFocus={() => setShowEditAssetSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowEditAssetSuggestions(false), 200)}
                      className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                    />

                    {showEditAssetSuggestions && filteredAssetsForEditSuggestions.length > 0 && (
                      <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-[100] divide-y divide-slate-100">
                        <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-400 bg-slate-50">
                          Rekomendasi Asset Terdaftar:
                        </div>
                        {filteredAssetsForEditSuggestions.map((asset) => (
                          <button
                            key={asset.id}
                            type="button"
                            onMouseDown={() => {
                              setEditNamaAlat(asset.name);
                              setEditKodeAlat(asset.code || '');
                              setEditLokasi(asset.location || '');
                              setShowEditAssetSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-indigo-50 transition flex flex-col gap-0.5 cursor-pointer"
                          >
                            <span className="text-xs font-bold text-slate-800">{asset.name}</span>
                            <div className="flex items-center gap-2 text-[10px] text-slate-400">
                              <span className="font-mono bg-slate-100 px-1 py-0.2 rounded border border-slate-200">{asset.code || '-'}</span>
                              <span>•</span>
                              <span>{asset.location || 'Tanpa Lokasi'}</span>
                              <span>•</span>
                              <span className="capitalize">{asset.category || 'Umum'}</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Kode Alat (ID Aset)</label>
                      <input
                        type="text"
                        placeholder="MTC-CHL-001"
                        value={editKodeAlat}
                        onChange={(e) => setEditKodeAlat(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Area / Lokasi Kerja</label>
                      <input
                        type="text"
                        placeholder="Gedung A Lantai 2"
                        value={editLokasi}
                        onChange={(e) => setEditLokasi(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Deskripsi Instruksi Pengecekan</label>
                    <textarea
                      rows={3}
                      placeholder="Instruksi checklist..."
                      value={editDeskripsi}
                      onChange={(e) => setEditDeskripsi(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                    />
                  </div>

                  {/* Jadikan Asset Toggle for Edit */}
                  {!isAssetRegisteredEdit && (
                    <div className="bg-emerald-50/50 p-4 rounded-xl border border-emerald-100 flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs font-extrabold text-emerald-800 flex items-center gap-1.5">
                            <FolderPlus className="w-4 h-4 text-emerald-600" />
                            Jadikan Asset
                          </span>
                          <span className="text-[10px] text-emerald-600 mt-0.5 block leading-relaxed">
                            Aktifkan untuk menambahkan alat ini ke dalam daftar Master Asset secara otomatis.
                          </span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={editCreateAsset}
                            onChange={(e) => setEditCreateAsset(e.target.checked)}
                            className="sr-only peer"
                          />
                          <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                        </label>
                      </div>

                      {editCreateAsset && (
                        <div className="grid grid-cols-2 gap-4 mt-2 pt-3 border-t border-emerald-200/50">
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Kategori Asset *</label>
                            <select
                              value={editAssetKategori}
                              onChange={(e) => setEditAssetKategori(e.target.value)}
                              className="block w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 transition"
                            >
                              <option value="Produksi">Produksi</option>
                              <option value="Kelistrikan">Kelistrikan</option>
                              <option value="Utilitas">Utilitas</option>
                              <option value="Sarana">Sarana</option>
                              <option value="IT">IT</option>
                              <option value="Lainnya">Lainnya</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-[10px] font-bold text-emerald-800 uppercase tracking-wider mb-1.5">Kritikalitas *</label>
                            <select
                              value={editAssetKritikalitas}
                              onChange={(e) => setEditAssetKritikalitas(e.target.value as any)}
                              className="block w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 transition"
                            >
                              <option value="low">Low (Rendah)</option>
                              <option value="medium">Medium (Sedang)</option>
                              <option value="high">High (Tinggi)</option>
                              <option value="critical">Critical (Kritis)</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Vehicle Toggle in Edit */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                        <Car className="w-4 h-4 text-indigo-600" />
                        Aset Kendaraan (Vehicle)?
                      </span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">
                        Centang jika aset ini bermesin dan memiliki monitoring KM/RH.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editIsVehicle}
                        onChange={(e) => {
                          setEditIsVehicle(e.target.checked);
                          if (e.target.checked && !editTanggalBerikutnya) {
                            setEditTanggalBerikutnya(new Date(Date.now() + 180*24*60*60*1000).toISOString().split('T')[0]);
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {editIsVehicle && (
                    <div className="p-4 bg-amber-50/60 rounded-xl border border-amber-200/80 space-y-4 animate-fadeIn">
                      <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1">
                        <Settings className="w-3.5 h-3.5 text-amber-600" />
                        Konfigurasi Pemakaian Kendaraan
                      </h4>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-medium">Metode Monitoring *</label>
                          <select
                            value={editVehicleTrackingMode}
                            onChange={(e) => {
                              const val = e.target.value as 'kilometer' | 'runhour';
                              setEditVehicleTrackingMode(val);
                            }}
                            className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                          >
                            <option value="kilometer">Per Kilometer (KM)</option>
                            <option value="runhour">Per Run Hour (RH)</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2 font-mono">
                            Interval ({editVehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'})
                          </label>
                          <input
                            type="number"
                            min="1"
                            step={editVehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                            required
                            value={editVehicleIntervalReading}
                            onChange={(e) => setEditVehicleIntervalReading(Number(e.target.value))}
                            className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition font-mono"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                          Target Berikutnya ({editVehicleTrackingMode === 'kilometer' ? 'KM' : 'RH'})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step={editVehicleTrackingMode === 'runhour' ? '0.01' : '1'}
                          required
                          value={editVehicleTargetReading}
                          onChange={(e) => setEditVehicleTargetReading(Number(Number(e.target.value).toFixed(2)))}
                          className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 transition font-mono"
                        />
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Frekuensi {editIsVehicle ? '(Opsional)' : '*'}
                      </label>
                      <select
                        value={editFrekuensi}
                        onChange={(e) => {
                          const val = e.target.value as any;
                          setEditFrekuensi(val);
                          if (editTanggalTerakhir) {
                            setEditTanggalBerikutnya(calculateNextDate(editTanggalTerakhir, val, editHariInterval, editCustomIntervalUnit));
                          }
                        }}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                      >
                        {editIsVehicle && <option value="none">Tidak Ada</option>}
                        <option value="harian">Harian</option>
                        <option value="mingguan">Mingguan</option>
                        <option value="bulanan">Bulanan</option>
                        <option value="tahunan">Tahunan</option>
                        <option value="custom">Custom (Pilihan)</option>
                      </select>
                    </div>

                    {editFrekuensi === 'custom' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Interval</label>
                          <input
                            type="number"
                            min="1"
                            value={editHariInterval}
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              setEditHariInterval(val);
                              if (editTanggalTerakhir) {
                                setEditTanggalBerikutnya(calculateNextDate(editTanggalTerakhir, 'custom', val, editCustomIntervalUnit));
                              }
                            }}
                            className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Satuan</label>
                          <select
                            value={editCustomIntervalUnit}
                            onChange={(e) => {
                              const val = e.target.value as any;
                              setEditCustomIntervalUnit(val);
                              if (editTanggalTerakhir) {
                                setEditTanggalBerikutnya(calculateNextDate(editTanggalTerakhir, 'custom', editHariInterval, val));
                              }
                            }}
                            className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                          >
                            <option value="hari">Hari</option>
                            <option value="minggu">Minggu</option>
                            <option value="bulan">Bulan</option>
                            <option value="tahun">Tahun</option>
                          </select>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Terakhir Dicek</label>
                      <input
                        type="date"
                        value={editTanggalTerakhir}
                        onChange={(e) => handleEditLastDateChange(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Tanggal Berikutnya {editIsVehicle ? '(Opsional)' : '*'}
                      </label>
                      <input
                        type="date"
                        required={!editIsVehicle}
                        value={editTanggalBerikutnya}
                        onChange={(e) => setEditTanggalBerikutnya(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                      />
                    </div>
                  </div>

                  <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-center justify-between">
                    <div>
                      <span className="text-xs font-extrabold text-indigo-950 block">Otomatis Terbitkan WR</span>
                      <span className="text-[10px] text-slate-500 mt-0.5 block leading-relaxed">
                        Terbitkan WR otomatis saat jatuh tempo.
                      </span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={editOtomatisWR}
                        onChange={(e) => setEditOtomatisWR(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 flex justify-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setEditingPm(null)}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer disabled:bg-slate-400 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
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
