import React, { useState } from 'react';
import { Asset, CompanyBranch, UserProfile, WorkOrder, PreventiveMaintenance, WorkRequest } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';
import { hasPermission } from '../utils';
import ConfirmModal from './ConfirmModal';
import { generateWRNumber } from '../dbHelper';
import { 
  Settings as GearIcon, 
  Search, 
  Plus, 
  MapPin, 
  Tag, 
  AlertTriangle, 
  CheckCircle, 
  Activity, 
  Trash2, 
  SlidersHorizontal,
  X,
  History,
  Calendar,
  User,
  Wrench,
  ShieldCheck,
  Clock,
  Car,
  Gauge
} from 'lucide-react';

interface AssetsScreenProps {
  assets: Asset[];
  currentUser: UserProfile;
  branches: CompanyBranch[];
  orders: WorkOrder[];
  pmSchedules?: PreventiveMaintenance[];
}

export default function AssetsScreen({ assets, currentUser, branches, orders, pmSchedules }: AssetsScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [criticalityFilter, setCriticalityFilter] = useState('all');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null);
  const [selectedAssetForLog, setSelectedAssetForLog] = useState<Asset | null>(null);
  const [newAsset, setNewAsset] = useState<Partial<Asset>>({
    code: '',
    name: '',
    category: 'Utilitas',
    location: '',
    status: 'running',
    criticality: 'medium',
    lastMaintenance: new Date().toISOString().split('T')[0],
    nextMaintenance: ''
  });

  // PM integration states
  const [integrateWithPM, setIntegrateWithPM] = useState(false);
  const [pmDeskripsi, setPmDeskripsi] = useState('');
  const [pmFrekuensi, setPmFrekuensi] = useState<PreventiveMaintenance['frekuensi']>('bulanan');
  const [pmHariInterval, setPmHariInterval] = useState(30);
  const [pmCustomIntervalUnit, setPmCustomIntervalUnit] = useState<PreventiveMaintenance['customIntervalUnit']>('hari');
  const [pmTanggalTerakhirPengecekan, setPmTanggalTerakhirPengecekan] = useState('');
  const [pmTanggalBerikutnyaPengecekan, setPmTanggalBerikutnyaPengecekan] = useState('');
  const [pmOtomatisWR, setPmOtomatisWR] = useState(true);
  const [pmIsVehicle, setPmIsVehicle] = useState(false);
  const [pmVehicleTrackingMode, setPmVehicleTrackingMode] = useState<'kilometer' | 'runhour' | 'cycles'>('kilometer');
  const [pmVehicleLastReading, setPmVehicleLastReading] = useState<number>(0);
  const [pmVehicleIntervalReading, setPmVehicleIntervalReading] = useState<number>(5000);
  const [pmVehicleTargetReading, setPmVehicleTargetReading] = useState<number>(5000);

  // PM Helper: calculate next date
  const calculateNextPMDate = (
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

  const handleLastDateChange = (dateVal: string) => {
    setPmTanggalTerakhirPengecekan(dateVal);
    if (dateVal) {
      const calculated = calculateNextPMDate(dateVal, pmFrekuensi, pmHariInterval, pmCustomIntervalUnit);
      setPmTanggalBerikutnyaPengecekan(calculated);
    }
  };

  const handleFreqChange = (freqVal: PreventiveMaintenance['frekuensi']) => {
    setPmFrekuensi(freqVal);
    if (pmTanggalTerakhirPengecekan) {
      const calculated = calculateNextPMDate(pmTanggalTerakhirPengecekan, freqVal, pmHariInterval, pmCustomIntervalUnit);
      setPmTanggalBerikutnyaPengecekan(calculated);
    }
  };

  const handleIntervalChange = (val: number) => {
    setPmHariInterval(val);
    if (pmTanggalTerakhirPengecekan) {
      const calculated = calculateNextPMDate(pmTanggalTerakhirPengecekan, pmFrekuensi, val, pmCustomIntervalUnit);
      setPmTanggalBerikutnyaPengecekan(calculated);
    }
  };

  const handleIntervalUnitChange = (unitVal: PreventiveMaintenance['customIntervalUnit']) => {
    setPmCustomIntervalUnit(unitVal);
    if (pmTanggalTerakhirPengecekan) {
      const calculated = calculateNextPMDate(pmTanggalTerakhirPengecekan, pmFrekuensi, pmHariInterval, unitVal);
      setPmTanggalBerikutnyaPengecekan(calculated);
    }
  };

  // Generate Auto WR from PM
  const generateAutoWR = async (pm: PreventiveMaintenance) => {
    const wrId = 'WR-' + Date.now();
    const nomorWR = await generateWRNumber('MTC', pm.companyId || 'default');
    
    const isVeh = pm.isVehicle;
    const trackingLabel = pm.vehicleTrackingMode === 'kilometer' ? 'KM' : 'RH';
    
    const masalah = isVeh
      ? `[TUNE UP VEHICLE DUE] Pemakaian kendaraan ${pm.namaAlat} telah mencapai target service (${pm.vehicleTargetReading?.toLocaleString('id-ID')} ${trackingLabel}). ${pm.deskripsi || ''}`
      : `[PREVENTIVE MAINTENANCE DUE] Pengecekan rutin terjadwal (${pm.frekuensi === 'custom' ? `Tiap ${pm.hariInterval || 30} ${pm.customIntervalUnit || 'hari'}` : pm.frekuensi}) untuk alat: ${pm.namaAlat}. ${pm.deskripsi || ''}`;
      
    const tindakan = isVeh
      ? `Lakukan tune up dan perawatan berkala kendaraan (ganti oli mesin, filter, tune up, cek busi/injektor, rem, dll).`
      : `Lakukan pemeriksaan visual menyeluruh, uji fungsi sensor/aktuator, bersihkan komponen internal, kencangkan sambungan, lumasi bagian bergerak, dan catat parameter operasi mesin.`;

    const newWR: WorkRequest = {
      id: wrId,
      nomorWR,
      masalah,
      tindakan,
      namaPengaju: isVeh ? 'Sistem PM Otomatis (Vehicle)' : 'Sistem PM Otomatis',
      tanggalArea: pm.lokasi || (isVeh ? 'Pool Kendaraan' : 'Lokasi Terdaftar'),
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

    const cleanObject = (obj: any): any => {
      const copy = { ...obj };
      Object.keys(copy).forEach(key => {
        if (copy[key] === undefined || (typeof copy[key] === 'number' && isNaN(copy[key]))) {
          delete copy[key];
        }
      });
      return copy;
    };

    await setDoc(doc(db, 'work_requests', wrId), cleanObject(newWR));
  };

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    alertOnly?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const categories = ['Utilitas', 'Produksi', 'Kelistrikan', 'Sarana'];
  const criticalities = ['critical', 'high', 'medium', 'low'];

  const userCompanyId = currentUser.companyId || 'default';
  const userBranchId = currentUser.cabangId || 'pusat';

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.code || !newAsset.name || !newAsset.location) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon lengkapi seluruh field wajib!',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (integrateWithPM) {
      if (!pmIsVehicle && !pmTanggalBerikutnyaPengecekan) {
        setDialogConfig({
          isOpen: true,
          title: 'Formulir PM Belum Lengkap',
          message: 'Mohon isi tanggal berikutnya pengecekan PM!',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    const assetId = `ast_${Date.now()}`;
    const assetData: Asset = {
      id: assetId,
      code: newAsset.code.toUpperCase(),
      name: newAsset.name,
      category: newAsset.category || 'Utilitas',
      location: newAsset.location,
      status: (newAsset.status as any) || 'running',
      criticality: (newAsset.criticality as any) || 'medium',
      lastMaintenance: newAsset.lastMaintenance || '',
      nextMaintenance: newAsset.nextMaintenance || '',
      companyId: userCompanyId,
      cabangId: userBranchId,
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Save standard asset
      await setDoc(doc(db, 'assets', assetId), assetData);

      // 2. Save Preventive Maintenance if integrate is selected
      if (integrateWithPM) {
        const pmId = 'PM-' + Date.now();
        const nextDate = pmTanggalBerikutnyaPengecekan || undefined;

        const newPM: PreventiveMaintenance = {
          id: pmId,
          namaAlat: newAsset.name,
          kodeAlat: newAsset.code.toUpperCase(),
          lokasi: newAsset.location || undefined,
          deskripsi: pmDeskripsi || undefined,
          frekuensi: pmIsVehicle ? pmFrekuensi : (pmFrekuensi || 'bulanan'),
          hariInterval: pmFrekuensi === 'custom' ? pmHariInterval : undefined,
          customIntervalUnit: pmFrekuensi === 'custom' ? pmCustomIntervalUnit : undefined,
          tanggalTerakhirPengecekan: pmTanggalTerakhirPengecekan || undefined,
          tanggalBerikutnyaPengecekan: nextDate,
          otomatisWR: pmOtomatisWR,
          status: 'aktif',
          createdAt: new Date().toISOString(),
          companyId: userCompanyId,
          cabangId: userBranchId,
          isVehicle: pmIsVehicle,
          vehicleTrackingMode: pmIsVehicle ? pmVehicleTrackingMode : undefined,
          vehicleLastReading: pmIsVehicle ? Number(pmVehicleLastReading) : undefined,
          vehicleIntervalReading: pmIsVehicle ? Number(pmVehicleIntervalReading) : undefined,
          vehicleTargetReading: pmIsVehicle ? Number(pmVehicleTargetReading) : undefined,
          vehicleReadingHistory: pmIsVehicle ? [
            {
              id: 'VR-init-' + Date.now(),
              tanggal: new Date().toISOString().split('T')[0],
              nilai: Number(pmVehicleLastReading),
              petugas: currentUser.name || currentUser.username
            }
          ] : undefined
        };

        const cleanObject = (obj: any): any => {
          const copy = { ...obj };
          Object.keys(copy).forEach(key => {
            if (copy[key] === undefined || (typeof copy[key] === 'number' && isNaN(copy[key]))) {
              delete copy[key];
            }
          });
          return copy;
        };

        await setDoc(doc(db, 'preventive_maintenance', pmId), cleanObject(newPM));

        // Trigger Auto WR if due
        if (pmOtomatisWR) {
          const today = new Date().toISOString().split('T')[0];
          const isReadingDue = pmIsVehicle && Number(pmVehicleLastReading) >= Number(pmVehicleTargetReading);
          const isDateDue = nextDate ? nextDate <= today : false;
          if (isDateDue || isReadingDue) {
            await generateAutoWR(newPM);
          }
        }
      }

      setIsAddModalOpen(false);
      // Reset Asset Form
      setNewAsset({
        code: '',
        name: '',
        category: 'Utilitas',
        location: '',
        status: 'running',
        criticality: 'medium',
        lastMaintenance: new Date().toISOString().split('T')[0],
        nextMaintenance: ''
      });

      // Reset PM Form states
      setIntegrateWithPM(false);
      setPmDeskripsi('');
      setPmFrekuensi('bulanan');
      setPmHariInterval(30);
      setPmCustomIntervalUnit('hari');
      setPmTanggalTerakhirPengecekan('');
      setPmTanggalBerikutnyaPengecekan('');
      setPmOtomatisWR(true);
      setPmIsVehicle(false);
      setPmVehicleTrackingMode('kilometer');
      setPmVehicleLastReading(0);
      setPmVehicleIntervalReading(5000);
      setPmVehicleTargetReading(5000);

    } catch (err) {
      console.error('Error adding integrated asset:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan aset. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleStatusChange = async (assetId: string, newStatus: 'running' | 'down' | 'maintenance') => {
    try {
      const assetRef = doc(db, 'assets', assetId);
      const asset = assets.find(a => a.id === assetId);
      if (asset) {
        await setDoc(assetRef, { ...asset, status: newStatus }, { merge: true });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  const handleDeleteAsset = (assetId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Aset',
      message: 'Apakah Anda yakin ingin menghapus aset ini dari sistem secara permanen?',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'assets', assetId));
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Error deleting asset:', err);
          setDialogConfig({
            isOpen: true,
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghapus aset dari database.',
            confirmLabel: 'Tutup',
            alertOnly: true,
            variant: 'danger',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleStartEditAsset = (asset: Asset) => {
    setEditingAsset({ ...asset });
    
    // Look up existing PM
    const existingPM = pmSchedules?.find(
      pm => (pm.kodeAlat?.toUpperCase() === asset.code?.toUpperCase() || 
             pm.namaAlat?.toLowerCase() === asset.name?.toLowerCase()) && 
            pm.companyId === asset.companyId
    );

    if (existingPM) {
      setIntegrateWithPM(true);
      setPmDeskripsi(existingPM.deskripsi || '');
      setPmFrekuensi(existingPM.frekuensi || 'bulanan');
      setPmHariInterval(existingPM.hariInterval || 30);
      setPmCustomIntervalUnit(existingPM.customIntervalUnit || 'hari');
      setPmTanggalTerakhirPengecekan(existingPM.tanggalTerakhirPengecekan || '');
      setPmTanggalBerikutnyaPengecekan(existingPM.tanggalBerikutnyaPengecekan || '');
      setPmOtomatisWR(existingPM.otomatisWR !== false);
      setPmIsVehicle(!!existingPM.isVehicle);
      setPmVehicleTrackingMode(existingPM.vehicleTrackingMode || 'kilometer');
      setPmVehicleLastReading(existingPM.vehicleLastReading || 0);
      setPmVehicleIntervalReading(existingPM.vehicleIntervalReading || 5000);
      setPmVehicleTargetReading(existingPM.vehicleTargetReading || 5000);
    } else {
      setIntegrateWithPM(false);
      setPmDeskripsi('');
      setPmFrekuensi('bulanan');
      setPmHariInterval(30);
      setPmCustomIntervalUnit('hari');
      setPmTanggalTerakhirPengecekan('');
      setPmTanggalBerikutnyaPengecekan('');
      setPmOtomatisWR(true);
      setPmIsVehicle(false);
      setPmVehicleTrackingMode('kilometer');
      setPmVehicleLastReading(0);
      setPmVehicleIntervalReading(5000);
      setPmVehicleTargetReading(5000);
    }

    setIsEditModalOpen(true);
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !editingAsset.code || !editingAsset.name || !editingAsset.location) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon lengkapi seluruh field wajib!',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (integrateWithPM) {
      if (!pmIsVehicle && !pmTanggalBerikutnyaPengecekan) {
        setDialogConfig({
          isOpen: true,
          title: 'Formulir PM Belum Lengkap',
          message: 'Mohon isi tanggal berikutnya pengecekan PM!',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    try {
      // 1. Update asset
      await setDoc(doc(db, 'assets', editingAsset.id), {
        ...editingAsset,
        code: editingAsset.code.toUpperCase(),
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Handle Preventive Maintenance integration
      const oldCode = assets.find(a => a.id === editingAsset.id)?.code;
      const existingPM = pmSchedules?.find(
        pm => (pm.kodeAlat?.toUpperCase() === oldCode?.toUpperCase() || 
               pm.kodeAlat?.toUpperCase() === editingAsset.code?.toUpperCase()) && 
              pm.companyId === editingAsset.companyId
      );

      const cleanObject = (obj: any): any => {
        const copy = { ...obj };
        Object.keys(copy).forEach(key => {
          if (copy[key] === undefined || (typeof copy[key] === 'number' && isNaN(copy[key]))) {
            delete copy[key];
          }
        });
        return copy;
      };

      if (integrateWithPM) {
        if (existingPM) {
          // Update existing PM
          const pmId = existingPM.id;
          const updatedPM: PreventiveMaintenance = {
            ...existingPM,
            namaAlat: editingAsset.name,
            kodeAlat: editingAsset.code.toUpperCase(),
            lokasi: editingAsset.location || undefined,
            deskripsi: pmDeskripsi || undefined,
            frekuensi: pmIsVehicle ? pmFrekuensi : (pmFrekuensi || 'bulanan'),
            hariInterval: pmFrekuensi === 'custom' ? pmHariInterval : undefined,
            customIntervalUnit: pmFrekuensi === 'custom' ? pmCustomIntervalUnit : undefined,
            tanggalTerakhirPengecekan: pmTanggalTerakhirPengecekan || undefined,
            tanggalBerikutnyaPengecekan: pmTanggalBerikutnyaPengecekan || undefined,
            otomatisWR: pmOtomatisWR,
            status: 'aktif',
            isVehicle: pmIsVehicle,
            vehicleTrackingMode: pmIsVehicle ? pmVehicleTrackingMode : undefined,
            vehicleLastReading: pmIsVehicle ? Number(pmVehicleLastReading) : undefined,
            vehicleIntervalReading: pmIsVehicle ? Number(pmVehicleIntervalReading) : undefined,
            vehicleTargetReading: pmIsVehicle ? Number(pmVehicleTargetReading) : undefined,
          };
          await setDoc(doc(db, 'preventive_maintenance', pmId), cleanObject(updatedPM));

          // Trigger Auto WR if due
          if (pmOtomatisWR) {
            const today = new Date().toISOString().split('T')[0];
            const isReadingDue = pmIsVehicle && Number(pmVehicleLastReading) >= Number(pmVehicleTargetReading);
            const isDateDue = pmTanggalBerikutnyaPengecekan ? pmTanggalBerikutnyaPengecekan <= today : false;
            if (isDateDue || isReadingDue) {
              await generateAutoWR(updatedPM);
            }
          }
        } else {
          // Create new PM
          const pmId = 'PM-' + Date.now();
          const newPM: PreventiveMaintenance = {
            id: pmId,
            namaAlat: editingAsset.name,
            kodeAlat: editingAsset.code.toUpperCase(),
            lokasi: editingAsset.location || undefined,
            deskripsi: pmDeskripsi || undefined,
            frekuensi: pmIsVehicle ? pmFrekuensi : (pmFrekuensi || 'bulanan'),
            hariInterval: pmFrekuensi === 'custom' ? pmHariInterval : undefined,
            customIntervalUnit: pmFrekuensi === 'custom' ? pmCustomIntervalUnit : undefined,
            tanggalTerakhirPengecekan: pmTanggalTerakhirPengecekan || undefined,
            tanggalBerikutnyaPengecekan: pmTanggalBerikutnyaPengecekan || undefined,
            otomatisWR: pmOtomatisWR,
            status: 'aktif',
            createdAt: new Date().toISOString(),
            companyId: editingAsset.companyId || userCompanyId,
            cabangId: editingAsset.cabangId || userBranchId,
            isVehicle: pmIsVehicle,
            vehicleTrackingMode: pmIsVehicle ? pmVehicleTrackingMode : undefined,
            vehicleLastReading: pmIsVehicle ? Number(pmVehicleLastReading) : undefined,
            vehicleIntervalReading: pmIsVehicle ? Number(pmVehicleIntervalReading) : undefined,
            vehicleTargetReading: pmIsVehicle ? Number(pmVehicleTargetReading) : undefined,
            vehicleReadingHistory: pmIsVehicle ? [
              {
                id: 'VR-init-' + Date.now(),
                tanggal: new Date().toISOString().split('T')[0],
                nilai: Number(pmVehicleLastReading),
                petugas: currentUser.name || currentUser.username
              }
            ] : undefined
          };
          await setDoc(doc(db, 'preventive_maintenance', pmId), cleanObject(newPM));

          // Trigger Auto WR if due
          if (pmOtomatisWR) {
            const today = new Date().toISOString().split('T')[0];
            const isReadingDue = pmIsVehicle && Number(pmVehicleLastReading) >= Number(pmVehicleTargetReading);
            const isDateDue = pmTanggalBerikutnyaPengecekan ? pmTanggalBerikutnyaPengecekan <= today : false;
            if (isDateDue || isReadingDue) {
              await generateAutoWR(newPM);
            }
          }
        }
      } else {
        // If not integrated, but existingPM was found, delete it to unlink/disable PM for this asset
        if (existingPM) {
          await deleteDoc(doc(db, 'preventive_maintenance', existingPM.id));
        }
      }
      
      setIsEditModalOpen(false);
      setEditingAsset(null);

      // Reset PM Form states
      setIntegrateWithPM(false);
      setPmDeskripsi('');
      setPmFrekuensi('bulanan');
      setPmHariInterval(30);
      setPmCustomIntervalUnit('hari');
      setPmTanggalTerakhirPengecekan('');
      setPmTanggalBerikutnyaPengecekan('');
      setPmOtomatisWR(true);
      setPmIsVehicle(false);
      setPmVehicleTrackingMode('kilometer');
      setPmVehicleLastReading(0);
      setPmVehicleIntervalReading(5000);
      setPmVehicleTargetReading(5000);

    } catch (err) {
      console.error('Error updating asset:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Menyimpan',
        message: 'Gagal memperbarui aset. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  // Filter lists
  const filteredAssets = assets.filter(asset => {
    const matchesSearch = asset.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          asset.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          asset.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || asset.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || asset.status === statusFilter;
    const matchesCriticality = criticalityFilter === 'all' || asset.criticality === criticalityFilter;

    return matchesSearch && matchesCategory && matchesStatus && matchesCriticality;
  });

  const getStatusBadge = (status: Asset['status']) => {
    switch (status) {
      case 'running':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> Operasi (Running)
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
            <Activity className="w-3.5 h-3.5 text-amber-600" /> Pemeliharaan (Maint)
          </span>
        );
      case 'down':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-600 animate-bounce" /> Rusak (Down)
          </span>
        );
    }
  };

  const getCriticalityBadge = (level: Asset['criticality']) => {
    switch (level) {
      case 'critical':
        return <span className="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded bg-rose-950 text-rose-200 border border-rose-800">Critical</span>;
      case 'high':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-200">High</span>;
      case 'medium':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200">Medium</span>;
      case 'low':
        return <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">Low</span>;
    }
  };

  return (
    <div className="space-y-6" id="assets-screen-container">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl">
            <GearIcon className="w-6 h-6 animate-spin-slow" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Registrasi & Pemantauan Aset</h2>
            <p className="text-xs text-slate-500">Kelola daftar seluruh mesin pabrik, utilitas, dan sarana secara tersistem</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Tambah Aset Baru
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode, nama, atau lokasi aset..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-600 transition"
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 shrink-0 font-mono">Kategori:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 transition cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 shrink-0 font-mono">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 transition cursor-pointer"
              >
                <option value="all">Semua Status</option>
                <option value="running">Operasi (Running)</option>
                <option value="maintenance">Pemeliharaan (Maint)</option>
                <option value="down">Rusak (Down)</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-400 shrink-0 font-mono">Kritikalitas:</span>
              <select
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 transition cursor-pointer"
              >
                <option value="all">Semua Tingkat</option>
                <option value="critical">Critical</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>
        </div>

        {/* Total stats label */}
        <div className="text-slate-400 text-[11px] font-semibold font-mono flex justify-between">
          <span>Menampilkan {filteredAssets.length} dari {assets.length} aset terdaftar</span>
          <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
            {assets.filter(a => a.status === 'down').length} Total Aset Sedang Down
          </span>
        </div>
      </div>

      {/* Grid of Assets */}
      {filteredAssets.length === 0 ? (
        <div className="bg-white py-16 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
          Tidak ada aset yang sesuai dengan kriteria filter.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredAssets.map(asset => (
            <div key={asset.id} className="bg-white border border-slate-200 rounded-2xl shadow-xs hover:shadow-md hover:border-slate-300 transition duration-150 p-5 flex flex-col justify-between space-y-4">
              <div className="space-y-3">
                {/* ID & Criticality */}
                <div className="flex justify-between items-start">
                  <div className="space-y-0.5">
                    <span className="text-[10px] font-mono font-bold text-slate-400 tracking-wider uppercase block">{asset.code}</span>
                    <h3 className="text-xs font-black text-slate-900 leading-tight uppercase font-sans">{asset.name}</h3>
                  </div>
                  {getCriticalityBadge(asset.criticality)}
                </div>

                {/* Meta details */}
                <div className="space-y-1.5 text-[11px] text-slate-600 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Kategori: <strong className="text-slate-800">{asset.category}</strong></span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>Lokasi: <strong className="text-slate-800">{asset.location}</strong></span>
                  </div>
                </div>

                {/* Maintenance records */}
                {(asset.lastMaintenance || asset.nextMaintenance) && (
                  <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-100 text-[10px] text-slate-500 space-y-1">
                    {asset.lastMaintenance && (
                      <p>Maint Terakhir: <span className="font-semibold text-slate-700 font-mono">{asset.lastMaintenance}</span></p>
                    )}
                    {asset.nextMaintenance && (
                      <p>Maint Berikutnya: <span className="font-semibold text-slate-700 font-mono">{asset.nextMaintenance}</span></p>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                {/* Status Indicator */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Status Saat Ini:</span>
                  {getStatusBadge(asset.status)}
                </div>

                {/* Action quick triggers */}
                <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-100">
                  <span className="text-[9px] font-bold text-slate-400 ml-1.5 uppercase font-mono">Ubah:</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleStatusChange(asset.id, 'running')}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold transition cursor-pointer ${asset.status === 'running' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      title="Set Running"
                    >
                      Running
                    </button>
                    <button
                      onClick={() => handleStatusChange(asset.id, 'maintenance')}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold transition cursor-pointer ${asset.status === 'maintenance' ? 'bg-amber-500 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      title="Set Maintenance"
                    >
                      Maint
                    </button>
                    <button
                      onClick={() => handleStatusChange(asset.id, 'down')}
                      className={`px-2 py-1 rounded-lg text-[9px] font-bold transition cursor-pointer ${asset.status === 'down' ? 'bg-rose-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      title="Set Down"
                    >
                      Down
                    </button>
                  </div>
                </div>

                {/* History Log Trigger */}
                <button
                  onClick={() => setSelectedAssetForLog(asset)}
                  className="w-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-black py-2.5 px-3 rounded-xl transition duration-150 flex items-center justify-center gap-1.5 cursor-pointer border border-indigo-150"
                >
                  <History className="w-3.5 h-3.5" />
                  Riwayat Perawatan ({orders.filter(o => {
                    if (o.status !== 'selesai') return false;
                    const nameMatch = o.namaMesin && o.namaMesin.toLowerCase() === asset.name.toLowerCase();
                    const namePartialMatch = o.namaMesin && o.namaMesin.toLowerCase().includes(asset.name.toLowerCase());
                    const codeMatchInWR = o.nomorWR && o.nomorWR.toLowerCase().includes(asset.code.toLowerCase());
                    const codeMatchInWO = o.nomorWO && o.nomorWO.toLowerCase().includes(asset.code.toLowerCase());
                    const codeMatchInDesc = o.uraianPekerjaan && o.uraianPekerjaan.toLowerCase().includes(asset.code.toLowerCase());
                    return nameMatch || namePartialMatch || codeMatchInWR || codeMatchInWO || codeMatchInDesc;
                  }).length})
                </button>

                {/* Edit & Delete triggers */}
                {(currentUser.role === 'admin' || currentUser.role === 'management' || hasPermission(currentUser, 'canManagePMAssets')) && (
                  <div className="flex justify-between items-center pt-1">
                    <button
                      onClick={() => handleStartEditAsset(asset)}
                      className="text-[10px] text-indigo-600 hover:text-indigo-750 font-semibold flex items-center gap-1 transition cursor-pointer hover:bg-indigo-50 px-2 py-1 rounded-lg border border-transparent hover:border-indigo-100"
                    >
                      <GearIcon className="w-3.5 h-3.5" /> Edit Aset
                    </button>
                    <button
                      onClick={() => handleDeleteAsset(asset.id)}
                      className="text-[10px] text-rose-600 hover:text-rose-750 font-semibold flex items-center gap-1 transition cursor-pointer hover:bg-rose-50 px-2 py-1 rounded-lg border border-transparent hover:border-rose-100"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Hapus Aset
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Asset Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fadeIn text-slate-900 transition-all duration-300 ${integrateWithPM ? 'max-w-4xl w-full' : 'max-w-md w-full'}`}>
            <div className="flex justify-between items-center bg-blue-600 text-white px-5 py-4">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <GearIcon className="w-4 h-4 animate-spin-slow" />
                Registrasi Aset Pabrik Baru
              </h3>
              <button 
                onClick={() => {
                  setIsAddModalOpen(false);
                  setIntegrateWithPM(false);
                }}
                className="p-1 text-white/85 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddAsset} className="p-5 space-y-4">
              <div className={integrateWithPM ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                
                {/* COLUMN 1: DATA UTAMA ASET */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kode Aset *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. AST-MTC-UTL-009"
                    value={newAsset.code}
                    onChange={(e) => setNewAsset({ ...newAsset, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kategori *</label>
                  <select
                    value={newAsset.category}
                    onChange={(e) => setNewAsset({ ...newAsset, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600 transition cursor-pointer font-medium"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nama Aset / Mesin *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Chiller Centrifugal Daikin"
                  value={newAsset.name}
                  onChange={(e) => setNewAsset({ ...newAsset, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Lokasi Penempatan *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. Gedung Utilitas Barat Lantai 2"
                  value={newAsset.location}
                  onChange={(e) => setNewAsset({ ...newAsset, location: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kritikalitas *</label>
                  <select
                    value={newAsset.criticality}
                    onChange={(e) => setNewAsset({ ...newAsset, criticality: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600 transition cursor-pointer font-medium"
                  >
                    {criticalities.map(crit => (
                      <option key={crit} value={crit}>{crit.toUpperCase()}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Status Operasi *</label>
                  <select
                    value={newAsset.status}
                    onChange={(e) => setNewAsset({ ...newAsset, status: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600 transition cursor-pointer font-medium"
                  >
                    <option value="running">Operasi (Running)</option>
                    <option value="maintenance">Pemeliharaan (Maint)</option>
                    <option value="down">Rusak (Down)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Maint Terakhir</label>
                  <input
                    type="date"
                    value={newAsset.lastMaintenance}
                    onChange={(e) => setNewAsset({ ...newAsset, lastMaintenance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Maint Berikutnya</label>
                  <input
                    type="date"
                    value={newAsset.nextMaintenance}
                    onChange={(e) => setNewAsset({ ...newAsset, nextMaintenance: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition font-mono"
                  />
                </div>
              </div>

              {/* INTEGRATE WITH PM SWITCH */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
                    <div>
                      <label className="block text-xs font-bold text-slate-700">Integrasikan dengan PM</label>
                      <span className="text-[10px] text-slate-500 block">Daftarkan sebagai jadwal Preventive Maintenance</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntegrateWithPM(!integrateWithPM)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      integrateWithPM ? 'bg-indigo-600' : 'bg-slate-200'
                    }`}
                    id="toggle-pm-integration"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        integrateWithPM ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>
            </div>

            {/* COLUMN 2: DATA PREVENTIVE MAINTENANCE */}
            {integrateWithPM && (
              <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 animate-fadeIn">
                <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-indigo-600" />
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">Data Preventive Maintenance (PM)</h4>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Deskripsi PM / Petunjuk Kerja</label>
                  <textarea
                    placeholder="E.g. Cek kondisi filter oli, ukur tegangan input, bersihkan fan condensor, ganti grease bearing"
                    rows={2}
                    value={pmDeskripsi}
                    onChange={(e) => setPmDeskripsi(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Frekuensi PM</label>
                    <select
                      value={pmFrekuensi}
                      onChange={(e) => handleFreqChange(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                    >
                      <option value="harian">Harian</option>
                      <option value="mingguan">Mingguan</option>
                      <option value="bulanan">Bulanan</option>
                      <option value="tahunan">Tahunan</option>
                      <option value="custom">Custom (Interval)</option>
                      <option value="none">Sesuai Kebutuhan (None)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Otomatis WR</label>
                    <div className="flex items-center h-8">
                      <button
                        type="button"
                        onClick={() => setPmOtomatisWR(!pmOtomatisWR)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          pmOtomatisWR ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            pmOtomatisWR ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                      <span className="text-[10px] ml-2 text-slate-600 font-bold font-mono">Auto WR</span>
                    </div>
                  </div>
                </div>

                {pmFrekuensi === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Setiap</label>
                      <input
                        type="number"
                        min={1}
                        value={pmHariInterval}
                        onChange={(e) => handleIntervalChange(Number(e.target.value))}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Satuan</label>
                      <select
                        value={pmCustomIntervalUnit}
                        onChange={(e) => handleIntervalUnitChange(e.target.value as any)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                      >
                        <option value="hari">Hari</option>
                        <option value="minggu">Minggu</option>
                        <option value="bulan">Bulan</option>
                        <option value="tahun">Tahun</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* VEHICLE CONFIG */}
                <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Car className="w-4 h-4 text-amber-600" />
                    <div>
                      <span className="text-[11px] font-bold text-slate-700 block">Sistem Tracking Pemakaian</span>
                      <span className="text-[9px] text-slate-500 block">Hitung interval servis via KM, Jam, atau Siklus</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPmIsVehicle(!pmIsVehicle)}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      pmIsVehicle ? 'bg-amber-600' : 'bg-slate-200'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                        pmIsVehicle ? 'translate-x-4' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {!pmIsVehicle ? (
                  <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">PM Terakhir</label>
                      <input
                        type="date"
                        value={pmTanggalTerakhirPengecekan}
                        onChange={(e) => handleLastDateChange(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">PM Berikutnya *</label>
                      <input
                        type="date"
                        required={integrateWithPM && !pmIsVehicle}
                        value={pmTanggalBerikutnyaPengecekan}
                        onChange={(e) => setPmTanggalBerikutnyaPengecekan(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3 p-3 bg-amber-50/20 border border-amber-200/30 rounded-xl animate-fadeIn">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Mode Tracking</label>
                        <select
                          value={pmVehicleTrackingMode}
                          onChange={(e) => setPmVehicleTrackingMode(e.target.value as any)}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition cursor-pointer font-medium"
                        >
                          <option value="kilometer">Kilometer (KM)</option>
                          <option value="runhour">Run Hour (RH)</option>
                          <option value="cycles">Cycles (Siklus)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nilai Terakhir</label>
                        <input
                          type="number"
                          min={0}
                          value={pmVehicleLastReading}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPmVehicleLastReading(val);
                            setPmVehicleTargetReading(val + pmVehicleIntervalReading);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Interval Servis</label>
                        <input
                          type="number"
                          min={1}
                          value={pmVehicleIntervalReading}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setPmVehicleIntervalReading(val);
                            setPmVehicleTargetReading(pmVehicleLastReading + val);
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Target Berikutnya</label>
                        <input
                          type="number"
                          disabled
                          value={pmVehicleTargetReading}
                          className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-bold transition font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                setIntegrateWithPM(false);
              }}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              {integrateWithPM ? 'Daftarkan Aset & Jadwal PM' : 'Daftarkan Aset'}
            </button>
          </div>
        </form>
          </div>
        </div>
      )}

      {/* Edit Asset Modal */}
      {isEditModalOpen && editingAsset && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className={`bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden animate-fadeIn text-slate-900 transition-all duration-300 ${integrateWithPM ? 'max-w-4xl w-full' : 'max-w-md w-full'}`}>
            <div className="flex justify-between items-center bg-indigo-600 text-white px-5 py-4">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2 font-sans">
                <GearIcon className="w-4 h-4 animate-spin-slow" />
                Edit Informasi Aset Pabrik
              </h3>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setEditingAsset(null);
                }}
                className="p-1 text-white/85 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUpdateAsset} className="p-5 space-y-4">
              <div className={integrateWithPM ? "grid grid-cols-1 md:grid-cols-2 gap-6" : "space-y-4"}>
                
                {/* COLUMN 1: DATA UTAMA ASET */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kode Aset *</label>
                      <input
                        type="text"
                        required
                        placeholder="E.g. AST-MTC-UTL-009"
                        value={editingAsset.code || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, code: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kategori *</label>
                      <select
                        value={editingAsset.category || 'Utilitas'}
                        onChange={(e) => setEditingAsset({ ...editingAsset, category: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                      >
                        {categories.map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nama Aset / Mesin *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Chiller Centrifugal Daikin"
                      value={editingAsset.name || ''}
                      onChange={(e) => setEditingAsset({ ...editingAsset, name: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Lokasi Penempatan *</label>
                    <input
                      type="text"
                      required
                      placeholder="E.g. Gedung Utilitas Barat Lantai 2"
                      value={editingAsset.location || ''}
                      onChange={(e) => setEditingAsset({ ...editingAsset, location: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kritikalitas *</label>
                      <select
                        value={editingAsset.criticality || 'medium'}
                        onChange={(e) => setEditingAsset({ ...editingAsset, criticality: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                      >
                        {criticalities.map(crit => (
                          <option key={crit} value={crit}>{crit.toUpperCase()}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Status Operasi *</label>
                      <select
                        value={editingAsset.status || 'running'}
                        onChange={(e) => setEditingAsset({ ...editingAsset, status: e.target.value as any })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                      >
                        <option value="running">Operasi (Running)</option>
                        <option value="maintenance">Pemeliharaan (Maint)</option>
                        <option value="down">Rusak (Down)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Maint Terakhir</label>
                      <input
                        type="date"
                        value={editingAsset.lastMaintenance || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, lastMaintenance: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Maint Berikutnya</label>
                      <input
                        type="date"
                        value={editingAsset.nextMaintenance || ''}
                        onChange={(e) => setEditingAsset({ ...editingAsset, nextMaintenance: e.target.value })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                      />
                    </div>
                  </div>

                  {/* INTEGRATE WITH PM SWITCH */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-5 h-5 text-indigo-600 animate-pulse" />
                        <div>
                          <label className="block text-xs font-bold text-slate-700">Integrasikan dengan PM</label>
                          <span className="text-[10px] text-slate-500 block">Daftarkan/Ubah jadwal Preventive Maintenance</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIntegrateWithPM(!integrateWithPM)}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          integrateWithPM ? 'bg-indigo-600' : 'bg-slate-200'
                        }`}
                        id="toggle-edit-pm-integration"
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            integrateWithPM ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: DATA PREVENTIVE MAINTENANCE */}
                {integrateWithPM && (
                  <div className="space-y-4 border-t md:border-t-0 md:border-l border-slate-200 pt-4 md:pt-0 md:pl-6 animate-fadeIn">
                    <div className="border-b border-slate-100 pb-2 mb-2 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">Data Preventive Maintenance (PM)</h4>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Deskripsi PM / Petunjuk Kerja</label>
                      <textarea
                        placeholder="E.g. Cek kondisi filter oli, ukur tegangan input, bersihkan fan condensor, ganti grease bearing"
                        rows={2}
                        value={pmDeskripsi}
                        onChange={(e) => setPmDeskripsi(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Frekuensi PM</label>
                        <select
                          value={pmFrekuensi}
                          onChange={(e) => handleFreqChange(e.target.value as any)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                        >
                          <option value="harian">Harian</option>
                          <option value="mingguan">Mingguan</option>
                          <option value="bulanan">Bulanan</option>
                          <option value="tahunan">Tahunan</option>
                          <option value="custom">Custom (Interval)</option>
                          <option value="none">Sesuai Kebutuhan (None)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Otomatis WR</label>
                        <div className="flex items-center h-8">
                          <button
                            type="button"
                            onClick={() => setPmOtomatisWR(!pmOtomatisWR)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                              pmOtomatisWR ? 'bg-indigo-600' : 'bg-slate-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                                pmOtomatisWR ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                          <span className="text-[10px] ml-2 text-slate-600 font-bold font-mono">Auto WR</span>
                        </div>
                      </div>
                    </div>

                    {pmFrekuensi === 'custom' && (
                      <div className="grid grid-cols-2 gap-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50 animate-fadeIn">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Setiap</label>
                          <input
                            type="number"
                            min={1}
                            value={pmHariInterval}
                            onChange={(e) => handleIntervalChange(Number(e.target.value))}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Satuan</label>
                          <select
                            value={pmCustomIntervalUnit}
                            onChange={(e) => handleIntervalUnitChange(e.target.value as any)}
                            className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-indigo-600 transition cursor-pointer font-medium"
                          >
                            <option value="hari">Hari</option>
                            <option value="minggu">Minggu</option>
                            <option value="bulan">Bulan</option>
                            <option value="tahun">Tahun</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* VEHICLE CONFIG */}
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-200/50 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="w-4 h-4 text-amber-600" />
                        <div>
                          <span className="text-[11px] font-bold text-slate-700 block">Sistem Tracking Pemakaian</span>
                          <span className="text-[9px] text-slate-500 block">Hitung interval servis via KM, Jam, atau Siklus</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setPmIsVehicle(!pmIsVehicle)}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                          pmIsVehicle ? 'bg-amber-600' : 'bg-slate-200'
                        }`}
                      >
                        <span
                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-xs ring-0 transition duration-200 ease-in-out ${
                            pmIsVehicle ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>

                    {!pmIsVehicle ? (
                      <div className="grid grid-cols-2 gap-3 animate-fadeIn">
                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">PM Terakhir</label>
                          <input
                            type="date"
                            value={pmTanggalTerakhirPengecekan}
                            onChange={(e) => handleLastDateChange(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">PM Berikutnya *</label>
                          <input
                            type="date"
                            required={integrateWithPM && !pmIsVehicle}
                            value={pmTanggalBerikutnyaPengecekan}
                            onChange={(e) => setPmTanggalBerikutnyaPengecekan(e.target.value)}
                            className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-indigo-600 transition font-mono"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 p-3 bg-amber-50/20 border border-amber-200/30 rounded-xl animate-fadeIn">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Mode Tracking</label>
                            <select
                              value={pmVehicleTrackingMode}
                              onChange={(e) => setPmVehicleTrackingMode(e.target.value as any)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition cursor-pointer font-medium"
                            >
                              <option value="kilometer">Kilometer (KM)</option>
                              <option value="runhour">Run Hour (RH)</option>
                              <option value="cycles">Cycles (Siklus)</option>
                            </select>
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nilai Terakhir</label>
                            <input
                              type="number"
                              min={0}
                              value={pmVehicleLastReading}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setPmVehicleLastReading(val);
                                setPmVehicleTargetReading(val + pmVehicleIntervalReading);
                              }}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Interval Servis</label>
                            <input
                              type="number"
                              min={1}
                              value={pmVehicleIntervalReading}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setPmVehicleIntervalReading(val);
                                setPmVehicleTargetReading(pmVehicleLastReading + val);
                              }}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-amber-600 transition"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Target Berikutnya</label>
                            <input
                              type="number"
                              disabled
                              value={pmVehicleTargetReading}
                              className="w-full px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs text-slate-500 font-bold transition font-mono"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingAsset(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Asset Maintenance History Log Modal */}
      {selectedAssetForLog && (() => {
        const historyList = orders.filter(o => {
          if (o.status !== 'selesai') return false;
          const nameMatch = o.namaMesin && o.namaMesin.toLowerCase() === selectedAssetForLog.name.toLowerCase();
          const namePartialMatch = o.namaMesin && o.namaMesin.toLowerCase().includes(selectedAssetForLog.name.toLowerCase());
          const codeMatchInWR = o.nomorWR && o.nomorWR.toLowerCase().includes(selectedAssetForLog.code.toLowerCase());
          const codeMatchInWO = o.nomorWO && o.nomorWO.toLowerCase().includes(selectedAssetForLog.code.toLowerCase());
          const codeMatchInDesc = o.uraianPekerjaan && o.uraianPekerjaan.toLowerCase().includes(selectedAssetForLog.code.toLowerCase());
          return nameMatch || namePartialMatch || codeMatchInWR || codeMatchInWO || codeMatchInDesc;
        }).sort((a, b) => {
          const dateA = a.finishAt || a.tanggalWO || '';
          const dateB = b.finishAt || b.tanggalWO || '';
          return dateB.localeCompare(dateA);
        });

        const preventiveCount = historyList.filter(o => o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM')).length;
        const reactiveCount = historyList.length - preventiveCount;

        return (
          <div className="fixed inset-0 z-[100] bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" id="asset-history-modal-overlay">
            <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-xl overflow-hidden animate-fadeIn flex flex-col max-h-[85vh] text-slate-900">
              {/* Modal Header */}
              <div className="bg-indigo-950 text-white px-6 py-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-900 text-indigo-300 rounded-xl">
                    <History className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-300 bg-indigo-900 px-2 py-0.5 rounded">
                      {selectedAssetForLog.code}
                    </span>
                    <h3 className="text-sm font-black uppercase tracking-wider leading-tight mt-0.5">
                      Riwayat Pemeliharaan & Perbaikan
                    </h3>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAssetForLog(null)}
                  className="p-1 text-white/80 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Asset Meta Info */}
              <div className="bg-slate-50 border-b border-slate-200 px-6 py-4 shrink-0 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-medium">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Nama Mesin</p>
                  <p className="font-extrabold text-slate-800 uppercase mt-0.5">{selectedAssetForLog.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Lokasi / Area</p>
                  <p className="font-semibold text-slate-700 mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-slate-400" />
                    {selectedAssetForLog.location}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">MTC Terjadwal (PM)</p>
                  <p className="font-mono text-slate-700 mt-0.5">{selectedAssetForLog.nextMaintenance || '-'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Rasio Pekerjaan</p>
                  <p className="mt-0.5">
                    <span className="text-indigo-650 font-bold font-mono">{preventiveCount} PM</span>
                    <span className="text-slate-300 mx-1">|</span>
                    <span className="text-rose-650 font-bold font-mono">{reactiveCount} Reaktif</span>
                  </p>
                </div>
              </div>

              {/* History Timeline */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50" id="asset-history-timeline-scroll">
                {historyList.length === 0 ? (
                  <div className="py-16 text-center text-slate-400 space-y-3">
                    <History className="w-12 h-12 text-slate-300 mx-auto animate-pulse" />
                    <p className="text-xs">Aset ini belum memiliki riwayat pekerjaan pemeliharaan yang berstatus Selesai.</p>
                  </div>
                ) : (
                  <div className="relative border-l-2 border-indigo-100 pl-6 ml-2 space-y-6">
                    {historyList.map((wo) => {
                      const isPM = wo.nomorWR?.startsWith('PM-') || wo.jenisTindakan === 'perawatan' || wo.nomorWO.includes('PM');
                      const workDate = wo.finishAt ? wo.finishAt.split('T')[0] : (wo.tanggalWO || '-');
                      const workTime = wo.finishAt ? new Date(wo.finishAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '';

                      return (
                        <div key={wo.id} className="relative group" id={`history-item-${wo.id}`}>
                          {/* Timeline dot */}
                          <span className={`absolute -left-[31px] top-1.5 w-4 h-4 rounded-full border-2 bg-white flex items-center justify-center transition-all ${
                            isPM ? 'border-indigo-600 ring-4 ring-indigo-50' : 'border-amber-500 ring-4 ring-amber-50'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${isPM ? 'bg-indigo-600' : 'bg-amber-500'}`} />
                          </span>

                          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-3xs group-hover:shadow-xs group-hover:border-slate-300 transition duration-150 space-y-3">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                              <div className="space-y-0.5">
                                <span className="text-[10px] font-mono font-bold text-slate-400 block tracking-tight uppercase">
                                  {wo.nomorWO}
                                </span>
                                <h4 className="text-xs font-black text-slate-800 leading-snug">
                                  {wo.uraianPekerjaan.replace(/\[PM PREVENTIVE AUTO-GENERATED\]\s*/g, '')}
                                </h4>
                              </div>
                              <div className="flex gap-1.5 shrink-0">
                                {isPM ? (
                                  <span className="bg-indigo-50 text-indigo-800 border border-indigo-200 text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md">
                                    PREVENTIVE (PM)
                                  </span>
                                ) : (
                                  <span className="bg-amber-50 text-amber-800 border border-amber-200 text-[8px] font-black tracking-wider uppercase px-2 py-0.5 rounded-md">
                                    REACTIVE (PERBAIKAN)
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Content grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px] text-slate-600">
                              <div className="space-y-1.5">
                                <p className="flex items-center gap-1.5">
                                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Tanggal Selesai: <strong className="text-slate-800 font-mono">{workDate} {workTime}</strong></span>
                                </p>
                                <p className="flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-slate-400" />
                                  <span>Teknisi Pelaksana: <strong className="text-slate-800 uppercase">{wo.teknisiDitugaskan.join(', ') || 'Internal Operator'}</strong></span>
                                </p>
                              </div>

                              <div className="space-y-1.5">
                                {wo.sparePartName && (
                                  <p className="flex items-center gap-1.5 bg-emerald-50 text-emerald-850 px-2 py-1 rounded-lg border border-emerald-100 font-medium">
                                    <Wrench className="w-3.5 h-3.5 text-emerald-600" />
                                    <span>Suku Cadang: <strong>{wo.sparePartName} ({wo.sparePartQty || 1} {wo.sparePartQty === 1 ? 'unit' : 'pcs'})</strong></span>
                                  </p>
                                )}
                                <p className="text-slate-500 italic">
                                  Notes: <span className="font-medium text-slate-700 not-italic">"{wo.notes || wo.technicalNotes || 'Selesai sesuai standar operasional.'}"</span>
                                </p>
                              </div>
                            </div>

                            {/* Verification Photos */}
                            {(wo.fotoPlay || wo.fotoFinish || wo.fotoKerusakan || wo.fotoHasilPerbaikan) && (
                              <div className="flex gap-2 pt-1">
                                {(wo.fotoPlay || wo.fotoKerusakan) && (
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Sebelum Perbaikan</span>
                                    <img
                                      src={wo.fotoPlay || wo.fotoKerusakan}
                                      alt="Foto kerusakan awal"
                                      className="w-20 h-16 object-cover rounded-lg border border-slate-200"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}
                                {(wo.fotoFinish || wo.fotoHasilPerbaikan) && (
                                  <div className="space-y-1">
                                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Hasil Selesai</span>
                                    <img
                                      src={wo.fotoFinish || wo.fotoHasilPerbaikan}
                                      alt="Foto hasil akhir"
                                      className="w-20 h-16 object-cover rounded-lg border border-slate-200"
                                      referrerPolicy="no-referrer"
                                    />
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-between items-center shrink-0">
                <span className="text-[10px] text-slate-500 font-semibold font-mono">
                  Sistem Informasi Pemeliharaan Terintegrasi
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAssetForLog(null)}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Tutup Riwayat
                </button>
              </div>
            </div>
          </div>
        );
      })()}

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
