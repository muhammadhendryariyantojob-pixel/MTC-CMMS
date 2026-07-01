import React from 'react';
import { WorkRequest, WorkOrder, GoodsRequest, CompanyBranch, Company, UserProfile } from '../types';
import { 
  FileText, 
  Wrench, 
  Package, 
  Clock, 
  CheckCircle2, 
  Play, 
  AlertTriangle, 
  Briefcase, 
  Activity,
  ArrowUpRight,
  TrendingUp,
  Sliders,
  CheckSquare,
  Building,
  MapPin
} from 'lucide-react';

interface DashboardScreenProps {
  requests: WorkRequest[];
  orders: WorkOrder[];
  items: GoodsRequest[];
  currentUser: UserProfile;
  companies: Company[];
  branches?: CompanyBranch[];
  onNavigateToTab: (tab: string) => void;
}

export default function DashboardScreen({ requests, orders, items, currentUser, companies, branches = [], onNavigateToTab }: DashboardScreenProps) {
  
  // Calculate stats
  const totalWR = requests.length;
  const pendingWR = requests.filter(r => r.status === 'pending').length;
  const approvedWR = requests.filter(r => r.status === 'approved' || r.status === 'converted').length;
  
  const totalWO = orders.length;
  const pendingWO = orders.filter(o => o.status === 'pending').length;
  const activeWO = orders.filter(o => o.status === 'di_kerjakan').length;
  const completedWO = orders.filter(o => o.status === 'selesai').length;

  const totalPP = items.length;
  const pendingPP = items.filter(i => i.status === 'pending').length;
  const approvedPP = items.filter(i => i.status === 'disetujui').length;
  const completedPP = items.filter(i => i.status === 'selesai').length;

  // Percentage complete
  const woCompletionRate = totalWO > 0 ? Math.round((completedWO / totalWO) * 100) : 0;
  const wrConversionRate = totalWR > 0 ? Math.round((approvedWR / totalWR) * 100) : 0;

  // Recent WR and WO
  const recentWRs = [...requests].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);
  const recentWOs = [...orders].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 4);

  // Status map badges
  const getWRStatusBadge = (status: string) => {
    switch(status) {
      case 'pending':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">PENDING</span>;
      case 'approved':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">APPROVED</span>;
      case 'converted':
        return <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">CONVERTED</span>;
      case 'rejected':
        return <span className="bg-rose-50 text-rose-700 border border-rose-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">REJECTED</span>;
      default:
        return null;
    }
  };

  const getWOStatusBadge = (status: string) => {
    switch(status) {
      case 'pending':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">MENUNGGU</span>;
      case 'di_kerjakan':
        return <span className="bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">DI KERJAKAN</span>;
      case 'selesai':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold">SELESAI</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6" id="dashboard-screen-container">
      
      {/* Banner Welcome */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 border border-slate-800 relative overflow-hidden shadow-md" id="dashboard-welcome-banner">
        <div className="absolute top-0 right-0 w-48 h-48 bg-blue-500/5 rounded-full blur-2xl"></div>
        <div className="relative z-10 flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="space-y-4">
            <div>
              <h2 className="text-xl font-bold text-white font-sans tracking-tight">
                Halo, {currentUser.name}! 👋
              </h2>
              <p className="text-xs text-slate-300 mt-1">
                Divisi Anda: <span className="text-indigo-300 font-semibold">{currentUser.division}</span> | Peran Anda: <span className="text-amber-400 font-semibold">{currentUser.subRole}</span>
              </p>
            </div>
            
            {/* Clear Company & Branch/HO Display */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white/10 backdrop-blur-md p-3.5 rounded-xl border border-white/10 w-max max-w-full">
              <div className="flex items-center gap-2.5 px-1">
                <Building className="w-5 h-5 text-indigo-300" />
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black block leading-none mb-1">PERUSAHAAN</span>
                  <span className="text-xs font-bold text-white leading-tight">
                    {companies.find(c => c.id === (currentUser.companyId || 'default'))?.name || 'Administrator'}
                  </span>
                </div>
              </div>
              <div className="hidden sm:block h-8 w-px bg-white/20" />
              <div className="flex items-center gap-2.5 px-1">
                <MapPin className="w-5 h-5 text-rose-400" />
                <div>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-black block leading-none mb-1">LOKASI PENUGASAN</span>
                  <span className="text-xs font-bold text-emerald-400 leading-tight">
                    {currentUser.cabangId === 'pusat' || !currentUser.cabangId ? 'KANTOR PUSAT (HO)' : (branches.find(b => b.id === currentUser.cabangId)?.name || 'KANTOR PUSAT (HO)')}
                  </span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => onNavigateToTab('wr')}
              className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold px-4 py-2.5 rounded-lg transition shadow-md flex items-center gap-1.5 cursor-pointer"
              id="btn-nav-wr"
            >
              <FileText className="w-3.5 h-3.5" />
              Ajukan WR Baru
            </button>
            <button
              onClick={() => onNavigateToTab('wo')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold px-4 py-2.5 rounded-lg border border-slate-700 transition flex items-center gap-1.5 cursor-pointer"
              id="btn-nav-wo"
            >
              <Wrench className="w-3.5 h-3.5" />
              Lihat Work Order
            </button>
          </div>
        </div>
      </div>

      {/* Metric Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4" id="dashboard-metric-cards-grid">
        
        {/* Card WR */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition duration-200 flex items-center justify-between shadow-sm text-slate-900" id="stat-card-wr">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Total Work Request</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">{totalWR}</span>
              <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100 flex items-center gap-0.5 font-bold">
                <Clock className="w-3 h-3" /> {pendingWR} Pending
              </span>
            </div>
            <p className="text-[10px] text-slate-400">Permintaan perbaikan masuk</p>
          </div>
          <div className="p-3 bg-blue-50 text-blue-600 border border-blue-100 rounded-xl">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Card WO */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition duration-200 flex items-center justify-between shadow-sm text-slate-900" id="stat-card-wo">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Total Work Order</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">{totalWO}</span>
              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100 flex items-center gap-0.5 font-bold">
                <Play className="w-3 h-3" /> {activeWO} Jalan
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{completedWO} Selesai ({woCompletionRate}% Selesai)</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
        </div>

        {/* Card PP (Permintaan Barang) */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition duration-200 flex items-center justify-between shadow-sm text-slate-900" id="stat-card-pp">
          <div className="space-y-1">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Permintaan Barang</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">{totalPP}</span>
              <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100 flex items-center gap-0.5 font-bold">
                <CheckCircle2 className="w-3 h-3" /> {completedPP} Selesai
              </span>
            </div>
            <p className="text-[10px] text-slate-400">{pendingPP} Menunggu Persetujuan</p>
          </div>
          <div className="p-3 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-xl">
            <Package className="w-6 h-6" />
          </div>
        </div>

        {/* Efficiency card */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 hover:border-slate-300 hover:shadow-md transition duration-200 flex items-center justify-between shadow-sm text-slate-900" id="stat-card-efficiency">
          <div className="space-y-1 w-full">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider font-bold block">Konversi WR ke WO</span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">{wrConversionRate}%</span>
              <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 flex items-center gap-1 font-bold">
                <TrendingUp className="w-3.5 h-3.5" /> High Activity
              </span>
            </div>
            {/* Simple Visual Progress Bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div 
                className="bg-blue-600 h-full rounded-full transition-all duration-500" 
                style={{ width: `${wrConversionRate}%` }}
              ></div>
            </div>
          </div>
        </div>

      </div>

      {/* Main Sections: Left & Right Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6" id="dashboard-charts-recent-split">
        
        {/* Left Side: Recent Activity Logs & Machine Status Summary */}
        <div className="lg:col-span-7 space-y-6" id="dashboard-left-panel">
          
          {/* Active Work Orders Breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-slate-900" id="active-wo-breakdown-card">
            <h3 className="text-xs font-bold text-slate-800 font-sans tracking-tight mb-4 flex items-center gap-2 uppercase">
              <Sliders className="w-4 h-4 text-indigo-600" />
              Distribusi Status Pekerjaan WO
            </h3>
            
            <div className="grid grid-cols-3 gap-3 text-center" id="wo-dist-grid">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Mtc Menunggu</span>
                <span className="text-xl font-bold font-mono text-amber-600">{pendingWO}</span>
                <div className="mt-1.5 text-[8px] bg-amber-50 text-amber-700 border border-amber-200 rounded py-0.5 uppercase font-bold">Antrean</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Sedang Dikerjakan</span>
                <span className="text-xl font-bold font-mono text-blue-600">{activeWO}</span>
                <div className="mt-1.5 text-[8px] bg-blue-50 text-blue-700 border border-blue-200 rounded py-0.5 uppercase font-bold">Aktif</div>
              </div>
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span className="text-[10px] font-semibold text-slate-500 block mb-1">Telah Selesai</span>
                <span className="text-xl font-bold font-mono text-emerald-600">{completedWO}</span>
                <div className="mt-1.5 text-[8px] bg-emerald-50 text-emerald-700 border border-emerald-200 rounded py-0.5 uppercase font-bold">Selesai</div>
              </div>
            </div>
            
            {/* Quick Summary Gauge */}
            <div className="mt-5 p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between" id="wo-gauge-summary">
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <div>
                  <p className="text-xs text-slate-800 font-bold">Tingkat Penyelesaian WO</p>
                  <p className="text-[10px] text-slate-500">Rasio WO terselesaikan dari total WO yang diterbitkan</p>
                </div>
              </div>
              <span className="text-lg font-black text-slate-900 font-mono">{woCompletionRate}%</span>
            </div>
          </div>

          {/* Recent Work Requests */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-slate-900" id="recent-wr-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-800 font-sans tracking-tight flex items-center gap-2 uppercase">
                <FileText className="w-4 h-4 text-blue-600" />
                Daftar Work Request (WR) Terbaru
              </h3>
              <button 
                onClick={() => onNavigateToTab('wr')} 
                className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-0.5 cursor-pointer"
                id="btn-view-all-wr"
              >
                Semua WR <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {recentWRs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl" id="recent-wr-empty">
                Belum ada pengajuan Work Request (WR).
              </div>
            ) : (
              <div className="space-y-3" id="recent-wr-list">
                {recentWRs.map((wr) => (
                  <div key={wr.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 flex flex-col sm:flex-row justify-between gap-3 hover:border-slate-200 hover:bg-slate-50/50 transition" id={`recent-wr-item-${wr.id}`}>
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold font-mono text-slate-700">{wr.nomorWR}</span>
                        {getWRStatusBadge(wr.status)}
                        <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 font-sans">
                          <MapPin className="w-2.5 h-2.5 text-rose-500" />
                          {wr.cabangId === 'pusat' || !wr.cabangId ? 'Pusat' : (branches.find(b => b.id === wr.cabangId)?.name || 'Pusat')}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-900 truncate">Mesin: {wr.namaMesin}</p>
                      <p className="text-[11px] text-slate-600 line-clamp-1"><span className="text-slate-400 font-medium">Masalah:</span> {wr.masalah}</p>
                    </div>
                    <div className="text-left sm:text-right shrink-0 text-[10px] text-slate-500 space-y-0.5 font-mono">
                      <p className="text-slate-700 font-semibold">Pengaju: {wr.namaPengaju}</p>
                      <p className="text-slate-500">Divisi: {wr.divisiPengaju}</p>
                      <p className="text-slate-400">{wr.tanggalPengajuan}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

        {/* Right Side: Recent Work Orders & Information Box */}
        <div className="lg:col-span-5 space-y-6" id="dashboard-right-panel">
          
          {/* Recent Work Orders */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm text-slate-900" id="recent-wo-card">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xs font-bold text-slate-800 font-sans tracking-tight flex items-center gap-2 uppercase">
                <Wrench className="w-4 h-4 text-indigo-600" />
                Daftar Work Order (WO) Terbaru
              </h3>
              <button 
                onClick={() => onNavigateToTab('wo')} 
                className="text-xs text-indigo-600 hover:text-indigo-700 font-bold flex items-center gap-0.5 cursor-pointer"
                id="btn-view-all-wo"
              >
                Semua WO <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>

            {recentWOs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl" id="recent-wo-empty">
                Belum ada Work Order (WO) aktif.
              </div>
            ) : (
              <div className="space-y-3" id="recent-wo-list">
                {recentWOs.map((wo) => (
                  <div key={wo.id} className="p-3.5 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition" id={`recent-wo-item-${wo.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs font-bold font-mono text-slate-700">{wo.nomorWO}</span>
                        <span className="text-[9px] bg-rose-50 text-rose-700 border border-rose-100 px-1.5 py-0.5 rounded font-bold flex items-center gap-0.5 font-sans">
                          <MapPin className="w-2.5 h-2.5 text-rose-500" />
                          {wo.cabangId === 'pusat' || !wo.cabangId ? 'Pusat' : (branches.find(b => b.id === wo.cabangId)?.name || 'Pusat')}
                        </span>
                      </div>
                      {getWOStatusBadge(wo.status)}
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-900 truncate">Mesin: {wo.namaMesin} <span className="text-[10px] text-slate-400">({wo.area})</span></p>
                      <p className="text-[11px] text-slate-600 line-clamp-1"><span className="text-slate-400 font-medium">Tindakan:</span> {wo.jenisTindakan}</p>
                      
                      {/* Assignment display */}
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px]">
                        <span className="text-slate-400 uppercase tracking-wide font-bold">Tipe: {wo.tipePenugasan === 'vendor' ? 'Vendor' : 'Teknisi'}</span>
                        <span className="text-slate-700 font-bold truncate max-w-[120px]">
                          {wo.tipePenugasan === 'vendor' ? wo.namaVendor : wo.teknisiDitugaskan.join(', ')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Guide & Support Panel */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm space-y-4 text-slate-900" id="dashboard-quick-guide-card">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-blue-600" />
              Alur Operasional Maintenance
            </h3>
            
            <div className="space-y-3 text-xs text-slate-600" id="quick-guide-steps">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono flex items-center justify-center font-bold">1</span>
                <p><strong className="text-slate-800">Work Request (WR):</strong> User departemen melaporkan masalah mesin / area melalui form pengajuan WR.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono flex items-center justify-center font-bold">2</span>
                <p><strong className="text-slate-800">Work Order (WO):</strong> MTC Management menyetujui WR dan mengubahnya menjadi penugasan WO ke Teknisi atau Vendor.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono flex items-center justify-center font-bold">3</span>
                <p><strong className="text-slate-800">Eksekusi Pekerjaan:</strong> Teknisi me-start "Play" & "Finish" pekerjaan di aplikasi, sedangkan vendor dilaporkan selesai oleh management.</p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 text-slate-700 font-mono flex items-center justify-center font-bold">4</span>
                <p><strong className="text-slate-800">Permintaan Barang:</strong> Teknisi & Management dapat mengajukan kebutuhan suku cadang/barang untuk diselesaikan oleh MTC Division.</p>
              </div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

