export type UserRole = 'admin' | 'management' | 'teknisi' | 'departemen';

export interface CompanyFormatConfig {
  logoUrl?: string; // base64 or custom logo URL
  companyName?: string;
  addressLine1?: string;
  addressLine2?: string;
  documentTitle?: string;
  documentCode?: string;
  signature1?: string; // default "Diajukan Oleh" or "Dibuat Oleh"
  signature2?: string; // default "Diterima oleh" or "Dikerjakan Oleh"
  signature3?: string; // default "Disetujui Oleh" (for WO)
}

export interface Company {
  id: string; // unique lowercase ID e.g. "pt_maju"
  name: string;
  status: 'aktif' | 'nonaktif'; // 'aktif' = has permission, 'nonaktif' = license/permission cut off
  createdAt: string;
  adminUsername: string; // admin username created for this company
  wrFormat?: CompanyFormatConfig;
  woFormat?: CompanyFormatConfig;
  ppFormat?: CompanyFormatConfig;
}

export interface CompanyBranch {
  id: string; // unique ID
  companyId: string; // associated company ID
  name: string; // e.g. "Cabang Jakarta"
  address?: string;
  createdAt: string;
  parentId?: string; // parent branch or sub-company ID in the hierarchy (if any)
  type?: 'anak_perusahaan' | 'anak_cabang'; // type of node
  wrFormat?: CompanyFormatConfig;
  woFormat?: CompanyFormatConfig;
  ppFormat?: CompanyFormatConfig;
}

export interface UserProfile {
  username: string; // works as ID
  name: string;
  pin: string;
  role: UserRole;
  subRole: string; // e.g. "HSE", "PRD SMBS", "GA", "Manager", "SPV", "Foreman", "Admin MTC", "Engineer", "Teknisi"
  division: string; // e.g. "HSE", "PRD SMBS", "GA", "MTC", "LOGISTIK", "LAB"
  active: boolean;
  email?: string; // email option for user
  createdAt?: any;
  companyId?: string; // e.g. 'default', 'pt_maju'
  cabangId?: string; // branch ID or 'pusat'
  // Permissions managed by Admin
  canCreateWR?: boolean;
  canCreateWO?: boolean;
  canDeleteWR?: boolean;
  canDeleteWO?: boolean;
  canApprove?: boolean;
  canReject?: boolean;
  canAssignTeknisi?: boolean;
  canPlayWork?: boolean;
  canFinishWork?: boolean;
  canInputSAP?: boolean;
  canEditExistingSAP?: boolean;
  // New tab visibility permissions
  canShowTabWR?: boolean;
  canShowTabWO?: boolean;
  canShowTabPP?: boolean;
  canShowTabProjects?: boolean;
  canShowTabPM?: boolean;
  canShowTabKelistrikan?: boolean;
  canManageKelistrikan?: boolean;
  canManagePMAssets?: boolean;
  canInputPMReading?: boolean;
  canDeleteInventory?: boolean;
  canShowTabAssets?: boolean;
  canShowTabReports?: boolean;
  canShowTabInventory?: boolean;
}

export interface ElectricityReport {
  id: string; // generated ID or customized format
  tanggalLaporan: string; // YYYY-MM-DD
  multiplier: number;
  tarifLWBP: number;
  tarifWBP: number;
  tarifKVArh: number;
  pajakPPJ: number; // e.g. 3 for 3%
  
  standAwalLWBP: number;
  standAwalWBP: number;
  standAwalKVArh: number;
  
  standAkhirLWBP: number;
  standAkhirWBP: number;
  standAkhirKVArh: number;
  
  // Calculated fields
  selisihLWBP: number;
  selisihWBP: number;
  selisihKVArh: number;
  
  pemakaianLWBP: number; // selisih * multiplier
  pemakaianWBP: number; // selisih * multiplier
  pemakaianKVArh: number; // selisih * multiplier
  
  totalKWh: number; // pemakaianLWBP + pemakaianWBP
  batasToleransiKVArh: number; // 0.62 * totalKWh
  kelebihanKVArh: number; // max(0, pemakaianKVArh - batasToleransiKVArh)
  
