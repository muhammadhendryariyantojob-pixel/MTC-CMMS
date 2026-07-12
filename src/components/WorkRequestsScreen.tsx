import React, { useState } from 'react';
import { WorkRequest, UserProfile, WorkOrder, CompanyBranch, Company } from '../types';
import { generateWRNumber } from '../dbHelper';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import PrintWRModal from './PrintWRModal';
import { hasPermission, exportToExcelCSV } from '../utils';
import { 
  FileText, 
  Plus, 
  Trash2, 
  CheckCircle, 
  XCircle, 
  Search, 
  Calendar, 
  Hammer, 
  User, 
  Tag, 
  Cpu, 
  MapPin, 
  ExternalLink,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  Wrench,
  UserCheck,
  AlertTriangle,
  Printer,
  Download,
  Camera
} from 'lucide-react';

interface WorkRequestsScreenProps {
  requests: WorkRequest[];
  orders: WorkOrder[];
  currentUser: UserProfile;
  branches?: CompanyBranch[];
  companies?: Company[];
  onConvertToWO: (wr: WorkRequest) => void;
  onRefresh: () => void;
}

export default function WorkRequestsScreen({ requests, orders, currentUser, branches = [], companies = [], onConvertToWO, onRefresh }: WorkRequestsScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [masalah, setMasalah] = useState('');
  const [fotoMasalahUrl, setFotoMasalahUrl] = useState('');
  const [tindakan, setTindakan] = useState('');
  const [tanggalArea, setTanggalArea] = useState('');
  const [namaMesin, setNamaMesin] = useState('');
  const [prioritas, setPrioritas] = useState<'rendah' | 'sedang' | 'tinggi' | 'emergency'>('sedang');
  const [tujuan, setTujuan] = useState<'perawatan' | 'inspeksi' | 'perbaikan'>('perbaikan');
  const [tindakanMaintenance, setTindakanMaintenance] = useState<'sendiri' | 'vendor'>('sendiri');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [divisionFilter, setDivisionFilter] = useState('all');
  
  // Date Filters state
  const [filterDay, setFilterDay] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterYear, setFilterYear] = useState('all');

  const getDayMonthYear = (dateStr?: string) => {
    if (!dateStr) return { day: null, month: null, year: null };
    const cleanDate = dateStr.split('T')[0];
    const parts = cleanDate.split(/[-/]/);
    if (parts.length === 3) {
      if (parts[0].length === 4) {
        return {
          day: parseInt(parts[2], 10),
          month: parseInt(parts[1], 10),
          year: parseInt(parts[0], 10)
        };
      } else if (parts[2].length === 4) {
        return {
          day: parseInt(parts[0], 10),
          month: parseInt(parts[1], 10),
          year: parseInt(parts[2], 10)
        };
      }
    }
    return { day: null, month: null, year: null };
  };

  const MONTH_NAMES = [
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  const DAYS = Array.from({ length: 31 }, (_, i) => (i + 1).toString());

  // Extract unique years from requests
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    requests.forEach(r => {
      const { year } = getDayMonthYear(r.tanggalPengajuan);
      if (year) years.add(year.toString());
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [requests]);

  // Extract unique departments/divisions dynamically from requests
  const uniqueDivisions = React.useMemo(() => {
    const divs = new Set<string>();
    requests.forEach(r => {
      if (r.divisiPengaju) divs.add(r.divisiPengaju.trim().toUpperCase());
    });
    if (currentUser.division) {
      divs.add(currentUser.division.trim().toUpperCase());
    }
    return Array.from(divs).sort();
  }, [requests, currentUser.division]);
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [selectedWRToPrint, setSelectedWRToPrint] = useState<WorkRequest | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [evaluatingWR, setEvaluatingWR] = useState<WorkRequest | null>(null);
  const [evalAction, setEvalAction] = useState<'approve' | 'pending' | 'reject'>('approve');
  const [evalReason, setEvalReason] = useState('');
  const [evalSubmitting, setEvalSubmitting] = useState(false);

  // States for Admin Authorization deletion
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authWRId, setAuthWRId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

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

  // Track who is assigned to the corresponding Work Order
  const getWRAssignee = (wrNomor: string) => {
    if (!orders) return null;
    const correspondingWO = orders.find(wo => wo.nomorWR === wrNomor);
    if (!correspondingWO) return null;
    if (correspondingWO.tipePenugasan === 'vendor') {
      return { type: 'Vendor', name: correspondingWO.namaVendor, status: correspondingWO.status };
    }
    if (correspondingWO.teknisiDitugaskan && correspondingWO.teknisiDitugaskan.length > 0) {
      return { type: 'Teknisi', name: correspondingWO.teknisiDitugaskan.join(', '), status: correspondingWO.status };
    }
    return { type: 'Teknisi', name: 'Belum Ditunjuk', status: correspondingWO.status };
  };

  // Can the current user create WR? 
  const canCreateWR = hasPermission(currentUser, 'canCreateWR');

  // Can the current user manage WR (approve/reject/convert/delete)?
  const canApprove = hasPermission(currentUser, 'canApprove');
  const canReject = hasPermission(currentUser, 'canReject');
  const canDeleteWR = hasPermission(currentUser, 'canDeleteWR');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canCreateWR) {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki hak izin untuk membuat Work Request.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }
    if (!masalah.trim() || !tindakan.trim() || !tanggalArea.trim() || !namaMesin.trim()) {
      alert('Mohon lengkapi semua kolom formulir.');
      return;
    }

    setSubmitting(true);
    setFeedbackMsg('');

    try {
      // Auto-generate WR Number
      const companyId = currentUser.companyId || 'default';
      const docId = await generateWRNumber(currentUser.division || 'DEPT', companyId, requests);
      const safeDocId = docId.replace(/\//g, '-');
      const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const today = getLocalDateString();

      const newWR: WorkRequest = {
        id: safeDocId,
        nomorWR: docId,
        masalah: masalah.trim(),
        fotoMasalahUrl: fotoMasalahUrl.trim() || undefined,
        tindakan: tindakan.trim(),
        namaPengaju: currentUser.name,
        tanggalArea: tanggalArea.trim(),
        namaMesin: namaMesin.trim(),
        tanggalPengajuan: today,
        divisiPengaju: currentUser.division || 'DEPT',
        status: 'pending',
        createdAt: new Date().toISOString(),
        prioritas: prioritas,
        tujuan: tujuan,
        tindakanMaintenance: tindakanMaintenance,
        companyId: currentUser.companyId || 'default',
        cabangId: currentUser.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'work_requests', safeDocId), newWR);

      setMasalah('');
      setFotoMasalahUrl('');
      setTindakan('');
      setTanggalArea('');
      setNamaMesin('');
      setPrioritas('sedang');
      setTujuan('perbaikan');
      setTindakanMaintenance('sendiri');
      setShowAddForm(false);
      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Berhasil',
        message: `Work Request (WR) dengan nomor ${docId} berhasil dikirim dan disimpan.`,
        confirmLabel: 'OK',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Error Pengiriman',
        message: 'Gagal mengirim Work Request. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (wrId: string, newStatus: 'approved' | 'rejected') => {
    setDialogConfig({
      isOpen: true,
      title: 'Perbarui Status WR',
      message: `Apakah Anda yakin ingin mengubah status WR ini menjadi ${newStatus.toUpperCase()}?`,
      confirmLabel: 'Ya, Perbarui',
      cancelLabel: 'Batal',
      variant: 'info',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await updateDoc(doc(db, 'work_requests', wrId), { status: newStatus });
          onRefresh();
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal memperbarui status Work Request.',
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

  const handleDelete = async (wrId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Work Request',
      message: 'Apakah Anda yakin ingin menghapus Work Request (WR) ini? Tindakan ini bersifat permanen.',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'work_requests', wrId));
          onRefresh();
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal menghapus Work Request dari database.',
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

  const handleAuthDeleteClick = async (wrId: string) => {
    setAuthWRId(wrId);
    setAuthError('');
    setAdminPin('');
    setSelectedAdminId('');
    setAuthLoading(true);
    setShowAuthModal(true);
    try {
      // Fetch all admins and management users
      const q = query(
        collection(db, 'users'),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      const fetchedAdmins: UserProfile[] = [];
      snap.forEach(docSnap => {
        const u = docSnap.data() as UserProfile;
        // Check if user is admin, management, or has explicit canDeleteWR permission
        if (u.role === 'admin' || u.role === 'management' || u.canDeleteWR === true) {
          fetchedAdmins.push(u);
        }
      });
      setAdmins(fetchedAdmins);
      if (fetchedAdmins.length > 0) {
        setSelectedAdminId(fetchedAdmins[0].username);
      }
    } catch (err) {
      console.error(err);
      setAuthError('Gagal memuat daftar Administrator.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDeleteClick = (wrId: string) => {
    if (canDeleteWR) {
      handleDelete(wrId);
    } else {
      handleAuthDeleteClick(wrId);
    }
  };

  const handleVerifyAndPostDelete = async () => {
    if (!selectedAdminId) {
      setAuthError('Silakan pilih Administrator pemberi izin.');
      return;
    }
    if (!adminPin) {
      setAuthError('Silakan masukkan PIN keamanan.');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const adminUser = admins.find(a => a.username === selectedAdminId);
      if (!adminUser || adminUser.pin !== adminPin) {
        setAuthError('PIN Keamanan salah atau tidak cocok.');
        setAuthLoading(false);
        return;
      }

      // If correct, perform deletion
      if (authWRId) {
        await deleteDoc(doc(db, 'work_requests', authWRId));
        setShowAuthModal(false);
        onRefresh();
        
        // Show success notification
        setDialogConfig({
          isOpen: true,
          title: 'Berhasil Dihapus',
          message: `Work Request berhasil dihapus atas otorisasi dari ${adminUser.name}.`,
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err) {
      console.error(err);
      setAuthError('Terjadi kesalahan saat menghapus data.');
    } finally {
      setAuthLoading(false);
    }
  };

  // Filter requests
  const filteredRequests = requests.filter(r => {
    // Role & Division based visibility guard
    const isSpecialRole = currentUser.role === 'admin' || currentUser.role === 'management';
    const isAssociated = isSpecialRole || 
      r.divisiPengaju.toUpperCase() === currentUser.division.toUpperCase() ||
      r.namaPengaju.toLowerCase() === currentUser.name.toLowerCase() ||
      r.namaPengaju.toLowerCase() === currentUser.username.toLowerCase();

    if (!isAssociated) return false;

    const matchesSearch = 
      r.nomorWR.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.namaMesin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.masalah.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.namaPengaju.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    
    const matchesDivision = divisionFilter === 'all' || (r.divisiPengaju && r.divisiPengaju.toUpperCase() === divisionFilter.toUpperCase());

    const { day, month, year } = getDayMonthYear(r.tanggalPengajuan);
    const matchesDay = filterDay === 'all' || (day !== null && day === parseInt(filterDay, 10));
    const matchesMonth = filterMonth === 'all' || (month !== null && month === parseInt(filterMonth, 10));
    const matchesYear = filterYear === 'all' || (year !== null && year === parseInt(filterYear, 10));

    return matchesSearch && matchesStatus && matchesDivision && matchesDay && matchesMonth && matchesYear;
  });

  const getWRStatusBadge = (status: string) => {
    switch(status) {
      case 'pending':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Menunggu</span>;
      case 'approved':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Disetujui</span>;
      case 'converted':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Selesai / WO</span>;
      case 'rejected':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Ditolak</span>;
      default:
        return null;
    }
  };

  const handleExportExcel = () => {
    const headers = [
      'Nomor WR', 'Nama Mesin', 'Tanggal Pengajuan', 'Nama Pengaju', 
      'Divisi Pengaju', 'Status', 'Prioritas', 'Tujuan', 
      'Tindakan Maintenance', 'Tanggal Area', 'Masalah', 'Tindakan'
    ];
    const keys = [
      'nomorWR', 'namaMesin', 'tanggalPengajuan', 'namaPengaju',
      'divisiPengaju', 'status', 'prioritas', 'tujuan',
      'tindakanMaintenance', 'tanggalArea', 'masalah', 'tindakan'
    ];
    exportToExcelCSV(filteredRequests, headers, keys, `Laporan_Work_Requests_Filter_${statusFilter}_${divisionFilter}_Tgl_${filterDay}-${filterMonth}-${filterYear}`);
  };

  return (
    <div className="space-y-6" id="wr-screen-container">
      
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900" id="wr-header-panel">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Pengelola Work Request (WR)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Ajukan perbaikan atau kelola antrean laporan masalah mesin tiap departemen.
          </p>
        </div>
        {canCreateWR && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            id="btn-toggle-wr-form"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Batal Pengajuan' : 'Buat WR Baru'}
          </button>
        )}
      </div>

      {feedbackMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs flex items-center gap-2 font-semibold" id="wr-feedback-banner">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          {feedbackMsg}
        </div>
      )}

      {/* Slide / Dropdown Add WR Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn" id="wr-new-form-modal">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn relative flex flex-col p-6 space-y-6" id="wr-new-form-container">
            <button 
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center pr-8" id="wr-form-title-bar">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-blue-600" />
                Formulir Work Request Baru
              </h3>
              <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600 hidden sm:inline-block">
                PENGAJU: {currentUser.name} ({currentUser.division})
              </span>
            </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-5" id="wr-creation-form">
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-blue-500" />
                  Nama Mesin / Asset <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wr-machine"
                  type="text"
                  required
                  placeholder="Contoh: Mesin Pack-A, Crane 02, Motor Blower"
                  value={namaMesin}
                  onChange={(e) => setNamaMesin(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-blue-500" />
                  Area / Lokasi Kerja <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wr-area"
                  type="text"
                  required
                  placeholder="Contoh: Area Produksi Line 3"
                  value={tanggalArea}
                  onChange={(e) => setTanggalArea(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-blue-500" />
                  Uraian Masalah (Masalahan) <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="form-wr-issue"
                  required
                  rows={2}
                  placeholder="Jelaskan kendala atau kerusakan mesin secara detail..."
                  value={masalah}
                  onChange={(e) => setMasalah(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition resize-none"
                />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-blue-500" />
                  Foto Masalah <span className="text-slate-400 font-normal lowercase">(opsional)</span>
                </label>
                <input
                  id="form-wr-foto"
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 5 * 1024 * 1024) {
                        alert('Ukuran file terlalu besar! Maksimal 5MB.');
                        return;
                      }
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setFotoMasalahUrl(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    } else {
                      setFotoMasalahUrl('');
                    }
                  }}
                  className="block w-full text-xs text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer border border-slate-200 rounded-lg p-1.5 bg-slate-50"
                />
                {fotoMasalahUrl && (
                  <div className="mt-3 relative inline-block">
                    <img src={fotoMasalahUrl} alt="Preview" className="w-32 h-32 object-cover rounded-lg border border-slate-200" />
                    <button 
                      type="button" 
                      onClick={() => setFotoMasalahUrl('')} 
                      className="absolute -top-2 -right-2 bg-red-500 hover:bg-red-600 text-white rounded-full p-1"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Hammer className="w-3.5 h-3.5 text-blue-500" />
                  Usulan Tindakan Perbaikan <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wr-action"
                  type="text"
                  required
                  placeholder="Contoh: Bongkar Dinamo / Ganti bearing rotor / Periksa wiring"
                  value={tindakan}
                  onChange={(e) => setTindakan(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-blue-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5" id="form-wr-extra-fields">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Tujuan Pekerjaan <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                  {[
                    { value: 'perawatan', label: 'Perawatan' },
                    { value: 'inspeksi', label: 'Inspeksi' },
                    { value: 'perbaikan', label: 'Perbaikan' }
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="tujuan"
                        value={opt.value}
                        checked={tujuan === opt.value}
                        onChange={() => setTujuan(opt.value as any)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Tindakan Maintenance <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-wrap items-center gap-4 bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                  {[
                    { value: 'sendiri', label: 'Dikerjakan Sendiri' },
                    { value: 'vendor', label: 'Perlu: PP / PJL' }
                  ].map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 text-xs text-slate-700 font-medium cursor-pointer">
                      <input
                        type="radio"
                        name="tindakanMaintenance"
                        value={opt.value}
                        checked={tindakanMaintenance === opt.value}
                        onChange={() => setTindakanMaintenance(opt.value as any)}
                        className="text-blue-600 focus:ring-blue-500"
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div className="md:col-span-2 bg-slate-50 p-4 rounded-xl border border-slate-250 space-y-2.5" id="form-wr-priority-container">
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
                      id={`btn-wr-select-priority-${opt.value}`}
                    >
                      <span className="text-[11px] font-bold block">{opt.label}</span>
                      <span className="text-[9px] text-slate-400 block mt-0.5">{opt.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-2 border-t border-slate-100 pt-4 flex justify-end gap-2" id="wr-form-actions">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-submit-new-wr"
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                {submitting ? 'Mengirim...' : 'Kirim Pengajuan WR'}
              </button>
            </div>
          </form>
        </div>
        </div>
      )}

      {/* Filters Box */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-xs" id="wr-filters-panel">
        
        {/* Top Controls: Search, Export, View Toggle */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96 flex-shrink-0" id="wr-search-wrapper">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              id="wr-search-input"
              type="text"
              placeholder="Cari nomor WR, mesin, masalah, atau pengaju..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
              id="btn-export-wr-excel"
              title="Unduh Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" id="wr-view-mode-toggle">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`px-2 py-1.5 rounded-md transition flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                  viewMode === 'grid' 
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200' 
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
                title="Tampilan Terkotak2"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">KOTAK</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-2 py-1.5 rounded-md transition flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                  viewMode === 'list' 
                    ? 'bg-white text-blue-600 shadow-xs border border-slate-200' 
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
                title="Tampilan Baris"
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden md:inline">BARIS</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Controls: Filters */}
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-3">
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-blue-500 transition cursor-pointer uppercase min-w-[120px]"
          >
            <option value="all">SEMUA DIVISI</option>
            {uniqueDivisions.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
             <Calendar className="w-3.5 h-3.5 text-slate-400 ml-1 hidden sm:block" />
             <select
               value={filterDay}
               onChange={(e) => setFilterDay(e.target.value)}
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 transition cursor-pointer"
             >
               <option value="all">Hari</option>
               {DAYS.map(d => (
                 <option key={d} value={d}>{d}</option>
               ))}
             </select>
             <select
               value={filterMonth}
               onChange={(e) => setFilterMonth(e.target.value)}
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 transition cursor-pointer"
             >
               <option value="all">Bulan</option>
               {MONTH_NAMES.map(m => (
                 <option key={m.value} value={m.value}>{m.label}</option>
               ))}
             </select>
             <select
               value={filterYear}
               onChange={(e) => setFilterYear(e.target.value)}
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-blue-500 transition cursor-pointer"
             >
               <option value="all">Tahun</option>
               {availableYears.map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
            {['all', 'pending', 'approved', 'converted', 'rejected'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition uppercase cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-white shadow-sm border border-slate-200 text-blue-700' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
                id={`filter-wr-${status}`}
              >
                {status === 'all' ? 'SEMUA' : status}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Work Requests Grid/List content */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2 shadow-xs" id="wr-empty-results">
          <FileText className="w-8 h-8 text-slate-300 mx-auto" />
          <p>Tidak ditemukan Work Request yang sesuai dengan kriteria filter.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4" id="wr-cards-grid">
          {filteredRequests.map((wr) => {
            const assignee = getWRAssignee(wr.nomorWR);
            return (
              <div key={wr.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition p-5 shadow-xs hover:shadow-sm duration-200 flex flex-col justify-between" id={`wr-card-item-${wr.id}`}>
                
                <div className="space-y-4" id="wr-card-content">
                   {/* ID Header Row */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3" id="wr-card-header">
                    <div>
                      <span className="text-xs font-bold font-mono text-slate-800 tracking-wide">{wr.nomorWR}</span>
                      <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-500 font-mono">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{wr.tanggalPengajuan}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5" id="wr-card-badges">
                      {getWRStatusBadge(wr.status)}
                      {getPriorityBadge(wr.prioritas)}
                    </div>
                  </div>

                  {/* Machine and Area details */}
                  <div className="grid grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-150" id="wr-card-machine-area">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block font-semibold">Nama Mesin</span>
                      <span className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5">
                        <Cpu className="w-3.5 h-3.5 text-blue-500" />
                        {wr.namaMesin}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase tracking-wide block font-semibold">Area / Lokasi Kerja</span>
                      <span className="text-xs text-slate-700 font-mono truncate block mt-0.5" title={wr.tanggalArea}>
                        {wr.tanggalArea}
                      </span>
                    </div>
                  </div>

                  {/* Problem and Actions details */}
                  <div className="space-y-2 text-xs" id="wr-card-text">
                    <div className="p-3 bg-slate-50/55 rounded-lg border border-slate-100">
                      <strong className="text-slate-500 block mb-0.5">Permasalahan (Masalahan):</strong>
                      <span className="text-slate-700 block italic leading-relaxed">"{wr.masalah}"</span>
                      {wr.fotoMasalahUrl && (
                        <div className="mt-3">
                          <a href={wr.fotoMasalahUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 hover:border-blue-300 transition-colors rounded-lg font-medium text-[10px]">
                            <Camera className="w-3.5 h-3.5" />
                            Lihat Foto Lampiran
                          </a>
                        </div>
                      )}
                    </div>
                    
                    <div className="p-3 bg-slate-50/55 rounded-lg border border-slate-100">
                      <strong className="text-slate-500 block mb-0.5">Tindakan Usulan:</strong>
                      <span className="text-slate-700 block">{wr.tindakan}</span>
                    </div>
                  </div>

                  {/* Assignee Information (Requirement 5!) */}
                  {assignee && (
                    <div className="bg-amber-50 border border-amber-200/60 p-3 rounded-xl flex items-center justify-between text-xs text-amber-900 shadow-2xs">
                      <span className="flex items-center gap-1.5 font-bold text-[11px]">
                        <UserCheck className="w-4 h-4 text-amber-600 animate-pulse" />
                        Pekerja: <strong className="text-amber-800 font-extrabold ml-0.5">{assignee.name}</strong>
                      </span>
                      <span className="text-[9px] bg-amber-100/80 px-2 py-0.5 rounded-full font-mono uppercase font-black text-amber-800 border border-amber-200">
                        {assignee.type} • {assignee.status}
                      </span>
                    </div>
                  )}

                  {wr.status === 'pending' && wr.alasanPending && (
                    <div className="bg-amber-50/80 border border-amber-200 p-3 rounded-xl text-xs text-amber-900 shadow-2xs space-y-1">
                      <span className="flex items-center gap-1.5 font-bold text-[11px] text-amber-800">
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        Ditunda (Pending):
                      </span>
                      <p className="italic pl-5">"{wr.alasanPending}"</p>
                    </div>
                  )}

                  {wr.status === 'rejected' && wr.alasanDitolak && (
                    <div className="bg-rose-50/80 border border-rose-200 p-3 rounded-xl text-xs text-rose-950 shadow-2xs space-y-1">
                      <span className="flex items-center gap-1.5 font-bold text-[11px] text-rose-800">
                        <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Alasan Ditolak:
                      </span>
                      <p className="italic pl-5">"{wr.alasanDitolak}"</p>
                    </div>
                  )}

                  {/* Submitter Info */}
                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 justify-between items-center bg-slate-50/40 px-3 py-1.5 rounded-lg border border-slate-100" id="wr-card-submitter">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Pengaju: <strong className="text-slate-600">{wr.namaPengaju}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Tag className="w-3.5 h-3.5 text-slate-400" />
                      Divisi: <strong className="text-slate-600">{wr.divisiPengaju}</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-100">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      Cabang: <strong className="text-rose-800">{wr.cabangId === 'pusat' || !wr.cabangId ? 'Pusat' : (branches.find(b => b.id === wr.cabangId)?.name || 'Pusat')}</strong>
                    </span>
                  </div>
                </div>

                {/* Action Buttons Row */}
                <div className="mt-5 pt-3 border-t border-slate-100 flex flex-wrap justify-between items-center gap-2" id="wr-card-actions">
                  <div className="flex gap-2" id="wr-management-actions">
                    {canApprove && wr.status === 'pending' && (
                      <button
                        onClick={() => {
                          setEvaluatingWR(wr);
                          setEvalAction('approve');
                          setEvalReason(wr.alasanPending || '');
                        }}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                        id={`btn-evaluate-wr-${wr.id}`}
                      >
                        <UserCheck className="w-3.5 h-3.5" /> Evaluasi / Proses WR
                      </button>
                    )}
                    {canApprove && wr.status === 'approved' && (
                      <button
                        onClick={() => {
                          onConvertToWO(wr);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3.5 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                        id={`btn-convert-wr-${wr.id}`}
                      >
                        <Wrench className="w-3.5 h-3.5" /> Terbitkan WO
                      </button>
                    )}
                    {wr.status === 'converted' && (
                      <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600" /> WO Telah Diterbitkan
                      </span>
                    )}
                    {wr.status === 'rejected' && (
                      <span className="text-[10px] text-rose-700 bg-rose-50 border border-rose-200 px-3 py-1.5 rounded-lg font-mono font-bold flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5 text-rose-500" /> Ditolak oleh Management
                      </span>
                    )}
                  </div>

                  <button
                    onClick={() => {
                      setSelectedWRToPrint(wr);
                      setIsPrintModalOpen(true);
                    }}
                    className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-3 py-2 rounded-lg transition flex items-center gap-1 cursor-pointer"
                    title="Cetak PDF"
                    id={`btn-print-wr-card-${wr.id}`}
                  >
                    <Printer className="w-3.5 h-3.5" /> Cetak PDF
                  </button>

                  {wr.status !== 'approved' && wr.status !== 'converted' && (
                    <button
                      onClick={() => handleDeleteClick(wr.id)}
                      className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                      title="Hapus Work Request"
                      id={`btn-delete-wr-${wr.id}`}
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
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-xs" id="wr-list-container">
          <table className="w-full text-left border-collapse" id="wr-list-table">
            <thead>
              <tr className="bg-slate-50 text-[10px] text-slate-400 font-extrabold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3 px-4">No. WR</th>
                <th className="py-3 px-4">Tanggal</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4">Nama Mesin</th>
                <th className="py-3 px-4">Prioritas</th>
                <th className="py-3 px-4">Masalah</th>
                <th className="py-3 px-4">Pekerja Tugas</th>
                <th className="py-3 px-4">Pengaju</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredRequests.map((wr) => {
                const assignee = getWRAssignee(wr.nomorWR);
                return (
                  <tr key={wr.id} className="hover:bg-slate-50/50 transition duration-150" id={`wr-row-item-${wr.id}`}>
                    <td className="py-3.5 px-4 font-bold font-mono text-slate-800 text-[11px]">{wr.nomorWR}</td>
                    <td className="py-3.5 px-4 text-slate-400 font-mono text-[10px]">{wr.tanggalPengajuan}</td>
                    <td className="py-3.5 px-4 font-semibold text-rose-700">
                      <span className="bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold text-[9px] flex items-center gap-0.5 w-max">
                        <MapPin className="w-3 h-3 text-rose-500" />
                        {wr.cabangId === 'pusat' || !wr.cabangId ? 'Pusat' : (branches.find(b => b.id === wr.cabangId)?.name || 'Pusat')}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-bold text-slate-700">{wr.namaMesin}</td>
                    <td className="py-3.5 px-4">{getPriorityBadge(wr.prioritas)}</td>
                    <td className="py-3.5 px-4 max-w-xs truncate text-slate-600" title={wr.masalah}>{wr.masalah}</td>
                    <td className="py-3.5 px-4">
                      {assignee ? (
                        <div className="flex flex-col">
                          <span className="font-extrabold text-amber-800 text-[10px]">{assignee.name}</span>
                          <span className="text-[8px] text-slate-400 -mt-0.5">{assignee.type} • {assignee.status}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic text-[10px]">Belum Ada WO</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-slate-500">
                      <div className="font-semibold text-slate-700">{wr.namaPengaju}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{wr.divisiPengaju}</div>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-col gap-1">
                        {getWRStatusBadge(wr.status)}
                        {wr.status === 'pending' && wr.alasanPending && (
                          <span className="text-[9px] text-amber-700 bg-amber-50 border border-amber-100 px-1.5 py-0.5 rounded font-medium max-w-[150px] truncate" title={`Ditunda: ${wr.alasanPending}`}>
                            PND: {wr.alasanPending}
                          </span>
                        )}
                        {wr.status === 'rejected' && wr.alasanDitolak && (
                          <span className="text-[9px] text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-medium max-w-[150px] truncate" title={`Ditolak: ${wr.alasanDitolak}`}>
                            TLK: {wr.alasanDitolak}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex justify-end items-center gap-1.5">
                        {canApprove && wr.status === 'pending' && (
                          <button
                            onClick={() => {
                              setEvaluatingWR(wr);
                              setEvalAction('approve');
                              setEvalReason(wr.alasanPending || '');
                            }}
                            className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                            title="Evaluasi / Proses WR"
                          >
                            Proses
                          </button>
                        )}
                        {canApprove && wr.status === 'approved' && (
                          <button
                            onClick={() => {
                              onConvertToWO(wr);
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition cursor-pointer"
                            title="Terbitkan WO"
                          >
                            Terbitkan WO
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedWRToPrint(wr);
                            setIsPrintModalOpen(true);
                          }}
                          className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[10px] font-bold px-2 py-1 rounded-md transition flex items-center gap-1 cursor-pointer"
                          title="Cetak PDF"
                          id={`btn-print-wr-row-${wr.id}`}
                        >
                          <Printer className="w-3.5 h-3.5" /> Cetak
                        </button>
                        {wr.status !== 'approved' && wr.status !== 'converted' && (
                          <button
                            onClick={() => handleDeleteClick(wr.id)}
                            className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded-md transition cursor-pointer"
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

      {selectedWRToPrint && (
        <PrintWRModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedWRToPrint(null);
          }}
          wr={selectedWRToPrint}
          companies={companies}
          branches={branches}
          currentUser={currentUser}
          onDelete={() => {
            setIsPrintModalOpen(false);
            handleDeleteClick(selectedWRToPrint.id);
          }}
        />
      )}

      {evaluatingWR && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4" id="eval-wr-modal">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50 shrink-0">
              <div>
                <h3 className="font-sans font-bold text-slate-900 text-sm">Evaluasi & Persetujuan WR</h3>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5">{evaluatingWR.nomorWR} | {evaluatingWR.namaMesin}</p>
              </div>
              <button
                onClick={() => setEvaluatingWR(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-5 flex-1 overflow-y-auto">
              {/* Option Selector */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2.5">Pilih Tindakan:</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEvalAction('approve');
                      setEvalReason('');
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      evalAction === 'approve'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800 font-bold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs">Setujui</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvalAction('pending');
                      setEvalReason(evaluatingWR.alasanPending || '');
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      evalAction === 'pending'
                        ? 'bg-amber-50 border-amber-400 text-amber-800 font-bold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs">Pending</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEvalAction('reject');
                      setEvalReason(evaluatingWR.alasanDitolak || '');
                    }}
                    className={`py-2.5 px-3 rounded-lg border text-center transition flex flex-col items-center justify-center gap-1 cursor-pointer ${
                      evalAction === 'reject'
                        ? 'bg-rose-50 border-rose-400 text-rose-800 font-bold'
                        : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                    }`}
                  >
                    <XCircle className="w-4 h-4 text-rose-500" />
                    <span className="text-xs">Tolak</span>
                  </button>
                </div>
              </div>

              {/* Textarea for reasons */}
              {evalAction !== 'approve' && (
                <div className="space-y-1.5 animate-fadeIn">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                    Alasan {evalAction === 'pending' ? 'Ditangguhkan (Pending)' : 'Penolakan'} <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={evalReason}
                    onChange={(e) => setEvalReason(e.target.value)}
                    placeholder={`Tulis alasan mengapa perbaikan mesin ini harus di-${evalAction === 'pending' ? 'tunda' : 'tolak'}...`}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none text-slate-800 font-medium"
                  />
                  <p className="text-[10px] text-slate-400 italic">Wajib diisi agar pengaju mengetahui status perbaikan secara transparan.</p>
                </div>
              )}

              {evalAction === 'approve' && (
                <div className="bg-emerald-50 border border-emerald-200/60 p-3 rounded-xl flex items-start gap-2 text-xs text-emerald-800 animate-fadeIn">
                  <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Informasi:</span> Menyetujui WR ini akan memperbarui statusnya menjadi disetujui, lalu Anda akan diarahkan ke halaman pembuatan Work Order (WO) untuk melengkapi penugasan teknisi/vendor.
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setEvaluatingWR(null)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={evalSubmitting || (evalAction !== 'approve' && !evalReason.trim())}
                onClick={async () => {
                  setEvalSubmitting(true);
                  try {
                    if (evalAction === 'approve') {
                      await updateDoc(doc(db, 'work_requests', evaluatingWR.id), {
                        status: 'approved',
                        alasanPending: '',
                        alasanDitolak: ''
                      });
                      setEvaluatingWR(null);
                      onConvertToWO({
                        ...evaluatingWR,
                        status: 'approved',
                        alasanPending: '',
                        alasanDitolak: ''
                      });
                    } else if (evalAction === 'pending') {
                      await updateDoc(doc(db, 'work_requests', evaluatingWR.id), {
                        status: 'pending',
                        alasanPending: evalReason,
                        alasanDitolak: ''
                      });
                      setEvaluatingWR(null);
                      onRefresh();
                    } else if (evalAction === 'reject') {
                      await updateDoc(doc(db, 'work_requests', evaluatingWR.id), {
                        status: 'rejected',
                        alasanDitolak: evalReason,
                        alasanPending: ''
                      });
                      setEvaluatingWR(null);
                      onRefresh();
                    }
                  } catch (err) {
                    console.error('Error saving evaluation:', err);
                    alert('Gagal menyimpan keputusan.');
                  } finally {
                    setEvalSubmitting(false);
                  }
                }}
                className={`px-5 py-2 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer ${
                  evalAction === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800'
                    : evalAction === 'pending'
                    ? 'bg-amber-600 hover:bg-amber-500 disabled:bg-amber-800'
                    : 'bg-rose-600 hover:bg-rose-500 disabled:bg-rose-800'
                }`}
              >
                {evalSubmitting ? 'Menyimpan...' : evalAction === 'approve' ? 'Setujui & Buat WO' : evalAction === 'pending' ? 'Simpan Pending' : 'Simpan Tolak'}
              </button>
            </div>

          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" id="auth-delete-wr-modal">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-rose-50 text-rose-600 rounded-lg border border-rose-100 animate-pulse">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-sm">Otorisasi Administrator</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Penghapusan memerlukan persetujuan</p>
                </div>
              </div>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                disabled={authLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Akun Anda saat ini tidak memiliki izin langsung untuk menghapus Work Request. Silakan hubungi Administrator atau Management untuk memberikan otorisasi lewat PIN mereka di bawah ini.
              </p>

              {authError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              {authLoading && admins.length === 0 ? (
                <div className="py-4 text-center text-xs text-slate-500 font-mono">
                  Memuat daftar Administrator...
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Pilih Administrator:</label>
                    <select
                      value={selectedAdminId}
                      onChange={(e) => setSelectedAdminId(e.target.value)}
                      disabled={authLoading}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition text-slate-800 font-medium cursor-pointer"
                    >
                      {admins.length === 0 ? (
                        <option value="">Tidak ada Administrator aktif</option>
                      ) : (
                        admins.map(admin => (
                          <option key={admin.username} value={admin.username}>
                            {admin.name} ({admin.role === 'admin' ? 'Super Admin' : 'Management'} - {admin.subRole || admin.username})
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">Masukkan PIN Keamanan:</label>
                    <input
                      type="password"
                      maxLength={10}
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                      placeholder="Masukkan PIN Admin"
                      disabled={authLoading}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition text-slate-850 font-mono tracking-widest text-center"
                    />
                    <p className="text-[10px] text-slate-400 mt-1 italic">PIN Keamanan harus diinput oleh pemilik akun Administrator.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                disabled={authLoading}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleVerifyAndPostDelete}
                disabled={authLoading || admins.length === 0 || !adminPin}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-500 disabled:bg-rose-400 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1"
              >
                {authLoading ? 'Memproses...' : 'Izinkan & Hapus'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
