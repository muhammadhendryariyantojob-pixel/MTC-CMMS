import React, { useState } from 'react';
import { WorkRequest, Company, CompanyBranch } from '../types';
import { X, Printer, Download, Image } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import ApprovedStamp from './ApprovedStamp';

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
  const [showKop, setShowKop] = useState(true);

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

  const handleDownloadPNG = async () => {
    const element = document.getElementById('print-area-wr');
    if (!element) return;

    setIsDownloading(true);

    // Temporarily replace oklch colors in style tags to prevent html2canvas parser from crashing
    const styleElements = Array.from(document.querySelectorAll('style'));
    const originalStyles = styleElements.map(el => el.textContent || '');
    
    styleElements.forEach(el => {
      if (el.textContent && el.textContent.includes('oklch')) {
        // Replace oklch(...) with a safe fallback color like rgb(99, 102, 241) or standard slate gray
        el.textContent = el.textContent.replace(/oklch\([^)]+\)/g, 'rgb(99, 102, 241)');
      }
    });

    try {
      const canvas = await html2canvas(element, {
        scale: 2.5, // High resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `WR_${wr.nomorWR.replace(/\//g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('PNG download error:', error);
      alert('Gagal membuat gambar PNG.');
    } finally {
      // Restore original styles
      styleElements.forEach((el, index) => {
        el.textContent = originalStyles[index];
      });
      setIsDownloading(false);
    }
  };

  const isPerawatan = wr.tujuan === 'perawatan';
  const isInspeksi = wr.tujuan === 'inspeksi';
  const isPerbaikan = wr.tujuan === 'perbaikan' || !wr.tujuan;

  const isSendiri = wr.tindakanMaintenance === 'sendiri' || !wr.tindakanMaintenance;
  const isVendor = wr.tindakanMaintenance === 'vendor';

  const handleDownloadExcel = () => {
    setIsDownloading(true);
    try {
      const data: any[] = [];

      // 1. Header (Kop Surat) if showKop is true
      if (showKop) {
        data.push([companyName]);
        data.push([addressLine1]);
        data.push([addressLine2]);
        data.push([]);
      }

      // 2. Title
      data.push([documentTitle]);
      data.push([]);

      // 3. Grid Form Fields
      data.push(['NAMA MESIN', wr.namaMesin, '', 'DEPT.', wr.divisiPengaju, '', 'TANGGAL', wr.tanggalPengajuan]);
      data.push(['AREA', wr.tanggalArea, '', 'PIC', wr.namaPengaju, '', 'NO. WR', wr.nomorWR]);
      data.push([]);

      // 4. Tujuan
      data.push([
        'TUJUAN', 
        (isPerawatan ? '[✓] Perawatan' : '[ ] Perawatan') + '   ' + 
        (isInspeksi ? '[✓] Inspeksi' : '[ ] Inspeksi') + '   ' + 
        (isPerbaikan ? '[✓] Perbaikan' : '[ ] Perbaikan')
      ]);
      data.push([]);

      // 5. Uraian Masalah
      data.push(['URAIAN MASALAH']);
      data.push([wr.masalah]);
      data.push([]);

      // 6. Tindakan yang perlu dilakukan
      data.push(['TINDAKAN YANG PERLU DILAKUKAN']);
      data.push([wr.tindakan]);
      data.push([]);

      // 7. Tindakan Maintenance
      data.push([
        'TINDAKAN MAINTENANCE', 
        isSendiri ? '[✓] Dikerjakan Sendiri' : '[ ] Dikerjakan Sendiri', 
        isVendor ? '[✓] Perlu: PP / PJL' : '[ ] Perlu: PP / PJL'
      ]);
      data.push([]);

      // 8. Sparepart Table Header
      data.push(['SPAREPART YANG PERLU DIGANTI']);
      data.push(['No.', 'Nama Barang', 'Jumlah', 'Keterangan']);
      // Add empty rows for the Sparepart table just as shown in the print UI
      for (let i = 1; i <= 5; i++) {
        data.push([i, '', '', '']);
      }
      data.push([]);

      // 9. Signatures Box
      data.push([signature1, '', signature2]);
      data.push([
        wr.status === 'approved' || wr.status === 'converted' ? 'APPROVED VIA MTC' : '',
        '',
        wr.status === 'approved' || wr.status === 'converted' ? 'APPROVED VIA MTC' : ''
      ]);
      data.push([
        wr.namaPengaju, 
        '', 
        wr.status === 'approved' || wr.status === 'converted' ? 'Tim Maintenance (MTC)' : '...........................................'
      ]);
      data.push([]);

      // 10. Document Code
      data.push([documentCode, '', 'Printed automatically via Maintenance System']);

      // Convert to Sheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Auto-fit column widths a bit
      const cols = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Work Request");
      XLSX.writeFile(wb, `WR_${wr.nomorWR.replace(/\//g, '_')}.xlsx`);
    } catch (error) {
      console.error('Excel generation error:', error);
      alert('Gagal membuat file Excel.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print:p-0 print:bg-white print:static print:inset-auto">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print:max-h-none print:shadow-none print:border-none print:rounded-none">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 shrink-0">
            <Printer className="w-5 h-5 text-indigo-600 shrink-0" />
            <h3 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Pratinjau Cetak Work Request</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Cetak via Browser / Export ke PDF"
              id="btn-print-wr-pdf"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Export ke PDF</span>
            </button>
            <button
              onClick={onClose}
              className="bg-slate-600 hover:bg-slate-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X className="w-4 h-4" />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          
          {/* Paper Canvas (The exact high-fidelity paper to print) */}
          <div 
            id="print-area-wr" 
            className="bg-white p-10 max-w-2xl mx-auto border border-slate-300 shadow-lg font-sans text-slate-900 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
            style={{ minHeight: '840px' }}
          >
            
            {/* STYLES FOR PRINT ONLY */}
            <style>{`
              @media print {
                html, body {
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
                body * {
                  visibility: hidden;
                }
                #print-area-wr, #print-area-wr * {
                  visibility: visible;
                }
                #print-area-wr {
                  position: absolute;
                  left: 0;
                  top: 0;
                  width: 100%;
                  border: none !important;
                  padding: 0 !important;
                  box-shadow: none !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }
              }
            `}</style>

            {/* Document Header */}
            {showKop && (
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
            )}

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
                  <div className="h-10 flex items-center justify-center">
                    {wr.status === 'approved' || wr.status === 'converted' ? (
                      <ApprovedStamp text="APPROVED VIA MTC" rotation={-5} />
                    ) : wr.status === 'rejected' ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} />
                    ) : null}
                  </div> {/* Space for signature */}
                  <div className="text-center font-bold border-t border-slate-400 pt-1 text-slate-800">
                    {wr.namaPengaju}
                  </div>
                </div>
                <div className="p-3 min-h-[120px] flex flex-col justify-between">
                  <span className="font-extrabold uppercase tracking-wide text-[9px] text-center block">{signature2}</span>
                  <div className="h-10 flex items-center justify-center">
                    {wr.status === 'approved' || wr.status === 'converted' ? (
                      <ApprovedStamp text="APPROVED VIA MTC" rotation={-5} />
                    ) : wr.status === 'rejected' ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} />
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
