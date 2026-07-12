import React, { useState } from 'react';
import { WorkOrder, Company, UserProfile, CompanyBranch } from '../types';
import { X, Printer, MapPin, Calendar, Clock, User, Wrench, Download, Image, Trash2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import html2canvas from 'html2canvas';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import ApprovedStamp from './ApprovedStamp';
import { formatDateTime } from '../utils';
import { downloadMedianBase64 } from '../utils/medianDownload';

interface PrintWOModalProps {
  isOpen: boolean;
  onClose: () => void;
  wo: WorkOrder;
  companies: Company[];
  branches?: CompanyBranch[];
  currentUser?: UserProfile;
  onDelete?: () => void;
}

export default function PrintWOModal({ 
  isOpen, 
  onClose, 
  wo, 
  companies, 
  branches = [], 
  currentUser, 
  onDelete 
}: PrintWOModalProps) {
  if (!isOpen) return null;

  const [isDownloading, setIsDownloading] = useState(false);
  const [showKop, setShowKop] = useState(true);

  const companyObj = companies.find(c => c.id === wo.companyId);
  const branchObj = wo.cabangId && wo.cabangId !== 'pusat'
    ? branches.find(b => b.id === wo.cabangId)
    : null;

  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'management' || currentUser?.role?.toLowerCase()?.includes('admin');

  const woFormat = branchObj?.woFormat || companyObj?.woFormat;

  const companyName = woFormat?.companyName || branchObj?.name || companyObj?.name || 'PT DUNIA KIMIA JAYA';
  const addressLine1 = woFormat?.addressLine1 || (branchObj ? 'Alamat Cabang: ' + (branchObj.address || '-') : 'Jl. Raya Sukomulyo KM.24, Sukomulyo - Manyar');
  const addressLine2 = woFormat?.addressLine2 || 'Gresik - 61151, Telp. (031) 3958686 Fax. 3957887';
  const documentTitle = woFormat?.documentTitle || 'SURAT PERINTAH KERJA (WORK ORDER)';
  const documentCode = woFormat?.documentCode || 'C.MNT.003-02/R1';
  
  const signature1 = woFormat?.signature1 || 'Dibuat Oleh';
  const signature2 = woFormat?.signature2 || 'Dikerjakan Oleh';
  const signature3 = woFormat?.signature3 || 'Disetujui Oleh';

  const handleDownloadPNG = async () => {
    const element = document.getElementById('print-area-wo');
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
      link.download = `WO_${wo.nomorWO.replace(/\//g, '_')}.png`;
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

  const handlePrint = () => {
    let timeoutId: any;
    try {
      const element = document.getElementById('print-area-wo');
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
        filename:     `work-order-${wo.nomorWO || wo.id}.pdf`,
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
            const filename = `work-order-${wo.nomorWO || wo.id}.pdf`;
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

  const isAssignedVendor = wo.tipePenugasan === 'vendor';

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
      data.push(['NOMOR WORK ORDER', wo.nomorWO, '', 'REF. WR', wo.nomorWR, '', 'TANGGAL WO', wo.tanggalWO]);
      if (wo.sapNumber) {
        data.push(['NOMOR SAP', wo.sapNumber, '', '', '', '', '', '']);
      }
      data.push(['NAMA MESIN', wo.namaMesin, '', 'AREA / LOKASI', wo.area, '', 'PRIORITAS', wo.prioritas || 'SEDANG']);
      data.push([]);

      // 4. Penugasan
      data.push(['TIPE PELAKSANA', isAssignedVendor ? 'VENDOR EKSTERNAL' : 'TEKNISI INTERNAL']);
      data.push(['NAMA PELAKSANA', isAssignedVendor ? wo.namaVendor : wo.teknisiDitugaskan.join(', ')]);
      data.push([]);

      // 5. Jenis Tindakan & Uraian Pekerjaan
      data.push(['JENIS TINDAKAN', wo.jenisTindakan]);
      data.push(['URAIAN PEKERJAAN']);
      data.push([wo.uraianPekerjaan]);
      data.push([]);

      // 6. Laporan Tindakan Perbaikan Tim MTC
      data.push(['LAPORAN TINDAKAN PERBAIKAN TIM MTC']);
      data.push([wo.notes ? wo.notes : 'Belum ada laporan penyelesaian dari pelaksana.']);
      data.push([]);

      // 7. Realisasi Waktu
      data.push(['WAKTU MULAI KERJA (START)', formatDateTime(wo.playAt)]);
      data.push(['WAKTU SELESAI KERJA (FINISH)', formatDateTime(wo.finishAt)]);
      data.push([]);

      // 8. Signatures Box
      data.push([signature1, '', signature2, '', signature3]);
      data.push(['', '', wo.status === 'di_kerjakan' || wo.status === 'selesai' ? 'TIM PELAKSANA' : '', '', wo.status === 'selesai' ? 'APPROVED / CLOSED' : '']);
      data.push([
        wo.diajukanOleh, 
        '', 
        isAssignedVendor ? wo.namaVendor : (wo.teknisiDitugaskan[0] || 'Pelaksana'), 
        '', 
        'MTC Supervisor'
      ]);
      data.push([]);

      // 9. Document Code
      data.push([documentCode, '', 'Printed automatically via Maintenance System']);

      // Convert to Sheet
      const ws = XLSX.utils.aoa_to_sheet(data);
      
      // Auto-fit column widths a bit
      const cols = [{ wch: 25 }, { wch: 30 }, { wch: 15 }, { wch: 15 }, { wch: 20 }, { wch: 15 }, { wch: 15 }, { wch: 20 }];
      ws['!cols'] = cols;

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Work Order");
      XLSX.writeFile(wb, `WO_${wo.nomorWO.replace(/\//g, '_')}.xlsx`);
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
            <h3 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Pratinjau Cetak Work Order</h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {onDelete && isAdmin && (
              <button
                onClick={onDelete}
                className="bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
                title="Hapus Laporan Ini"
                id="btn-delete-wo-preview"
              >
                <Trash2 className="w-4 h-4" />
                <span>Hapus Laporan</span>
              </button>
            )}
            <button
              onClick={() => window.print()}
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Cetak Langsung ke Printer (Thermal/Kertas)"
              id="btn-print-wo-direct"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak (Printer)</span>
            </button>
            <button
              onClick={handlePrint}
              disabled={isDownloading}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-400 text-white text-xs font-bold px-4 py-2 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              title="Unduh File PDF Laporan"
              id="btn-print-wo-pdf"
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
          
          {/* Paper Canvas */}
          <div 
            id="print-area-wo" 
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
                #print-area-wo,
                #print-area-wo * {
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

                #print-area-wo {
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
                #print-area-wo, #print-area-wo * {
                  -webkit-print-color-adjust: exact !important;
                  print-color-adjust: exact !important;
                }

                /* Form specific enhancements to guarantee borders and texts render cleanly */
                #print-area-wo table, 
                #print-area-wo td, 
                #print-area-wo th,
                #print-area-wo div {
                  border-color: #000000 !important;
                  color: #000000 !important;
                }

                /* Compactness & Sizing Adjustments for A4 single page fit */
                #print-area-wo .min-h-\\[55px\\] {
                  min-height: 40px !important;
                  padding-top: 4px !important;
                  padding-bottom: 4px !important;
                }
                #print-area-wo .min-h-\\[100px\\] {
                  min-height: 55px !important;
                  padding: 4px 6px !important;
                }
                #print-area-wo .min-h-\\[80px\\] {
                  min-height: 45px !important;
                  padding: 4px 6px !important;
                }
                #print-area-wo .min-h-\\[120px\\] {
                  min-height: 80px !important;
                  padding: 4px 6px !important;
                }
                #print-area-wo .p-3 {
                  padding: 5px !important;
                }
                #print-area-wo .p-2\\.5 {
                  padding: 4px !important;
                }
                #print-area-wo .p-2 {
                  padding: 4px !important;
                }
                #print-area-wo .mb-6 {
                  margin-bottom: 8px !important;
                }
                #print-area-wo .pb-4 {
                  padding-bottom: 4px !important;
                }
                #print-area-wo .mb-4 {
                  margin-bottom: 6px !important;
                }
                /* Scale down photos on print so they don't force page break */
                #print-area-wo img {
                  max-height: 70px !important;
                }
                #print-area-wo .h-32 {
                  height: 70px !important;
                }
                #print-area-wo .gap-4 {
                  gap: 8px !important;
                }
                #print-area-wo .w-16.h-16 {
                  width: 48px !important;
                  height: 48px !important;
                }
                #print-area-wo h1 {
                  font-size: 13px !important;
                }
                #print-area-wo h2 {
                  font-size: 12px !important;
                }
                #print-area-wo p {
                  font-size: 8px !important;
                }
                #print-area-wo .text-xs {
                  font-size: 10px !important;
                }
              }
            `}</style>

            {/* Document Header */}
            {showKop && (
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
            )}

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
                  <div>
                    <span className="font-extrabold uppercase tracking-wide text-[9px] text-black block mb-0.5">NOMOR WORK ORDER</span>
                    <span className="font-mono font-bold text-xs uppercase text-slate-800 block">{wo.nomorWO}</span>
                  </div>
                  <div className="mt-1.5 pt-1 border-t border-black/10">
                    <span className="font-extrabold uppercase tracking-wide text-[8px] text-slate-500 block mb-0.5">NOMOR SAP</span>
                    <span className="font-mono font-bold text-xs text-slate-800 block">{wo.sapNumber || '-'}</span>
                  </div>
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
                    {formatDateTime(wo.playAt)}
                  </span>
                </div>
                <div className="p-2">
                  <span className="font-extrabold uppercase tracking-wider text-[8px] text-slate-500 block mb-0.5">WAKTU SELESAI KERJA (FINISH) :</span>
                  <span className="font-mono text-xs font-bold text-slate-800">
                    {formatDateTime(wo.finishAt)}
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
                  <div className="h-10 flex items-center justify-center">
                    {wo.status === 'selesai' ? (
                      <ApprovedStamp text="APPROVED" rotation={-5} />
                    ) : (wo.status as string) === 'rejected' || (wo.status as string) === 'ditolak' ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} />
                    ) : null}
                  </div>
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
                      <ApprovedStamp text="APPROVED / CLOSED" rotation={-5} />
                    ) : (wo.status as string) === 'rejected' || (wo.status as string) === 'ditolak' ? (
                      <ApprovedStamp text="REJECTED" variant="rejected" rotation={-5} />
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
