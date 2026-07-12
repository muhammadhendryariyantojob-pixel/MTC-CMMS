import React, { useState, useEffect } from 'react';
import { X, History, Package } from 'lucide-react';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryLog, InventoryItem } from '../types';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
}

export default function InventoryHistoryModal({ isOpen, onClose, item }: InventoryHistoryModalProps) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && item) {
      const fetchLogs = async () => {
        setLoading(true);
        try {
          const q = query(
            collection(db, 'inventory_logs'),
            where('inventoryId', '==', item.id)
          );
          const snap = await getDocs(q);
          const logsData: InventoryLog[] = [];
          snap.forEach(doc => {
            logsData.push(doc.data() as InventoryLog);
          });
          logsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLogs(logsData);
        } catch (err) {
          console.error("Error fetching inventory logs:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchLogs();
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black text-slate-800 uppercase tracking-wider">Riwayat Stok</h3>
              <p className="text-xs text-slate-500">{item.name} ({item.code})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto flex-1 bg-white">
          {loading ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center p-8 text-slate-500 flex flex-col items-center">
              <Package className="w-12 h-12 text-slate-300 mb-3" />
              <p className="text-sm font-medium">Belum ada riwayat stok untuk barang ini.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => {
                const isAddition = log.change > 0;
                const changeColor = isAddition ? 'text-emerald-600 bg-emerald-50 border-emerald-200' : 'text-rose-600 bg-rose-50 border-rose-200';
                
                return (
                  <div key={log.id} className="flex items-start gap-4 p-4 border border-slate-100 rounded-xl bg-slate-50">
                    <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm ${changeColor}`}>
                      {isAddition ? '+' : ''}{log.change}
                    </div>
                    <div className="flex-1">
                      <div className="flex justify-between items-start mb-1">
                        <p className="text-xs font-bold text-slate-800">{log.reason}</p>
                        <span className="text-[10px] text-slate-500 font-mono">
                          {new Date(log.createdAt).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        Oleh: <strong className="text-slate-700">{log.createdBy}</strong>
                      </p>
                      {log.ppId && (
                        <p className="text-[10px] text-blue-600 mt-1 uppercase font-bold tracking-wider">
                          Ref PP: {log.ppId}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
