import React, { useState } from 'react';
import { Asset, InventoryItem, WorkOrder, UserProfile } from '../types';
import { 
  BarChart3, 
  FileText, 
  Download, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Percent, 
  Wrench,
  ShieldCheck,
  Calendar,
  Layers,
  Printer,
  X
} from 'lucide-react';

interface ReportsScreenProps {
  orders: WorkOrder[];
  assets: Asset[];
  inventory: InventoryItem[];
  currentUser: UserProfile;
}

export default function ReportsScreen({ orders, assets, inventory, currentUser }: ReportsScreenProps) {
  const [showMonthlyReportModal, setShowMonthlyReportModal] = useState(false);
  
  // Calculate analytics
  const totalWO = orders.length;
  const doneWO = orders.filter(o => o.status === 'selesai').length;
  const activeWO = orders.filter(o => o.status === 'di_kerjakan').length;
  const pendingWO = orders.filter(o => o.status === 'pending').length;

  const woCompletionRate = totalWO > 0 ? Math.round((doneWO / totalWO) * 100) : 0;

  // Asset reliability rate
  const totalAssets = assets.length;
  const runningAssets = assets.filter(a => a.status === 'running').length;
  const assetUptimeRate = totalAssets > 0 ? Math.round((runningAssets / totalAssets) * 100) : 100;

  // Calculate Reactive (Breakdown) Downtime
  const reactiveCompletedWOs = orders.filter(o => o.status === 'selesai' && !(o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM')));
  
  const totalDowntimeHours = reactiveCompletedWOs.reduce((sum, o) => {
    if (!o.createdAt || !o.finishAt) return sum;
    const start = new Date(o.createdAt).getTime();
    const end = new Date(o.finishAt).getTime();
    if (end > start) {
      return sum + (end - start) / (1000 * 60 * 60);
    }
    return sum;
  }, 0);

  const mttrHours = reactiveCompletedWOs.length > 0 ? totalDowntimeHours / reactiveCompletedWOs.length : 0;

  // Breakdown of priorities
  const emergencyWO = orders.filter(o => o.prioritas === 'emergency').length;
  const highWO = orders.filter(o => o.prioritas === 'tinggi').length;
  const mediumWO = orders.filter(o => o.prioritas === 'sedang').length;
  const lowWO = orders.filter(o => o.prioritas === 'rendah').length;

  // Inventory value breakdown
  const totalInventoryValue = inventory.reduce((sum, item) => sum + (item.price * item.stock), 0);
  const lowStockItems = inventory.filter(i => i.stock <= i.minStock).length;

  const formatRupiah = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(value);
  };

  const getPreviousMonthLabel = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    const months = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    return `${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const getPreviousMonthIndexAndYear = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return { month: d.getMonth(), year: d.getFullYear() };
  };

  const handleDownloadCSV = (targetWOs: WorkOrder[], label: string) => {
    const escapeCSV = (val: string) => `"${val.replace(/"/g, '""')}"`;
    const headers = [
      'Nomor WO', 
      'Nomor WR', 
      'Nama Aset', 
      'Jenis Tindakan', 
      'Prioritas', 
      'Uraian Pekerjaan', 
      'Tanggal Masuk', 
      'Tanggal Selesai', 
      'Teknisi', 
      'Suku Cadang', 
      'Qty', 
      'Downtime (Jam)', 
      'Catatan Perbaikan'
    ];
    
    const rows = targetWOs.map(o => {
      const isPM = o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM');
      const typeLabel = isPM ? 'Preventif (PM)' : 'Reaktif (Breakdown)';
      const startStr = o.tanggalWO || o.createdAt ? new Date(o.tanggalWO || o.createdAt).toLocaleDateString('id-ID') : '-';
      const endStr = o.finishAt ? new Date(o.finishAt).toLocaleDateString('id-ID') : '-';
      const downtime = o.createdAt && o.finishAt ? ((new Date(o.finishAt).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1) : '0';
      
      return [
        o.nomorWO,
        o.nomorWR || 'DIRECT',
        o.namaMesin,
        typeLabel,
        o.prioritas || 'sedang',
        o.uraianPekerjaan.replace(/\[PM PREVENTIVE AUTO-GENERATED\]\s*/g, ''),
        startStr,
        endStr,
        o.teknisiDitugaskan.join('; '),
        o.sparePartName || '-',
        o.sparePartQty || 0,
        downtime,
        o.notes || o.technicalNotes || 'Selesai'
      ].map(escapeCSV);
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Laporan_Kinerja_Bulanan_${label.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExport = (type: 'pdf' | 'excel', reportName: string) => {
    if (type === 'excel') {
      const isWarehouse = reportName.toLowerCase().includes('valuasi') || reportName.toLowerCase().includes('suku');
      if (isWarehouse) {
        // Export inventory
        const escapeCSV = (val: string) => `"${val.replace(/"/g, '""')}"`;
        const headers = ['Kode', 'Nama Suku Cadang', 'Stok Saat Ini', 'Batas Minimal', 'Satuan', 'Harga Satuan', 'Total Valuasi'];
        const rows = inventory.map(i => [
          i.code,
          i.name,
          i.stock,
          i.minStock,
          i.unit,
          i.price,
          i.stock * i.price
        ].map(val => escapeCSV(val.toString())));
        const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `${reportName.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Default export completed WOs
      const completed = orders.filter(o => o.status === 'selesai');
      handleDownloadCSV(completed, reportName);
    } else {
      setShowMonthlyReportModal(true);
    }
  };

  return (
    <div className="space-y-6" id="reports-screen-container">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-600 text-white rounded-xl">
            <BarChart3 className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-sm font-black text-slate-800 uppercase tracking-wider">Pusat Analisis & Laporan Operasional</h2>
            <p className="text-xs text-slate-500">Pantau performa pemeliharaan pabrik, rekapitulasi KPI, dan keandalan aset</p>
          </div>
        </div>

        <button
          onClick={() => setShowMonthlyReportModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black px-4 py-3 rounded-xl transition duration-150 flex items-center justify-center gap-2 cursor-pointer shadow-md border border-indigo-700 animate-pulse"
          id="btn-monthly-performance-report-trigger"
        >
          <FileText className="w-4 h-4" />
          Ekspor Laporan Kinerja Bulanan
        </button>
      </div>

      {/* Primary KPI Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* KPI 1: Rate Selesai */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono">WO Completion Rate</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{woCompletionRate}%</p>
            </div>
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-100">
              <Percent className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${woCompletionRate}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-semibold">{doneWO} dari {totalWO} WO terselesaikan</p>
          </div>
        </div>

        {/* KPI 2: Asset Uptime */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono">Keandalan Mesin (Uptime)</span>
              <p className="text-2xl font-black text-slate-800 mt-1">{assetUptimeRate}%</p>
            </div>
            <span className="p-2 bg-blue-50 text-blue-600 rounded-xl border border-blue-100">
              <ShieldCheck className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4">
            <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
              <div className="bg-blue-600 h-full rounded-full" style={{ width: `${assetUptimeRate}%` }}></div>
            </div>
            <p className="text-[10px] text-slate-500 mt-2 font-semibold">{runningAssets} dari {totalAssets} aset berfungsi normal</p>
          </div>
        </div>

        {/* KPI 3: Total Downtime (Reactive WOs) */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black tracking-wider text-rose-500 uppercase font-mono">Total Downtime (Jam)</span>
              <p className="text-2xl font-black text-rose-600 mt-1">{totalDowntimeHours.toFixed(1)} Jam</p>
            </div>
            <span className="p-2 bg-rose-50 text-rose-600 rounded-xl border border-rose-100 animate-pulse">
              <AlertCircle className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 font-semibold">MTTR: <span className="font-extrabold text-slate-800">{mttrHours.toFixed(1)} Jam</span> per kerusakan</p>
          </div>
        </div>

        {/* KPI 4: Inventory Restock Warning */}
        <div className="bg-white p-5 border border-slate-200 rounded-2xl flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[9px] font-black tracking-wider text-amber-500 uppercase font-mono">Critical Low Stock</span>
              <p className="text-2xl font-black text-amber-600 mt-1">{lowStockItems} Items</p>
            </div>
            <span className="p-2 bg-amber-50 text-amber-600 rounded-xl border border-amber-100">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="mt-4 pt-2 border-t border-slate-100">
            <p className="text-[10px] text-slate-500 font-semibold">Perlu restock segera untuk keamanan operasional</p>
          </div>
        </div>
      </div>

      {/* Detailed Analysis Breakdown Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Chart Card 1: Work Order Breakdown */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 lg:col-span-2">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-slate-500" />
            Sebaran Status Perintah Kerja (Work Orders)
          </h3>
          
          <div className="space-y-4 pt-2">
            {/* Selesai */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600 font-semibold">
                <span>SELESAI (Completed)</span>
                <span>{doneWO} ({totalWO > 0 ? Math.round((doneWO / totalWO) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden">
                <div className="bg-emerald-500 h-full rounded-lg" style={{ width: `${totalWO > 0 ? (doneWO / totalWO) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Dikerjakan */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600 font-semibold">
                <span>SEDANG DIKERJAKAN (In Progress)</span>
                <span>{activeWO} ({totalWO > 0 ? Math.round((activeWO / totalWO) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden">
                <div className="bg-blue-600 h-full rounded-lg" style={{ width: `${totalWO > 0 ? (activeWO / totalWO) * 100 : 0}%` }}></div>
              </div>
            </div>

            {/* Pending */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-slate-600 font-semibold">
                <span>PENDING / ANTRIAN (Queue)</span>
                <span>{pendingWO} ({totalWO > 0 ? Math.round((pendingWO / totalWO) * 100) : 0}%)</span>
              </div>
              <div className="w-full bg-slate-100 h-4 rounded-lg overflow-hidden">
                <div className="bg-slate-300 h-full rounded-lg" style={{ width: `${totalWO > 0 ? (pendingWO / totalWO) * 100 : 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Chart Card 2: Priority levels bar graph */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-500" />
            Tingkat Prioritas WO
          </h3>
          
          <div className="flex h-52 items-end justify-between gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {/* Low */}
            <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-bold text-slate-500 font-mono">{lowWO}</span>
              <div 
                className="w-full bg-blue-100 hover:bg-blue-200 rounded-t-md transition-all duration-300" 
                style={{ height: `${totalWO > 0 ? Math.max(10, (lowWO / totalWO) * 100) : 10}%` }}
              ></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Low</span>
            </div>

            {/* Medium */}
            <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-bold text-amber-500 font-mono">{mediumWO}</span>
              <div 
                className="w-full bg-amber-100 hover:bg-amber-200 rounded-t-md transition-all duration-300" 
                style={{ height: `${totalWO > 0 ? Math.max(10, (mediumWO / totalWO) * 100) : 10}%` }}
              ></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Med</span>
            </div>

            {/* High */}
            <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-bold text-red-500 font-mono">{highWO}</span>
              <div 
                className="w-full bg-red-100 hover:bg-red-200 rounded-t-md transition-all duration-300" 
                style={{ height: `${totalWO > 0 ? Math.max(10, (highWO / totalWO) * 100) : 10}%` }}
              ></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">High</span>
            </div>

            {/* Emergency */}
            <div className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
              <span className="text-[10px] font-bold text-rose-600 font-mono">{emergencyWO}</span>
              <div 
                className="w-full bg-rose-600 hover:bg-rose-700 rounded-t-md transition-all duration-300" 
                style={{ height: `${totalWO > 0 ? Math.max(10, (emergencyWO / totalWO) * 100) : 10}%` }}
              ></div>
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block font-mono">Emerg</span>
            </div>
          </div>
        </div>
      </div>

      {/* Laporan Tersedia & Export Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          Daftar Dokumen Laporan Siap Ekspor
        </h3>

        <div className="divide-y divide-slate-100">
          {/* Laporan 1: Pemeliharaan Bulanan */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 mt-0.5">
                <Calendar className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase">Laporan Rekapitulasi Pemeliharaan Bulanan</h4>
                <p className="text-[11px] text-slate-500">Mencakup rekap total WO dikerjakan, rasio penutupan (MTTR), dan grafik breakdown per hari</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf', 'Laporan Pemeliharaan Bulanan')}
                className="px-3 py-2 border border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={() => handleExport('excel', 'Laporan Pemeliharaan Bulanan')}
                className="px-3 py-2 border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>

          {/* Laporan 2: Uptime & Performa Aset */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 mt-0.5">
                <TrendingUp className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase">Laporan Downtime & Keandalan Mesin Utama</h4>
                <p className="text-[11px] text-slate-500">Mencakup durasi kerusakan aset kritikal, analisis downtime pabrik, dan status kelaikan</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf', 'Laporan Downtime & Keandalan Mesin')}
                className="px-3 py-2 border border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={() => handleExport('excel', 'Laporan Downtime & Keandalan Mesin')}
                className="px-3 py-2 border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>

          {/* Laporan 3: Valuasi Gudang */}
          <div className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-slate-50 text-slate-500 rounded-xl border border-slate-100 mt-0.5">
                <Layers className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-xs font-black text-slate-800 uppercase">Laporan Valuasi Suku Cadang & Gudang</h4>
                <p className="text-[11px] text-slate-500">Menghitung valuasi total aset suku cadang saat ini, daftar material stok kritis, dan biaya material terpakai</p>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleExport('pdf', 'Laporan Valuasi Suku Cadang')}
                className="px-3 py-2 border border-slate-200 hover:border-blue-600 hover:bg-blue-50 text-slate-700 hover:text-blue-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> PDF
              </button>
              <button
                onClick={() => handleExport('excel', 'Laporan Valuasi Suku Cadang')}
                className="px-3 py-2 border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50 text-slate-700 hover:text-emerald-700 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" /> Excel
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* LAPORAN KINERJA BULANAN MODAL */}
      {showMonthlyReportModal && (() => {
        const prevMonth = getPreviousMonthIndexAndYear();
        const completedWOsInPrevMonth = orders.filter(o => {
          if (o.status !== 'selesai') return false;
          const dateStr = o.finishAt || o.tanggalWO || o.createdAt;
          if (!dateStr) return false;
          const woDate = new Date(dateStr);
          return woDate.getMonth() === prevMonth.month && woDate.getFullYear() === prevMonth.year;
        });

        const hasPrevMonthData = completedWOsInPrevMonth.length > 0;
        const reportWOs = hasPrevMonthData ? completedWOsInPrevMonth : orders.filter(o => o.status === 'selesai');
        const reportLabel = hasPrevMonthData ? getPreviousMonthLabel() : 'Semua Periode Terkini';

        // Stats
        const totalCompleted = reportWOs.length;
        const totalPM = reportWOs.filter(o => o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM')).length;
        const totalRM = totalCompleted - totalPM;
        const totalDowntime = reportWOs.reduce((sum, o) => {
          const isPM = o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM');
          if (isPM) return sum;
          if (!o.createdAt || !o.finishAt) return sum;
          const start = new Date(o.createdAt).getTime();
          const end = new Date(o.finishAt).getTime();
          if (end > start) return sum + (end - start) / (1000 * 60 * 60);
          return sum;
        }, 0);
        const avgRepairTime = totalRM > 0 ? totalDowntime / totalRM : 0;

        return (
          <div className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm" id="monthly-report-modal-overlay">
            {/* Custom Print Style inside the modal so it only affects during window.print() */}
            <style dangerouslySetInnerHTML={{ __html: `
              @media print {
                body * {
                  visibility: hidden !important;
                }
                #printable-report-area, #printable-report-area * {
                  visibility: visible !important;
                }
                #printable-report-area {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  background: white !important;
                  color: black !important;
                  padding: 20px !important;
                }
                .no-print {
                  display: none !important;
                }
              }
            `}} />

            <div className="bg-white rounded-3xl max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col" id="monthly-report-modal-card">
              {/* Modal Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50 no-print">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Laporan Kinerja Bulanan</h3>
                    <p className="text-xs text-slate-500">Pratinjau, Cetak PDF, atau Unduh format Excel (CSV)</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowMonthlyReportModal(false)}
                  className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-600 rounded-lg transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Printable Report Area */}
              <div className="flex-1 overflow-y-auto p-8 space-y-6" id="printable-report-area">
                {/* Printable Header */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center pb-6 border-b border-slate-200 gap-4">
                  <div>
                    <h1 className="text-xl font-black tracking-tight text-slate-900 uppercase">LAPORAN KINERJA BULANAN PEMELIHARAAN</h1>
                    <p className="text-xs text-slate-500 mt-1 font-mono">INTEGRATED MAINTENANCE & SPARE PARTS SYSTEM</p>
                    <p className="text-xs font-bold text-indigo-600 mt-1.5">Periode Laporan: <span className="uppercase">{reportLabel}</span></p>
                  </div>
                  <div className="text-left md:text-right font-mono text-[10px] text-slate-400 space-y-0.5">
                    <p>Dicetak Oleh: {currentUser.name}</p>
                    <p>Tanggal Cetak: {new Date().toLocaleString('id-ID')}</p>
                    <p>Status Sistem: ONLINE / VERIFIED</p>
                  </div>
                </div>

                {/* KPI Summary Block inside report */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono block">Total Pekerjaan</span>
                    <strong className="text-lg font-black text-slate-800 block mt-1">{totalCompleted} WO</strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">{totalPM} PM / {totalRM} Reaktif</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono block">Total Downtime</span>
                    <strong className="text-lg font-black text-rose-600 block mt-1">{totalDowntime.toFixed(1)} Jam</strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Dari kasus breakdown</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono block">Rata-rata Perbaikan (MTTR)</span>
                    <strong className="text-lg font-black text-slate-800 block mt-1">{avgRepairTime.toFixed(1)} Jam</strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Per kejadian reaktif</span>
                  </div>
                  <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <span className="text-[9px] font-black tracking-wider text-slate-400 uppercase font-mono block">Suku Cadang Terpakai</span>
                    <strong className="text-lg font-black text-emerald-600 block mt-1">
                      {reportWOs.reduce((sum, o) => sum + (o.sparePartQty || 0), 0)} unit
                    </strong>
                    <span className="text-[10px] text-slate-500 mt-0.5 block">Dari {reportWOs.filter(o => o.sparePartName).length} komponen</span>
                  </div>
                </div>

                {/* Detailed Table */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black uppercase text-slate-800 tracking-wider">Daftar Pekerjaan Terselesaikan</h3>
                  
                  {reportWOs.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
                      Tidak ada pekerjaan pemeliharaan yang terselesaikan pada periode ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200 font-mono">
                            <th className="p-3">No. WO</th>
                            <th className="p-3">Mesin / Aset</th>
                            <th className="p-3">Jenis</th>
                            <th className="p-3">Uraian Pekerjaan</th>
                            <th className="p-3 text-center">Downtime</th>
                            <th className="p-3">Suku Cadang</th>
                            <th className="p-3 text-right">Tanggal Selesai</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-150">
                          {reportWOs.map((o) => {
                            const isPM = o.nomorWR?.startsWith('PM-') || o.jenisTindakan === 'perawatan' || o.nomorWO.includes('PM');
                            const downtimeHours = o.createdAt && o.finishAt ? ((new Date(o.finishAt).getTime() - new Date(o.createdAt).getTime()) / (1000 * 60 * 60)).toFixed(1) : '0';
                            
                            return (
                              <tr key={o.id} className="hover:bg-slate-50 transition duration-75">
                                <td className="p-3 font-mono font-bold text-slate-600">{o.nomorWO}</td>
                                <td className="p-3 font-bold text-slate-800">{o.namaMesin}</td>
                                <td className="p-3">
                                  {isPM ? (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 font-bold font-mono">PM</span>
                                  ) : (
                                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-100 font-bold font-mono">REAKSIF</span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-500 max-w-xs truncate" title={o.uraianPekerjaan}>
                                  {o.uraianPekerjaan.replace(/\[PM PREVENTIVE AUTO-GENERATED\]\s*/g, '')}
                                </td>
                                <td className="p-3 text-center font-mono font-bold text-slate-600">
                                  {isPM ? '-' : `${downtimeHours} Jam`}
                                </td>
                                <td className="p-3">
                                  {o.sparePartName ? (
                                    <span className="text-slate-700 font-medium">{o.sparePartName} <strong className="text-indigo-600 font-bold">({o.sparePartQty || 1})</strong></span>
                                  ) : (
                                    <span className="text-slate-400 italic">Tidak ada</span>
                                  )}
                                </td>
                                <td className="p-3 text-right text-slate-500 font-mono">
                                  {o.finishAt ? new Date(o.finishAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Signature/Validation Block */}
                <div className="pt-12 grid grid-cols-2 gap-8 text-center text-xs">
                  <div className="space-y-12">
                    <p className="text-slate-500">Disiapkan Oleh,</p>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800 underline uppercase">{currentUser.name}</p>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">{currentUser.subRole} - {currentUser.division}</p>
                    </div>
                  </div>
                  <div className="space-y-12">
                    <p className="text-slate-500">Disetujui Oleh,</p>
                    <div className="space-y-1">
                      <p className="font-bold text-slate-800">________________________</p>
                      <p className="text-[10px] text-slate-400 uppercase font-mono">Kepala Departemen Pemeliharaan</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer Controls */}
              <div className="p-6 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
                <span className="text-[10px] font-semibold text-slate-400 font-mono">
                  * Format PDF siap dicetak langsung lewat layout browser (Ctrl+P / Command+P).
                </span>
                
                <div className="flex gap-2">
                  <button
                    onClick={() => handleDownloadCSV(reportWOs, reportLabel)}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Download className="w-4 h-4" /> Unduh format Excel (CSV)
                  </button>
                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <Printer className="w-4 h-4" /> Cetak Laporan (PDF)
                  </button>
                  <button
                    onClick={() => setShowMonthlyReportModal(false)}
                    className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