  biayaLWBP: number; // pemakaianLWBP * tarifLWBP
  biayaWBP: number; // pemakaianWBP * tarifWBP
  biayaDendaKVArh: number; // kelebihanKVArh * tarifKVArh
  subtotalBiaya: number; // biayaLWBP + biayaWBP + biayaDendaKVArh
  nominalPajak: number; // subtotalBiaya * (pajakPPJ / 100)
  totalBayar: number; // subtotalBiaya + nominalPajak
  
  createdBy: string; // username
  createdByName: string; // name
  createdAt: any;
  companyId?: string;
  cabangId?: string;
}

export interface WorkRequest {
  id: string; // Custom auto ID: WR/DIV/YYYY/ROMAN/XXX
  nomorWR: string;
  masalah: string;
  tindakan: string;
  namaPengaju: string;
  tanggalArea: string; // "Area / Lokasi Kerja"
  namaMesin: string;
  tanggalPengajuan: string; // YYYY-MM-DD
  divisiPengaju: string;
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  createdAt: any;
  prioritas?: 'rendah' | 'sedang' | 'tinggi' | 'emergency';
  tujuan?: 'perawatan' | 'inspeksi' | 'perbaikan';
  tindakanMaintenance?: 'sendiri' | 'vendor';
  companyId?: string;
  cabangId?: string;
  alasanPending?: string;
  alasanDitolak?: string;
}

export interface ProjectProgressReport {
  id: string;
  tanggal: string;
  laporan: string;
  namaPelapor: string;
  attachmentUrl?: string;
  attachmentName?: string;
}

export interface Project {
  id: string;
  namaProject: string;
  deskripsi?: string;
  teknisi: string[]; // usernames or names
  progres: number; // percentage (0 to 100)
  status: 'planning' | 'inprogress' | 'inreview' | 'done' | 'suspended' | 'perencanaan' | 'berjalan' | 'selesai' | 'tertunda';
  tanggalMulai: string;
  tanggalSelesaiTarget?: string;
  laporanProgres: ProjectProgressReport[];
  createdAt: any;
  companyId?: string;
  cabangId?: string;
  pic?: string;
  linkedWOId?: string;
  
  // CMMS Extensions for Proyek & Konstruksi
  budgetEstimasi?: number; // RAB Estimasi
  budgetRealisasi?: number; // Pengeluaran Aktual
  materials?: {
    id: string;
    namaBarang: string;
    jumlah: number;
    satuan: string;
    estimasiHarga?: number;
    status: 'tersedia' | 'dipesan' | 'habis';
  }[];
  vendors?: {
    id: string;
    namaVendor: string;
    kontak?: string;
    peran: string; // e.g. "Kontraktor Sipil", "Vendor MEP", "Atap"
    biayaKontrak?: number;
  }[];
  documents?: {
    id: string;
    namaDokumen: string;
    tipeDokumen: 'blueprint' | 'manual' | 'handover' | 'kalibrasi' | 'lainnya';
    url: string; // Base64 url
    uploadedAt: string;
    uploadedBy: string;
  }[];
}

export interface PreventiveMaintenance {
  id: string;
  namaAlat: string;
  deskripsi?: string;
  kodeAlat?: string; // asset code
  lokasi?: string;
  frekuensi?: 'harian' | 'mingguan' | 'bulanan' | 'tahunan' | 'custom' | 'none';
  hariInterval?: number; // if custom (interval value)
  customIntervalUnit?: 'hari' | 'minggu' | 'bulan' | 'tahun'; // custom interval unit
  tanggalTerakhirPengecekan?: string; // YYYY-MM-DD
  tanggalBerikutnyaPengecekan?: string; // YYYY-MM-DD
  otomatisWR: boolean;
  status: 'aktif' | 'nonaktif';
  createdAt: any;
  companyId?: string;
  cabangId?: string;
  // Vehicle monitoring fields
  isVehicle?: boolean;
  vehicleTrackingMode?: 'kilometer' | 'runhour' | 'cycles';
  vehicleLastReading?: number;
  vehicleIntervalReading?: number;
  vehicleTargetReading?: number;
  vehicleReadingHistory?: {
    id: string;
    tanggal: string;
    nilai: number;
    petugas: string;
  }[];
}

