import React, { useState } from 'react';
import { UserProfile, UserRole, CompanyBranch, Company } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import ConfirmModal from './ConfirmModal';
import { hasPermission } from '../utils';
import * as XLSX from 'xlsx';
import { 
  Users, 
  Plus, 
  Trash2, 
  KeyRound, 
  ShieldAlert, 
  ToggleLeft, 
  ToggleRight, 
  Search,
  User,
  Shield,
  Activity,
  HardHat,
  Tag,
  Building,
  CheckCircle2,
  X,
  Edit,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  LayoutGrid,
  List,
  Mail,
  MapPin,
  Network,
  FileDown
} from 'lucide-react';

interface UserManagementScreenProps {
  users: UserProfile[];
  currentUser: UserProfile;
  branches: CompanyBranch[];
  companies?: Company[];
  onRefresh: () => void;
}

export default function UserManagementScreen({ users, currentUser, branches = [], companies = [], onRefresh }: UserManagementScreenProps) {
  const [activeSubTab, setActiveSubTab] = useState<'users' | 'branches'>('users');
  const [branchViewMode, setBranchViewMode] = useState<'grid' | 'hierarchy'>('hierarchy');

  // Branch Form states
  const [showBranchForm, setShowBranchForm] = useState(false);
  const [editingBranch, setEditingBranch] = useState<CompanyBranch | null>(null);
  const [branchName, setBranchName] = useState('');
  const [branchAddress, setBranchAddress] = useState('');
  const [parentBranchId, setParentBranchId] = useState('');
  const [branchType, setBranchType] = useState<'anak_perusahaan' | 'anak_cabang'>('anak_cabang');
  const [branchSubmitting, setBranchSubmitting] = useState(false);

  // User Branch Selection State
  const [cabangId, setCabangId] = useState<string>(currentUser.username === 'admin' ? 'pusat' : (currentUser.cabangId || 'pusat'));
  // User Company Selection State
  const [companyId, setCompanyId] = useState<string>(currentUser.companyId || 'default');

  const [showAddForm, setShowAddForm] = useState(false);
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
  const [username, setUsername] = useState('');
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<UserRole>('departemen');
  const [subRole, setSubRole] = useState('');
  const [division, setDivision] = useState('HSE');
  const [searchQuery, setSearchQuery] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [expandedPermissions, setExpandedPermissions] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'kotak' | 'baris'>('kotak');

  // Form states for permissions
  const [canCreateWR, setCanCreateWR] = useState(true);
  const [canCreateWO, setCanCreateWO] = useState(false);
  const [canDeleteWR, setCanDeleteWR] = useState(false);
  const [canDeleteWO, setCanDeleteWO] = useState(false);
  const [canApprove, setCanApprove] = useState(false);
  const [canReject, setCanReject] = useState(false);
  const [canAssignTeknisi, setCanAssignTeknisi] = useState(false);
  const [canPlayWork, setCanPlayWork] = useState(true);
  const [canFinishWork, setCanFinishWork] = useState(true);
  const [canInputSAP, setCanInputSAP] = useState(false);
  const [canEditExistingSAP, setCanEditExistingSAP] = useState(false);
  
  // Tab permissions
  const [canShowTabWR, setCanShowTabWR] = useState(true);
  const [canShowTabWO, setCanShowTabWO] = useState(true);
  const [canShowTabPP, setCanShowTabPP] = useState(true);
  const [canShowTabProjects, setCanShowTabProjects] = useState(true);
  const [canShowTabPM, setCanShowTabPM] = useState(true);
  const [canShowTabKelistrikan, setCanShowTabKelistrikan] = useState(true);
  const [canManageKelistrikan, setCanManageKelistrikan] = useState(false);

  const getDefaultsForRole = (r: UserRole) => {
    if (r === 'admin' || r === 'management') {
      return {
        canCreateWR: true,
        canCreateWO: true,
        canDeleteWR: true,
        canDeleteWO: true,
        canApprove: true,
        canReject: true,
        canAssignTeknisi: true,
        canPlayWork: true,
        canFinishWork: true,
        canInputSAP: true,
        canEditExistingSAP: true,
      };
    }
    if (r === 'departemen') {
      return {
        canCreateWR: true,
        canCreateWO: false,
        canDeleteWR: false,
        canDeleteWO: false,
        canApprove: false,
        canReject: false,
        canAssignTeknisi: false,
        canPlayWork: false,
        canFinishWork: false,
        canInputSAP: false,
        canEditExistingSAP: false,
      };
    }
    // teknisi
    return {
      canCreateWR: false,
      canCreateWO: false,
      canDeleteWR: false,
      canDeleteWO: false,
      canApprove: false,
      canReject: false,
      canAssignTeknisi: false,
      canPlayWork: true,
      canFinishWork: true,
      canInputSAP: false,
      canEditExistingSAP: false,
    };
  };

  const handleTogglePermission = async (user: UserProfile, permissionKey: string, currentVal: boolean) => {
    try {
      await updateDoc(doc(db, 'users', user.username), {
        [permissionKey]: !currentVal
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Memperbarui Izin',
        message: 'Gagal memperbarui izin khusus pengguna di sistem.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
    }
  };

  const handleEditClick = (user: UserProfile) => {
    setEditingUser(user);
    setUsername(user.username);
    setName(user.name);
    setPin(user.pin);
    setEmail(user.email || '');
    setRole(user.role);
    setSubRole(user.subRole);
    setDivision(user.division);
    setCabangId(user.cabangId || 'pusat');
    setCompanyId(user.companyId || 'default');

    // Populate permission checkboxes
    setCanCreateWR(hasPermission(user, 'canCreateWR'));
    setCanCreateWO(hasPermission(user, 'canCreateWO'));
    setCanDeleteWR(hasPermission(user, 'canDeleteWR'));
    setCanDeleteWO(hasPermission(user, 'canDeleteWO'));
    setCanApprove(hasPermission(user, 'canApprove'));
    setCanReject(hasPermission(user, 'canReject'));
    setCanAssignTeknisi(hasPermission(user, 'canAssignTeknisi'));
    setCanPlayWork(hasPermission(user, 'canPlayWork'));
    setCanFinishWork(hasPermission(user, 'canFinishWork'));
    setCanInputSAP(hasPermission(user, 'canInputSAP'));
    setCanEditExistingSAP(hasPermission(user, 'canEditExistingSAP'));

    // Populate tab visibility permissions
    setCanShowTabWR(user.canShowTabWR !== false);
    setCanShowTabWO(user.canShowTabWO !== false);
    setCanShowTabPP(user.canShowTabPP !== false);
    setCanShowTabProjects(user.canShowTabProjects !== false);
    setCanShowTabPM(user.canShowTabPM !== false);
    setCanShowTabKelistrikan(user.canShowTabKelistrikan !== false);
    setCanManageKelistrikan(user.canManageKelistrikan === true);

    setShowAddForm(true);
  };

  const handleCancelForm = () => {
    setEditingUser(null);
    setUsername('');
    setName('');
    setPin('');
    setEmail('');
    setRole('departemen');
    setSubRole('');
    setDivision('HSE');
    setCabangId(currentUser.username === 'admin' ? 'pusat' : (currentUser.cabangId || 'pusat'));
    setCompanyId(currentUser.companyId || 'default');

    // Reset permissions
    setCanCreateWR(true);
    setCanCreateWO(false);
    setCanDeleteWR(false);
    setCanDeleteWO(false);
    setCanApprove(false);
    setCanReject(false);
    setCanAssignTeknisi(false);
    setCanPlayWork(true);
    setCanFinishWork(true);
    setCanInputSAP(false);
    setCanEditExistingSAP(false);

    setCanShowTabWR(true);
    setCanShowTabWO(true);
    setCanShowTabPP(true);
    setCanShowTabProjects(true);
    setCanShowTabPM(true);
    setCanShowTabKelistrikan(true);
    setCanManageKelistrikan(false);

    setShowAddForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !name.trim() || !pin.trim() || !subRole.trim() || !division.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon isi seluruh data pengguna sebelum mengirim.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setSubmitting(true);
    const sanitizedUsername = username.trim().toLowerCase().replace(/\s+/g, '');

    try {
      if (editingUser) {
        // Edit existing user in Firestore
        await updateDoc(doc(db, 'users', editingUser.username), {
          name: name.trim(),
          pin: pin.trim(),
          email: email.trim(),
          role,
          subRole: subRole.trim(),
          division: division.trim().toUpperCase(),
          cabangId,
          companyId: currentUser.username === 'admin' ? companyId : (currentUser.companyId || 'default'),
          canCreateWR,
          canCreateWO,
          canDeleteWR,
          canDeleteWO,
          canApprove,
          canReject,
          canAssignTeknisi,
          canPlayWork,
          canFinishWork,
          canInputSAP,
          canEditExistingSAP,
          canShowTabWR,
          canShowTabWO,
          canShowTabPP,
          canShowTabProjects,
          canShowTabPM,
          canShowTabKelistrikan,
          canManageKelistrikan
        });

        handleCancelForm();
        onRefresh();

        setDialogConfig({
          isOpen: true,
          title: 'Pengguna Diperbarui',
          message: 'Data pengguna berhasil diperbarui.',
          confirmLabel: 'Hebat',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      } else {
        // Add new user in Firestore
        const existing = users.find(u => u.username === sanitizedUsername);
        if (existing) {
          setDialogConfig({
            isOpen: true,
            title: 'Username Sudah Digunakan',
            message: `Username @${sanitizedUsername} sudah terdaftar di sistem. Silakan gunakan username lain.`,
            confirmLabel: 'Tutup',
            alertOnly: true,
            variant: 'warning',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
          setSubmitting(false);
          return;
        }

        const newUser: UserProfile = {
          username: sanitizedUsername,
          name: name.trim(),
          pin: pin.trim(),
          email: email.trim(),
          role,
          subRole: subRole.trim(),
          division: division.trim().toUpperCase(),
          active: true,
          createdAt: new Date().toISOString(),
          companyId: currentUser.username === 'admin' ? companyId : (currentUser.companyId || 'default'),
          cabangId,
          canCreateWR,
          canCreateWO,
          canDeleteWR,
          canDeleteWO,
          canApprove,
          canReject,
          canAssignTeknisi,
          canPlayWork,
          canFinishWork,
          canInputSAP,
          canEditExistingSAP,
          canShowTabWR,
          canShowTabWO,
          canShowTabPP,
          canShowTabProjects,
          canShowTabPM,
          canShowTabKelistrikan,
          canManageKelistrikan
        };

        await setDoc(doc(db, 'users', sanitizedUsername), newUser);

        handleCancelForm();
        onRefresh();
        
        setDialogConfig({
          isOpen: true,
          title: 'Pengguna Ditambahkan',
          message: 'Pengguna baru berhasil ditambahkan ke database.',
          confirmLabel: 'Hebat',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Error',
        message: editingUser ? 'Gagal memperbarui data pengguna.' : 'Gagal menambah pengguna baru ke dalam sistem.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleAccess = async (user: UserProfile) => {
    if (user.username === currentUser.username) {
      setDialogConfig({
        isOpen: true,
        title: 'Aksi Ditolak',
        message: 'Anda tidak dapat menonaktifkan akun administrator Anda sendiri!',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    try {
      await updateDoc(doc(db, 'users', user.username), {
        active: !user.active
      });
      onRefresh();
    } catch (err) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Memperbarui',
        message: 'Gagal memperbarui status akses pengguna di sistem.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
    }
  };

  const handleDeleteUser = async (targetUsername: string) => {
    if (targetUsername === currentUser.username) {
      setDialogConfig({
        isOpen: true,
        title: 'Aksi Ditolak',
        message: 'Anda tidak dapat menghapus akun administrator Anda sendiri!',
        confirmLabel: 'Mengerti',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      title: 'Hapus Pengguna',
      message: `Apakah Anda yakin ingin menghapus pengguna "${targetUsername}" dari sistem secara permanen?`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'users', targetUsername));
          onRefresh();
          setDialogConfig({
            isOpen: true,
            title: 'Hapus Berhasil',
            message: 'Pengguna telah berhasil dihapus dari sistem.',
            confirmLabel: 'Selesai',
            alertOnly: true,
            variant: 'info',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Hapus Gagal',
            message: 'Gagal menghapus pengguna dari database.',
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

  const handleAddBranch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!branchName.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Input Tidak Valid',
        message: 'Nama cabang harus diisi.',
        confirmLabel: 'OK',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setBranchSubmitting(true);
    try {
      const companyId = currentUser.companyId || 'default';
      if (editingBranch) {
        await updateDoc(doc(db, 'branches', editingBranch.id), {
          name: branchName.trim(),
          address: branchAddress.trim(),
          parentId: parentBranchId || '',
          type: branchType
        });
        setDialogConfig({
          isOpen: true,
          title: 'Struktur/Cabang Diperbarui',
          message: `Entitas "${branchName.trim()}" berhasil diperbarui.`,
          confirmLabel: 'OK',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      } else {
        const branchId = 'branch_' + companyId + '_' + Date.now();
        const newBranch: CompanyBranch = {
          id: branchId,
          companyId,
          name: branchName.trim(),
          address: branchAddress.trim(),
          createdAt: new Date().toISOString(),
          parentId: parentBranchId || '',
          type: branchType
        };
        await setDoc(doc(db, 'branches', branchId), newBranch);
        setDialogConfig({
          isOpen: true,
          title: 'Struktur/Cabang Berhasil Ditambahkan',
          message: `Entitas "${branchName.trim()}" telah terdaftar di perusahaan Anda.`,
          confirmLabel: 'Selesai',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
      }
      setBranchName('');
      setBranchAddress('');
      setParentBranchId('');
      setBranchType('anak_cabang');
      setEditingBranch(null);
      setShowBranchForm(false);
      onRefresh();
    } catch (err: any) {
      console.error(err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Menyimpan Cabang',
        message: 'Terjadi kesalahan saat menyimpan data: ' + err.message,
        confirmLabel: 'Ulangi',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } finally {
      setBranchSubmitting(false);
    }
  };

  const handleDeleteBranch = async (branch: CompanyBranch) => {
    setDialogConfig({
      isOpen: true,
      title: 'HAPUS CABANG PERUSAHAAN',
      message: `Apakah Anda yakin ingin menghapus cabang "${branch.name}" secara permanen?`,
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await deleteDoc(doc(db, 'branches', branch.id));
          onRefresh();
          setDialogConfig({
            isOpen: true,
            title: 'Cabang Dihapus',
            message: `Cabang "${branch.name}" telah dihapus dengan sukses dari database.`,
            confirmLabel: 'OK',
            alertOnly: true,
            variant: 'info',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err: any) {
          console.error(err);
          alert('Gagal menghapus cabang: ' + err.message);
        }
      },
      onCancel: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
    });
  };

  const renderHierarchyNode = (node: CompanyBranch, level: number = 0) => {
    const companyIdFilter = currentUser.username === 'admin' ? companyId : (currentUser.companyId || 'default');
    const companyBranches = branches.filter(b => b.companyId === companyIdFilter);
    const children = companyBranches.filter(b => b.parentId === node.id);
    const nodeMembers = users.filter(u => u.cabangId === node.id).length;
    
    return (
      <div key={node.id} className="space-y-2" style={{ marginLeft: `${level * 16}px` }}>
        <div className="flex items-center gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition max-w-xl">
          {level > 0 && (
            <div className="w-3.5 h-3.5 border-l-2 border-b-2 border-slate-300 -mt-2 -ml-4 mr-1 shrink-0 rounded-bl-md" />
          )}
          
          <span className={`p-2 rounded-lg shrink-0 ${
            node.type === 'anak_perusahaan' 
              ? 'bg-rose-50 border border-rose-100 text-rose-600' 
              : 'bg-indigo-50 border border-indigo-100 text-indigo-600'
          }`}>
            <Building className="w-4 h-4" />
          </span>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-800 truncate">{node.name}</h4>
              <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded-full ${
                node.type === 'anak_perusahaan'
                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                  : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
              }`}>
                {node.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Anak Cabang'}
              </span>
            </div>
            {node.address && (
              <span className="text-[10px] text-slate-400 block truncate mt-0.5">{node.address}</span>
            )}
            <span className="text-[10px] text-slate-500 font-medium block mt-1">
              👥 {nodeMembers} Karyawan Terdaftar
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => {
                setEditingBranch(node);
                setBranchName(node.name);
                setBranchAddress(node.address || '');
                setParentBranchId(node.parentId || '');
                setBranchType(node.type || 'anak_cabang');
                setShowBranchForm(true);
              }}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-indigo-600 transition cursor-pointer"
              title="Edit"
            >
              <Edit className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleDeleteBranch(node)}
              className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-rose-600 transition cursor-pointer"
              title="Hapus"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
        
        {children.length > 0 && (
          <div className="space-y-2 border-l border-dashed border-slate-200 pl-3">
            {children.map(child => renderHierarchyNode(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  // Filter users list
  const filteredUsers = users.filter(u => {
    return (
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.division.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.subRole.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const handleDownloadExcel = () => {
    const excelData = filteredUsers.map((u) => {
      const branch = branches.find(b => b.id === u.cabangId);
      const branchName = branch ? branch.name : (u.cabangId === 'pusat' ? 'Kantor Pusat' : u.cabangId || '-');

      return {
        'Nama Lengkap': u.name,
        'Username': u.username,
        'Email': u.email || '-',
        'PIN Keamanan': u.pin,
        'Peran': u.role === 'admin' ? 'Administrator' : u.role === 'management' ? 'MTC Management' : u.role === 'teknisi' ? 'MTC Teknisi' : 'Departemen',
        'Jabatan': u.subRole || '-',
        'Divisi': u.division || '-',
        'Entitas/Cabang': branchName,
        'Status Akses': u.active ? 'Aktif' : 'Nonaktif',
        'Tanggal Dibuat': u.createdAt ? new Date(u.createdAt).toLocaleDateString('id-ID') : '-',
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(excelData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Daftar Pengguna');
    
    worksheet['!cols'] = [
      { wch: 25 }, // Nama Lengkap
      { wch: 15 }, // Username
      { wch: 25 }, // Email
      { wch: 12 }, // PIN Keamanan
      { wch: 18 }, // Peran
      { wch: 18 }, // Jabatan
      { wch: 15 }, // Divisi
      { wch: 25 }, // Entitas/Cabang
      { wch: 12 }, // Status Akses
      { wch: 15 }  // Tanggal Dibuat
    ];

    XLSX.writeFile(workbook, `Daftar_Pengguna_MTC_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const getRoleIcon = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <Shield className="w-4 h-4 text-rose-500" />;
      case 'management':
        return <Activity className="w-4 h-4 text-emerald-500" />;
      case 'teknisi':
        return <HardHat className="w-4 h-4 text-amber-500" />;
      default:
        return <User className="w-4 h-4 text-blue-500" />;
    }
  };

  const getRoleBadge = (role: UserRole) => {
    switch (role) {
      case 'admin':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">Admin</span>;
      case 'management':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">MTC Management</span>;
      case 'teknisi':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">MTC Teknisi</span>;
      default:
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[9px] px-2 py-0.5 rounded-full font-mono font-bold uppercase">Departemen</span>;
    }
  };

  return (
    <div className="space-y-6" id="user-management-screen">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm" id="user-header-panel">
        <div>
          <h2 className="text-lg font-bold text-slate-900 font-sans tracking-tight flex items-center gap-2">
            <Users className="w-5 h-5 text-rose-500" />
            Pengelolaan Pengguna Sistem (MTC-Control)
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Hak khusus administrator untuk menambah pengguna, memberi atau mencabut akses, dan mengatur peran divisi.
          </p>
        </div>
        
        <button
          onClick={() => {
            if (showAddForm) {
              handleCancelForm();
            } else {
              setShowAddForm(true);
            }
          }}
          className={`${showAddForm ? 'bg-slate-600 hover:bg-slate-500' : 'bg-rose-600 hover:bg-rose-500'} text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0`}
          id="btn-toggle-add-user-form"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? 'Batal Tambah/Edit' : 'Tambah Pengguna Baru'}
        </button>
      </div>

      {/* Sub tabs for Users vs Branches */}
      <div className="flex border-b border-slate-200 gap-6" id="user-sub-tabs">
        <button
          onClick={() => {
            setActiveSubTab('users');
            handleCancelForm();
          }}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
            activeSubTab === 'users'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" />
          Kelola Karyawan
        </button>
        <button
          onClick={() => {
            setActiveSubTab('branches');
            handleCancelForm();
          }}
          className={`pb-3 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer border-b-2 ${
            activeSubTab === 'branches'
              ? 'border-rose-600 text-rose-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          Kelola Cabang Perusahaan
        </button>
      </div>

      {activeSubTab === 'users' ? (
        <>
          {/* Add/Edit User Box */}
          {showAddForm && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-md space-y-6 animate-fadeIn" id="user-add-form-box">
          <div className="border-b border-slate-100 pb-3 flex justify-between items-center" id="user-form-header">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
              {editingUser ? <Edit className="w-4 h-4 text-indigo-600" /> : <Plus className="w-4 h-4 text-rose-500" />}
              {editingUser ? `Edit Data Pengguna: @${editingUser.username}` : 'Buat Kredensial Pengguna Baru'}
            </h3>
            <span className="text-[10px] bg-slate-50 border border-slate-200 px-2.5 py-1 rounded font-mono text-slate-600">
              ROLE ADMINISTRATOR AKTIF
            </span>
          </div>

          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5" id="user-form">
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Username Login <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-username"
                  type="text"
                  required
                  disabled={editingUser !== null}
                  placeholder="Contoh: hse_andri, mtc_doni"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className={`block w-full px-3.5 py-2.5 border rounded-lg text-slate-800 text-xs focus:outline-none focus:bg-white transition ${editingUser ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed font-mono' : 'bg-slate-50 border-slate-200 focus:border-rose-500'}`}
                />
                {editingUser && (
                  <span className="text-[10px] text-slate-400 block mt-1">
                    * Username tidak dapat diubah setelah dibuat.
                  </span>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Kode Keamanan PIN <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <KeyRound className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    id="form-user-pin"
                    type="password"
                    maxLength={10}
                    required
                    placeholder="Contoh: 1212, 8899"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition tracking-widest font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Nama Lengkap Karyawan <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-name"
                  type="text"
                  required
                  placeholder="Contoh: Andri Hermawan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Peran Aplikasi
                  </label>
                  <select
                    id="form-user-role"
                    value={role}
                    onChange={(e) => {
                      const newRole = e.target.value as UserRole;
                      setRole(newRole);
                      const defaults = getDefaultsForRole(newRole);
                      setCanCreateWR(defaults.canCreateWR);
                      setCanCreateWO(defaults.canCreateWO);
                      setCanDeleteWR(defaults.canDeleteWR);
                      setCanDeleteWO(defaults.canDeleteWO);
                      setCanApprove(defaults.canApprove);
                      setCanReject(defaults.canReject);
                      setCanAssignTeknisi(defaults.canAssignTeknisi);
                    }}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition cursor-pointer"
                  >
                    <option value="departemen">Departemen</option>
                    <option value="teknisi">MTC Teknisi</option>
                    <option value="management">MTC Management</option>
                    {(currentUser.username === 'admin' || currentUser.role === 'admin') && <option value="admin">Administrator</option>}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Divisi Pengguna <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="form-user-division"
                    type="text"
                    required
                    placeholder="Contoh: HSE, MTC, LOGISTIK"
                    value={division}
                    onChange={(e) => setDivision(e.target.value.toUpperCase())}
                    className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition uppercase font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Jabatan / Deskripsi Sub-Role <span className="text-red-500">*</span>
                </label>
                <input
                  id="form-user-subrole"
                  type="text"
                  required
                  placeholder="Contoh: Foreman Listrik, HSE Spv"
                  value={subRole}
                  onChange={(e) => setSubRole(e.target.value)}
                  className="block w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Email Pengguna <span className="text-slate-400 font-normal">(Opsional untuk Notifikasi)</span>
                </label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-4 w-4 text-slate-400" />
                  </span>
                  <input
                    id="form-user-email"
                    type="email"
                    placeholder="Contoh: user@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition animate-fadeIn"
                  />
                </div>
              </div>

              {currentUser.username === 'admin' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Perusahaan Klien <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="form-user-company"
                    value={companyId}
                    onChange={(e) => {
                      setCompanyId(e.target.value);
                      setCabangId('pusat');
                    }}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition cursor-pointer font-bold"
                  >
                    <option value="default">PT. MTC-Control Utama (Sistem Default)</option>
                    {companies.filter(c => c.id !== 'default').map((c) => (
                      <option key={c.id} value={c.id}>{c.name} ({c.id})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Cabang Perusahaan <span className="text-red-500">*</span>
                </label>
                <select
                  id="form-user-cabang"
                  value={cabangId}
                  onChange={(e) => setCabangId(e.target.value)}
                  className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition cursor-pointer"
                >
                  {(currentUser.username === 'admin' || !currentUser.cabangId || currentUser.cabangId === 'pusat') && (
                    <option value="pusat">Kantor Pusat (HQ)</option>
                  )}
                  {branches.filter(b => b.companyId === (currentUser.username === 'admin' ? companyId : (currentUser.companyId || 'default'))).map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Anak Cabang'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Custom Permissions Setup Section */}
            <div className="md:col-span-3 bg-slate-50 rounded-xl p-4.5 border border-slate-200 mt-2 space-y-3" id="form-user-permissions-section">
              <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
                <ShieldCheck className="w-4 h-4 text-rose-500" />
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">Atur Izin Khusus & Visibilitas Tab Pengguna</span>
              </div>
              <p className="text-[10px] text-slate-400">
                Sesuaikan hak istimewa dan visibilitas menu/tab pengguna ini dengan mengaktifkan atau menonaktifkan fitur di bawah.
              </p>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                {[
                  { key: 'canCreateWR', state: canCreateWR, setState: setCanCreateWR, label: 'Membuat WR', desc: 'Izin membuat Permintaan Kerja' },
                  { key: 'canCreateWO', state: canCreateWO, setState: setCanCreateWO, label: 'Membuat WO', desc: 'Izin membuat Perintah Kerja' },
                  { key: 'canDeleteWR', state: canDeleteWR, setState: setCanDeleteWR, label: 'Menghapus WR', desc: 'Izin menghapus data WR' },
                  { key: 'canDeleteWO', state: canDeleteWO, setState: setCanDeleteWO, label: 'Menghapus WO', desc: 'Izin menghapus data WO' },
                  { key: 'canApprove', state: canApprove, setState: setCanApprove, label: 'Menyetujui (WR/WO/PP)', desc: 'Izin memberi persetujuan pengajuan' },
                  { key: 'canReject', state: canReject, setState: setCanReject, label: 'Menolak (WR/WO/PP)', desc: 'Izin menolak pengajuan' },
                  { key: 'canAssignTeknisi', state: canAssignTeknisi, setState: setCanAssignTeknisi, label: 'Menunjuk Teknisi', desc: 'Izin menunjuk kru pelaksana' },
                  { key: 'canPlayWork', state: canPlayWork, setState: setCanPlayWork, label: 'Play / Start Kerja', desc: 'Izin memulai pekerjaan WO' },
                  { key: 'canFinishWork', state: state => {}, stateVal: canFinishWork, setState: setCanFinishWork, label: 'Finish / Selesaikan Kerja', desc: 'Izin menyelesaikan pekerjaan WO' },
                  { key: 'canInputSAP', state: canInputSAP, setState: setCanInputSAP, label: 'Input Nomer SAP', desc: 'Izin menginput nomer SAP pada WO' },
                  { key: 'canEditExistingSAP', state: canEditExistingSAP, setState: setCanEditExistingSAP, label: 'Ubah Nomer SAP Terisi', desc: 'Izin mengubah/mengedit nomer SAP yang sudah terisi' },
                  { key: 'canShowTabWR', state: canShowTabWR, setState: setCanShowTabWR, label: 'Tampilkan Tab WR', desc: 'Izin melihat menu Work Request' },
                  { key: 'canShowTabWO', state: canShowTabWO, setState: setCanShowTabWO, label: 'Tampilkan Tab WO', desc: 'Izin melihat menu Work Order' },
                  { key: 'canShowTabPP', state: canShowTabPP, setState: setCanShowTabPP, label: 'Tampilkan Tab PP (Barang)', desc: 'Izin melihat menu Permintaan Barang' },
                  { key: 'canShowTabProjects', state: canShowTabProjects, setState: setCanShowTabProjects, label: 'Tampilkan Tab Proyek', desc: 'Izin melihat menu Proyek & Konstruksi' },
                  { key: 'canShowTabPM', state: canShowTabPM, setState: setCanShowTabPM, label: 'Tampilkan Tab PM', desc: 'Izin melihat menu Preventive Maintenance' },
                  { key: 'canShowTabKelistrikan', state: canShowTabKelistrikan, setState: setCanShowTabKelistrikan, label: 'Tampilkan Tab Kelistrikan', desc: 'Izin melihat menu Kalkulator & Monitor Listrik' },
                  { key: 'canManageKelistrikan', state: canManageKelistrikan, setState: setCanManageKelistrikan, label: 'Mengisi & Mengelola Listrik', desc: 'Izin menginput/mengedit laporan pemakaian listrik' },
                ].map((perm) => (
                  <label key={perm.key} className="flex items-start gap-2.5 p-3 bg-white rounded-lg border border-slate-200 hover:border-indigo-400 cursor-pointer select-none transition">
                    <input
                      type="checkbox"
                      checked={perm.key === 'canFinishWork' ? canFinishWork : perm.state}
                      onChange={(e) => perm.setState(e.target.checked)}
                      className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded cursor-pointer"
                    />
                    <div>
                      <span className="font-bold text-slate-700 block text-[10px]">{perm.label}</span>
                      <span className="text-[8px] text-slate-400 block -mt-0.5">{perm.desc}</span>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Form actions at the very bottom spanning full layout */}
            <div className="md:col-span-3 pt-4 border-t border-slate-100 flex justify-end gap-3" id="form-user-actions-row">
              <button
                type="button"
                onClick={handleCancelForm}
                className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer"
              >
                Batal
              </button>
              <button
                id="btn-submit-new-user"
                type="submit"
                disabled={submitting}
                className={`px-6 py-2.5 disabled:bg-slate-400 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer ${editingUser ? 'bg-indigo-600 hover:bg-indigo-500' : 'bg-rose-600 hover:bg-rose-500'}`}
              >
                {submitting ? 'Menyimpan...' : editingUser ? 'Simpan Perubahan Kredensial & Izin' : 'Buat Pengguna & Simpan Izin'}
              </button>
            </div>

          </form>
        </div>
      )}

      {/* Search & View Mode Switcher */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4" id="user-search-panel">
        <div className="relative flex-1 max-w-md" id="user-search-wrapper">
          <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-4 w-4 text-slate-400" />
          </span>
          <input
            id="user-search-input"
            type="text"
            placeholder="Cari nama karyawan, username, divisi, jabatan..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs placeholder-slate-400 focus:outline-none focus:border-rose-500 focus:bg-white transition"
          />
        </div>

        {/* Action Buttons: Download Excel & View Mode */}
        <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto" id="user-actions-row">
          <button
            type="button"
            onClick={handleDownloadExcel}
            className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
            id="btn-download-users-excel"
            title="Download Data Pengguna ke Excel"
          >
            <FileDown className="w-4 h-4" />
            Download Excel
          </button>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200" id="user-view-switcher">
            <button
              type="button"
              onClick={() => setViewMode('kotak')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'kotak' 
                  ? 'bg-white text-rose-600 shadow-xs border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              Kotak
            </button>
            <button
              type="button"
              onClick={() => setViewMode('baris')}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                viewMode === 'baris' 
                  ? 'bg-white text-rose-600 shadow-xs border border-slate-200' 
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              Baris
            </button>
          </div>
        </div>
      </div>

      {/* Users list conditional rendering based on viewMode */}
      {viewMode === 'baris' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-x-auto" id="users-baris-container">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider font-bold text-[10px]">
                <th className="py-3 px-4">Karyawan</th>
                <th className="py-3 px-4">Divisi & Jabatan</th>
                <th className="py-3 px-4">Peran Akses</th>
                <th className="py-3 px-4 font-mono">PIN</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Izin Aktif</th>
                <th className="py-3 px-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400">
                    Tidak ada karyawan ditemukan.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const activePermsCount = [
                    hasPermission(user, 'canCreateWR'),
                    hasPermission(user, 'canCreateWO'),
                    hasPermission(user, 'canDeleteWR'),
                    hasPermission(user, 'canDeleteWO'),
                    hasPermission(user, 'canApprove'),
                    hasPermission(user, 'canReject'),
                    hasPermission(user, 'canAssignTeknisi'),
                    hasPermission(user, 'canPlayWork'),
                    hasPermission(user, 'canFinishWork'),
                    hasPermission(user, 'canInputSAP'),
                    hasPermission(user, 'canEditExistingSAP'),
                    user.canShowTabWR !== false,
                    user.canShowTabWO !== false,
                    user.canShowTabPP !== false,
                    user.canShowTabProjects !== false,
                    user.canShowTabPM !== false,
                    user.canShowTabKelistrikan !== false,
                    user.canManageKelistrikan === true,
                  ].filter(Boolean).length;

                  return (
                    <tr key={user.username} className={`hover:bg-slate-50/50 transition ${user.active ? '' : 'bg-rose-50/20'}`}>
                      <td className="py-3.5 px-4 font-semibold text-slate-900">
                        <div className="flex items-center gap-2">
                          <span className="p-1 bg-slate-100 rounded border border-slate-200 text-slate-500">
                            {getRoleIcon(user.role)}
                          </span>
                          <div>
                            <div className="font-bold">{user.name}</div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] text-slate-400 font-mono font-normal">@{user.username}</span>
                              <span className="text-[9px] bg-slate-100/80 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200 flex items-center gap-0.5">
                                <MapPin className="w-2.5 h-2.5 text-slate-400" />
                                {user.cabangId === 'pusat' || !user.cabangId ? 'Pusat' : (branches.find(b => b.id === user.cabangId)?.name || 'Pusat')}
                              </span>
                              {currentUser.username === 'admin' && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 font-bold px-1.5 py-0.5 rounded border border-indigo-150 flex items-center gap-0.5">
                                  <Building className="w-2.5 h-2.5 text-indigo-500" />
                                  {companies.find(c => c.id === (user.companyId || 'default'))?.name || user.companyId || 'Default'}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-700 font-mono text-[11px]">{user.division}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{user.subRole}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        {getRoleBadge(user.role)}
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-amber-700 text-[11px]">
                        {user.pin}
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-500 text-[10px]">
                        {user.email || <span className="text-slate-350 italic">Belum Diatur</span>}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold border border-slate-200">
                          {activePermsCount}/16 Izin
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {!(user.username === 'admin' && currentUser.username !== 'admin') && (
                            <button
                              onClick={() => handleToggleAccess(user)}
                              className={`text-[9px] font-bold px-2 py-1 rounded transition flex items-center gap-1 cursor-pointer ${
                                user.active 
                                  ? 'bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700' 
                                  : 'bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700'
                              }`}
                            >
                              {user.active ? 'Cabut' : 'Beri'}
                            </button>
                          )}
                          {!(user.username === 'admin' && currentUser.username !== 'admin') && (
                            <button
                              onClick={() => handleEditClick(user)}
                              className="p-1 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded transition cursor-pointer"
                              title="Edit"
                            >
                              <Edit className="w-3 h-3" />
                            </button>
                          )}
                          {user.username !== currentUser.username && !(user.username === 'admin' && currentUser.username !== 'admin') && (
                            <button
                              onClick={() => handleDeleteUser(user.username)}
                              className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded transition cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
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
      ) : (
        /* Users list as a list of polished cards */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" id="users-cards-grid">
        {filteredUsers.map((user) => (
          <div key={user.username} className={`bg-white border rounded-2xl p-5 hover:border-slate-300 hover:shadow-sm transition flex flex-col justify-between ${user.active ? 'border-slate-200' : 'border-rose-200 bg-rose-50/10'}`} id={`user-card-${user.username}`}>
            
            <div className="space-y-4" id="user-card-body">
              {/* Card Header Profile */}
              <div className="flex items-center gap-3 border-b border-slate-100 pb-3" id="user-card-header">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-600">
                  {getRoleIcon(user.role)}
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                    {user.name}
                    {!user.active && <span className="bg-rose-50 text-rose-600 border border-rose-200 text-[8px] px-1.5 py-0.5 rounded uppercase font-bold">Inaktif</span>}
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5 truncate">@{user.username}</p>
                </div>
              </div>

              {/* User Roles & Dept details */}
              <div className="space-y-2 text-xs" id="user-card-details">
                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Cabang</span>
                  <span className="text-slate-700 font-bold text-xs flex items-center gap-1 font-sans">
                    <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                    {user.cabangId === 'pusat' || !user.cabangId ? 'Kantor Pusat' : (branches.find(b => b.id === user.cabangId)?.name || 'Kantor Pusat')}
                  </span>
                </div>

                <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                  <span className="text-slate-400 text-[10px] uppercase font-bold">Peran Akses</span>
                  {getRoleBadge(user.role)}
                </div>

                {currentUser.username === 'admin' && (
                  <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-slate-400 text-[10px] uppercase font-bold">Perusahaan</span>
                    <span className="text-indigo-700 font-bold text-xs flex items-center gap-1 font-sans">
                      <Building className="w-3.5 h-3.5 text-indigo-500" />
                      {companies.find(c => c.id === (user.companyId || 'default'))?.name || user.companyId || 'Default'}
                    </span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-2 text-[11px]" id="user-card-division-details">
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">Divisi</span>
                    <span className="text-slate-700 font-bold font-mono flex items-center gap-1 mt-0.5">
                      <Building className="w-3 h-3 text-slate-400" />
                      {user.division}
                    </span>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-lg border border-slate-100">
                    <span className="text-[9px] text-slate-400 uppercase font-semibold block">Jabatan</span>
                    <span className="text-slate-700 font-semibold truncate block mt-0.5" title={user.subRole}>
                      {user.subRole}
                    </span>
                  </div>
                </div>

                {/* Email preview */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between font-mono" id="user-card-email-box">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">Email</span>
                  <span className="text-slate-750 font-medium text-[10px] truncate max-w-[150px]">
                    {user.email || <span className="text-slate-350 italic">Belum Diatur</span>}
                  </span>
                </div>

                {/* Password / Pin preview */}
                <div className="bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between font-mono" id="user-card-pin-box">
                  <span className="text-[9px] text-slate-400 uppercase font-bold">PIN Pengguna</span>
                  <span className="text-amber-700 font-bold bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
                    {user.pin}
                  </span>
                </div>

                {/* Collapsible Permissions Box */}
                <div className="mt-3 border-t border-slate-100 pt-3" id={`user-perms-collapsible-${user.username}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedPermissions(prev => ({ ...prev, [user.username]: !prev[user.username] }))}
                    className="w-full flex items-center justify-between text-[10px] uppercase font-bold text-slate-500 hover:text-slate-800 transition py-1"
                  >
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
                      Kelola Hak & Menu ({
                        [
                          hasPermission(user, 'canCreateWR'),
                          hasPermission(user, 'canCreateWO'),
                          hasPermission(user, 'canDeleteWR'),
                          hasPermission(user, 'canDeleteWO'),
                          hasPermission(user, 'canApprove'),
                          hasPermission(user, 'canReject'),
                          hasPermission(user, 'canAssignTeknisi'),
                          hasPermission(user, 'canPlayWork'),
                          hasPermission(user, 'canFinishWork'),
                          hasPermission(user, 'canInputSAP'),
                          hasPermission(user, 'canEditExistingSAP'),
                          user.canShowTabWR !== false,
                          user.canShowTabWO !== false,
                          user.canShowTabPP !== false,
                          user.canShowTabProjects !== false,
                          user.canShowTabPM !== false,
                          user.canShowTabKelistrikan !== false,
                          user.canManageKelistrikan === true,
                        ].filter(Boolean).length
                      }/18)
                    </span>
                    {expandedPermissions[user.username] ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
                  </button>

                  {expandedPermissions[user.username] && (
                    <div className="mt-2.5 bg-slate-50/75 p-2.5 rounded-xl border border-slate-200/60 space-y-2 animate-fadeIn text-[11px]" id={`perms-panel-${user.username}`}>
                      {[
                        { key: 'canCreateWR', label: 'Membuat WR', desc: 'Izin mengajukan WR' },
                        { key: 'canCreateWO', label: 'Membuat WO', desc: 'Izin membuat perintah kerja' },
                        { key: 'canDeleteWR', label: 'Menghapus WR', desc: 'Izin menghapus data WR' },
                        { key: 'canDeleteWO', label: 'Menghapus WO', desc: 'Izin menghapus data WO' },
                        { key: 'canApprove', label: 'Menyetujui (WR/WO/PP)', desc: 'Izin menyetujui pengajuan' },
                        { key: 'canReject', label: 'Menolak (WR/WO/PP)', desc: 'Izin menolak pengajuan' },
                        { key: 'canAssignTeknisi', label: 'Menunjuk Teknisi', desc: 'Izin menunjuk pelaksana MTC' },
                        { key: 'canPlayWork', label: 'Play / Start Kerja', desc: 'Izin memulai pekerjaan WO' },
                        { key: 'canFinishWork', label: 'Finish / Selesaikan Kerja', desc: 'Izin menyelesaikan pekerjaan WO' },
                        { key: 'canInputSAP', label: 'Input Nomer SAP', desc: 'Izin menginput nomer SAP pada WO' },
                        { key: 'canEditExistingSAP', label: 'Ubah Nomer SAP Terisi', desc: 'Izin mengubah/mengedit nomer SAP yang sudah terisi' },
                        { key: 'canShowTabWR', label: 'Tampilkan Tab WR', desc: 'Izin akses menu Work Request', forceCheck: user.canShowTabWR !== false },
                        { key: 'canShowTabWO', label: 'Tampilkan Tab WO', desc: 'Izin akses menu Work Order', forceCheck: user.canShowTabWO !== false },
                        { key: 'canShowTabPP', label: 'Tampilkan Tab PP', desc: 'Izin akses menu Permintaan Barang', forceCheck: user.canShowTabPP !== false },
                        { key: 'canShowTabProjects', label: 'Tampilkan Tab Proyek', desc: 'Izin akses menu Proyek & Konstruksi', forceCheck: user.canShowTabProjects !== false },
                        { key: 'canShowTabPM', label: 'Tampilkan Tab PM', desc: 'Izin akses menu Preventive Maintenance', forceCheck: user.canShowTabPM !== false },
                        { key: 'canShowTabKelistrikan', label: 'Tampilkan Tab Kelistrikan', desc: 'Izin akses menu Listrik', forceCheck: user.canShowTabKelistrikan !== false },
                        { key: 'canManageKelistrikan', label: 'Mengisi Listrik', desc: 'Izin menginput/mengelola data Listrik', forceCheck: user.canManageKelistrikan === true },
                      ].map((perm) => {
                        const isGranted = perm.forceCheck !== undefined ? perm.forceCheck : hasPermission(user, perm.key as any);
                        return (
                          <div key={perm.key} className="flex items-center justify-between gap-2 p-1.5 hover:bg-slate-100/50 rounded-lg transition bg-white/50 border border-slate-100">
                            <div>
                              <span className="font-bold text-slate-700 block text-[10px]">{perm.label}</span>
                              <span className="text-[8px] text-slate-400 block -mt-0.5">{perm.desc}</span>
                            </div>
                            <button
                              type="button"
                              disabled={user.username === 'admin' && currentUser.username !== 'admin'}
                              onClick={() => handleTogglePermission(user, perm.key, isGranted)}
                              className={`px-2 py-1 rounded-md text-[9px] font-extrabold uppercase transition-all duration-150 flex items-center gap-1 cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed ${
                                isGranted 
                                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xs' 
                                  : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                              }`}
                            >
                              {isGranted ? 'Aktif' : 'Nonaktif'}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

              </div>
            </div>

            {/* Actions for managing users */}
            <div className="mt-5 pt-3 border-t border-slate-100 flex justify-between items-center gap-2" id="user-card-actions">
              
              {!(user.username === 'admin' && currentUser.username !== 'admin') && (
                <button
                  onClick={() => handleToggleAccess(user)}
                  className={`text-[10px] font-bold px-3 py-1.5 rounded-lg border transition flex items-center gap-1 cursor-pointer ${
                    user.active 
                      ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-700' 
                      : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700'
                  }`}
                  id={`btn-toggle-access-${user.username}`}
                >
                  {user.active ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-amber-600" /> Cabut Akses
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-slate-400" /> Beri Akses
                    </>
                  )}
                </button>
              )}

              <div className="flex gap-1.5" id={`user-card-ctrls-${user.username}`}>
                {!(user.username === 'admin' && currentUser.username !== 'admin') && (
                  <button
                    onClick={() => handleEditClick(user)}
                    className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-lg transition cursor-pointer"
                    title="Ubah Data Pengguna"
                    id={`btn-edit-user-${user.username}`}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                )}

                {user.username !== currentUser.username && !(user.username === 'admin' && currentUser.username !== 'admin') && (
                  <button
                    onClick={() => handleDeleteUser(user.username)}
                    className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                    title="Hapus Pengguna Permanent"
                    id={`btn-delete-user-${user.username}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

            </div>

          </div>
        ))}
      </div>
      )}
        </>
      ) : (
        <div className="space-y-6" id="branches-management-section">
          {/* Add branch trigger / header */}
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between" id="branch-management-header">
            <div>
              <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Building className="w-4 h-4 text-rose-500" />
                Daftar Cabang Perusahaan Anda
              </h3>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Tambahkan cabang baru agar Anda dapat memisahkan/mengelompokkan karyawan berdasarkan lokasi kerjanya.
              </p>
            </div>
            <button
              onClick={() => {
                if (showBranchForm) {
                  setEditingBranch(null);
                  setBranchName('');
                  setBranchAddress('');
                  setShowBranchForm(false);
                } else {
                  setShowBranchForm(true);
                }
              }}
              className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold px-3 py-2 rounded-lg transition shadow-md flex items-center gap-1 cursor-pointer shrink-0"
              id="btn-toggle-branch-form"
            >
              {showBranchForm ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
              {showBranchForm ? 'Batal' : 'Tambah Cabang'}
            </button>
          </div>

          {/* Add/Edit Branch Form */}
          {showBranchForm && (
            <form onSubmit={handleAddBranch} className="bg-white rounded-xl border border-slate-200 p-5 shadow-md space-y-4 animate-fadeIn" id="branch-form">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-2">
                {editingBranch ? 'Ubah Informasi Cabang' : 'Pendaftaran Cabang Baru'}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Nama Cabang <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Cabang Surabaya, Cabang Kalimantan"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                    id="branch-input-name"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Alamat / Lokasi Cabang / Perusahaan
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: Jl. Ahmad Yani No. 12, Surabaya"
                    value={branchAddress}
                    onChange={(e) => setBranchAddress(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                    id="branch-input-address"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Tipe Entitas <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={branchType}
                    onChange={(e) => setBranchType(e.target.value as 'anak_perusahaan' | 'anak_cabang')}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                  >
                    <option value="anak_cabang">Anak Cabang (Branch)</option>
                    <option value="anak_perusahaan">Anak Perusahaan (Sub-Company)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                    Induk Entitas (Parent)
                  </label>
                  <select
                    value={parentBranchId}
                    onChange={(e) => setParentBranchId(e.target.value)}
                    className="block w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs focus:outline-none focus:border-rose-500 focus:bg-white transition"
                  >
                    <option value="">Kantor Pusat (HO) - Utama</option>
                    {branches
                      .filter(b => b.companyId === (currentUser.companyId || 'default') && b.id !== editingBranch?.id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} ({b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Anak Cabang'})
                        </option>
                      ))}
                  </select>
                  <p className="text-[10px] text-slate-500 mt-1">
                    Pilih induk entitas untuk membuat struktur anak cabang berjenjang (rekursif).
                  </p>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingBranch(null);
                    setBranchName('');
                    setBranchAddress('');
                    setShowBranchForm(false);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-bold rounded-lg border border-slate-200 transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={branchSubmitting}
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition cursor-pointer"
                  id="btn-submit-branch"
                >
                  {branchSubmitting ? 'Menyimpan...' : 'Simpan Cabang'}
                </button>
              </div>
            </form>
          )}

          {/* View Toggles for Branches */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3" id="branches-view-toggle-panel">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
              Mode Tampilan Struktur:
            </span>
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border border-slate-200">
              <button
                type="button"
                onClick={() => setBranchViewMode('hierarchy')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  branchViewMode === 'hierarchy'
                    ? 'bg-white text-rose-600 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Network className="w-3.5 h-3.5" />
                Bagan Struktur (Hierarki)
              </button>
              <button
                type="button"
                onClick={() => setBranchViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-bold transition flex items-center gap-1 cursor-pointer ${
                  branchViewMode === 'grid'
                    ? 'bg-white text-rose-600 shadow-xs border border-slate-200'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                Daftar Kotak (Flat Grid)
              </button>
            </div>
          </div>

          {branchViewMode === 'hierarchy' ? (
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4 shadow-inner" id="branches-hierarchy-tree">
              {(() => {
                const companyIdFilter = currentUser.username === 'admin' ? companyId : (currentUser.companyId || 'default');
                const companyBranches = branches.filter(b => b.companyId === companyIdFilter);
                const rootBranches = companyBranches.filter(b => !b.parentId || !companyBranches.some(p => p.id === b.parentId));

                if (companyBranches.length === 0) {
                  return (
                    <div className="text-center py-8 text-slate-400 text-xs">
                      Belum ada struktur organisasi terdaftar. Silakan "Tambah Cabang/Entitas" di atas.
                    </div>
                  );
                }

                return (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white px-3.5 py-2.5 rounded-lg border border-slate-200 w-fit shadow-xs">
                      <span className="p-1 bg-rose-50 text-rose-600 rounded">🏢</span>
                      <span>Kantor Pusat / Perusahaan Utama (Root)</span>
                    </div>
                    <div className="space-y-3 pl-4 border-l border-dashed border-slate-300 mt-2">
                      {rootBranches.map(node => renderHierarchyNode(node, 0))}
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            /* Branches Grid */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="branches-grid">
              {branches.length === 0 ? (
                <div className="col-span-full bg-white p-8 text-center text-slate-400 rounded-xl border border-slate-200">
                  Belum ada cabang terdaftar. Klik tombol "Tambah Cabang" di atas untuk menambahkan cabang baru.
                </div>
              ) : (
                branches.map((b) => (
                  <div key={b.id} className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex flex-col justify-between hover:border-slate-300 transition" id={`branch-card-${b.id}`}>
                    <div className="space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2">
                          <span className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-indigo-600">
                            <Building className="w-4 h-4" />
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-slate-800">{b.name}</h4>
                            <span className="text-[9px] text-slate-400 font-mono block">
                              ID: {b.id} {b.type === 'anak_perusahaan' ? '• ANAK PERUSAHAAN' : '• CABANG'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100 space-y-1">
                        <span className="text-[9px] text-slate-400 uppercase font-semibold block">Lokasi / Alamat</span>
                        <span className="text-slate-700 text-xs flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{b.address || <span className="text-slate-400 italic">Tidak ada alamat</span>}</span>
                        </span>
                      </div>

                      {/* Parent Entity Indicator if any */}
                      {b.parentId && (
                        <div className="bg-rose-50/50 p-2 rounded-lg border border-rose-100/50 text-[10px] text-rose-700 flex items-center gap-1">
                          <span className="font-bold">Induk:</span>
                          <span className="truncate">
                            {branches.find(p => p.id === b.parentId)?.name || 'Kantor Pusat'}
                          </span>
                        </div>
                      )}

                      {/* Member Count of this Branch */}
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>Jumlah Karyawan Cabang:</span>
                        <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full">
                          {users.filter(u => u.cabangId === b.id).length} Karyawan
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex justify-end gap-1.5" id={`branch-card-actions-${b.id}`}>
                      <button
                        onClick={() => {
                          setEditingBranch(b);
                          setBranchName(b.name);
                          setBranchAddress(b.address || '');
                          setParentBranchId(b.parentId || '');
                          setBranchType(b.type || 'anak_cabang');
                          setShowBranchForm(true);
                        }}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-lg transition cursor-pointer"
                        title="Ubah Cabang"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteBranch(b)}
                        className="p-1.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg transition cursor-pointer"
                        title="Hapus Cabang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
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

    </div>
  );
}
