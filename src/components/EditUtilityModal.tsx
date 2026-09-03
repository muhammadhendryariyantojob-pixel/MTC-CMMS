import React, { useState, useEffect } from 'react';
import { X, Save, Calculator, AlertTriangle, Droplet, Flame, Zap } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { UtilityReport } from '../types';

interface EditUtilityModalProps {
  report: UtilityReport;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const EditUtilityModal: React.FC<EditUtilityModalProps> = ({ report, onClose, onSaveSuccess }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parameter Listrik
  const [multiplier, setMultiplier] = useState<number>(report.multiplier);
  const [tarifLWBP, setTarifLWBP] = useState<number>(report.tarifLWBP);
  const [tarifWBP, setTarifWBP] = useState<number>(report.tarifWBP);
  const [tarifKVArh, setTarifKVArh] = useState<number>(report.tarifKVArh);
  const [pajakPPJ, setPajakPPJ] = useState<number>(report.pajakPPJ);

  // Stand Awal
  const [standAwalLWBP, setStandAwalLWBP] = useState<string>(report.standAwalLWBP.toString());
  const [standAwalWBP, setStandAwalWBP] = useState<string>(report.standAwalWBP.toString());
  const [standAwalKVArh, setStandAwalKVArh] = useState<string>(report.standAwalKVArh.toString());

  // Stand Akhir
  const [standAkhirLWBP, setStandAkhirLWBP] = useState<string>(report.standAkhirLWBP.toString());
  const [standAkhirWBP, setStandAkhirWBP] = useState<string>(report.standAkhirWBP.toString());
  const [standAkhirKVArh, setStandAkhirKVArh] = useState<string>(report.standAkhirKVArh.toString());

  // Utilitas Lain
  const [konsumsiAir, setKonsumsiAir] = useState<string>((report.konsumsiAir || 0).toString());
  const [runHourBoiler1, setRunHourBoiler1] = useState<string>((report.runHourBoiler1 ?? report.runHourBoiler ?? 0).toString());
  const [runHourBoiler2, setRunHourBoiler2] = useState<string>((report.runHourBoiler2 || 0).toString());
  const [plantId, setPlantId] = useState<string>(report.plantId || 'wo-plant');

  const [liveCalc, setLiveCalc] = useState<any>(null);

  // Recalculate Live whenever inputs change
  useEffect(() => {
    const numAwalLWBP = parseFloat(standAwalLWBP) || 0;
    const numAwalWBP = parseFloat(standAwalWBP) || 0;
    const numAwalKVArh = parseFloat(standAwalKVArh) || 0;
    
    const numAkhirLWBP = parseFloat(standAkhirLWBP) || 0;
    const numAkhirWBP = parseFloat(standAkhirWBP) || 0;
    const numAkhirKVArh = parseFloat(standAkhirKVArh) || 0;

    const selisihLWBP = Math.max(0, numAkhirLWBP - numAwalLWBP);
    const selisihWBP = Math.max(0, numAkhirWBP - numAwalWBP);
    const selisihKVArh = Math.max(0, numAkhirKVArh - numAwalKVArh);

    const pemakaianLWBP = selisihLWBP * multiplier;
    const pemakaianWBP = selisihWBP * multiplier;
    const pemakaianKVArh = selisihKVArh * multiplier;

    const totalKWh = pemakaianLWBP + pemakaianWBP;
    const batasToleransiKVArh = totalKWh * 0.62;
    const kelebihanKVArh = Math.max(0, pemakaianKVArh - batasToleransiKVArh);

    const biayaLWBP = pemakaianLWBP * tarifLWBP;
    const biayaWBP = pemakaianWBP * tarifWBP;
    const biayaDendaKVArh = kelebihanKVArh * tarifKVArh;

    const subtotalBiaya = biayaLWBP + biayaWBP + biayaDendaKVArh;
    const nominalPajak = subtotalBiaya * (pajakPPJ / 100);
    const totalBayar = subtotalBiaya + nominalPajak;

    setLiveCalc({
      pemakaianLWBP,
      pemakaianWBP,
      pemakaianKVArh,
      totalKWh,
      batasToleransiKVArh,
      kelebihanKVArh,
      biayaLWBP,
      biayaWBP,
      biayaDendaKVArh,
      subtotalBiaya,
      nominalPajak,
      totalBayar
    });
  }, [
    standAwalLWBP, standAwalWBP, standAwalKVArh, 
    standAkhirLWBP, standAkhirWBP, standAkhirKVArh, 
    multiplier, tarifLWBP, tarifWBP, tarifKVArh, pajakPPJ
  ]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAwalLWBP = parseFloat(standAwalLWBP);
    const numAwalWBP = parseFloat(standAwalWBP);
    const numAwalKVArh = parseFloat(standAwalKVArh);
    const numAkhirLWBP = parseFloat(standAkhirLWBP);
    const numAkhirWBP = parseFloat(standAkhirWBP);
    const numAkhirKVArh = parseFloat(standAkhirKVArh);

    if (
      isNaN(numAwalLWBP) || isNaN(numAwalWBP) || isNaN(numAwalKVArh) ||
      isNaN(numAkhirLWBP) || isNaN(numAkhirWBP) || isNaN(numAkhirKVArh)
    ) {
      setError("Pastikan semua form meter stand telah diisi dengan angka yang valid.");
      return;
    }

    if (
      numAkhirLWBP < numAwalLWBP ||
      numAkhirWBP < numAwalWBP ||
      numAkhirKVArh < numAwalKVArh
    ) {
      setError("Stand Akhir tidak boleh lebih kecil dari Stand Awal.");
      return;
    }

    setSubmitting(true);

    try {
      if (!liveCalc) throw new Error("Kalkulasi gagal");

      const updateData = {
        multiplier,
        tarifLWBP,
        tarifWBP,
        tarifKVArh,
        pajakPPJ,
        
        standAwalLWBP: numAwalLWBP,
        standAwalWBP: numAwalWBP,
        standAwalKVArh: numAwalKVArh,
        
        standAkhirLWBP: numAkhirLWBP,
        standAkhirWBP: numAkhirWBP,
        standAkhirKVArh: numAkhirKVArh,
        
        selisihLWBP: Math.max(0, numAkhirLWBP - numAwalLWBP),
        selisihWBP: Math.max(0, numAkhirWBP - numAwalWBP),
        selisihKVArh: Math.max(0, numAkhirKVArh - numAwalKVArh),
        
        pemakaianLWBP: liveCalc.pemakaianLWBP,
        pemakaianWBP: liveCalc.pemakaianWBP,
        pemakaianKVArh: liveCalc.pemakaianKVArh,
        
        totalKWh: liveCalc.totalKWh,
        batasToleransiKVArh: liveCalc.batasToleransiKVArh,
        kelebihanKVArh: liveCalc.kelebihanKVArh,
        
        biayaLWBP: liveCalc.biayaLWBP,
        biayaWBP: liveCalc.biayaWBP,
        biayaDendaKVArh: liveCalc.biayaDendaKVArh,
        subtotalBiaya: liveCalc.subtotalBiaya,
        nominalPajak: liveCalc.nominalPajak,
        totalBayar: liveCalc.totalBayar,
        
        konsumsiAir: parseFloat(konsumsiAir) || 0,
        runHourBoiler1: parseFloat(runHourBoiler1) || 0,
        runHourBoiler2: parseFloat(runHourBoiler2) || 0,
        runHourBoiler: (parseFloat(runHourBoiler1) || 0) + (parseFloat(runHourBoiler2) || 0),
        plantId: plantId
      };

      await updateDoc(doc(db, 'electricity_reports', report.id), updateData);
      
      setSubmitting(false);
      onSaveSuccess();
    } catch (err: any) {
      console.error("Error updating document: ", err);
      setError(err.message || "Terjadi kesalahan saat memperbarui laporan.");
      setSubmitting(false);
    }
  };

  const formatIDR = (val: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);
  };

