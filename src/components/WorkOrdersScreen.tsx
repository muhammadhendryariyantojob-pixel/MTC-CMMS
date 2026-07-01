import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkRequest, UserProfile, CompanyBranch, Company } from '../types';
import { generateWONumber } from '../dbHelper';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import PrintWOModal from './PrintWOModal';
import { hasPermission, exportToExcelCSV } from '../utils';
import { 
  Wrench, 
  Plus, 
  Trash2, 
  Play, 
  CheckCircle, 
  Search, 
  Calendar, 
  Cpu, 
  MapPin, 
  User, 
  Building2, 
  Users, 
  FileEdit, 
  Clock, 
  Clipboard,
  X,
  LayoutGrid,
  List,
  SlidersHorizontal,
  AlertTriangle,
  Printer,
  Download
} from 'lucide-react';

interface WorkOrdersScreenProps {
  orders: WorkOrder[];
  requests: WorkRequest[];
  users?: UserProfile[];
  technicians: UserProfile[];
  currentUser: UserProfile;
  branches?: CompanyBranch[];
  companies?: Company[];
  pendingConvertWR: WorkRequest | null;
  onCancelConvert: () => void;
  onRefresh: () => void;
}

export default function WorkOrdersScreen({ 
  orders, 
  requests,
  users = [],
  technicians, 
  currentUser, 
  branches = [],
  companies = [],
  pendingConvertWR, 
  onCancelConvert, 
  onRefresh 
}: WorkOrdersScreenProps) {
  
  const [showAddForm, setShowAddForm] = useState(!!pendingConvertWR);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [area, setArea] = useState(pendingConvertWR ? pendingConvertWR.tanggalArea : '');
  const [namaMesin, setNamaMesin] = useState(pendingConvertWR ? pendingConvertWR.namaMesin : '');
  const [jenisTindakan, setJenisTindakan] = useState(pendingConvertWR ? pendingConvertWR.tindakan : '');
  const [uraianPekerjaan, setUraianPekerjaan] = useState(pendingConvertWR ? pendingConvertWR.masalah : '');
  const [prioritas, setPrioritas] = useState<'rendah' | 'sedang' | 'tinggi' | 'emergency'>(pendingConvertWR?.prioritas || 'sedang');
  
  const [tipePenugasan, setTipePenugasan] = useState<'teknisi' | 'vendor'>('teknisi');
  const [namaVendor, setNamaVendor] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  useEffect(() => {
    if (pendingConvertWR) {
      setArea(pendingConvertWR.tanggalArea || '');
      setNamaMesin(pendingConvertWR.namaMesin || '');
      setJenisTindakan(pendingConvertWR.tindakan || '');
      setUraianPekerjaan(pendingConvertWR.masalah || '');
      setPrioritas(pendingConvertWR.prioritas || 'sedang');
      setShowAddForm(true);
    }
  }, [pendingConvertWR]);

  const getPriorityBadge = (p?: 'rendah' | 'sedang' | 'tinggi' | 'emergency') => {
    const level = p || 'sedang';
    switch (level) {
      case 'rendah':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
            Rendah
          </span>
        );
      case 'sedang':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
            Sedang
          </span>
        );
      case 'tinggi':
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
            Tinggi
          </span>
        );
      case 'emergency':
        return (
          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-0.5 rounded-full font-black flex items-center gap-1 uppercase animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            EMERGENCY
          </span>
        );
      default:
        return null;
    }
  };
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [submitting, setSubmitting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState<{ [woId: string]: string }>({});
  const [playPhotoBase64, setPlayPhotoBase64] = useState<{ [woId: string]: string }>({});
  const [finishPhotoBase64, setFinishPhotoBase64] = useState<{ [woId: string]: string }>({});
  const [selectedWOToPrint, setSelectedWOToPrint] = useState<WorkOrder | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
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

  const isTechnician = currentUser.role === 'teknisi';
  const isAdmin = currentUser.role === 'admin';

  const canCreateWO = hasPermission(currentUser, 'canCreateWO');
  const canDeleteWO = hasPermission(currentUser, 'canDeleteWO');
  const canApprove = hasPermission(currentUser, 'canApprove');
  const canReject = hasPermission(currentUser, 'canReject');
  const canAssignTeknisi = hasPermission(currentUser, 'canAssignTeknisi');
  const canPlayWork = hasPermission(currentUser, 'canPlayWork');
  const canFinishWork = hasPermission(currentUser, 'canFinishWork');

  // Toggle technicians selection
  const handleToggleTechnician = (techName: string) => {
    if (selectedTechnicians.includes(techName)) {
      setSelectedTechnicians(selectedTechnicians.filter(t => t !== techName));
    } else {
      setSelectedTechnicians([...selectedTechnicians, techName]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateWO) {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki hak izin untuk membuat atau menerbitkan Work Order.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    if (!area.trim() || !namaMesin.trim() || !jenisTindakan.trim() || !uraianPekerjaan.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon lengkapi seluruh kolom formulir Work Order.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (tipePenugasan === 'vendor' && !namaVendor.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Data Vendor Belum Ada',
        message: 'Silakan masukkan nama Vendor untuk penugasan vendor.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (tipePenugasan === 'teknisi' && selectedTechnicians.length === 0) {
      setDialogConfig({
        isOpen: true,
        title: 'Teknisi Belum Dipilih',
        message: 'Silakan pilih minimal 1 Teknisi untuk penugasan teknisi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setSubmitting(true);

    try {
      const companyId = currentUser.companyId || 'default';
      const woId = await generateWONumber(companyId, orders);
      const safeWoId = woId.replace(/\//g, '-');
      const today = new Date().toISOString().split('T')[0];

      const newWO: WorkOrder = {
        id: safeWoId,
        nomorWO: woId,
        nomorWR: pendingConvertWR ? pendingConvertWR.nomorWR : 'DIRECT-MTC',
        tanggalWO: today,
        area: area.trim(),
        namaMesin: namaMesin.trim(),
        jenisTindakan: jenisTindakan.trim(),
        uraianPekerjaan: uraianPekerjaan.trim(),
        tipePenugasan,
        namaVendor: tipePenugasan === 'vendor' ? namaVendor.trim() : '',
        teknisiDitugaskan: tipePenugasan === 'teknisi' ? selectedTechnicians : [],
        diajukanOleh: currentUser.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        prioritas: prioritas,
        companyId: currentUser.companyId || 'default',
        cabangId: pendingConvertWR?.cabangId || currentUser.cabangId || 'pusat'
      };

      // Save Work Order
      await setDoc(doc(db, 'work_orders', safeWoId), newWO);

      // If converted from WR, update the WR status in Firestore
      if (pendingConvertWR) {
        await updateDoc(doc(db, 'work_requests', pendingConvertWR.id), {
          status: 'converted'
        });
        onCancelConvert(); // reset pending WR trigger
      }

      // Reset form
      setArea('');
      setNamaMesin('');
      setJenisTindakan('');
      setUraianPekerjaan('');
      setNamaVendor('');
      setSelectedTechnicians([]);
      setPrioritas('sedang');
      setShowAddForm(false);
      
      onRefresh();
      setDialogConfig({
        isOpen: true,
        title: 'Berhasil',
        message: `Work Order (WO) dengan nomor ${woId} berhasil diterbitkan dan disimpan.`,
        confirmLabel: 'Hebat',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Penerbitan Gagal',
        message: 'Gagal menerbitkan Work Order. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Technician: Play (Start) Work
  const handlePlayWork = async (woId: string) => {
    if (currentUser.role !== 'teknisi' && currentUser.role !== 'admin') {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Hanya Teknisi dan Administrator yang diperbolehkan untuk memulai pekerjaan.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const photo = playPhotoBase64[woId] || '';
      
      await updateDoc(doc(db, 'work_orders', woId), {
        status: 'di_kerjakan',
        playAt: nowStr,
        fotoPlay: photo
      });
      onRefresh();
      setDialogConfig({
        isOpen: true,
        title: 'Pekerjaan Dimulai',
        message: 'Status pekerjaan diubah ke: DI KERJAKAN. Waktu mulai pengerjaan telah dicatat.',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal',
        message: 'Gagal memperbarui status pekerjaan untuk dimulai.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  // Technician/Management: Finish Work
  const handleFinishWork = async (woId: string) => {
    if (currentUser.role !== 'teknisi' && currentUser.role !== 'admin') {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Hanya Teknisi dan Administrator yang diperbolehkan untuk menyelesaikan pekerjaan.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const notes = completionNotes[woId] || '';
    if (!notes.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Catatan Belum Diisi',
        message: 'Silakan isi catatan penyelesaian / tindakan akhir terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const photo = finishPhotoBase64[woId] || '';
      
      await updateDoc(doc(db, 'work_orders', woId), {
        status: 'selesai',
        finishAt: nowStr,
        notes: notes.trim(),
        fotoFinish: photo
      });
      
      // Notify associated people (bersangkutan) and thank technician
      const wo = orders.find(o => o.id === woId);
      const refWR = wo ? requests.find(r => r.id === wo.nomorWR || r.nomorWR === wo.nomorWR) : null;
      
      // Find reporter and technician emails
      const reporterName = refWR?.namaPengaju || '';
      const technicianName = currentUser.name;
      
      const reporterUser = users.find(u => u.name.toLowerCase() === reporterName.toLowerCase() || u.username.toLowerCase() === reporterName.toLowerCase());
      const reporterEmail = reporterUser?.email || '';
      const technicianEmail = currentUser.email || '';
      
      let emailNotificationMessage = '';
      if (reporterEmail || technicianEmail) {
        emailNotificationMessage = `\n\n📧 [NOTIFIKASI EMAIL TERKIRIM]`;
        if (reporterEmail) {
          emailNotificationMessage += `\n- Ke Reporter (${reporterName}): ${reporterEmail}`;
        }
        if (technicianEmail) {
          emailNotificationMessage += `\n- Ke Teknisi (${technicianName}): ${technicianEmail}`;
        }
        emailNotificationMessage += `\n\n"Halo, Pekerjaan WO ${wo?.nomorWO || woId} telah selesai dikerjakan dengan catatan: '${notes.trim()}'. Terima kasih banyak atas dedikasinya!"`;
      } else {
        emailNotificationMessage = `\n\n💡 (Petunjuk: Masukkan email di menu 'Kelola Pengguna' pada akun Administrator untuk mengaktifkan pengiriman notifikasi email otomatis).`;
      }

      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Pekerjaan Selesai & Sukses!',
        message: `Laporan penyelesaian berhasil dikirim! Status Work Order diperbarui menjadi SELESAI.\n\n🎉 TERIMA KASIH BANYAK DAN TETAP SEMANGAT UNTUK TEKNISI KITA, KAK ${technicianName.toUpperCase()}! 💪🛠️\nKerja bagus, jaga keselamatan, dan semoga hari Anda luar biasa!${emailNotificationMessage}`,
        confirmLabel: 'Sama-sama, Semangat!',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal',
        message: 'Gagal menyelesaikan pekerjaan di sistem.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleDelete = async (woId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Work Order',
      message: 'Apakah Anda yakin ingin menghapus Work Order (WO) ini? Tindakan ini bersifat permanen.',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'work_orders', woId));
          onRefresh();
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal menghapus Work Order dari database.',
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

  // Filter WO
  // Filter WO based on user role and association
  const filteredOrders = orders.filter(o => {
    // Check association/permission
    const isSpecialRole = currentUser.role === 'admin' || currentUser.role === 'management';
    
    let isAssociated = isSpecialRole;
    
    if (!isSpecialRole) {
      if (currentUser.role === 'teknisi') {
        // Is this technician assigned?
        const myNameLower = currentUser.name.toLowerCase();
        const myUsernameLower = currentUser.username.toLowerCase();
        isAssociated = o.teknisiDitugaskan.some(tech => 
          tech.toLowerCase() === myNameLower || 
          tech.toLowerCase() === myUsernameLower
        );
      } else if (currentUser.role === 'departemen') {
        // Is this department the creator of the WR?
        const refRequest = requests.find(r => r.id === o.nomorWR || r.nomorWR === o.nomorWR);
        const refDivisionMatches = refRequest && refRequest.divisiPengaju.toUpperCase() === currentUser.division.toUpperCase();
        
        isAssociated = !!refDivisionMatches || 
          o.area.toUpperCase().includes(currentUser.division.toUpperCase()) ||
          o.diajukanOleh.toLowerCase() === currentUser.name.toLowerCase() ||
          o.diajukanOleh.toLowerCase() === currentUser.username.toLowerCase();
      }
    }

    if (!isAssociated) return false;

    const matchesSearch = 
      o.nomorWO.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.namaMesin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.nomorWR.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleExportExcel = () => {
    const headers = [
      'Nomor WO', 'Nomor WR', 'Tanggal WO', 'Nama Mesin', 'Area', 
      'Jenis Tindakan', 'Uraian Pekerjaan', 'Tipe Penugasan', 
      'Vendor', 'Teknisi Ditugaskan', 'Diajukan Oleh', 'Status', 
      'Mulai Kerja', 'Selesai Kerja', 'Catatan / Penjelasan', 'Prioritas'
    ];
    const keys = [
      'nomorWO', 'nomorWR', 'tanggalWO', 'namaMesin', 'area',
      'jenisTindakan', 'uraianPekerjaan', 'tipePenugasan',
      'namaVendor', 'teknisiDitugaskan', 'diajukanOleh', 'status',
      'playAt', 'finishAt', 'notes', 'prioritas'
    ];
    exportToExcelCSV(filteredOrders, headers, keys, `Laporan_Work_Orders_Filter_${statusFilter}`);
  };

  return (
    <div className="space-y-6" id="wo-screen-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" id="wo-header-panel">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-600" />
            Pengelola Work Order (WO)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pantau progres perbaikan oleh teknisi internal maupun vendor eksternal secara real-time.
          </p>
        </div>
        
        {canCreateWO && (
          <button
            onClick={() => {
              if (pendingConvertWR) onCancelConvert();
              setShowAddForm(!showAddForm);
            }}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            id="btn-toggle-wo-form"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Batal Terbit WO' : 'Terbitkan WO Manual'}
          </button>
        )}
      </div>

      {/* Active WR Conversion Alert */}
      {pendingConvertWR && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-xs" id="conversion-alert">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Sedang Memproses Konversi WR ke WO</h4>
            <p className="text-[11px] text-slate-600">
              Mengonversi WR: <strong className="font-mono text-slate-900">{pendingConvertWR.nomorWR}</strong> | Mesin: <strong className="text-slate-900">{pendingConvertWR.namaMesin}</strong>
            </p>
          </div>
          <button 
            onClick={onCancelConvert}
            className="text-[10px] bg-white border border-slate-200 px-2.5 py-1.5 rounded-md text-slate-700 hover:text-slate-900 shadow-xs cursor-pointer"
          >
            Batalkan Konversi
          </button>
        </div>
      )}

      {/* Add / Edit Form */}
      {(showAddForm || pendingConvertWR) && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6" id="wo-creation-form-box">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center" id="wo-form-header">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" />
              Penerbitan Work Order Baru
            </h3>
            <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600">
              REFERENSI WR: {pendingConvertWR ? pendingConvertWR.nomorWR : 'MTC MANUAL'}
            </span>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="wo-form">
            
            {/* Left Side fields */}
            <div className="space-y-4" id="wo-form-left-col">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  Nama Mesin / Asset <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wo-machine"
                  type="text"
                  required
                  value={namaMesin}
                  onChange={(e) => setNamaMesin(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  placeholder="Nama mesin yang bermasalah"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                  Area / Lokasi Kerja <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wo-area"
                  type="text"
                  required
                  value={area}
                  onChange={(e) => setArea(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  placeholder="Area / lokasi pengerjaan"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                  Jenis Tindakan Perbaikan <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wo-action-type"
                  type="text"
                  required
                  value={jenisTindakan}
                  onChange={(e) => setJenisTindakan(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  placeholder="Tindakan awal, e.g. Kalibrasi, Overhaul, Penggantian Filter"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Clipboard className="w-3.5 h-3.5 text-indigo-500" />
                  Uraian Detail Pekerjaan <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="form-wo-description"
                  required
                  rows={2}
                  value={uraianPekerjaan}
                  onChange={(e) => setUraianPekerjaan(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                  placeholder="Tuliskan kendala teknis dan petunjuk perbaikan..."
                />
              </div>
            </div>

            {/* Right Side: Assignment Options */}
            <div className="space-y-4" id="wo-form-right-col">
              {!canAssignTeknisi ? (
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 text-center text-xs space-y-2 text-slate-500 py-10">
                  <SlidersHorizontal className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="font-bold text-slate-700 uppercase tracking-wide">Izin Penugasan Dibatasi</p>
                  <p className="max-w-xs mx-auto text-[11px] leading-relaxed">Anda tidak memiliki hak izin dari Administrator untuk menunjuk teknisi atau pihak vendor eksternal.</p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-3">
                      PILIH OPSI PENUGASAN MAINTENANCE
                    </label>
                    <div className="grid grid-cols-2 gap-3" id="wo-assignment-type-toggles">
                      <button
                        type="button"
                        onClick={() => setTipePenugasan('teknisi')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition text-center cursor-pointer ${
                          tipePenugasan === 'teknisi' 
                            ? 'bg-indigo-50 border-indigo-400 text-indigo-700' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                        id="btn-assign-tech-type"
                      >
                        <Users className="w-5 h-5 text-indigo-500" />
                        <span className="text-xs font-bold">Teknisi Internal</span>
                        <span className="text-[10px] text-slate-500">MTC Division Staff</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTipePenugasan('vendor')}
                        className={`p-3 rounded-xl border flex flex-col items-center gap-1 transition text-center cursor-pointer ${
                          tipePenugasan === 'vendor' 
                            ? 'bg-amber-50 border-amber-400 text-amber-700' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
                        }`}
                        id="btn-assign-vendor-type"
                      >
                        <Building2 className="w-5 h-5 text-amber-500" />
                        <span className="text-xs font-bold">Vendor Eksternal</span>
                        <span className="text-[10px] text-slate-500">Pihak Ketiga</span>
                      </button>
                    </div>
                  </div>

                  {/* Vendor Subform */}
                  {tipePenugasan === 'vendor' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fadeIn" id="wo-vendor-fields">
                      <label className="block text-xs font-semibold text-amber-700 uppercase tracking-wider flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-amber-500" />
                        Nama Vendor Pelaksana <span className="text-red-500">*</span>
                      </label>
                      <input
                        id="form-wo-vendor-name"
                        type="text"
                        required={tipePenugasan === 'vendor'}
                        value={namaVendor}
                        onChange={(e) => setNamaVendor(e.target.value)}
                        className="block w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-amber-500 transition"
                        placeholder="Contoh: PT. Sumber Makmur Mandiri, CV. Tekno Listrik"
                      />
                    </div>
                  )}

                  {/* Technician Subform */}
                  {tipePenugasan === 'teknisi' && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 animate-fadeIn" id="wo-tech-fields">
                      <label className="block text-xs font-semibold text-indigo-700 uppercase tracking-wider flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-indigo-500" />
                        Pilih Satu atau Lebih Teknisi <span className="text-red-500">*</span>
                      </label>
                      
                      {technicians.length === 0 ? (
                        <p className="text-slate-500 text-xs italic">Belum ada akun teknisi aktif yang terdaftar.</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1" id="tech-selection-grid">
                          {technicians.map((t) => {
                            const isSelected = selectedTechnicians.includes(t.name);
                            return (
                              <button
                                key={t.username}
                                type="button"
                                onClick={() => handleToggleTechnician(t.name)}
                                className={`p-2 rounded-lg border text-left text-xs font-semibold transition ${
                                  isSelected 
                                    ? 'bg-indigo-100 border-indigo-400 text-indigo-700' 
                                    : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                                }`}
                                id={`select-tech-${t.username}`}
                              >
                                <p className="truncate">{t.name}</p>
                                <p className="text-[9px] text-slate-500 font-mono truncate">{t.subRole}</p>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="lg:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-200/85 space-y-2.5" id="form-wo-priority-container">
              <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Skala Prioritas Pekerjaan <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { value: 'rendah', label: 'Rendah (Low)', desc: 'Biasa / Non-Urgent', activeColor: 'bg-emerald-50 border-emerald-400 text-emerald-800' },
                  { value: 'sedang', label: 'Sedang (Medium)', desc: 'Perbaikan Normal', activeColor: 'bg-indigo-50 border-indigo-400 text-indigo-800' },
                  { value: 'tinggi', label: 'Tinggi (High)', desc: 'Segera Ditangani', activeColor: 'bg-amber-50 border-amber-400 text-amber-800' },
                  { value: 'emergency', label: 'Emergency (Critical)', desc: 'Stop Line / Bahaya', activeColor: 'bg-rose-50 border-rose-450 text-rose-800' },
                ].map((opt) => {
                  const isSelected = prioritas === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPrioritas(opt.value as any)}
                      className={`p-3 rounded-lg border text-left cursor-pointer transition flex flex-col justify-between ${
                        isSelected 
                          ? `${opt.activeColor} border-2 shadow-xs` 
                          : 'bg-white border-slate-200 hover:bg-slate-100 text-slate-600'
                      }`}
                      id={`btn-wo-select-priority-${opt.value}`}
                    >
                      <span className="text-[11px] font-bold block">{opt.label}</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Submit and cancel row */}
            <div className="lg:col-span-2 border-t border-slate-100 pt-4 flex justify-end gap-2" id="wo-form-actions">
              <button
                type="button"
                onClick={() => {
                  if (pendingConvertWR) onCancelConvert();
                  setShowAddForm(false);
                }}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-submit-new-wo"
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                {submitting ? 'Mengirim...' : 'Terbitkan Work Order'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Filters Box */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col xl:flex-row xl:items-center gap-4 justify-between shadow-xs" id="wo-filters-panel">
        
        <div className="relative flex-1 max-w-md" id="wo-search-wrapper">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            id="wo-search-input"
            type="text"
            placeholder="Cari nomor WO, nomor WR, mesin, area..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2" id="wo-status-filters-box">
          <span className="text-xs text-slate-500 flex items-center gap-1 mr-1">
            Status:
          </span>
          {['all', 'pending', 'di_kerjakan', 'selesai'].map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition uppercase cursor-pointer ${
                statusFilter === status 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
              id={`filter-wo-${status}`}
            >
              {status === 'all' ? 'SEMUA' : status.replace('_', ' ')}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start xl:self-auto" id="wo-actions-wrapper">
          <button
            type="button"
            onClick={handleExportExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold rounded-lg shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
            id="btn-export-wo-excel"
          >
            <Download className="w-3.5 h-3.5" />
            <span>UNDUH EXCEL</span>
          </button>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" id="wo-view-mode-toggle">
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                viewMode === 'grid' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Terkotak2"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>KOTAK</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition flex items-center gap-1 text-[11px] font-bold cursor-pointer ${
                viewMode === 'list' 
                  ? 'bg-white text-indigo-600 shadow-xs' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              title="Tampilan Berbaris"
            >
              <List className="w-3.5 h-3.5" />
              <span>BARIS</span>
            </button>
          </div>
        </div>
      </div>

      {/* Work Orders List / Cards / Table */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2 shadow-xs" id="wo-empty-results">
          <Wrench className="w-8 h-8 text-slate-300 mx-auto" />
          <p>Tidak ditemukan Work Order yang sesuai dengan filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* Grid Mode (Terkotak-kotak) */
        <div className="space-y-4" id="wo-cards-container">
          {filteredOrders.map((wo) => {
            const isAssignedVendor = wo.tipePenugasan === 'vendor';
            
            return (
              <div key={wo.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs space-y-4 hover:border-slate-300 transition duration-200" id={`wo-item-${wo.id}`}>
                
                {/* ID and Status Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3" id="wo-item-header">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-sm font-bold font-mono text-slate-800">{wo.nomorWO}</span>
                      <span className="text-[10px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded border border-slate-200 font-mono">
                        Ref WR: {wo.nomorWR}
                      </span>
                      <span className="text-[10px] bg-rose-50 text-rose-700 px-2 py-0.5 rounded border border-rose-150 font-bold flex items-center gap-0.5">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        Cabang: {wo.cabangId === 'pusat' || !wo.cabangId ? 'Pusat' : (branches.find(b => b.id === wo.cabangId)?.name || 'Pusat')}
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      Diterbitkan: {wo.tanggalWO} | Pengaju WO: {wo.diajukanOleh}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {getPriorityBadge(wo.prioritas)}
                    {wo.status === 'pending' && (
                      <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-mono uppercase font-bold">Pending</span>
                    )}
                    {wo.status === 'di_kerjakan' && (
                      <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-1 rounded-full font-mono uppercase font-bold flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 animate-spin" /> Sedang Dikerjakan
                      </span>
                    )}
                    {wo.status === 'selesai' && (
                      <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-mono uppercase font-bold">Selesai / Teratasi</span>
                    )}
                  </div>
                </div>

                {/* Core Job Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs" id="wo-item-details-grid">
                  <div className="space-y-2">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Mesin & Area</span>
                      <p className="font-bold text-slate-800 mt-0.5 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                        {wo.namaMesin}
                      </p>
                      <p className="text-slate-600 text-[11px] flex items-center gap-1 mt-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {wo.area}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tindakan Maintenance</span>
                      <p className="text-slate-700 font-medium mt-0.5">{wo.jenisTindakan}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 h-full">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Uraian Masalah & Petunjuk Kerja</span>
                      <p className="text-slate-700 mt-1 leading-relaxed italic">"{wo.uraianPekerjaan}"</p>
                    </div>
                  </div>
                </div>

                {/* Executer Info */}
                <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-xs" id="wo-item-assigned">
                  <div className="flex items-center gap-2">
                    {isAssignedVendor ? (
                      <>
                        <Building2 className="w-4 h-4 text-amber-500" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Pelaksana (Vendor Luar)</p>
                          <p className="font-bold text-amber-700">{wo.namaVendor}</p>
                        </div>
                      </>
                    ) : (
                      <>
                        <Users className="w-4 h-4 text-indigo-500" />
                        <div>
                          <p className="text-[10px] text-slate-400 uppercase font-bold">Pelaksana (Teknisi MTC)</p>
                          <p className="font-bold text-indigo-700">{wo.teknisiDitugaskan.join(', ')}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Dates logs if any */}
                  <div className="text-[10px] text-slate-400 font-mono space-y-0.5 text-left sm:text-right" id="wo-item-dates">
                    {wo.playAt && <p>Mulai: <span className="text-slate-700 font-bold">{wo.playAt}</span></p>}
                    {wo.finishAt && <p>Selesai: <span className="text-emerald-700 font-bold">{wo.finishAt}</span></p>}
                  </div>
                </div>

                {/* Closing Notes display if Completed */}
                {wo.status === 'selesai' && wo.notes && (
                  <div className="p-3 bg-emerald-50 border border-emerald-100 text-emerald-800 rounded-xl text-xs" id="wo-item-closure">
                    <strong className="block text-[10px] text-emerald-600 uppercase tracking-wide">Catatan Penyelesaian:</strong>
                    <p className="mt-0.5">"{wo.notes}"</p>
                  </div>
                )}

                {/* Photo Attachments */}
                {(wo.fotoPlay || wo.fotoFinish) && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50/50 rounded-xl border border-slate-200 text-xs" id={`wo-photos-gallery-${wo.id}`}>
                    {wo.fotoPlay && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">📸 Foto Mulai Kerja:</span>
                        <img 
                          src={wo.fotoPlay} 
                          alt="Mulai" 
                          className="w-full h-24 object-cover rounded-lg border border-slate-200 shadow-xs" 
                        />
                      </div>
                    )}
                    {wo.fotoFinish && (
                      <div className="space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">📸 Foto Selesai Kerja:</span>
                        <img 
                          src={wo.fotoFinish} 
                          alt="Selesai" 
                          className="w-full h-24 object-cover rounded-lg border border-slate-200 shadow-xs" 
                        />
                      </div>
                    )}
                  </div>
                )}

                {/* ACTIONS BAR FOR WO */}
                <div className="pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-3" id="wo-item-actions-bar">
                  
                  <div className="flex-1 max-w-md" id="wo-item-actions-left">
                    {/* For Vendor option - finished by authorized technicians / administrator */}
                    {isAssignedVendor && wo.status !== 'selesai' && canFinishWork && (
                      <div className="flex gap-2 items-center">
                        <input
                          id={`input-notes-vendor-${wo.id}`}
                          type="text"
                          placeholder="Tulis laporan pengerjaan vendor..."
                          value={completionNotes[wo.id] || ''}
                          onChange={(e) => setCompletionNotes({ ...completionNotes, [wo.id]: e.target.value })}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white flex-1"
                        />
                        <button
                          onClick={() => handleFinishWork(wo.id)}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                          id={`btn-done-vendor-${wo.id}`}
                        >
                          Selesaikan Vendor (Done)
                        </button>
                      </div>
                    )}

                    {/* For Technician Option - play / finish by assigned technicians / administrator */}
                    {!isAssignedVendor && wo.status === 'pending' && canPlayWork && (
                      <div className="space-y-2 max-w-sm" id={`wo-play-actions-${wo.id}`}>
                        <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">📸 Tambah Foto Mulai (Optional):</span>
                          <input 
                             type="file" 
                             accept="image/*"
                             onChange={(e) => {
                               const file = e.target.files ? e.target.files[0] : null;
                               if (file) {
                                 const reader = new FileReader();
                                 reader.onloadend = () => {
                                   setPlayPhotoBase64(prev => ({ ...prev, [wo.id]: reader.result as string }));
                                 };
                                 reader.readAsDataURL(file);
                               } else {
                                 setPlayPhotoBase64(prev => ({ ...prev, [wo.id]: '' }));
                               }
                             }}
                             className="text-[9px] text-slate-600 block w-full"
                          />
                        </div>
                        <button
                          onClick={() => handlePlayWork(wo.id)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                          id={`btn-play-tech-${wo.id}`}
                        >
                          <Play className="w-3.5 h-3.5" /> Start Kerja (Mulai Pekerjaan)
                        </button>
                      </div>
                    )}

                    {/* If in progress and assigned to technician */}
                    {!isAssignedVendor && wo.status === 'di_kerjakan' && canFinishWork && (
                      <div className="space-y-2 w-full max-w-md" id={`wo-finish-actions-${wo.id}`}>
                        <div className="flex flex-col gap-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide">📸 Tambah Foto Selesai (Optional):</span>
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files ? e.target.files[0] : null;
                              if (file) {
                                const reader = new FileReader();
                                reader.onloadend = () => {
                                  setFinishPhotoBase64(prev => ({ ...prev, [wo.id]: reader.result as string }));
                                };
                                reader.readAsDataURL(file);
                              } else {
                                setFinishPhotoBase64(prev => ({ ...prev, [wo.id]: '' }));
                              }
                            }}
                            className="text-[9px] text-slate-600 block w-full"
                          />
                        </div>
                        <div className="flex gap-2 items-center">
                          <input
                            id={`input-notes-tech-${wo.id}`}
                            type="text"
                            placeholder="Tulis ulasan tindakan perbaikan..."
                            value={completionNotes[wo.id] || ''}
                            onChange={(e) => setCompletionNotes({ ...completionNotes, [wo.id]: e.target.value })}
                            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white flex-1"
                          />
                          <button
                            onClick={() => handleFinishWork(wo.id)}
                            className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition shrink-0 cursor-pointer shadow-xs"
                            id={`btn-finish-tech-${wo.id}`}
                          >
                            Laporkan Selesai (Finish)
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWOToPrint(wo);
                      setIsPrintModalOpen(true);
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-3 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Cetak PDF"
                    id={`btn-print-wo-card-${wo.id}`}
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak PDF
                  </button>

                  {/* Admin actions (Delete) */}
                  {canDeleteWO && (
                    <button
                      onClick={() => handleDelete(wo.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                      title="Hapus Work Order"
                      id={`btn-delete-wo-${wo.id}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}

                </div>

              </div>
            );
          })}
        </div>
      ) : (
        /* List Mode (Berbaris) */
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs" id="wo-list-container">
          <table className="w-full text-left border-collapse" id="wo-list-table">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">No. WO (Ref WR)</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4">Mesin & Lokasi</th>
                <th className="py-3 px-4">Prioritas</th>
                <th className="py-3 px-4">Tindakan & Uraian</th>
                <th className="py-3 px-4">Pelaksana Ditunjuk</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Laporan & Pengerjaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredOrders.map((wo) => {
                const isAssignedVendor = wo.tipePenugasan === 'vendor';
                return (
                  <tr key={wo.id} className="hover:bg-slate-50/50 transition duration-150" id={`wo-row-item-${wo.id}`}>
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-800 text-[11px]">
                      <div>{wo.nomorWO}</div>
                      <div className="text-[9px] text-slate-400">Ref: {wo.nomorWR}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">{wo.tanggalWO}</td>
                    <td className="py-3.5 px-4 font-semibold text-rose-700">
                      <span className="bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 w-max">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        {wo.cabangId === 'pusat' || !wo.cabangId ? 'Pusat' : (branches.find(b => b.id === wo.cabangId)?.name || 'Pusat')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700">
                      <div>{wo.namaMesin}</div>
                      <div className="text-[10px] text-slate-400 font-normal">{wo.area}</div>
                    </td>
                    <td className="py-3.5 px-4">{getPriorityBadge(wo.prioritas)}</td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600">
                      <div className="font-semibold text-slate-800">{wo.jenisTindakan}</div>
                      <div className="text-[10px] text-slate-400 truncate" title={wo.uraianPekerjaan}>"{wo.uraianPekerjaan}"</div>
                    </td>
                    <td className="py-3.5 px-4">
                      {isAssignedVendor ? (
                        <div className="flex flex-col">
                          <span className="font-extrabold text-amber-800 text-[10px]">{wo.namaVendor}</span>
                          <span className="text-[8px] text-slate-400 -mt-0.5">VENDOR EKSTERNAL</span>
                        </div>
                      ) : (
                        <div className="flex flex-col">
                          <span className="font-extrabold text-indigo-800 text-[10px]">{wo.teknisiDitugaskan.join(', ')}</span>
                          <span className="text-[8px] text-slate-400 -mt-0.5">TEKNISI INTERNAL</span>
                        </div>
                      )}
                    </td>
                     <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1">
                          {wo.status === 'pending' && (
                            <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-bold">Pending</span>
                          )}
                          {wo.status === 'di_kerjakan' && (
                            <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3 animate-spin" /> Progress
                            </span>
                          )}
                          {wo.status === 'selesai' && (
                            <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-2 py-0.5 rounded-full font-mono uppercase font-bold">Selesai</span>
                          )}
                        </div>
                        <div className="flex gap-1 flex-wrap">
                          {wo.fotoPlay && (
                            <span className="text-[8px] bg-indigo-50 border border-indigo-100 text-indigo-600 px-1 py-0.5 rounded font-mono font-bold" title="Ada Foto Mulai Kerja">📸 Mulai</span>
                          )}
                          {wo.fotoFinish && (
                            <span className="text-[8px] bg-emerald-50 border border-emerald-100 text-emerald-600 px-1 py-0.5 rounded font-mono font-bold" title="Ada Foto Selesai Kerja">📸 Selesai</span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {/* Start or finish actions */}
                        {isAssignedVendor && wo.status !== 'selesai' && canFinishWork && (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              placeholder="Laporan..."
                              value={completionNotes[wo.id] || ''}
                              onChange={(e) => setCompletionNotes({ ...completionNotes, [wo.id]: e.target.value })}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[10px] focus:outline-none w-28"
                            />
                            <button
                              onClick={() => handleFinishWork(wo.id)}
                              className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-extrabold text-[10px] rounded uppercase cursor-pointer"
                            >
                              Selesai
                            </button>
                          </div>
                        )}

                        {!isAssignedVendor && wo.status === 'pending' && canPlayWork && (
                          <button
                            onClick={() => handlePlayWork(wo.id)}
                            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-[10px] rounded uppercase cursor-pointer flex items-center gap-1"
                          >
                            <Play className="w-3 h-3" /> Start
                          </button>
                        )}

                        {!isAssignedVendor && wo.status === 'di_kerjakan' && canFinishWork && (
                          <div className="flex gap-1.5 items-center">
                            <input
                              type="text"
                              placeholder="Tindakan..."
                              value={completionNotes[wo.id] || ''}
                              onChange={(e) => setCompletionNotes({ ...completionNotes, [wo.id]: e.target.value })}
                              className="px-2 py-1 bg-slate-50 border border-slate-200 rounded text-slate-800 text-[10px] focus:outline-none w-28"
                            />
                            <button
                              onClick={() => handleFinishWork(wo.id)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded uppercase cursor-pointer"
                            >
                              Finish
                            </button>
                          </div>
                        )}

                        {wo.status === 'selesai' && wo.notes && (
                          <span className="text-[10px] text-slate-400 italic max-w-[120px] truncate block" title={wo.notes}>
                            {wo.notes}
                          </span>
                        )}

                        <button
                          onClick={() => {
                            setSelectedWOToPrint(wo);
                            setIsPrintModalOpen(true);
                          }}
                          className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded cursor-pointer flex items-center justify-center"
                          title="Cetak PDF"
                          id={`btn-print-wo-row-${wo.id}`}
                        >
                          <Printer className="w-3 h-3" />
                        </button>

                        {canDeleteWO && (
                          <button
                            onClick={() => handleDelete(wo.id)}
                            className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded cursor-pointer"
                            title="Hapus"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
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

      {selectedWOToPrint && (
        <PrintWOModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedWOToPrint(null);
          }}
          wo={selectedWOToPrint}
          companies={companies}
          branches={branches}
        />
      )}

    </div>
  );
}
