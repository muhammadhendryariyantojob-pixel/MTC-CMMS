import React, { useState } from 'react';
import { GoodsRequest, Company, CompanyBranch } from '../types';
import { X, Printer, Download, Image } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
import ApprovedStamp from './ApprovedStamp';

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
  const [showKop, setShowKop] = useState(true);

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
  const isApproved = pp.status === 'disetujui' || pp.status === 'penyetujuan' || !!pp.approvedOleh;
  const isRejected = pp.status === 'ditolak';

  const handleDownloadPNG = async () => {
    const element = document.getElementById('print-area-pp');
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
      link.download = `PP_${pp.nomorPP.replace(/\//g, '_')}.png`;
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

  // Prepare items list (multi-item support)
  const items = pp.itemsList && pp.itemsList.length > 0
    ? pp.itemsList
    : [{
        namaBarang: pp.namaBarang,
        jumlah: pp.jumlah,
        satuan: pp.satuan,
        kegunaan: pp.kegunaan
      }];

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

      // 3. Grid Form Fields / Meta Info
      data.push(['NOMOR PP', pp.nomorPP, '', 'DIVISI', pp.divisiPengaju]);
      data.push(['DIAJUKAN OLEH', pp.diajukanOleh, '', 'TANGGAL', pp.tanggalPengajuan]);
      data.push([]);

      // 4. Table of Items Header
      data.push(['TABEL BARANG YANG DIMINTA']);
      data.push(['No.', 'Nama Barang', 'Jumlah', 'Satuan', 'Kegunaan']);
      
      // Items rows
      items.forEach((item, index) => {
        data.push([index + 1, item.namaBarang, item.jumlah, item.satuan, item.kegunaan]);
      });
      data.push([]);

      // 5. Lokasi Penyimpanan
      if (pp.lokasiBarang) {
        data.push(['LOKASI PENYIMPANAN SPAREPART', pp.lokasiBarang, 'Status: Ready / Datang']);
        data.push([]);
      }

      // 6. Signatures Box
      data.push([signature1, '', signature2]);
      data.push([
        pp.diajukanOleh, 
        '', 
        pp.approvedOleh || '..........................'
      ]);
      data.push([
        'Tanggal: ' + pp.tanggalPengajuan, 
        '', 
        'Tanggal: ' + (pp.approvedAt ? pp.approvedAt.split(' ')[0] : '..................')
      ]);
      data.push([]);

      // 7. Document Code
      data.push([documentCode]);

      // Convert to Sheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Auto-fit column widths a bit
      const cols = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 25 }];
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Permintaan Barang");
      XLSX.writeFile(wb, `PP_${pp.nomorPP.replace(/\//g, '_')}.xlsx`);
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
            <h3 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Pratinjau Cetak Permintaan Barang (PP)</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 cursor-pointer select-none border border-slate-300 rounded-lg px-2.5 py-1.5 md:px-3 md:py-2 hover:bg-slate-100 transition bg-white" id="toggle-kop-pp">
              <input
                type="checkbox"
                checked={showKop}
                onChange={(e) => setShowKop(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 border-slate-300 focus:ring-indigo-500 cursor-pointer"
              />
              <span className="text-[11px] md:text-xs">Tampilkan Kop</span>
            </label>
            <button
              onClick={handleDownloadExcel}
              disabled={isDownloading}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-800 text-white text-[11px] md:text-xs font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh Excel'}</span>
            </button>
            <button
              onClick={handleDownloadPNG}
              disabled={isDownloading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-800 text-white text-[11px] md:text-xs font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
            >
              <Image className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>{isDownloading ? 'Mengunduh...' : 'Unduh PNG'}</span>
            </button>
            <button
              onClick={onClose}
              className="bg-rose-600 hover:bg-rose-500 text-white text-[11px] md:text-xs font-bold px-3 py-1.5 md:px-4 md:py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Tutup Pratinjau"
            >
              <X className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span>Tutup</span>
            </button>
          </div>
        </div>

        {/* Info Banner (hidden during print) */}
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 sm:px-6 flex items-start gap-2 text-xs text-amber-800 print:hidden shrink-0">
          <span className="font-bold text-sm leading-none shrink-0">💡</span>
          <div>
            <span className="font-bold">Tips Simpan Dokumen:</span> Klik tombol <strong className="font-bold text-indigo-700">Unduh PNG</strong> untuk menyimpan dokumen ini sebagai file gambar berkualitas tinggi secara otomatis, atau klik <strong className="font-bold text-emerald-700">Unduh Excel</strong> untuk versi spreadsheet.
          </div>
        </div>

        {/* Scrollable Document Area */}
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print:bg-white print:p-0 print:overflow-visible">
          
          {/* Paper Canvas (The exact high-fidelity paper to print) */}
          <div 
            id="print-area-pp" 
            className="bg-white p-10 max-w-2xl mx-auto border border-slate-300 shadow-lg font-sans text-slate-900 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
            style={{ minHeight: '840px' }}
          >
            
            {/* STYLES FOR PRINT ONLY */}
            <style>{`
              @media print {
                body * {
                  visibility: hidden;
                }
                #print-area-pp, #print-area-pp * {
                  visibility: visible;
                }
                #print-area-pp {
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
            {showKop && (
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
            )}

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
                <div className="flex flex-col items-center justify-between min-h-[140px] relative">
                  <span className="uppercase tracking-wider text-[10px] font-extrabold">{signature1}</span>
                  
                  {/* Stamp Container */}
                  <div className="h-14 flex items-center justify-center relative w-full my-1">
                    {isApproved ? (
                      <ApprovedStamp text="APPROVED" rotation={-5} className="absolute scale-95" />
                    ) : isRejected ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} className="absolute scale-95" />
                    ) : null}
                  </div>

                  <div className="border-b border-black w-40 pb-1">
                    <span className="uppercase font-extrabold text-[11px]">{pp.diajukanOleh}</span>
                  </div>
                  <span className="text-[9px] text-slate-500 font-medium">Tanggal: {pp.tanggalPengajuan}</span>
                </div>

                {/* Signature 2: Disetujui */}
                <div className="flex flex-col items-center justify-between min-h-[140px] relative">
                  <span className="uppercase tracking-wider text-[10px] font-extrabold">{signature2}</span>
                  
                  {/* Stamp Container */}
                  <div className="h-14 flex items-center justify-center relative w-full my-1">
                    {isApproved ? (
                      <ApprovedStamp text="APPROVED" rotation={-5} className="absolute scale-95" />
                    ) : isRejected ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} className="absolute scale-95" />
                    ) : null}
                  </div>

                  <div className="border-b border-black w-40 pb-1">
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
