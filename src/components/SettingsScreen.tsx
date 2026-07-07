import React, { useState, useEffect } from 'react';
import { UserProfile, Company, CompanyFormatConfig, CompanyBranch } from '../types';
import { db } from '../firebase';
import { doc, updateDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { 
  Settings, 
  Type, 
  Sun, 
  Moon, 
  Volume2, 
  Smartphone, 
  Check, 
  VolumeX,
  Play,
  Save,
  HelpCircle,
  Building2,
  Upload,
  Download,
  Image as ImageIcon,
  FileCode,
  Trash2,
  RefreshCw,
  Sparkles,
  LayoutDashboard,
  Wrench,
  Activity,
  Package,
  BarChart3,
  FileText,
  ShieldCheck,
  Briefcase,
  Zap,
  MessageSquare,
  Users,
  Building,
  ArrowUp,
  ArrowDown
} from 'lucide-react';

export const DEFAULT_TAB_ORDER = [
  'dashboard',
  'wo',
  'assets',
  'inventory',
  'reports',
  'wr',
  'pp',
  'pm',
  'projects',
  'kelistrikan',
  'forum',
  'settings',
  'users',
  'companies'
];

export const TAB_INFO: Record<string, { label: string; icon: string }> = {
  dashboard: { label: 'Dashboard Overview', icon: 'LayoutDashboard' },
  wo: { label: 'Work Orders', icon: 'Wrench' },
  assets: { label: 'Assets (Aset & Mesin)', icon: 'Activity' },
  inventory: { label: 'Inventory (Suku Cadang)', icon: 'Package' },
  reports: { label: 'Reports (Laporan Analitik)', icon: 'BarChart3' },
  wr: { label: 'Work Requests (WR)', icon: 'FileText' },
  pp: { label: 'Permintaan Barang (PP)', icon: 'Package' },
  pm: { label: 'Preventive Maintenance', icon: 'ShieldCheck' },
  projects: { label: 'Proyek & Konstruksi', icon: 'Briefcase' },
  kelistrikan: { label: 'Monitor Kelistrikan', icon: 'Zap' },
  forum: { label: 'Forum Group Chat', icon: 'MessageSquare' },
  settings: { label: 'Pengaturan Aplikasi', icon: 'Settings' },
  users: { label: 'Kelola Pengguna (Users)', icon: 'Users' },
  companies: { label: 'Kelola Perusahaan', icon: 'Building' }
};

interface SettingsScreenProps {
  currentUser: UserProfile;
  companies: Company[];
  branches?: CompanyBranch[];
}

export default function SettingsScreen({ currentUser, companies, branches = [] }: SettingsScreenProps) {
  // ----------------------------------------------------
  // GENERAL USER SETTINGS
  // ----------------------------------------------------
  const [fontSize, setFontSize] = useState<string>(() => {
    return localStorage.getItem(`settings_${currentUser.username}_fontSize`) || 'medium';
  });
  const [themeMode, setThemeMode] = useState<string>(() => {
    return localStorage.getItem(`settings_${currentUser.username}_themeMode`) || 'light';
  });
  const [notifSound, setNotifSound] = useState<string>(() => {
    return localStorage.getItem(`settings_${currentUser.username}_notifSound`) || 'chime';
  });
  const [notifVibrate, setNotifVibrate] = useState<boolean>(() => {
    const val = localStorage.getItem(`settings_${currentUser.username}_notifVibrate`);
    return val !== 'false'; // Default to true
  });

  const [savedSuccess, setSavedSuccess] = useState(false);

  const [tabOrder, setTabOrder] = useState<string[]>(DEFAULT_TAB_ORDER);
  const [savingTabOrder, setSavingTabOrder] = useState(false);
  const [tabOrderSaved, setTabOrderSaved] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'navigation'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.tabOrder)) {
          const filtered = data.tabOrder.filter(id => DEFAULT_TAB_ORDER.includes(id));
          const missing = DEFAULT_TAB_ORDER.filter(id => !filtered.includes(id));
          setTabOrder([...filtered, ...missing]);
        }
      }
    });
    return () => unsub();
  }, []);

  const handleMoveTab = (index: number, direction: 'up' | 'down') => {
    const newList = [...tabOrder];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newList.length) return;
    
    const temp = newList[index];
    newList[index] = newList[targetIndex];
    newList[targetIndex] = temp;
    
    setTabOrder(newList);
  };

  const handleSaveTabOrder = async () => {
    setSavingTabOrder(true);
    try {
      await setDoc(doc(db, 'settings', 'navigation'), {
        tabOrder: tabOrder
      }, { merge: true });
      setTabOrderSaved(true);
      setTimeout(() => setTabOrderSaved(false), 2500);
    } catch (err) {
      console.error('Error saving tab order:', err);
      alert('Gagal menyimpan urutan navigasi: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSavingTabOrder(false);
    }
  };

  // Apply visual settings to document
  useEffect(() => {
    const root = document.getElementById('app-root-container');
    if (root) {
      root.classList.remove('text-xs', 'text-sm', 'text-base', 'text-lg');
      if (fontSize === 'small') {
        root.style.fontSize = '13px';
      } else if (fontSize === 'medium') {
        root.style.fontSize = '15px';
      } else if (fontSize === 'large') {
        root.style.fontSize = '17px';
      } else if (fontSize === 'xlarge') {
        root.style.fontSize = '19px';
      }
    }

    const body = document.body;
    if (themeMode === 'dark') {
      body.classList.add('dark');
      const rootContainer = document.getElementById('app-root-container');
      if (rootContainer) rootContainer.classList.add('dark');
    } else {
      body.classList.remove('dark');
      const rootContainer = document.getElementById('app-root-container');
      if (rootContainer) rootContainer.classList.remove('dark');
    }
  }, [fontSize, themeMode]);

  const playSoundPreview = (soundType: string) => {
    if (soundType === 'silent') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (soundType === 'chime') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
        osc.start();
        osc.stop(ctx.currentTime + 0.6);
      } else if (soundType === 'bell') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.8);
        osc.start();
        osc.stop(ctx.currentTime + 0.8);
      } else if (soundType === 'standard') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch (e) {
      console.warn("AudioContext not supported:", e);
    }
  };

  const handleVibratePreview = () => {
    if (navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    } else {
      const icon = document.getElementById('vibration-icon');
      if (icon) {
        icon.classList.add('animate-bounce');
        setTimeout(() => icon.classList.remove('animate-bounce'), 1000);
      }
    }
  };

  const saveSettings = () => {
    localStorage.setItem(`settings_${currentUser.username}_fontSize`, fontSize);
    localStorage.setItem(`settings_${currentUser.username}_themeMode`, themeMode);
    localStorage.setItem(`settings_${currentUser.username}_notifSound`, notifSound);
    localStorage.setItem(`settings_${currentUser.username}_notifVibrate`, String(notifVibrate));

    window.dispatchEvent(new Event('storage'));
    setSavedSuccess(true);
    playSoundPreview(notifSound);
    if (notifVibrate) {
      handleVibratePreview();
    }
    setTimeout(() => {
      setSavedSuccess(false);
    }, 2500);
  };

  // ----------------------------------------------------
  // PRINT TEMPLATE MANAGER (WR, WO, & PP)
  // ----------------------------------------------------
  // Identify editable companies for current user:
  // - Administrator Pusat (username === 'admin' or role === 'admin') can edit any company.
  // - Admin Perusahaan (username === company.adminUsername) can edit their own company.
  const isPusatAdmin = currentUser.username === 'admin' || currentUser.role === 'admin';
  const editableCompanies = isPusatAdmin
    ? companies
    : companies.filter(c => c.adminUsername === currentUser.username);

  const hasBranchDirectAccess = currentUser.cabangId && currentUser.cabangId !== 'pusat' && (currentUser.role === 'admin' || currentUser.role === 'management');

  const canEditFormats = editableCompanies.length > 0 || hasBranchDirectAccess;

  // Selected entity key (e.g., "company:pt_maju" or "branch:branchId")
  const [selectedEntityKey, setSelectedEntityKey] = useState<string>('');

  // Selected format tab (wr, wo, or pp)
  const [activeFormatTab, setActiveFormatTab] = useState<'wr' | 'wo' | 'pp'>('wr');

  // WR Format field states
  const [wrCompanyName, setWrCompanyName] = useState('');
  const [wrAddressLine1, setWrAddressLine1] = useState('');
  const [wrAddressLine2, setWrAddressLine2] = useState('');
  const [wrDocumentTitle, setWrDocumentTitle] = useState('');
  const [wrDocumentCode, setWrDocumentCode] = useState('');
  const [wrLogoUrl, setWrLogoUrl] = useState('');
  const [wrSignature1, setWrSignature1] = useState('');
  const [wrSignature2, setWrSignature2] = useState('');

  // WO Format field states
  const [woCompanyName, setWoCompanyName] = useState('');
  const [woAddressLine1, setWoAddressLine1] = useState('');
  const [woAddressLine2, setWoAddressLine2] = useState('');
  const [woDocumentTitle, setWoDocumentTitle] = useState('');
  const [woDocumentCode, setWoDocumentCode] = useState('');
  const [woLogoUrl, setWoLogoUrl] = useState('');
  const [woSignature1, setWoSignature1] = useState('');
  const [woSignature2, setWoSignature2] = useState('');
  const [woSignature3, setWoSignature3] = useState('');

  // PP Format field states
  const [ppCompanyName, setPpCompanyName] = useState('');
  const [ppAddressLine1, setPpAddressLine1] = useState('');
  const [ppAddressLine2, setPpAddressLine2] = useState('');
  const [ppDocumentTitle, setPpDocumentTitle] = useState('');
  const [ppDocumentCode, setPpDocumentCode] = useState('');
  const [ppLogoUrl, setPpLogoUrl] = useState('');
  const [ppSignature1, setPpSignature1] = useState('');
  const [ppSignature2, setPpSignature2] = useState('');

  const [savingFormat, setSavingFormat] = useState(false);
  const [formatSavedSuccess, setFormatSavedSuccess] = useState(false);
  const [formatError, setFormatError] = useState<string | null>(null);

  // Set initial selected entity key
  useEffect(() => {
    if (!selectedEntityKey) {
      if (hasBranchDirectAccess) {
        setSelectedEntityKey(`branch:${currentUser.cabangId}`);
      } else if (editableCompanies.length > 0) {
        setSelectedEntityKey(`company:${editableCompanies[0].id}`);
      }
    }
  }, [hasBranchDirectAccess, editableCompanies, currentUser, selectedEntityKey]);

  // Load formatting states when selectedEntityKey changes
  useEffect(() => {
    if (!selectedEntityKey) return;
    
    const [type, id] = selectedEntityKey.split(':');
    
    let wr: CompanyFormatConfig | undefined;
    let wo: CompanyFormatConfig | undefined;
    let pp: CompanyFormatConfig | undefined;
    let name = '';
    let fallbackCompany: Company | undefined;

    if (type === 'company') {
      const company = companies.find(c => c.id === id);
      if (!company) return;
      wr = company.wrFormat;
      wo = company.woFormat;
      pp = company.ppFormat;
      name = company.name;
    } else if (type === 'branch') {
      const branch = (branches || []).find(b => b.id === id);
      if (!branch) return;
      wr = branch.wrFormat;
      wo = branch.woFormat;
      pp = branch.ppFormat;
      name = branch.name;
      fallbackCompany = companies.find(c => c.id === branch.companyId);
    }

    const parentCompany = fallbackCompany || companies[0];

    // Load WR Formats
    setWrCompanyName(wr?.companyName || name || parentCompany?.name || 'PT DUNIA KIMIA JAYA');
    setWrAddressLine1(wr?.addressLine1 || (type === 'branch' ? ((branches || []).find(b => b.id === id)?.address || '') : '') || 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
    setWrAddressLine2(wr?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
    setWrDocumentTitle(wr?.documentTitle || 'PERMINTAAN KERJA DAN PERBAIKAN');
    setWrDocumentCode(wr?.documentCode || 'C.MNT.002-02/R1');
    setWrLogoUrl(wr?.logoUrl || parentCompany?.wrFormat?.logoUrl || '');
    setWrSignature1(wr?.signature1 || 'Diajukan Oleh');
    setWrSignature2(wr?.signature2 || 'Diterima oleh');

    // Load WO Formats
    setWoCompanyName(wo?.companyName || name || parentCompany?.name || 'PT DUNIA KIMIA JAYA');
    setWoAddressLine1(wo?.addressLine1 || (type === 'branch' ? ((branches || []).find(b => b.id === id)?.address || '') : '') || 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
    setWoAddressLine2(wo?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
    setWoDocumentTitle(wo?.documentTitle || 'SURAT PERINTAH KERJA (WORK ORDER)');
    setWoDocumentCode(wo?.documentCode || 'C.MNT.003-02/R1');
    setWoLogoUrl(wo?.logoUrl || parentCompany?.woFormat?.logoUrl || '');
    setWoSignature1(wo?.signature1 || 'Dibuat Oleh');
    setWoSignature2(wo?.signature2 || 'Dikerjakan Oleh');
    setWoSignature3(wo?.signature3 || 'Disetujui Oleh');

    // Load PP Formats
    setPpCompanyName(pp?.companyName || name || parentCompany?.name || 'PT DUNIA KIMIA JAYA');
    setPpAddressLine1(pp?.addressLine1 || (type === 'branch' ? ((branches || []).find(b => b.id === id)?.address || '') : '') || 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
    setPpAddressLine2(pp?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
    setPpDocumentTitle(pp?.documentTitle || 'PERMINTAAN PEMBELIAN & PENYEDIAAN SPERPART');
    setPpDocumentCode(pp?.documentCode || 'C.MNT.004-02/R1');
    setPpLogoUrl(pp?.logoUrl || parentCompany?.ppFormat?.logoUrl || '');
    setPpSignature1(pp?.signature1 || 'Diajukan Oleh');
    setPpSignature2(pp?.signature2 || 'Disetujui Oleh');

    setFormatSavedSuccess(false);
    setFormatError(null);
  }, [selectedEntityKey, companies, branches]);

  // Handle image logo upload and convert to base64
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'wr' | 'wo' | 'pp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) {
      setFormatError('Ukuran file logo terlalu besar. Maksimal adalah 800 KB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (uploadEvent) => {
      const base64 = uploadEvent.target?.result as string;
      if (type === 'wr') {
        setWrLogoUrl(base64);
      } else if (type === 'wo') {
        setWoLogoUrl(base64);
      } else {
        setPpLogoUrl(base64);
      }
      setFormatError(null);
    };
    reader.readAsDataURL(file);
  };

  // Handle format template (JSON) file upload
  const handleFormatJsonUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'wr' | 'wo' | 'pp') => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      try {
        const json = JSON.parse(loadEvent.target?.result as string);
        if (type === 'wr') {
          if (json.companyName) setWrCompanyName(json.companyName);
          if (json.addressLine1) setWrAddressLine1(json.addressLine1);
          if (json.addressLine2) setWrAddressLine2(json.addressLine2);
          if (json.documentTitle) setWrDocumentTitle(json.documentTitle);
          if (json.documentCode) setWrDocumentCode(json.documentCode);
          if (json.logoUrl) setWrLogoUrl(json.logoUrl);
          if (json.signature1) setWrSignature1(json.signature1);
          if (json.signature2) setWrSignature2(json.signature2);
        } else if (type === 'wo') {
          if (json.companyName) setWoCompanyName(json.companyName);
          if (json.addressLine1) setWoAddressLine1(json.addressLine1);
          if (json.addressLine2) setWoAddressLine2(json.addressLine2);
          if (json.documentTitle) setWoDocumentTitle(json.documentTitle);
          if (json.documentCode) setWoDocumentCode(json.documentCode);
          if (json.logoUrl) setWoLogoUrl(json.logoUrl);
          if (json.signature1) setWoSignature1(json.signature1);
          if (json.signature2) setWoSignature2(json.signature2);
          if (json.signature3) setWoSignature3(json.signature3);
        } else {
          if (json.companyName) setPpCompanyName(json.companyName);
          if (json.addressLine1) setPpAddressLine1(json.addressLine1);
          if (json.addressLine2) setPpAddressLine2(json.addressLine2);
          if (json.documentTitle) setPpDocumentTitle(json.documentTitle);
          if (json.documentCode) setPpDocumentCode(json.documentCode);
          if (json.logoUrl) setPpLogoUrl(json.logoUrl);
          if (json.signature1) setPpSignature1(json.signature1);
          if (json.signature2) setPpSignature2(json.signature2);
        }
        setFormatError(null);
        alert(`Format Template ${type.toUpperCase()} berhasil dimuat! Klik 'Simpan Format Cetak' untuk menyimpan ke Cloud.`);
      } catch (err) {
        setFormatError('File format tidak valid. Pastikan format file adalah JSON.');
      }
    };
    reader.readAsText(file);
  };

  // Generate and download Format JSON file
  const handleDownloadFormatJson = (type: 'wr' | 'wo' | 'pp') => {
    const data = type === 'wr' ? {
      companyName: wrCompanyName,
      addressLine1: wrAddressLine1,
      addressLine2: wrAddressLine2,
      documentTitle: wrDocumentTitle,
      documentCode: wrDocumentCode,
      logoUrl: wrLogoUrl,
      signature1: wrSignature1,
      signature2: wrSignature2,
    } : type === 'wo' ? {
      companyName: woCompanyName,
      addressLine1: woAddressLine1,
      addressLine2: woAddressLine2,
      documentTitle: woDocumentTitle,
      documentCode: woDocumentCode,
      logoUrl: woLogoUrl,
      signature1: woSignature1,
      signature2: woSignature2,
      signature3: woSignature3,
    } : {
      companyName: ppCompanyName,
      addressLine1: ppAddressLine1,
      addressLine2: ppAddressLine2,
      documentTitle: ppDocumentTitle,
      documentCode: ppDocumentCode,
      logoUrl: ppLogoUrl,
      signature1: ppSignature1,
      signature2: ppSignature2,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `format_template_${type}_${selectedEntityKey.replace(/:/g, '_')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Save formats back to Firestore
  const saveCompanyFormats = async () => {
    if (!selectedEntityKey) return;
    setSavingFormat(true);
    setFormatError(null);
    setFormatSavedSuccess(false);

    const [type, id] = selectedEntityKey.split(':');

    try {
      const docRef = type === 'company' ? doc(db, 'companies', id) : doc(db, 'branches', id);

      const wrFormat: CompanyFormatConfig = {
        companyName: wrCompanyName,
        addressLine1: wrAddressLine1,
        addressLine2: wrAddressLine2,
        documentTitle: wrDocumentTitle,
        documentCode: wrDocumentCode,
        logoUrl: wrLogoUrl,
        signature1: wrSignature1,
        signature2: wrSignature2,
      };

      const woFormat: CompanyFormatConfig = {
        companyName: woCompanyName,
        addressLine1: woAddressLine1,
        addressLine2: woAddressLine2,
        documentTitle: woDocumentTitle,
        documentCode: woDocumentCode,
        logoUrl: woLogoUrl,
        signature1: woSignature1,
        signature2: woSignature2,
        signature3: woSignature3,
      };

      const ppFormat: CompanyFormatConfig = {
        companyName: ppCompanyName,
        addressLine1: ppAddressLine1,
        addressLine2: ppAddressLine2,
        documentTitle: ppDocumentTitle,
        documentCode: ppDocumentCode,
        logoUrl: ppLogoUrl,
        signature1: ppSignature1,
        signature2: ppSignature2,
      };

      await updateDoc(docRef, {
        wrFormat,
        woFormat,
        ppFormat
      });

      setFormatSavedSuccess(true);
      setTimeout(() => {
        setFormatSavedSuccess(false);
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setFormatError('Gagal menyimpan format ke server: ' + err.message);
    } finally {
      setSavingFormat(false);
    }
  };

  // Reset to default settings
  const handleResetFormats = () => {
    if (!selectedEntityKey) return;
    const [type, id] = selectedEntityKey.split(':');
    
    let defaultName = 'PT DUNIA KIMIA JAYA';
    let defaultAddress = 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar';

    if (type === 'company') {
      const company = companies.find(c => c.id === id);
      if (company) defaultName = company.name;
    } else {
      const branch = (branches || []).find(b => b.id === id);
      if (branch) {
        defaultName = branch.name;
        if (branch.address) defaultAddress = branch.address;
      }
    }

    if (window.confirm('Apakah anda yakin ingin mengembalikan format cetak ini ke default?')) {
      if (activeFormatTab === 'wr') {
        setWrCompanyName(defaultName);
        setWrAddressLine1(defaultAddress);
        setWrAddressLine2('Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
        setWrDocumentTitle('PERMINTAAN KERJA DAN PERBAIKAN');
        setWrDocumentCode('C.MNT.002-02/R1');
        setWrLogoUrl('');
        setWrSignature1('Diajukan Oleh');
        setWrSignature2('Diterima oleh');
      } else if (activeFormatTab === 'wo') {
        setWoCompanyName(defaultName);
        setWoAddressLine1(defaultAddress);
        setWoAddressLine2('Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
        setWoDocumentTitle('SURAT PERINTAH KERJA (WORK ORDER)');
        setWoDocumentCode('C.MNT.003-02/R1');
        setWoLogoUrl('');
        setWoSignature1('Dibuat Oleh');
        setWoSignature2('Dikerjakan Oleh');
        setWoSignature3('Disetujui Oleh');
      } else {
        setPpCompanyName(defaultName);
        setPpAddressLine1(defaultAddress);
        setPpAddressLine2('Gresik - 61151, Telp. (031) 3958686 Fax. 3957887');
        setPpDocumentTitle('PERMINTAAN PEMBELIAN & PENYEDIAAN SPERPART');
        setPpDocumentCode('C.MNT.004-02/R1');
        setPpLogoUrl('');
        setPpSignature1('Diajukan Oleh');
        setPpSignature2('Disetujui Oleh');
      }
    }
  };

  const getEntityOptions = () => {
    const options: { key: string; label: string }[] = [];

    if (isPusatAdmin) {
      companies.forEach(company => {
        options.push({
          key: `company:${company.id}`,
          label: `${company.name} (Kantor Pusat)`
        });
        
        const companyBranches = (branches || []).filter(b => b.companyId === company.id);
        companyBranches.forEach(b => {
          const typeLabel = b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : b.type === 'anak_cabang' ? 'Anak Cabang' : 'Cabang';
          options.push({
            key: `branch:${b.id}`,
            label: `└── [${typeLabel}] ${b.name}`
          });
        });
      });
    } else {
      editableCompanies.forEach(company => {
        options.push({
          key: `company:${company.id}`,
          label: `${company.name} (Kantor Pusat)`
        });
        
        const companyBranches = (branches || []).filter(b => b.companyId === company.id);
        companyBranches.forEach(b => {
          const typeLabel = b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : b.type === 'anak_cabang' ? 'Anak Cabang' : 'Cabang';
          options.push({
            key: `branch:${b.id}`,
            label: `└── [${typeLabel}] ${b.name}`
          });
        });
      });

      if (hasBranchDirectAccess) {
        const myBranch = (branches || []).find(b => b.id === currentUser.cabangId);
        if (myBranch) {
          const alreadyAdded = options.some(o => o.key === `branch:${myBranch.id}`);
          if (!alreadyAdded) {
            const typeLabel = myBranch.type === 'anak_perusahaan' ? 'Anak Perusahaan' : myBranch.type === 'anak_cabang' ? 'Anak Cabang' : 'Cabang';
            options.push({
              key: `branch:${myBranch.id}`,
              label: `[${typeLabel}] ${myBranch.name}`
            });
          }
        }
      }
    }

    return options;
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12" id="settings-screen-container">
      {/* Header Panel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm text-slate-900 dark:text-white" id="settings-header-panel">
        <div>
          <h2 className="text-lg font-bold font-sans tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            Pengaturan Aplikasi & Format Cetak
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Sesuaikan tampilan, ukuran font, nada notifikasi, serta kelola format kop surat cetakan PDF WR & WO perusahaan.
          </p>
        </div>
        <button
          onClick={saveSettings}
          className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
          id="btn-save-settings"
        >
          <Save className="w-4 h-4" />
          Simpan Pengaturan
        </button>
      </div>

      {savedSuccess && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 p-4 rounded-xl text-xs flex items-center gap-2 font-semibold animate-fadeIn" id="settings-success-banner">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
          Pengaturan berhasil disimpan dan diterapkan pada perangkat anda!
        </div>
      )}

      {/* Main Settings Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6" id="settings-main-grid">
        
        {/* Card 1: Tampilan & Font Size */}
        <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="settings-visual-card">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Type className="w-4 h-4 text-indigo-500" />
              Tampilan & Tipografi
            </h3>
          </div>

          {/* Font Size Selector */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Ukuran Font Tampilan
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { value: 'small', label: 'Kecil', desc: '13px' },
                { value: 'medium', label: 'Sedang', desc: '15px' },
                { value: 'large', label: 'Besar', desc: '17px' },
                { value: 'xlarge', label: 'Sangat Besar', desc: '19px' }
              ].map((size) => {
                const isSel = fontSize === size.value;
                return (
                  <button
                    key={size.value}
                    onClick={() => setFontSize(size.value)}
                    className={`p-3 rounded-xl border text-center transition cursor-pointer flex flex-col items-center justify-center ${
                      isSel 
                        ? 'bg-indigo-50 dark:bg-indigo-950/30 border-indigo-500 text-indigo-700 dark:text-indigo-400 font-bold border-2' 
                        : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                    id={`btn-set-fontsize-${size.value}`}
                  >
                    <span className="text-xs">{size.label}</span>
                    <span className="text-[10px] text-slate-400 mt-0.5">{size.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Theme Mode Selector (Light vs Dark) */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Mode Tema Aplikasi (Gelap/Terang)
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setThemeMode('light')}
                className={`p-4 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                  themeMode === 'light'
                    ? 'bg-amber-50/60 dark:bg-slate-900 border-amber-500 text-amber-900 font-bold border-2 shadow-xs'
                    : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
                id="btn-theme-light"
              >
                <span className="flex items-center gap-2 text-xs">
                  <Sun className="w-4 h-4 text-amber-500 animate-spin-slow" />
                  Mode Terang (Light)
                </span>
                {themeMode === 'light' && <Check className="w-4 h-4 text-amber-600" />}
              </button>

              <button
                onClick={() => setThemeMode('dark')}
                className={`p-4 rounded-xl border flex items-center justify-between transition cursor-pointer ${
                  themeMode === 'dark'
                    ? 'bg-indigo-950/40 dark:bg-slate-900 border-indigo-500 text-indigo-300 font-bold border-2 shadow-xs'
                    : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                }`}
                id="btn-theme-dark"
              >
                <span className="flex items-center gap-2 text-xs">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  Mode Gelap (Dark)
                </span>
                {themeMode === 'dark' && <Check className="w-4 h-4 text-indigo-400" />}
              </button>
            </div>
          </div>

        </div>

        {/* Card 2: Sounds & Vibration */}
        <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="settings-sound-card">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
              <Volume2 className="w-4 h-4 text-indigo-500" />
              Suara & Getar Notifikasi
            </h3>
          </div>

          {/* Nada Suara Notifikasi */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Nada Notifikasi Sistem
            </label>
            <div className="space-y-2">
              {[
                { value: 'chime', label: 'High Chime (Default)', icon: <Volume2 className="w-4 h-4 text-indigo-600" /> },
                { value: 'bell', label: 'Classic Bell Ring', icon: <Volume2 className="w-4 h-4 text-emerald-600" /> },
                { value: 'standard', label: 'Standard Beep Short', icon: <Volume2 className="w-4 h-4 text-blue-600" /> },
                { value: 'silent', label: 'Senyap (Silent)', icon: <VolumeX className="w-4 h-4 text-slate-400" /> }
              ].map((sound) => {
                const isSel = notifSound === sound.value;
                return (
                  <div
                    key={sound.value}
                    onClick={() => setNotifSound(sound.value)}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                      isSel 
                        ? 'bg-indigo-50/50 dark:bg-indigo-950/20 border-indigo-500 text-indigo-800 dark:text-indigo-300 font-bold border-2' 
                        : 'bg-slate-50/50 dark:bg-slate-900/40 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                    id={`sound-option-${sound.value}`}
                  >
                    <span className="flex items-center gap-2.5 text-xs">
                      {sound.icon}
                      {sound.label}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {sound.value !== 'silent' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            playSoundPreview(sound.value);
                          }}
                          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-850 rounded text-slate-500 hover:text-indigo-600"
                        >
                          <Play className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {isSel && <Check className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Getar Notifikasi */}
          <div className="space-y-3 pt-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
              Getar Notifikasi Perangkat
            </label>
            <div className="flex items-center justify-between p-4 bg-slate-50/50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-indigo-500" id="vibration-icon" />
                <div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">Status Getaran Perangkat</span>
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 block mt-0.5">Aktifkan pola getar pada handphone/tablet</span>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={notifVibrate}
                  onChange={(e) => {
                    setNotifVibrate(e.target.checked);
                    if (e.target.checked) {
                      handleVibratePreview();
                    }
                  }}
                  className="sr-only peer"
                  id="checkbox-vibrate"
                />
                <div className="w-9 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
              </label>
            </div>
          </div>

        </div>

      </div>

      {currentUser.role === 'admin' && (
        <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="settings-tab-order-card">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-3 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Settings className="w-4 h-4 text-indigo-500" />
                Urutan Menu Navigasi (Administrator Only)
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                Atur urutan menu dari atas ke bawah untuk semua pengguna dengan tombol Naik/Turun di bawah ini.
              </p>
            </div>
            <button
              onClick={handleSaveTabOrder}
              disabled={savingTabOrder}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-350 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              {savingTabOrder ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Simpan Urutan Navigasi
            </button>
          </div>

          {tabOrderSaved && (
            <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 p-3.5 rounded-xl text-xs flex items-center gap-2 font-semibold animate-fadeIn">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Urutan menu navigasi berhasil disimpan dan diterapkan secara global!
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" id="tab-ordering-list">
            {tabOrder.map((id, index) => {
              const info = TAB_INFO[id] || { label: id, icon: 'Settings' };
              
              let IconComponent = Settings;
              if (id === 'dashboard') IconComponent = LayoutDashboard;
              else if (id === 'wo') IconComponent = Wrench;
              else if (id === 'assets') IconComponent = Activity;
              else if (id === 'inventory') IconComponent = Package;
              else if (id === 'reports') IconComponent = BarChart3;
              else if (id === 'wr') IconComponent = FileText;
              else if (id === 'pp') IconComponent = Package;
              else if (id === 'pm') IconComponent = ShieldCheck;
              else if (id === 'projects') IconComponent = Briefcase;
              else if (id === 'kelistrikan') IconComponent = Zap;
              else if (id === 'forum') IconComponent = MessageSquare;
              else if (id === 'users') IconComponent = Users;
              else if (id === 'companies') IconComponent = Building;
              else if (id === 'settings') IconComponent = Settings;

              return (
                <div 
                  key={id} 
                  className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl hover:border-indigo-300 dark:hover:border-indigo-800 transition"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-[10px] font-black text-slate-400 font-mono w-5">
                      #{index + 1}
                    </span>
                    <div className="p-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-650 dark:text-slate-400">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 block">
                        {info.label}
                      </span>
                      <span className="text-[9px] text-slate-400 font-mono uppercase">
                        id: {id}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleMoveTab(index, 'up')}
                      disabled={index === 0}
                      className="p-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Pindahkan ke atas"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveTab(index, 'down')}
                      disabled={index === tabOrder.length - 1}
                      className="p-1.5 bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 hover:text-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                      title="Pindahkan ke bawah"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------------------------------------- */}
      {/* SECTION 2: PRINT TEMPLATE SETTINGS (WR & WO FORMAT) */}
      {/* ------------------------------------------------------------------------------------------------- */}
      {canEditFormats && (
        <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="settings-format-card">
          
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                Format Cetak Surat Perusahaan (Kop WR & WO)
              </h3>
              <p className="text-[11px] text-slate-500 mt-1">
                Kustomisasi teks kop surat, alamat, logo, judul berkas, nomor dokumen, dan label tanda tangan pada file PDF.
              </p>
            </div>
            
            {/* Download/Upload Format Template Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => handleDownloadFormatJson(activeFormatTab)}
                className="bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-300 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer border border-slate-200 dark:border-slate-700"
                title="Unduh file format mentah JSON"
              >
                <Download className="w-3.5 h-3.5" /> Unduh Format JSON
              </button>
              
              <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-extrabold px-3 py-2 rounded-lg flex items-center gap-1 cursor-pointer border border-indigo-100">
                <Upload className="w-3.5 h-3.5" /> Unggah Format JSON
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={(e) => handleFormatJsonUpload(e, activeFormatTab)}
                />
              </label>
            </div>
          </div>

          {/* Error & Success Banner */}
          {formatError && (
            <div className="p-3.5 bg-rose-50 text-rose-800 rounded-xl text-xs border border-rose-200 font-medium">
              ⚠️ {formatError}
            </div>
          )}

          {formatSavedSuccess && (
            <div className="p-3.5 bg-emerald-50 text-emerald-800 rounded-xl text-xs border border-emerald-200 font-bold flex items-center gap-1.5 animate-fadeIn">
              <Check className="w-4 h-4 text-emerald-600" /> Format Cetak berhasil disimpan ke Cloud database dan berlaku seketika!
            </div>
          )}

          {/* Entity Selection Row (For permission-aware configuration of branches or parent companies) */}
          {getEntityOptions().length > 1 ? (
            <div className="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2" id="settings-entity-select-row">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wide">
                Pilih Entitas / Cabang Yang Diubah
              </label>
              <select
                value={selectedEntityKey}
                onChange={(e) => setSelectedEntityKey(e.target.value)}
                className="w-full bg-white dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-bold"
                id="select-configured-entity"
              >
                {getEntityOptions().map(opt => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
            </div>
          ) : (
            getEntityOptions().length === 1 && (
              <div className="bg-slate-50 dark:bg-slate-900/30 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between" id="settings-single-entity-info">
                <span className="text-xs text-slate-500">Mengkustomisasi format cetak untuk:</span>
                <span className="text-xs font-black text-indigo-700 uppercase bg-indigo-50 px-2.5 py-1 rounded-md border border-indigo-100">
                  {getEntityOptions()[0].label}
                </span>
              </div>
            )
          )}

          {/* WR / WO / PP Format Tab Switcher */}
          <div className="flex border-b border-slate-100 dark:border-slate-800" id="settings-print-tabs">
            <button
              type="button"
              onClick={() => setActiveFormatTab('wr')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                activeFormatTab === 'wr' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              id="tab-format-wr"
            >
              Format Work Request (WR)
            </button>
            <button
              type="button"
              onClick={() => setActiveFormatTab('wo')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                activeFormatTab === 'wo' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              id="tab-format-wo"
            >
              Format Work Order (WO)
            </button>
            <button
              type="button"
              onClick={() => setActiveFormatTab('pp')}
              className={`pb-2.5 px-4 text-xs font-bold transition-all relative ${
                activeFormatTab === 'pp' 
                  ? 'text-indigo-600 dark:text-indigo-400 border-b-2 border-indigo-600 font-extrabold' 
                  : 'text-slate-400 hover:text-slate-600'
              }`}
              id="tab-format-pp"
            >
              Format Permintaan Barang (PP)
            </button>
          </div>

          {/* ACTIVE TAB: WORK REQUEST FORMAT FORM */}
          {activeFormatTab === 'wr' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              
              {/* Left Column Fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Nama Perusahaan di Kop
                  </label>
                  <input
                    type="text"
                    value={wrCompanyName}
                    onChange={(e) => setWrCompanyName(e.target.value)}
                    placeholder="Contoh: PT DUNIA KIMIA JAYA CABANG GRESIK"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 1
                  </label>
                  <input
                    type="text"
                    value={wrAddressLine1}
                    onChange={(e) => setWrAddressLine1(e.target.value)}
                    placeholder="Contoh: Jl. Raya Sukomulyo KM.24, Manyar"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 2 (Telepon / Fax)
                  </label>
                  <input
                    type="text"
                    value={wrAddressLine2}
                    onChange={(e) => setWrAddressLine2(e.target.value)}
                    placeholder="Contoh: Gresik - 61151, Telp. (031) 3958686"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Judul Dokumen (Header)
                  </label>
                  <input
                    type="text"
                    value={wrDocumentTitle}
                    onChange={(e) => setWrDocumentTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan Kiri (Label)
                    </label>
                    <input
                      type="text"
                      value={wrSignature1}
                      onChange={(e) => setWrSignature1(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan Kanan (Label)
                    </label>
                    <input
                      type="text"
                      value={wrSignature2}
                      onChange={(e) => setWrSignature2(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Kode Dokumen Surat (Footer)
                  </label>
                  <input
                    type="text"
                    value={wrDocumentCode}
                    onChange={(e) => setWrDocumentCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Upload Logo File */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Upload Logo Kop Surat Perusahaan
                  </label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 border border-slate-300 dark:border-slate-700 bg-white rounded flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {wrLogoUrl ? (
                        <img src={wrLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> Pilih Foto Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, 'wr')}
                        />
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1">Saran format: PNG/JPG transparan persegi, maks. 800 KB.</p>
                    </div>
                    {wrLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setWrLogoUrl('')}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : activeFormatTab === 'wo' ? (
            /* ACTIVE TAB: WORK ORDER FORMAT FORM */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              
              {/* Left Column Fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Nama Perusahaan di Kop WO
                  </label>
                  <input
                    type="text"
                    value={woCompanyName}
                    onChange={(e) => setWoCompanyName(e.target.value)}
                    placeholder="Contoh: PT DUNIA KIMIA JAYA CABANG GRESIK"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 1
                  </label>
                  <input
                    type="text"
                    value={woAddressLine1}
                    onChange={(e) => setWoAddressLine1(e.target.value)}
                    placeholder="Contoh: Jl. Raya Sukomulyo KM.24, Manyar"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 2 (Telepon / Fax)
                  </label>
                  <input
                    type="text"
                    value={woAddressLine2}
                    onChange={(e) => setWoAddressLine2(e.target.value)}
                    placeholder="Contoh: Gresik - 61151, Telp. (031) 3958686"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Judul Dokumen (Header WO)
                  </label>
                  <input
                    type="text"
                    value={woDocumentTitle}
                    onChange={(e) => setWoDocumentTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan 1 (Dibuat)
                    </label>
                    <input
                      type="text"
                      value={woSignature1}
                      onChange={(e) => setWoSignature1(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan 2 (Pelaksana)
                    </label>
                    <input
                      type="text"
                      value={woSignature2}
                      onChange={(e) => setWoSignature2(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan 3 (Setuju)
                    </label>
                    <input
                      type="text"
                      value={woSignature3}
                      onChange={(e) => setWoSignature3(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Kode Dokumen Surat WO (Footer)
                  </label>
                  <input
                    type="text"
                    value={woDocumentCode}
                    onChange={(e) => setWoDocumentCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Upload Logo File */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Upload Logo Kop Surat Perusahaan WO
                  </label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 border border-slate-300 dark:border-slate-700 bg-white rounded flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {woLogoUrl ? (
                        <img src={woLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> Pilih Foto Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, 'wo')}
                        />
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1">Saran format: PNG/JPG transparan persegi, maks. 800 KB.</p>
                    </div>
                    {woLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setWoLogoUrl('')}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          ) : (
            /* ACTIVE TAB: GOODS REQUEST (PP) FORMAT FORM */
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2" id="pp-format-form">
              
              {/* Left Column Fields */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Nama Perusahaan di Kop PP
                  </label>
                  <input
                    type="text"
                    value={ppCompanyName}
                    onChange={(e) => setPpCompanyName(e.target.value)}
                    placeholder="Contoh: PT DUNIA KIMIA JAYA CABANG GRESIK"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 1
                  </label>
                  <input
                    type="text"
                    value={ppAddressLine1}
                    onChange={(e) => setPpAddressLine1(e.target.value)}
                    placeholder="Contoh: Jl. Raya Sukomulyo KM.24, Manyar"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Alamat Perusahaan Baris 2 (Telepon / Fax)
                  </label>
                  <input
                    type="text"
                    value={ppAddressLine2}
                    onChange={(e) => setPpAddressLine2(e.target.value)}
                    placeholder="Contoh: Gresik - 61151, Telp. (031) 3958686"
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Judul Dokumen (Header PP)
                  </label>
                  <input
                    type="text"
                    value={ppDocumentTitle}
                    onChange={(e) => setPpDocumentTitle(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>
              </div>

              {/* Right Column Fields */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan 1 (Diajukan)
                    </label>
                    <input
                      type="text"
                      value={ppSignature1}
                      onChange={(e) => setPpSignature1(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                      Tanda Tangan 2 (Disetujui)
                    </label>
                    <input
                      type="text"
                      value={ppSignature2}
                      onChange={(e) => setPpSignature2(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Kode Dokumen Surat PP (Footer)
                  </label>
                  <input
                    type="text"
                    value={ppDocumentCode}
                    onChange={(e) => setPpDocumentCode(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg p-2.5 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:bg-white"
                  />
                </div>

                {/* Upload Logo File */}
                <div className="space-y-2">
                  <label className="block text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                    Upload Logo Kop Surat Perusahaan PP
                  </label>
                  <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                    <div className="w-12 h-12 border border-slate-300 dark:border-slate-700 bg-white rounded flex items-center justify-center p-1 overflow-hidden shrink-0">
                      {ppLogoUrl ? (
                        <img src={ppLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-slate-300" />
                      )}
                    </div>
                    <div className="flex-1">
                      <label className="bg-white dark:bg-slate-800 hover:bg-slate-100 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-md cursor-pointer inline-flex items-center gap-1.5">
                        <Upload className="w-3.5 h-3.5" /> Pilih Foto Logo
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLogoUpload(e, 'pp')}
                        />
                      </label>
                      <p className="text-[9px] text-slate-400 mt-1">Saran format: PNG/JPG transparan persegi, maks. 800 KB.</p>
                    </div>
                    {ppLogoUrl && (
                      <button
                        type="button"
                        onClick={() => setPpLogoUrl('')}
                        className="p-1 text-rose-500 hover:bg-rose-50 rounded"
                        title="Hapus Logo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Form Actions footer */}
          <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
            <button
              type="button"
              onClick={handleResetFormats}
              className="bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-rose-600 text-xs font-bold px-4 py-2.5 rounded-lg flex items-center gap-1 transition cursor-pointer"
            >
              <RefreshCw className="w-4 h-4 animate-spin-slow" /> Reset ke Default
            </button>

            <button
              type="button"
              onClick={saveCompanyFormats}
              disabled={savingFormat}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-5 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              {savingFormat ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Menyimpan...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Simpan Format Cetak
                </>
              )}
            </button>
          </div>

        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50/50 dark:bg-slate-900/30 border border-blue-150 dark:border-slate-800 p-5 rounded-2xl flex gap-3.5" id="settings-info-card">
        <HelpCircle className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h4 className="text-xs font-bold text-blue-900 dark:text-blue-300">Bagaimana pengaturan ini disimpan?</h4>
          <p className="text-[11px] text-blue-800 dark:text-blue-400 leading-relaxed">
            Pengaturan ukuran font, tema, dan suara notifikasi disimpan secara lokal pada peramban web anda. Pengaturan Kop Format Cetak WR/WO disimpan langsung di Cloud database Firestore, sehingga akan berlaku secara universal untuk semua pengguna lain saat mereka mencetak dokumen WR/WO.
          </p>
        </div>
      </div>

    </div>
  );
}
