import React, { useState, useEffect } from 'react';
import { WorkOrder, WorkRequest, UserProfile, CompanyBranch, Company, Asset, InventoryItem } from '../types';
import { generateWONumber } from '../dbHelper';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc, collection, query, where, getDocs, getDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import PrintWOModal from './PrintWOModal';
import { hasPermission, exportToExcelCSV, formatDateTime } from '../utils';
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
  Download,
  Check,
  Lock,
  Upload,
  Camera,
  CheckSquare
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
  assets?: Asset[];
  inventory?: InventoryItem[];
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
  onRefresh,
  assets = [],
  inventory = []
}: WorkOrdersScreenProps) {
  
  // Tabs/Flow Toggle: 'supervisor' (Supervisor/Admin) vs 'technician' (Technician focused mobile view)
  const [activeFlow, setActiveFlow] = useState<'supervisor' | 'technician'>(
    currentUser.role === 'teknisi' ? 'technician' : 'supervisor'
  );

  const [showAddForm, setShowAddForm] = useState(!!pendingConvertWR);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [area, setArea] = useState(pendingConvertWR ? pendingConvertWR.tanggalArea : '');
  const [namaMesin, setNamaMesin] = useState(pendingConvertWR ? pendingConvertWR.namaMesin : '');
  const [showAssetSuggestions, setShowAssetSuggestions] = useState(false);
  const [jenisTindakan, setJenisTindakan] = useState(pendingConvertWR ? pendingConvertWR.tindakan : '');
  const [uraianPekerjaan, setUraianPekerjaan] = useState(pendingConvertWR ? pendingConvertWR.masalah : '');
  const [prioritas, setPrioritas] = useState<'rendah' | 'sedang' | 'tinggi' | 'emergency'>(pendingConvertWR?.prioritas || 'sedang');
  
  // Extended form states (Supervisor/Admin flow)
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3); // Default 3 days from now
    return d.toISOString().split('T')[0];
  });
  const [fotoKerusakan, setFotoKerusakan] = useState<string>(''); // base64
  
  const [tipePenugasan, setTipePenugasan] = useState<'teknisi' | 'vendor'>('teknisi');
  const [namaVendor, setNamaVendor] = useState('');
  const [selectedTechnicians, setSelectedTechnicians] = useState<string[]>([]);

  // Technician Closure Modal State
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [closeWO, setCloseWO] = useState<WorkOrder | null>(null);
  const [fotoHasilPerbaikan, setFotoHasilPerbaikan] = useState<string>('');
  const [technicalNotes, setTechnicalNotes] = useState<string>('');
  const [selectedSparePartId, setSelectedSparePartId] = useState<string>('');
  const [sparePartQty, setSparePartQty] = useState<number | ''>(1);
  const [submittingClosure, setSubmittingClosure] = useState(false);

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

  // Extract unique years from orders
  const availableYears = React.useMemo(() => {
    const years = new Set<string>();
    orders.forEach(o => {
      const { year } = getDayMonthYear(o.tanggalWO);
      if (year) years.add(year.toString());
    });
    if (years.size === 0) {
      years.add(new Date().getFullYear().toString());
    }
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [orders]);

  // Helper to determine WO division
  const getWODivision = (wo: WorkOrder) => {
    if (wo.nomorWR && wo.nomorWR !== 'DIRECT') {
      const refWR = requests.find(r => r.nomorWR === wo.nomorWR || r.id === wo.nomorWR);
      if (refWR && refWR.divisiPengaju) {
        return refWR.divisiPengaju.toUpperCase();
      }
    }
    // Check if the diajukanOleh is a user whose division we know
    const matchedUser = (users || []).find(u => u.name === wo.diajukanOleh || u.username === wo.diajukanOleh);
    if (matchedUser && matchedUser.division) {
      return matchedUser.division.toUpperCase();
    }
    
    // Check if the area matches any divisions
    const defaultDivisions = ["HSE", "PRD SMBS", "GA", "MTC", "LOGISTIK", "LAB"];
    for (const d of defaultDivisions) {
      if (wo.area.toUpperCase().includes(d)) {
        return d;
      }
    }

    return 'MTC'; // Fallback
  };

  // Extract unique departments/divisions dynamically from orders
  const uniqueDivisions = React.useMemo(() => {
    const divs = new Set<string>();
    orders.forEach(o => {
      const d = getWODivision(o);
      if (d) divs.add(d.toUpperCase());
    });
    if (currentUser.division) {
      divs.add(currentUser.division.toUpperCase());
    }
    return Array.from(divs).sort();
  }, [orders, requests, users, currentUser.division]);
  const [submitting, setSubmitting] = useState(false);
  const [completionNotes, setCompletionNotes] = useState<{ [woId: string]: string }>({});
  const [playPhotoBase64, setPlayPhotoBase64] = useState<{ [woId: string]: string }>({});
  const [finishPhotoBase64, setFinishPhotoBase64] = useState<{ [woId: string]: string }>({});
  const [sapInputs, setSapInputs] = useState<{ [woId: string]: string }>({});
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

  // States for Admin Authorization deletion
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authWOId, setAuthWOId] = useState<string | null>(null);
  const [admins, setAdmins] = useState<UserProfile[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string>('');
  const [adminPin, setAdminPin] = useState<string>('');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const isTechnician = currentUser.role === 'teknisi';
  const isAdmin = currentUser.role === 'admin';

  const canCreateWO = hasPermission(currentUser, 'canCreateWO');

  useEffect(() => {
    if (currentUser.role === 'teknisi' && !canCreateWO) {
      setActiveFlow('technician');
    }
  }, [currentUser, canCreateWO]);
  const canDeleteWO = hasPermission(currentUser, 'canDeleteWO');
  const canApprove = hasPermission(currentUser, 'canApprove');
  const canReject = hasPermission(currentUser, 'canReject');
  const canAssignTeknisi = hasPermission(currentUser, 'canAssignTeknisi');
  const canPlayWork = hasPermission(currentUser, 'canPlayWork');
  const canFinishWork = hasPermission(currentUser, 'canFinishWork');
  const canInputSAP = hasPermission(currentUser, 'canInputSAP');
  const canEditExistingSAP = hasPermission(currentUser, 'canEditExistingSAP');

  const handleSaveSAPNumber = async (woId: string, sapVal: string) => {
    try {
      await updateDoc(doc(db, 'work_orders', woId), {
        sapNumber: sapVal.trim()
      });
      onRefresh();
    } catch (err) {
      console.error('Error saving SAP Number:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan Nomor SAP ke database.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

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
      const subDiv = pendingConvertWR ? (pendingConvertWR.divisiPengaju || 'MTC') : (currentUser.division || 'MTC');
      const woId = await generateWONumber(subDiv, companyId, orders, requests, users);
      const safeWoId = woId.replace(/\//g, '-');
      const getLocalDateString = () => {
        const d = new Date();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const today = getLocalDateString();

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
        cabangId: pendingConvertWR?.cabangId || currentUser.cabangId || 'pusat',
        // Extended properties
        dueDate: dueDate,
        fotoKerusakan: fotoKerusakan,
        fotoPlay: fotoKerusakan || '' // Map to play photo for default layout backwards compatibility
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
      setFotoKerusakan('');
      const defaultDate = new Date();
      defaultDate.setDate(defaultDate.getDate() + 3);
      setDueDate(defaultDate.toISOString().split('T')[0]);
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
      const nowStr = new Date().toISOString();
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
      const nowStr = new Date().toISOString();
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

  const triggerCloseWOModal = (wo: WorkOrder) => {
    setCloseWO(wo);
    setFotoHasilPerbaikan('');
    setTechnicalNotes('');
    setSelectedSparePartId('');
    setSparePartQty(1);
    setIsCloseModalOpen(true);
  };

  const handleCloseWorkOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closeWO) return;
    if (!technicalNotes.trim()) {
      alert('Mohon isi Catatan Teknis Perbaikan!');
      return;
    }

    setSubmittingClosure(true);
    try {
      const nowStr = new Date().toISOString();
      const updatedFields: any = {
        status: 'selesai',
        finishAt: nowStr,
        notes: technicalNotes.trim(),
        technicalNotes: technicalNotes.trim(),
        fotoFinish: fotoHasilPerbaikan,
        fotoHasilPerbaikan: fotoHasilPerbaikan,
      };

      if (selectedSparePartId) {
        const part = inventory.find(p => p.id === selectedSparePartId);
        if (part) {
          updatedFields.sparePartId = selectedSparePartId;
          updatedFields.sparePartName = part.name;
          const qty = typeof sparePartQty === 'number' ? sparePartQty : 1;
          updatedFields.sparePartQty = qty;

          // Update stock in Firestore
          const partRef = doc(db, 'inventory', selectedSparePartId);
          const newStock = Math.max(0, part.stock - qty);
          await setDoc(partRef, { ...part, stock: newStock }, { merge: true });
        }
      }

      await updateDoc(doc(db, 'work_orders', closeWO.id), updatedFields);

      // If this is an auto-generated PM Preventive WO, advance its PM schedule dates
      if (closeWO.nomorWR && closeWO.nomorWR.startsWith('PM-')) {
        const parts = closeWO.nomorWR.split('-');
        if (parts.length >= 3) {
          const pmId = parts[1]; // PM-[pmId]-[dueDate]
          const pmRef = doc(db, 'preventive_maintenance', pmId);
          const pmSnap = await getDoc(pmRef);
          if (pmSnap.exists()) {
            const pmData = pmSnap.data();
            let nextDate = '';
            const todayStr = new Date().toISOString().split('T')[0];

            if (pmData.frekuensi && pmData.frekuensi !== 'none') {
              const d = new Date(todayStr);
              switch (pmData.frekuensi) {
                case 'harian': d.setDate(d.getDate() + 1); break;
                case 'mingguan': d.setDate(d.getDate() + 7); break;
                case 'bulanan': d.setMonth(d.getMonth() + 1); break;
                case 'tahunan': d.setFullYear(d.getFullYear() + 1); break;
                case 'custom': {
                  const val = pmData.hariInterval || 30;
                  const unit = pmData.customIntervalUnit || 'hari';
                  if (unit === 'hari') d.setDate(d.getDate() + val);
                  else if (unit === 'minggu') d.setDate(d.getDate() + val * 7);
                  else if (unit === 'bulan') d.setMonth(d.getMonth() + val);
                  else if (unit === 'tahun') d.setFullYear(d.getFullYear() + val);
                  break;
                }
              }
              nextDate = d.toISOString().split('T')[0];
            }

            const updatedPmFields: any = {
              tanggalTerakhirPengecekan: todayStr,
            };
            if (nextDate) {
              updatedPmFields.tanggalBerikutnyaPengecekan = nextDate;
            }

            // Also advance the target reading for usage metric based PMs upon closure
            if (pmData.isVehicle) {
              const lastReading = pmData.vehicleLastReading || 0;
              const interval = pmData.vehicleIntervalReading || (pmData.vehicleTrackingMode === 'runhour' ? 500 : 1000);
              updatedPmFields.vehicleTargetReading = lastReading + interval;
            }

            await updateDoc(pmRef, updatedPmFields);
            console.log(`Successfully advanced PM Schedule ${pmId} to next due date: ${nextDate}`);
          }
        }
      }

      setIsCloseModalOpen(false);
      setCloseWO(null);
      setFotoHasilPerbaikan('');
      setTechnicalNotes('');
      setSelectedSparePartId('');
      setSparePartQty(1);

      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Pekerjaan Selesai',
        message: `Work Order ${closeWO.nomorWO} berhasil ditutup (Closed) dan stok suku cadang diperbarui otomatis.`,
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      alert('Terjadi kesalahan saat menutup Work Order.');
    } finally {
      setSubmittingClosure(false);
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

  const handleAuthDeleteClick = async (woId: string) => {
    setAuthWOId(woId);
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
        if (u.role === 'admin' || u.role === 'management' || u.canDeleteWO === true) {
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

  const handleDeleteClick = (woId: string) => {
    if (canDeleteWO) {
      handleDelete(woId);
    } else {
      handleAuthDeleteClick(woId);
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

      if (authWOId) {
        await deleteDoc(doc(db, 'work_orders', authWOId));
        setShowAuthModal(false);
        onRefresh();
        
        setDialogConfig({
          isOpen: true,
          title: 'Berhasil Dihapus',
          message: `Work Order berhasil dihapus atas otorisasi dari ${adminUser.name}.`,
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
    
    const woDivision = getWODivision(o);
    const matchesDivision = divisionFilter === 'all' || woDivision === divisionFilter.toUpperCase();

    const { day, month, year } = getDayMonthYear(o.tanggalWO);
    const matchesDay = filterDay === 'all' || (day !== null && day === parseInt(filterDay, 10));
    const matchesMonth = filterMonth === 'all' || (month !== null && month === parseInt(filterMonth, 10));
    const matchesYear = filterYear === 'all' || (year !== null && year === parseInt(filterYear, 10));

    return matchesSearch && matchesStatus && matchesDivision && matchesDay && matchesMonth && matchesYear;
  });

  const technicianTasks = orders.filter(o => {
    const isOpenOrInProgress = o.status === 'pending' || o.status === 'di_kerjakan';
    if (!isOpenOrInProgress) return false;

    const myNameLower = currentUser.name.toLowerCase();
    const myUsernameLower = currentUser.username.toLowerCase();
    
    return o.teknisiDitugaskan.some(tech => 
      tech.toLowerCase() === myNameLower || 
      tech.toLowerCase() === myUsernameLower
    );
  });

  const filteredTechnicianTasks = technicianTasks.filter(o => {
    const matchesSearch = 
      o.nomorWO.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.namaMesin.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.area.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.nomorWR.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleExportExcel = () => {
    const headers = [
      'Nomor WO', 'Nomor WR', 'Nomor SAP', 'Tanggal WO', 'Nama Mesin', 'Area', 
      'Jenis Tindakan', 'Uraian Pekerjaan', 'Tipe Penugasan', 
      'Vendor', 'Teknisi Ditugaskan', 'Diajukan Oleh', 'Status', 
      'Mulai Kerja', 'Selesai Kerja', 'Catatan / Penjelasan', 'Prioritas'
    ];
    const keys = [
      'nomorWO', 'nomorWR', 'sapNumber', 'tanggalWO', 'namaMesin', 'area',
      'jenisTindakan', 'uraianPekerjaan', 'tipePenugasan',
      'namaVendor', 'teknisiDitugaskan', 'diajukanOleh', 'status',
      'playAtFormatted', 'finishAtFormatted', 'notes', 'prioritas'
    ];

    const mappedOrders = filteredOrders.map(o => ({
      ...o,
      sapNumber: o.sapNumber || '',
      playAtFormatted: formatDateTime(o.playAt),
      finishAtFormatted: formatDateTime(o.finishAt)
    }));

    exportToExcelCSV(mappedOrders, headers, keys, `Laporan_Work_Orders_Filter_${statusFilter}_${divisionFilter}_Tgl_${filterDay}-${filterMonth}-${filterYear}`);
  };

  const filteredAssetsForSuggestions = namaMesin.trim() === '' 
    ? assets 
    : assets.filter(asset => 
        asset.name.toLowerCase().includes(namaMesin.toLowerCase()) ||
        (asset.code && asset.code.toLowerCase().includes(namaMesin.toLowerCase()))
      );

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
        
        {canCreateWO && !pendingConvertWR && (
          <button
            onClick={() => {
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

      {/* User Flow Selector */}
      {!(currentUser.role === 'teknisi' && !canCreateWO) && (
        <div className="flex bg-slate-100 p-1.5 rounded-xl border border-slate-200 w-full max-w-md" id="flow-selection-tabs">
          <button
            type="button"
            onClick={() => setActiveFlow('supervisor')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeFlow === 'supervisor'
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100/50 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            Supervisor / Admin Portal
          </button>
          <button
            type="button"
            onClick={() => setActiveFlow('technician')}
            className={`flex-1 py-2 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeFlow === 'technician'
                ? 'bg-white text-indigo-700 shadow-sm border border-indigo-100/50 font-bold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            My Tasks (Technician View)
          </button>
        </div>
      )}

      {/* Active WR Conversion Alert */}
      {pendingConvertWR && (
        <div className="bg-blue-50 border border-blue-200 p-4 rounded-xl flex items-center justify-between gap-4 shadow-xs" id="conversion-alert">
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-blue-700 uppercase tracking-wider">Sedang Memproses Konversi WR ke WO</h4>
            <p className="text-[11px] text-slate-600">
              Mengonversi WR: <strong className="font-mono text-slate-900">{pendingConvertWR.nomorWR}</strong> | Mesin: <strong className="text-slate-900">{pendingConvertWR.namaMesin}</strong>
            </p>
          </div>
          <span className="text-[10px] bg-indigo-50 border border-indigo-200 px-3 py-1.5 rounded-md text-indigo-700 flex items-center gap-1 font-bold">
            <Lock className="w-3.5 h-3.5" /> Wajib Menjadi WO (WR Telah Disetujui)
          </span>
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
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-indigo-500" />
                  Nama Mesin / Asset <span className="text-red-500">*</span>
                </label>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                  </div>
                  <input
                    id="form-wo-machine-search"
                    type="text"
                    required
                    placeholder="Cari asset / Ketik nama mesin manual..."
                    value={namaMesin}
                    onChange={(e) => {
                      setNamaMesin(e.target.value);
                      setShowAssetSuggestions(true);
                    }}
                    onFocus={() => setShowAssetSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowAssetSuggestions(false), 200)}
                    className="block w-full pl-9 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
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
                            setNamaMesin(asset.name);
                            if (asset.location) setArea(asset.location);
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
                  <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                  Batas Waktu (Due Date) <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-wo-due-date"
                  type="date"
                  required
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
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

              {/* Foto Kerusakan Large Upload Button */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5 text-indigo-500" />
                  Foto Kerusakan <span className="text-slate-400 font-normal">(Tambahkan Bukti)</span>
                </label>
                
                {fotoKerusakan ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-32 flex items-center justify-center">
                    <img src={fotoKerusakan} alt="Preview Kerusakan" className="h-full object-contain" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setFotoKerusakan('')}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition shadow-md cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center items-center w-full">
                    <label className="flex flex-col justify-center items-center w-full h-32 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-100/70 transition">
                      <div className="flex flex-col justify-center items-center text-center px-4">
                        <Upload className="w-6 h-6 text-indigo-500 mb-1.5" />
                        <p className="text-xs font-bold text-slate-700">Unggah Foto Kerusakan</p>
                        <p className="text-[9px] text-slate-400 font-mono mt-0.5">KLIK ATAU SERET FILE GAMBAR (MAKS 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert('Ukuran file terlalu besar! Maksimal 5MB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFotoKerusakan(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
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
              {!pendingConvertWR && (
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                  }}
                  className="px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-semibold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
              )}
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

      {activeFlow === 'supervisor' ? (
        <>
          {/* Bento-style Status KPI Cards (Open, In Progress, Pending, Closed) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" id="wo-status-kpi-cards">
            {[
              { id: 'open', label: 'Open / Baru', count: orders.filter(o => o.status === 'pending' && !o.playAt).length, color: 'border-blue-200 bg-blue-50/45 text-blue-700 hover:bg-blue-50', statusVal: 'pending' },
              { id: 'in_progress', label: 'In Progress', count: orders.filter(o => o.status === 'di_kerjakan').length, color: 'border-indigo-200 bg-indigo-50/45 text-indigo-700 hover:bg-indigo-50', statusVal: 'di_kerjakan' },
              { id: 'pending', label: 'Pending / Hold', count: orders.filter(o => o.status === 'pending' && o.playAt).length, color: 'border-amber-200 bg-amber-50/45 text-amber-700 hover:bg-amber-50', statusVal: 'pending' },
              { id: 'closed', label: 'Closed / Selesai', count: orders.filter(o => o.status === 'selesai').length, color: 'border-emerald-200 bg-emerald-50/45 text-emerald-700 hover:bg-emerald-50', statusVal: 'selesai' },
            ].map(card => (
              <button
                type="button"
                key={card.id}
                onClick={() => setStatusFilter(card.statusVal)}
                className={`p-4 rounded-xl border transition shadow-xs text-left cursor-pointer ${card.color} ${
                  statusFilter === card.statusVal ? 'ring-2 ring-indigo-500/50 scale-[1.02]' : ''
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-85 block">{card.label}</span>
                <span className="text-2xl font-black block mt-1 font-mono">{card.count}</span>
              </button>
            ))}
          </div>

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

        <div className="flex items-center gap-2" id="wo-division-filter-wrapper">
          <span className="text-xs text-slate-500 flex items-center gap-1 font-semibold shrink-0">
            Divisi:
          </span>
          <select
            value={divisionFilter}
            onChange={(e) => setDivisionFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-indigo-500 transition cursor-pointer uppercase"
          >
            <option value="all">SEMUA DIVISI</option>
            {uniqueDivisions.map(div => (
              <option key={div} value={div}>{div}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-1 bg-slate-50 border border-slate-200/80 p-1 rounded-xl" id="wo-date-filters-wrapper">
          <span className="text-xs text-slate-500 font-bold px-1.5 flex items-center gap-1">
            <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tgl:
          </span>
          <select
            value={filterDay}
            onChange={(e) => setFilterDay(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="all">Hari</option>
            {DAYS.map(d => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="all">Bulan</option>
            {MONTH_NAMES.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={filterYear}
            onChange={(e) => setFilterYear(e.target.value)}
            className="bg-white border border-slate-200 text-slate-700 text-xs font-semibold rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 transition cursor-pointer"
          >
            <option value="all">Tahun</option>
            {availableYears.map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
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

                    {/* SAP Number Section */}
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs bg-slate-50/70 border border-slate-150 p-1.5 rounded-lg w-max" id={`card-sap-container-${wo.id}`}>
                      <span className="text-[9px] text-slate-400 uppercase font-bold tracking-wider">No. SAP:</span>
                      {canInputSAP && (!wo.sapNumber || isAdmin || canEditExistingSAP) ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Nomer SAP..."
                            className="px-2 py-0.5 border border-slate-200 rounded font-mono text-[10px] w-28 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || '')}
                            onChange={(e) => setSapInputs({ ...sapInputs, [wo.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveSAPNumber(wo.id, sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || ''));
                              }
                            }}
                          />
                          <button
                            onClick={() => handleSaveSAPNumber(wo.id, sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || ''))}
                            className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded cursor-pointer transition flex items-center justify-center shadow-xs"
                            title="Simpan SAP"
                          >
                            <Check className="w-3 h-3" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          {wo.sapNumber ? (
                            <span className="font-mono text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                              <Lock className="w-2.5 h-2.5 text-slate-400" />
                              {wo.sapNumber}
                              {canInputSAP && (
                                <span className="text-[8px] text-rose-500 font-normal bg-rose-50 px-1 py-0.2 rounded border border-rose-100 ml-1">
                                  Terkunci (Butuh Izin Admin)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5 text-slate-300" />
                              Locked
                            </span>
                          )}
                        </div>
                      )}
                    </div>
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
                    {wo.playAt && <p>Mulai: <span className="text-slate-700 font-bold">{formatDateTime(wo.playAt)}</span></p>}
                    {wo.finishAt && <p>Selesai: <span className="text-emerald-700 font-bold">{formatDateTime(wo.finishAt)}</span></p>}
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
                      <div className="flex flex-col sm:flex-row gap-2 w-full">
                        <input
                          id={`input-notes-vendor-${wo.id}`}
                          type="text"
                          placeholder="Tulis laporan pengerjaan vendor..."
                          value={completionNotes[wo.id] || ''}
                          onChange={(e) => setCompletionNotes({ ...completionNotes, [wo.id]: e.target.value })}
                          className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-amber-500 focus:bg-white w-full sm:flex-1"
                        />
                        <button
                          onClick={() => handleFinishWork(wo.id)}
                          className="px-3 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs rounded-lg transition w-full sm:w-auto shrink-0 cursor-pointer shadow-xs text-center"
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
                      <button
                        onClick={() => triggerCloseWOModal(wo)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-lg transition flex items-center gap-1.5 cursor-pointer shadow-xs"
                        id={`btn-finish-tech-${wo.id}`}
                      >
                        <CheckSquare className="w-4 h-4" /> Tutup WO (Closed)
                      </button>
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
                  <button
                    onClick={() => handleDeleteClick(wo.id)}
                    className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                    title="Hapus Work Order"
                    id={`btn-delete-wo-${wo.id}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

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
                <th className="py-3 px-4">No. SAP</th>
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
                    <td className="py-3.5 px-4 min-w-[145px]" id={`sap-cell-${wo.id}`}>
                      {canInputSAP && (!wo.sapNumber || isAdmin || canEditExistingSAP) ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            placeholder="Nomer SAP..."
                            className="px-2 py-1 border border-slate-200 rounded font-mono text-[10px] w-24 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || '')}
                            onChange={(e) => setSapInputs({ ...sapInputs, [wo.id]: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveSAPNumber(wo.id, sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || ''));
                              }
                            }}
                          />
                          <button
                            onClick={() => handleSaveSAPNumber(wo.id, sapInputs[wo.id] !== undefined ? sapInputs[wo.id] : (wo.sapNumber || ''))}
                            className="p-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded cursor-pointer transition flex items-center justify-center shadow-xs"
                            title="Simpan"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div>
                          {wo.sapNumber ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="font-mono text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1 w-max">
                                <Lock className="w-2.5 h-2.5 text-slate-400" />
                                {wo.sapNumber}
                              </span>
                              {canInputSAP && (
                                <span className="text-[8px] text-rose-500">
                                  Terkunci (Butuh Izin Admin)
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 italic flex items-center gap-0.5">
                              <Lock className="w-2.5 h-2.5 text-slate-300" />
                              Locked
                            </span>
                          )}
                        </div>
                      )}
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
                          <button
                            onClick={() => triggerCloseWOModal(wo)}
                            className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-[10px] rounded uppercase cursor-pointer"
                          >
                            Tutup WO (Closed)
                          </button>
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

                        <button
                          onClick={() => handleDeleteClick(wo.id)}
                          className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-100 text-rose-600 rounded cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
        </>
      ) : (
        /* Flow 2: Technician Focused Mobile View */
        <div className="space-y-4 animate-fadeIn" id="tech-focused-tasks-container">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Clipboard className="w-4 h-4 text-indigo-500" />
                Daftar Tugas Saya
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Menampilkan seluruh Work Order Aktif (Open & In Progress) yang ditugaskan kepada Anda.
              </p>
            </div>
            <div className="text-xs bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg border border-indigo-150 font-bold shrink-0">
              Total Tugas Aktif: {filteredTechnicianTasks.length} Pekerjaan
            </div>
          </div>

          {filteredTechnicianTasks.length === 0 ? (
            <div className="bg-white text-center py-16 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-3 shadow-xs">
              <CheckSquare className="w-12 h-12 text-emerald-500 mx-auto animate-bounce" />
              <p className="font-bold text-slate-800 text-sm">Luar Biasa! Tidak ada tugas tersisa.</p>
              <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
                Seluruh pekerjaan Anda telah selesai atau belum ada tugas baru yang ditugaskan kepada Anda saat ini.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredTechnicianTasks.map(wo => (
                <div key={wo.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:border-slate-300 transition duration-200 flex flex-col justify-between space-y-4">
                  <div className="space-y-3.5">
                    {/* Card Header */}
                    <div className="flex justify-between items-start gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="text-[11px] font-bold font-mono text-indigo-600 bg-indigo-50/70 border border-indigo-100 px-2 py-0.5 rounded block w-max">{wo.nomorWO}</span>
                        <span className="text-[9px] text-slate-400 block mt-1">Ref WR: {wo.nomorWR}</span>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[9px] px-2 py-0.5 font-bold rounded uppercase ${
                          wo.prioritas === 'emergency' ? 'bg-red-150 text-red-700' :
                          wo.prioritas === 'tinggi' ? 'bg-amber-150 text-amber-700' :
                          wo.prioritas === 'sedang' ? 'bg-indigo-100 text-indigo-700' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {wo.prioritas || 'sedang'}
                        </span>
                        {wo.dueDate && (
                          <span className="text-[9px] text-rose-600 font-semibold font-mono flex items-center gap-0.5 mt-0.5">
                            <Clock className="w-3 h-3" /> Due: {wo.dueDate}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Machine and Area */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Mesin / Asset</span>
                        <p className="font-bold text-slate-800 truncate mt-0.5">{wo.namaMesin}</p>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Lokasi Area</span>
                        <p className="font-bold text-slate-800 truncate mt-0.5">{wo.area}</p>
                      </div>
                    </div>

                    {/* Action type & details */}
                    <div className="text-xs space-y-2">
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Tindakan</span>
                        <p className="font-semibold text-slate-700 mt-0.5">{wo.jenisTindakan}</p>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 font-bold block uppercase">Deskripsi Masalah</span>
                        <p className="text-slate-600 italic bg-slate-50 p-3 rounded-xl border border-slate-100 mt-0.5 leading-relaxed">"{wo.uraianPekerjaan}"</p>
                      </div>
                    </div>

                    {/* Photo Display if any */}
                    {wo.fotoKerusakan && (
                      <div className="bg-slate-50 p-2 rounded-xl border border-slate-200">
                        <span className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1">📸 Foto Kerusakan:</span>
                        <img src={wo.fotoKerusakan} alt="Kerusakan" className="w-full h-32 object-cover rounded-lg border border-slate-150" referrerPolicy="no-referrer" />
                      </div>
                    )}
                  </div>

                  {/* Quick Actions Footer */}
                  <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between gap-2">
                    <span className={`text-[10px] font-extrabold uppercase px-2 py-1 rounded ${
                      wo.status === 'pending' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {wo.status === 'pending' ? 'Open (Menunggu)' : 'In Progress'}
                    </span>

                    {wo.status === 'pending' ? (
                      <button
                        onClick={() => handlePlayWork(wo.id)}
                        className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md"
                      >
                        <Play className="w-3.5 h-3.5" /> Start Kerja
                      </button>
                    ) : (
                      <button
                        onClick={() => triggerCloseWOModal(wo)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-2 px-4 rounded-xl flex items-center gap-1.5 cursor-pointer transition shadow-md"
                      >
                        <CheckSquare className="w-4 h-4" /> Tutup WO (Closed)
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
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
          currentUser={currentUser}
          onDelete={() => {
            setIsPrintModalOpen(false);
            handleDeleteClick(selectedWOToPrint.id);
          }}
        />
      )}

      {/* Closure / Tutup Work Order Modal */}
      {isCloseModalOpen && closeWO && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" id="closure-wo-modal">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-scaleIn">
            
            <div className="bg-indigo-900 px-6 py-4 flex items-center justify-between text-white shrink-0">
              <div className="space-y-0.5">
                <h3 className="text-sm font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                  Finalisasi & Tutup Work Order
                </h3>
                <p className="text-[10px] text-indigo-200 font-mono">
                  No. WO: {closeWO.nomorWO} | Mesin: {closeWO.namaMesin}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCloseModalOpen(false);
                  setCloseWO(null);
                }}
                className="text-white hover:text-indigo-150 transition p-1 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCloseWorkOrderSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
              
              {/* Foto Hasil Perbaikan */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <Camera className="w-3.5 h-3.5 text-indigo-500" />
                  Foto Hasil Perbaikan <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                
                {fotoHasilPerbaikan ? (
                  <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-50 h-36 flex items-center justify-center">
                    <img src={fotoHasilPerbaikan} alt="Hasil Perbaikan" className="h-full object-contain" referrerPolicy="no-referrer" />
                    <button
                      type="button"
                      onClick={() => setFotoHasilPerbaikan('')}
                      className="absolute top-2 right-2 bg-red-600 text-white rounded-full p-1.5 hover:bg-red-700 transition shadow"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex justify-center items-center w-full">
                    <label className="flex flex-col justify-center items-center w-full h-36 bg-slate-50 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-100 transition">
                      <div className="flex flex-col justify-center items-center text-center px-4">
                        <Upload className="w-6 h-6 text-indigo-500 mb-1" />
                        <p className="text-xs font-bold text-slate-700">Unggah Foto Perbaikan</p>
                        <p className="text-[9px] text-slate-400 font-mono">Wajib diisi (Maks 5MB)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/*"
                        required
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            if (file.size > 5 * 1024 * 1024) {
                              alert('Ukuran file terlalu besar! Maksimal 5MB.');
                              return;
                            }
                            const reader = new FileReader();
                            reader.onloadend = () => {
                              setFotoHasilPerbaikan(reader.result as string);
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Technical Notes (Catatan Teknis) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <FileEdit className="w-3.5 h-3.5 text-indigo-500" />
                  Catatan Teknis Perbaikan <span className="text-red-500">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  value={technicalNotes}
                  onChange={(e) => setTechnicalNotes(e.target.value)}
                  placeholder="Deskripsikan tindakan yang telah diambil, perbaikan komponen, hasil pengetesan, dll..."
                  className="block w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                />
              </div>

              {/* Spare Parts Used (Suku Cadang) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1">
                  <Wrench className="w-3.5 h-3.5 text-indigo-500" />
                  Suku Cadang Digunakan <span className="text-slate-400 font-normal text-[10px]">(Optional)</span>
                </label>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <select
                      value={selectedSparePartId}
                      onChange={(e) => setSelectedSparePartId(e.target.value)}
                      className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                    >
                      <option value="">-- Pilih Suku Cadang --</option>
                      {inventory && inventory.map(item => (
                        <option key={item.id} value={item.id} disabled={item.stock <= 0}>
                          {item.name} (Stok: {item.stock} {item.unit || 'pcs'})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <input
                      type="number"
                      min={1}
                      disabled={!selectedSparePartId}
                      value={sparePartQty}
                      onChange={(e) => setSparePartQty(e.target.value === '' ? '' : Math.max(1, parseInt(e.target.value, 10) || 1))}
                      placeholder="Qty"
                      className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition text-center"
                    />
                  </div>
                </div>
                {selectedSparePartId && (
                  <p className="text-[10px] text-indigo-600 font-semibold mt-1">
                    💡 Menggunakan {sparePartQty === '' ? 1 : sparePartQty} unit. Stok item terpilih akan berkurang otomatis saat WO ditutup.
                  </p>
                )}
              </div>

              <div className="border-t border-slate-100 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsCloseModalOpen(false);
                    setCloseWO(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingClosure}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold rounded-lg shadow-sm transition cursor-pointer flex items-center gap-1.5"
                >
                  {submittingClosure ? 'Memproses...' : 'Tutup Work Order'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {showAuthModal && (
        <div className="fixed inset-0 z-100 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" id="auth-delete-wo-modal">
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
                Akun Anda saat ini tidak memiliki izin langsung untuk menghapus Work Order. Silakan hubungi Administrator atau Management untuk memberikan otorisasi lewat PIN mereka di bawah ini.
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
