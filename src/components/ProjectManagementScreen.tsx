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
  Percent, 
  Search, 
  MapPin, 
  X, 
  Download,
  Wrench,
  Paperclip,
  File
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
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  
  // Add Project Form State
  const [namaProject, setNamaProject] = useState('');
  const [deskripsi, setDeskripsi] = useState('');
  const [targetSelesai, setTargetSelesai] = useState('');
  const [selectedTeknisi, setSelectedTeknisi] = useState<string[]>([]);
  const [status, setStatus] = useState<'perencanaan' | 'berjalan' | 'selesai' | 'tertunda'>('perencanaan');
  const [initialProgress, setInitialProgress] = useState(0);
  const [pic, setPic] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Create Work Order inline Form State
  const [showCreateWOForm, setShowCreateWOForm] = useState(false);
  const [woArea, setWoArea] = useState('');
  const [woNamaMesin, setWoNamaMesin] = useState('');
  const [woJenisTindakan, setWoJenisTindakan] = useState('Proyek Konstruksi / Perbaikan');
  const [woUraian, setWoUraian] = useState('');
  const [woTeknisi, setWoTeknisi] = useState<string[]>([]);
  const [woPrioritas, setWoPrioritas] = useState<'rendah' | 'sedang' | 'tinggi' | 'emergency'>('sedang');
  const [woSubmitting, setWoSubmitting] = useState(false);

  // New Progress Report Form State
  const [newReportText, setNewReportText] = useState('');
  const [newReportProgress, setNewReportProgress] = useState<number | null>(null);
  const [addingReport, setAddingReport] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ url: string; name: string; type: 'image' | 'document' } | null>(null);

  // Search and Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

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

  const isAdmin = currentUser.role === 'admin' || currentUser.username === 'admin';

  const handleProgressFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2000000) { // Limit to 2MB
      alert('Ukuran file terlalu besar. Maksimal adalah 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      const isImg = file.type.startsWith('image/');
      setAttachedFile({
        url: base64,
        name: file.name,
        type: isImg ? 'image' : 'document'
      });
    };
    reader.readAsDataURL(file);
  };

  // Toggle technician selection
  const handleToggleTeknisi = (username: string) => {
    if (selectedTeknisi.includes(username)) {
      setSelectedTeknisi(selectedTeknisi.filter(t => t !== username));
    } else {
      setSelectedTeknisi([...selectedTeknisi, username]);
    }
  };

  const handleOpenCreateWO = (proj: Project) => {
    setWoArea(proj.cabangId === 'pusat' || !proj.cabangId ? 'HO / Kantor Pusat' : (branches.find(b => b.id === proj.cabangId)?.name || 'HO'));
    setWoNamaMesin(proj.namaProject);
    setWoJenisTindakan('Proyek Konstruksi / Perbaikan');
    setWoUraian(proj.deskripsi || `Pekerjaan untuk Proyek: ${proj.namaProject}`);
    setWoTeknisi(proj.teknisi || []);
    setWoPrioritas('sedang');
    setShowCreateWOForm(true);
  };

  const handleCreateWOForProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;

    setWoSubmitting(true);
    try {
      const companyId = currentUser.companyId || 'default';
      const woId = await generateWONumber(companyId);
      const safeWoId = woId.replace(/\//g, '-');
      const today = new Date().toISOString().split('T')[0];

      const newWO = {
        id: safeWoId,
        nomorWO: woId,
        nomorWR: 'PROJECT-' + selectedProject.id,
        tanggalWO: today,
        area: woArea.trim(),
        namaMesin: woNamaMesin.trim(),
        jenisTindakan: woJenisTindakan.trim(),
        uraianPekerjaan: woUraian.trim(),
        tipePenugasan: 'teknisi',
        namaVendor: '',
        teknisiDitugaskan: woTeknisi,
        diajukanOleh: currentUser.name,
        status: 'pending',
        createdAt: new Date().toISOString(),
        prioritas: woPrioritas,
        companyId,
        cabangId: selectedProject.cabangId || currentUser.cabangId || 'pusat'
      };

      // Save to firestore under work_orders
      await setDoc(doc(db, 'work_orders', safeWoId), newWO);

      // Update project with linkedWOId
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        linkedWOId: woId
      });

      // Update local state
      setSelectedProject({
        ...selectedProject,
        linkedWOId: woId
      });

      alert(`Berhasil membuat Work Order ${woId} untuk teknisi pengerjaan proyek!`);
      setShowCreateWOForm(false);
      onRefresh();
    } catch (err) {
      console.error('Error creating WO for project:', err);
      alert('Gagal membuat Work Order.');
    } finally {
      setWoSubmitting(false);
    }
  };

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
      progres: initialProgress,
      status: status,
      tanggalMulai: new Date().toISOString().split('T')[0],
      tanggalSelesaiTarget: targetSelesai || undefined,
      laporanProgres: [],
      createdAt: new Date().toISOString(),
      companyId,
      cabangId,
      pic: pic || currentUser.name
    };

    try {
      await setDoc(doc(db, 'projects', projectId), newProject);
      setShowAddModal(false);
      // Reset form
      setNamaProject('');
      setDeskripsi('');
      setTargetSelesai('');
      setSelectedTeknisi([]);
      setStatus('perencanaan');
      setInitialProgress(0);
      setPic('');
      onRefresh();
    } catch (err) {
      console.error('Error creating project:', err);
      alert('Gagal membuat project baru.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = (projId: string) => {
    setDialogConfig({
      isOpen: true,
      title: 'Hapus Proyek',
      message: 'Apakah Anda yakin ingin menghapus proyek ini secara permanen? Seluruh riwayat laporan progres harian dan data terkait lainnya akan dihapus selamanya.',
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
          console.error('Error deleting project:', err);
          alert('Gagal menghapus project.');
        }
      },
      onCancel: () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleAddProgressReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !newReportText.trim()) return;

    const isPic = selectedProject.pic === currentUser.name || selectedProject.pic === currentUser.username;
    if (!isPic && !isAdmin) {
      alert('Hanya Penanggung Jawab (PIC) proyek atau Administrator yang dapat menambahkan laporan progres!');
      return;
    }

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
    const nextStatus = nextProgress >= 100 ? 'selesai' : selectedProject.status;

    try {
      await updateDoc(doc(db, 'projects', selectedProject.id), {
        laporanProgres: updatedReports,
        progres: nextProgress,
        status: nextStatus
      });

      // Update local state for expanded modal
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
      console.error('Error adding report:', err);
      alert('Gagal menambahkan laporan progres.');
    } finally {
      setAddingReport(false);
    }
  };

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.namaProject.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (p.deskripsi && p.deskripsi.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusBadge = (status: Project['status']) => {
    switch (status) {
      case 'perencanaan':
        return (
          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 uppercase w-max">
            <Clock className="w-3 h-3" /> Perencanaan
          </span>
        );
      case 'berjalan':
        return (
          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 uppercase w-max">
            <TrendingUp className="w-3 h-3 animate-pulse" /> Berjalan
          </span>
        );
      case 'selesai':
        return (
          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 uppercase w-max">
            <CheckCircle2 className="w-3 h-3" /> Selesai
          </span>
        );
      case 'tertunda':
        return (
          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-1 rounded-full font-bold flex items-center gap-1 uppercase w-max">
            <AlertTriangle className="w-3 h-3" /> Tertunda
          </span>
        );
      default:
        return null;
    }
  };

  const handleExportCSV = () => {
    const headers = ['Nama Project', 'Deskripsi', 'Progress (%)', 'Status', 'Tanggal Mulai', 'Target Selesai', 'Teknisi'];
    const keys = ['namaProject', 'deskripsi', 'progres', 'status', 'tanggalMulai', 'tanggalSelesaiTarget', 'teknisi'];
    
    const formatted = filteredProjects.map(p => ({
      ...p,
      teknisi: p.teknisi.join(', ')
    }));
    
    exportToExcelCSV(formatted, headers, keys, 'Laporan_Project_Management');
  };

  return (
    <div className="space-y-6" id="project-management-container">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm text-slate-900" id="project-header">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            Project Management & Konstruksi
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Pantau perancangan, pengerjaan proyek berskala besar, serta koordinasi teknisi ahli di lapangan.
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            id="btn-add-project"
          >
            <Plus className="w-4 h-4" />
            Project Baru
          </button>
        )}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" id="project-stats-grid">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Project</span>
          <span className="text-xl font-extrabold text-slate-800 font-sans block mt-1">{projects.length}</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Berjalan</span>
          <span className="text-xl font-extrabold text-amber-600 font-sans block mt-1">
            {projects.filter(p => p.status === 'berjalan').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Selesai</span>
          <span className="text-xl font-extrabold text-emerald-600 font-sans block mt-1">
            {projects.filter(p => p.status === 'selesai').length}
          </span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Perencanaan</span>
          <span className="text-xl font-extrabold text-blue-600 font-sans block mt-1">
            {projects.filter(p => p.status === 'perencanaan').length}
          </span>
        </div>
      </div>

      {/* Filters Area */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-col md:flex-row items-center gap-4 justify-between shadow-2xs" id="project-filters">
        <div className="relative flex-1 w-full max-w-md">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            type="text"
            placeholder="Cari project..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-end">
          {['all', 'perencanaan', 'berjalan', 'selesai', 'tertunda'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition uppercase cursor-pointer ${
                statusFilter === st 
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-bold' 
                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100 text-slate-600'
              }`}
            >
              {st === 'all' ? 'SEMUA' : st}
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

      {/* Project Grid */}
      {filteredProjects.length === 0 ? (
        <div className="bg-white text-center py-12 rounded-2xl border border-slate-200 text-slate-500 text-xs space-y-2">
          <Briefcase className="w-8 h-8 text-slate-300 mx-auto" />
          <p>Belum ada project yang terdaftar.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="project-grid-cards">
          {filteredProjects.map((p) => (
            <div 
              key={p.id} 
              className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition duration-200 p-5 flex flex-col justify-between shadow-2xs hover:shadow-sm"
            >
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-xs font-mono text-slate-400 font-bold tracking-wider">{p.id}</h3>
                    <h4 className="text-sm font-extrabold text-slate-800 mt-1">{p.namaProject}</h4>
                  </div>
                  {getStatusBadge(p.status)}
                </div>

                {p.deskripsi && (
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{p.deskripsi}</p>
                )}

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold text-slate-500">
                    <span>Progress Pengerjaan</span>
                    <span className="text-indigo-650">{p.progres}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-full rounded-full transition-all duration-350" 
                      style={{ width: `${p.progres}%` }}
                    ></div>
                  </div>
                </div>

                {/* Technicians & Date info */}
                <div className="flex flex-wrap items-center justify-between gap-3 text-[10px] text-slate-500 border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>Mulai: <strong>{p.tanggalMulai}</strong></span>
                    {p.tanggalSelesaiTarget && (
                      <span className="ml-1.5 text-slate-400">Target: <strong className="text-indigo-600">{p.tanggalSelesaiTarget}</strong></span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 bg-indigo-50/50 px-2 py-1 rounded-md border border-indigo-100/40">
                    <Users className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="font-semibold text-indigo-800">{p.teknisi.length} Teknisi Ahli</span>
                  </div>
                </div>

                {/* PIC & Linked WO info */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-500 bg-slate-50/75 p-2 rounded-lg border border-slate-100">
                  <div className="flex items-center gap-1">
                    <span className="font-bold text-slate-400">PIC:</span>
                    <span className="font-semibold text-slate-700">👤 {p.pic || 'Belum ditentukan'}</span>
                  </div>
                  {p.linkedWOId && (
                    <span className="bg-emerald-50 text-emerald-800 border border-emerald-150 px-2 py-0.5 rounded font-mono text-[9px] font-bold flex items-center gap-0.5">
                      <Wrench className="w-2.5 h-2.5" /> {p.linkedWOId}
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center">
                <button
                  onClick={() => setSelectedProject(p)}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-500 flex items-center gap-1 cursor-pointer"
                >
                  Lihat Timeline & Progres <ChevronRight className="w-4 h-4" />
                </button>

                {isAdmin && (
                  <button
                    onClick={() => handleDeleteProject(p.id)}
                    className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition border border-transparent hover:border-rose-150 cursor-pointer"
                    title="Hapus Project"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Project Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <h3 className="font-sans font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-indigo-600" />
                Tambah Project / Konstruksi Baru
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProject} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nama Project / Pekerjaan *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Overhaul Turbin Line 2 / Konstruksi Gudang Baru"
                  value={namaProject}
                  onChange={(e) => setNamaProject(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Deskripsi / Ruang Lingkup Proyek</label>
                <textarea
                  rows={2}
                  placeholder="Rincikan lingkup pengerjaan proyek konstruksi/perbaikan besar..."
                  value={deskripsi}
                  onChange={(e) => setDeskripsi(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Target Selesai</label>
                  <input
                    type="date"
                    value={targetSelesai}
                    onChange={(e) => setTargetSelesai(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Status Project</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="perencanaan">Perencanaan</option>
                    <option value="berjalan">Berjalan</option>
                    <option value="selesai">Selesai</option>
                    <option value="tertunda">Tertunda</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Penanggung Jawab / PIC Proyek *</label>
                <select
                  required
                  value={pic}
                  onChange={(e) => setPic(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                >
                  <option value="">-- Pilih PIC --</option>
                  {(allUsers && allUsers.length > 0 ? allUsers : technicians).map((u) => (
                    <option key={u.username} value={u.name}>
                      {u.name} ({u.role === 'teknisi' ? 'Teknisi' : u.role})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Progres Awal (%)</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={initialProgress}
                    onChange={(e) => setInitialProgress(Number(e.target.value))}
                    className="block w-32 px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                  <span className="text-xs text-slate-500 font-semibold">% Selesai</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  Pilih Teknisi Ahli Lapangan (Multi-select)
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-36 overflow-y-auto grid grid-cols-2 gap-2">
                  {technicians.map((tech) => {
                    const isChecked = selectedTeknisi.includes(tech.name);
                    return (
                      <label 
                        key={tech.username} 
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                          isChecked 
                            ? 'bg-indigo-50/70 border-indigo-300 font-semibold text-indigo-900' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleTeknisi(tech.name)}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{tech.name} <span className="text-[10px] text-slate-400 font-mono">({tech.subRole})</span></span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="border-t border-slate-150 pt-4 flex justify-end gap-2.5">
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
                  {submitting ? 'Membuat...' : 'Buat Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Detail & Progress Logs Modal */}
      {selectedProject && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full overflow-hidden shadow-2xl animate-scaleUp">
            
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <div>
                <span className="text-[10px] font-bold text-slate-400 tracking-widest block uppercase">Project Detail</span>
                <h3 className="font-sans font-bold text-slate-900 text-sm mt-0.5">{selectedProject.namaProject}</h3>
              </div>
              <button onClick={() => setSelectedProject(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
              {/* Top Meta info */}
              <div className="grid grid-cols-2 gap-4 bg-slate-50 border border-slate-150 p-4 rounded-xl text-xs">
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Detail Lingkup Kerja</span>
                    <p className="text-slate-700 font-medium mt-1 leading-relaxed">{selectedProject.deskripsi || 'Tidak ada rincian deskripsi.'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Penanggung Jawab / PIC</span>
                    <p className="text-slate-700 font-bold mt-1 text-xs">
                      👤 {selectedProject.pic || 'Belum ditentukan'}
                    </p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Teknisi Lapangan</span>
                    <p className="text-slate-700 font-semibold mt-1">
                      {selectedProject.teknisi.join(', ') || 'Belum ada teknisi ditugaskan.'}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Status & Progress</span>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusBadge(selectedProject.status)}
                      <span className="font-bold text-indigo-700 font-sans">{selectedProject.progres}%</span>
                    </div>
                  </div>
                  <div>
                    <span className="text-slate-400 font-bold uppercase tracking-wider block text-[9px]">Work Order Terkait</span>
                    {selectedProject.linkedWOId ? (
                      <div className="mt-1 flex items-center gap-1 bg-emerald-50 text-emerald-800 px-2 py-1 rounded border border-emerald-200 w-max font-bold font-mono">
                        <Wrench className="w-3 h-3 text-emerald-600" /> {selectedProject.linkedWOId}
                      </div>
                    ) : (
                      <div className="mt-1 text-slate-500 flex flex-col gap-1.5">
                        <span className="italic">Belum ada WO Teknisi</span>
                        <button
                          type="button"
                          onClick={() => handleOpenCreateWO(selectedProject)}
                          className="bg-indigo-650 hover:bg-indigo-600 text-white text-[10px] px-2.5 py-1 rounded font-bold transition flex items-center gap-1.5 cursor-pointer w-max shadow-sm"
                        >
                          <Plus className="w-3 h-3" /> Buat WO Teknisi
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Klik Selesai Action when Progres is 100% but status is not selesai */}
              {selectedProject.progres === 100 && selectedProject.status !== 'selesai' && (
                <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl flex items-center justify-between animate-fadeIn">
                  <div className="space-y-0.5">
                    <h5 className="text-xs font-bold text-emerald-805">Progres Proyek Telah Mencapai 100%</h5>
                    <p className="text-[10px] text-emerald-600 leading-normal">Selesaikan proyek secara resmi untuk memperbarui status di sistem.</p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateDoc(doc(db, 'projects', selectedProject.id), {
                          status: 'selesai',
                          progres: 100
                        });
                        setSelectedProject({
                          ...selectedProject,
                          status: 'selesai',
                          progres: 100
                        });
                        alert('Proyek berhasil diselesaikan secara resmi!');
                        onRefresh();
                      } catch (err) {
                        console.error('Error completing project:', err);
                        alert('Gagal menyelesaikan proyek.');
                      }
                    }}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold px-3.5 py-1.5 rounded-lg transition shadow-sm cursor-pointer shrink-0"
                  >
                    Klik Selesai
                  </button>
                </div>
              )}

              {/* Progress Timeline Section */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-widest border-b border-slate-150 pb-2">Timeline Laporan Progres & Milestone</h4>
                
                {/* Add Progress Report Inline Form */}
                {(() => {
                  const isPic = selectedProject.pic === currentUser.name || selectedProject.pic === currentUser.username;
                  const canAddReport = isPic || isAdmin;

                  if (!canAddReport) {
                    return (
                      <div className="bg-amber-50 border border-amber-150 p-4 rounded-xl text-xs text-amber-800 leading-relaxed flex items-start gap-2.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold">Akses Terbatas</p>
                          <p className="mt-0.5 text-[11px] text-amber-700">Hanya Penanggung Jawab (PIC) proyek: <strong className="text-amber-900">{selectedProject.pic || 'Belum ditentukan'}</strong> atau Administrator yang dapat mengirimkan laporan progres harian.</p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <form onSubmit={handleAddProgressReport} className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                      <span className="text-[10px] font-extrabold text-slate-700 uppercase tracking-wider block">Catat Perkembangan / Laporan Baru:</span>
                      
                      <div className="flex gap-3">
                        <textarea
                          required
                          rows={2}
                          placeholder="Jelaskan progres hari ini, hasil uji coba, kendala, atau pencapaian target..."
                          value={newReportText}
                          onChange={(e) => setNewReportText(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-slate-850 text-xs focus:outline-none focus:border-indigo-500 transition resize-none font-medium"
                        />
                      </div>

                      {attachedFile && (
                        <div className="p-2 bg-white rounded-lg border border-slate-200 flex items-center justify-between text-xs animate-fadeIn">
                          <div className="flex items-center gap-2 overflow-hidden">
                            {attachedFile.type === 'image' ? (
                              <img src={attachedFile.url} className="w-8 h-8 rounded object-cover shrink-0 border border-slate-100" referrerPolicy="no-referrer" />
                            ) : (
                              <File className="w-4 h-4 text-indigo-500 shrink-0" />
                            )}
                            <span className="truncate font-semibold text-slate-700 text-[11px]">{attachedFile.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAttachedFile(null)}
                            className="text-rose-600 hover:text-rose-700 text-[10px] font-bold uppercase tracking-wider px-2 py-1 hover:bg-rose-50 rounded transition cursor-pointer"
                          >
                            Hapus
                          </button>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-500 uppercase">Progres Baru:</span>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              placeholder={String(selectedProject.progres)}
                              value={newReportProgress !== null ? newReportProgress : ''}
                              onChange={(e) => setNewReportProgress(e.target.value ? Number(e.target.value) : null)}
                              className="w-16 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-bold text-center focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-[11px] text-slate-400 font-bold">% Selesai</span>
                          </div>

                          <label className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-250 text-slate-650 rounded-lg text-[11px] font-bold cursor-pointer transition select-none shadow-2xs">
                            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
                            <span>Upload Lampiran</span>
                            <input
                              type="file"
                              accept="image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                              onChange={handleProgressFileSelect}
                              className="hidden"
                            />
                          </label>
                        </div>

                        <button
                          type="submit"
                          disabled={addingReport || !newReportText.trim()}
                          className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-[11px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                        >
                          <Send className="w-3 h-3" />
                          <span>Kirim Laporan</span>
                        </button>
                      </div>
                    </form>
                  );
                })()}

                {/* Timeline list */}
                <div className="relative border-l border-slate-200 pl-4 ml-2.5 space-y-5 py-2">
                  {(!selectedProject.laporanProgres || selectedProject.laporanProgres.length === 0) ? (
                    <p className="text-xs text-slate-400 italic">Belum ada laporan progres yang dicatat.</p>
                  ) : (
                    selectedProject.laporanProgres.map((rep) => (
                      <div key={rep.id} className="relative">
                        {/* Timeline dot */}
                        <div className="absolute -left-[21px] mt-1 w-2.5 h-2.5 rounded-full bg-indigo-600 border-2 border-white ring-4 ring-indigo-50/80"></div>
                        
                        <div className="bg-slate-50/50 hover:bg-slate-50 transition p-3.5 rounded-lg border border-slate-150/60 text-xs space-y-2">
                          <div className="flex justify-between text-[10px] font-bold text-slate-400 border-b border-slate-100/60 pb-1">
                            <span className="font-mono">{rep.tanggal}</span>
                            <span className="text-slate-500">Dilaporkan oleh: <strong className="text-slate-600">{rep.namaPelapor}</strong></span>
                          </div>
                          <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                            {rep.laporan}
                          </p>

                          {rep.attachmentUrl && (
                            <div className="pt-2 border-t border-slate-150/60 flex flex-col gap-1.5">
                              <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Lampiran / Bukti Progres:</span>
                              {rep.attachmentUrl.startsWith('data:image/') ? (
                                <div className="mt-1">
                                  <img 
                                    src={rep.attachmentUrl} 
                                    alt={rep.attachmentName || "Foto Progres"} 
                                    className="max-h-48 max-w-full rounded-lg object-contain border border-slate-200 shadow-2xs hover:scale-[1.01] transition duration-200"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="text-[10px] text-slate-400 italic mt-1 block">{rep.attachmentName}</span>
                                </div>
                              ) : (
                                <a 
                                  href={rep.attachmentUrl} 
                                  download={rep.attachmentName || "lampiran"}
                                  className="flex items-center gap-1.5 text-xs text-indigo-700 hover:text-indigo-650 font-bold bg-indigo-50/70 p-2 rounded-lg border border-indigo-200/50 w-max cursor-pointer transition shadow-2xs mt-1"
                                >
                                  <File className="w-3.5 h-3.5 text-indigo-500" />
                                  <span>{rep.attachmentName || "Download Lampiran"}</span>
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-between items-center">
              <div>
                {isAdmin && (
                  <button
                    onClick={() => handleDeleteProject(selectedProject.id)}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-750 text-xs font-bold rounded-lg border border-rose-200 hover:border-rose-300 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Hapus Proyek
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

      {/* Create Work Order for Project Modal */}
      {showCreateWOForm && selectedProject && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full overflow-hidden shadow-2xl animate-scaleUp">
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <h3 className="font-sans font-bold text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Buat WO Teknisi Proyek
              </h3>
              <button onClick={() => setShowCreateWOForm(false)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateWOForProject} className="p-6 space-y-4">
              <div className="bg-indigo-50/50 p-3 rounded-lg border border-indigo-100/40 text-xs text-indigo-900">
                Membuat Work Order untuk penugasan teknisi pada proyek <strong>{selectedProject.namaProject}</strong>.
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Area / Lokasi Kerja *</label>
                <input
                  type="text"
                  required
                  value={woArea}
                  onChange={(e) => setWoArea(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Nama Alat / Mesin / Struktur *</label>
                <input
                  type="text"
                  required
                  value={woNamaMesin}
                  onChange={(e) => setWoNamaMesin(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Jenis Tindakan *</label>
                  <input
                    type="text"
                    required
                    value={woJenisTindakan}
                    onChange={(e) => setWoJenisTindakan(e.target.value)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Prioritas *</label>
                  <select
                    value={woPrioritas}
                    onChange={(e) => setWoPrioritas(e.target.value as any)}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="rendah">Rendah</option>
                    <option value="sedang">Sedang</option>
                    <option value="tinggi">Tinggi</option>
                    <option value="emergency">Emergency</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">Uraian Pekerjaan / Instruksi Detail *</label>
                <textarea
                  rows={3}
                  required
                  value={woUraian}
                  onChange={(e) => setWoUraian(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-indigo-500 focus:bg-white transition resize-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-slate-400" />
                  Teknisi yang Ditugaskan
                </label>
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 max-h-36 overflow-y-auto grid grid-cols-2 gap-2">
                  {technicians.map((tech) => {
                    const isChecked = woTeknisi.includes(tech.name);
                    return (
                      <label 
                        key={tech.username} 
                        className={`flex items-center gap-2 p-2 rounded-lg border text-xs cursor-pointer transition select-none ${
                          isChecked 
                            ? 'bg-indigo-50/70 border-indigo-300 font-semibold text-indigo-900' 
                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setWoTeknisi(woTeknisi.filter(t => t !== tech.name));
                            } else {
                              setWoTeknisi([...woTeknisi, tech.name]);
                            }
                          }}
                          className="rounded text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>{tech.name} <span className="text-[10px] text-slate-400 font-mono">({tech.subRole})</span></span>
                      </label>
                    );
                  })}
                </div>
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
                  {woSubmitting ? 'Membuat...' : 'Buat WO'}
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
