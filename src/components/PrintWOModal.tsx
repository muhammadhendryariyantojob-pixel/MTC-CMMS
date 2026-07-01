import React, { useState } from 'react';
import { WorkOrder, Company, UserProfile, CompanyBranch } from '../types';
import { X, Printer, MapPin, Calendar, Clock, User, Wrench, Download } from 'lucide-react';

interface PrintWOModalProps {
  isOpen: boolean;
  onClose: () => void;
  wo: WorkOrder;
  companies: Company[];
  branches?: CompanyBranch[];
}

export default function PrintWOModal({ isOpen, onClose, wo, companies, branches = [] }: PrintWOModalProps) {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);

  const companyObj = companies.find(c => c.id === wo.companyId);
  const branchObj = wo.cabangId && wo.cabangId !== 'pusat'
    ? branches.find(b => b.id === wo.cabangId)
    : null;

  const woFormat = branchObj?.woFormat || companyObj?.woFormat;

  const companyName = woFormat?.companyName || branchObj?.name || companyObj?.name || 'PT DUNIA KIMIA JAYA';
  const addressLine1 = woFormat?.addressLine1 || (branchObj ? 'Alamat Cabang: ' + (branchObj.address || '-') : 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
  const addressLine2 = woFormat?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887';
  const documentTitle = woFormat?.documentTitle || 'SURAT PERINTAH KERJA (WORK ORDER)';
  const documentCode = woFormat?.documentCode || 'C.MNT.003-02/R1';
  
  const signature1 = woFormat?.signature1 || 'Dibuat Oleh';
  const signature2 = woFormat?.signature2 || 'Dikerjakan Oleh';
  const signature3 = woFormat?.signature3 || 'Disetujui Oleh';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('print-area-wo');
    if (!element) return;

    setIsDownloading(true);

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `WO_${wo.nomorWO.replace(/\//g, '_')}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2.5, useCORS: true, logging: false },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };

    const runHtml2Pdf = () => {
      // @ts-ignore
      window.html2pdf().set(opt).from(element).save().then(() => {
        setIsDownloading(false);
      }).catch((err: any) => {
        console.error('PDF generation error:', err);
        setIsDownloading(false);
      });
    };

    // @ts-ignore
    if (window.html2pdf) {
      runHtml2Pdf();
    } else {
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      script.onload = runHtml2Pdf;
      script.onerror = () => {
        setIsDownloading(false);
        alert('Gagal memuat library PDF. Silakan coba lagi atau gunakan Cetak Sekarang.');
      };
      document.head.appendChild(script);
    }
  };

  const isAssignedVendor = wo.tipePenugasan === 'vendor';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Pratinjau Cetak Work Order (PDF)</h3>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownloadPDF}
              disabled={isDownloading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              {isDownloading ? 'Mengunduh...' : 'Unduh PDF'}
            </button>
            <button
              onClick={handlePrint}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              Cetak Sekarang
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          
          {/* Paper Canvas */}
          <div 
            id="print-area-wo" 
            className="bg-white p-10 max-w-2xl mx-auto border border-slate-300 shadow-lg font-sans text-slate-900 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
            style={{ minHeight: '840px' }}
          >
            
            {/* STYLES FOR PRINT ONLY */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-area-wo, #print-area-wo * {
                  visibility: visible;
                }
                #print-area-wo {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                }
              }
            `}</style>

            {/* Document Header */}
            <div className="flex items-center gap-4 border-b-2 border-black pb-4 mb-4">
              {/* Custom Uploaded Logo or Default */}
              <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center p-1 shrink-0 bg-white overflow-hidden">
                {woFormat?.logoUrl ? (
                  <img src={woFormat.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
                ) : (
                  <svg className="w-full h-full text-black" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="6">
                    <circle cx="50" cy="50" r="40" />
                    <ellipse cx="50" cy="50" rx="40" ry="15" />
                    <ellipse cx="50" cy="50" rx="15" ry="40" />
                    <line x1="50" y1="10" x2="50" y2="90" />
                    <line x1="10" y1="50" x2="90" y2="50" />
                  </svg>
                )}
              </div>

              {/* Company Info */}
              <div className="flex-1">
                <h1 className="text-base font-black tracking-wide text-black uppercase">{companyName}</h1>
                <p className="text-[10px] font-bold text-black leading-tight mt-0.5">
                  {addressLine1}
                </p>
                <p className="text-[10px] font-medium text-black leading-tight">
                  {addressLine2}
                </p>
              </div>
            </div>

            {/* Title */}
            <div className="text-center mb-6">
              <h2 className="text-sm font-extrabold tracking-wider text-black uppercase border-b border-black inline-block pb-0.5">
                {documentTitle}
              </h2>
            </div>

            {/* Grid Form Fields */}
            <div className="border border-black text-[11px] text-black">
              
              {/* Row 1: NO. WO | NO. REF WR | TANGGAL WO */}
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-5 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">NOMOR WORK ORDER</span>
                  <span className="font-mono font-bold text-xs uppercase text-slate-800">{wo.nomorWO}</span>
                </div>
                <div className="col-span-3 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">REF. WR</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{wo.nomorWR}</span>
                </div>
                <div className="col-span-4 p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">TANGGAL WO</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{wo.tanggalWO}</span>
                </div>
              </div>

              {/* Row 2: NAMA MESIN | AREA | PRIORITAS */}
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-5 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">NAMA MESIN</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wo.namaMesin}</span>
                </div>
                <div className="col-span-4 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">AREA / LOKASI</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wo.area}</span>
                </div>
                <div className="col-span-3 p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">PRIORITAS</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wo.prioritas || 'SEDANG'}</span>
                </div>
              </div>

              {/* Row 3: PENUGASAN (TEKNISI / VENDOR) */}
              <div className="p-2.5 border-b border-black bg-slate-50/50 flex items-center justify-between">
                <div>
                  <span className="font-extrabold text-[9px] uppercase tracking-wider text-black block mb-0.5">TIPE PELAKSANA :</span>
                  <span className="font-bold uppercase text-xs">{isAssignedVendor ? 'VENDOR EKSTERNAL' : 'TEKNISI INTERNAL'}</span>
                </div>
                <div className="text-right">
                  <span className="font-extrabold text-[9px] uppercase tracking-wider text-black block mb-0.5">NAMA PELAKSANA :</span>
                  <span className="font-black text-xs text-indigo-700 font-sans">
                    {isAssignedVendor ? wo.namaVendor : wo.teknisiDitugaskan.join(', ')}
                  </span>
                </div>
              </div>

              {/* Row 4: JENIS TINDAKAN & URAIAN PEKERJAAN */}
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-4 border-r border-black p-3 min-h-[100px]">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1.5">JENIS TINDAKAN</span>
                  <span className="font-bold text-xs text-slate-800 block uppercase">{wo.jenisTindakan}</span>
                </div>
                <div className="col-span-8 p-3 min-h-[100px]">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1.5 font-sans">URAIAN PEKERJAAN</span>
                  <div className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">{wo.uraianPekerjaan}</div>
                </div>
              </div>

              {/* Row 5: LAPORAN TINDAKAN PERBAIKAN / NOTES */}
              <div className="border-b border-black p-3">
                <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1.5">LAPORAN TINDAKAN PERBAIKAN TIM MTC</span>
                <div className="min-h-[80px] text-xs font-medium text-slate-800 leading-relaxed bg-slate-50/50 p-2.5 rounded border border-slate-150 whitespace-pre-wrap italic">
                  {wo.notes ? `"${wo.notes}"` : 'Belum ada laporan penyelesaian dari pelaksana.'}
                </div>
              </div>

              {/* Row 6: REALISASI WAKTU */}
              <div className="grid grid-cols-2 border-b border-black text-[10px] bg-slate-50/30">
                <div className="p-2 border-r border-black">
                  <span className="font-extrabold uppercase tracking-wider text-[8px] text-slate-500 block mb-0.5">WAKTU MULAI KERJA (START) :</span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {wo.playAt ? new Date(wo.playAt).toLocaleString('id-ID') : '-'}
                  </span>
                </div>
                <div className="p-2">
                  <span className="font-extrabold uppercase tracking-wider text-[8px] text-slate-500 block mb-0.5">WAKTU SELESAI KERJA (FINISH) :</span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {wo.finishAt ? new Date(wo.finishAt).toLocaleString('id-ID') : '-'}
                  </span>
                </div>
              </div>

              {/* Row 7: DOKUMENTASI FOTO (SIDE-BY-SIDE) */}
              {(wo.fotoPlay || wo.fotoFinish) && (
                <div className="p-3 border-b border-black">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-2">📸 DOKUMENTASI FOTO LAPANGAN</span>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-slate-200 rounded p-1 text-center bg-slate-50">
                      <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Foto Mulai Kerja (Start)</span>
                      {wo.fotoPlay ? (
                        <img src={wo.fotoPlay} alt="Foto Start" className="h-32 mx-auto object-contain rounded" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-slate-300 font-mono text-[10px]">No Photo</div>
                      )}
                    </div>
                    <div className="border border-slate-200 rounded p-1 text-center bg-slate-50">
                      <span className="text-[8px] font-bold text-slate-400 uppercase block mb-1">Foto Selesai Kerja (Finish)</span>
                      {wo.fotoFinish ? (
                        <img src={wo.fotoFinish} alt="Foto Finish" className="h-32 mx-auto object-contain rounded" referrerPolicy="no-referrer" />
                      ) : (
                        <div className="h-32 flex items-center justify-center text-slate-300 font-mono text-[10px]">No Photo</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Row 8: SIGNATURES BOX */}
              <div className="grid grid-cols-3">
                <div className="border-r border-black p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature1}</span>
                  <div className="h-10"></div>
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800">
                    {wo.diajukanOleh}
                  </div>
                </div>
                
                <div className="border-r border-black p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature2}</span>
                  <div className="h-10 flex items-center justify-center">
                    {wo.status === 'di_kerjakan' || wo.status === 'selesai' ? (
                      <span className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded font-black font-mono">
                        TIM PELAKSANA
                      </span>
                    ) : null}
                  </div>
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800 truncate">
                    {isAssignedVendor ? wo.namaVendor : wo.teknisiDitugaskan[0] || 'Pelaksana'}
                  </div>
                </div>

                <div className="p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature3}</span>
                  <div className="h-10 flex items-center justify-center">
                    {wo.status === 'selesai' ? (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-black font-mono">
                        APPROVED / CLOSED
                      </span>
                    ) : null}
                  </div>
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800">
                    MTC Supervisor
                  </div>
                </div>
              </div>

            </div>

            {/* Footer Form Code */}
            <div className="mt-4 text-[9px] font-bold text-black font-mono flex justify-between items-center">
              <span>{documentCode}</span>
              <span className="text-slate-400">Printed automatically via Maintenance System</span>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
