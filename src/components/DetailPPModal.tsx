import React, { useState } from 'react';
import { GoodsRequest, CompanyBranch, Company } from '../types';
import { 
  X, 
  ExternalLink, 
  Image as ImageIcon, 
  Calendar, 
  User, 
  Layers, 
  MapPin, 
  CheckCircle, 
  Clock, 
  Truck, 
  FileCheck,
  ShoppingBag,
  Printer
} from 'lucide-react';

interface DetailPPModalProps {
  isOpen: boolean;
  onClose: () => void;
  pp: GoodsRequest;
  branches: CompanyBranch[];
  companies: Company[];
  onPrint?: (pp: GoodsRequest) => void;
}

export default function DetailPPModal({ isOpen, onClose, pp, branches, companies, onPrint }: DetailPPModalProps) {
  const [zoomImage, setZoomImage] = useState<string | null>(null);

  if (!isOpen) return null;

  const isPending = pp.status === 'pending' || pp.status === 'permintaan';
  const isApproved = pp.status === 'disetujui' || pp.status === 'penyetujuan';
  const isOrdered = pp.status === 'pemesanan';
  const isArrived = pp.status === 'telah_datang';
  const isCompleted = pp.status === 'selesai' || pp.status === 'selesai_dan_diambil';

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'permintaan':
      case 'pending':
        return <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Permintaan</span>;
      case 'penyetujuan':
      case 'disetujui':
        return <span className="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Disetujui</span>;
      case 'pemesanan':
        return <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Pemesanan</span>;
      case 'telah_datang':
        return <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Telah Datang</span>;
      case 'selesai':
      case 'selesai_dan_diambil':
        return <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Selesai & Diambil</span>;
      case 'ditolak':
        return <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">Ditolak</span>;
      default:
        return <span className="px-2.5 py-1 bg-slate-50 text-slate-700 border border-slate-200 rounded-full text-[10px] font-extrabold uppercase tracking-wide">{status}</span>;
    }
  };

  // Safe fetch itemsList or fall back to single item
  const items = pp.itemsList && pp.itemsList.length > 0
    ? pp.itemsList
    : [{
        namaBarang: pp.namaBarang,
        jumlah: pp.jumlah,
        satuan: pp.satuan,
        kegunaan: pp.kegunaan,
        referensiLink: '',
        referensiFotoUrl: ''
      }];

  const currentBranch = branches.find(b => b.id === pp.cabangId);
  const currentCompany = companies.find(c => c.id === pp.companyId);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-[100] overflow-y-auto" id="detail-pp-modal-overlay">
      <div className="bg-white dark:bg-slate-900 rounded-2xl max-w-3xl w-full border border-slate-100 dark:border-slate-800 shadow-2xl overflow-hidden flex flex-col my-8" id="detail-pp-modal-box">
        
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2 uppercase tracking-wider">
              <ShoppingBag className="w-5 h-5 text-indigo-600" />
              Detail Permintaan Barang (PP)
            </h3>
            <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pp.nomorPP}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 dark:text-slate-500 hover:text-slate-600 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[70vh]">
          
          {/* Top Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 dark:bg-slate-900/20 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Tanggal Pengajuan</span>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                {pp.tanggalPengajuan}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Diajukan Oleh</span>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-slate-400" />
                {pp.diajukanOleh}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Divisi</span>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mt-1 flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-slate-400" />
                {pp.divisiPengaju}
              </div>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold uppercase block">Penempatan Unit</span>
              <div className="text-xs font-bold text-rose-700 mt-1 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-rose-500" />
                {pp.cabangId === 'pusat' || !pp.cabangId ? 'Pusat' : (currentBranch?.name || 'Pusat')}
              </div>
            </div>
          </div>

          {/* Stepper Progress */}
          <div className="space-y-3 bg-slate-50/50 dark:bg-slate-900/10 p-4 rounded-xl border border-slate-100 dark:border-slate-850">
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Status Alur Permintaan</span>
              <div>{getStatusBadge(pp.status)}</div>
            </div>
            <div className="grid grid-cols-5 gap-2 pt-1">
              {[
                { step: 1, label: 'Minta', desc: 'Diajukan', active: isPending || isApproved || isOrdered || isArrived || isCompleted },
                { step: 2, label: 'Setuju', desc: pp.approvedOleh ? `Oleh: ${pp.approvedOleh}` : 'Validasi', active: isApproved || isOrdered || isArrived || isCompleted },
                { step: 3, label: 'Pesan', desc: pp.orderedOleh ? `Oleh: ${pp.orderedOleh}` : 'Pemesanan', active: isOrdered || isArrived || isCompleted },
                { step: 4, label: 'Datang', desc: pp.lokasiBarang ? `Di: ${pp.lokasiBarang}` : 'Kedatangan', active: isArrived || isCompleted },
                { step: 5, label: 'Selesai', desc: pp.namaPengambil ? `Oleh: ${pp.namaPengambil}` : 'Diambil', active: isCompleted }
              ].map((st) => (
                <div key={st.step} className="text-center space-y-1.5">
                  <div className={`h-1.5 rounded-full transition-all duration-300 ${st.active ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-slate-800'}`} />
                  <span className={`text-[10px] font-extrabold block uppercase ${st.active ? 'text-indigo-700 dark:text-indigo-400' : 'text-slate-400 dark:text-slate-600'}`}>{st.label}</span>
                  <span className="text-[8px] text-slate-400 dark:text-slate-500 block leading-tight truncate px-0.5" title={st.desc}>{st.desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle className="w-4 h-4 text-indigo-600" />
              Daftar Barang yang Diminta ({items.length} Item)
            </h4>
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 text-[10px] uppercase font-extrabold tracking-wider">
                  <tr>
                    <th className="px-4 py-3 text-center w-12">No</th>
                    <th className="px-4 py-3">Nama Barang</th>
                    <th className="px-4 py-3 w-24">Jumlah</th>
                    <th className="px-4 py-3">Kegunaan</th>
                    <th className="px-4 py-3 text-center w-28">Referensi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/40 dark:hover:bg-slate-800/10">
                      <td className="px-4 py-3 text-center font-mono font-bold text-slate-400">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-slate-800 dark:text-slate-200 uppercase">{item.namaBarang}</div>
                        <div className="mt-1 flex">
                          {item.inventoryId ? (
                            <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold tracking-wider whitespace-nowrap">DIAMBIL DI INVENTORY</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded border border-amber-200 bg-amber-50 text-amber-600 text-[8px] font-bold tracking-wider whitespace-nowrap">PEMBELIAN BARU</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 font-mono">
                        <span className="text-indigo-600 dark:text-indigo-400 font-extrabold">{item.jumlah}</span> <span className="font-semibold text-slate-600 dark:text-slate-400">{item.satuan}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400 italic">
                        "{item.kegunaan || 'Kebutuhan Unit'}"
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {/* Reference Link */}
                          {item.referensiLink ? (
                            <a 
                              href={item.referensiLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/40 dark:hover:bg-indigo-900/50 border border-indigo-100 dark:border-indigo-900 text-indigo-600 dark:text-indigo-400 rounded-lg transition"
                              title="Buka Link Referensi"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-slate-300 font-mono">-</span>
                          )}

                          {/* Reference Photo */}
                          {item.referensiFotoUrl ? (
                            <button
                              type="button"
                              onClick={() => setZoomImage(item.referensiFotoUrl || null)}
                              className="p-1.5 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:hover:bg-emerald-900/50 border border-emerald-100 dark:border-emerald-900 text-emerald-600 dark:text-emerald-400 rounded-lg transition"
                              title="Lihat Foto Referensi"
                            >
                              <ImageIcon className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            item.referensiLink ? null : <span className="text-[10px] text-slate-300 font-mono">-</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Logistics Receiver info */}
          {pp.namaPengambil && (
            <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-4 rounded-xl flex items-start gap-3">
              <FileCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-emerald-900 dark:text-emerald-300 block font-bold text-xs uppercase tracking-wider">Status Serah Terima / Pengambilan:</strong>
                <p className="text-slate-700 dark:text-slate-300 text-xs mt-1">
                  Barang telah berhasil diserahkan kepada: <span className="font-extrabold bg-white dark:bg-slate-800 border border-emerald-200 dark:border-emerald-900 px-2 py-0.5 rounded text-emerald-700 dark:text-emerald-300 uppercase">{pp.namaPengambil}</span> pada tanggal <span className="font-semibold">{pp.completedAt || pp.arrivedAt || pp.tanggalPengajuan}</span>.
                </p>
              </div>
            </div>
          )}

          {/* Approval Log / History */}
          <div className="space-y-3">
            <h4 className="text-xs font-extrabold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              Log Histori Transaksi
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="border border-slate-100 dark:border-slate-850 p-3 rounded-xl bg-slate-50/30 dark:bg-slate-900/10 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase">
                  <span>Persetujuan PP</span>
                  <CheckCircle className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                {pp.approvedOleh ? (
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Disetujui Oleh: <span className="text-indigo-600 dark:text-indigo-400">{pp.approvedOleh}</span></p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pp.approvedAt}</p>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Belum disetujui / divalidasi</p>
                )}
              </div>

              <div className="border border-slate-100 dark:border-slate-850 p-3 rounded-xl bg-slate-50/30 dark:bg-slate-900/10 space-y-2">
                <div className="flex items-center justify-between text-[10px] font-extrabold text-slate-400 uppercase">
                  <span>Pembelian / Pemesanan</span>
                  <Truck className="w-3.5 h-3.5 text-blue-500" />
                </div>
                {pp.orderedOleh ? (
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-200">Dipesan Oleh: <span className="text-blue-600 dark:text-blue-400">{pp.orderedOleh}</span></p>
                    <p className="text-[10px] text-slate-400 font-mono mt-0.5">{pp.orderedAt}</p>
                  </div>
                ) : (
                  <p className="text-slate-400 italic">Belum dipesan / dibeli</p>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
          {onPrint && (
            <button
              onClick={() => onPrint(pp)}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-xl transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak PP</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-5 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition cursor-pointer"
          >
            Tutup Detail
          </button>
        </div>

      </div>

      {/* Image Zoom Lightbox */}
      {zoomImage && (
        <div 
          className="fixed inset-0 bg-slate-950/80 z-55 flex flex-col items-center justify-center p-4 cursor-pointer"
          onClick={() => setZoomImage(null)}
          id="detail-pp-image-zoom"
        >
          <div className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full hover:bg-black/60 transition">
            <X className="w-6 h-6" />
          </div>
          <img 
            src={zoomImage} 
            alt="Foto Referensi Detail" 
            className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-white/10 object-contain"
            referrerPolicy="no-referrer"
          />
          <p className="text-white text-xs font-semibold mt-4 bg-black/60 px-4 py-2 rounded-full">Klik di mana saja untuk menutup</p>
        </div>
      )}
    </div>
  );
}
