import React, { useState, useEffect } from 'react';
import { WorkRequest, WorkOrder, GoodsRequest, UserProfile } from '../types';
import { 
  Bell, 
  Check, 
  Trash2, 
  FileText, 
  Wrench, 
  Package, 
  AlertCircle, 
  CheckCircle2, 
  Clock,
  X,
  MessageSquare
} from 'lucide-react';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'wr' | 'wo' | 'pp' | 'forum';
  date: string;
  isRead: boolean;
  tab: string;
}

interface NotificationsPanelProps {
  currentUser: UserProfile;
  requests: WorkRequest[];
  orders: WorkOrder[];
  goodsRequests: GoodsRequest[];
  onNavigateToTab: (tab: string) => void;
}

export default function NotificationsPanel({ 
  currentUser, 
  requests, 
  orders, 
  goodsRequests, 
  onNavigateToTab 
}: NotificationsPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);

  // Load read notifications from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`mtc_read_notifs_${currentUser.username}`);
      if (stored) {
        setReadIds(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Failed to load read notifications state:', e);
    }
  }, [currentUser.username]);

  // Save read notifications to localStorage
  const saveReadIds = (ids: string[]) => {
    setReadIds(ids);
    try {
      localStorage.setItem(`mtc_read_notifs_${currentUser.username}`, JSON.stringify(ids));
    } catch (e) {
      console.error('Failed to save read notifications state:', e);
    }
  };

  // Generate notifications dynamically based on real data
  useEffect(() => {
    const list: NotificationItem[] = [];

    // Helper to check if a notification has been dismissed/marked as read
    const isItemRead = (id: string) => readIds.includes(id);

    // 1. Notifications for DEPARTEMEN user
    if (currentUser.role === 'departemen') {
      // My Work Requests (WR)
      requests.forEach(r => {
        const creatorMatch = r.namaPengaju?.toLowerCase() === currentUser.name?.toLowerCase();
        if (creatorMatch) {
          if (r.status === 'approved') {
            list.push({
              id: `wr-approved-${r.id}-${r.createdAt}`,
              title: 'Work Request Disetujui',
              message: `Pengajuan WR ${r.nomorWR} (${r.namaMesin}) telah DISETUJUI oleh Management.`,
              type: 'wr',
              date: r.tanggalPengajuan,
              isRead: isItemRead(`wr-approved-${r.id}-${r.createdAt}`),
              tab: 'wr'
            });
          } else if (r.status === 'rejected') {
            list.push({
              id: `wr-rejected-${r.id}-${r.createdAt}`,
              title: 'Work Request Ditolak',
              message: `Pengajuan WR ${r.nomorWR} (${r.namaMesin}) DITOLAK. Silakan periksa detailnya.`,
              type: 'wr',
              date: r.tanggalPengajuan,
              isRead: isItemRead(`wr-rejected-${r.id}-${r.createdAt}`),
              tab: 'wr'
            });
          } else if (r.status === 'converted') {
            list.push({
              id: `wr-converted-${r.id}-${r.createdAt}`,
              title: 'Work Request Dikerjakan',
              message: `WR ${r.nomorWR} (${r.namaMesin}) Anda telah dikonversi menjadi Work Order (WO) untuk dikerjakan.`,
              type: 'wr',
              date: r.tanggalPengajuan,
              isRead: isItemRead(`wr-converted-${r.id}-${r.createdAt}`),
              tab: 'wr'
            });
          }
        }
      });

      // My Goods Requests (PP)
      goodsRequests.forEach(pp => {
        const creatorMatch = pp.diajukanOleh?.toLowerCase() === currentUser.name?.toLowerCase();
        if (creatorMatch) {
          const ppStatus = pp.status;
          if (ppStatus === 'disetujui' || ppStatus === 'penyetujuan') {
            list.push({
              id: `pp-approved-${pp.id}-${pp.createdAt}`,
              title: 'Permintaan Barang Disetujui',
              message: `PP ${pp.nomorPP} (${pp.namaBarang}) Anda telah disetujui.`,
              type: 'pp',
              date: pp.tanggalPengajuan,
              isRead: isItemRead(`pp-approved-${pp.id}-${pp.createdAt}`),
              tab: 'pp'
            });
          } else if (ppStatus === 'pemesanan') {
            list.push({
              id: `pp-ordered-${pp.id}-${pp.createdAt}`,
              title: 'Barang Sedang Dipesan',
              message: `PP ${pp.nomorPP} (${pp.namaBarang}) sedang dipesan oleh Logistik.`,
              type: 'pp',
              date: pp.tanggalPengajuan,
              isRead: isItemRead(`pp-ordered-${pp.id}-${pp.createdAt}`),
              tab: 'pp'
            });
          } else if (ppStatus === 'telah_datang') {
            list.push({
              id: `pp-arrived-${pp.id}-${pp.createdAt}`,
              title: 'Barang Telah Datang',
              message: `Barang PP ${pp.nomorPP} (${pp.namaBarang}) sudah tiba! Ambil di: ${pp.lokasiBarang || 'Gudang'}.`,
              type: 'pp',
              date: pp.tanggalPengajuan,
              isRead: isItemRead(`pp-arrived-${pp.id}-${pp.createdAt}`),
              tab: 'pp'
            });
          } else if (ppStatus === 'selesai' || ppStatus === 'selesai_dan_diambil') {
            list.push({
              id: `pp-completed-${pp.id}-${pp.createdAt}`,
              title: 'Permintaan Barang Selesai',
              message: `Permintaan barang PP ${pp.nomorPP} (${pp.namaBarang}) telah diambil & selesai.`,
              type: 'pp',
              date: pp.tanggalPengajuan,
              isRead: isItemRead(`pp-completed-${pp.id}-${pp.createdAt}`),
              tab: 'pp'
            });
          } else if (ppStatus === 'ditolak') {
            list.push({
              id: `pp-rejected-${pp.id}-${pp.createdAt}`,
              title: 'Permintaan Barang Ditolak',
              message: `Permintaan barang PP ${pp.nomorPP} DITOLAK.`,
              type: 'pp',
              date: pp.tanggalPengajuan,
              isRead: isItemRead(`pp-rejected-${pp.id}-${pp.createdAt}`),
              tab: 'pp'
            });
          }
        }
      });
    }

    // 2. Notifications for TEKNISI user
    if (currentUser.role === 'teknisi') {
      orders.forEach(wo => {
        const isAssigned = wo.teknisiDitugaskan && (
          wo.teknisiDitugaskan.includes(currentUser.username) || 
          wo.teknisiDitugaskan.includes(currentUser.name)
        );
        if (isAssigned) {
          if (wo.status === 'pending') {
            list.push({
              id: `wo-assigned-${wo.id}-${wo.createdAt}`,
              title: 'Penugasan Perintah Kerja (WO) Baru',
              message: `Anda ditugaskan pada Perintah Kerja ${wo.nomorWO} (${wo.namaMesin}). Area: ${wo.area}.`,
              type: 'wo',
              date: wo.tanggalWO,
              isRead: isItemRead(`wo-assigned-${wo.id}-${wo.createdAt}`),
              tab: 'wo'
            });
          } else if (wo.status === 'di_kerjakan') {
            list.push({
              id: `wo-active-${wo.id}-${wo.createdAt}`,
              title: 'WO Sedang Dikerjakan',
              message: `WO ${wo.nomorWO} (${wo.namaMesin}) berstatus aktif dikerjakan.`,
              type: 'wo',
              date: wo.tanggalWO,
              isRead: isItemRead(`wo-active-${wo.id}-${wo.createdAt}`),
              tab: 'wo'
            });
          } else if (wo.status === 'selesai') {
            list.push({
              id: `wo-finished-${wo.id}-${wo.createdAt}`,
              title: 'WO Selesai Dikerjakan',
              message: `Pekerjaan WO ${wo.nomorWO} (${wo.namaMesin}) telah diselesaikan & ditutup.`,
              type: 'wo',
              date: wo.tanggalWO,
              isRead: isItemRead(`wo-finished-${wo.id}-${wo.createdAt}`),
              tab: 'wo'
            });
          }
        }
      });
    }

    // 3. Notifications for ADMIN or MANAGEMENT user
    if (currentUser.role === 'admin' || currentUser.role === 'management') {
      // Pending Work Requests requiring approval
      const pendingWRs = requests.filter(r => r.status === 'pending');
      if (pendingWRs.length > 0) {
        list.push({
          id: `admin-pending-wr-${pendingWRs.length}`,
          title: 'WR Menunggu Persetujuan',
          message: `Ada ${pendingWRs.length} Work Request (WR) baru yang memerlukan peninjauan & persetujuan Anda.`,
          type: 'wr',
          date: new Date().toISOString().split('T')[0],
          isRead: isItemRead(`admin-pending-wr-${pendingWRs.length}`),
          tab: 'wr'
        });
      }

      // Pending Goods Requests requiring approval
      const pendingPPs = goodsRequests.filter(pp => pp.status === 'pending' || pp.status === 'permintaan');
      if (pendingPPs.length > 0) {
        list.push({
          id: `admin-pending-pp-${pendingPPs.length}`,
          title: 'PP Menunggu Persetujuan',
          message: `Ada ${pendingPPs.length} Permintaan Barang (PP) baru yang memerlukan peninjauan & persetujuan Anda.`,
          type: 'pp',
          date: new Date().toISOString().split('T')[0],
          isRead: isItemRead(`admin-pending-pp-${pendingPPs.length}`),
          tab: 'pp'
        });
      }
    }

    // Sort by date (descending) or ID desc
    list.sort((a, b) => b.id.localeCompare(a.id));
    setNotifications(list);
  }, [requests, orders, goodsRequests, currentUser, readIds]);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id: string) => {
    if (!readIds.includes(id)) {
      const newReadIds = [...readIds, id];
      saveReadIds(newReadIds);
    }
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const uniqueIds = Array.from(new Set([...readIds, ...allIds]));
    saveReadIds(uniqueIds);
  };

  const handleClearAll = () => {
    const allIds = notifications.map(n => n.id);
    saveReadIds(allIds);
  };

  const getNotifIcon = (type: 'wr' | 'wo' | 'pp' | 'forum') => {
    switch (type) {
      case 'wr':
        return (
          <div className="p-2 bg-blue-50 border border-blue-200 text-blue-600 rounded-lg shrink-0">
            <FileText className="w-4 h-4" />
          </div>
        );
      case 'wo':
        return (
          <div className="p-2 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg shrink-0">
            <Wrench className="w-4 h-4" />
          </div>
        );
      case 'pp':
        return (
          <div className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg shrink-0">
            <Package className="w-4 h-4" />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg shrink-0">
            <MessageSquare className="w-4 h-4" />
          </div>
        );
    }
  };

  return (
    <div className="relative" id="corner-notifications-panel">
      {/* Trigger Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-slate-600 hover:text-slate-900 rounded-full hover:bg-slate-100 border border-slate-200 bg-white transition cursor-pointer flex items-center justify-center shadow-xs"
        id="btn-bell-notification"
        title="Pemberitahuan"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span 
            className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-600 text-[10px] font-black text-white ring-2 ring-white animate-pulse"
            id="badge-notif-count"
          >
            {unreadCount}
          </span>
        )}
      </button>

      {/* Notifications Popover Dropdown */}
      {isOpen && (
        <>
          {/* Backdrop layer to click close */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
            id="notif-popover-backdrop"
          />

          <div 
            className="fixed right-6 top-[135px] md:absolute md:right-0 md:top-auto md:mt-2.5 w-[calc(100vw-3rem)] md:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden flex flex-col"
            id="notif-popover-card"
            style={{ maxHeight: '480px' }}
          >
            {/* Header */}
            <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-slate-700" />
                <h3 className="font-bold text-slate-800 text-sm">Pemberitahuan</h3>
                {unreadCount > 0 && (
                  <span className="text-[10px] bg-rose-150 text-rose-700 font-extrabold px-1.5 py-0.5 rounded-full border border-rose-200 font-mono">
                    {unreadCount} Baru
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    id="btn-mark-all-read"
                  >
                    Tandai Semua Dibaca
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1 hover:bg-slate-200 text-slate-400 hover:text-slate-700 rounded-lg transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="overflow-y-auto divide-y divide-slate-100 flex-1 max-h-[360px]" id="notif-list-container">
              {notifications.length === 0 ? (
                <div className="py-12 px-4 text-center text-slate-400 space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                  <p className="text-xs font-semibold">Semua bersih!</p>
                  <p className="text-[10px] text-slate-400">Tidak ada pemberitahuan baru saat ini.</p>
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => {
                      handleMarkAsRead(notif.id);
                      onNavigateToTab(notif.tab);
                      setIsOpen(false);
                    }}
                    className={`p-4 flex gap-3 hover:bg-slate-50 transition cursor-pointer ${
                      !notif.isRead ? 'bg-indigo-50/20 font-medium' : ''
                    }`}
                    id={`notif-item-${notif.id}`}
                  >
                    {getNotifIcon(notif.type)}

                    <div className="min-w-0 flex-1 space-y-1">
                      <div className="flex justify-between items-start gap-1">
                        <p className="text-xs font-bold text-slate-800 leading-tight">
                          {notif.title}
                        </p>
                        {!notif.isRead && (
                          <span className="w-2 h-2 rounded-full bg-indigo-600 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        {notif.message}
                      </p>
                      <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                        <Clock className="w-3 h-3 text-slate-300" />
                        <span>{notif.date}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50/20 flex justify-between items-center text-[10px] text-slate-400">
                <span>Pemberitahuan tersaring untuk Anda</span>
                <button
                  onClick={handleClearAll}
                  className="text-rose-600 hover:text-rose-800 font-bold flex items-center gap-1 cursor-pointer transition"
                  id="btn-clear-all-notifs"
                >
                  <Trash2 className="w-3 h-3" />
                  Bersihkan Semua
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
