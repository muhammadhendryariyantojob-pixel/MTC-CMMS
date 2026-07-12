import React, { useState, useEffect } from 'react';
import { InventoryItem, UserProfile } from '../types';
import { db } from '../firebase';
import { doc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { hasPermission } from '../utils';
import ConfirmModal from './ConfirmModal';
import { 
  Package, 
  Search, 
  Plus, 
  Layers, 
  MapPin, 
  DollarSign, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingDown, 
  Trash2, 
  Edit3, 
  X,
  PlusCircle,
  MinusCircle,
  History
} from 'lucide-react';
import InventoryHistoryModal from './InventoryHistoryModal';

interface InventoryScreenProps {
  inventory: InventoryItem[];
  currentUser: UserProfile;
}

export default function InventoryScreen({ inventory, currentUser }: InventoryScreenProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [lowStockOnly, setLowStockOnly] = useState(false);
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<Partial<InventoryItem> | null>(null);

  const canAdjustStock = hasPermission(currentUser, 'canAdjustInventory');

  const [newItem, setNewItem] = useState<Partial<InventoryItem>>({
    code: '',
    name: '',
    stock: 10,
    minStock: 5,
    unit: 'Pcs',
    location: '',
    price: 0,
    category: 'Mechanical'
  });

  const [dialogConfig, setDialogConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'warning' | 'info';
    alertOnly?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const categories = ['Mechanical', 'Electrical', 'Pneumatic', 'Consumables', 'HSE', 'Tools'];

  const userCompanyId = currentUser.companyId || 'default';
  const userBranchId = currentUser.cabangId || 'pusat';

  const handleAddInventory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.code || !newItem.name || !newItem.location) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon lengkapi seluruh field wajib!',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const itemId = `inv_${Date.now()}`;
    const itemData: InventoryItem = {
      id: itemId,
      code: newItem.code.toUpperCase(),
      name: newItem.name,
      stock: Number(newItem.stock) || 0,
      minStock: Number(newItem.minStock) || 0,
      unit: newItem.unit || 'Pcs',
      location: newItem.location,
      price: Number(newItem.price) || 0,
      category: newItem.category || 'Mechanical',
      companyId: userCompanyId,
      cabangId: userBranchId,
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'inventory', itemId), itemData);
      
      if (itemData.stock > 0) {
        const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, 'inventory_logs', logId), {
          id: logId,
          inventoryId: itemId,
          change: itemData.stock,
          reason: 'Stok Awal',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name
        });
      }

      setIsAddModalOpen(false);
      setNewItem({
        code: '',
        name: '',
        stock: 10,
        minStock: 5,
        unit: 'Pcs',
        location: '',
        price: 0,
        category: 'Mechanical'
      });
    } catch (err) {
      console.error('Error adding inventory item:', err);
      setDialogConfig({
        isOpen: true,
        title: 'Gagal Menyimpan',
        message: 'Gagal menyimpan part. Silakan coba lagi.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'danger',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
    }
  };

  const [isAdjustStockModalOpen, setIsAdjustStockModalOpen] = useState(false);
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<number | ''>('');
  const [adjustType, setAdjustType] = useState<'add' | 'remove'>('add');
  const [adjustReason, setAdjustReason] = useState('Penyesuaian Manual');

  const openAdjustStockModal = (item: InventoryItem, type: 'add' | 'remove') => {
    setAdjustItem(item);
    setAdjustType(type);
    setAdjustAmount(1);
    setAdjustReason(type === 'add' ? 'Penambahan Stok' : 'Pengurangan Stok Manual');
    setIsAdjustStockModalOpen(true);
  };

  const submitAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustItem || typeof adjustAmount !== 'number' || adjustAmount <= 0) return;

    if (!canAdjustStock) {
      alert('Anda tidak memiliki izin untuk menyesuaikan stok.');
      return;
    }

    try {
      const itemRef = doc(db, 'inventory', adjustItem.id);
      const actualChange = adjustType === 'add' ? adjustAmount : -adjustAmount;
      const newStock = Math.max(0, adjustItem.stock + actualChange);
      
      await setDoc(itemRef, { ...adjustItem, stock: newStock }, { merge: true });
      
      const realChange = newStock - adjustItem.stock;
      if (realChange !== 0) {
        const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, 'inventory_logs', logId), {
          id: logId,
          inventoryId: adjustItem.id,
          change: realChange,
          reason: adjustReason || 'Penyesuaian Manual',
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name
        });
      }
      setIsAdjustStockModalOpen(false);
      setAdjustItem(null);
    } catch (err) {
      console.error('Error adjusting stock:', err);
    }
  };

  const handleEditItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeItem || !activeItem.id || !activeItem.name || !activeItem.location) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Belum Lengkap',
        message: 'Mohon lengkapi seluruh field wajib!',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    try {
      const itemRef = doc(db, 'inventory', activeItem.id);
      await setDoc(itemRef, activeItem as InventoryItem, { merge: true });
      setIsEditModalOpen(false);
      setActiveItem(null);
    } catch (err) {
      console.error('Error updating inventory item:', err);
    }
  };

  const handleDeleteItem = (itemId: string) => {
    if (!hasPermission(currentUser, 'canDeleteInventory')) {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Anda tidak memiliki izin untuk menghapus item dari inventaris.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    setDialogConfig({
      isOpen: true,
      title: 'Hapus Suku Cadang',
      message: 'Apakah Anda yakin ingin menghapus item ini dari inventaris secara permanen?',
      confirmLabel: 'Ya, Hapus',
      cancelLabel: 'Batal',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await deleteDoc(doc(db, 'inventory', itemId));
          setDialogConfig(prev => ({ ...prev, isOpen: false }));
        } catch (err) {
          console.error('Error deleting inventory item:', err);
          setDialogConfig({
            isOpen: true,
            title: 'Gagal Menghapus',
            message: 'Terjadi kesalahan saat menghapus item dari database.',
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

  // Filter lists
  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          item.location.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesLowStock = !lowStockOnly || item.stock <= item.minStock;

    return matchesSearch && matchesCategory && matchesLowStock;
  });

  const isItemLowStock = (item: InventoryItem) => item.stock <= item.minStock;

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(value);
  };

  return (
    <div className="space-y-6" id="inventory-screen-container">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl">
            <Package className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Inventaris Sparepart & Material</h2>
            <p className="text-xs text-slate-500">Kelola ketersediaan suku cadang, pelumas, dan consumables pabrik secara akurat</p>
          </div>
        </div>
        
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md"
        >
          <Plus className="w-4 h-4" /> Tambah Suku Cadang
        </button>
      </div>

      {/* Stats Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Total Item Unik</span>
            <p className="text-2xl font-black text-slate-800 font-sans mt-1">{inventory.length}</p>
          </div>
          <div className="p-3 bg-slate-50 text-blue-600 rounded-xl border border-slate-100">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-rose-200 shadow-xs flex items-center justify-between bg-rose-50/20">
          <div>
            <span className="text-[10px] font-bold text-rose-500 uppercase tracking-wider font-mono">Peringatan Stok Rendah</span>
            <p className="text-2xl font-black text-rose-600 font-sans mt-1">{inventory.filter(i => i.stock <= i.minStock).length}</p>
          </div>
          <div className="p-3 bg-rose-100 text-rose-600 rounded-xl border border-rose-200">
            <TrendingDown className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">Nilai Total Aset Gudang</span>
            <p className="text-xl font-black text-slate-800 font-sans mt-1">
              {formatRupiah(inventory.reduce((sum, item) => sum + (item.price * item.stock), 0))}
            </p>
          </div>
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl border border-slate-100">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari kode part, nama, atau rak lokasi..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:outline-none focus:bg-white focus:border-blue-600 transition"
            />
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-center shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-slate-400 shrink-0 font-mono">Kategori:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-600 transition cursor-pointer"
              >
                <option value="all">Semua Kategori</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Checkbox Low Stock */}
            <label className="flex items-center gap-2 select-none cursor-pointer bg-slate-50 hover:bg-slate-100 px-4 py-2 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition">
              <input
                type="checkbox"
                checked={lowStockOnly}
                onChange={(e) => setLowStockOnly(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-slate-700">Hanya Stok Rendah</span>
            </label>
          </div>
        </div>
      </div>

      {/* Spare Parts Grid / Table */}
      {filteredInventory.length === 0 ? (
        <div className="bg-white py-16 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 text-xs">
          Tidak ada suku cadang yang sesuai kriteria pencarian.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredInventory.map(item => {
            const low = isItemLowStock(item);
            return (
              <div 
                key={item.id} 
                className={`bg-white border rounded-2xl p-5 flex flex-col justify-between space-y-4 transition duration-150 shadow-xs hover:shadow-md ${low ? 'border-rose-200 bg-rose-50/5 hover:border-rose-300' : 'border-slate-200 hover:border-slate-300'}`}
              >
                <div className="space-y-3">
                  {/* Code & Category */}
                  <div className="flex justify-between items-start">
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider block">{item.code}</span>
                      <h3 className="text-xs font-black text-slate-900 uppercase leading-tight">{item.name}</h3>
                    </div>
                    <span className="text-[10px] uppercase font-bold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                      {item.category}
                    </span>
                  </div>

                  {/* Stock counter block */}
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Jumlah Stok</span>
                      <p className="text-xl font-black text-slate-800">
                        {item.stock} <span className="text-xs font-bold text-slate-500">{item.unit}</span>
                      </p>
                    </div>
                    
                    <div className="text-right">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block font-mono">Safety Min</span>
                      <p className="text-xs font-bold text-slate-700">
                        {item.minStock} {item.unit}
                      </p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-[11px] text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Lokasi Rak: <strong className="text-slate-800">{item.location}</strong></span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span>Harga Satuan: <strong className="text-slate-800 font-mono">{formatRupiah(item.price)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Stock Controls */}
                <div className="space-y-3 border-t border-slate-100 pt-4">
                  {/* Low warning badge */}
                  {low && (
                    <div className="flex items-center gap-1 text-rose-700 bg-rose-50 border border-rose-100 rounded-lg p-1.5 text-[10px] font-black animate-pulse">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Restock Segera! Kritis di bawah batas minimum
                    </div>
                  )}

                  {/* Stock adjustment actions */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      {canAdjustStock ? (
                        <>
                          <button
                            onClick={() => openAdjustStockModal(item, 'remove')}
                            className="p-1 hover:text-rose-600 hover:bg-slate-100 rounded-lg text-slate-400 transition cursor-pointer"
                            title="Kurangi Stok"
                          >
                            <MinusCircle className="w-5 h-5" />
                          </button>
                          <span className="text-[10px] font-bold text-slate-400 uppercase font-mono">Stok</span>
                          <button
                            onClick={() => openAdjustStockModal(item, 'add')}
                            className="p-1 hover:text-emerald-600 hover:bg-slate-100 rounded-lg text-slate-400 transition cursor-pointer"
                            title="Tambah Stok"
                          >
                            <PlusCircle className="w-5 h-5" />
                          </button>
                        </>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-400 uppercase font-mono px-1">Stok</span>
                      )}
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setIsHistoryModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-slate-50 hover:text-emerald-600 text-slate-400 border border-transparent hover:border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Riwayat Stok"
                      >
                        <History className="w-3.5 h-3.5" /> Riwayat
                      </button>
                      <button
                        onClick={() => {
                          setActiveItem(item);
                          setIsEditModalOpen(true);
                        }}
                        className="p-1.5 hover:bg-slate-50 hover:text-blue-600 text-slate-400 border border-transparent hover:border-slate-200 rounded-xl transition cursor-pointer flex items-center gap-1 text-[10px] font-bold"
                        title="Edit Item"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Edit
                      </button>

                      {hasPermission(currentUser, 'canDeleteInventory') && (
                        <button
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-1.5 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded-xl transition cursor-pointer"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Inventory Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn text-slate-900">
            <div className="flex justify-between items-center bg-blue-600 text-white px-5 py-4 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <Package className="w-4 h-4" />
                Tambah Stok Gudang Baru
              </h3>
              <button 
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-white/85 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddInventory} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kode Part *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. INV-MCH-101"
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Kategori *</label>
                  <select
                    value={newItem.category}
                    onChange={(e) => setNewItem({ ...newItem, category: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:border-blue-600 transition cursor-pointer font-medium"
                  >
                    {categories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nama Item / Suku Cadang *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. O-Ring Hydraulic 24mm"
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Stok Awal *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newItem.stock}
                    onChange={(e) => setNewItem({ ...newItem, stock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Batas Min *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={newItem.minStock}
                    onChange={(e) => setNewItem({ ...newItem, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Satuan *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Pcs, Roll"
                    value={newItem.unit}
                    onChange={(e) => setNewItem({ ...newItem, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Lokasi Rak/Gudang *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Gudang Utama Rak C3"
                    value={newItem.location}
                    onChange={(e) => setNewItem({ ...newItem, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Harga Satuan (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="E.g. 50000"
                    value={newItem.price || ''}
                    onChange={(e) => setNewItem({ ...newItem, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Simpan Part
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Inventory Item Modal */}
      {isEditModalOpen && activeItem && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col max-h-[90vh] animate-fadeIn text-slate-900">
            <div className="flex justify-between items-center bg-blue-600 text-white px-5 py-4 shrink-0">
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                <Edit3 className="w-4 h-4" />
                Ubah Data Suku Cadang
              </h3>
              <button 
                onClick={() => {
                  setIsEditModalOpen(false);
                  setActiveItem(null);
                }}
                className="p-1 text-white/85 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditItemSubmit} className="p-5 space-y-4 flex-1 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Nama Item / Suku Cadang *</label>
                <input
                  type="text"
                  required
                  placeholder="E.g. O-Ring Hydraulic 24mm"
                  value={activeItem.name || ''}
                  onChange={(e) => setActiveItem({ ...activeItem, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Batas Min *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={activeItem.minStock || 0}
                    onChange={(e) => setActiveItem({ ...activeItem, minStock: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Satuan *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Pcs, Roll"
                    value={activeItem.unit || ''}
                    onChange={(e) => setActiveItem({ ...activeItem, unit: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Lokasi Rak/Gudang *</label>
                  <input
                    type="text"
                    required
                    placeholder="E.g. Gudang Utama Rak C3"
                    value={activeItem.location || ''}
                    onChange={(e) => setActiveItem({ ...activeItem, location: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">Harga Satuan (IDR)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="E.g. 50000"
                    value={activeItem.price || ''}
                    onChange={(e) => setActiveItem({ ...activeItem, price: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setActiveItem(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm"
                >
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isHistoryModalOpen && activeItem && (
        <InventoryHistoryModal 
          isOpen={isHistoryModalOpen} 
          onClose={() => {
            setIsHistoryModalOpen(false);
            setActiveItem(null);
          }} 
          item={activeItem as InventoryItem} 
        />
      )}

      {/* Adjust Stock Modal */}
      {isAdjustStockModalOpen && adjustItem && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full border border-slate-200 shadow-xl overflow-hidden flex flex-col animate-fadeIn text-slate-900">
            <div className={`flex justify-between items-center text-white px-5 py-4 shrink-0 ${adjustType === 'add' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
              <h3 className="text-xs font-black uppercase tracking-wider flex items-center gap-2">
                {adjustType === 'add' ? <PlusCircle className="w-4 h-4" /> : <MinusCircle className="w-4 h-4" />}
                {adjustType === 'add' ? 'Tambah Stok' : 'Kurangi Stok'}
              </h3>
              <button 
                onClick={() => {
                  setIsAdjustStockModalOpen(false);
                  setAdjustItem(null);
                }}
                className="p-1 text-white/85 hover:text-white rounded-lg bg-white/10 hover:bg-white/20 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={submitAdjustStock} className="p-5 space-y-4">
              <div className="text-center mb-4">
                <span className="text-[10px] font-bold text-slate-400 font-mono uppercase block">{adjustItem.code}</span>
                <h4 className="text-sm font-black text-slate-800">{adjustItem.name}</h4>
                <p className="text-xs text-slate-500 mt-1">Stok saat ini: <strong className="text-slate-800">{adjustItem.stock} {adjustItem.unit}</strong></p>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">
                  Jumlah {adjustType === 'add' ? 'Ditambah' : 'Dikurangi'} *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    required
                    min="1"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition text-center font-bold"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-400 pt-0.5">{adjustItem.unit}</span>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wide mb-1 font-mono">
                  Keterangan / Alasan
                </label>
                <input
                  type="text"
                  required
                  placeholder={adjustType === 'add' ? 'Barang datang...' : 'Pemakaian...'}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 focus:outline-none focus:bg-white focus:border-blue-600 transition"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsAdjustStockModalOpen(false);
                    setAdjustItem(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 text-white text-xs font-bold rounded-xl transition cursor-pointer shadow-sm ${adjustType === 'add' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}`}
                >
                  Simpan
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
