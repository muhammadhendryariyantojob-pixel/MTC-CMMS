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
  // New tab visibility permissions
  canShowTabWR?: boolean;
  canShowTabWO?: boolean;
  canShowTabPP?: boolean;
}

export interface WorkRequest {
  id: string; // Custom auto ID: WR/DIV/YYYY/ROMAN/XXX
  nomorWR: string;
  masalah: string;
  tindakan: string;
  namaPengaju: string;
  tanggalArea: string; // "Tanggal & Area"
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
