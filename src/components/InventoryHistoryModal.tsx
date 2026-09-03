import React, { useState, useEffect } from 'react';
import { X, History, Package, Search } from 'lucide-react';
import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { InventoryLog, InventoryItem, GoodsRequest, UserProfile, Company, CompanyBranch, WorkRequest } from '../types';
import PrintPPModal from './PrintPPModal';
import PrintWRModal from './PrintWRModal';

interface InventoryHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  item: InventoryItem;
  currentUser: UserProfile;
}

export default function InventoryHistoryModal({ isOpen, onClose, item, currentUser }: InventoryHistoryModalProps) {
  const [logs, setLogs] = useState<InventoryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [pps, setPps] = useState<Record<string, GoodsRequest>>({});
  const [wrs, setWrs] = useState<Record<string, WorkRequest>>({});
  
  const [selectedPP, setSelectedPP] = useState<GoodsRequest | null>(null);
  const [selectedWR, setSelectedWR] = useState<WorkRequest | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);

  useEffect(() => {
    if (isOpen && item) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // Fetch Logs
          const q = query(
            collection(db, 'inventory_logs'),
            where('inventoryId', '==', item.id)
          );
          const snap = await getDocs(q);
          const logsData: InventoryLog[] = [];
          const ppIdsToFetch = new Set<string>();
          const wrIdsToFetch = new Set<string>();
          
          snap.forEach(docSnap => {
            const data = docSnap.data() as InventoryLog;
            logsData.push(data);
            if (data.ppId) {
              ppIdsToFetch.add(data.ppId);
            }
            if (data.wrId) {
              wrIdsToFetch.add(data.wrId);
            }
          });
          
          logsData.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setLogs(logsData);
          
          // Fetch associated PPs
          const fetchedPps: Record<string, GoodsRequest> = {};
          if (ppIdsToFetch.size > 0) {
            const ppPromises = Array.from(ppIdsToFetch).map(id => getDoc(doc(db, 'goods_requests', id)));
            const ppSnaps = await Promise.all(ppPromises);
            ppSnaps.forEach(ppSnap => {
              if (ppSnap.exists()) {
                fetchedPps[ppSnap.id] = ppSnap.data() as GoodsRequest;
              }
            });
          }
          setPps(fetchedPps);

          // Fetch associated WRs
          const fetchedWrs: Record<string, any> = {}; // using any for WorkRequest type avoiding full import unless necessary
          if (wrIdsToFetch.size > 0) {
            const wrPromises = Array.from(wrIdsToFetch).map(id => getDoc(doc(db, 'work_requests', id.replace(/\//g, '_'))));
            const wrSnaps = await Promise.all(wrPromises);
            wrSnaps.forEach(wrSnap => {
              if (wrSnap.exists()) {
                fetchedWrs[wrSnap.id] = wrSnap.data();
              }
            });
          }
          setWrs(fetchedWrs);
          
          // Fetch companies & branches for DetailPPModal
          const [companiesSnap, branchesSnap] = await Promise.all([
            getDocs(collection(db, 'companies')),
            getDocs(collection(db, 'company_branches'))
          ]);
          setCompanies(companiesSnap.docs.map(d => d.data() as Company));
          setBranches(branchesSnap.docs.map(d => d.data() as CompanyBranch));
          
        } catch (err) {
          console.error("Error fetching inventory logs data:", err);
        } finally {
          setLoading(false);
        }
      };
      fetchData();
    }
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  return (
    <>
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
                  
                  const relatedPP = log.ppId ? pps[log.ppId] : null;
                  const relatedWR = log.wrId ? wrs[log.wrId.replace(/\//g, '_')] : null;
                  const namaPengambil = relatedPP?.namaPengambil;
                  
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
                        
                        {namaPengambil && (
                          <div className="mt-1.5 p-2 bg-blue-50 border border-blue-100 rounded-lg text-[10px] text-blue-800">
                            <strong>Diambil Oleh:</strong> <span className="uppercase font-bold">{namaPengambil}</span>
                          </div>
                        )}
                        
                        {log.ppId && (
                          <button 
                            onClick={() => relatedPP && setSelectedPP(relatedPP)}
                            disabled={!relatedPP}
                            className="mt-2 text-[10px] text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded transition uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer disabled:opacity-50 w-fit"
                          >
                            <Search className="w-3 h-3" /> Buka Info PP: {relatedPP ? relatedPP.nomorPP : log.ppId}
                          </button>
                        )}

                        {log.wrId && (
                          <button 
                            onClick={() => relatedWR && setSelectedWR(relatedWR)}
                            disabled={!relatedWR}
                            className="mt-2 text-[10px] text-amber-600 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-1 rounded transition uppercase font-bold tracking-wider flex items-center gap-1 cursor-pointer disabled:opacity-50 w-fit"
                          >
                            <Search className="w-3 h-3" /> Buka Info WR: {relatedWR ? relatedWR.nomorWR : log.wrId}
                          </button>
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
      
      {selectedPP && (
        <PrintPPModal 
          isOpen={!!selectedPP}
          onClose={() => setSelectedPP(null)}
          pp={selectedPP}
          companies={companies}
          branches={branches}
          currentUser={currentUser}
        />
      )}

      {selectedWR && (
        <PrintWRModal 
          isOpen={!!selectedWR}
          onClose={() => setSelectedWR(null)}
          wr={selectedWR}
          companies={companies}
          branches={branches}
          currentUser={currentUser}
        />
      )}
    </>
  );
}
