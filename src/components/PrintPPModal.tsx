import React, { useState } from 'react';
import { GoodsRequest, Company, CompanyBranch } from '../types';
import { X, Printer, Download } from 'lucide-react';

interface PrintPPModalProps {
  isOpen: boolean;
  onClose: () => void;
  pp: GoodsRequest;
  companies: Company[];
  branches?: CompanyBranch[];
}

export default function PrintPPModal({ isOpen, onClose, pp, companies, branches = [] }: PrintPPModalProps) {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);

  const companyObj = companies.find(c => c.id === pp.companyId);
  const branchObj = pp.cabangId && pp.cabangId !== 'pusat'
    ? branches.find(b => b.id === pp.cabangId)
    : null;

  const ppFormat = branchObj?.ppFormat || companyObj?.ppFormat;

  const companyName = ppFormat?.companyName || branchObj?.name || companyObj?.name || 'PT DUNIA KIMIA JAYA';
  const addressLine1 = ppFormat?.addressLine1 || (branchObj ? 'Alamat Cabang: ' + (branchObj.address || '-') : 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
  const addressLine2 = ppFormat?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887';
  const documentTitle = ppFormat?.documentTitle || 'PERMINTAAN PEMBELIAN & PENYEDIAAN BARANG';
  const documentCode = ppFormat?.documentCode || 'C.MNT.004-02/R1';
  const signature1 = ppFormat?.signature1 || 'Diajukan Oleh';
  const signature2 = ppFormat?.signature2 || 'Disetujui Oleh';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('print-area');
    if (!element) return;

    setIsDownloading(true);

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `PP_${pp.nomorPP.replace(/\//g, '_')}.pdf`,
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

  // Prepare items list (multi-item support)
  const items = pp.itemsList && pp.itemsList.length > 0
    ? pp.itemsList
    : [{
        namaBarang: pp.namaBarang,
        jumlah: pp.jumlah,
        satuan: pp.satuan,
        kegunaan: pp.kegunaan
      }];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Pratinjau Cetak Permintaan Barang (PP)</h3>
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
          
          {/* Paper Canvas (The exact high-fidelity paper to print) */}
          <div 
            id="print-area" 
            className="bg-white p-10 max-w-2xl mx-auto border border-slate-300 shadow-lg font-sans text-slate-900 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
            style={{ minHeight: '840px' }}
          >
            
            {/* STYLES FOR PRINT ONLY */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-area, #print-area * {
                  visibility: visible;
                }
                #print-area {
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
              {/* Spherical custom Logo or custom uploaded logo */}
              <div className="w-16 h-16 border-2 border-black rounded-lg flex items-center justify-center p-1 shrink-0 bg-white overflow-hidden">
                {ppFormat?.logoUrl ? (
                  <img src={ppFormat.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
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

            {/* Meta Info Panel */}
            <div className="border border-black p-3 mb-6 grid grid-cols-2 gap-4 text-[11px] text-black bg-slate-50/20">
              <div>
                <p className="mb-1"><span className="font-extrabold uppercase w-28 inline-block">NOMOR PP</span>: <span className="font-mono font-bold text-xs">{pp.nomorPP}</span></p>
                <p className="mb-1"><span className="font-extrabold uppercase w-28 inline-block">DIAJUKAN OLEH</span>: <span className="font-bold text-xs uppercase">{pp.diajukanOleh}</span></p>
              </div>
              <div>
                <p className="mb-1"><span className="font-extrabold uppercase w-28 inline-block">DIVISI</span>: <span className="font-bold uppercase">{pp.divisiPengaju}</span></p>
                <p className="mb-1"><span className="font-extrabold uppercase w-28 inline-block">TANGGAL</span>: <span className="font-mono font-bold">{pp.tanggalPengajuan}</span></p>
              </div>
            </div>

            {/* Table of Items (Clean, High-Fidelity) */}
            <div className="border border-black mb-10 text-[11px] text-black">
              {/* Table Header */}
              <div className="grid grid-cols-12 bg-slate-100 font-extrabold uppercase tracking-wider text-[9px] text-black border-b border-black text-center py-2">
                <div className="col-span-1 border-r border-black">NO</div>
                <div className="col-span-5 border-r border-black text-left pl-3">NAMA BARANG</div>
                <div className="col-span-2 border-r border-black">JUMLAH</div>
                <div className="col-span-2 border-r border-black">SATUAN</div>
                <div className="col-span-2">KEGUNAAN</div>
              </div>

              {/* Table Rows */}
              {items.map((item, index) => (
                <div key={index} className="grid grid-cols-12 border-b border-slate-350 py-2.5 items-center text-center last:border-b-0">
                  <div className="col-span-1 border-r border-slate-300 font-mono text-black font-semibold">{index + 1}</div>
                  <div className="col-span-5 border-r border-slate-300 text-left pl-3 font-bold uppercase">{item.namaBarang}</div>
                  <div className="col-span-2 border-r border-slate-300 font-mono text-black font-semibold text-xs">{item.jumlah}</div>
                  <div className="col-span-2 border-r border-slate-300 font-semibold uppercase">{item.satuan}</div>
                  <div className="col-span-2 px-2 text-left italic uppercase font-medium text-slate-700">{item.kegunaan}</div>
                </div>
              ))}
            </div>

            {/* Status of Item (Location if Arrived/Selesai) */}
            {pp.lokasiBarang && (
              <div className="border-2 border-emerald-500 bg-emerald-50/20 p-3 rounded-lg mb-8 text-[11px] text-emerald-900 flex items-center justify-between">
                <div>
                  <span className="font-extrabold uppercase block text-[9px] text-emerald-700 tracking-wide">LOKASI PENYIMPANAN SPERPART</span>
                  <span className="font-black text-xs block mt-0.5">{pp.lokasiBarang}</span>
                </div>
                <span className="text-[10px] bg-emerald-500 text-white px-2.5 py-1 rounded font-bold uppercase">Ready / Datang</span>
              </div>
            )}

            {/* Signature Area (Exactly matching the bottom of paper canvas) */}
            <div className="mt-16 text-black text-xs" style={{ pageBreakInside: 'avoid' }}>
              <div className="grid grid-cols-2 text-center font-bold">
                
                {/* Signature 1: Diajukan */}
                <div className="flex flex-col items-center justify-between min-h-[120px]">
                  <span className="uppercase tracking-wider text-[10px] font-extrabold">{signature1}</span>
                  <div className="border-b border-black w-40 pb-1 mt-12">
                    <span className="uppercase font-extrabold text-[11px]">{pp.diajukanOleh}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">Tanggal: {pp.tanggalPengajuan}</span>
                </div>

                {/* Signature 2: Disetujui */}
                <div className="flex flex-col items-center justify-between min-h-[120px]">
                  <span className="uppercase tracking-wider text-[10px] font-extrabold">{signature2}</span>
                  <div className="border-b border-black w-40 pb-1 mt-12">
                    <span className="uppercase font-extrabold text-[11px]">
                      {pp.approvedOleh || '..........................'}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">
                    Tanggal: {pp.approvedAt ? pp.approvedAt.split(' ')[0] : '..................'}
                  </span>
                </div>

              </div>
            </div>

            {/* Document Footer Code (Absolute bottom position on paper) */}
            <div className="mt-16 pt-2 border-t border-slate-300 text-right">
              <span className="font-mono text-[9px] font-extrabold text-slate-400">
                {documentCode}
              </span>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
