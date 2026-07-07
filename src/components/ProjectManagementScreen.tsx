import React, { useState } from 'react';
import { Project, UserProfile, ProjectProgressReport, CompanyBranch } from '../types';
import { db } from '../firebase';
import { doc, setDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import { 
  Briefcase, 
  Plus, 
  Users, 
  Calendar, 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  Trash2, 
  ChevronRight, 
  FileText, 
  Send, 
  Search, 
  X, 
  Download,
  Wrench,
  Paperclip,
  File,
  ShieldCheck,
  DollarSign,
  Layers,
  HardHat,
  FileCheck,
  ClipboardList,
  Eye,
  Info,
  Check,
  ArrowRight,
  ArrowLeft,
  ListFilter
} from 'lucide-react';
import { exportToExcelCSV } from '../utils';
import { generateWONumber } from '../dbHelper';

interface ProjectManagementScreenProps {
  projects: Project[];
  currentUser: UserProfile;
  technicians: UserProfile[];
  allUsers?: UserProfile[];
  branches?: CompanyBranch[];
  onRefresh: () => void;
}

export default function ProjectManagementScreen({ 
  projects, 
  currentUser, 
  technicians, 
  allUsers = [],
  branches = [], 
  onRefresh 
}: ProjectManagementScreenProps) {
  const [isKanban, setIsKanban] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'timeline' | 'anggaran' | 'vendor' | 'dokumen'>('timeline');
  
  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Add Project Form State
  const [namaProject, setNamaProject] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [targetSelesai, setTargetSelesai] = useState('');
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([]);
  const [status, setStatus] = useState<Project['status']>('planning');
  const [pic, setPic] = useState('');
  const [budgetEstimasi, setBudgetEstimasi] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);

  // Detail Sub-forms State
  const [newReportText, setNewReportText] = useState('');
  const [newReportProgress, setNewReportProgress] = useState<number | null>(null);
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: 'image' | 'document' } | null>(null);
  const [addingReport, setAddingReport] = useState(false);

  // Materials Form State
  const [matName, setMatName] = useState('');
  const [matQty, setMatQty] = useState(1);
  const [matUnit, setMatUnit] = useState('Pcs');
  const [matPrice, setMatPrice] = useState(0);
  const [matStatus, setMatStatus] = useState<'tersedia' | 'dipesan' | 'habis'>('tersedia');

  // Vendor Form State
  const [vName, setVName] = useState('');
  const [vRole, setVRole] = useState('');
  const [vContact, setVContact] = useState('');
  const [vCost, setVCost] = useState(0);

  // Document Form State
  const [docName, setDocName] = useState('');
  const [docType, setDocType] = useState<'blueprint' | 'manual' | 'handover' | 'kalibrasi' | 'lainnya'>('blueprint');
  const [docFile, setDocFile] = useState<{ url: string; name: string } | null>(null);

  // WO Creation inline
  const [showCreateWOForm, setShowCreateWOForm] = useState(false);
  const [woArea, setWoArea] = useState('');
  const [woNamaMesin, setWoNamaMesin] = useState('');
  const [woJenisTindakan, setWoJenisTindakan] = useState('Proyek Konstruksi / Perbaikan');
  const [woUraian, setWoUraian] = useState('');
  const [woTeknisi, setWoTeknisi] = useState<string[]>([]);
  const [woPrioritas, setWoPrioritas] = useState<'rendah' | 'sedang' | 'tinggi' | 'emergency'>('sedang');
  const [woSubmitting, setWoSubmitting] = useState(false);

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'info' | 'warning';
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const isAdmin = currentUser.role === 'admin' || currentUser.username === 'admin';

  // IDR Currency Formatter
  const formatIDR = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num || 0);
  };

  // Safe file reader
  const handleFileSelectBase64 = (e: React.ChangeEvent<HTMLInputElement>, callback: (fileObj: { url: string, name: string, type: 'image' | 'document' }) => void) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) {
      alert('Ukuran berkas melebihi batasan 800 KB untuk optimasi cloud.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target?.result as string;
      const isImg = file.type.startsWith('image/');
      callback({
        url: base64,
        name: file.name,
        type: isImg ? 'image' : 'document'
      });
    };
    reader.readAsDataURL(file);
  };

  const handleToggleTeknisi = (name: string) => {
    setSelectedTeknisi(prev => 
      prev.includes(name) ? prev.filter(t => t !== name) : [...prev, name]
    );
  };

  // CREATE PROJECT
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!namaProject.trim()) return;

    setSubmitting(true);
    const projectId = 'PROJ-' + Date.now();
    const companyId = currentUser.companyId || 'default';
    const cabangId = currentUser.cabangId || 'pusat';

    const newProject: Project = {
      id: projectId,
      namaProject: namaProject,
      deskripsi: deskripsi,
      teknisi: selectedTeknisi,
      progres: status === 'done' || status === 'selesai' ? 100 : 0,
      status: status,
      tanggalMulai: new Date().toISOString().split('T')[0],
      tanggalSelesaiTarget: targetSelesai || undefined,
      laporanProgres: [],
      createdAt: new Date().toISOString(),
      companyId,
      cabangId,
      pic: pic || currentUser.name,
      
      // Extended DB properties
      budgetEstimasi: budgetEstimasi || 0,
      budgetRealisasi: 0,
      materials: [],
      vendors: [],
      documents: []
    };

    try {
      await setDoc(doc(db, 'projects', projectId), newProject);
      setShowAddModal(false);
      // Reset
      setNamaProject('');
      setDeskripsi('');
      setTargetSelesai('');
      setSelectedTeknisi([]);
      setStatus('planning');
      setBudgetEstimasi(0);
      setPic('');
      onRefresh();
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Gagal membuat proyek baru.');
    } finally {
      setSubmitting(false);
    }
  };

  // CHANGE STATUS QUICKLY (Kanban Pipeline transitions)
  const handleMoveStatus = async (projId: string, nextStatus: Project['status']) => {
    try {
      const proj = projects.find(p => p.id === projId);
      if (!proj) return;
      let nextProgress = proj.progres;
      if (nextStatus === 'done' || nextStatus === 'selesai') {
        nextProgress = 100;
      } else if (nextStatus === 'planning' || nextStatus === 'perencanaan') {
        nextProgress = Math.min(proj.progres, 15);
      } else if (nextStatus === 'inprogress' || nextStatus === 'berjalan') {
        nextProgress = Math.max(proj.progres, 30);
      } else if (nextStatus === 'inreview') {
        nextProgress = Math.max(proj.progres, 85);
      }

      await updateDoc(doc(db, 'projects', projId), {
        status: nextStatus,
        progres: nextProgress
      });

      onRefresh();
      if (selectedProject?.id === projId) {
        setSelectedProject({
          ...selectedProject,
          status: nextStatus,
          progres: nextProgress
        });
      }
    } catch (err) {
      console.error('Error updating status:', err);
    }
  };

  // ADD PROGRESS REPORT
  const handleAddReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newReportText.trim()) return;

    setAddingReport(true);
    const updatedReports = [...(selectedProject.laporanProgres || [])];
    const newReport: ProjectProgressReport = {
      id: 'REP-' + Date.now(),
      tanggal: new Date().toISOString().split('T')[0],
      laporan: newReportText,
      namaPelapor: currentUser.name,
      ...(attachedFile ? {
        attachmentUrl: attachedFile.url,
        attachmentName: attachedFile.name
      } : {})
    };
    updatedReports.unshift(newReport);

    const nextProgress = newReportProgress !== null ? newReportProgress : selectedProject.progres;
    const nextStatus = nextProgress >= 100 ? 'done' : selectedProject.status;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        laporanProgres: updatedReports,
        progres: nextProgress,
        status: nextStatus
      });

      setSelectedProject({
        ...selectedProject,
        laporanProgres: updatedReports,
        progres: nextProgress,
        status: nextStatus
      });

      setNewReportText('');
      setNewReportProgress(null);
      setAttachedFile(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    } finally {
      setAddingReport(false);
    }
  };

  // ADD MATERIAL
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !matName.trim()) return;

    const materialsList = [...(selectedProject.materials || [])];
    const newItem = {
      id: 'MAT-' + Date.now(),
      namaBarang: matName,
      jumlah: matQty,
      satuan: matUnit,
      estimasiHarga: matPrice,
      status: matStatus
    };
    materialsList.push(newItem);

    // Re-calculate budgetRealisasi (Actual Spend = contract costs + materials costs)
    const totalVendors = (selectedProject.vendors || []).reduce((acc, v) => acc + (v.biayaKontrak || 0), 0);
    const totalMaterials = materialsList.reduce((acc, m) => acc + ((m.estimasiHarga || 0) * m.jumlah), 0);
    const nextRealisasi = totalVendors + totalMaterials;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        materials: materialsList,
        budgetRealisasi: nextRealisasi
      });
      setSelectedProject({
        ...selectedProject,
        materials: materialsList,
        budgetRealisasi: nextRealisasi
      });
      setMatName('');
      setMatQty(1);
      setMatPrice(0);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // TOGGLE MATERIAL STATUS
  const handleToggleMaterialStatus = async (matId: string, current: 'tersedia' | 'dipesan' | 'habis') => {
    if (!selectedProject) return;
    const nextStatusMap: Record<string, 'tersedia' | 'dipesan' | 'habis'> = {
      'tersedia': 'dipesan',
      'dipesan': 'habis',
      'habis': 'tersedia'
    };
    const nextStatus = nextStatusMap[current];

    const updated = (selectedProject.materials || []).map(m => 
      m.id === matId ? { ...m, status: nextStatus } : m
    );

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        materials: updated
      });
      setSelectedProject({ ...selectedProject, materials: updated });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE MATERIAL
  const handleDeleteMaterial = async (matId: string) => {
    if (!selectedProject) return;
    const filtered = (selectedProject.materials || []).filter(m => m.id !== matId);
    const totalVendors = (selectedProject.vendors || []).reduce((acc, v) => acc + (v.biayaKontrak || 0), 0);
    const totalMaterials = filtered.reduce((acc, m) => acc + ((m.estimasiHarga || 0) * m.jumlah), 0);
    const nextRealisasi = totalVendors + totalMaterials;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        materials: filtered,
        budgetRealisasi: nextRealisasi
      });
      setSelectedProject({ ...selectedProject, materials: filtered, budgetRealisasi: nextRealisasi });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // ADD VENDOR
  const handleAddVendor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !vName.trim()) return;

    const vendorList = [...(selectedProject.vendors || [])];
    vendorList.push({
      id: 'VEN-' + Date.now(),
      namaVendor: vName,
      peran: vRole,
      kontak: vContact,
      biayaKontrak: vCost
    });

    const totalVendors = vendorList.reduce((acc, v) => acc + (v.biayaKontrak || 0), 0);
    const totalMaterials = (selectedProject.materials || []).reduce((acc, m) => acc + ((m.estimasiHarga || 0) * m.jumlah), 0);
    const nextRealisasi = totalVendors + totalMaterials;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        vendors: vendorList,
        budgetRealisasi: nextRealisasi
      });
      setSelectedProject({ ...selectedProject, vendors: vendorList, budgetRealisasi: nextRealisasi });
      setVName('');
      setVRole('');
      setVContact('');
      setVCost(0);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE VENDOR
  const handleDeleteVendor = async (venId: string) => {
    if (!selectedProject) return;
    const filtered = (selectedProject.vendors || []).filter(v => v.id !== venId);
    const totalVendors = filtered.reduce((acc, v) => acc + (v.biayaKontrak || 0), 0);
    const totalMaterials = (selectedProject.materials || []).reduce((acc, m) => acc + ((m.estimasiHarga || 0) * m.jumlah), 0);
    const nextRealisasi = totalVendors + totalMaterials;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        vendors: filtered,
        budgetRealisasi: nextRealisasi
      });
      setSelectedProject({ ...selectedProject, vendors: filtered, budgetRealisasi: nextRealisasi });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // ADD DOCUMENT
  const handleAddDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !docName.trim() || !docFile) return;

    const docList = [...(selectedProject.documents || [])];
    docList.push({
      id: 'DOC-' + Date.now(),
      namaDokumen: docName,
      tipeDokumen: docType,
      url: docFile.url,
      uploadedAt: new Date().toISOString().split('T')[0],
      uploadedBy: currentUser.name
    });

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        documents: docList
      });
      setSelectedProject({ ...selectedProject, documents: docList });
      setDocName('');
      setDocFile(null);
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE DOCUMENT
  const handleDeleteDocument = async (docId: string) => {
    if (!selectedProject) return;
    const filtered = (selectedProject.documents || []).filter(d => d.id !== docId);
    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        documents: filtered
      });
      setSelectedProject({ ...selectedProject, documents: filtered });
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  // MANAGE BUDGET OVERRIDE DIRECTLY
  const handleUpdateDirectBudget = async (est: number, real: number) => {
    if (!selectedProject) return;
    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        budgetEstimasi: est,
        budgetRealisasi: real
      });
      setSelectedProject({ ...selectedProject, budgetEstimasi: est, budgetRealisasi: real });
      onRefresh();
      alert('Anggaran berhasil diperbarui!');
    } catch (err) {
      console.error(err);
    }
  };

  // DELETE PROJECT
  const handleDeleteProject = (projId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Proyek',
      message: 'Apakah Anda yakin ingin menghapus proyek konstruksi ini? Seluruh material, berkas blueprint, dan laporan di dalamnya akan terhapus permanen.',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'projects', projId));
          setSelectedProject(null);
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
          onRefresh();
        } catch (err) {
          console.error(err);
        }
      },
      onCancel: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  // INLINE WORK ORDER CREATION
  const handleCreateWOForProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setWoSubmitting(true);
    try {
      const companyId = currentUser.companyId || 'default';
      const woId = await generateWONumber(currentUser.division || 'MTC', companyId);
      const safeWoId = woId.replace(/\//g, '-');
      const today = new Date().toISOString().split('T')[0];

      const newWO = {
        id: safeWoId,
        nomorWO: woId,
        nomorWR: 'PROJECT-' + selectedProject.id,
        tanggalWO: today,
        area: woArea || 'Area Konstruksi Lapangan',
        namaMesin: woNamaMesin || selectedProject.namaProject,
        jenisTindakan: woJenisTindakan,
        uraianPekerjaan: woUraian || `Pekerjaan Konstruksi / Teknisi untuk: ${selectedProject.namaProject}`,
        tipePenugasan: 'teknisi',
        namaVendor: '',
        teknisiDitugaskan: woTeknisi,
        diajukanOleh: currentUser.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        prioritas: woPrioritas,
        companyId,
        cabangId: selectedProject.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'work_orders', safeWoId), newWO);
      await updateDoc(doc(db, 'projects', selectedProject.id), { linkedWOId: woId });
      setSelectedProject({ ...selectedProject, linkedWOId: woId });
      setShowCreateWOForm(false);
      onRefresh();
      alert(`Berhasil membuat Work Order ${woId}!`);
    } catch (err) {
      console.error(err);
      alert('Gagal menerbitkan WO.');
    } finally {
      setWoSubmitting(false);
    }
  };

  const handleOpenCreateWO = (proj: Project) => {
    setWoArea('Gedung Proyek & Konstruksi');
    setWoNamaMesin(proj.namaProject);
    setWoJenisTindakan('Proyek Konstruksi / Perbaikan');
    setWoUraian(proj.deskripsi || `Instruksi Teknisi Lapangan untuk Proyek: ${proj.namaProject}`);
    setWoTeknisi(proj.teknisi || []);
    setWoPrioritas('sedang');
    setShowCreateWOForm(true);
  };

  // Normalise status names for columns
  const getNormStatus = (st: Project['status']): 'planning' | 'inprogress' | 'inreview' | 'done' | 'suspended' => {
    if (st === 'perencanaan') return 'planning';
    if (st === 'berjalan') return 'inprogress';
    if (st === 'selesai') return 'done';
    if (st === 'tertunda') return 'suspended';
    return st;
  };

  const filteredProjects = projects.filter(p => {
    const normSt = getNormStatus(p.status);
    const matchesSearch = p.namaProject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.deskripsi && p.deskripsi.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || normSt === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const columns = [
    { id: 'planning', label: 'Planning (RAB & Desain)', bg: 'bg-slate-50', border: 'border-slate-200', text: 'text-slate-700', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'inprogress', label: 'In Progress (Eksekusi)', bg: 'bg-amber-50/20', border: 'border-amber-100', text: 'text-amber-800', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
    { id: 'inreview', label: 'In Review (Inspeksi & Kalibrasi)', bg: 'bg-purple-50/20', border: 'border-purple-100', text: 'text-purple-800', badgeColor: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'done', label: 'Handover / Done', bg: 'bg-emerald-50/20', border: 'border-emerald-100', text: 'text-emerald-850', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  ];

  const handleExportCSV = () => {
    const headers = ['Nama Project', 'Deskripsi', 'Progress (%)', 'Status', 'Tanggal Mulai', 'Target Selesai', 'PIC', 'RAB Estimasi', 'Realisasi Biaya'];
    const keys = ['namaProject', 'deskripsi', 'progres', 'status', 'tanggalMulai', 'tanggalSelesaiTarget', 'pic', 'budgetEstimasi', 'budgetRealisasi'];
    exportToExcelCSV(filteredProjects, headers, keys, 'Laporan_Proyek_Konstruksi');
  };

  return (
    <div className="space-y-6" id="project-management-container">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-xs text-slate-900">
        <div>
          <h2 className="text-lg font-bold font-sans tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Tab Proyek & Konstruksi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pantau siklus konstruksi engineering, anggaran RAB, material bangunan, vendor eksternal, dan dokumen teknis terpusat.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setIsKanban(true)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                isKanban ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Layers className="w-3.5 h-3.5" /> Kanban Board
            </button>
            <button
              onClick={() => setIsKanban(false)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer transition ${
                !isKanban ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ListFilter className="w-3.5 h-3.5" /> Daftar List
            </button>
          </div>

          {isAdmin && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" /> Proyek Baru
            </button>
          )}
        </div>
      </div>

      {/* KPI METRICS OVERVIEW */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Proyek</span>
          <span className="text-xl font-black text-slate-800 mt-1 block">{projects.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Planning</span>
          <span className="text-xl font-black text-blue-600 mt-1 block">
            {projects.filter(p => ['planning', 'perencanaan'].includes(p.status)).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In Progress</span>
          <span className="text-xl font-black text-amber-600 mt-1 block">
            {projects.filter(p => ['inprogress', 'berjalan'].includes(p.status)).length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">In Review</span>
          <span className="text-xl font-black text-purple-600 mt-1 block">
            {projects.filter(p => p.status === 'inreview').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selesai / Handover</span>
          <span className="text-xl font-black text-emerald-600 mt-1 block">
            {projects.filter(p => ['done', 'selesai'].includes(p.status)).length}
          </span>
        </div>
      </div>

      {/* FILTERS & SEARCH */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between shadow-2xs">
        <div className="relative flex-1 w-full max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari proyek berdasarkan nama atau PIC..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 uppercase cursor-pointer"
          >
            <option value="all">Semua Tahapan</option>
            <option value="planning">Planning (RAB & Desain)</option>
            <option value="inprogress">In Progress (Eksekusi)</option>
            <option value="inreview">In Review (Inspeksi)</option>
            <option value="done">Handover / Done</option>
            <option value="suspended">Suspended / On Hold</option>
          </select>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold rounded-lg shadow-2xs transition flex items-center gap-1.5 cursor-pointer uppercase"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* VIEW PANEL: KANBAN BOARD */}
      {isKanban ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 overflow-x-auto pb-4 items-start" id="kanban-board-grid">
          {columns.map(col => {
            // Get projects matching the normalized column status
            const colProjects = filteredProjects.filter(p => {
              const norm = getNormStatus(p.status);
              return norm === col.id;
            });

            return (
              <div key={col.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-200 min-h-[450px] flex flex-col space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h3 className="text-xs font-bold text-slate-800 tracking-wider uppercase font-sans flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-600 inline-block animate-pulse"></span>
                    {col.label}
                  </h3>
                  <span className="bg-slate-200 text-slate-700 text-[10px] font-mono px-2 py-0.5 rounded-full font-bold">
                    {colProjects.length}
                  </span>
                </div>

                <div className="space-y-3 flex-1 overflow-y-auto max-h-[550px] pr-1">
                  {colProjects.length === 0 ? (
                    <div className="border border-dashed border-slate-200 rounded-xl p-6 text-center text-slate-400 text-[11px]">
                      Kosong
                    </div>
                  ) : (
                    colProjects.map(proj => {
                      const matCount = proj.materials?.length || 0;
                      const readyMat = proj.materials?.filter(m => m.status === 'tersedia').length || 0;
                      const venCount = proj.vendors?.length || 0;

                      return (
                        <div 
                          key={proj.id}
                          className={`bg-white rounded-xl border border-slate-200 p-4 shadow-3xs hover:shadow-xs transition duration-200 space-y-3 ${
                            getNormStatus(proj.status) === 'suspended' ? 'border-l-4 border-l-rose-500 bg-rose-50/10' : ''
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-[9px] font-mono font-bold text-slate-400">{proj.id}</span>
                            {proj.status === 'tertunda' || proj.status === 'suspended' ? (
                              <span className="bg-rose-100 text-rose-800 border border-rose-200 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase">On Hold</span>
                            ) : null}
                          </div>

                          <h4 className="text-xs font-extrabold text-slate-800 line-clamp-2 leading-snug">
                            {proj.namaProject}
                          </h4>

                          <p className="text-[11px] text-slate-500 line-clamp-2">{proj.deskripsi || 'Tidak ada deskripsi.'}</p>

                          {/* Progress bar */}
                          <div className="space-y-1">
                            <div className="flex justify-between text-[9px] font-bold text-slate-400">
                              <span>Progres</span>
                              <span className="text-indigo-650">{proj.progres}%</span>
                            </div>
                            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                              <div className="bg-indigo-600 h-full rounded-full transition-all duration-350" style={{ width: `${proj.progres}%` }}></div>
                            </div>
                          </div>

                          {/* Quick budget snapshot */}
                          <div className="text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-150 space-y-0.5">
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>RAB:</span>
                              <span className="font-bold text-slate-800">{formatIDR(proj.budgetEstimasi || 0)}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 font-medium">
                              <span>Realisasi:</span>
                              <span className={`font-bold ${proj.budgetRealisasi && proj.budgetEstimasi && proj.budgetRealisasi > proj.budgetEstimasi ? 'text-rose-600' : 'text-indigo-600'}`}>
                                {formatIDR(proj.budgetRealisasi || 0)}
                              </span>
                            </div>
                          </div>

                          {/* Meta details */}
                          <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-100">
                            <span>👤 {proj.pic || 'No PIC'}</span>
                            <span className="font-semibold text-slate-600">🛠️ {proj.teknisi.length} Tek | 🏢 {venCount} Ven</span>
                          </div>

                          {/* Material Check */}
                          {matCount > 0 && (
                            <div className="text-[9px] bg-indigo-50/40 text-indigo-900 px-2 py-1 rounded-md border border-indigo-100/50 flex justify-between font-bold">
                              <span>Ketersediaan Material:</span>
                              <span>{readyMat}/{matCount} Siap</span>
                            </div>
                          )}

                          {/* Interactive status transition actions */}
                          <div className="flex items-center justify-between pt-2 border-t border-slate-100 gap-1">
                            <button
                              onClick={() => setSelectedProject(proj)}
                              className="text-[10px] font-bold text-indigo-650 hover:text-indigo-750 flex items-center gap-0.5 cursor-pointer bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-200"
                            >
                              Detail & File
                            </button>
                            <div className="flex items-center gap-1">
                              {col.id !== 'planning' && (
                                <button
                                  title="Pindahkan ke tahapan sebelumnya"
                                  onClick={() => {
                                    const stages: Project['status'][] = ['planning', 'inprogress', 'inreview', 'done'];
                                    const currentIdx = stages.indexOf(col.id as any);
                                    if (currentIdx > 0) {
                                      handleMoveStatus(proj.id, stages[currentIdx - 1]);
                                    }
                                  }}
                                  className="p-1 hover:bg-slate-150 rounded border border-slate-200 text-slate-500 cursor-pointer"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                              {col.id !== 'done' && (
                                <button
                                  title="Pindahkan ke tahapan berikutnya"
                                  onClick={() => {
                                    const stages: Project['status'][] = ['planning', 'inprogress', 'inreview', 'done'];
                                    const currentIdx = stages.indexOf(col.id as any);
                                    if (currentIdx < stages.length - 1) {
                                      handleMoveStatus(proj.id, stages[currentIdx + 1]);
                                    }
                                  }}
                                  className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-150 cursor-pointer font-bold flex items-center gap-0.5 text-[9px]"
                                >
                                  <span>Lanjut</span>
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* VIEW PANEL: LIST VIEW */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs" id="project-list-table">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-mono text-[10px] uppercase border-b border-slate-200">
                  <th className="p-4 font-black">ID & Nama Proyek</th>
                  <th className="p-4 font-black">Tahapan / Status</th>
                  <th className="p-4 font-black">PIC & Tim</th>
                  <th className="p-4 font-black">Kemajuan</th>
                  <th className="p-4 font-black text-right">RAB Estimasi</th>
                  <th className="p-4 font-black text-right">Pengeluaran Aktual</th>
                  <th className="p-4 font-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-850">
                {filteredProjects.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-12 text-center text-slate-400 italic">
                      Tidak ada proyek yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredProjects.map(proj => {
                    const normSt = getNormStatus(proj.status);
                    const matchingCol = columns.find(c => c.id === normSt) || columns[0];
                    return (
                      <tr key={proj.id} className="hover:bg-slate-50/60 transition">
                        <td className="p-4">
                          <span className="text-[9px] font-mono text-slate-400 block font-bold">{proj.id}</span>
                          <span className="font-extrabold text-slate-800 text-xs block mt-0.5">{proj.namaProject}</span>
                          <span className="text-[10px] text-slate-400 line-clamp-1 block">{proj.deskripsi || 'No description'}</span>
                        </td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase border ${matchingCol.badgeColor}`}>
                            {matchingCol.label}
                          </span>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-slate-700">👤 {proj.pic}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">{proj.teknisi.length} Teknisi Lapangan</div>
                        </td>
                        <td className="p-4 w-40">
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-500 mb-1">
                            <span>{proj.progres}%</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className="bg-indigo-650 h-full rounded-full transition-all" style={{ width: `${proj.progres}%` }}></div>
                          </div>
                        </td>
                        <td className="p-4 font-bold text-right text-slate-700 font-mono">
                          {formatIDR(proj.budgetEstimasi || 0)}
                        </td>
                        <td className="p-4 font-bold text-right text-indigo-750 font-mono">
                          {formatIDR(proj.budgetRealisasi || 0)}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedProject(proj)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                            >
                              <Eye className="w-3.5 h-3.5" /> Detail
                            </button>
                            {isAdmin && (
                              <button
                                onClick={() => handleDeleteProject(proj.id)}
                                className="p-1.5 text-rose-600 hover:bg-rose-50 border border-transparent hover:border-rose-200 rounded-lg cursor-pointer transition"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL: ADD NEW PROJECT */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-sans font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Tambah Proyek & Konstruksi Baru
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4 text-slate-800 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nama Proyek / Konstruksi *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Konstruksi Sipil Gudang Utilitas Baru atau Overhaul Chiller"
                  value={namaProject}
                  onChange={(e) => setNamaProject(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Deskripsi & Ruang Lingkup Kerja</label>
                <textarea
                  rows={2}
                  placeholder="Deskripsikan pekerjaan konstruksi sipil, listrik, piping, atau struktur yang dikerjakan..."
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Estimasi RAB (IDR) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={budgetEstimasi || ''}
                    onChange={(e) => setBudgetEstimasi(Number(e.target.value))}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Target Selesai</label>
                  <input
                    type="date"
                    value={targetSelesai}
                    onChange={(e) => setTargetSelesai(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">PIC Proyek / Konstruksi *</label>
                  <select
                    required
                    value={pic}
                    onChange={(e) => setPic(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    <option value="">-- Pilih PIC --</option>
                    {(allUsers.length > 0 ? allUsers : technicians).map((u) => (
                      <option key={u.username} value={u.name}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Tahapan Awal *</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white cursor-pointer"
                  >
                    <option value="planning">Planning (RAB & Desain)</option>
                    <option value="inprogress">In Progress (Eksekusi)</option>
                    <option value="inreview">In Review (Inspeksi & Kalibrasi)</option>
                    <option value="done">Handover / Done (Selesai)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                  <Users className="w-4 h-4 text-indigo-500" /> Pilih Teknisi Pelaksana Internal (Multi-select)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-32 overflow-y-auto grid grid-cols-2 gap-2">
                  {technicians.map((tech) => {
                    const isChecked = selectedTeknisi.includes(tech.name);
                    return (
                      <label 
                        key={tech.username} 
                        className={`flex items-center gap-2 p-1.5 rounded border text-xs cursor-pointer select-none transition ${
                          isChecked ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold' : 'bg-white border-slate-100 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTeknisi(tech.name)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="truncate">{tech.name} <span className="text-[9px] text-slate-400">({tech.subRole})</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
                >
                  {submitting ? 'Menyimpan...' : 'Buat Proyek'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL PROJECT WITH TABS */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-4xl w-full overflow-hidden shadow-2xl animate-scaleUp flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50 text-slate-900 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Proyek & Konstruksi Detail</span>
                <h3 className="font-sans font-bold text-slate-900 text-sm mt-0.5">{selectedProject.namaProject}</h3>
              </div>
              <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex bg-slate-100 border-b border-slate-200 p-1">
              {[
                { id: 'timeline', label: 'Laporan & Progress', icon: <TrendingUp className="w-3.5 h-3.5" /> },
                { id: 'anggaran', label: 'RAB & Material', icon: <DollarSign className="w-3.5 h-3.5" /> },
                { id: 'vendor', label: 'Tim & Kontraktor', icon: <HardHat className="w-3.5 h-3.5" /> },
                { id: 'dokumen', label: 'Dokumen Teknis', icon: <FileCheck className="w-3.5 h-3.5" /> }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveDetailTab(tab.id as any)}
                  className={`flex-1 py-2 px-3 text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    activeDetailTab === tab.id 
                      ? 'bg-white text-indigo-750 shadow-2xs font-bold border-b-2 border-indigo-650' 
                      : 'text-slate-500 hover:bg-white/50 hover:text-slate-800'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>

            {/* MODAL CONTENT BODY */}
            <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto text-slate-800">
              
              {/* TOP SUMMARY STRIP */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 border border-slate-200 p-4 rounded-xl text-xs">
                <div>
                  <span className="text-slate-400 font-bold block text-[9px] uppercase">PIC Proyek</span>
                  <p className="text-slate-800 font-extrabold mt-0.5">👤 {selectedProject.pic}</p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Status Tahapan</span>
                  <p className="text-slate-800 mt-0.5 uppercase font-bold text-[10px]">
                    {getNormStatus(selectedProject.status).replace('planning', 'Planning').replace('inprogress', 'In Progress').replace('inreview', 'In Review').replace('done', 'Selesai')}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Progres Kerja</span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-indigo-700 font-bold">{selectedProject.progres}%</span>
                    <div className="flex-1 bg-slate-200 h-1.5 w-16 rounded-full overflow-hidden">
                      <div className="bg-indigo-650 h-full" style={{ width: `${selectedProject.progres}%` }}></div>
                    </div>
                  </div>
                </div>
                <div>
                  <span className="text-slate-400 font-bold block text-[9px] uppercase">Work Order Terkait</span>
                  {selectedProject.linkedWOId ? (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded font-mono text-[9px] font-bold inline-flex items-center gap-1">
                      <Wrench className="w-2.5 h-2.5" /> {selectedProject.linkedWOId}
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleOpenCreateWO(selectedProject)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] px-2 py-0.5 rounded font-bold cursor-pointer font-sans"
                    >
                      + Terbitkan WO
                    </button>
                  )}
                </div>
              </div>

              {/* RENDER ACTIVE TAB */}
              {activeDetailTab === 'timeline' && (
                <div className="space-y-4">
                  {/* Create Report Form */}
                  <form onSubmit={handleAddReport} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Kirim Laporan Progres Harian & Kendala</h4>
                    
                    <div className="space-y-2">
                      <textarea
                        required
                        rows={2}
                        placeholder="Uraikan kemajuan hari ini, kendala cuaca, kedatangan material, atau hasil uji coba..."
                        value={newReportText}
                        onChange={(e) => setNewReportText(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none"
                      />
                    </div>

                    {attachedFile && (
                      <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                        <span className="truncate font-semibold text-slate-600">📎 {attachedFile.name}</span>
                        <button type="button" onClick={() => setAttachedFile(null)} className="text-rose-600 font-bold text-[10px] hover:underline">HAPUS</button>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-4 pt-1">
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 px-3 py-1.5 bg-white border border-slate-250 rounded-lg text-[10px] font-bold cursor-pointer hover:bg-slate-100">
                          <Paperclip className="w-3.5 h-3.5 text-slate-400" /> Upload Lampiran Gambar
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            className="hidden"
                            onChange={(e) => handleFileSelectBase64(e, setAttachedFile)}
                          />
                        </label>

                        <div className="flex items-center gap-1">
                          <span className="text-[10px] font-bold text-slate-500">Update Progres:</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            placeholder={String(selectedProject.progres)}
                            className="w-16 px-2 py-1 border border-slate-200 rounded text-center text-xs font-bold bg-white"
                            value={newReportProgress !== null ? newReportProgress : ''}
                            onChange={(e) => setNewReportProgress(e.target.value ? Number(e.target.value) : null)}
                          />
                          <span className="text-[10px] text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <button
                        type="submit"
                        disabled={addingReport || !newReportText.trim()}
                        className="px-4 py-1.5 bg-indigo-650 hover:bg-indigo-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 shadow-xs cursor-pointer"
                      >
                        <Send className="w-3 h-3" /> Kirim
                      </button>
                    </div>
                  </form>

                  {/* Timeline Logs List */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-2">Linimasa & Riwayat Pekerjaan</h4>
                    {(!selectedProject.laporanProgres || selectedProject.laporanProgres.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">Belum ada catatan progres harian untuk proyek ini.</p>
                    ) : (
                      <div className="relative border-l border-slate-200 pl-4 ml-2.5 space-y-4">
                        {selectedProject.laporanProgres.map((rep) => (
                          <div key={rep.id} className="relative">
                            <span className="absolute -left-[21px] mt-1 w-2.5 h-2.5 bg-indigo-600 rounded-full border-2 border-white ring-4 ring-indigo-50"></span>
                            <div className="bg-slate-50 p-3 rounded-lg border border-slate-150 text-xs">
                              <div className="flex justify-between text-[9px] text-slate-400 font-bold border-b pb-1 mb-1">
                                <span>{rep.tanggal}</span>
                                <span>Oleh: {rep.namaPelapor}</span>
                              </div>
                              <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{rep.laporan}</p>
                              {rep.attachmentUrl && (
                                <div className="mt-2 border-t pt-2">
                                  {rep.attachmentUrl.startsWith('data:image/') ? (
                                    <img src={rep.attachmentUrl} className="max-h-36 rounded border border-slate-200 shadow-3xs" alt="Lampiran" referrerPolicy="no-referrer" />
                                  ) : (
                                    <a href={rep.attachmentUrl} download={rep.attachmentName} className="text-indigo-650 hover:underline font-bold text-[10px]">
                                      📥 {rep.attachmentName || 'Unduh Berkas'}
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: BUDGETS & MATERIALS */}
              {activeDetailTab === 'anggaran' && (
                <div className="space-y-6">
                  {/* Budget Cards Overview */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block">RAB Estimasi (Plafon)</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400 font-bold">Rp</span>
                        <input
                          type="number"
                          className="font-bold text-slate-800 text-sm bg-white border border-slate-200 px-2 py-1 rounded w-full font-mono"
                          value={selectedProject.budgetEstimasi || 0}
                          onChange={(e) => handleUpdateDirectBudget(Number(e.target.value), selectedProject.budgetRealisasi || 0)}
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 block">Plafon anggaran maksimum proyek.</span>
                    </div>

                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 space-y-2">
                      <span className="text-[10px] font-bold text-indigo-700 uppercase tracking-wide block">Pengeluaran Aktual</span>
                      <div className="text-base font-black text-indigo-900 font-mono">
                        {formatIDR(selectedProject.budgetRealisasi || 0)}
                      </div>
                      <span className="text-[9px] text-indigo-600 block">Akumulasi otomatis biaya material & kontrak vendor.</span>
                    </div>

                    <div className="bg-amber-50/40 p-4 rounded-xl border border-amber-200 space-y-2">
                      <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wide block">Sisa / Defisit Plafon</span>
                      <div className="text-base font-black font-mono">
                        {(() => {
                          const limit = selectedProject.budgetEstimasi || 0;
                          const spent = selectedProject.budgetRealisasi || 0;
                          const rem = limit - spent;
                          return (
                            <span className={rem >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                              {formatIDR(rem)} {rem < 0 ? '(Overdraft)' : ''}
                            </span>
                          );
                        })()}
                      </div>
                      <span className="text-[9px] text-amber-600 block">Batas sisa dana yang aman dibelanjakan.</span>
                    </div>
                  </div>

                  {/* Add Material Checklist */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-2 flex items-center gap-1">
                      <ClipboardList className="w-4 h-4 text-indigo-600" /> Rincian Pengadaan Suku Cadang & Material Konstruksi
                    </h4>

                    <form onSubmit={handleAddMaterial} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nama Material / Jasa</label>
                        <input
                          type="text"
                          required
                          placeholder="Semen, Tiang H-Beam, Kabel NYY..."
                          value={matName}
                          onChange={(e) => setMatName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Vol / Jml</label>
                          <input
                            type="number"
                            min={1}
                            required
                            value={matQty}
                            onChange={(e) => setMatQty(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded text-center"
                          />
                        </div>
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Satuan</label>
                          <input
                            type="text"
                            required
                            placeholder="Pcs, Zak, Mtr"
                            value={matUnit}
                            onChange={(e) => setMatUnit(e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Harga Satuan (IDR)</label>
                        <input
                          type="number"
                          min={0}
                          required
                          value={matPrice || ''}
                          onChange={(e) => setMatPrice(Number(e.target.value))}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded font-mono"
                        />
                      </div>
                      <div>
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded cursor-pointer transition">
                          + Tambah Material
                        </button>
                      </div>
                    </form>

                    {/* Materials Checklist Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-mono text-[9px] uppercase border-b border-slate-200">
                            <th className="p-3">Nama Barang</th>
                            <th className="p-3 text-center">Jumlah</th>
                            <th className="p-3 text-right">Harga Satuan</th>
                            <th className="p-3 text-right">Subtotal</th>
                            <th className="p-3 text-center">Status Siap</th>
                            <th className="p-3 text-center">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!selectedProject.materials || selectedProject.materials.length === 0) ? (
                            <tr>
                              <td colSpan={6} className="p-4 text-center text-slate-400 italic">Belum ada material yang ditambahkan.</td>
                            </tr>
                          ) : (
                            selectedProject.materials.map(m => (
                              <tr key={m.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-bold text-slate-700">{m.namaBarang}</td>
                                <td className="p-3 text-center font-semibold text-slate-600">{m.jumlah} {m.satuan}</td>
                                <td className="p-3 text-right font-mono">{formatIDR(m.estimasiHarga || 0)}</td>
                                <td className="p-3 text-right font-bold font-mono text-slate-800">
                                  {formatIDR((m.estimasiHarga || 0) * m.jumlah)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMaterialStatus(m.id, m.status)}
                                    className={`px-2 py-1 rounded font-bold text-[9px] uppercase border cursor-pointer ${
                                      m.status === 'tersedia' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                      m.status === 'dipesan' ? 'bg-amber-50 text-amber-700 border-amber-200 animate-pulse' :
                                      'bg-rose-50 text-rose-700 border-rose-200'
                                    }`}
                                  >
                                    {m.status}
                                  </button>
                                </td>
                                <td className="p-3 text-center">
                                  <button onClick={() => handleDeleteMaterial(m.id)} className="text-rose-600 hover:text-rose-800 cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: TEAM & VENDORS */}
              {activeDetailTab === 'vendor' && (
                <div className="space-y-6">
                  {/* Tim Internal List */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                      <Users className="w-4 h-4 text-indigo-600" /> Tim Teknisi & Staf Internal Berwenang
                    </h4>
                    <p className="text-[11px] text-slate-500">Pengawas dan personil internal perusahaan yang ditugaskan pada proyek ini.</p>
                    <div className="flex flex-wrap gap-2">
                      <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-250 text-xs font-semibold">
                        👑 PIC Pengawas: <strong className="text-indigo-800">{selectedProject.pic}</strong>
                      </div>
                      {selectedProject.teknisi.map(t => (
                        <div key={t} className="bg-indigo-55/40 text-indigo-900 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold">
                          🛠️ {t} (Teknisi Lapangan)
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* External Contractor / Vendors */}
                  <div className="space-y-4">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-2 flex items-center gap-1.5">
                      <HardHat className="w-4 h-4 text-amber-600" /> Koordinasi Vendor & Kontraktor Eksternal
                    </h4>

                    <form onSubmit={handleAddVendor} className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nama Perusahaan / Kontraktor</label>
                        <input
                          type="text"
                          required
                          placeholder="PT Cahaya Kontraktor, Toko Besi..."
                          value={vName}
                          onChange={(e) => setVName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Peran Spesialisasi</label>
                        <input
                          type="text"
                          required
                          placeholder="Pekerjaan Atap, MEP, Cor beton..."
                          value={vRole}
                          onChange={(e) => setVRole(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Kontak Vendor</label>
                        <input
                          type="text"
                          placeholder="Telepon / Email..."
                          value={vContact}
                          onChange={(e) => setVContact(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Biaya (IDR)</label>
                          <input
                            type="number"
                            min={0}
                            required
                            value={vCost || ''}
                            onChange={(e) => setVCost(Number(e.target.value))}
                            className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded font-mono"
                          />
                        </div>
                        <div>
                          <button type="submit" className="w-full bg-indigo-650 hover:bg-indigo-600 text-white font-bold py-1.5 rounded cursor-pointer transition text-[11px]">
                            + Tambah Vendor
                          </button>
                        </div>
                      </div>
                    </form>

                    {/* Vendors Table */}
                    <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-400 font-mono text-[9px] uppercase border-b border-slate-200">
                            <th className="p-3">Nama Kontraktor</th>
                            <th className="p-3">Spesialisasi / Peran</th>
                            <th className="p-3">Kontak Person</th>
                            <th className="p-3 text-right">Biaya Kontrak</th>
                            <th className="p-3 text-center">Hapus</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(!selectedProject.vendors || selectedProject.vendors.length === 0) ? (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-slate-400 italic">Belum ada vendor eksternal yang dihubungkan ke proyek ini.</td>
                            </tr>
                          ) : (
                            selectedProject.vendors.map(v => (
                              <tr key={v.id} className="hover:bg-slate-50/50">
                                <td className="p-3 font-bold text-slate-700">{v.namaVendor}</td>
                                <td className="p-3 font-semibold text-slate-600">{v.peran}</td>
                                <td className="p-3 text-slate-500">{v.kontak || '-'}</td>
                                <td className="p-3 text-right font-bold font-mono text-indigo-750">{formatIDR(v.biayaKontrak || 0)}</td>
                                <td className="p-3 text-center">
                                  <button onClick={() => handleDeleteVendor(v.id)} className="text-rose-600 hover:text-rose-850 cursor-pointer">
                                    <Trash2 className="w-3.5 h-3.5 mx-auto" />
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: TECHNICAL DOCUMENTS */}
              {activeDetailTab === 'dokumen' && (
                <div className="space-y-6">
                  {/* Technical Document Uploader Form */}
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest flex items-center gap-1">
                      <FileCheck className="w-4 h-4 text-indigo-600" /> Pengarsipan Berkas Blueprint & Dokumen Kalibrasi
                    </h4>
                    <p className="text-[11px] text-slate-500">Upload dan bagikan dokumen serah terima (BAST), layout blueprint CAD, panduan operasional mesin, atau sertifikasi.</p>

                    <form onSubmit={handleAddDocument} className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Nama / Judul Dokumen *</label>
                        <input
                          type="text"
                          required
                          placeholder="Blueprint Sipil Fondasi, Manual SOP, BAST..."
                          value={docName}
                          onChange={(e) => setDocName(e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded"
                        />
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Tipe / Kategori Dokumen</label>
                        <select
                          value={docType}
                          onChange={(e) => setDocType(e.target.value as any)}
                          className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded cursor-pointer"
                        >
                          <option value="blueprint">Blueprint / Gambar CAD</option>
                          <option value="manual">Manual Operasional / SOP</option>
                          <option value="handover">Serah Terima / BAST</option>
                          <option value="kalibrasi">Kalibrasi & Commissioning</option>
                          <option value="lainnya">Lainnya</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-bold text-slate-500 uppercase mb-1">Pilih File (Gambar/PDF, Maks 800KB)</label>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          required
                          className="w-full px-2.5 py-1 bg-white border border-slate-200 rounded text-[11px]"
                          onChange={(e) => {
                            const callback = (fileObj: { url: string, name: string }) => {
                              setDocFile(fileObj);
                            };
                            handleFileSelectBase64(e, callback);
                          }}
                        />
                      </div>
                      <div>
                        <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-1.5 rounded cursor-pointer transition">
                          Upload Dokumen
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Documents List Grid */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b pb-1">Daftar Arsip Gambar Teknis & Dokumen</h4>
                    {(!selectedProject.documents || selectedProject.documents.length === 0) ? (
                      <p className="text-xs text-slate-400 italic">Belum ada blueprint atau sertifikat kalibrasi yang diunggah.</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedProject.documents.map(d => (
                          <div key={d.id} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 flex items-start justify-between gap-3 text-xs">
                            <div className="flex gap-2.5 items-start overflow-hidden">
                              <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 font-mono font-bold text-[9px]">
                                {d.tipeDokumen.toUpperCase()}
                              </div>
                              <div className="overflow-hidden">
                                <h5 className="font-extrabold text-slate-800 truncate">{d.namaDokumen}</h5>
                                <p className="text-[10px] text-slate-400 mt-0.5">Tanggal: {d.uploadedAt} | Pengunggah: {d.uploadedBy}</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <a
                                href={d.url}
                                download={d.namaDokumen}
                                className="p-1.5 bg-white hover:bg-slate-100 border border-slate-250 rounded text-slate-600 cursor-pointer"
                                title="Download File"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => handleDeleteDocument(d.id)}
                                className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-150 rounded text-rose-600 cursor-pointer"
                                title="Hapus Dokumen"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center">
              <div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteProject(selectedProject.id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Hapus Proyek
                  </button>
                )}
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="px-5 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold rounded-lg transition cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CREATE WORK ORDER FOR PROJECT MODAL */}
      {showCreateWOForm && selectedProject && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp text-slate-800 flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-sans font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Menerbitkan Work Order Teknisi Proyek
              </h3>
              <button onClick={() => setShowCreateWOForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWOForProject} className="p-6 space-y-4 flex-1 overflow-y-auto">
              <div className="bg-indigo-50 text-indigo-900 border border-indigo-150 p-3 rounded-lg text-xs leading-relaxed">
                Menerbitkan Work Order (WO) resmi bagi tim teknisi internal untuk penugasan pada proyek <strong>{selectedProject.namaProject}</strong>.
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Area / Lokasi Kerja *</label>
                <input
                  type="text"
                  required
                  value={woArea}
                  onChange={(e) => setWoArea(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Struktur / Nama Mesin Proyek *</label>
                <input
                  type="text"
                  required
                  value={woNamaMesin}
                  onChange={(e) => setWoNamaMesin(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Jenis Tindakan *</label>
                  <input
                    type="text"
                    required
                    value={woJenisTindakan}
                    onChange={(e) => setWoJenisTindakan(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Skala Prioritas *</label>
                  <select
                    value={woPrioritas}
                    onChange={(e) => setWoPrioritas(e.target.value as any)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white cursor-pointer"
                  >
                    <option value="rendah">Rendah</option>
                    <option value="sedang">Sedang</option>
                    <option value="tinggi">Tinggi</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Instruksi Detail Kerja *</label>
                <textarea
                  rows={3}
                  required
                  value={woUraian}
                  onChange={(e) => setWoUraian(e.target.value)}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white transition resize-none"
                />
              </div>

              <div className="border-t border-slate-150 pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowCreateWOForm(false)}
                  className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={woSubmitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
                >
                  {woSubmitting ? 'Menerbitkan...' : 'Terbitkan WO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETION DIALOG */}
      <ConfirmModal
        isOpen={dialogConfig.isOpen}
        title={dialogConfig.title}
        message={dialogConfig.message}
        confirmLabel={dialogConfig.confirmLabel}
        cancelLabel={dialogConfig.cancelLabel}
        variant={dialogConfig.variant}
        onConfirm={dialogConfig.onConfirm}
        onCancel={dialogConfig.onCancel}
      />
    </div>
  );
}