  const formatDec = (val: number) => {
    return new Intl.NumberFormat('id-ID', { maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-2xl shadow-xl flex flex-col max-h-[90vh]">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 rounded-t-2xl shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg">
              <Calculator className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-wider">Edit Laporan Utilitas</h2>
              <p className="text-[10px] text-slate-500 font-medium">Tanggal Laporan: <span className="font-bold">{report.tanggalLaporan}</span></p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 dark:bg-rose-900/30 border border-rose-200 dark:border-rose-800 rounded-xl flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-bold text-rose-800 dark:text-rose-200 uppercase tracking-wider">Kesalahan Validasi</h4>
                <p className="text-xs text-rose-600 dark:text-rose-300 mt-1">{error}</p>
              </div>
            </div>
          )}

          <form autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" id="editUtilityForm" onSubmit={handleUpdate} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Stand Awal & Akhir Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Zap className="w-4 h-4 text-indigo-500" /> A. Parameter Listrik (Meter Stand)
                </h3>
                
                

                <div className="space-y-3 p-4 bg-indigo-50/50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-800">
                  <h4 className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Input Stand Meter</h4>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">LWBP</label>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={standAkhirLWBP} onChange={(e) => setStandAkhirLWBP(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">WBP</label>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={standAkhirWBP} onChange={(e) => setStandAkhirWBP(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block">kVArh</label>
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={standAkhirKVArh} onChange={(e) => setStandAkhirKVArh(e.target.value)} className="w-full px-2 py-1.5 bg-white dark:bg-slate-900 border border-indigo-200 dark:border-indigo-700 rounded text-xs font-mono font-bold text-indigo-700 dark:text-indigo-300" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Utility Grid */}
              <div className="space-y-4">
                <h3 className="text-xs font-black text-slate-800 dark:text-white uppercase flex items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <Droplet className="w-4 h-4 text-blue-500" /> B. Parameter Utilitas (Air & Boiler)
                </h3>
                
                <div className="space-y-4 p-4 bg-slate-50 dark:bg-slate-800/30 rounded-xl border border-slate-200 dark:border-slate-700">
                  
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block uppercase tracking-wider">Konsumsi Air (m³/hari)</label>
                    <div className="flex items-center gap-2 relative">
                      <Droplet className="w-4 h-4 text-blue-500 absolute left-3 top-2.5" />
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={konsumsiAir} onChange={(e) => setKonsumsiAir(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block uppercase tracking-wider">Run Hour Boiler 1 (Jam)</label>
                    <div className="flex items-center gap-2 relative">
                      <Flame className="w-4 h-4 text-amber-500 absolute left-3 top-2.5" />
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={runHourBoiler1} onChange={(e) => setRunHourBoiler1(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono font-bold" />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-400 mb-1 block uppercase tracking-wider">Run Hour Boiler 2 (Jam)</label>
                    <div className="flex items-center gap-2 relative">
                      <Flame className="w-4 h-4 text-orange-500 absolute left-3 top-2.5" />
                      <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" type="number" step="0.01" required value={runHourBoiler2} onChange={(e) => setRunHourBoiler2(e.target.value)} className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-mono font-bold" />
                    </div>
                  </div>

                </div>

                <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800/50">
                  <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Live Kalkulasi</h4>
                  {liveCalc ? (
                    <div className="space-y-2 text-[10px]">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pemakaian LWBP</span>
                        <span className="font-mono font-bold">{formatDec(liveCalc.pemakaianLWBP)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pemakaian WBP</span>
                        <span className="font-mono font-bold">{formatDec(liveCalc.pemakaianWBP)} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Biaya (Inc. Pajak)</span>
                        <span className="font-mono font-black text-indigo-600 dark:text-indigo-400 text-xs">{formatIDR(liveCalc.totalBayar)}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-slate-400 text-center py-2">Menghitung...</div>
                  )}
                </div>
              </div>
            </div>
          </form>
        </div>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl shrink-0 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600 dark:hover:bg-slate-700"
          >
            Batal
          </button>
          <button
            type="submit"
            form="editUtilityForm"
            disabled={submitting}
            className="px-6 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {submitting ? (
              <>Menyimpan...</>
            ) : (
              <>
                <Save className="w-4 h-4" /> Simpan Perubahan
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
