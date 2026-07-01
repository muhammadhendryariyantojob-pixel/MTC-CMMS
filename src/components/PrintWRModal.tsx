import React, { useState } from 'react';
import { WorkRequest, Company, CompanyBranch } from '../types';
import { X, Printer, Download } from 'lucide-react';

interface PrintWRModalProps {
  isOpen: boolean;
  onClose: () => void;
  wr: WorkRequest;
  companies: Company[];
  branches?: CompanyBranch[];
}

export default function PrintWRModal({ isOpen, onClose, wr, companies, branches = [] }: PrintWRModalProps) {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);

  const companyObj = companies.find(c => c.id === wr.companyId);
  const branchObj = wr.cabangId && wr.cabangId !== 'pusat'
    ? branches.find(b => b.id === wr.cabangId)
    : null;

  const wrFormat = branchObj?.wrFormat || companyObj?.wrFormat;

  const companyName = wrFormat?.companyName || branchObj?.name || companyObj?.name || 'PT DUNIA KIMIA JAYA';
  const addressLine1 = wrFormat?.addressLine1 || (branchObj ? 'Alamat Cabang: ' + (branchObj.address || '-') : 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
  const addressLine2 = wrFormat?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887';
  const documentTitle = wrFormat?.documentTitle || 'PERMINTAAN KERJA DAN PERBAIKAN';
  const documentCode = wrFormat?.documentCode || 'C.MNT.002-02/R1';
  const signature1 = wrFormat?.signature1 || 'Diajukan Oleh';
  const signature2 = wrFormat?.signature2 || 'Diterima oleh';

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('print-area');
    if (!element) return;

    setIsDownloading(true);

    const opt = {
      margin:       [0.4, 0.4, 0.4, 0.4],
      filename:     `WR_${wr.nomorWR.replace(/\//g, '_')}.pdf`,
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

  const isPerawatan = wr.tujuan === 'perawatan';
  const isInspeksi = wr.tujuan === 'inspeksi';
  const isPerbaikan = wr.tujuan === 'perbaikan' || !wr.tujuan;

  const isSendiri = wr.tindakanMaintenance === 'sendiri' || !wr.tindakanMaintenance;
  const isVendor = wr.tindakanMaintenance === 'vendor';

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Printer className="w-5 h-5 text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-800">Pratinjau Cetak Work Request (PDF)</h3>
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
                {wrFormat?.logoUrl ? (
                  <img src={wrFormat.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" referrerPolicy="no-referrer" />
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

            {/* Grid Form Fields (Exact double-border layout style) */}
            <div className="border border-black text-[11px] text-black">
              
              {/* Row 1: NAMA MESIN | DEPT | TANGGAL */}
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-5 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">NAMA MESIN</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wr.namaMesin}</span>
                </div>
                <div className="col-span-3 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">DEPT.</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wr.divisiPengaju}</span>
                </div>
                <div className="col-span-4 p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">TANGGAL</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{wr.tanggalPengajuan}</span>
                </div>
              </div>

              {/* Row 2: AREA | PIC | NO. WR */}
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-5 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">AREA</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wr.tanggalArea}</span>
                </div>
                <div className="col-span-3 border-r border-black p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">PIC</span>
                  <span className="font-bold text-xs uppercase text-slate-800">{wr.namaPengaju}</span>
                </div>
                <div className="col-span-4 p-2 min-h-[55px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1">NO. WR</span>
                  <span className="font-mono text-xs font-bold text-slate-800">{wr.nomorWR}</span>
                </div>
              </div>

              {/* Row 3: Tujuan Section */}
              <div className="p-2.5 border-b border-black flex items-center gap-6 bg-slate-50/50">
                <span className="font-extrabold text-[10px] uppercase tracking-wider">Tujuan :</span>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] font-black bg-white rounded-xs`}>
                      {isPerawatan ? '✓' : ''}
                    </span>
                    Perawatan
                  </label>
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] font-black bg-white rounded-xs`}>
                      {isInspeksi ? '✓' : ''}
                    </span>
                    Inspeksi
                  </label>
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className={`w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] font-black bg-white rounded-xs`}>
                      {isPerbaikan ? '✓' : ''}
                    </span>
                    Perbaikan
                  </label>
                </div>
              </div>

              {/* Row 4: Uraian Masalah */}
              <div className="border-b border-black p-3">
                <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1.5">Uraian Masalah</span>
                <div className="min-h-[100px] text-xs font-medium text-slate-800 leading-relaxed bg-white p-2 rounded border border-slate-100 whitespace-pre-wrap">
                  {wr.masalah}
                </div>
              </div>

              {/* Row 5: Tindakan yang perlu dilakukan */}
              <div className="border-b border-black p-3">
                <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-1.5 font-sans">Tindakan yang perlu dilakukan</span>
                <div className="min-h-[100px] text-xs font-medium text-slate-800 leading-relaxed bg-white p-2 rounded border border-slate-100 whitespace-pre-wrap">
                  {wr.tindakan}
                </div>
              </div>

              {/* Row 6: Tindakan Maintenance */}
              <div className="p-2.5 border-b border-black flex items-center gap-6 bg-slate-50/50">
                <span className="font-extrabold text-[10px] uppercase tracking-wider">Tindakan Maintenance :</span>
                <div className="flex items-center gap-5">
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] font-black bg-white rounded-xs">
                      {isSendiri ? '✓' : ''}
                    </span>
                    Dikerjakan Sendiri
                  </label>
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className="w-3.5 h-3.5 border border-black flex items-center justify-center text-[10px] font-black bg-white rounded-xs">
                      {isVendor ? '✓' : ''}
                    </span>
                    Perlu : PP / PJL
                  </label>
                </div>
              </div>

              {/* Row 7: SparePart Table */}
              <div className="p-3">
                <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-2">SparePart yang perlu diganti</span>
                <table className="w-full border-collapse border border-black text-[10px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-black font-extrabold text-black">
                      <th className="border-r border-black p-1.5 w-10 text-center">No.</th>
                      <th className="border-r border-black p-1.5 text-left">Nama Barang</th>
                      <th className="border-r border-black p-1.5 w-20 text-center">Jumlah</th>
                      <th className="p-1.5 text-left">Keterangan</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((num) => (
                      <tr key={num} className="border-b border-black last:border-b-0">
                        <td className="border-r border-black p-1.5 text-center font-bold text-black h-7">{num}</td>
                        <td className="border-r border-black p-1.5"></td>
                        <td className="border-r border-black p-1.5"></td>
                        <td className="p-1.5"></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Row 8: Signatures Box */}
              <div className="grid grid-cols-2 border-t border-black">
                <div className="border-r border-black p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature1}</span>
                  <div className="h-10"></div> {/* Space for signature */}
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800">
                    {wr.namaPengaju}
                  </div>
                </div>
                <div className="p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature2}</span>
                  <div className="h-10 flex items-center justify-center">
                    {wr.status === 'approved' || wr.status === 'converted' ? (
                      <span className="text-[9px] text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded font-black font-mono">
                        APPROVED VIA MTC
                      </span>
                    ) : null}
                  </div> {/* Space for signature */}
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800">
                    {wr.status === 'approved' || wr.status === 'converted' ? 'Tim Maintenance (MTC)' : '...........................................'}
                  </div>
                </div>
              </div>

            </div>

            {/* Form Code in Bottom Left */}
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
