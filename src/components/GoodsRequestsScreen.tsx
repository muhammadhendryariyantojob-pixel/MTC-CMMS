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

  // Process Modals State
  const [showArrivalModal, setShowArrivalModal] = useState(false);
  const [activeArrivalPP, setActiveArrivalPP] = useState<GoodsRequest | null>(null);
  const [arrivalLokasiInputs, setArrivalLokasiInputs] = useState<Record<number, string>>({});

  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [activeCollectionPP, setActiveCollectionPP] = useState<GoodsRequest | null>(null);
  const [collectionReceiverInputs, setCollectionReceiverInputs] = useState<Record<string, string>>({});
  const [selectedItemIndexes, setSelectedItemIndexes] = useState<number[]>([]);

  // States for Deletion Request modal
  const [showDeleteRequestModal, setShowDeleteRequestModal] = useState(false);
  const [deleteRequestPP, setDeleteRequestPP] = useState<GoodsRequest | null>(null);
  const [alasanPenghapusanInput, setAlasanPenghapusanInput] = useState('');
  const [deleteRequestError, setDeleteRequestError] = useState('');
  const [deleteRequestLoading, setDeleteRequestLoading] = useState(false);

  // Users who can create: Teknisi, Management, Admin
  const canCreatePP = currentUser.role === 'teknisi' || currentUser.role === 'management' || currentUser.role === 'admin';
  
  // Users who can approve: Management, Admin
  const canApprovePP = currentUser.role === 'management' || currentUser.role === 'admin';
  const isAdmin = currentUser.role === 'admin';

  
  const handleAddLocalItem = () => {
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

    const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
    
    if (selectedInventoryId) {
      const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
      if (selectedInventory && finalJumlah > selectedInventory.stock) {
        setDialogConfig({
          isOpen: true,
          title: 'Stok Tidak Mencukupi',
          message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}).`,
          confirmLabel: 'Mengerti',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    const newItem: GoodsRequestItem = {
      namaBarang: namaBarang.trim(),
      jumlah: finalJumlah,
      satuan,
      kegunaan: kegunaan.trim(),
      referensiLink: refLink.trim() || '',
      referensiFotoUrl: refFotoUrl || '',
      ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
    };

    setLocalItems([...localItems, newItem]);

    setNamaBarang('');
    setJumlah(1);
    setSatuan('Pcs');
    setKegunaan('');
    setRefLink('');
    setRefFotoUrl('');
    setSelectedInventoryId(undefined);
  };

  const handleRemoveLocalItem = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    let itemsToSubmit = [...localItems];

    if (namaBarang.trim()) {
      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      if (!kegunaan.trim()) {
        setDialogConfig({
          isOpen: true,
          title: 'Formulir Tidak Valid',
          message: 'Mohon isi kegunaan untuk barang yang sedang diketik.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      if (selectedInventoryId) {
        const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
        if (selectedInventory && finalJumlah > selectedInventory.stock) {
          setDialogConfig({
            isOpen: true,
            title: 'Stok Tidak Mencukupi',
            message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}).`,
            confirmLabel: 'Mengerti',
            alertOnly: true,
            variant: 'warning',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
          return;
        }
      }
      
      const newItem: GoodsRequestItem = {
        namaBarang: namaBarang.trim(),
        jumlah: finalJumlah,
        satuan,
        kegunaan: kegunaan.trim(),
        referensiLink: refLink.trim() || '',
        referensiFotoUrl: refFotoUrl || '',
        ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
      };
      itemsToSubmit.push(newItem);
    }

    if (itemsToSubmit.length === 0) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Kosong',
        message: 'Mohon isi atau tambahkan setidaknya 1 item barang.',
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

      const firstItem = itemsToSubmit[0];

      const newPP: GoodsRequest = {
        id: safePpId,
        nomorPP: ppId,
        namaBarang: firstItem.namaBarang,
        jumlah: firstItem.jumlah,
        satuan: firstItem.satuan,
        kegunaan: firstItem.kegunaan,
        itemsList: itemsToSubmit,
        diajukanOleh: currentUser.name || 'Unknown',
        divisiPengaju: currentUser.division || 'MTC',
        tanggalPengajuan: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
        companyId: currentUser.companyId || 'default',
        cabangId: currentUser.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'goods_requests', safePpId), newPP);

      // Decrement inventory stock for each item that comes from inventory
      for (const item of itemsToSubmit) {
        if (item.inventoryId) {
          await updateDoc(doc(db, 'inventory', item.inventoryId), {
            stock: increment(-item.jumlah)
          });
          
          const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
          await setDoc(doc(db, 'inventory_logs', logId), {
            id: logId,
            inventoryId: item.inventoryId,
            ppId: ppId,
            change: -item.jumlah,
            reason: `Permintaan Barang (PP): ${ppId}`,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.name
          });
        }
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

  const submitArrival = async () => {
    if (!activeArrivalPP) return;
    try {
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const updates: any = {};
      
      const itemsList = activeArrivalPP.itemsList || [{
        namaBarang: activeArrivalPP.namaBarang,
        jumlah: activeArrivalPP.jumlah,
        satuan: activeArrivalPP.satuan,
        kegunaan: activeArrivalPP.kegunaan
      }];
      
      const updatedItems = [...itemsList];
      
      // Mark selected items as arrived
      selectedItemIndexes.forEach(idx => {
        if (!updatedItems[idx].arrivedAt) {
          updatedItems[idx].arrivedAt = nowStr;
          updatedItems[idx].arrivedOleh = currentUser.name;
        }
      });
      
      updates.itemsList = updatedItems;
      
      // Check if all items have arrived
      const allArrived = updatedItems.length > 0 && updatedItems.every(item => item.arrivedAt);
      
      if (allArrived) {
        updates.status = 'telah_datang';
        updates.arrivedAt = nowStr;
        updates.arrivedOleh = currentUser.name;
      }
      
      await updateDoc(doc(db, 'goods_requests', activeArrivalPP.id), updates);
      
      setShowArrivalModal(false);
      setActiveArrivalPP(null);
      setSelectedItemIndexes([]);
      setArrivalLokasiInputs({});
      onRefresh();
    } catch (err) {
      console.error(err);
    }
  };

  const submitCollection = async () => {
    if (!activeCollectionPP) return;
    try {
      const nowStr = new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' });
      const updates: any = {};
      
      const itemsList = activeCollectionPP.itemsList || [{
        namaBarang: activeCollectionPP.namaBarang,
        jumlah: activeCollectionPP.jumlah,
        satuan: activeCollectionPP.satuan,
        kegunaan: activeCollectionPP.kegunaan
      }];
      
      const updatedItems = [...itemsList];
      let hasMissingReceiver = false;
      
      // Mark selected items as collected
      selectedItemIndexes.forEach(idx => {
        if (!updatedItems[idx].collectedAt) {
          if (!collectionReceiverInputs[idx] || !collectionReceiverInputs[idx].trim()) {
            hasMissingReceiver = true;
          } else {
            updatedItems[idx].collectedAt = nowStr;
            updatedItems[idx].collectedOleh = currentUser.name;
            updatedItems[idx].namaPengambil = collectionReceiverInputs[idx].trim();
          }
        }
      });
      
      if (hasMissingReceiver) {
        alert("Mohon isi nama pengambil untuk semua barang yang dipilih.");
        return;
      }
      
      updates.itemsList = updatedItems;
      
      // Check if all items are collected
      const allCollected = updatedItems.length > 0 && updatedItems.every(item => item.collectedAt);
      
      if (allCollected) {
        updates.status = 'selesai_dan_diambil';
        updates.completedAt = nowStr;
        updates.completedOleh = currentUser.name;
        // Keep the first item's receiver as the global one for backward compatibility
        const firstReceiver = collectionReceiverInputs[selectedItemIndexes[0]];
        if (firstReceiver) {
           updates.namaPengambil = firstReceiver.trim();
        }
      }
      
      await updateDoc(doc(db, 'goods_requests', activeCollectionPP.id), updates);
      
      setShowCollectionModal(false);
      setActiveCollectionPP(null);
      setSelectedItemIndexes([]);
      setCollectionReceiverInputs({});
      onRefresh();
    } catch (err) {
      console.error(err);
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

  const handleDeleteClick = (pp: GoodsRequest) => {
    if (isAdmin) {
      handleDelete(pp.id);
    } else {
      if (pp.deletionRequested) {
        setDialogConfig({
          isOpen: true,
          title: 'Pengajuan Sudah Dikirim',
          message: 'Pengajuan penghapusan untuk Permintaan Barang ini telah dikirim sebelumnya dan sedang menunggu persetujuan Administrator Utama.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'info',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      setDeleteRequestPP(pp);
      setAlasanPenghapusanInput('');
      setDeleteRequestError('');
      setShowDeleteRequestModal(true);
    }
  };

  const handleSendDeleteRequest = async () => {
    if (!deleteRequestPP) return;
    if (!alasanPenghapusanInput.trim()) {
      setDeleteRequestError('Silakan masukkan alasan pengajuan penghapusan PP.');
      return;
    }

    setDeleteRequestLoading(true);
    setDeleteRequestError('');
    try {
      await updateDoc(doc(db, 'goods_requests', deleteRequestPP.id), {
        deletionRequested: true,
        alasanPenghapusan: alasanPenghapusanInput.trim(),
        deletionRequestedBy: currentUser.name || currentUser.username,
        deletionRequestedAt: new Date().toISOString()
      });

      setShowDeleteRequestModal(false);
      setDeleteRequestPP(null);
      setAlasanPenghapusanInput('');
      onRefresh();

      setDialogConfig({
        isOpen: true,
        title: 'Pengajuan Terkirim',
        message: 'Pengajuan penghapusan Permintaan Barang berhasil dikirim dan menunggu persetujuan dari Administrator Utama.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    } catch (err) {
      console.error(err);
      setDeleteRequestError('Gagal mengirim pengajuan penghapusan.');
    } finally {
      setDeleteRequestLoading(false);
    }
  };

  const handleRejectDeleteRequest = (pp: GoodsRequest) => {
    setDialogConfig({
      isOpen: true,
      title: 'Tolak Pengajuan Penghapusan',
      message: `Apakah Anda yakin ingin menolak pengajuan penghapusan untuk PP ${pp.nomorPP}? Data PP akan tetap dipertahankan.`,
      confirmLabel: 'Ya, Tolak Pengajuan',
      cancelLabel: 'Batal',
      variant: 'warning',
      onConfirm: async () => {
        setDialogConfig(prev => ({ ...prev, isOpen: false }));
        try {
          await updateDoc(doc(db, 'goods_requests', pp.id), {
            deletionRequested: false,
            alasanPenghapusan: '',
            deletionRequestedBy: '',
            deletionRequestedAt: ''
          });
          onRefresh();
          setDialogConfig({
            isOpen: true,
            title: 'Pengajuan Ditolak',
            message: 'Pengajuan penghapusan berhasil dibatalkan.',
            confirmLabel: 'Tutup',
            alertOnly: true,
            variant: 'info',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
        } catch (err) {
          console.error(err);
          setDialogConfig({
            isOpen: true,
            title: 'Error',
            message: 'Gagal menolak pengajuan penghapusan.',
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
    } else if (statusFilter === 'pemesanan') {
      matchesStatus = pp.status === 'pemesanan';
    } else if (statusFilter === 'telah_datang') {
      matchesStatus = pp.status === 'telah_datang';
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

          <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-5" id="pp-form">
            
            <div className="md:col-span-2 space-y-4">
              <div className="relative">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ShoppingBag className="w-3.5 h-3.5 text-emerald-500" />
                  Nama Barang / Sparepart <span className="text-red-500">*</span>
                </label>
                <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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
                <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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
                  <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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
                <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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

            {/* Tambah item button */}
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={handleAddLocalItem}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Tambah Item ke Daftar
              </button>
            </div>

            {/* List of items */}
            {localItems.length > 0 && (
              <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <List className="w-4 h-4 text-emerald-500" />
                    Daftar Barang ({localItems.length})
                  </h4>
                </div>
                <ul className="divide-y divide-slate-100">
                  {localItems.map((item, idx) => (
                    <li key={idx} className="p-3 flex items-start justify-between hover:bg-slate-50 transition">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase">{item.namaBarang}</span>
                          {item.inventoryId && (
                            <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold tracking-wider whitespace-nowrap">INVENTORY</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          <span className="font-semibold text-emerald-600">{item.jumlah} {item.satuan}</span> • {item.kegunaan}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocalItem(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-md transition"
                        title="Hapus item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info summary */}
            <div className="md:col-span-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p>💡 Tips: Anda bisa menambahkan lebih dari 1 barang dengan klik "Tambah Item ke Daftar". Jika sudah selesai, klik tombol "Kirim Permintaan" untuk memproses.</p>
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
            <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
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
            {['all', 'pending', 'disetujui', 'pemesanan', 'telah_datang', 'selesai', 'ditolak'].map((status) => (
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
                {status === 'all' 
                  ? 'SEMUA' 
                  : status === 'pending' 
                  ? '1. Permintaan' 
                  : status === 'disetujui' 
                  ? '2. Penyetujuan' 
                  : status === 'pemesanan' 
                  ? '3. Proses Pemesanan' 
                  : status === 'telah_datang' 
                  ? '4. Telah Datang' 
                  : status === 'selesai' 
                  ? '5. Selesai' 
                  : 'Ditolak'}
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
                  const hasUncollectedArrivedItems = (pp.itemsList || []).some((item: any) => item.arrivedAt && !item.collectedAt);
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
                          {pp.itemsList && pp.itemsList.length > 1 ? (
                            <span>{pp.namaBarang} <span className="text-slate-500 font-normal ml-1">(+ {pp.itemsList.length - 1} item lainnya)</span></span>
                          ) : (
                            pp.namaBarang
                          )}
                        </button>
                      </td>

                      {/* Quantity */}
                      <td className="px-6 py-4 whitespace-nowrap font-mono text-emerald-600 font-bold">
                        {pp.itemsList && pp.itemsList.length > 1 ? (
                          <span className="text-[10px] bg-emerald-50 px-2 py-0.5 rounded text-emerald-700">Multipel</span>
                        ) : (
                          <>{pp.jumlah} {pp.satuan}</>
                        )}
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
                          {pp.deletionRequested && (
                            <div className="mt-1 bg-amber-50 border border-amber-200 text-amber-900 text-[10px] p-2 rounded-lg space-y-1 max-w-xs">
                              <div className="flex items-center gap-1 font-bold text-amber-800">
                                <AlertTriangle className="w-3 h-3 text-amber-600 shrink-0" />
                                <span>Pengajuan Penghapusan</span>
                              </div>
                              <p className="italic text-slate-700">"{pp.alasanPenghapusan}"</p>
                              <div className="text-[9px] text-slate-500">Oleh: {pp.deletionRequestedBy}</div>
                              {isAdmin && (
                                <div className="flex gap-1 pt-1">
                                  <button
                                    onClick={() => handleDelete(pp.id)}
                                    className="bg-rose-600 hover:bg-rose-500 text-white text-[9px] font-bold px-2 py-0.5 rounded transition flex items-center gap-1 cursor-pointer"
                                  >
                                    <Trash2 className="w-2.5 h-2.5" /> Setujui & Hapus
                                  </button>
                                  <button
                                    onClick={() => handleRejectDeleteRequest(pp)}
                                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[9px] font-bold px-2 py-0.5 rounded transition cursor-pointer"
                                  >
                                    Tolak
                                  </button>
                                </div>
                              )}
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
                              <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
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
                              <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
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
                                    setActiveArrivalPP(pp);
                                    setSelectedItemIndexes([]);
                                    setShowArrivalModal(true);
    setArrivalLokasiInputs({});
                                  }}
                                  className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-2.5 py-1 rounded-md transition flex items-center gap-0.5"
                                >
                                  <MapPin className="w-3 h-3" /> Telah Datang
                                </button>
                              )}

                              {/* Stage 4 Actions */}
                              {(isArrived || hasUncollectedArrivedItems) && (
                                <button
                                  onClick={() => {
                                    setActiveCollectionPP(pp);
                                    setSelectedItemIndexes([]);
                                    setCollectionReceiverInputs({});
                                    setShowCollectionModal(true);
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
                  const hasUncollectedArrivedItems = (pp.itemsList || []).some((item: any) => item.arrivedAt && !item.collectedAt);
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
                        {pp.itemsList && pp.itemsList.length > 1 ? (
                          <span>{pp.namaBarang} <span className="text-slate-500 font-normal ml-1">(+ {pp.itemsList.length - 1} item lainnya)</span></span>
                        ) : (
                          pp.namaBarang
                        )}
                      </button>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-[10px] text-slate-500 font-mono">
                          Kuantitas: <span className="text-emerald-600 font-bold">{pp.itemsList && pp.itemsList.length > 1 ? 'Multipel' : `${pp.jumlah} ${pp.satuan}`}</span>
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

                  {/* Deletion Request Alert Box */}
                  {pp.deletionRequested && (
                    <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-xl space-y-2 text-xs" id={`pp-card-deletion-req-${pp.id}`}>
                      <div className="flex items-center gap-1.5 font-bold text-amber-900">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Pengajuan Penghapusan Menunggu Persetujuan Admin</span>
                      </div>
                      <div className="bg-white/80 p-2.5 rounded-lg border border-amber-200 text-[11px] space-y-1">
                        <span className="text-slate-400 uppercase text-[9px] font-bold block">Alasan Penghapusan:</span>
                        <p className="text-slate-800 italic font-medium">"{pp.alasanPenghapusan}"</p>
                        <span className="text-[9px] text-slate-500 block pt-0.5 border-t border-slate-100">Diajukan oleh: <strong className="text-slate-700">{pp.deletionRequestedBy}</strong></span>
                      </div>
                      {isAdmin && (
                        <div className="flex gap-2 justify-end pt-1">
                          <button
                            type="button"
                            onClick={() => handleDelete(pp.id)}
                            className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg transition flex items-center gap-1 cursor-pointer shadow-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Setujui & Hapus PP
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRejectDeleteRequest(pp)}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-700 text-[10px] font-bold px-3 py-1.5 rounded-lg transition cursor-pointer"
                          >
                            Tolak Pengajuan
                          </button>
                        </div>
                      )}
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
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
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
                    <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
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
                                setActiveArrivalPP(pp);
                                setSelectedItemIndexes([]);
                                setShowArrivalModal(true);
    setArrivalLokasiInputs({});
                              }}
                              className="bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-md transition flex items-center gap-1 cursor-pointer shadow-xs"
                              id={`btn-arrived-pp-${pp.id}`}
                            >
                              <MapPin className="w-3.5 h-3.5" /> Barang Telah Datang
                            </button>
                          )}

                          {/* Stage 4: Completed / Picked up */}
                          {(isArrived || hasUncollectedArrivedItems) && (
                            <button
                              onClick={() => {
                                setActiveCollectionPP(pp);
                                setSelectedItemIndexes([]);
                                setCollectionReceiverInputs({});
                                setShowCollectionModal(true);
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

      {/* Modal Proses Kedatangan */}
      {showArrivalModal && activeArrivalPP && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" />
                Proses Kedatangan Barang
              </h3>
              <button onClick={() => setShowArrivalModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-600 mb-4">
                Pilih barang yang sudah datang:
              </p>
              
              <div className="space-y-2 mb-5">
                {(activeArrivalPP.itemsList || [{
                  namaBarang: activeArrivalPP.namaBarang,
                  jumlah: activeArrivalPP.jumlah,
                  satuan: activeArrivalPP.satuan
                }]).map((item, idx) => {
                  const isAlreadyArrived = !!item.arrivedAt;
                  return (
                    <label 
                      key={idx} 
                      className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${
                        isAlreadyArrived ? 'bg-slate-50 border-slate-200 opacity-70' : 
                        selectedItemIndexes.includes(idx) ? 'bg-rose-50 border-rose-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="pt-0.5">
                        <input
                          type="checkbox"
                          disabled={isAlreadyArrived}
                          checked={isAlreadyArrived || selectedItemIndexes.includes(idx)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItemIndexes([...selectedItemIndexes, idx]);
                            } else {
                              setSelectedItemIndexes(selectedItemIndexes.filter(i => i !== idx));
                            }
                          }}
                          className="w-4 h-4 rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                        />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${isAlreadyArrived ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                          {item.namaBarang}
                        </p>
                        <p className="text-xs text-slate-500 font-mono mt-0.5">
                          {item.jumlah} {item.satuan}
                        </p>
                        {isAlreadyArrived && item.arrivedOleh && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-medium bg-emerald-50 inline-block px-1.5 py-0.5 rounded">
                            Telah tiba (Diterima {item.arrivedOleh}) {item.lokasiBarang ? `di ${item.lokasiBarang}` : ''}
                          </p>
                        )}
                        {!isAlreadyArrived && selectedItemIndexes.includes(idx) && (
                          <div className="mt-2" onClick={(e) => e.preventDefault()}>
                            <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                              type="text"
                              placeholder="Lokasi (Opsional, ex: Rak B3)"
                              value={arrivalLokasiInputs[idx] || ''}
                              onChange={(e) => setArrivalLokasiInputs({...arrivalLokasiInputs, [idx]: e.target.value})}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-white px-2 py-1.5 border border-rose-300 rounded text-xs focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>
            
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowArrivalModal(false)}
                className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 bg-white border border-slate-200 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={submitArrival}
                disabled={selectedItemIndexes.length === 0}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition"
              >
                Simpan Kedatangan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Proses Pengambilan */}
      {showCollectionModal && activeCollectionPP && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-scaleIn">
            <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-500" />
                Proses Pengambilan Barang
              </h3>
              <button onClick={() => setShowCollectionModal(false)} className="text-slate-400 hover:text-slate-600 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 max-h-[60vh] overflow-y-auto">
              <p className="text-sm text-slate-600 mb-4">
                Pilih barang yang akan diambil & catat nama pengambilnya:
              </p>
              
              <div className="space-y-3">
                {(activeCollectionPP.itemsList || [{
                  namaBarang: activeCollectionPP.namaBarang,
                  jumlah: activeCollectionPP.jumlah,
                  satuan: activeCollectionPP.satuan
                }]).map((item: any, idx: number) => {
                  const isAlreadyCollected = !!item.collectedAt;
                  const isItemArrived = !!item.arrivedAt;
                  const canBeCollected = isItemArrived && !isAlreadyCollected;
                  const isSelected = selectedItemIndexes.includes(idx);
                  return (
                    <div 
                      key={idx} 
                      className={`p-3 rounded-lg border transition ${
                        isAlreadyCollected ? 'bg-slate-50 border-slate-200 opacity-70' : 
                        isSelected ? 'bg-emerald-50 border-emerald-200' : 'bg-white border-slate-200'
                      }`}
                    >
                      <label className="flex items-start gap-3 cursor-pointer">
                        <div className="pt-0.5">
                          <input
                            type="checkbox"
                            disabled={!canBeCollected}
                            checked={isAlreadyCollected || isSelected}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedItemIndexes([...selectedItemIndexes, idx]);
                              } else {
                                setSelectedItemIndexes(selectedItemIndexes.filter(i => i !== idx));
                                const newInputs = { ...collectionReceiverInputs };
                                delete newInputs[idx];
                                setCollectionReceiverInputs(newInputs);
                              }
                            }}
                            className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer disabled:cursor-not-allowed"
                          />
                        </div>
                        <div className="flex-1">
                          <p className={`font-semibold text-sm ${isAlreadyCollected ? 'text-slate-500 line-through' : 'text-slate-800'}`}>
                            {item.namaBarang}
                          </p>
                          <p className="text-xs text-slate-500 font-mono mt-0.5 mb-1">
                            {item.jumlah} {item.satuan}
                          </p>
                          {!isAlreadyCollected && !isItemArrived && (
                            <p className="text-[10px] text-amber-600 font-medium bg-amber-100 inline-block px-1.5 py-0.5 rounded mt-1">
                              Belum Datang
                            </p>
                          )}
                          {isAlreadyCollected && item.namaPengambil && (
                            <p className="text-[10px] text-emerald-600 font-medium bg-emerald-100 inline-block px-1.5 py-0.5 rounded">
                              Telah diambil oleh {item.namaPengambil}
                            </p>
                          )}
                        </div>
                      </label>
                      
                      {isSelected && !isAlreadyCollected && (
                        <div className="mt-3 pl-7 animate-fadeIn">
                          <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                            type="text" 
                            placeholder="Nama penerima barang ini..."
                            value={collectionReceiverInputs[idx] || ''}
                            onChange={(e) => setCollectionReceiverInputs({ ...collectionReceiverInputs, [idx]: e.target.value })}
                            className="w-full bg-white px-3 py-1.5 border border-emerald-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {((activeCollectionPP.itemsList || [{}]).filter((item: any) => !item.collectedAt).length === selectedItemIndexes.length && selectedItemIndexes.length > 0) && (
                <p className="text-[10px] text-slate-500 italic mt-4 text-center">Semua item telah diambil, status PP akan otomatis berubah menjadi "Selesai / Diambil".</p>
              )}
            </div>
            
            <div className="px-5 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-2">
              <button
                onClick={() => setShowCollectionModal(false)}
                className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 bg-white border border-slate-200 rounded-lg transition"
              >
                Batal
              </button>
              <button
                onClick={submitCollection}
                disabled={selectedItemIndexes.length === 0}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold rounded-lg transition"
              >
                Simpan Pengambilan
              </button>
            </div>
          </div>
        </div>
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

      {showDeleteRequestModal && deleteRequestPP && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fadeIn" id="delete-pp-request-modal">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full overflow-hidden shadow-2xl animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-150 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-lg border border-amber-200">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-sans font-bold text-slate-900 text-sm">Pengajuan Penghapusan PP</h3>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">{deleteRequestPP.nomorPP}</p>
                </div>
              </div>
              <button
                onClick={() => setShowDeleteRequestModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                disabled={deleteRequestLoading}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed font-medium">
                Penghapusan Permintaan Barang memerlukan persetujuan Administrator Utama. Silakan tuliskan alasan lengkap pengajuan penghapusan untuk diverifikasi oleh Administrator.
              </p>

              {deleteRequestError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-semibold">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deleteRequestError}</span>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Alasan Penghapusan (Wajib):
                </label>
                <textarea
                  rows={3}
                  value={alasanPenghapusanInput}
                  onChange={(e) => setAlasanPenghapusanInput(e.target.value)}
                  placeholder="Tuliskan alasan lengkap mengapa Permintaan Barang ini perlu dihapus..."
                  disabled={deleteRequestLoading}
                  className="block w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-amber-500 focus:bg-white transition text-slate-800 font-medium resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-150 flex justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowDeleteRequestModal(false)}
                className="px-4 py-2 bg-white border border-slate-200 hover:bg-slate-50 text-slate-650 text-xs font-semibold rounded-lg transition cursor-pointer"
                disabled={deleteRequestLoading}
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSendDeleteRequest}
                disabled={deleteRequestLoading || !alasanPenghapusanInput.trim()}
                className="px-5 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-amber-300 text-white text-xs font-bold rounded-lg transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                {deleteRequestLoading ? 'Mengirim...' : 'Kirim Pengajuan'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
