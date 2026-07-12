import React, { useState, useEffect } from 'react';
import { UserProfile, CompanyBranch, ElectricityReport } from '../types';
import { db } from '../firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { exportToExcelCSV } from '../utils';
import { 
  Zap, 
  Calculator, 
  History, 
  Calendar, 
  DollarSign, 
  FileSpreadsheet, 
  FileText, 
  Trash2, 
  Download, 
  Printer, 
  Plus, 
  Lock, 
  ShieldCheck, 
  Check, 
  AlertCircle, 
  RefreshCcw, 
  Info,
  ChevronRight,
  TrendingUp,
  BarChart4,
  Filter
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { downloadMedianBase64 } from '../utils/medianDownload';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';

interface KelistrikanScreenProps {
  currentUser: UserProfile;
  branches?: CompanyBranch[];
}

export default function KelistrikanScreen({ currentUser, branches = [] }: KelistrikanScreenProps) {
  const isParentCompany = !currentUser.cabangId || currentUser.cabangId === 'pusat';
  const initialFilterCabang = isParentCompany ? 'all' : (currentUser.cabangId || 'pusat');

  const [activeSubTab, setActiveSubTab] = useState<'calculator' | 'history' | 'analytics'>('calculator');
  const [reports, setReports] = useState<ElectricityReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [lastLoadedCabang, setLastLoadedCabang] = useState<string>('');
  const [printReportData, setPrintReportData] = useState<ElectricityReport | null>(null);
  const [printSummaryActive, setPrintSummaryActive] = useState<boolean>(false);

  // Analytics filter state
  const [filterType, setFilterType] = useState<'harian' | 'bulanan' | 'tahunan'>('bulanan');
  const [filterCabang, setFilterCabang] = useState<string>(initialFilterCabang);
  const [filterTahun, setFilterTahun] = useState<string>('all');
  const [filterBulan, setFilterBulan] = useState<string>('all');

  // Form states
  const [tanggalLaporan, setTanggalLaporan] = useState(new Date().toISOString().split('T')[0]);
  const [multiplier, setMultiplier] = useState<number>(800);
  const [tarifLWBP, setTarifLWBP] = useState<number>(1035.78);
  const [tarifWBP, setTarifWBP] = useState<number>(1553.67);
  const [tarifKVArh, setTarifKVArh] = useState<number>(1114.74);
  const [pajakPPJ, setPajakPPJ] = useState<number>(3); // in percent

  // Stand meters awal
  const [standAwalLWBP, setStandAwalLWBP] = useState<string>('');
  const [standAwalWBP, setStandAwalWBP] = useState<string>('');
  const [standAwalKVArh, setStandAwalKVArh] = useState<string>('');

  // Stand meters akhir
  const [standAkhirLWBP, setStandAkhirLWBP] = useState<string>('');
  const [standAkhirWBP, setStandAkhirWBP] = useState<string>('');
  const [standAkhirKVArh, setStandAkhirKVArh] = useState<string>('');

  // Selected branch for the report
  const [selectedCabang, setSelectedCabang] = useState<string>(currentUser.cabangId || 'pusat');

  // Interactive Live Calculation State
  const [liveCalc, setLiveCalc] = useState<any>(null);

  // Dialog / Alert state
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

  const [deleteReportId, setDeleteReportId] = useState<string | null>(null);

  const isAdmin = currentUser.role === 'admin';
  const canManage = currentUser.canManageKelistrikan === true || currentUser.role === 'admin' || currentUser.role === 'management';

  // Sync branch filters when user placement changes or loads
  useEffect(() => {
    if (!isParentCompany) {
      setFilterCabang(currentUser.cabangId || 'pusat');
      setSelectedCabang(currentUser.cabangId || 'pusat');
    }
  }, [currentUser.cabangId, isParentCompany]);

  // Real-time subscribe to Firestore collection 'electricity_reports'
  useEffect(() => {
    const q = query(collection(db, 'electricity_reports'), orderBy('tanggalLaporan', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      const list: ElectricityReport[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as ElectricityReport);
      });
      
      // Filter reports by company for data isolation
      const companyId = currentUser.companyId || 'default';
      let filtered = list.filter(r => (r.companyId || 'default') === companyId);

      // Force filter by user branch if they are not part of parent company (pusat)
      if (!isParentCompany) {
        filtered = filtered.filter(r => r.cabangId === (currentUser.cabangId || 'pusat'));
      }

      setReports(filtered);
      setLoading(false);
    }, (error) => {
      console.error("Firestore loading error: ", error);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser.companyId, currentUser.cabangId, isParentCompany]);

  // Auto-populate stand meter values based on the latest report of the previous month
  useEffect(() => {
    if (reports.length > 0 && selectedCabang && tanggalLaporan) {
      const getFirstDayOfMonth = (dateStr: string): string => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length < 2) return '';
        return `${parts[0]}-${parts[1]}-01`;
      };
      const firstDayOfCurrent = getFirstDayOfMonth(tanggalLaporan);
      
      // Find latest report of the previous month (i.e. date < firstDayOfCurrent)
      let prevMonthReport = reports
        .filter(r => r.cabangId === selectedCabang && r.tanggalLaporan < firstDayOfCurrent)
        .sort((a, b) => b.tanggalLaporan.localeCompare(a.tanggalLaporan))[0];

      // If no report found from previous month, find the absolute latest report before the current date
      if (!prevMonthReport) {
        prevMonthReport = reports
          .filter(r => r.cabangId === selectedCabang && r.tanggalLaporan < tanggalLaporan)
          .sort((a, b) => b.tanggalLaporan.localeCompare(a.tanggalLaporan))[0];
      }

      // If still not found, just use the latest report overall for this cabang
      if (!prevMonthReport) {
        prevMonthReport = reports.find(r => r.cabangId === selectedCabang);
      }

      if (prevMonthReport) {
        // Track unique key to prevent resetting if user is actively editing
        // The key is composed of selectedCabang and the previous month's identifier (YYYY-MM)
        const currentMonthKey = `${selectedCabang}-${tanggalLaporan.substring(0, 7)}`;
        
        if (currentMonthKey !== lastLoadedCabang) {
          setStandAwalLWBP(String(prevMonthReport.standAkhirLWBP ?? prevMonthReport.standAwalLWBP ?? ''));
          setStandAwalWBP(String(prevMonthReport.standAkhirWBP ?? prevMonthReport.standAwalWBP ?? ''));
          setStandAwalKVArh(String(prevMonthReport.standAkhirKVArh ?? prevMonthReport.standAwalKVArh ?? ''));
          
          setStandAkhirLWBP(String(prevMonthReport.standAkhirLWBP ?? ''));
          setStandAkhirWBP(String(prevMonthReport.standAkhirWBP ?? ''));
          setStandAkhirKVArh(String(prevMonthReport.standAkhirKVArh ?? ''));
          
          setLastLoadedCabang(currentMonthKey);
        }
      } else {
        const currentMonthKey = `${selectedCabang}-${tanggalLaporan.substring(0, 7)}`;
        if (currentMonthKey !== lastLoadedCabang) {
          setStandAwalLWBP('');
          setStandAwalWBP('');
          setStandAwalKVArh('');
          setStandAkhirLWBP('');
          setStandAkhirWBP('');
          setStandAkhirKVArh('');
          setLastLoadedCabang(currentMonthKey);
        }
      }
    }
  }, [reports, selectedCabang, tanggalLaporan, lastLoadedCabang]);

  // Recalculate values in real-time when input changes
  useEffect(() => {
    const numAwalLWBP = parseFloat(standAwalLWBP);
    const numAwalWBP = parseFloat(standAwalWBP);
    const numAwalKVArh = parseFloat(standAwalKVArh);
    const numAkhirLWBP = parseFloat(standAkhirLWBP);
    const numAkhirWBP = parseFloat(standAkhirWBP);
    const numAkhirKVArh = parseFloat(standAkhirKVArh);

    if (
      isNaN(numAwalLWBP) || isNaN(numAwalWBP) || isNaN(numAwalKVArh) ||
      isNaN(numAkhirLWBP) || isNaN(numAkhirWBP) || isNaN(numAkhirKVArh)
    ) {
      setLiveCalc(null);
      return;
    }

    // Selisih
    const selisihLWBP = numAkhirLWBP - numAwalLWBP;
    const selisihWBP = numAkhirWBP - numAwalWBP;
    const selisihKVArh = numAkhirKVArh - numAwalKVArh;

    // Pemakaian Aktual (selisih * multiplier)
    const pemakaianLWBP = selisihLWBP * multiplier;
    const pemakaianWBP = selisihWBP * multiplier;
    const pemakaianKVArh = selisihKVArh * multiplier;

    // Total kWh
    const totalKWh = pemakaianLWBP + pemakaianWBP;

    // Batas Toleransi kVArh (62% of Total kWh)
    const batasToleransiKVArh = 0.62 * totalKWh;

    // Kelebihan kVArh (denda jika positif)
    const kelebihanKVArh = Math.max(0, pemakaianKVArh - batasToleransiKVArh);

    // Biaya
    const biayaLWBP = pemakaianLWBP * tarifLWBP;
    const biayaWBP = pemakaianWBP * tarifWBP;
    const biayaDendaKVArh = kelebihanKVArh * tarifKVArh;

    const subtotalBiaya = biayaLWBP + biayaWBP + biayaDendaKVArh;
    const nominalPajak = subtotalBiaya * (pajakPPJ / 100);
    const totalBayar = subtotalBiaya + nominalPajak;

    setLiveCalc({
      selisihLWBP,
      selisihWBP,
      selisihKVArh,
      pemakaianLWBP,
      pemakaianWBP,
      pemakaianKVArh,
      totalKWh,
      batasToleransiKVArh,
      kelebihanKVArh,
      biayaLWBP,
      biayaWBP,
      biayaDendaKVArh,
      subtotalBiaya,
      nominalPajak,
      totalBayar
    });
  }, [
    standAwalLWBP, standAwalWBP, standAwalKVArh,
    standAkhirLWBP, standAkhirWBP, standAkhirKVArh,
    multiplier, tarifLWBP, tarifWBP, tarifKVArh, pajakPPJ
  ]);

  // Handle Save to Database
  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canManage) {
      setDialogConfig({
        isOpen: true,
        title: 'Akses Ditolak',
        message: 'Pengguna Anda tidak memiliki hak akses pengisian laporan listrik.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    if (!tanggalLaporan) {
      alert('Mohon isi Tanggal Laporan.');
      return;
    }

    const numAwalLWBP = parseFloat(standAwalLWBP);
    const numAwalWBP = parseFloat(standAwalWBP);
    const numAwalKVArh = parseFloat(standAwalKVArh);
    const numAkhirLWBP = parseFloat(standAkhirLWBP);
    const numAkhirWBP = parseFloat(standAkhirWBP);
    const numAkhirKVArh = parseFloat(standAkhirKVArh);

    if (
      isNaN(numAwalLWBP) || isNaN(numAwalWBP) || isNaN(numAwalKVArh) ||
      isNaN(numAkhirLWBP) || isNaN(numAkhirWBP) || isNaN(numAkhirKVArh)
    ) {
      setDialogConfig({
        isOpen: true,
        title: 'Input Tidak Valid',
        message: 'Mohon pastikan seluruh stand meter awal dan akhir terisi dengan angka valid.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
      return;
    }

    // Validation: Akhir harus >= Awal
    if (numAkhirLWBP < numAwalLWBP) {
      alert('Stand Akhir LWBP tidak boleh lebih kecil dari Stand Awal LWBP.');
      return;
    }
    if (numAkhirWBP < numAwalWBP) {
      alert('Stand Akhir WBP tidak boleh lebih kecil dari Stand Awal WBP.');
      return;
    }
    if (numAkhirKVArh < numAwalKVArh) {
      alert('Stand Akhir kVArh tidak boleh lebih kecil dari Stand Awal kVArh.');
      return;
    }

    setSubmitting(true);
    const reportId = `ELC-${Date.now()}`;

    // Compute metrics
    const selisihLWBP = numAkhirLWBP - numAwalLWBP;
    const selisihWBP = numAkhirWBP - numAwalWBP;
    const selisihKVArh = numAkhirKVArh - numAwalKVArh;

    const pemakaianLWBP = selisihLWBP * multiplier;
    const pemakaianWBP = selisihWBP * multiplier;
    const pemakaianKVArh = selisihKVArh * multiplier;

    const totalKWh = pemakaianLWBP + pemakaianWBP;
    const batasToleransiKVArh = 0.62 * totalKWh;
    const kelebihanKVArh = Math.max(0, pemakaianKVArh - batasToleransiKVArh);

    const biayaLWBP = pemakaianLWBP * tarifLWBP;
    const biayaWBP = pemakaianWBP * tarifWBP;
    const biayaDendaKVArh = kelebihanKVArh * tarifKVArh;

    const subtotalBiaya = biayaLWBP + biayaWBP + biayaDendaKVArh;
    const nominalPajak = subtotalBiaya * (pajakPPJ / 100);
    const totalBayar = subtotalBiaya + nominalPajak;

    const newReport: ElectricityReport = {
      id: reportId,
      tanggalLaporan,
      multiplier,
      tarifLWBP,
      tarifWBP,
      tarifKVArh,
      pajakPPJ,
      
      standAwalLWBP: numAwalLWBP,
      standAwalWBP: numAwalWBP,
      standAwalKVArh: numAwalKVArh,
      
      standAkhirLWBP: numAkhirLWBP,
      standAkhirWBP: numAkhirWBP,
      standAkhirKVArh: numAkhirKVArh,
      
      selisihLWBP,
      selisihWBP,
      selisihKVArh,
      
      pemakaianLWBP,
      pemakaianWBP,
      pemakaianKVArh,
      
      totalKWh,
      batasToleransiKVArh,
      kelebihanKVArh,
      
      biayaLWBP,
      biayaWBP,
      biayaDendaKVArh,
      subtotalBiaya,
      nominalPajak,
      totalBayar,
      
      createdBy: currentUser.username,
      createdByName: currentUser.name,
      createdAt: new Date().toISOString(),
      companyId: currentUser.companyId || 'default',
      cabangId: selectedCabang
    };

    try {
      await setDoc(doc(db, 'electricity_reports', reportId), newReport);
      
      setSubmitting(false);
      // Keep stand meter awal values as the last typed/saved values so they never disappear or change automatically
      setStandAwalLWBP(String(numAwalLWBP));
      setStandAwalWBP(String(numAwalWBP));
      setStandAwalKVArh(String(numAwalKVArh));
      
      // Keep stand meter akhir values as the last typed/saved values so they never disappear
      setStandAkhirLWBP(String(numAkhirLWBP));
      setStandAkhirWBP(String(numAkhirWBP));
      setStandAkhirKVArh(String(numAkhirKVArh));

      setDialogConfig({
        isOpen: true,
        title: 'Laporan Listrik Berhasil Disimpan',
        message: 'Laporan pemakaian dan denda listrik berhasil disimpan dan dipersist ke Firestore database.',
        confirmLabel: 'Hebat',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
    } catch (err) {
      console.error("Firestore setDoc error: ", err);
      setSubmitting(false);
      alert('Gagal menyimpan data laporan listrik ke database cloud.');
    }
  };

  // Delete a report
  const handleDeleteReport = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'electricity_reports', id));
      setDialogConfig({
        isOpen: true,
        title: 'Berhasil Dihapus',
        message: 'Laporan pemakaian listrik telah berhasil dihapus.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'info',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false })),
      });
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus laporan dari cloud database.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (reports.length === 0) return;
    
    const headers = [
      'ID Laporan', 'Tanggal Laporan', 'Faktor Pengali', 'Cabang', 
      'Stand Awal LWBP', 'Stand Akhir LWBP', 'Selisih LWBP', 'Pemakaian LWBP (kWh)', 
      'Stand Awal WBP', 'Stand Akhir WBP', 'Selisih WBP', 'Pemakaian WBP (kWh)',
      'Stand Awal kVArh', 'Stand Akhir kVArh', 'Selisih kVArh', 'Pemakaian kVArh',
      'Total kWh (LWBP+WBP)', 'Batas Toleransi kVArh', 'Kelebihan kVArh (Denda)',
      'Biaya LWBP (Rp)', 'Biaya WBP (Rp)', 'Denda kVArh (Rp)', 'Subtotal (Rp)', 
      'Pajak PPJ (%)', 'Pajak PPJ (Rp)', 'Total Bayar Akhir (Rp)', 'Petugas Pembuat'
    ];
    
    const keys = [
      'id', 'tanggalLaporan', 'multiplier', 'cabangId',
      'standAwalLWBP', 'standAkhirLWBP', 'selisihLWBP', 'pemakaianLWBP',
      'standAwalWBP', 'standAkhirWBP', 'selisihWBP', 'pemakaianWBP',
      'standAwalKVArh', 'standAkhirKVArh', 'selisihKVArh', 'pemakaianKVArh',
      'totalKWh', 'batasToleransiKVArh', 'kelebihanKVArh',
      'biayaLWBP', 'biayaWBP', 'biayaDendaKVArh', 'subtotalBiaya',
      'pajakPPJ', 'nominalPajak', 'totalBayar', 'createdByName'
    ];
    
    exportToExcelCSV(reports, headers, keys, `Laporan_Pemakaian_Listrik_${Date.now()}`);
  };

  // Helper formatting currencies
  const formatIDR = (value: number) => {
    return new Intl.NumberFormat('id-ID', { 
      style: 'currency', 
      currency: 'IDR', 
      minimumFractionDigits: 3, 
      maximumFractionDigits: 3 
    }).format(value);
  };

  const formatDec = (value: number) => {
    return new Intl.NumberFormat('id-ID', { 
      minimumFractionDigits: 0, 
      maximumFractionDigits: 3 
    }).format(value);
  };

  // Helper formatting for labels in charts
  const formatDateLabel = (dateStr: string, type: 'harian' | 'bulanan' | 'tahunan') => {
    if (type === 'harian') {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[2], 10);
        const month = parseInt(parts[1], 10);
        return `${day}/${month}`; // e.g. "2/7"
      }
      return dateStr;
    } else if (type === 'bulanan') {
      const parts = dateStr.split('-'); // "YYYY-MM"
      if (parts.length === 2) {
        const monthNames: Record<string, string> = {
          '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'Mei', '06': 'Jun',
          '07': 'Jul', '08': 'Agu', '09': 'Sep', '10': 'Okt', '11': 'Nov', '12': 'Des'
        };
        const m = monthNames[parts[1]] || parts[1];
        const y = parts[0].substring(2);
        return `${m}/${y}`; // e.g. "Jul/26"
      }
      return dateStr;
    } else {
      return dateStr; // e.g. "2026"
    }
  };

  // Get unique list of years from reports for dropdown
  const getUniqueYears = () => {
    return Array.from(new Set(reports.map(r => r.tanggalLaporan.split('-')[0]))).sort();
  };

  const monthsList = [
    { value: '01', label: 'Januari' },
    { value: '02', label: 'Februari' },
    { value: '03', label: 'Maret' },
    { value: '04', label: 'April' },
    { value: '05', label: 'Mei' },
    { value: '06', label: 'Juni' },
    { value: '07', label: 'Juli' },
    { value: '08', label: 'Agustus' },
    { value: '09', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' }
  ];

  // Get filtered and aggregated data for charts
  const getChartData = () => {
    let filtered = [...reports];

    // Filter by branch
    if (filterCabang !== 'all') {
      filtered = filtered.filter(r => r.cabangId === filterCabang);
    }
    
    // Filter by year (only if not viewing yearly aggregated trend)
    if (filterTahun !== 'all' && filterType !== 'tahunan') {
      filtered = filtered.filter(r => r.tanggalLaporan.startsWith(filterTahun));
    }
    
    // Filter by month (only if in harian view)
    if (filterBulan !== 'all' && filterType === 'harian') {
      filtered = filtered.filter(r => {
        const parts = r.tanggalLaporan.split('-');
        return parts.length === 3 && parts[1] === filterBulan;
      });
    }

    // Sort chronologically by date
    filtered.sort((a, b) => a.tanggalLaporan.localeCompare(b.tanggalLaporan));

    if (filterType === 'harian') {
      return filtered.map(r => ({
        name: formatDateLabel(r.tanggalLaporan, 'harian'),
        totalBayar: r.totalBayar,
        totalKWh: r.totalKWh,
        actualKvarh: r.pemakaianKVArh,
        originalDate: r.tanggalLaporan,
      }));
    } else if (filterType === 'bulanan') {
      const groups: Record<string, { totalBayar: number; totalKWh: number; actualKvarh: number }> = {};
      filtered.forEach(r => {
        const key = r.tanggalLaporan.substring(0, 7); // "YYYY-MM"
        if (!groups[key]) {
          groups[key] = { totalBayar: 0, totalKWh: 0, actualKvarh: 0 };
        }
        groups[key].totalBayar += r.totalBayar;
        groups[key].totalKWh += r.totalKWh;
        groups[key].actualKvarh += r.pemakaianKVArh;
      });

      return Object.keys(groups).sort().map(key => ({
        name: formatDateLabel(key, 'bulanan'),
        totalBayar: groups[key].totalBayar,
        totalKWh: groups[key].totalKWh,
        actualKvarh: groups[key].actualKvarh,
        originalDate: key,
      }));
    } else {
      const groups: Record<string, { totalBayar: number; totalKWh: number; actualKvarh: number }> = {};
      filtered.forEach(r => {
        const key = r.tanggalLaporan.substring(0, 4); // "YYYY"
        if (!groups[key]) {
          groups[key] = { totalBayar: 0, totalKWh: 0, actualKvarh: 0 };
        }
        groups[key].totalBayar += r.totalBayar;
        groups[key].totalKWh += r.totalKWh;
        groups[key].actualKvarh += r.pemakaianKVArh;
      });

      return Object.keys(groups).sort().map(key => ({
        name: key,
        totalBayar: groups[key].totalBayar,
        totalKWh: groups[key].totalKWh,
        actualKvarh: groups[key].actualKvarh,
        originalDate: key,
      }));
    }
  };

  const chartData = getChartData();

  const getFilteredTableItems = () => {
    let tableItems = [...reports];
    if (filterCabang !== 'all') {
      tableItems = tableItems.filter(r => r.cabangId === filterCabang);
    }
    if (filterTahun !== 'all' && filterType !== 'tahunan') {
      tableItems = tableItems.filter(r => r.tanggalLaporan.startsWith(filterTahun));
    }
    if (filterBulan !== 'all' && filterType === 'harian') {
      tableItems = tableItems.filter(r => {
        const parts = r.tanggalLaporan.split('-');
        return parts.length === 3 && parts[1] === filterBulan;
      });
    }
    tableItems.sort((a, b) => a.tanggalLaporan.localeCompare(b.tanggalLaporan));
    return tableItems;
  };

  // Trigger print view
  const triggerPrint = (report: ElectricityReport) => {
    setPrintReportData(report);
    let timeoutId: any;
    setTimeout(() => {
      try {
        const element = document.getElementById('electricity-printable-report');
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
        const isMedian = /Median/i.test(navigator.userAgent) || 
                         /GoNative/i.test(navigator.userAgent) || 
                         !!(window as any).median ||
                         !!(window as any).gonative;

        if (isMedian && element) {
          // Timeout safeguard: if html2pdf freezes or crashes (e.g. out of memory / html2canvas issue on mobile WebView)
          timeoutId = setTimeout(() => {
            setPrintReportData(null);
            alert('Gagal memproses file (Waktu habis)');
          }, 15000);

          const opt = {
            margin:       10,
            filename:     `laporan-kelistrikan-${report.tanggalLaporan}.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: isMobile ? 1 : 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
          };
          html2pdf()
            .from(element)
            .set(opt)
            .outputPdf('datauristring')
            .then((dataUri: string) => {
              if (timeoutId) clearTimeout(timeoutId);
              try {
                const base64Raw = dataUri.split(',')[1];
                const filename = `laporan-kelistrikan-${report.tanggalLaporan}.pdf`;
                downloadMedianBase64(base64Raw, filename, dataUri);
              } catch (innerErr) {
                console.error(innerErr);
                alert('Gagal memproses PDF, mencoba cetak langsung (fallback)...');
                window.print();
              } finally {
                setPrintReportData(null);
              }
            })
            .catch((err: any) => {
              if (timeoutId) clearTimeout(timeoutId);
              console.error(err);
              alert('Gagal memproses PDF, mencoba cetak langsung (fallback)...');
              window.print();
              setPrintReportData(null);
            });
        } else {
          window.print();
          setTimeout(() => {
            setPrintReportData(null);
          }, 1000);
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(error);
        alert('Terjadi kesalahan, mencoba cetak langsung (fallback)...');
        window.print();
        setPrintReportData(null);
      }
    }, 350);
  };

  const triggerPrintFilteredSummary = () => {
    setPrintSummaryActive(true);
    let timeoutId: any;
    setTimeout(() => {
      try {
        const element = document.getElementById('electricity-printable-summary');
        const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
        const isMedian = /Median/i.test(navigator.userAgent) || 
                         /GoNative/i.test(navigator.userAgent) || 
                         !!(window as any).median ||
                         !!(window as any).gonative;

        if (isMedian && element) {
          // Timeout safeguard: if html2pdf freezes or crashes (e.g. out of memory / html2canvas issue on mobile WebView)
          timeoutId = setTimeout(() => {
            setPrintSummaryActive(false);
            alert('Gagal memproses file (Waktu habis)');
          }, 15000);

          const opt = {
            margin:       10,
            filename:     `ringkasan-laporan-listrik.pdf`,
            image:        { type: 'jpeg' as const, quality: 0.98 },
            html2canvas:  { scale: isMobile ? 1 : 2, useCORS: true, logging: false },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
          };
          html2pdf()
            .from(element)
            .set(opt)
            .outputPdf('datauristring')
            .then((dataUri: string) => {
              if (timeoutId) clearTimeout(timeoutId);
              try {
                const base64Raw = dataUri.split(',')[1];
                const filename = `ringkasan-laporan-listrik.pdf`;
                downloadMedianBase64(base64Raw, filename, dataUri);
              } catch (innerErr) {
                console.error(innerErr);
                alert('Gagal memproses PDF, mencoba cetak langsung (fallback)...');
                window.print();
              } finally {
                setPrintSummaryActive(false);
              }
            })
            .catch((err: any) => {
              if (timeoutId) clearTimeout(timeoutId);
              console.error(err);
              alert('Gagal memproses PDF, mencoba cetak langsung (fallback)...');
              window.print();
              setPrintSummaryActive(false);
            });
        } else {
          window.print();
          setTimeout(() => {
            setPrintSummaryActive(false);
          }, 1000);
        }
      } catch (error) {
        if (timeoutId) clearTimeout(timeoutId);
        console.error(error);
        alert('Terjadi kesalahan, mencoba cetak langsung (fallback)...');
        window.print();
        setPrintSummaryActive(false);
      }
    }, 350);
  };

  return (
    <div className="flex flex-col gap-6" id="kelistrikan-module-root">
      {/* Hide the normal interface during print mode */}
      <div className="print:hidden flex flex-col gap-6">
        
        {/* Module Sub-Header & Navigation */}
        <div className="bg-white dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" id="kelistrikan-sub-nav">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded-xl border border-amber-100 dark:border-amber-900/50">
              <Zap className="w-5 h-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Kelistrikan & Biaya PLN</h2>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">Monitoring pemakaian listrik industri, denda kVArh, & simulasi tagihan</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setActiveSubTab('calculator')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'calculator' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Calculator className="w-3.5 h-3.5" />
              Kalkulator & Input
            </button>
            <button
              onClick={() => setActiveSubTab('history')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'history' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              Riwayat Laporan ({reports.length})
            </button>
            <button
              onClick={() => setActiveSubTab('analytics')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                activeSubTab === 'analytics' 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <BarChart4 className="w-3.5 h-3.5" />
              Tren Pemakaian
            </button>
          </div>
        </div>

        {/* 1. CALCULATOR & INPUT TAB */}
        {activeSubTab === 'calculator' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="calculator-view">
            
            {/* Form Input Section */}
            <div className="lg:col-span-7 flex flex-col gap-6">
              
              <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-5">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-4">
                  <div className="flex items-center gap-2">
                    <Calculator className="w-4.5 h-4.5 text-indigo-500" />
                    <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Input Parameter & Stand Meter</h3>
                  </div>
                  {!canManage && (
                    <span className="flex items-center gap-1 px-2.5 py-1 bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-[9px] font-bold rounded-lg border border-rose-100 dark:border-rose-950/50 uppercase">
                      <Lock className="w-3 h-3" /> Hanya Baca
                    </span>
                  )}
                </div>

                {canManage ? (
                  <form onSubmit={handleSaveReport} className="space-y-5" id="form-kalkulator-listrik">
                    
                    {/* Basic Parameters Row */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-indigo-500" /> Tanggal Laporan
                        </label>
                        <input
                          type="date"
                          required
                          value={tanggalLaporan}
                          onChange={(e) => setTanggalLaporan(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                          Multiplier (CT PT)
                        </label>
                        <input
                          type="number"
                          required
                          value={multiplier}
                          onChange={(e) => setMultiplier(Math.max(1, parseInt(e.target.value) || 0))}
                          className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition"
                        />
                      </div>

                      {/* Branch Selection for HQ managers */}
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Cabang / Lokasi Kerja
                        </label>
                        <select
                          value={selectedCabang}
                          onChange={(e) => setSelectedCabang(e.target.value)}
                          disabled={!isParentCompany}
                          className={`w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 transition ${!isParentCompany ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-850' : ''}`}
                        >
                          {isParentCompany ? (
                            <>
                              <option value="pusat">Kantor Pusat</option>
                              {branches.map(b => (
                                <option key={b.id} value={b.id}>{b.name}</option>
                              ))}
                            </>
                          ) : (
                            <option value={currentUser.cabangId || 'pusat'}>
                              {currentUser.cabangId === 'pusat' || !currentUser.cabangId 
                                ? 'Kantor Pusat' 
                                : (branches.find(b => b.id === currentUser.cabangId)?.name || 'Cabang Saya')}
                            </option>
                          )}
                        </select>
                      </div>

                    </div>

                    {/* Tarif Settings Row */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-slate-800/80 space-y-3">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1.5">
                        Daftar Tarif & Pajak Listrik Industri (Bisa Dikustomisasi)
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block">Tarif LWBP (Rp/kWh)</span>
                          <input
                            type="number"
                            step="0.01"
                            value={tarifLWBP}
                            onChange={(e) => setTarifLWBP(parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block">Tarif WBP (Rp/kWh)</span>
                          <input
                            type="number"
                            step="0.01"
                            value={tarifWBP}
                            onChange={(e) => setTarifWBP(parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block">Tarif kVArh (Rp/kVArh)</span>
                          <input
                            type="number"
                            step="0.01"
                            value={tarifKVArh}
                            onChange={(e) => setTarifKVArh(parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                        <div className="space-y-1">
                          <span className="text-[9px] font-bold text-slate-500 block">Pajak PPJ (%)</span>
                          <input
                            type="number"
                            value={pajakPPJ}
                            onChange={(e) => setPajakPPJ(parseFloat(e.target.value) || 0)}
                            className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Stand Meter Input Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      
                      {/* Stand Meter Awal */}
                      <div className="bg-sky-50/20 dark:bg-sky-950/10 p-4 rounded-xl border border-sky-100/70 dark:border-sky-950/30 space-y-3">
                        <span className="text-[10px] font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider block border-b border-sky-100/40 dark:border-sky-950/20 pb-1.5 font-mono">
                          Stand Meter AWAL (Bulan Lalu)
                        </span>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Stand LWBP</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand awal"
                              value={standAwalLWBP}
                              onChange={(e) => setStandAwalLWBP(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Stand WBP</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand awal"
                              value={standAwalWBP}
                              onChange={(e) => setStandAwalWBP(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Stand kVArh</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand awal"
                              value={standAwalKVArh}
                              onChange={(e) => setStandAwalKVArh(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>
                        </div>

                      </div>

                      {/* Stand Meter Akhir */}
                      <div className="bg-emerald-50/20 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-100/70 dark:border-emerald-950/30 space-y-3">
                        <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block border-b border-emerald-100/40 dark:border-emerald-950/20 pb-1.5 font-mono">
                          Stand Meter AKHIR (Bulan Ini)
                        </span>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400 font-sans">Stand LWBP</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand akhir"
                              value={standAkhirLWBP}
                              onChange={(e) => setStandAkhirLWBP(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>
                          
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Stand WBP</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand akhir"
                              value={standAkhirWBP}
                              onChange={(e) => setStandAkhirWBP(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-600 dark:text-slate-400">Stand kVArh</span>
                            <input
                              type="number"
                              required
                              placeholder="Masukkan stand akhir"
                              value={standAkhirKVArh}
                              onChange={(e) => setStandAkhirKVArh(e.target.value)}
                              className="w-1/2 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg text-xs font-mono font-bold text-slate-800 dark:text-white focus:outline-none"
                            />
                          </div>
                        </div>

                      </div>

                    </div>

                    {/* Submit Button */}
                    <div className="pt-2">
                      <button
                        type="submit"
                        disabled={submitting || !liveCalc}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition ${
                          !liveCalc 
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed border border-slate-200 dark:border-slate-700' 
                            : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/15 cursor-pointer'
                        }`}
                      >
                        <Check className="w-4 h-4" />
                        {submitting ? 'Menyimpan...' : 'Hitung & Simpan Laporan'}
                      </button>
                    </div>

                  </form>
                ) : (
                  <div className="p-8 text-center bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col items-center justify-center gap-3">
                    <div className="p-3 bg-rose-50 dark:bg-rose-950/20 text-rose-600 rounded-full border border-rose-100 dark:border-rose-950/50">
                      <Lock className="w-6 h-6" />
                    </div>
                    <h4 className="font-bold text-slate-800 dark:text-white text-xs uppercase tracking-wider">Akses Terkunci</h4>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-sm">
                      Formulir pengisian laporan pemakaian listrik dan kalkulator ini hanya dapat diisi oleh administrator atau kru yang memiliki otorisasi.
                    </p>
                  </div>
                )}
              </div>

              {/* Informative Help Box */}
              <div className="bg-indigo-50/50 dark:bg-indigo-950/10 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30 flex gap-3">
                <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
                <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                  <span className="font-bold text-slate-800 dark:text-indigo-200 block">Keterangan Aturan Denda kVArh PLN</span>
                  <p className="leading-relaxed">
                    Sesuai dengan ketentuan tarif PLN untuk golongan industri / komersial, batas toleransi pemakaian daya reaktif (kVArh) adalah <strong className="text-indigo-650 dark:text-indigo-400">62%</strong> dari total pemakaian energi aktif (total kWh LWBP + WBP). Kelebihan dari batas 62% tersebut dikenakan biaya denda kVArh sesuai dengan tarif yang berlaku.
                  </p>
                </div>
              </div>

            </div>

            {/* LIVE CALCULATION OUTPUT SECTION */}
            <div className="lg:col-span-5 flex flex-col gap-6" id="live-calculation-output">
              
              <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex-1 flex flex-col gap-5">
                <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
                  <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">Hasil Perhitungan Simulasi</span>
                  <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider mt-0.5">Rincian Tagihan & Denda</h3>
                </div>

                {liveCalc ? (
                  <div className="flex-1 flex flex-col justify-between gap-6" id="calc-filled-state">
                    
                    {/* Excel Structure Spreadsheet Layout */}
                    <div className="space-y-4">
                      <div className="overflow-x-auto rounded-xl border border-slate-200/85 dark:border-slate-800">
                        <table className="w-full text-left border-collapse text-[11px] font-mono">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 text-slate-500">
                              <th className="p-2.5 font-bold font-sans">Sektor</th>
                              <th className="p-2.5 font-bold text-right">Stand Awal</th>
                              <th className="p-2.5 font-bold text-right">Stand Akhir</th>
                              <th className="p-2.5 font-bold text-right">Selisih</th>
                              <th className="p-2.5 font-bold text-right text-indigo-600 dark:text-indigo-400">Aktual</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                            <tr>
                              <td className="p-2.5 font-bold font-sans">LWBP <span className="text-[8px] font-normal text-slate-400 block -mt-0.5">(Luar Waktu Beban Puncak)</span></td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAwalLWBP))}</td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAkhirLWBP))}</td>
                              <td className="p-2.5 text-right">{formatDec(liveCalc.selisihLWBP)}</td>
                              <td className="p-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatDec(liveCalc.pemakaianLWBP)}</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold font-sans">WBP <span className="text-[8px] font-normal text-slate-400 block -mt-0.5">(Waktu Beban Puncak)</span></td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAwalWBP))}</td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAkhirWBP))}</td>
                              <td className="p-2.5 text-right">{formatDec(liveCalc.selisihWBP)}</td>
                              <td className="p-2.5 text-right font-bold text-indigo-600 dark:text-indigo-400">{formatDec(liveCalc.pemakaianWBP)}</td>
                            </tr>
                            <tr>
                              <td className="p-2.5 font-bold font-sans text-rose-600">kVArh <span className="text-[8px] font-normal text-slate-400 block -mt-0.5">(Kondensator / Daya Reaktif)</span></td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAwalKVArh))}</td>
                              <td className="p-2.5 text-right">{formatDec(parseFloat(standAkhirKVArh))}</td>
                              <td className="p-2.5 text-right">{formatDec(liveCalc.selisihKVArh)}</td>
                              <td className="p-2.5 text-right font-bold text-rose-600">{formatDec(liveCalc.pemakaianKVArh)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* Formula logic outputs */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 dark:bg-slate-900/55 rounded-xl border border-slate-200/40 text-center">
                          <span className="text-[9px] text-slate-400 block font-bold uppercase">Batas Toleransi (62%)</span>
                          <span className="text-xs font-black text-slate-800 dark:text-white font-mono mt-0.5 block">
                            {formatDec(liveCalc.batasToleransiKVArh)} <span className="text-[9px] font-normal text-slate-400">kVArh</span>
                          </span>
                        </div>
                        <div className={`p-3 rounded-xl border text-center transition-all ${
                          liveCalc.kelebihanKVArh > 0 
                            ? 'bg-rose-50/55 dark:bg-rose-950/15 border-rose-200/50 text-rose-700 dark:text-rose-400 animate-pulse' 
                            : 'bg-emerald-50/50 dark:bg-emerald-950/15 border-emerald-200/50 text-emerald-700 dark:text-emerald-400'
                        }`}>
                          <span className="text-[9px] block font-bold uppercase">Kelebihan kVArh (Denda)</span>
                          <span className="text-xs font-black font-mono mt-0.5 block">
                            {formatDec(liveCalc.kelebihanKVArh)} <span className="text-[9px] font-normal">kVArh</span>
                          </span>
                        </div>
                      </div>

                      {/* Cost Breakdown */}
                      <div className="space-y-2 p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 text-xs">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block border-b border-slate-100 dark:border-slate-800 pb-1">Rincian Nominal</span>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Biaya LWBP:</span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-300">{formatIDR(liveCalc.biayaLWBP)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span>Biaya WBP:</span>
                          <span className="font-mono font-bold text-slate-850 dark:text-slate-300">{formatIDR(liveCalc.biayaWBP)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-600 dark:text-slate-400">
                          <span className={liveCalc.biayaDendaKVArh > 0 ? 'text-rose-600 font-semibold' : ''}>Denda kVArh:</span>
                          <span className={`font-mono font-bold ${liveCalc.biayaDendaKVArh > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                            {formatIDR(liveCalc.biayaDendaKVArh)}
                          </span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1 flex justify-between items-center font-bold text-slate-700 dark:text-slate-300">
                          <span>Subtotal:</span>
                          <span className="font-mono">{formatIDR(liveCalc.subtotalBiaya)}</span>
                        </div>
                        <div className="flex justify-between items-center text-slate-500">
                          <span>Pajak PPJ ({pajakPPJ}%):</span>
                          <span className="font-mono">{formatIDR(liveCalc.nominalPajak)}</span>
                        </div>
                        <div className="border-t border-slate-200 dark:border-slate-800 my-1 pt-1.5 flex justify-between items-center font-bold text-indigo-650 dark:text-indigo-400">
                          <span>Total Bayar:</span>
                          <span className="font-mono text-xs font-black">{formatIDR(liveCalc.totalBayar)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Total High-Impact Display */}
                    <div className="bg-indigo-650 text-white p-4.5 rounded-2xl flex flex-col items-center justify-center text-center gap-1 mt-auto shadow-sm">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-200">TOTAL ESTIMASI BAYAR</span>
                      <span className="text-xl font-black font-mono leading-tight">
                        {formatIDR(liveCalc.totalBayar)}
                      </span>
                      <div className="text-[10px] text-indigo-150 mt-2 pt-1.5 border-t border-white/10 w-full flex justify-between px-2 font-mono">
                        <span>Subtotal: {formatIDR(liveCalc.subtotalBiaya)}</span>
                        <span>+</span>
                        <span>PPJ ({pajakPPJ}%): {formatIDR(liveCalc.nominalPajak)}</span>
                      </div>
                    </div>

                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 p-10 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-slate-150 dark:border-slate-800">
                    <Calculator className="w-10 h-10 text-slate-300 dark:text-slate-700" />
                    <span className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider mt-2">Menunggu Input Stand Meter</span>
                    <p className="text-[11px] text-slate-400 max-w-xs">
                      Silakan isi seluruh stand meter awal dan stand meter akhir di kolom input untuk melihat simulasi kalkulator tagihan listrik.
                    </p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* 2. HISTORY REPORT TAB */}
        {activeSubTab === 'history' && (
          <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="history-view">
            
            {/* Header Area matching screenshot */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-5">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-500" />
                  <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Log Histori Pencatatan Biaya Listrik</h3>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Daftar semua perhitungan stand meter kelistrikan yang telah disimpan di database lokal
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-3">
                <span className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold rounded-xl text-slate-700 dark:text-slate-300">
                  Total Rekaman: <span className="font-mono text-indigo-600 dark:text-indigo-400 font-extrabold">{reports.length}</span>
                </span>
                
                <button
                  onClick={handleExportCSV}
                  disabled={reports.length === 0}
                  className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/45 disabled:opacity-50 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer border border-indigo-100 dark:border-indigo-900/30"
                >
                  <Download className="w-4 h-4" /> Export CSV
                </button>

                <button
                  onClick={triggerPrintFilteredSummary}
                  disabled={reports.length === 0}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-md"
                  title="Cetak Rekapitulasi & Tren Terfilter"
                >
                  <Printer className="w-4 h-4" /> Print Laporan
                </button>
              </div>
            </div>

            {/* Filtering Controls integrated beautifully above charts */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800/85">
              
              {/* Segmented controls for harian / bulanan / tahunan */}
              <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/60 p-1 rounded-xl self-start">
                <button
                  onClick={() => {
                    setFilterType('harian');
                    setFilterBulan('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'harian'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Harian
                </button>
                <button
                  onClick={() => {
                    setFilterType('bulanan');
                    setFilterBulan('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'bulanan'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Bulanan
                </button>
                <button
                  onClick={() => {
                    setFilterType('tahunan');
                    setFilterBulan('all');
                    setFilterTahun('all');
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                    filterType === 'tahunan'
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  Tahunan
                </button>
              </div>

              {/* Dropdown Filters */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Branch Filter */}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                    <Filter className="w-3 h-3 text-slate-400" /> Cabang:
                  </span>
                  <select
                    value={filterCabang}
                    onChange={(e) => setFilterCabang(e.target.value)}
                    disabled={!isParentCompany}
                    className={`w-36 sm:w-48 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 truncate ${!isParentCompany ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                  >
                    {isParentCompany ? (
                      <>
                        <option value="all">Semua Cabang</option>
                        <option value="pusat">Kantor Pusat</option>
                        {branches && branches.map(b => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                      </>
                    ) : (
                      <option value={currentUser.cabangId || 'pusat'}>
                        {currentUser.cabangId === 'pusat' || !currentUser.cabangId 
                          ? 'Kantor Pusat' 
                          : (branches && branches.find(b => b.id === currentUser.cabangId)?.name || 'Cabang Saya')}
                      </option>
                    )}
                  </select>
                </div>

                {/* Year Filter (except for tahunan) */}
                {filterType !== 'tahunan' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-slate-400" /> Tahun:
                    </span>
                    <select
                      value={filterTahun}
                      onChange={(e) => {
                        setFilterTahun(e.target.value);
                        if (e.target.value === 'all') setFilterBulan('all');
                      }}
                      className="w-28 sm:w-36 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 truncate"
                    >
                      <option value="all">Semua Tahun</option>
                      {getUniqueYears().map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Month Filter (only harian view) */}
                {filterType === 'harian' && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3 text-slate-400" /> Bulan:
                    </span>
                    <select
                      value={filterBulan}
                      onChange={(e) => setFilterBulan(e.target.value)}
                      className="w-32 sm:w-40 px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 truncate"
                    >
                      <option value="all">Semua Bulan</option>
                      {monthsList.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

            </div>

            {/* Render Area Charts Side-by-Side just like user mockup */}
            {reports.length > 0 && chartData.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" id="history-charts-row">
                
                {/* Left Chart: Total Tagihan AreaChart */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-4">
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-blue-500" /> 
                      {filterType === 'harian' ? 'TREN TOTAL TAGIHAN HARIAN (IDR)' : filterType === 'bulanan' ? 'TREN TOTAL TAGIHAN BULANAN (IDR)' : 'TREN TOTAL TAGIHAN TAHUNAN (IDR)'}
                    </h4>
                  </div>

                  <div className="h-[240px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorTotalBayar" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickFormatter={(v) => {
                            if (v >= 1000000) return `${(v / 1000000).toFixed(0)}M`;
                            if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                            return v;
                          }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-3 rounded-xl shadow-lg font-sans">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                  <p className="text-xs font-black text-indigo-650 dark:text-indigo-400 mt-1">
                                    {formatIDR(payload[0].value as number)}
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="totalBayar" 
                          stroke="#3b82f6" 
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#colorTotalBayar)"
                          dot={{ r: 4, stroke: '#3b82f6', strokeWidth: 1.5, fill: '#ffffff' }}
                          activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 0, fill: '#3b82f6' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Right Chart: Energy & Reactive AreaChart */}
                <div className="p-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs flex flex-col gap-4">
                  <div className="flex flex-col gap-0.5">
                    <h4 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                      <Zap className="w-4 h-4 text-emerald-500" />
                      TREN PEMAKAIAN ENERGI & REACTIVE (KWH VS KVARH)
                    </h4>
                  </div>

                  <div className="h-[240px] w-full pt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorActualKvarh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="colorTotalKWh" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                            <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }}
                        />
                        <YAxis 
                          stroke="#94a3b8" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={{ stroke: '#cbd5e1' }}
                          tickFormatter={(v) => {
                            if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                            return v;
                          }}
                        />
                        <Tooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-3 rounded-xl shadow-lg font-sans space-y-1.5">
                                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                  {payload.map((item: any, idx: number) => (
                                    <div key={idx} className="flex items-center gap-3 justify-between">
                                      <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                        {item.name === 'totalKWh' ? 'totalKWh' : 'actualKvarh'}:
                                      </span>
                                      <span className="text-xs font-bold font-mono text-slate-850 dark:text-white">
                                        {formatDec(item.value)} {item.name === 'totalKWh' ? 'kWh' : 'kVArh'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="actualKvarh" 
                          stroke="#6366f1" 
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorActualKvarh)"
                          dot={{ r: 3.5, stroke: '#6366f1', strokeWidth: 1.5, fill: '#ffffff' }}
                          activeDot={{ r: 5.5, stroke: '#6366f1', strokeWidth: 0, fill: '#6366f1' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="totalKWh" 
                          stroke="#10b981" 
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorTotalKWh)"
                          dot={{ r: 3.5, stroke: '#10b981', strokeWidth: 1.5, fill: '#ffffff' }}
                          activeDot={{ r: 5.5, stroke: '#10b981', strokeWidth: 0, fill: '#10b981' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex items-center justify-center gap-4 text-[9px] font-bold uppercase text-slate-400 pt-1 font-mono">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#6366f1] rounded-full" /> actualKvarh
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 bg-[#10b981] rounded-full" /> totalKWh
                    </div>
                  </div>
                </div>

              </div>
            )}

            {loading ? (
              <div className="p-12 text-center text-slate-500 text-xs flex flex-col items-center justify-center gap-3">
                <RefreshCcw className="w-6 h-6 animate-spin text-indigo-500" />
                <span>Memuat data arsip laporan...</span>
              </div>
            ) : reports.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                <h4 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Arsip Kosong</h4>
                <p className="text-[11px] max-w-sm">Belum ada data laporan listrik yang tersimpan di sistem. Gunakan form kalkulator untuk menginput laporan baru.</p>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-900 text-slate-500 font-extrabold border-b border-slate-200 dark:border-slate-800 uppercase tracking-wider text-[10px]">
                      <th className="py-3 px-4">TANGGAL</th>
                      <th className="py-3 px-4">STAND LWB (AWAL / AKHIR)</th>
                      <th className="py-3 px-4">STAND WBP (AWAL / AKHIR)</th>
                      <th className="py-3 px-4">STAND KVARH (AWAL / AKHIR)</th>
                      <th className="py-3 px-4 text-right">PEMAKAIAN LWB / WBP</th>
                      <th className="py-3 px-4 text-right">PEMAKAIAN KVARH</th>
                      <th className="py-3 px-4 text-right">DENDA KVARH</th>
                      <th className="py-3 px-4 text-right text-indigo-600 dark:text-indigo-400">TOTAL BIAYA (PPJ INC.)</th>
                      <th className="py-3 px-4 text-center">AKSI</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-150 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                    {/* Filter local items dynamically for table matching active selectors */}
                    {(() => {
                      let tableItems = [...reports];
                      if (filterCabang !== 'all') {
                        tableItems = tableItems.filter(r => r.cabangId === filterCabang);
                      }
                      if (filterTahun !== 'all' && filterType !== 'tahunan') {
                        tableItems = tableItems.filter(r => r.tanggalLaporan.startsWith(filterTahun));
                      }
                      if (filterBulan !== 'all' && filterType === 'harian') {
                        tableItems = tableItems.filter(r => {
                          const parts = r.tanggalLaporan.split('-');
                          return parts.length === 3 && parts[1] === filterBulan;
                        });
                      }
                      tableItems.sort((a, b) => b.tanggalLaporan.localeCompare(a.tanggalLaporan));

                      if (tableItems.length === 0) {
                        return (
                          <tr>
                            <td colSpan={9} className="p-8 text-center text-slate-400 font-medium">
                              Tidak ada rekaman data yang cocok dengan kriteria filter saat ini.
                            </td>
                          </tr>
                        );
                      }

                      const formatIndonesianDate = (dateStr: string) => {
                        const parts = dateStr.split('-');
                        if (parts.length === 3) {
                          const year = parts[0];
                          const monthIndex = parseInt(parts[1], 10) - 1;
                          const day = parseInt(parts[2], 10).toString();
                          const months = [
                            'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
                            'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
                          ];
                          return `${day} ${months[monthIndex] || parts[1]} ${year}`;
                        }
                        return dateStr;
                      };

                      return tableItems.map((report) => {
                        const branchName = report.cabangId === 'pusat' || !report.cabangId 
                          ? 'Kantor Pusat' 
                          : (branches && branches.find(b => b.id === report.cabangId)?.name || 'Kantor Pusat');
                        return (
                          <tr key={report.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/45 transition">
                            {/* TANGGAL CELL */}
                            <td className="py-3.5 px-4">
                              <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                                {formatIndonesianDate(report.tanggalLaporan)}
                              </div>
                              <div className="text-[10px] text-slate-400 font-sans mt-1 flex flex-wrap gap-1 items-center">
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-750 text-[9px] font-bold rounded text-slate-700 dark:text-slate-300">
                                  {branchName}
                                </span>
                                <span className="px-1.5 py-0.5 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150/20 text-indigo-600 dark:text-indigo-400 text-[9px] font-bold rounded">
                                  Faktor={report.multiplier}
                                </span>
                              </div>
                              <div className="text-[9px] text-slate-500 font-medium truncate max-w-[120px] mt-1" title={`Petugas: ${report.createdByName}`}>
                                Oleh: {report.createdByName}
                              </div>
                            </td>

                            {/* STAND LWB CELL */}
                            <td className="py-3.5 px-4 font-mono text-xs">
                              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Awal: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAwalLWBP)}</span></div>
                              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Akhir: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAkhirLWBP)}</span></div>
                              <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-1">Selisih: <span className="font-bold">{formatDec(report.selisihLWBP)}</span></div>
                            </td>

                            {/* STAND WBP CELL */}
                            <td className="py-3.5 px-4 font-mono text-xs">
                              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Awal: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAwalWBP)}</span></div>
                              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Akhir: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAkhirWBP)}</span></div>
                              <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-1">Selisih: <span className="font-bold">{formatDec(report.selisihWBP)}</span></div>
                            </td>

                            {/* STAND KVARH CELL */}
                            <td className="py-3.5 px-4 font-mono text-xs">
                              <div className="text-slate-500 dark:text-slate-400 text-[11px]">Awal: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAwalKVArh)}</span></div>
                              <div className="text-slate-500 dark:text-slate-400 text-[11px] mt-0.5">Akhir: <span className="font-bold text-slate-800 dark:text-slate-200">{formatDec(report.standAkhirKVArh)}</span></div>
                              <div className="text-slate-400 dark:text-slate-500 text-[10px] mt-1">Selisih: <span className="font-bold">{formatDec(report.selisihKVArh)}</span></div>
                            </td>

                            {/* PEMAKAIAN LWB / WBP CELL */}
                            <td className="py-3.5 px-4 font-mono text-right text-xs">
                              <div className="font-extrabold text-slate-850 dark:text-slate-100">{formatDec(report.pemakaianLWBP)} kWh</div>
                              <div className="text-slate-400 text-[10px] mt-0.5">{formatDec(report.pemakaianWBP)} kWh</div>
                            </td>

                            {/* PEMAKAIAN KVARH CELL */}
                            <td className="py-3.5 px-4 font-mono text-right text-xs">
                              <div className="font-extrabold text-slate-850 dark:text-slate-100">{formatDec(report.pemakaianKVArh)} kVArh</div>
                              <div className="text-emerald-500 font-bold text-[10px] mt-0.5">Tol: {formatDec(report.batasToleransiKVArh)}</div>
                            </td>

                            {/* DENDA KVARH CELL */}
                            <td className="py-3.5 px-4 font-mono text-right text-xs">
                              {report.biayaDendaKVArh > 0 ? (
                                <>
                                  <div className="font-bold text-rose-600">{formatIDR(report.biayaDendaKVArh)}</div>
                                  <div className="text-rose-400 text-[10px] mt-0.5">+{formatDec(report.kelebihanKVArh)} kVArh</div>
                                </>
                              ) : (
                                <>
                                  <div className="text-slate-400 font-medium">Rp 0</div>
                                  <div className="text-slate-400 text-[10px] mt-0.5">(Normal)</div>
                                </>
                              )}
                            </td>

                            {/* TOTAL BIAYA (PPJ INC.) CELL */}
                            <td className="py-3.5 px-4 text-right font-black text-indigo-600 dark:text-indigo-400 font-mono text-xs">
                              <div>{formatIDR(report.totalBayar)}</div>
                              <div className="text-[9px] text-slate-400 dark:text-slate-500 font-sans font-normal mt-1 leading-normal">
                                Sub: {formatIDR(report.subtotalBiaya)}<br/>
                                PPJ ({report.pajakPPJ}%): {formatIDR(report.nominalPajak)}
                              </div>
                            </td>

                            {/* ACTION BUTTONS */}
                            <td className="py-3.5 px-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => triggerPrint(report)}
                                  className="p-1.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-100 dark:border-indigo-950/40 transition cursor-pointer"
                                  title="Cetak Rincian / Nota Laporan"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                
                                {canManage && (
                                  <button
                                    onClick={() => setDeleteReportId(report.id)}
                                    className="p-1.5 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/60 border border-rose-100 dark:border-rose-950/40 transition cursor-pointer"
                                    title="Hapus Laporan"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 3. TREND ANALYTICS TAB */}
        {activeSubTab === 'analytics' && (
          <div className="bg-white dark:bg-slate-850 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6" id="analytics-view">
            
            {/* Title and Filter Panel */}
            <div className="flex flex-col gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
              <div className="flex items-center gap-2">
                <BarChart4 className="w-4.5 h-4.5 text-indigo-500" />
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">Visualisasi Tren & Analisis Biaya Listrik</h3>
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800/85">
                
                {/* Segmented controls for harian / bulanan / tahunan */}
                <div className="flex items-center gap-1 bg-slate-200/50 dark:bg-slate-800/60 p-1 rounded-xl self-start">
                  <button
                    onClick={() => {
                      setFilterType('harian');
                      setFilterBulan('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'harian'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Harian
                  </button>
                  <button
                    onClick={() => {
                      setFilterType('bulanan');
                      setFilterBulan('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'bulanan'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Bulanan
                  </button>
                  <button
                    onClick={() => {
                      setFilterType('tahunan');
                      setFilterBulan('all');
                      setFilterTahun('all');
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      filterType === 'tahunan'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Tahunan
                  </button>
                </div>

                {/* Dropdown Filters */}
                <div className="flex flex-wrap items-center gap-4">
                  {/* Branch Filter */}
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                      <Filter className="w-3 h-3 text-slate-400" /> Cabang:
                    </span>
                    <select
                      value={filterCabang}
                      onChange={(e) => setFilterCabang(e.target.value)}
                      disabled={!isParentCompany}
                      className={`px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500 ${!isParentCompany ? 'opacity-70 cursor-not-allowed bg-slate-100 dark:bg-slate-800' : ''}`}
                    >
                      {isParentCompany ? (
                        <>
                          <option value="all">Semua Cabang</option>
                          <option value="pusat">Kantor Pusat</option>
                          {branches.map(b => (
                            <option key={b.id} value={b.id}>{b.name}</option>
                          ))}
                        </>
                      ) : (
                        <option value={currentUser.cabangId || 'pusat'}>
                          {currentUser.cabangId === 'pusat' || !currentUser.cabangId 
                            ? 'Kantor Pusat' 
                            : (branches && branches.find(b => b.id === currentUser.cabangId)?.name || 'Cabang Saya')}
                        </option>
                      )}
                    </select>
                  </div>

                  {/* Year Filter (except for tahunan) */}
                  {filterType !== 'tahunan' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Tahun:
                      </span>
                      <select
                        value={filterTahun}
                        onChange={(e) => {
                          setFilterTahun(e.target.value);
                          if (e.target.value === 'all') setFilterBulan('all');
                        }}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">Semua Tahun</option>
                        {getUniqueYears().map(y => (
                          <option key={y} value={y}>{y}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Month Filter (only harian view) */}
                  {filterType === 'harian' && (
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" /> Bulan:
                      </span>
                      <select
                        value={filterBulan}
                        onChange={(e) => setFilterBulan(e.target.value)}
                        className="px-2.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="all">Semua Bulan</option>
                        {monthsList.map(m => (
                          <option key={m.value} value={m.value}>{m.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

              </div>
            </div>

            {reports.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                <FileSpreadsheet className="w-12 h-12 text-slate-300 dark:text-slate-700" />
                <h4 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Menunggu Data</h4>
                <p className="text-[11px] max-w-sm">Dibutuhkan minimal 1 data laporan untuk melihat visualisasi dan tren pemakaian listrik.</p>
              </div>
            ) : chartData.length === 0 ? (
              <div className="p-16 text-center text-slate-400 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-150 dark:border-slate-800 flex flex-col items-center justify-center gap-3">
                <AlertCircle className="w-12 h-12 text-amber-500 animate-pulse" />
                <h4 className="font-bold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider">Data Tidak Ditemukan</h4>
                <p className="text-[11px] max-w-sm">Tidak ada data laporan listrik yang cocok dengan kriteria filter aktif saat ini.</p>
              </div>
            ) : (
              <div className="space-y-6" id="charts-container">
                
                {/* Recharts Grid representing power consumption */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  
                  {/* Chart 1: Riwayat Total Tagihan */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-indigo-500" /> 
                        {filterType === 'harian' ? 'TREN TOTAL TAGIHAN HARIAN (IDR)' : filterType === 'bulanan' ? 'TREN TOTAL TAGIHAN BULANAN (IDR)' : 'TREN TOTAL TAGIHAN TAHUNAN (IDR)'}
                      </h4>
                      <p className="text-[10px] text-slate-500">Representasi visual total tagihan listrik PLN (termasuk denda kVArh & pajak PPJ)</p>
                    </div>

                    <div className="h-[280px] w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={{ stroke: '#94a3b8' }}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={{ stroke: '#94a3b8' }}
                            tickFormatter={(v) => {
                              if (v >= 1000000) return `${(v / 1000000).toFixed(0)}M`;
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                              return v;
                            }}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-3 rounded-xl shadow-lg font-sans">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                    <p className="text-xs font-black text-indigo-600 dark:text-indigo-400 mt-1">
                                      {formatIDR(payload[0].value as number)}
                                    </p>
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="totalBayar" 
                            stroke="#3b82f6" 
                            strokeWidth={2.5}
                            dot={{ r: 5, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
                            activeDot={{ r: 7, stroke: '#3b82f6', strokeWidth: 0, fill: '#3b82f6' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Chart 2: Pemakaian Energi Aktif vs Reaktif (KWH vs KVARH) */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-xs flex flex-col gap-4">
                    <div className="flex flex-col gap-0.5">
                      <h4 className="text-xs font-extrabold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                        <Zap className="w-4 h-4 text-emerald-500" />
                        TREN PEMAKAIAN ENERGI & REACTIVE (KWH VS KVARH)
                      </h4>
                      <p className="text-[10px] text-slate-500">Perbandingan antara energi aktif utama (totalKWh) dengan daya reaktif (actualKvarh)</p>
                    </div>

                    <div className="h-[280px] w-full pt-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 10, right: 10, left: 15, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                          <XAxis 
                            dataKey="name" 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={{ stroke: '#94a3b8' }}
                          />
                          <YAxis 
                            stroke="#94a3b8" 
                            fontSize={10} 
                            tickLine={false} 
                            axisLine={{ stroke: '#94a3b8' }}
                            tickFormatter={(v) => {
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                              return v;
                            }}
                          />
                          <Tooltip
                            content={({ active, payload, label }) => {
                              if (active && payload && payload.length) {
                                return (
                                  <div className="bg-white dark:bg-slate-900 border border-slate-250 dark:border-slate-800 p-3 rounded-xl shadow-lg font-sans space-y-1.5">
                                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
                                    {payload.map((item: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-3 justify-between">
                                        <span className="text-[10px] text-slate-500 font-medium flex items-center gap-1">
                                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                                          {item.name === 'totalKWh' ? 'totalKWh' : 'actualKvarh'}:
                                        </span>
                                        <span className="text-xs font-bold font-mono text-slate-800 dark:text-white">
                                          {formatDec(item.value)} {item.name === 'totalKWh' ? 'kWh' : 'kVArh'}
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                );
                              }
                              return null;
                            }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="actualKvarh" 
                            stroke="#6366f1" 
                            strokeWidth={2}
                            dot={{ r: 4, stroke: '#6366f1', strokeWidth: 1.5, fill: '#ffffff' }}
                            activeDot={{ r: 6, stroke: '#6366f1', strokeWidth: 0, fill: '#6366f1' }}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="totalKWh" 
                            stroke="#10b981" 
                            strokeWidth={2}
                            dot={{ r: 4, stroke: '#10b981', strokeWidth: 1.5, fill: '#ffffff' }}
                            activeDot={{ r: 6, stroke: '#10b981', strokeWidth: 0, fill: '#10b981' }}
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="flex items-center justify-center gap-4 text-[9px] font-bold uppercase text-slate-400 pt-1 font-mono">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#6366f1] rounded-full" /> actualKvarh
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-[#10b981] rounded-full" /> totalKWh
                      </div>
                    </div>

                  </div>

                </div>

                {/* Additional Insight Summary Widget */}
                <div className="p-4 bg-indigo-50/40 dark:bg-indigo-950/10 border border-indigo-100/50 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 rounded-xl">
                      <Zap className="w-5 h-5 fill-indigo-300" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-indigo-200">Statistik Rata-Rata Berdasarkan Filter Aktif</h4>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400">Dihitung otomatis berdasarkan data dari {chartData.length} periode tercatat yang sesuai kriteria filter.</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block font-mono">Rata-Rata Tagihan Terfilter</span>
                    <span className="text-lg font-black font-mono text-indigo-750 dark:text-indigo-400">
                      {formatIDR(chartData.reduce((acc, curr) => acc + curr.totalBayar, 0) / chartData.length)}
                    </span>
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* RENDER DEDICATED PRINT / NOTA LAYOUT */}
      {printReportData && (
        <div className="hidden print:block bg-white p-8 text-black min-h-screen" id="electricity-printable-report">
          
          {/* Header invoice */}
          <div className="border-b-2 border-slate-900 pb-5 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold font-sans uppercase tracking-tight">MTC-CONTROL ELECTRICAL SYSTEM</h1>
              <span className="text-xs font-mono block">DIVISI PERAWATAN & SARANA LISTRIK INDUSTRI</span>
              <span className="text-xs font-mono block">ID Laporan: {printReportData.id}</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono uppercase font-bold block">LAPORAN BIAYA & DENDA LISTRIK</span>
              <span className="text-sm font-mono font-bold block mt-1">{printReportData.tanggalLaporan}</span>
            </div>
          </div>

          {/* Details Table */}
          <div className="space-y-6">
            
            <div className="p-3 bg-slate-100 rounded-md border border-slate-300">
              <span className="text-xs font-bold uppercase block tracking-wider mb-2">1. Parameter Laporan</span>
              <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-slate-500 block">Faktor Pengali (Multiplier)</span>
                  <span className="font-bold">{printReportData.multiplier}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Unit Kerja / Cabang</span>
                  <span className="font-bold">
                    {printReportData.cabangId === 'pusat' || !printReportData.cabangId 
                      ? 'Kantor Pusat' 
                      : (branches.find(b => b.id === printReportData.cabangId)?.name || 'Kantor Pusat')}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 block">Petugas Penanggung Jawab</span>
                  <span className="font-bold">{printReportData.createdByName}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase block tracking-wider">2. Rincian Pemakaian Stand Meter</span>
              <table className="w-full text-left text-xs border border-slate-400 border-collapse font-mono">
                <thead>
                  <tr className="bg-slate-200 border-b border-slate-400">
                    <th className="p-2 border border-slate-400 font-bold">Kategori Sektor</th>
                    <th className="p-2 border border-slate-400 text-right font-bold">Stand Awal</th>
                    <th className="p-2 border border-slate-400 text-right font-bold">Stand Akhir</th>
                    <th className="p-2 border border-slate-400 text-right font-bold">Selisih</th>
                    <th className="p-2 border border-slate-400 text-right font-bold">Pemakaian Aktual (kWh/kVArh)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="p-2 border border-slate-400 font-bold">LWBP (Luar Waktu Beban Puncak)</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAwalLWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAkhirLWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.selisihLWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right font-bold">{formatDec(printReportData.pemakaianLWBP)}</td>
                  </tr>
                  <tr>
                    <td className="p-2 border border-slate-400 font-bold">WBP (Waktu Beban Puncak)</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAwalWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAkhirWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.selisihWBP)}</td>
                    <td className="p-2 border border-slate-400 text-right font-bold">{formatDec(printReportData.pemakaianWBP)}</td>
                  </tr>
                  <tr className="bg-slate-50">
                    <td className="p-2 border border-slate-400 font-bold">kVArh (Daya Reaktif)</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAwalKVArh)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.standAkhirKVArh)}</td>
                    <td className="p-2 border border-slate-400 text-right">{formatDec(printReportData.selisihKVArh)}</td>
                    <td className="p-2 border border-slate-400 text-right font-bold text-red-650">{formatDec(printReportData.pemakaianKVArh)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 border border-slate-300 rounded text-xs font-mono space-y-1.5">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block">LOGIKA BATAS & DENDA KVARH</span>
                <div className="flex justify-between">
                  <span>Total Pemakaian kWh:</span>
                  <span className="font-bold">{formatDec(printReportData.totalKWh)} kWh</span>
                </div>
                <div className="flex justify-between">
                  <span>Batas Toleransi kVArh (62%):</span>
                  <span className="font-bold">{formatDec(printReportData.batasToleransiKVArh)} kVArh</span>
                </div>
                <div className="flex justify-between text-red-650 font-bold">
                  <span>Kelebihan Daya Reaktif (Denda):</span>
                  <span>{formatDec(printReportData.kelebihanKVArh)} kVArh</span>
                </div>
              </div>

              <div className="p-3 border border-slate-300 rounded text-xs font-mono space-y-1 flex flex-col justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider block mb-1">Rincian Tarif</span>
                  <div className="flex justify-between text-[10px]">
                    <span>LWBP Rate:</span>
                    <span>{formatIDR(printReportData.tarifLWBP)}/kWh</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>WBP Rate:</span>
                    <span>{formatIDR(printReportData.tarifWBP)}/kWh</span>
                  </div>
                  <div className="flex justify-between text-[10px]">
                    <span>kVArh Rate:</span>
                    <span>{formatIDR(printReportData.tarifKVArh)}/kVArh</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold uppercase block tracking-wider">3. Rincian Nominal Pembayaran</span>
              <div className="border border-slate-400 p-4 rounded font-mono text-xs space-y-2">
                <div className="flex justify-between border-b border-dashed border-slate-350 pb-1">
                  <span>A. Biaya Pemakaian LWBP:</span>
                  <span>{formatIDR(printReportData.biayaLWBP)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-350 pb-1">
                  <span>B. Biaya Pemakaian WBP:</span>
                  <span>{formatIDR(printReportData.biayaWBP)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-350 pb-1">
                  <span className={printReportData.biayaDendaKVArh > 0 ? 'font-bold text-red-650' : ''}>C. Denda Kelebihan kVArh:</span>
                  <span className={printReportData.biayaDendaKVArh > 0 ? 'font-bold' : ''}>{formatIDR(printReportData.biayaDendaKVArh)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm">
                  <span>SUBTOTAL BIAYA (A + B + C):</span>
                  <span>{formatIDR(printReportData.subtotalBiaya)}</span>
                </div>
                <div className="flex justify-between border-b border-dashed border-slate-350 pb-1 text-slate-500">
                  <span>Pajak Penerangan Jalan (PPJ) {printReportData.pajakPPJ}%:</span>
                  <span>{formatIDR(printReportData.nominalPajak)}</span>
                </div>
                <div className="flex justify-between font-black text-base pt-1 border-t-2 border-double border-slate-900">
                  <span>TOTAL ESTIMASI TAGIHAN PLN:</span>
                  <span>{formatIDR(printReportData.totalBayar)}</span>
                </div>
                <div className="text-[10px] text-right text-slate-500 font-bold mt-1">
                  (Terdiri dari Subtotal {formatIDR(printReportData.subtotalBiaya)} + Pajak PPJ {formatIDR(printReportData.nominalPajak)})
                </div>
              </div>
            </div>

            {/* Signature Area */}
            <div className="pt-12 grid grid-cols-2 text-center text-xs font-mono">
              <div className="space-y-12">
                <span>Dibuat Oleh,</span>
                <div className="flex flex-col">
                  <span className="underline font-bold">{printReportData.createdByName}</span>
                  <span className="text-[10px]">Petugas Kelistrikan</span>
                </div>
              </div>
              <div className="space-y-12">
                <span>Disetujui / Diperiksa Oleh,</span>
                <div className="flex flex-col">
                  <span className="h-[15px] block border-b border-slate-900 w-1/2 mx-auto"></span>
                  <span className="text-[10px] mt-1">Superintendent / Manager</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="pt-12 text-center text-[10px] font-mono text-slate-500 border-t border-slate-200 mt-12">
              Laporan ini dicetak secara otomatis melalui sistem MTC-Control. Segala bentuk data dan kalkulasi adalah sah demi keperluan internal operasional perusahaan.
            </div>

          </div>

          {/* Clean up print view on focus/close */}
          <button 
            onClick={() => setPrintReportData(null)}
            className="print:hidden fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 hover:bg-slate-800 transition"
          >
            Selesai Mencetak
          </button>
        </div>
      )}

      {/* RENDER DEDICATED FILTERED SUMMARY PRINT LAYOUT */}
      {printSummaryActive && (
        <div className="hidden print:block bg-white p-8 text-black min-h-screen" id="electricity-printable-summary">
          {/* STYLES FOR PRINT ONLY */}
          <style>{`
            @media print {
              html, body {
                background-color: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
              #electricity-printable-summary {
                background-color: #ffffff !important;
                color: #000000 !important;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `}</style>
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-xl font-bold font-sans uppercase tracking-tight">MTC-CONTROL ELECTRICAL SYSTEM</h1>
              <span className="text-xs font-mono block">DIVISI PERAWATAN & SARANA LISTRIK INDUSTRI</span>
              <span className="text-xs font-mono block">LAPORAN RINGKASAN REKAPITULASI BIAYA & ENERGI</span>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono uppercase font-bold block">TANGGAL CETAK</span>
              <span className="text-xs font-mono block mt-1">{new Date().toLocaleString('id-ID')}</span>
            </div>
          </div>

          {/* Active Filter Description */}
          <div className="bg-slate-100 p-4 rounded border border-slate-350 mb-6 text-xs font-mono">
            <span className="text-xs font-bold uppercase block tracking-wider mb-2">1. Parameter Filter Rekapitulasi</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <span className="text-[10px] text-slate-500 block">Tipe Laporan / Filter</span>
                <span className="font-bold uppercase">{filterType}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Cabang / Lokasi</span>
                <span className="font-bold">
                  {filterCabang === 'all' 
                    ? 'Semua Cabang' 
                    : filterCabang === 'pusat' 
                      ? 'Kantor Pusat' 
                      : (branches.find(b => b.id === filterCabang)?.name || filterCabang)}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Tahun</span>
                <span className="font-bold">{filterTahun === 'all' ? 'Semua Tahun' : filterTahun}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Bulan</span>
                <span className="font-bold">
                  {filterBulan === 'all' 
                    ? 'Semua Bulan' 
                    : (monthsList.find(m => m.value === filterBulan)?.label || filterBulan)}
                </span>
              </div>
            </div>
          </div>

          {/* Stats KPI Widgets */}
          {(() => {
            const items = getFilteredTableItems();
            const totalRecords = items.length;
            const totalTagihan = items.reduce((acc, curr) => acc + curr.totalBayar, 0);
            const rataRataTagihan = totalRecords > 0 ? totalTagihan / totalRecords : 0;
            const totalKWh = items.reduce((acc, curr) => acc + curr.totalKWh, 0);
            const totalKvarh = items.reduce((acc, curr) => acc + curr.pemakaianKVArh, 0);
            const totalDenda = items.reduce((acc, curr) => acc + curr.biayaDendaKVArh, 0);

            return (
              <div className="space-y-6">
                {/* 2. Ringkasan Statistik */}
                <div>
                  <span className="text-xs font-bold uppercase block tracking-wider mb-2">2. Statistik Rekapitulasi</span>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono">
                    <div className="p-3 border border-slate-350 rounded">
                      <span className="text-[10px] text-slate-500 block">TOTAL REKAMAN DATA</span>
                      <span className="font-extrabold text-sm">{totalRecords} Periode</span>
                    </div>
                    <div className="p-3 border border-slate-350 rounded">
                      <span className="text-[10px] text-slate-500 block">TOTAL ESTIMASI TAGIHAN (IDR)</span>
                      <span className="font-extrabold text-sm text-indigo-900">{formatIDR(totalTagihan)}</span>
                    </div>
                    <div className="p-3 border border-slate-350 rounded">
                      <span className="text-[10px] text-slate-500 block">RATA-RATA TAGIHAN (IDR)</span>
                      <span className="font-extrabold text-sm">{formatIDR(rataRataTagihan)}</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs font-mono mt-3">
                    <div className="p-3 border border-slate-300 rounded">
                      <span className="text-[10px] text-slate-500 block">TOTAL KONSUMSI KWH</span>
                      <span className="font-extrabold text-sm">{formatDec(totalKWh)} kWh</span>
                    </div>
                    <div className="p-3 border border-slate-300 rounded">
                      <span className="text-[10px] text-slate-500 block">TOTAL PEMAKAIAN KVARH</span>
                      <span className="font-extrabold text-sm">{formatDec(totalKvarh)} kVArh</span>
                    </div>
                    <div className="p-3 border border-slate-300 rounded">
                      <span className="text-[10px] text-slate-500 block">TOTAL DENDA KVARH (IDR)</span>
                      <span className="font-extrabold text-sm text-red-650">{formatIDR(totalDenda)}</span>
                    </div>
                  </div>
                </div>

                {/* 3. Grafik Tren Pertumbuhan & Penurunan */}
                <div className="space-y-2" style={{ pageBreakInside: 'avoid' }}>
                  <span className="text-xs font-bold uppercase block tracking-wider">3. Grafik Tren Pertumbuhan & Penurunan Energi & Biaya</span>
                  <div className="grid grid-cols-2 gap-6 bg-white p-3 border border-slate-300 rounded-xl">
                    <div className="p-1">
                      <span className="text-[10px] font-black text-slate-700 block mb-2 text-center uppercase font-mono">Grafik Tren Total Tagihan (IDR)</span>
                      <div className="h-[160px] w-[330px] mx-auto">
                        <AreaChart width={330} height={150} data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="printColorTotalBayar" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15}/>
                              <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                          <XAxis dataKey="name" stroke="#475569" fontSize={8} tickLine={false} />
                          <YAxis 
                            stroke="#475569" 
                            fontSize={8} 
                            tickLine={false} 
                            tickFormatter={(v) => {
                              if (v >= 1000000) return `${(v / 1000000).toFixed(0)}M`;
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                              return v;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="totalBayar" 
                            stroke="#3b82f6" 
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#printColorTotalBayar)"
                            dot={{ r: 3, stroke: '#3b82f6', strokeWidth: 1, fill: '#ffffff' }}
                          />
                        </AreaChart>
                      </div>
                    </div>

                    <div className="p-1 border-l border-slate-200">
                      <span className="text-[10px] font-black text-slate-700 block mb-2 text-center uppercase font-mono">Grafik Konsumsi Energi (totalKWh vs kVArh)</span>
                      <div className="h-[160px] w-[330px] mx-auto">
                        <AreaChart width={330} height={150} data={chartData} margin={{ top: 5, right: 5, left: 10, bottom: 5 }}>
                          <defs>
                            <linearGradient id="printColorActualKvarh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#6366f1" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="printColorTotalKWh" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10b981" stopOpacity={0.12}/>
                              <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" strokeWidth={0.5} opacity={0.5} />
                          <XAxis dataKey="name" stroke="#475569" fontSize={8} tickLine={false} />
                          <YAxis 
                            stroke="#475569" 
                            fontSize={8} 
                            tickLine={false} 
                            tickFormatter={(v) => {
                              if (v >= 1000) return `${(v / 1000).toFixed(0)}k`;
                              return v;
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="actualKvarh" 
                            stroke="#6366f1" 
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#printColorActualKvarh)"
                            dot={{ r: 2.5, stroke: '#6366f1', strokeWidth: 1, fill: '#ffffff' }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="totalKWh" 
                            stroke="#10b981" 
                            strokeWidth={1.5}
                            fillOpacity={1}
                            fill="url(#printColorTotalKWh)"
                            dot={{ r: 2.5, stroke: '#10b981', strokeWidth: 1, fill: '#ffffff' }}
                          />
                        </AreaChart>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. Daftar Detail Rekapitulasi */}
                <div className="space-y-2">
                  <span className="text-xs font-bold uppercase block tracking-wider">4. Detail Data Pemakaian & Biaya</span>
                  <table className="w-full text-left text-[11px] border border-slate-400 border-collapse font-mono">
                    <thead>
                      <tr className="bg-slate-200 border-b border-slate-400">
                        <th className="p-2 border border-slate-400">Tanggal/Periode</th>
                        <th className="p-2 border border-slate-400 text-right">Faktor (CT/PT)</th>
                        <th className="p-2 border border-slate-400 text-right">LWBP (kWh)</th>
                        <th className="p-2 border border-slate-400 text-right">WBP (kWh)</th>
                        <th className="p-2 border border-slate-400 text-right">totalKWh (LWBP+WBP)</th>
                        <th className="p-2 border border-slate-400 text-right">actualKvarh (kVArh)</th>
                        <th className="p-2 border border-slate-400 text-right">Denda kVArh (IDR)</th>
                        <th className="p-2 border border-slate-400 text-right">Total Bayar (IDR)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((report) => (
                        <tr key={report.id} className="border-b border-slate-300">
                          <td className="p-2 border border-slate-400 font-bold">{report.tanggalLaporan}</td>
                          <td className="p-2 border border-slate-400 text-right">{report.multiplier}</td>
                          <td className="p-2 border border-slate-400 text-right">{formatDec(report.pemakaianLWBP)}</td>
                          <td className="p-2 border border-slate-400 text-right">{formatDec(report.pemakaianWBP)}</td>
                          <td className="p-2 border border-slate-400 text-right font-bold">{formatDec(report.totalKWh)}</td>
                          <td className="p-2 border border-slate-400 text-right">{formatDec(report.pemakaianKVArh)}</td>
                          <td className="p-2 border border-slate-400 text-right text-red-650 font-bold">{formatIDR(report.biayaDendaKVArh)}</td>
                          <td className="p-2 border border-slate-400 text-right font-black text-indigo-900">{formatIDR(report.totalBayar)}</td>
                        </tr>
                      ))}
                      {/* Total row */}
                      <tr className="bg-slate-100 font-bold">
                        <td className="p-2 border border-slate-400 font-extrabold">TOTAL</td>
                        <td className="p-2 border border-slate-400 text-right">-</td>
                        <td className="p-2 border border-slate-400 text-right">{formatDec(items.reduce((acc, curr) => acc + curr.pemakaianLWBP, 0))}</td>
                        <td className="p-2 border border-slate-400 text-right">{formatDec(items.reduce((acc, curr) => acc + curr.pemakaianWBP, 0))}</td>
                        <td className="p-2 border border-slate-400 text-right">{formatDec(totalKWh)}</td>
                        <td className="p-2 border border-slate-400 text-right">{formatDec(totalKvarh)}</td>
                        <td className="p-2 border border-slate-400 text-right text-red-650">{formatIDR(totalDenda)}</td>
                        <td className="p-2 border border-slate-400 text-right text-indigo-900 font-extrabold">{formatIDR(totalTagihan)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Signatures Area */}
                <div className="pt-12 grid grid-cols-2 text-center text-xs font-mono">
                  <div className="space-y-12">
                    <span>Dibuat Oleh,</span>
                    <div className="flex flex-col">
                      <span className="underline font-bold">{currentUser.name}</span>
                      <span className="text-[10px]">Petugas Kelistrikan</span>
                    </div>
                  </div>
                  <div className="space-y-12">
                    <span>Disetujui / Diperiksa Oleh,</span>
                    <div className="flex flex-col">
                      <span className="h-[15px] block border-b border-slate-900 w-1/2 mx-auto"></span>
                      <span className="text-[10px] mt-1">Superintendent / Manager</span>
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="pt-12 text-center text-[10px] font-mono text-slate-500 border-t border-slate-200 mt-12">
                  Laporan rekapitulasi kelistrikan terfilter ini dicetak secara otomatis melalui sistem MTC-Control. Segala bentuk data dan kalkulasi adalah sah demi keperluan internal operasional perusahaan.
                </div>
              </div>
            );
          })()}

          {/* Clean up print view on focus/close */}
          <button 
            onClick={() => setPrintSummaryActive(false)}
            className="print:hidden fixed bottom-6 right-6 bg-slate-900 text-white px-5 py-2.5 rounded-full text-xs font-bold shadow-md cursor-pointer flex items-center gap-1.5 hover:bg-slate-800 transition"
          >
            Selesai Mencetak Summary
          </button>
        </div>
      )}

      {/* Confirmation modal for delete */}
      <ConfirmModal
        isOpen={deleteReportId !== null}
        title="Hapus Laporan Listrik"
        message="Apakah Anda yakin ingin menghapus laporan pemakaian listrik terpilih? Data tidak dapat dipulihkan."
        confirmLabel="Ya, Hapus"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          if (deleteReportId) {
            handleDeleteReport(deleteReportId);
            setDeleteReportId(null);
          }
        }}
        onCancel={() => setDeleteReportId(null)}
      />

    </div>
  );
}
