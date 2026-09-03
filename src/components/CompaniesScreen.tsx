import React, { useState } from 'react';
import { Company, UserProfile, CompanyBranch } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc, writeBatch, collection, getDocs, query, where } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import { 
  Building, 
  Plus, 
  Trash2, 
  Search, 
  CheckCircle, 
  XCircle, 
  KeyRound, 
  User, 
  X, 
  Calendar,
  AlertTriangle,
  AlertCircle,
  FileCheck,
  ShieldAlert,
  Loader2,
  Building2,
  ArrowLeftRight,
  Network,
  ChevronDown,
  ChevronRight
} from 'lucide-react';

interface CompaniesScreenProps {
  branches: CompanyBranch[];
  companies: Company[];
  currentUser: UserProfile;
  onRefresh: () => void;
}

export default function CompaniesScreen({ companies, branches, currentUser, onRefresh }: CompaniesScreenProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  // Form states
  const [companyId, setCompanyId] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [adminUsername, setAdminUsername] = useState('');
  const [adminName, setAdminName] = useState('');
  const [adminPin, setAdminPin] = useState('');

  // Convert Company to Branch states
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [companyToConvert, setCompanyToConvert] = useState<Company | null>(null);
  const [targetParentCompanyId, setTargetParentCompanyId] = useState('');
  const [convertType, setConvertType] = useState<'anak_perusahaan' | 'anak_cabang'>('anak_cabang');
  const [targetParentBranches, setTargetParentBranches] = useState<CompanyBranch[]>([]);
  const [targetParentBranchId, setTargetParentBranchId] = useState('');
  const [converting, setConverting] = useState(false);

  // Extract Branch to Company states
  const [showExtractModal, setShowExtractModal] = useState(false);
  const [branchToExtract, setBranchToExtract] = useState<CompanyBranch | null>(null);
  const [extractAdminUsername, setExtractAdminUsername] = useState('');
  const [extractAdminName, setExtractAdminName] = useState('');
  const [extractAdminPin, setExtractAdminPin] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});

  // Active Period States
  const [licenseActivePeriodEnabled, setLicenseActivePeriodEnabled] = useState(false);
  const [licenseExpiredAt, setLicenseExpiredAt] = useState('');
  const [showLicenseModal, setShowLicenseModal] = useState(false);
  const [selectedCompanyForLicense, setSelectedCompanyForLicense] = useState<Company | null>(null);
  const [editLicenseEnabled, setEditLicenseEnabled] = useState(false);
  const [editLicenseExpiredAt, setEditLicenseExpiredAt] = useState('');
  const [savingLicense, setSavingLicense] = useState(false);

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

  const handleCancelForm = () => {
    setShowAddForm(false);
    setCompanyId('');
    setCompanyName('');
    setAdminUsername('');
    setAdminName('');
    setAdminPin('');
    setLicenseActivePeriodEnabled(false);
    setLicenseExpiredAt('');
  };

  const handleAddCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const sanitizedId = companyId.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    const sanitizedAdminUser = adminUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!sanitizedId || !companyName.trim() || !sanitizedAdminUser || !adminName.trim() || adminPin.length < 4) {
      setDialogConfig({
        isOpen: true,
        title: 'Input Tidak Valid',
        message: 'Mohon lengkapi semua field. ID Perusahaan & Username Admin hanya boleh huruf kecil, angka, dan underscore (_). PIN harus minimal 4 angka.',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (licenseActivePeriodEnabled && !licenseExpiredAt) {
      setDialogConfig({
        isOpen: true,
        title: 'Tanggal Masa Aktif Kosong',
        message: 'Mohon tentukan tanggal kadaluarsa masa aktif akses.',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // Check if ID already exists
    if (companies.some(c => c.id === sanitizedId)) {
      setDialogConfig({
        isOpen: true,
        title: 'ID Perusahaan Sudah Ada',
        message: `ID Perusahaan "${sanitizedId}" sudah digunakan. Silakan gunakan ID lain.`,
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setSubmitting(true);

    try {
      // 1. Create Company Document
      const newCompany: Company = {
        id: sanitizedId,
        name: companyName.trim(),
        status: 'aktif',
        createdAt: new Date().toISOString(),
        adminUsername: sanitizedAdminUser,
        licenseActivePeriodEnabled,
        licenseExpiredAt: licenseActivePeriodEnabled ? licenseExpiredAt : ''
      };

      // 2. Create Default MTC Admin User for the Company
      const newAdmin: UserProfile = {
        username: sanitizedAdminUser,
        name: adminName.trim(),
        pin: adminPin,
        role: 'admin',
        subRole: 'Admin MTC ' + companyName.trim(),
        division: 'MTC',
        active: true,
        companyId: sanitizedId,
        createdAt: new Date().toISOString(),
        // All admin permissions enabled
        canCreateWR: true,
        canCreateWO: true,
        canDeleteWR: true,
        canDeleteWO: true,
        canApprove: true,
        canReject: true,
        canAssignTeknisi: true,
        canShowTabWR: true,
        canShowTabWO: true,
        canShowTabPP: true,
        canShowTabProjects: true,
        canShowTabPM: true
      };

      // Batch Write
      const batch = writeBatch(db);
      batch.set(doc(db, 'companies', sanitizedId), newCompany);
      batch.set(doc(db, 'users', sanitizedAdminUser), newAdmin);
      await batch.commit();

      handleCancelForm();
      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Sistem MTC Baru Berhasil Dibuat',
        message: `Perusahaan "${companyName.trim()}" telah terdaftar dengan ID "${sanitizedId}". Administrator default "${sanitizedAdminUser}" telah diaktifkan dengan PIN: "${adminPin}".`,
        confirmLabel: 'Selesai',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err: any) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Membuat Sistem MTC',
        message: 'Terjadi kesalahan saat menyimpan data ke database: ' + (err.message || String(err)),
        confirmLabel: 'Ulangi',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLicense = async (company: Company) => {
    const newStatus = company.status === 'aktif' ? 'nonaktif' : 'aktif';
    const actionText = newStatus === 'aktif' ? 'MEMBERI IZIN akses aplikasi untuk' : 'MEMUTUS IZIN akses aplikasi untuk';
    
    setDialogConfig({
      isOpen: true,
      title: `${newStatus === 'aktif' ? 'Beri' : 'Putus'} Izin Perusahaan`,
      message: `Apakah Anda yakin ingin ${actionText} perusahaan "${company.name}"? Jika diputus, seluruh pengguna perusahaan ini tidak akan bisa masuk ke sistem.`,
      confirmLabel: 'Ya, Lanjutkan',
      cancelLabel: 'Batal',
      variant: newStatus === 'aktif' ? 'info' : 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        setLoadingActionId(company.id);
        try {
          await updateDoc(doc(db, 'companies', company.id), {
            status: newStatus
          });
          onRefresh();
        } catch (err: any) {
          console.error(err);
          alert('Gagal memperbarui status izin perusahaan.');
        } finally {
          setLoadingActionId(null);
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleDeleteCompany = async (company: Company) => {
    if (company.id === 'default') {
      setDialogConfig({
        isOpen: true,
        title: 'Aksi Ditolak',
        message: 'Perusahaan default (PT. MTC-Control Utama) adalah sistem utama dan tidak dapat dihapus.',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      title: 'HAPUS PERUSAHAAN PERMANEN',
      message: `PERINGATAN KRITIS: Anda akan menghapus perusahaan "${company.name}" secara permanen! Ini akan menghapus semua pengguna, work requests, work orders, dan data transaksi milik perusahaan ini di database. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus Semua Data',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        setLoadingActionId(company.id);
        try {
          // Perform total database purge of this tenant's data
          const batch = writeBatch(db);
          
          // Delete company doc
          batch.delete(doc(db, 'companies', company.id));

          // Get and delete users in this company
          const usersQuery = query(collection(db, 'users'), where('companyId', '==', company.id));
          const usersSnap = await getDocs(usersQuery);
          usersSnap.forEach(d => {
            batch.delete(doc(db, 'users', d.id));
          });

          // Get and delete WRs in this company
          const wrQuery = query(collection(db, 'work_requests'), where('companyId', '==', company.id));
          const wrSnap = await getDocs(wrQuery);
          wrSnap.forEach(d => {
            batch.delete(doc(db, 'work_requests', d.id));
          });

          // Get and delete WOs in this company
          const woQuery = query(collection(db, 'work_orders'), where('companyId', '==', company.id));
          const woSnap = await getDocs(woQuery);
          woSnap.forEach(d => {
            batch.delete(doc(db, 'work_orders', d.id));
          });

          // Get and delete goods requests in this company
          const ppQuery = query(collection(db, 'goods_requests'), where('companyId', '==', company.id));
          const ppSnap = await getDocs(ppQuery);
          ppSnap.forEach(d => {
            batch.delete(doc(db, 'goods_requests', d.id));
          });

          // Commit purge batch
          await batch.commit();
          onRefresh();

          setDialogConfig({
            isOpen: true,
            title: 'Perusahaan Berhasil Dihapus',
            message: `Seluruh data untuk "${company.name}" telah dihapus dengan sukses dari Firestore database.`,
            confirmLabel: 'Bagus',
            alertOnly: true,
            variant: 'info',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err: any) {
          console.error(err);
          alert('Gagal menghapus perusahaan dan data terkait: ' + err.message);
        } finally {
          setLoadingActionId(null);
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const handleUpdateLicensePeriod = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCompanyForLicense) return;

    if (editLicenseEnabled && !editLicenseExpiredAt) {
      alert('Mohon tentukan tanggal kadaluarsa masa aktif.');
      return;
    }

    setSavingLicense(true);
    try {
      await updateDoc(doc(db, 'companies', selectedCompanyForLicense.id), {
        licenseActivePeriodEnabled: editLicenseEnabled,
        licenseExpiredAt: editLicenseEnabled ? editLicenseExpiredAt : ''
      });

      setShowLicenseModal(false);
      setSelectedCompanyForLicense(null);
      setEditLicenseEnabled(false);
      setEditLicenseExpiredAt('');
      
      onRefresh();
      
      setDialogConfig({
        isOpen: true,
        title: 'Masa Aktif Berhasil Diperbarui',
        message: `Masa aktif untuk perusahaan "${selectedCompanyForLicense.name}" berhasil diperbarui.`,
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err: any) {
      console.error(err);
      alert('Gagal memperbarui masa aktif perusahaan: ' + (err.message || String(err)));
    } finally {
      setSavingLicense(false);
    }
  };

  const handleParentCompanyChange = async (parentCompanyId: string) => {
    setTargetParentCompanyId(parentCompanyId);
    setTargetParentBranchId('');
    if (!parentCompanyId) {
      setTargetParentBranches([]);
      return;
    }
    try {
      const branchesSnap = await getDocs(
        query(collection(db, 'branches'), where('companyId', '==', parentCompanyId))
      );
      const branchesList: CompanyBranch[] = [];
      branchesSnap.forEach(d => {
        branchesList.push(d.data() as CompanyBranch);
      });
      setTargetParentBranches(branchesList);
    } catch (err) {
      console.error("Error fetching branches of target parent company:", err);
    }
  };

  const handleExtractBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchToExtract) return;

    const sanitizedAdminUser = extractAdminUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');

    if (!sanitizedAdminUser || !extractAdminName.trim() || extractAdminPin.length < 4) {
      setDialogConfig({
        isOpen: true,
        title: 'Input Tidak Valid',
        message: 'Mohon lengkapi data Admin. Username hanya boleh huruf kecil, angka, dan underscore (_). PIN harus minimal 4 angka.',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    // Check if new admin username already exists
    const usersQuery = query(collection(db, 'users'), where('username', '==', sanitizedAdminUser));
    const usersSnap = await getDocs(usersQuery);
    if (!usersSnap.empty) {
      setDialogConfig({
        isOpen: true,
        title: 'Username Sudah Ada',
        message: `Username "${sanitizedAdminUser}" sudah digunakan. Silakan gunakan username lain.`,
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setExtracting(true);

    try {
      const batch = writeBatch(db);
      const newCompanyId = branchToExtract.id; // use the same branch ID as new company ID

      // 1. Create the new Company
      const newCompany: Company = {
        id: newCompanyId,
        name: branchToExtract.name,
        status: 'aktif',
        createdAt: new Date().toISOString(),
        adminUsername: sanitizedAdminUser
      };
      batch.set(doc(db, 'companies', newCompanyId), newCompany);

      // 2. Create the Default Admin for the new company
      const adminUser: UserProfile = {
        username: sanitizedAdminUser,
        name: extractAdminName.trim(),
        pin: extractAdminPin,
        role: 'admin',
        subRole: 'Admin Perusahaan',
        division: 'Management',
        active: true,
        createdAt: new Date().toISOString(),
        companyId: newCompanyId,
        cabangId: 'pusat'
      };
      batch.set(doc(db, 'users', sanitizedAdminUser), adminUser);

      // Helper function to query and update collections
      const migrateCollection = async (collName: string) => {
        const q = query(collection(db, collName), where('companyId', '==', branchToExtract.companyId), where('cabangId', '==', branchToExtract.id));
        const snap = await getDocs(q);
        snap.forEach(d => {
          batch.update(doc(db, collName, d.id), {
            companyId: newCompanyId,
            cabangId: 'pusat'
          });
        });
      };

      // 3-10. Migrate all data
      await migrateCollection('users');
      await migrateCollection('work_requests');
      await migrateCollection('work_orders');
      await migrateCollection('goods_requests');
      await migrateCollection('projects');
      await migrateCollection('preventive_maintenance');
      await migrateCollection('assets');
      await migrateCollection('inventory');

      // 11. Delete the Branch Document
      batch.delete(doc(db, 'branches', branchToExtract.id));

      await batch.commit();

      setShowExtractModal(false);
      setBranchToExtract(null);
      setExtractAdminUsername('');
      setExtractAdminName('');
      setExtractAdminPin('');

      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Berhasil Diekstrak',
        message: `Cabang/Anak Perusahaan "${branchToExtract.name}" telah berhasil diekstrak menjadi perusahaan mandiri. Semua data terkait telah dipindahkan.`,
        confirmLabel: 'Selesai',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err: any) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Ekstrak Gagal',
        message: err.message || 'Terjadi kesalahan saat memproses migrasi struktur.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setExtracting(false);
    }
  };

  const toggleCompanyExpansion = (companyId: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  const handleConvertCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyToConvert || !targetParentCompanyId) return;

    setConverting(true);

    try {
      // 1. Create a CompanyBranch object
      const branchId = companyToConvert.id; // Keep the same ID for easy matching / transition
      const newBranch: CompanyBranch = {
        id: branchId,
        companyId: targetParentCompanyId,
        name: companyToConvert.name,
        address: '', // empty initially, can be updated by new company's admin
        createdAt: companyToConvert.createdAt || new Date().toISOString(),
        parentId: targetParentBranchId || '',
        type: convertType
      };

      const batch = writeBatch(db);

      // Save branch
      batch.set(doc(db, 'branches', branchId), newBranch);

      // Delete company from companies collection
      batch.delete(doc(db, 'companies', companyToConvert.id));

      // 2. Fetch all users from companyToConvert
      const usersQuery = query(collection(db, 'users'), where('companyId', '==', companyToConvert.id));
      const usersSnap = await getDocs(usersQuery);
      usersSnap.forEach(d => {
        // Change companyId to parent company's ID, and set cabangId to companyToConvert.id (now a branch)
        batch.update(doc(db, 'users', d.id), {
          companyId: targetParentCompanyId,
          cabangId: branchId
        });
      });

      // 3. Fetch all work_requests from companyToConvert
      const wrQuery = query(collection(db, 'work_requests'), where('companyId', '==', companyToConvert.id));
      const wrSnap = await getDocs(wrQuery);
      wrSnap.forEach(d => {
        batch.update(doc(db, 'work_requests', d.id), {
          companyId: targetParentCompanyId,
          cabangId: branchId
        });
      });

      // 4. Fetch all work_orders from companyToConvert
      const woQuery = query(collection(db, 'work_orders'), where('companyId', '==', companyToConvert.id));
      const woSnap = await getDocs(woQuery);
      woSnap.forEach(d => {
        batch.update(doc(db, 'work_orders', d.id), {
          companyId: targetParentCompanyId,
          cabangId: branchId
        });
      });

      // 5. Fetch all goods_requests from companyToConvert
      const ppQuery = query(collection(db, 'goods_requests'), where('companyId', '==', companyToConvert.id));
      const ppSnap = await getDocs(ppQuery);
      ppSnap.forEach(d => {
        batch.update(doc(db, 'goods_requests', d.id), {
          companyId: targetParentCompanyId,
          cabangId: branchId
        });
      });

      // Commit the entire batch!
      await batch.commit();

      // Reset modal state
      setShowConvertModal(false);
      setCompanyToConvert(null);
      setTargetParentCompanyId('');
      setTargetParentBranchId('');
      setTargetParentBranches([]);
      setConvertType('anak_cabang');

      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Konversi Berhasil',
        message: `Perusahaan "${companyToConvert.name}" berhasil dikonversi menjadi ${convertType === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Anak Cabang'} di bawah perusahaan utama yang dipilih. Semua user dan transaksi telah dimigrasi dengan sukses.`,
        confirmLabel: 'Selesai',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err: any) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Konversi Gagal',
        message: 'Terjadi kesalahan saat memproses migrasi: ' + (err.message || String(err)),
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setConverting(false);
    }
  };

  const filteredCompanies = companies.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6" id="companies-screen-root">
      
      {/* Header Panel */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs" id="companies-header-panel">
        <div>
          <h2 className="text-xl font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <Building className="w-5.5 h-5.5 text-indigo-600" />
            Kelola Multi-Perusahaan
          </h2>
          <p className="text-xs text-slate-500 mt-1">Super Administrator Dashboard untuk setup, izin, dan hapus sistem MTC klien.</p>
        </div>
        <button
          onClick={() => setShowAddForm(true)}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-xl transition flex items-center gap-2 shadow-xs cursor-pointer"
          id="btn-add-company-show"
        >
          <Plus className="w-4 h-4" />
          Setup Perusahaan Baru
        </button>
      </div>

      {/* Add Company Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="modal-add-company-container">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" id="modal-add-company-box">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-indigo-600" />
                  Inisiasi Sistem MTC Perusahaan Baru
                </h3>
                <p className="text-[10px] text-slate-450 mt-0.5">Sistem akan mengalokasikan database workspace & admin default terisolasi.</p>
              </div>
              <button 
                onClick={handleCancelForm}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" onSubmit={handleAddCompany} className="p-6 space-y-6 flex-1 overflow-y-auto" id="form-add-company">
              
              {/* Section 1: Data Perusahaan */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">1. Informasi Klien / Perusahaan</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nama Perusahaan / Klien *</label>
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="text" 
                      required
                      placeholder="Contoh: PT. Adhi Karya"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">ID / Kode Sistem MTC (Unik) *</label>
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="text" 
                      required
                      placeholder="Contoh: pt_adhi (hanya huruf kecil, angka, _)"
                      value={companyId}
                      onChange={(e) => setCompanyId(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Section 2: Admin Default */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">2. Administrator Utama Perusahaan (Default Admin)</h4>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Nama Lengkap Admin *</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-slate-400" />
                      </div>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                        type="text" 
                        required
                        placeholder="Nama Admin (misal: Bambang Hartono)"
                        value={adminName}
                        onChange={(e) => setAdminName(e.target.value)}
                        className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">Username Login Admin *</label>
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="text" 
                      required
                      placeholder="misal: admin_adhi"
                      value={adminUsername}
                      onChange={(e) => setAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                      className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white font-mono"
                    />
                  </div>
                </div>

                <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 flex items-start gap-3">
                  <KeyRound className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <label className="block text-[10px] font-bold text-indigo-800 uppercase tracking-wider">PIN Keamanan Administrator (Min 4 Angka) *</label>
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="text" 
                      required
                      maxLength={8}
                      placeholder="Contoh PIN: 9988"
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
                      className="block w-36 px-3 py-1.5 border border-indigo-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white tracking-widest font-mono font-bold"
                    />
                    <p className="text-[9px] text-indigo-600">Admin default ini langsung aktif dan dapat mendaftarkan karyawan divisi atau teknisi MTC perusahaan mereka sendiri.</p>
                  </div>
                </div>
              </div>

              {/* Section 3: Masa Aktif Akses */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">3. Masa Aktif Akses Aplikasi</h4>
                
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[11px] font-bold text-slate-700">Batasi Masa Aktif Akses</span>
                      <span className="text-[9px] text-slate-500">Jika diaktifkan, akses perusahaan akan berakhir pada tanggal yang ditentukan.</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                        type="checkbox" 
                        className="sr-only peer"
                        checked={licenseActivePeriodEnabled}
                        onChange={(e) => setLicenseActivePeriodEnabled(e.target.checked)}
                      />
                      <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>
                  </div>

                  {licenseActivePeriodEnabled && (
                    <div className="pt-2 border-t border-slate-200/60">
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" /> Tanggal Kadaluarsa Akses *
                      </label>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                        type="date"
                        required={licenseActivePeriodEnabled}
                        value={licenseExpiredAt}
                        onChange={(e) => setLicenseExpiredAt(e.target.value)}
                        className="block px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -my-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={handleCancelForm}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Inisiasi Sistem...
                    </>
                  ) : (
                    'Inisiasi & Setup MTC'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Main Filter & List Container */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs" id="companies-table-container">
        
        {/* Search Bar Bar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex items-center gap-3">
          <div className="relative flex-1 max-w-md">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-slate-400" />
            </div>
            <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
              type="text"
              placeholder="Cari perusahaan atau ID kode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:bg-white"
            />
          </div>
          <span className="text-[10px] text-slate-400 font-mono">Total Terdaftar: {companies.length} Perusahaan</span>
        </div>

        {/* Desktop Table View */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" id="companies-list-table">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-550/20 text-slate-400 text-[10px] uppercase font-bold tracking-wider">
                <th className="py-3 px-5">ID Klien</th>
                <th className="py-3 px-5">Nama Perusahaan / Klien</th>
                <th className="py-3 px-5">Tgl Setup</th>
                <th className="py-3 px-5">Default Admin</th>
                <th className="py-3 px-5">Masa Aktif</th>
                <th className="py-3 px-5">Status Izin</th>
                <th className="py-3 px-5 text-right">Aksi Manajemen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCompanies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <Building className="w-8 h-8 mx-auto text-slate-200 mb-2" />
                    Belum ada perusahaan klien yang didaftarkan.
                  </td>
                </tr>
              ) : (
                filteredCompanies.map((comp) => {
                  const isDefault = comp.id === 'default';
                  const isActionLoading = loadingActionId === comp.id;
                  const companyBranches = branches.filter(b => b.companyId === comp.id);

                  return (
                    <React.Fragment key={comp.id}>
                    <tr 
                      className={`hover:bg-slate-50/40 transition ${companyBranches.length > 0 ? 'cursor-pointer' : ''}`}
                      onClick={() => { if (companyBranches.length > 0) toggleCompanyExpansion(comp.id) }}
                    >
                      <td className="py-3.5 px-5 font-mono font-bold text-indigo-600">
                        <div className="flex items-center gap-1.5">
                          {companyBranches.length > 0 ? (
                            expandedCompanies[comp.id] ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />
                          ) : (
                            <span className="w-4 h-4 inline-block"></span>
                          )}
                          {comp.id}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="font-bold text-slate-800">{comp.name}</div>
                        {isDefault && <span className="text-[8px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-mono font-bold mt-0.5 inline-block">SISTEM DEFAULT</span>}
                      </td>
                      <td className="py-3.5 px-5 text-slate-500 font-mono">
                        {comp.createdAt ? comp.createdAt.split('T')[0] : '-'}
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex items-center gap-1">
                          <span className="font-mono bg-slate-150/40 text-slate-600 px-1.5 py-0.5 rounded text-[10px] border border-slate-100">
                            {comp.adminUsername}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        <div className="flex flex-col gap-1">
                          {isDefault ? (
                            <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 w-max font-medium">
                              Tidak Terbatas (Developer)
                            </span>
                          ) : comp.licenseActivePeriodEnabled && comp.licenseExpiredAt ? (
                            <>
                              <span className="font-mono bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 w-max">
                                <Calendar className="w-3 h-3 text-indigo-500" /> {comp.licenseExpiredAt}
                              </span>
                              {(() => {
                                const d = new Date();
                                const year = d.getFullYear();
                                const month = String(d.getMonth() + 1).padStart(2, '0');
                                const day = String(d.getDate()).padStart(2, '0');
                                const todayStr = `${year}-${month}-${day}`;
                                
                                if (todayStr > comp.licenseExpiredAt) {
                                  return (
                                    <span className="text-[9px] text-rose-600 font-bold flex items-center gap-0.5 animate-pulse">
                                      <AlertTriangle className="w-2.5 h-2.5" /> Habis Masa Aktif
                                    </span>
                                  );
                                } else {
                                  const todayTime = new Date(todayStr).getTime();
                                  const expiryTime = new Date(comp.licenseExpiredAt).getTime();
                                  const daysDiff = Math.ceil((expiryTime - todayTime) / (1000 * 3600 * 24));
                                  if (daysDiff <= 14) {
                                    return (
                                      <span className="text-[9px] text-amber-600 font-bold flex items-center gap-0.5">
                                        <AlertTriangle className="w-2.5 h-2.5" /> Berakhir dlm {daysDiff} hari
                                      </span>
                                    );
                                  }
                                }
                                return null;
                              })()}
                            </>
                          ) : (
                            <span className="bg-slate-50 text-slate-500 border border-slate-200 px-2 py-0.5 rounded text-[10px] inline-flex items-center gap-1 w-max font-medium">
                              Tidak Terbatas
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-5">
                        {isDefault ? (
                          <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-indigo-500" /> Aktif Selamanya
                          </span>
                        ) : comp.status === 'aktif' ? (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1">
                            <CheckCircle className="w-3 h-3 text-emerald-500" /> Aktif (Diizinkan)
                          </span>
                        ) : (
                          <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider inline-flex items-center gap-1 animate-pulse">
                            <XCircle className="w-3 h-3 text-rose-500" /> Terputus (Dicabut)
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <div className="flex justify-end gap-1.5">
                          
                          {/* Toggle Access Permission */}
                          {!isDefault && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleToggleLicense(comp); }}
                              disabled={isActionLoading}
                              className={`px-2.5 py-1.5 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 border ${
                                comp.status === 'aktif'
                                  ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                  : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-indigo-200'
                              }`}
                              title={comp.status === 'aktif' ? "Putus Izin" : "Beri Izin"}
                            >
                              {isActionLoading ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : comp.status === 'aktif' ? (
                                'Putus Akses'
                              ) : (
                                'Beri Akses'
                              )}
                            </button>
                          )}
 
                          {/* Adjust Access Period */}
                          {!isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCompanyForLicense(comp);
                                setEditLicenseEnabled(comp.licenseActivePeriodEnabled || false);
                                setEditLicenseExpiredAt(comp.licenseExpiredAt || '');
                                setShowLicenseModal(true);
                              }}
                              className="px-2.5 py-1.5 bg-white hover:bg-slate-50 border border-slate-250 text-slate-700 rounded-lg font-bold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Sesuaikan Tanggal Masa Aktif Akses"
                            >
                              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                              <span>Masa Aktif</span>
                            </button>
                          )}

                          {/* Delete Company */}
                          {currentUser.username === 'admin' && !isDefault && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setCompanyToConvert(comp);
                                setTargetParentCompanyId('');
                                setTargetParentBranchId('');
                                setTargetParentBranches([]);
                                setConvertType('anak_cabang');
                                setShowConvertModal(true);
                              }}
                              disabled={isActionLoading}
                              className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 border border-indigo-750 text-white rounded-lg font-semibold text-[10px] transition cursor-pointer flex items-center gap-1 shadow-xs"
                              title="Ubah Menjadi Cabang / Anak Perusahaan"
                            >
                              <ArrowLeftRight className="w-3 h-3" />
                              <span>Konversi Struktur</span>
                            </button>
                          )}

                          {!isDefault && (
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteCompany(comp); }}
                              disabled={isActionLoading}
                              className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer shadow-xs"
                              title="Hapus Perusahaan"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}

                        </div>
                      </td>
                    </tr>
                      {expandedCompanies[comp.id] && companyBranches.map(branch => (
                        <tr key={branch.id} className="bg-slate-50/50 border-t border-slate-100/50">
                          <td colSpan={2} className="py-2.5 px-5 pl-12 text-slate-600">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-300">└─</span>
                              <span className="font-bold">{branch.name}</span>
                              <span className="text-[9px] bg-slate-200/60 text-slate-500 px-1.5 py-0.5 rounded font-mono font-bold tracking-wider">
                                {branch.type === 'anak_perusahaan' ? 'ANAK PERUSAHAAN' : 'CABANG'}
                              </span>
                            </div>
                          </td>
                          <td colSpan={3} className="py-2.5 px-5 text-slate-500 font-mono text-[10px]">
                            ID: {branch.id}
                          </td>
                          <td className="py-2.5 px-5 text-right">
                             <button 
                                onClick={() => {
                                  setBranchToExtract(branch);
                                  setShowExtractModal(true);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg font-bold text-[10px] transition cursor-pointer inline-flex items-center gap-1"
                             >
                                <ArrowLeftRight className="w-3 h-3" />
                                Ekstrak ke Perusahaan Baru
                             </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Convert Company to Branch/Sub-company Modal */}
      {showConvertModal && companyToConvert && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="modal-convert-company-container">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" id="modal-convert-company-box">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Network className="w-4 h-4 text-indigo-600" />
                  Konversi Perusahaan ke Struktur Anak
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Ubah status badan usaha menjadi divisi/cabang di bawah naungan perusahaan induk.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowConvertModal(false);
                  setCompanyToConvert(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" onSubmit={handleConvertCompany} className="p-6 space-y-5 flex-1 overflow-y-auto" id="form-convert-company">
              
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 text-xs text-amber-800">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-bold">PERINGATAN MIGRASI STRUKTUR</strong>
                  <p>
                    Anda akan mengubah <strong>{companyToConvert.name}</strong> ({companyToConvert.id}) menjadi bagian/struktur anak perusahaan lain.
                  </p>
                  <p className="mt-1 font-medium">
                    Seluruh pengguna terdaftar (termasuk admin perusahaan ini), data Work Request (WR), Work Order (WO), dan permintaan barang akan dipindahkan secara otomatis ke dalam lingkup perusahaan induk yang Anda pilih.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    1. Pilih Perusahaan Induk (Parent Company) *
                  </label>
                  <select
                    required
                    value={targetParentCompanyId}
                    onChange={(e) => handleParentCompanyChange(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                  >
                    <option value="">-- Pilih Perusahaan Induk --</option>
                    {companies
                      .filter(c => c.id !== companyToConvert.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.id})
                        </option>
                      ))}
                  </select>
                </div>

                {targetParentCompanyId && (
                  <>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        2. Pilih Tipe Entitas Baru *
                      </label>
                      <select
                        required
                        value={convertType}
                        onChange={(e) => setConvertType(e.target.value as 'anak_perusahaan' | 'anak_cabang')}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                      >
                        <option value="anak_cabang">Anak Cabang (Branch)</option>
                        <option value="anak_perusahaan">Anak Perusahaan (Sub-Company)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                        3. Pilih Induk Cabang (Opsional - Berjenjang)
                      </label>
                      <select
                        value={targetParentBranchId}
                        onChange={(e) => setTargetParentBranchId(e.target.value)}
                        className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                      >
                        <option value="">Kantor Pusat (HO) - Utama</option>
                        {targetParentBranches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name} ({b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Anak Cabang'})
                          </option>
                        ))}
                      </select>
                      <p className="text-[9px] text-slate-400 mt-1">
                        Pilih induk entitas jika Anda ingin memosisikan cabang ini di bawah cabang lain yang sudah ada di perusahaan induk tersebut.
                      </p>
                    </div>
                  </>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -my-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowConvertModal(false);
                    setCompanyToConvert(null);
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-lg hover:bg-slate-100 text-slate-700 text-xs font-bold transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={converting || !targetParentCompanyId}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-350 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {converting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Memproses Migrasi...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Proses Konversi Struktur
                    </>
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Extract Branch to Company Modal */}
      {showExtractModal && branchToExtract && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="modal-extract-branch-container">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden" id="modal-extract-branch-box">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Building className="w-4 h-4 text-indigo-600" />
                  Ekstrak Menjadi Perusahaan Baru
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Cabang akan dilepas dari induknya menjadi perusahaan mandiri.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowExtractModal(false);
                  setBranchToExtract(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" onSubmit={handleExtractBranch} className="p-6 space-y-5 flex-1 overflow-y-auto" id="form-extract-branch">
              
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex gap-3 text-xs text-indigo-800">
                <ShieldAlert className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <strong className="block font-bold">INFO MIGRASI STRUKTUR</strong>
                  <p>
                    Anda akan mengubah <strong>{branchToExtract.name}</strong> menjadi Perusahaan Mandiri.
                  </p>
                  <p className="mt-1 font-medium">
                    Seluruh pengguna dan data transaksi pada cabang ini akan dimigrasi otomatis ke perusahaan baru yang akan dibuat.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 pb-1">Set Administrator Utama Perusahaan Baru</h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                    Nama Lengkap Admin *
                  </label>
                  <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                    type="text"
                    required
                    placeholder="Contoh: Budi Susanto"
                    value={extractAdminName}
                    onChange={(e) => setExtractAdminName(e.target.value)}
                    className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      Username *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                        type="text" 
                        required
                        placeholder="hurufkecil_angka"
                        value={extractAdminUsername}
                        onChange={(e) => setExtractAdminUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                        className="block w-full pl-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wider mb-1.5">
                      PIN Akses (Min. 4) *
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                      </div>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                        type="password" 
                        required
                        minLength={4}
                        placeholder="••••"
                        value={extractAdminPin}
                        onChange={(e) => setExtractAdminPin(e.target.value.replace(/\D/g, ''))}
                        className="block w-full pl-9 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:outline-none focus:border-indigo-500 focus:bg-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -my-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowExtractModal(false);
                    setBranchToExtract(null);
                  }}
                  className="px-4 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={extracting || extractAdminUsername.length < 3 || extractAdminPin.length < 4 || extractAdminName.trim() === ''}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-350 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {extracting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Sedang Memproses...
                    </>
                  ) : (
                    <>
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      Proses Ekstrak
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Masa Aktif Akses Modal */}
      {showLicenseModal && selectedCompanyForLicense && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs" id="modal-edit-license-container">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden animate-fade-in" id="modal-edit-license-box">
            
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div>
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-indigo-600" />
                  Sesuaikan Masa Aktif Akses
                </h3>
                <p className="text-[10px] text-slate-500 mt-0.5">
                  Atur batasan masa aktif untuk perusahaan <strong>{selectedCompanyForLicense.name}</strong>.
                </p>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setShowLicenseModal(false);
                  setSelectedCompanyForLicense(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-700 bg-white border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" onSubmit={handleUpdateLicensePeriod} className="p-6 space-y-5 flex-1 overflow-y-auto" id="form-edit-license">
              
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="block text-xs font-bold text-slate-750">Batasi Masa Aktif Akses</span>
                    <span className="text-[10px] text-slate-450 block leading-tight mt-0.5">
                      Jika dinonaktifkan, perusahaan akan memiliki akses tidak terbatas.
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editLicenseEnabled}
                      onChange={(e) => setEditLicenseEnabled(e.target.checked)}
                    />
                    <div className="w-9 h-5 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {editLicenseEnabled && (
                  <div className="pt-3 border-t border-slate-200/60 space-y-1.5">
                    <label className="block text-[10px] font-bold text-slate-650 uppercase tracking-wider flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Tanggal Kadaluarsa Akses *
                    </label>
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                      type="date"
                      required={editLicenseEnabled}
                      value={editLicenseExpiredAt}
                      onChange={(e) => setEditLicenseExpiredAt(e.target.value)}
                      className="block w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Informative block */}
              {editLicenseEnabled && editLicenseExpiredAt && (
                <div className="p-4 bg-indigo-50/60 border border-indigo-100 rounded-xl flex gap-2.5 text-[11px] text-indigo-700">
                  <AlertCircle className="w-4 h-4 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold">Notifikasi Otomatis</p>
                    <p className="leading-relaxed">
                      Sistem akan otomatis memunculkan peringatan bagi semua administrator perusahaan <strong>2 minggu (14 hari)</strong> sebelum tanggal <strong>{editLicenseExpiredAt}</strong> terlewati.
                    </p>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 bg-slate-50 -mx-6 -my-6 p-4 rounded-b-2xl">
                <button
                  type="button"
                  onClick={() => {
                    setShowLicenseModal(false);
                    setSelectedCompanyForLicense(null);
                  }}
                  className="px-4 py-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 text-xs font-bold rounded-lg transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingLicense}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-350 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {savingLicense ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> Menyimpan...
                    </>
                  ) : (
                    'Simpan Penyesuaian'
                  )}
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
        confirmLabel={dialogConfig.confirmLabel || 'OK'}
        cancelLabel={dialogConfig.cancelLabel}
        variant={dialogConfig.variant || 'info'}
        alertOnly={dialogConfig.alertOnly}
        onConfirm={dialogConfig.onConfirm}
        onCancel={dialogConfig.onCancel}
      />

    </div>
  );
}
