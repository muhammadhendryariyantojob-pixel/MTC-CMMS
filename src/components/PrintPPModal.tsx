import React, { useState } from 'react';
import { GoodsRequest, Company, CompanyBranch, UserProfile } from '../types';
import { X, Printer, Download, Image, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import ApprovedStamp from './ApprovedStamp';
import { downloadMedianBase64 } from '../utils/medianDownload';

interface PrintPPModalProps {
  isOpen: boolean;
  onClose: () => void;
  pp: GoodsRequest;
  companies: Company[];
  branches?: CompanyBranch[];
  currentUser?: UserProfile;
  onDelete?: () => void;
}

export default function PrintPPModal({ 
  isOpen, 
  onClose, 
  pp, 
  companies, 
  branches = [], 
  currentUser, 
  onDelete 
}: PrintPPModalProps) {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);
  const [showKop, setShowKop] = useState(true);

  const companyObj = companies.find(c => c.id === pp.companyId);
  const branchObj = pp.cabangId && pp.cabangId !== 'pusat'
    ? branches.find(b => b.id === pp.cabangId)
    : null;

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'management' || currentUser?.role?.toLowerCase()?.includes('admin');

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

  const handlePrint = () => {
    let timeoutId: any;
    try {
      const element = document.getElementById('print-area-pp');
      if (!element) {
        window.print();
        return;
      }

      setIsDownloading(true);

      // Timeout safeguard: if html2pdf freezes or crashes (e.g. out of memory / html2canvas issue on mobile WebView)
      timeoutId = setTimeout(() => {
        setIsDownloading(false);
        alert('Gagal memproses file (Waktu habis)');
      }, 15000);

      const isMobile = /Android|iPhone|iPad|iPod|Opera Mini|IEMobile|WPDesktop/i.test(navigator.userAgent);
      const isMedian = /Median/i.test(navigator.userAgent) || 
                       /GoNative/i.test(navigator.userAgent) || 
                       !!(window as any).median ||
                       !!(window as any).gonative;

      const opt = {
        margin:       10,
        filename:     `pp-${pp.nomorPP || pp.id}.pdf`,
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
            const filename = `pp-${pp.nomorPP || pp.id}.pdf`;
            const base64Raw = dataUri.split(',')[1];
            
            if (isMedian) {
              downloadMedianBase64(base64Raw, filename, dataUri);
            } else {
              // Fallback: trigger download using <a> tag with target="_blank"
              const link = document.createElement('a');
              link.href = dataUri;
              link.target = '_blank';
              link.download = filename;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
            }
          } catch (innerErr) {
            console.error('PDF inner error:', innerErr);
            alert('Gagal memproses file');
          } finally {
            setIsDownloading(false);
          }
        })
        .catch((err: any) => {
          if (timeoutId) clearTimeout(timeoutId);
          console.error('PDF export error:', err);
          alert('Gagal memproses PDF, mencoba cetak langsung (fallback)...');
          window.print();
          setIsDownloading(false);
        });
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      console.error('PDF handlePrint error:', error);
      alert('Terjadi kesalahan, mencoba cetak langsung (fallback)...');
      window.print();
      setIsDownloading(false);
    }
  };

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
    <div className="fixed inset-0 z-[100] overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 print-modal-backdrop">
      {/* Modal Card wrapper */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] print-modal-card">
        
        {/* Modal Toolbar (hidden during print) */}
        <div className="px-4 py-3 md:px-6 md:py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-50 gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-2 shrink-0">
            <Printer className="w-5 h-5 text-indigo-600 shrink-0" />
            <h3 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Pratinjau Cetak Permintaan Barang (PP)</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onDelete && isAdmin && (
              <button
                onClick={onDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Hapus Laporan Ini"
                id="btn-delete-pp-preview"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Laporan</span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Cetak Langsung ke Printer (Thermal/Kertas)"
              id="btn-print-pp-direct"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak (Printer)</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isDownloading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Unduh File PDF Laporan"
              id="btn-print-pp-pdf"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Memproses...' : 'Unduh PDF'}</span>
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
        <div className="p-8 overflow-y-auto flex-1 bg-slate-100 print-scroll-area">
          
          {/* Paper Canvas (The exact high-fidelity paper to print) */}
          <div 
            id="print-area-pp" 
            className="bg-white p-10 max-w-2xl mx-auto border border-slate-300 shadow-lg font-sans text-slate-900 print:shadow-none print:border-none print:p-0 print:mx-0 print:max-w-none"
            style={{ minHeight: '840px' }}
          >
            
            {/* STYLES FOR PRINT ONLY */}
            <style>{`
              @media print {
                @page {
                  size: A4 portrait;
                  margin: 10mm;
                }
                
                /* Hide everything except our printable elements */
                body * {
                  visibility: hidden;
                }
                
                /* Keep printing elements visible and safe from clipping */
                .print-modal-backdrop,
                .print-modal-backdrop *,
                .print-modal-card,
                .print-modal-card *,
                .print-scroll-area,
                .print-scroll-area *,
                #print-area-pp,
                #print-area-pp * {
                  visibility: visible !important;
                }

                /* Layout resetting for print */
                html, body {
                  background-color: #ffffff !important;
                  color: #000000 !important;
                  margin: 0 !important;
                  padding: 0 !important;
                  height: auto !important;
                  overflow: visible !important;
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                /* Ensure parent containers do not clip absolute elements or modal heights */
                #app-root-container,
                #app-main-viewport,
                #wr-screen-container,
                #wo-screen-container,
                #pp-screen-container,
                main,
                aside {
                  height: auto !important;
                  min-height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  display: block !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  border: none !important;
                  box-shadow: none !important;
                }

                .print-modal-backdrop {
                  position: absolute !important;
                  left: 0 !important;
                  top: 0 !important;
                  width: 100% !important;
                  height: auto !important;
                  min-height: 100% !important;
                  background: white !important;
                  z-index: 99999 !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  display: block !important;
                  overflow: visible !important;
                }

                .print-modal-card {
                  border: none !important;
                  box-shadow: none !important;
                  max-width: 100% !important;
                  width: 100% !important;
                  height: auto !important;
                  max-height: none !important;
                  overflow: visible !important;
                  padding: 0 !important;
                  margin: 0 !important;
                  background: white !important;
                  display: block !important;
                }

                .print-scroll-area {
                  padding: 0 !important;
                  margin: 0 !important;
                  overflow: visible !important;
                  background: white !important;
                  display: block !important;
                  height: auto !important;
                  max-height: none !important;
                }

                #print-area-pp {
                  position: relative !important;
                  border: none !important;
                  padding: 0 !important;
                  margin: 0 auto !important;
                  box-shadow: none !important;
                  width: 100% !important;
                  max-width: 190mm !important; /* Proper fit for A4 printable region with 10mm margins */
                  height: auto !important;
                  min-height: auto !important;
                  overflow: visible !important;
                  background: white !important;
                  page-break-after: avoid;
                  page-break-before: avoid;
                  page-break-inside: avoid;
                }

                /* Ensure color and background exact rendering inside document form */
                #print-area-pp, #print-area-pp * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                /* Form specific enhancements to guarantee borders and texts render cleanly */
                #print-area-pp table, 
                #print-area-pp td, 
                #print-area-pp th,
                #print-area-pp div {
                  border-color: #000000 !important;
                  color: #000000 !important;
                }

                /* Compactness & Sizing Adjustments for A4 single page fit */
                #print-area-pp .mb-6 {
                  margin-bottom: 8px !important;
                }
                #print-area-pp .p-3 {
                  padding: 6px !important;
                }
                #print-area-pp .py-2\\.5 {
                  padding-top: 4px !important;
                  padding-bottom: 4px !important;
                }
                #print-area-pp .pb-4 {
                  padding-bottom: 4px !important;
                }
                #print-area-pp .mb-10 {
                  margin-bottom: 12px !important;
                }
                #print-area-pp .mb-8 {
                  margin-bottom: 10px !important;
                }
                #print-area-pp .mt-16 {
                  margin-top: 15px !important;
                }
                #print-area-pp .min-h-\\[140px\\] {
                  min-height: 90px !important;
                }
                #print-area-pp .h-14 {
                  height: 36px !important;
                }
                #print-area-pp .w-40 {
                  width: 120px !important;
                }
                #print-area-pp .w-16.h-16 {
                  width: 48px !important;
                  height: 48px !important;
                }
                #print-area-pp h1 {
                  font-size: 13px !important;
                }
                #print-area-pp h2 {
                  font-size: 12px !important;
                }
                #print-area-pp p {
                  font-size: 8px !important;
                }
                #print-area-pp .text-xs {
                  font-size: 10px !important;
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
                  <div className="col-span-5 border-r border-slate-300 text-left pl-3 uppercase flex flex-col justify-center">
                    <span className="font-bold">{item.namaBarang}</span>
                    <span className="text-[8px] font-bold text-slate-500 mt-0.5">
                      {item.inventoryId ? '* DIAMBIL DI INVENTORY' : '* PEMBELIAN BARU'}
                    </span>
                  </div>
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