export interface WorkOrder {
  id: string; // Custom auto ID: WO/MNT/YYYY/ROMAN/XXX
  nomorWO: string;
  nomorWR: string; // reference to WR id or "DIRECT" if created directly by Admin
  tanggalWO: string; // YYYY-MM-DD
  area: string;
  namaMesin: string;
  jenisTindakan: string;
  uraianPekerjaan: string;
  tipePenugasan: 'vendor' | 'teknisi';
  namaVendor: string; // populated if vendor
  teknisiDitugaskan: string[]; // array of usernames or names
  diajukanOleh: string; // Management user full name/username
  status: 'pending' | 'di_kerjakan' | 'selesai';
  playAt?: string; // string timestamp
  finishAt?: string; // string timestamp
  notes?: string; // closure notes or comments
  createdAt: any;
  prioritas?: 'rendah' | 'sedang' | 'tinggi' | 'emergency';
  playPhoto?: string; // optional technician start photo (base64 or URL)
  finishPhoto?: string; // optional technician finish photo (base64 or URL)
  fotoPlay?: string; // photo on start work
  fotoFinish?: string; // photo on complete work
  companyId?: string;
  cabangId?: string;
  sapNumber?: string;
  // Extended Fields
  dueDate?: string;
  fotoKerusakan?: string;
  fotoHasilPerbaikan?: string;
  technicalNotes?: string;
  sparePartId?: string;
  sparePartName?: string;
  sparePartQty?: number;
}

export interface GoodsRequestItem {
  namaBarang: string;
  jumlah: number;
  satuan: string;
  kegunaan: string;
  referensiLink?: string;
  referensiFotoUrl?: string;
}

export interface GoodsRequest {
  id: string; // e.g. PP/MNT/YYYY/ROMAN/XXX
  nomorPP: string;
  namaBarang: string; // Legacy/Fallback for first item
  jumlah: number;     // Legacy/Fallback for first item
  satuan: string;     // Legacy/Fallback for first item
  kegunaan: string;   // Legacy/Fallback for first item
  itemsList?: GoodsRequestItem[]; // Support multiple items (new)
  diajukanOleh: string;
  divisiPengaju: string;
  tanggalPengajuan: string;
  status: 'permintaan' | 'penyetujuan' | 'pemesanan' | 'telah_datang' | 'selesai_dan_diambil' | 'ditolak' | 'pending' | 'disetujui' | 'selesai'; // support fallback/backward compatibility
  approvedOleh?: string;
  approvedAt?: string;
  orderedOleh?: string;
  orderedAt?: string;
  arrivedOleh?: string;
  arrivedAt?: string;
  lokasiBarang?: string; // location of the item for collection
  completedOleh?: string;
  completedAt?: string;
  namaPengambil?: string; // The person who took/received the items
  createdAt: any;
  companyId?: string;
  cabangId?: string;
}

export interface ForumMessage {
  id: string;
  senderName: string;
  senderRole: string;
  senderDivision: string;
  message: string;
  createdAt: any;
  attachmentUrl?: string; // base64 or file path
  attachmentName?: string; // file name
  attachmentType?: 'image' | 'document';
  companyId?: string;
  editedAt?: string;
  isEdited?: boolean;
}

export interface NotificationItem {
  id: string;
  targetUsername: string; // user who receives this notification
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning';
  read: boolean;
  createdAt: string;
  companyId?: string;
}

export interface Asset {
  id: string;
  code: string;
  name: string;
  category: string; // e.g. "Produksi", "Kelistrikan", "Utilitas", "Sarana"
  location: string;
  status: 'running' | 'down' | 'maintenance';
  criticality: 'critical' | 'high' | 'medium' | 'low';
  lastMaintenance?: string;
  nextMaintenance?: string;
  companyId?: string;
  cabangId?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  location: string;
  price: number;
  category: string; // e.g. "Mechanical", "Electrical", "Pneumatic", "Consumables"
  companyId?: string;
  cabangId?: string;
  createdAt: string;
}

