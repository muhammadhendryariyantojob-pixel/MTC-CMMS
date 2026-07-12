import React, { useState, useEffect } from 'react';
import { GoodsRequest, UserProfile, CompanyBranch, Company, GoodsRequestItem, InventoryItem } from '../types';
import { generatePPNumber } from '../dbHelper';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, increment } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import PrintPPModal from './PrintPPModal';
import DetailPPModal from './DetailPPModal';
import { exportToExcelCSV } from '../utils';
import { 
  Package, 
  Plus, 
  Trash2, 
  AlertTriangle,
  CheckCircle, 
  XCircle, 
  Search, 
  Calendar, 
  User, 
  ShoppingBag, 
  CheckSquare, 
  Layers, 
  FileText,
  SlidersHorizontal,
  X,
  LayoutGrid,
  List,
  MapPin,
  Truck,
  FileCheck,
  Download,
  Printer,
  Eye,
  Link as LinkIcon,
  ExternalLink,
  Image as ImageIcon
} from 'lucide-react';

interface GoodsRequestsScreenProps {
  items: GoodsRequest[];
  currentUser: UserProfile;
  branches?: CompanyBranch[];
  companies: Company[];
  onRefresh: () => void;
}

export default function GoodsRequestsScreen({ items, currentUser, branches = [], companies, onRefresh }: GoodsRequestsScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  
  // States for dynamic item inputs
  const [namaBarang, setNamaBarang] = useState('');
  const [jumlah, setJumlah] = useState<number | ''>(1);
  const [satuan, setSatuan] = useState('Pcs');
  const [kegunaan, setKegunaan] = useState('');
  const [selectedInventoryId, setSelectedInventoryId] = useState<string | undefined>(undefined);
  
  // State for multiple items list
  const [localItems, setLocalItems] = useState<GoodsRequestItem[]>([]);

  // Inventory Items
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [showInventorySuggestions, setShowInventorySuggestions] = useState(false);
  
  useEffect(() => {
    const fetchInventory = async () => {
      try {
        const q = query(
          collection(db, 'inventory'),
          where('companyId', '==', currentUser.companyId || 'default')
        );
        const snap = await getDocs(q);
        const itemsList: InventoryItem[] = [];
        snap.forEach(doc => {
          itemsList.push(doc.data() as InventoryItem);
        });
        setInventoryItems(itemsList);
      } catch (err) {
        console.error('Error fetching inventory:', err);
      }
    };
    fetchInventory();
  }, [currentUser.companyId]);

  // Item references state inputs
  const [refLink, setRefLink] = useState('');
  const [refFotoUrl, setRefFotoUrl] = useState('');

  // Selesai / Diambil receiver state inputs
  const [activeReceiverPPId, setActiveReceiverPPId] = useState<string | null>(null);
  const [receiverInput, setReceiverInput] = useState('');

  // Detail modal state
  const [selectedPPDetail, setSelectedPPDetail] = useState<GoodsRequest | null>(null);

  // Print modal states
  const [selectedPPToPrint, setSelectedPPToPrint] = useState<GoodsRequest | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

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

  // Extract unique years from items
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    items.forEach(item => {
      const { year } = getDayMonthYear(item.tanggalPengajuan);
      if (year) years.add(year.toString());
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [items]);

  // Extract unique departments/divisions dynamically from items
  const uniqueDivisions = React.useMemo(() => {
    const divs = new Set<string>();
    items.forEach(g => {
      if (g.divisiPengaju) divs.add(g.divisiPengaju.toUpperCase());
    });
    if (currentUser.division) {
      divs.add(currentUser.division.toUpperCase());
    }
    return Array.from(divs).sort();
  }, [items, currentUser.division]);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<'kotak' | 'baris'>('kotak');
  const [lokasiInput, setLokasiInput] = useState('');
  const [activeLocationPPId, setActiveLocationPPId] = useState<string | null>(null);
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

  // States for Admin Authorization deletion
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authPPId, setAuthPPId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Users who can create: Teknisi, Management, Admin
  const canCreatePP = currentUser.role === 'teknisi' || currentUser.role === 'management' || currentUser.role === 'admin';
  
  // Users who can approve: Management, Admin
  const canApprovePP = currentUser.role === 'management' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!namaBarang.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi nama barang terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (!kegunaan.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi kegunaan / alasan penggantian terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (selectedInventoryId) {
      const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      
      if (selectedInventory && finalJumlah > selectedInventory.stock) {
        setDialogConfig({
          isOpen: true,
          title: 'Stok Tidak Mencukupi',
          message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}). Mohon meminta sesuai stok, atau buat PP biasa dengan menambahkan nama barang menjadi (STOK_${namaBarang}) jika ingin mengajukan sisa kebutuhan di luar inventory.`,
          confirmLabel: 'Mengerti',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    setSubmitting(true);

    try {
      const companyId = currentUser.companyId || 'default';
      const cabangId = currentUser.cabangId || 'pusat';
      const ppId = await generatePPNumber(currentUser.division || 'MTC', companyId, cabangId, items);
      // Append random string to safePpId to ensure uniqueness across branches/companies with the same PP number
      const safePpId = `${ppId.replace(/\//g, '-')}-${Math.floor(Math.random() * 10000)}`;
      const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const today = getLocalDateString();

      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      const singleItem: GoodsRequestItem = {
        namaBarang: namaBarang.trim(),
        jumlah: finalJumlah,
        satuan,
        kegunaan: kegunaan.trim(),
        referensiLink: refLink.trim() || '',
        referensiFotoUrl: refFotoUrl || '',
        ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
      };

      const newPP: GoodsRequest = {
        id: safePpId,
        nomorPP: ppId,
        namaBarang: singleItem.namaBarang,
        jumlah: singleItem.jumlah,
        satuan: singleItem.satuan,
        kegunaan: singleItem.kegunaan,
        itemsList: [singleItem],
        diajukanOleh: currentUser.name || 'Unknown',
        divisiPengaju: currentUser.division || 'MTC',
        tanggalPengajuan: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
        companyId: currentUser.companyId || 'default',
        cabangId: currentUser.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'goods_requests', safePpId), newPP);

      // Decrement inventory stock if it's from inventory
      if (selectedInventoryId) {
        await updateDoc(doc(db, 'inventory', selectedInventoryId), {
          stock: increment(-finalJumlah)
        });

        const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, 'inventory_logs', logId), {
          id: logId,
          inventoryId: selectedInventoryId,
          ppId: ppId,
          change: -finalJumlah,
          reason: `Permintaan Barang (PP): ${ppId}`,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name
        });
      }

      setNamaBarang('');
      setJumlah(1);
      setSatuan('Pcs');
      setKegunaan('');
      setRefLink('');
      setRefFotoUrl('');
      setSelectedInventoryId(undefined);
      setLocalItems([]);
      setShowAddForm(false);
      onRefresh();
      setDialogConfig({
        isOpen: true,
        title: 'Sukses',
        message: `Permintaan barang (PP) dengan nomor ${ppId} berhasil dibuat.`,
        confirmLabel: 'Bagus',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Error',
        message: 'Gagal membuat permintaan barang.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (ppId: string, newStatus: string, optionalParams?: { lokasiBarang?: string; namaPengambil?: string }) => {
    try {
      const updates: any = { status: newStatus };
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      
      if (newStatus === 'disetujui' || newStatus === 'penyetujuan') {
        updates.approvedOleh = currentUser.name;
        updates.approvedAt = nowStr;
      } else if (newStatus === 'pemesanan') {
        updates.orderedOleh = currentUser.name;
        updates.orderedAt = nowStr;
      } else if (newStatus === 'telah_datang') {
        updates.arrivedOleh = currentUser.name;
        updates.arrivedAt = nowStr;
        if (optionalParams?.lokasiBarang) {
          updates.lokasiBarang = optionalParams.lokasiBarang;
        }
      } else if (newStatus === 'selesai' || newStatus === 'selesai_dan_diambil') {
        updates.completedOleh = currentUser.name;
        updates.completedAt = nowStr;
        if (optionalParams?.namaPengambil) {
          updates.namaPengambil = optionalParams.namaPengambil;
        }
      }

      await updateDoc(doc(db, 'goods_requests', ppId), updates);
      onRefresh();
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Error',
        message: 'Gagal memperbarui status permintaan barang.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const handleDelete = async (ppId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Permintaan Barang',
      message: 'Apakah Anda yakin ingin menghapus permintaan barang (PP) ini? Tindakan ini bersifat permanen.',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'goods_requests', ppId));
          onRefresh();
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal menghapus permintaan barang dari database.',
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

  const handleAuthDeleteClick = async (ppId: string) => {
    setAuthPPId(ppId);
    setAuthError('');
    setAdminPin('');
    setSelectedAdminId('');
    setAuthLoading(true);
    setShowAuthModal(true);
    try {
      const q = query(
        collection(db, 'users'),
        where('active', '==', true)
      );
      const snap = await getDocs(q);
      const fetchedAdmins: UserProfile[] = [];
      snap.forEach(docSnap => {
        const u = docSnap.data() as UserProfile;
        if (u.role === 'admin' || u.role === 'management') {
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

  const handleDeleteClick = (pp: GoodsRequest) => {
    const isPending = pp.status === 'pending';
    const canDirectDelete = isAdmin || (currentUser.name === pp.diajukanOleh && isPending);
    if (canDirectDelete) {
      handleDelete(pp.id);
    } else {
      handleAuthDeleteClick(pp.id);
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

      if (authPPId) {
        await deleteDoc(doc(db, 'goods_requests', authPPId));
        setShowAuthModal(false);
        onRefresh();
        
        setDialogConfig({
          isOpen: true,
          title: 'Berhasil Dihapus',
          message: `Permintaan Barang berhasil dihapus atas otorisasi dari ${adminUser.name}.`,
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
  const filteredPP = items.filter(pp => {
    // Role & Division based visibility guard
    const isSpecialRole = currentUser.role === 'admin' || currentUser.role === 'management';
    const isAssociated = isSpecialRole || 
      pp.divisiPengaju.toUpperCase() === currentUser.division.toUpperCase() ||
      pp.diajukanOleh.toLowerCase() === currentUser.name.toLowerCase() ||
      pp.diajukanOleh.toLowerCase() === currentUser.username.toLowerCase();

    if (!isAssociated) return false;

    const matchesSearch = 
      pp.nomorPP.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pp.namaBarang.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pp.diajukanOleh.toLowerCase().includes(searchQuery.toLowerCase()) ||
      pp.kegunaan.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Support backward-compatible matching with old statuses
    let matchesStatus = false;
    if (statusFilter === 'all') {
      matchesStatus = true;
    } else if (statusFilter === 'pending') {
      matchesStatus = pp.status === 'pending' || pp.status === 'permintaan';
    } else if (statusFilter === 'disetujui') {
      matchesStatus = pp.status === 'disetujui' || pp.status === 'penyetujuan';
    } else if (statusFilter === 'selesai') {
      matchesStatus = pp.status === 'selesai' || pp.status === 'selesai_dan_diambil';
    } else {
      matchesStatus = pp.status === statusFilter;
    }
    
    const matchesDivision = divisionFilter === 'all' || (pp.divisiPengaju && pp.divisiPengaju.toUpperCase() === divisionFilter.toUpperCase());

    const { day, month, year } = getDayMonthYear(pp.tanggalPengajuan);
    const matchesDay = filterDay === 'all' || (day !== null && day === parseInt(filterDay, 10));
    const matchesMonth = filterMonth === 'all' || (month !== null && month === parseInt(filterMonth, 10));
    const matchesYear = filterYear === 'all' || (year !== null && year === parseInt(filterYear, 10));

    return matchesSearch && matchesStatus && matchesDivision && matchesDay && matchesMonth && matchesYear;
  });

  const handleExportExcel = () => {
    const headers = [
      'Nomor PP', 'Nama Barang', 'Jumlah', 'Satuan', 'Kegunaan', 
      'Diajukan Oleh', 'Divisi Pengaju', 'Tanggal Pengajuan', 'Status', 
      'Disetujui Oleh', 'Tanggal Disetujui', 'Dipesan Oleh', 'Tanggal Dipesan', 
      'Barang Datang Oleh', 'Tanggal Datang', 'Lokasi Barang', 'Diselesaikan Oleh', 'Tanggal Selesai'
    ];
    const keys = [
      'nomorPP', 'namaBarang', 'jumlah', 'satuan', 'kegunaan',
      'diajukanOleh', 'divisiPengaju', 'tanggalPengajuan', 'status',
      'approvedOleh', 'approvedAt', 'orderedOleh', 'orderedAt',
      'arrivedOleh', 'arrivedAt', 'lokasiBarang', 'completedOleh', 'completedAt'
    ];
    exportToExcelCSV(filteredPP, headers, keys, `Laporan_Permintaan_Barang_Filter_${statusFilter}_${divisionFilter}_Tgl_${filterDay}-${filterMonth}-${filterYear}`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
      case 'permintaan':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">1. Permintaan</span>;
      case 'disetujui':
      case 'penyetujuan':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">2. Penyetujuan</span>;
      case 'pemesanan':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold flex items-center gap-1">
          <Truck className="w-3 h-3" /> 3. Pemesanan
        </span>;
      case 'telah_datang':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-extrabold flex items-center gap-1 animate-pulse">
          <MapPin className="w-3 h-3" /> 4. Telah Datang
        </span>;
      case 'selesai':
      case 'selesai_dan_diambil':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">5. Selesai / Diambil</span>;
      case 'ditolak':
        return <span className="bg-slate-100 text-slate-500 border border-slate-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">Ditolak</span>;
      default:
        return <span className="bg-slate-50 text-slate-500 border border-slate-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono uppercase font-bold">{status}</span>;
    }
  };

  return (
    <div className="space-y-6" id="pp-screen-container">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" id="pp-header-panel">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-600" />
            Permintaan Barang (PP - Sparepart)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Formulir pengadaan suku cadang, oli, gasket, kabel, atau material penunjang divisi maintenance.
          </p>
        </div>
        {canCreatePP && (
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            id="btn-toggle-pp-form"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Batal Permintaan' : 'Minta Barang Baru'}
          </button>
        )}
      </div>

      {/* Add Request Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-fadeIn" id="pp-new-form-modal">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scaleIn relative flex flex-col p-6 space-y-6" id="pp-creation-form-box">
            <button 
              onClick={() => setShowAddForm(false)}
              className="absolute top-4 right-4 p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-full transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="border-b border-slate-100 pb-3 flex justify-between items-center pr-8" id="pp-form-header">
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-500" />
                Formulir Permintaan Suku Cadang / Barang
              </h3>
              <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600 hidden sm:inline-block">
                DIVISI: {currentUser.division} | PEMINTA: {currentUser.name}
              </span>
            </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5" id="pp-form">
            
            <div className="md:col-span-2 space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                  Nama Barang / Sparepart <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-pp-item-name"
                  type="text"
                  value={namaBarang}
                  onChange={(e) => {
                    setNamaBarang(e.target.value);
                    setSelectedInventoryId(undefined);
                    setShowInventorySuggestions(true);
                  }}
                  onFocus={() => setShowInventorySuggestions(true)}
                  onBlur={() => setTimeout(() => setShowInventorySuggestions(false), 200)}
                  placeholder="Contoh: Bearing SKF 6204, Oli Hydraulics T46, Kabel NYY 3x2.5"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
                {showInventorySuggestions && namaBarang.trim().length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {inventoryItems.filter(item => item.name.toLowerCase().includes(namaBarang.toLowerCase()) || item.code.toLowerCase().includes(namaBarang.toLowerCase())).length > 0 ? (
                      inventoryItems.filter(item => item.name.toLowerCase().includes(namaBarang.toLowerCase()) || item.code.toLowerCase().includes(namaBarang.toLowerCase())).map(item => (
                        <div
                          key={item.id}
                          className="px-3 py-2 cursor-pointer hover:bg-emerald-50 border-b border-slate-100 last:border-0"
                          onClick={() => {
                            setNamaBarang(item.name);
                            setSatuan(item.unit || 'Pcs');
                            setSelectedInventoryId(item.id);
                            setShowInventorySuggestions(false);
                          }}
                        >
                          <div className="text-xs font-semibold text-slate-800">{item.name}</div>
                          <div className="text-[10px] text-slate-500 flex justify-between mt-0.5">
                            <span>Kode: {item.code}</span>
                            <span className={item.stock > 0 ? "text-emerald-600 font-medium" : "text-red-500 font-medium"}>
                              Stok: {item.stock} {item.unit}
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-slate-500 text-center">
                        Barang tidak ditemukan di inventory. Permintaan akan dibuat sebagai barang baru.
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <FileText className="w-3.5 h-3.5 text-emerald-500" />
                  Kegunaan / Alasan Penggantian <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-pp-purpose"
                  type="text"
                  value={kegunaan}
                  onChange={(e) => setKegunaan(e.target.value)}
                  placeholder="Contoh: Untuk penggantian rotor conveyor Line A, stok cadangan panel"
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Jumlah <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-pp-quantity"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={jumlah === '' ? '' : jumlah}
                    onChange={(e) => {
                      const cleanVal = e.target.value.replace(/[^0-9]/g, '');
                      setJumlah(cleanVal === '' ? '' : parseInt(cleanVal, 10));
                    }}
                    onBlur={() => {
                      if (jumlah === '' || jumlah <= 0) {
                        setJumlah(1);
                      }
                    }}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                    placeholder="Contoh: 5"
                  />
                  {selectedInventoryId && (
                    <div className="mt-1.5 text-[10px] text-slate-500 font-medium">
                      Sisa stok di inventory: <span className="text-emerald-600 font-bold">{inventoryItems.find(i => i.id === selectedInventoryId)?.stock || 0} {satuan}</span>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Satuan <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-pp-unit"
                    value={satuan}
                    onChange={(e) => setSatuan(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition cursor-pointer"
                  >
                    {['Pcs', 'Box', 'Meter', 'Batang', 'Set', 'Can/Canister', 'Liter', 'Roll', 'KG', 'Ton', 'Pack', 'Drum'].includes(satuan) ? null : <option value={satuan}>{satuan}</option>}
                    {['Pcs', 'Box', 'Meter', 'Batang', 'Set', 'Can/Canister', 'Liter', 'Roll', 'KG', 'Ton', 'Pack', 'Drum'].map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Reference Link */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <LinkIcon className="w-3 h-3 text-emerald-500" />
                  Link Referensi / Spek Barang (Opsional)
                </label>
                <input
                  type="text"
                  value={refLink}
                  onChange={(e) => setRefLink(e.target.value)}
                  placeholder="https://contoh.com/barang-anda"
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-emerald-500 focus:bg-white transition"
                />
              </div>

              {/* Reference Photo */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-500" />
                  Foto Referensi Barang (Opsional, Maks 800 KB)
                </label>
                <div className="flex items-center gap-2">
                  <label className="flex-1 flex flex-col items-center justify-center border border-dashed border-slate-200 hover:border-slate-300 rounded-lg p-2 bg-slate-50 hover:bg-slate-100 transition cursor-pointer text-[10px] font-bold text-slate-500 text-center">
                    <span>{refFotoUrl ? '✔ Foto Referensi Terpilih' : 'Upload Foto Barang'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 800000) {
                          setDialogConfig({
                            isOpen: true,
                            title: 'File Terlalu Besar',
                            message: 'Ukuran file foto maksimal adalah 800 KB.',
                            confirmLabel: 'Tutup',
                            alertOnly: true,
                            variant: 'warning',
                            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
                          });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          setRefFotoUrl(ev.target?.result as string);
                        };
                        reader.readAsDataURL(file);
                      }}
                      className="hidden"
                    />
                  </label>
                  {refFotoUrl && (
                    <div className="relative shrink-0">
                      <img src={refFotoUrl} className="w-10 h-10 object-cover rounded border border-slate-200" referrerPolicy="no-referrer" />
                      <button
                        type="button"
                        onClick={() => setRefFotoUrl('')}
                        className="absolute -top-1.5 -right-1.5 bg-rose-500 hover:bg-rose-600 text-white rounded-full p-0.5 shadow transition"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* Info summary */}
            <div className="md:col-span-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p>💡 Tips: Isi nama barang, jumlah, satuan, alasan kegunaan, serta link atau foto referensi jika ada, lalu klik tombol "Kirim Permintaan" untuk memproses.</p>
            </div>

            <div className="md:col-span-3 border-t border-slate-100 pt-4 flex justify-end gap-2" id="pp-form-actions">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-submit-pp"
                type="submit"
                disabled={submitting}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-semibold rounded-lg shadow-sm transition cursor-pointer"
              >
                {submitting ? 'Mengirim...' : 'Kirim Permintaan'}
              </button>
            </div>

          </form>
        </div>
        </div>
      )}

      {/* Filter Options */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col gap-3 shadow-xs" id="pp-filters-panel">
        
        {/* Top Controls: Search, Export, View Toggle */}
        <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
          <div className="relative w-full md:w-96 flex-shrink-0" id="pp-search-wrapper">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </span>
            <input
              id="pp-search-input"
              type="text"
              placeholder="Cari nomor PP, nama barang, pengaju, kegunaan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-emerald-500 focus:bg-white transition"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto">
            <button
              type="button"
              onClick={handleExportExcel}
              className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition flex items-center gap-1.5 cursor-pointer shrink-0"
              id="btn-export-pp-excel"
              title="Unduh Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </button>

            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200" id="pp-view-switcher">
              <button
                type="button"
                onClick={() => setViewMode('kotak')}
                className={`px-2 py-1.5 rounded-md transition flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                  viewMode === 'kotak' 
                    ? 'bg-white text-emerald-600 shadow-xs border border-slate-200' 
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
                title="Tampilan Terkotak2"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden md:inline">KOTAK</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('baris')}
                className={`px-2 py-1.5 rounded-md transition flex items-center gap-1 text-[10px] font-bold cursor-pointer ${
                  viewMode === 'baris' 
                    ? 'bg-white text-emerald-600 shadow-xs border border-slate-200' 
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
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-emerald-500 transition cursor-pointer uppercase min-w-[120px]"
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
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
             >
               <option value="all">Hari</option>
               {DAYS.map(d => (
                 <option key={d} value={d}>{d}</option>
               ))}
             </select>
             <select
               value={filterMonth}
               onChange={(e) => setFilterMonth(e.target.value)}
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
             >
               <option value="all">Bulan</option>
               {MONTH_NAMES.map(m => (
                 <option key={m.value} value={m.value}>{m.label}</option>
               ))}
             </select>
             <select
               value={filterYear}
               onChange={(e) => setFilterYear(e.target.value)}
               className="bg-white border border-slate-200 text-slate-700 text-[10px] font-semibold rounded px-1.5 py-1 focus:outline-none focus:border-emerald-500 transition cursor-pointer"
             >
               <option value="all">Tahun</option>
               {availableYears.map(y => (
                 <option key={y} value={y}>{y}</option>
               ))}
             </select>
          </div>

          <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200 p-1 rounded-lg">
            {['all', 'pending', 'disetujui', 'ditolak', 'selesai'].map((status) => (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`px-2.5 py-1 rounded-md text-[10px] font-bold transition uppercase cursor-pointer ${
                  statusFilter === status 
                    ? 'bg-white shadow-sm border border-slate-200 text-emerald-700' 
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200/50'
                }`}
                id={`filter-pp-${status}`}
              >
                {status === 'all' ? 'SEMUA' : status === 'pending' ? '1. Permintaan' : status === 'disetujui' ? '2. Penyetujuan' : status.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Goods Request Display */}
      {filteredPP.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2 shadow-xs" id="pp-empty-results">
          <Package className="w-8 h-8 text-slate-300 mx-auto" />
          <p>Belum ada permintaan barang yang terdaftar.</p>
        </div>
      ) : viewMode === 'baris' ? (
        /* TABLE / BARIS VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm" id="pp-table-container">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-left">
              <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase font-bold tracking-wider">
                <tr>
                  <th className="px-6 py-4">Nomor PP & Tanggal</th>
                  <th className="px-6 py-4">Nama Barang</th>
                  <th className="px-6 py-4">Jumlah</th>
                  <th className="px-6 py-4">Pengaju & Divisi</th>
                  <th className="px-6 py-4">Kegunaan</th>
                  <th className="px-6 py-4">Status & Lokasi</th>
                  <th className="px-6 py-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredPP.map((pp) => {
                  const isPending = pp.status === 'pending' || pp.status === 'permintaan';
                  const isApproved = pp.status === 'disetujui' || pp.status === 'penyetujuan';
                  const isOrdered = pp.status === 'pemesanan';
                  const isArrived = pp.status === 'telah_datang';
                  const isCompleted = pp.status === 'selesai' || pp.status === 'selesai_dan_diambil';

                  return (
                    <tr key={pp.id} className="hover:bg-slate-50/80 transition" id={`pp-table-row-${pp.id}`}>
                      {/* PP No & Date */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono">
                        <span className="font-bold text-slate-900">{pp.nomorPP}</span>
                        <div className="text-[10px] text-slate-400 mt-0.5">{pp.tanggalPengajuan}</div>
                      </td>
                      
                      {/* Item Name */}
                      <td className="px-6 py-4 font-semibold">
                        <button
                          type="button"
                          onClick={() => setSelectedPPDetail(pp)}
                          className="hover:underline text-indigo-600 dark:text-indigo-400 font-bold hover:text-indigo-800 transition text-left cursor-pointer"
                        >
                          {pp.namaBarang}
                        </button>
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-emerald-600 font-bold">
                        {pp.jumlah} {pp.satuan}
                      </td>

                      {/* Requester */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-slate-800">{pp.diajukanOleh}</div>
                        <div className="flex flex-col gap-0.5 mt-0.5">
                          <span className="text-[10px] text-slate-400 font-mono">Divisi: {pp.divisiPengaju}</span>
                          <span className="text-[9px] text-rose-700 bg-rose-50 border border-rose-100 px-1.5 py-0.5 rounded font-bold w-max flex items-center gap-0.5">
                            <MapPin className="w-2.5 h-2.5 text-rose-500" />
                            {pp.cabangId === 'pusat' || !pp.cabangId ? 'Pusat' : (branches.find(b => b.id === pp.cabangId)?.name || 'Pusat')}
                          </span>
                        </div>
                      </td>

                      {/* Purpose */}
                      <td className="px-6 py-4 max-w-xs truncate italic text-slate-500">
                        "{pp.kegunaan}"
                      </td>

                      {/* Status & Location Info */}
                      <td className="px-6 py-4">
                        <div className="space-y-1.5">
                          <div>{getStatusBadge(pp.status)}</div>
                          {pp.lokasiBarang && (
                            <div className="inline-flex items-center gap-1 bg-rose-50 text-rose-700 border border-rose-100 text-[10px] px-2 py-0.5 rounded-md font-bold">
                              <MapPin className="w-3 h-3 text-rose-500" />
                              Ambil di: {pp.lokasiBarang}
                            </div>
                          )}
                          {pp.namaPengambil && (
                            <div className="inline-flex items-center gap-1 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] px-1.5 py-0.5 rounded-md font-bold">
                              <FileCheck className="w-2.5 h-2.5" />
                              Oleh: {pp.namaPengambil}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Action buttons */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2">
                          
                          {/* Location Input Form inline */}
                          {activeLocationPPId === pp.id && (
                            <div className="flex items-center gap-1.5 bg-rose-50 border border-rose-200 p-1.5 rounded-lg text-left" id={`pp-table-loc-${pp.id}`}>
                              <input 
                                type="text" 
                                placeholder="Lokasi barang..."
                                value={lokasiInput}
                                onChange={(e) => setLokasiInput(e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] w-28 focus:outline-none focus:border-rose-500"
                              />
                              <button 
                                onClick={() => {
                                  if (!lokasiInput.trim()) return;
                                  handleUpdateStatus(pp.id, 'telah_datang', { lokasiBarang: lokasiInput.trim() });
                                  setActiveLocationPPId(null);
                                  setLokasiInput('');
                                }}
                                className="bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold px-2 py-1 rounded"
                              >
                                OK
                              </button>
                              <button 
                                onClick={() => {
                                  setActiveLocationPPId(null);
                                  setLokasiInput('');
                                }}
                                className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-1 rounded"
                              >
                                X
                              </button>
                            </div>
                          )}

                          {/* Receiver Name Input Form inline */}
                          {activeReceiverPPId === pp.id && (
                            <div className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-200 p-1.5 rounded-lg text-left" id={`pp-table-rec-${pp.id}`}>
                              <input 
                                type="text" 
                                placeholder="Nama Pengambil..."
                                value={receiverInput}
                                onChange={(e) => setReceiverInput(e.target.value)}
                                className="px-2 py-1 bg-white border border-slate-200 rounded text-[10px] w-32 focus:outline-none focus:border-emerald-500 font-medium"
                              />
                              <button 
                                onClick={() => {
                                  if (!receiverInput.trim()) {
                                    setDialogConfig({
                                      isOpen: true,
                                      title: 'Nama Pengambil Wajib Diisi',
                                      message: 'Mohon masukkan nama orang yang mengambil barang.',
                                      confirmLabel: 'Tutup',
                                      alertOnly: true,
                                      variant: 'warning',
                                      onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
                                    });
                                    return;
                                  }
                                  handleUpdateStatus(pp.id, 'selesai_dan_diambil', { namaPengambil: receiverInput.trim() });
                                  setActiveReceiverPPId(null);
                                  setReceiverInput('');
                                }}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold px-2 py-1 rounded"
                              >
                                OK
                              </button>
                              <button 
                                onClick={() => {
                                  setActiveReceiverPPId(null);
                                  setReceiverInput('');
                                }}
                                className="bg-slate-200 text-slate-700 text-[9px] font-bold px-2 py-1 rounded"
                              >
                                X
                              </button>
                            </div>
                          )}

                          {activeLocationPPId !== pp.id && activeReceiverPPId !== pp.id && canApprovePP && (
                            <div className="flex gap-1">
                              {/* Stage 1 Actions */}
                              {isPending && (
                                <>
                                  <button
                                    onClick={() => handleUpdateStatus(pp.id, 'disetujui')}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-2 py-1 rounded-md transition"
                                  >
                                    Setuju
                                  </button>
                                  <button
                                    onClick={() => handleUpdateStatus(pp.id, 'ditolak')}
                                    className="bg-slate-100 hover:bg-slate-200 text-rose-600 border border-slate-200 text-[10px] font-bold px-2 py-1 rounded-md transition"
                                  >
                                    Tolak
                                  </button>
                                </>
                              )}

                              {/* Stage 2 Actions */}
                              {isApproved && (
                                <button
                                  onClick={() => handleUpdateStatus(pp.id, 'pemesanan')}
                                  className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-0.5"
                                >
                                  <Truck className="w-3 h-3" /> Pesan Barang
                                </button>
                              )}

                              {/* Stage 3 Actions */}
                              {isOrdered && (
                                <button
                                  onClick={() => {
                                    setActiveLocationPPId(pp.id);
                                    setLokasiInput('');
                                  }}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-0.5"
                                >
                                  <MapPin className="w-3 h-3" /> Telah Datang
                                </button>
                              )}

                              {/* Stage 4 Actions */}
                              {isArrived && (
                                <button
                                  onClick={() => {
                                    setActiveReceiverPPId(pp.id);
                                    setReceiverInput('');
                                  }}
                                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-0.5 cursor-pointer"
                                >
                                  <FileCheck className="w-3 h-3" /> Selesai / Diambil
                                </button>
                              )}
                            </div>
                          )}

                          {activeLocationPPId !== pp.id && activeReceiverPPId !== pp.id && (
                            <>
                              {/* Detail Action */}
                              <button
                                type="button"
                                onClick={() => setSelectedPPDetail(pp)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                                title="Detail Permintaan"
                              >
                                <Eye className="w-3.5 h-3.5" />
                              </button>

                              {/* Print Action */}
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedPPToPrint(pp);
                                  setIsPrintModalOpen(true);
                                }}
                                className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-lg transition cursor-pointer"
                                title="Pratinjau Cetak PP"
                              >
                                <Printer className="w-3.5 h-3.5" />
                              </button>

                              {/* Delete Action (with authorization fallback) */}
                              <button
                                onClick={() => handleDeleteClick(pp)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 text-rose-600 rounded-lg transition cursor-pointer"
                                title="Hapus"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}

                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* KOTAK / GRID VIEW */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="pp-cards-grid">
          {filteredPP.map((pp) => {
            const isPending = pp.status === 'pending' || pp.status === 'permintaan';
            const isApproved = pp.status === 'disetujui' || pp.status === 'penyetujuan';
            const isOrdered = pp.status === 'pemesanan';
            const isArrived = pp.status === 'telah_datang';
            const isCompleted = pp.status === 'selesai' || pp.status === 'selesai_dan_diambil';

            return (
              <div key={pp.id} className="bg-white rounded-2xl border border-slate-200 p-5 hover:border-slate-300 transition duration-200 flex flex-col justify-between shadow-xs hover:shadow-sm" id={`pp-card-item-${pp.id}`}>
                
                <div className="space-y-4" id="pp-card-body">
                  {/* ID Header Row */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-3" id="pp-card-header">
                    <div>
                      <span className="text-xs font-bold font-mono text-slate-800">{pp.nomorPP}</span>
                      <p className="text-[9px] text-slate-400 font-mono mt-0.5 flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {pp.tanggalPengajuan}
                      </p>
                    </div>
                    {getStatusBadge(pp.status)}
                  </div>

                  {/* Progress Step Indicator (5 Stages) */}
                  <div className="grid grid-cols-5 gap-1 pt-1" id="pp-progress-steps">
                    {[
                      { step: 1, label: 'Minta', active: isPending || isApproved || isOrdered || isArrived || isCompleted },
                      { step: 2, label: 'Setuju', active: isApproved || isOrdered || isArrived || isCompleted },
                      { step: 3, label: 'Pesan', active: isOrdered || isArrived || isCompleted },
                      { step: 4, label: 'Datang', active: isArrived || isCompleted },
                      { step: 5, label: 'Selesai', active: isCompleted }
                    ].map((st) => (
                      <div key={st.step} className="text-center space-y-1">
                        <div className={`h-1 rounded-full transition ${st.active ? 'bg-emerald-500' : 'bg-slate-100'}`} />
                        <span className={`text-[8px] font-bold block ${st.active ? 'text-emerald-700' : 'text-slate-300'}`}>{st.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Goods & quantity info */}
                  <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100" id="pp-card-item-details">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-600 shrink-0">
                      <ShoppingBag className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => setSelectedPPDetail(pp)}
                        className="text-xs font-bold text-indigo-600 hover:text-indigo-850 hover:underline transition text-left truncate w-full block"
                      >
                        {pp.namaBarang}
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">
                          Kuantitas: <span className="text-emerald-600 font-bold">{pp.jumlah} {pp.satuan}</span>
                        </p>
                        {(pp.inventoryId || (pp.itemsList && pp.itemsList[0]?.inventoryId)) ? (
                          <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold tracking-wider whitespace-nowrap">DIAMBIL DI INVENTORY</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600 text-[8px] font-bold tracking-wider whitespace-nowrap">PEMBELIAN BARU</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Location Info Box if Arrived */}
                  {pp.lokasiBarang && (
                    <div className="bg-rose-50 border border-rose-200 p-3 rounded-xl flex items-start gap-2 text-xs" id="pp-card-location-alert">
                      <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="text-rose-900 block font-bold">INFO PENGAMBILAN BARANG:</strong>
                        <p className="text-rose-800 mt-0.5">Barang sudah datang dan disimpan di: <span className="font-mono bg-white px-1.5 py-0.5 rounded border border-rose-200 font-bold">{pp.lokasiBarang}</span>. Silakan diambil!</p>
                      </div>
                    </div>
                  )}

                  {/* Purpose */}
                  <div className="space-y-1 bg-slate-50/50 p-2.5 rounded-lg border border-slate-100 text-[11px]" id="pp-card-purpose">
                    <span className="text-slate-400 uppercase tracking-wide text-[9px] font-bold block">Kegunaan / Tujuan:</span>
                    <p className="text-slate-600 italic">"{pp.kegunaan}"</p>
                  </div>

                  {/* Requester detail */}
                  <div className="text-[10px] text-slate-500 flex flex-wrap gap-2 justify-between items-center bg-slate-50/40 px-3 py-1.5 rounded-lg border border-slate-100" id="pp-card-footer">
                    <span className="flex items-center gap-1 truncate max-w-[120px]">
                      <User className="w-3.5 h-3.5 text-slate-400" />
                      Oleh: <strong className="text-slate-600 truncate">{pp.diajukanOleh}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Layers className="w-3.5 h-3.5 text-slate-400" />
                      Divisi: <strong className="text-slate-600 font-mono">{pp.divisiPengaju}</strong>
                    </span>
                    <span className="flex items-center gap-1 bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded font-bold border border-rose-100">
                      <MapPin className="w-3 h-3 text-rose-500" />
                      {pp.cabangId === 'pusat' || !pp.cabangId ? 'Pusat' : (branches.find(b => b.id === pp.cabangId)?.name || 'Pusat')}
                    </span>
                  </div>

                  {/* Approver or Receiver details */}
                  <div className="flex justify-between items-center text-[9px] text-slate-400 font-mono italic">
                    <div>
                      {pp.namaPengambil && (
                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-bold">
                          Diambil oleh: {pp.namaPengambil}
                        </span>
                      )}
                    </div>
                    {pp.approvedOleh && (
                      <p>
                        Diotorisasi: {pp.approvedOleh}
                      </p>
                    )}
                  </div>
                </div>

                {/* Inline Location input prompt */}
                {activeLocationPPId === pp.id && (
                  <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2 text-xs" id={`pp-card-loc-form-${pp.id}`}>
                    <label className="block text-[10px] font-bold text-rose-800 uppercase">Input Lokasi Penyimpanan Barang:</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Rak B3, Meja HSE, Gudang MTC"
                      value={lokasiInput}
                      onChange={(e) => setLokasiInput(e.target.value)}
                      className="w-full bg-white px-2.5 py-1.5 border border-rose-300 rounded-lg text-xs"
                    />
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => {
                          if (!lokasiInput.trim()) return;
                          handleUpdateStatus(pp.id, 'telah_datang', { lokasiBarang: lokasiInput.trim() });
                          setActiveLocationPPId(null);
                          setLokasiInput('');
                        }}
                        className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Simpan & Beri Info Lokasi
                      </button>
                      <button 
                        onClick={() => {
                          setActiveLocationPPId(null);
                          setLokasiInput('');
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Inline Receiver name input prompt */}
                {activeReceiverPPId === pp.id && (
                  <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs" id={`pp-card-rec-form-${pp.id}`}>
                    <label className="block text-[10px] font-bold text-emerald-850 uppercase">Siapa yang Mengambil Barang? (Wajib):</label>
                    <input 
                      type="text" 
                      placeholder="Contoh: Budi MTC, Andi HSE"
                      value={receiverInput}
                      onChange={(e) => setReceiverInput(e.target.value)}
                      className="w-full bg-white px-2.5 py-1.5 border border-emerald-300 rounded-lg text-xs focus:outline-none focus:border-emerald-500 font-medium"
                    />
                    <div className="flex gap-2 justify-end">
                      <button 
                        onClick={() => {
                          if (!receiverInput.trim()) {
                            setDialogConfig({
                              isOpen: true,
                              title: 'Nama Pengambil Wajib Diisi',
                              message: 'Mohon masukkan nama orang yang mengambil barang.',
                              confirmLabel: 'Tutup',
                              alertOnly: true,
                              variant: 'warning',
                              onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
                            });
                            return;
                          }
                          handleUpdateStatus(pp.id, 'selesai_dan_diambil', { namaPengambil: receiverInput.trim() });
                          setActiveReceiverPPId(null);
                          setReceiverInput('');
                        }}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer shadow-xs"
                      >
                        Simpan & Selesaikan
                      </button>
                      <button 
                        onClick={() => {
                          setActiveReceiverPPId(null);
                          setReceiverInput('');
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        Batal
                      </button>
                    </div>
                  </div>
                )}

                {/* Action buttons */}
                {activeLocationPPId !== pp.id && activeReceiverPPId !== pp.id && (
                  <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center gap-2" id="pp-card-actions">
                    <div className="flex flex-wrap gap-1.5" id="pp-auth-actions">
                      {canApprovePP && (
                        <>
                          {/* Stage 1: Approve / Reject */}
                          {isPending && (
                            <>
                              <button
                                onClick={() => handleUpdateStatus(pp.id, 'disetujui')}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-0.5 cursor-pointer shadow-xs"
                                id={`btn-approve-pp-${pp.id}`}
                              >
                                <CheckCircle className="w-3 h-3" /> Setujui
                              </button>
                              <button
                                onClick={() => handleUpdateStatus(pp.id, 'ditolak')}
                                className="bg-slate-50 hover:bg-slate-100 text-rose-600 border border-slate-200 text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-0.5 cursor-pointer"
                                id={`btn-reject-pp-${pp.id}`}
                              >
                                <XCircle className="w-3 h-3" /> Tolak
                              </button>
                            </>
                          )}

                          {/* Stage 2: Order */}
                          {isApproved && (
                            <button
                              onClick={() => handleUpdateStatus(pp.id, 'pemesanan')}
                              className="bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                              id={`btn-order-pp-${pp.id}`}
                            >
                              <Truck className="w-3.5 h-3.5" /> Pesan ke Procurement
                            </button>
                          )}

                          {/* Stage 3: Arrived */}
                          {isOrdered && (
                            <button
                              onClick={() => {
                                setActiveLocationPPId(pp.id);
                                setLokasiInput('');
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                              id={`btn-arrived-pp-${pp.id}`}
                            >
                              <MapPin className="w-3.5 h-3.5" /> Barang Telah Datang
                            </button>
                          )}

                          {/* Stage 4: Completed / Picked up */}
                          {isArrived && (
                            <button
                              onClick={() => {
                                setActiveReceiverPPId(pp.id);
                                setReceiverInput('');
                              }}
                              className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                              id={`btn-complete-pp-${pp.id}`}
                            >
                              <CheckSquare className="w-3.5 h-3.5" /> Telah Diambil (Selesai)
                            </button>
                          )}
                        </>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Detail button */}
                      <button
                        type="button"
                        onClick={() => setSelectedPPDetail(pp)}
                        className="p-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 rounded-lg transition cursor-pointer"
                        title="Detail Permintaan"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>

                      {/* Print button */}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPPToPrint(pp);
                          setIsPrintModalOpen(true);
                        }}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 text-indigo-600 rounded-lg transition cursor-pointer"
                        title="Pratinjau Cetak PP"
                      >
                        <Printer className="w-3.5 h-3.5" />
                      </button>

                      {/* Admin/User Delete option */}
                      <button
                        onClick={() => handleDeleteClick(pp)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                        title="Hapus Permintaan"
                        id={`btn-delete-pp-${pp.id}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}

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

      {isPrintModalOpen && selectedPPToPrint && (
        <PrintPPModal
          isOpen={isPrintModalOpen}
          onClose={() => {
            setIsPrintModalOpen(false);
            setSelectedPPToPrint(null);
          }}
          pp={selectedPPToPrint}
          branches={branches}
          companies={companies}
          currentUser={currentUser}
          onDelete={() => {
            setIsPrintModalOpen(false);
            handleDeleteClick(selectedPPToPrint);
          }}
        />
      )}

      {selectedPPDetail && (
        <DetailPPModal
          isOpen={!!selectedPPDetail}
          onClose={() => setSelectedPPDetail(null)}
          pp={selectedPPDetail}
          branches={branches}
          companies={companies}
          onPrint={(pp) => {
            setSelectedPPDetail(null);
            setSelectedPPToPrint(pp);
            setIsPrintModalOpen(true);
          }}
        />
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" id="auth-delete-pp-modal">
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
                Akun Anda saat ini tidak memiliki izin langsung untuk menghapus Permintaan Barang. Silakan hubungi Administrator atau Management untuk memberikan otorisasi lewat PIN mereka di bawah ini.
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
