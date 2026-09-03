import re

with open('src/components/GoodsRequestsScreen.tsx', 'r') as f:
    content = f.read()

# 1. Add handleAddLocalItem and handleRemoveLocalItem before handleSubmit
add_funcs = """
  const handleAddLocalItem = () => {
    if (!namaBarang.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi nama barang terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (!kegunaan.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi kegunaan / alasan penggantian terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
    
    if (selectedInventoryId) {
      const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
      if (selectedInventory && finalJumlah > selectedInventory.stock) {
        setDialogConfig({
          isOpen: true,
          title: 'Stok Tidak Mencukupi',
          message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}).`,
          confirmLabel: 'Mengerti',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }

    const newItem: GoodsRequestItem = {
      namaBarang: namaBarang.trim(),
      jumlah: finalJumlah,
      satuan,
      kegunaan: kegunaan.trim(),
      referensiLink: refLink.trim() || '',
      referensiFotoUrl: refFotoUrl || '',
      ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
    };

    setLocalItems([...localItems, newItem]);

    setNamaBarang('');
    setJumlah(1);
    setSatuan('Pcs');
    setKegunaan('');
    setRefLink('');
    setRefFotoUrl('');
    setSelectedInventoryId(undefined);
  };

  const handleRemoveLocalItem = (index: number) => {
    setLocalItems(localItems.filter((_, i) => i !== index));
  };
"""

content = content.replace("const handleSubmit = async (e: React.FormEvent) => {", add_funcs + "\n  const handleSubmit = async (e: React.FormEvent) => {")

# 2. Update handleSubmit body
submit_body_old = """    if (!namaBarang.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi nama barang terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (!kegunaan.trim()) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Tidak Valid',
        message: 'Mohon isi kegunaan / alasan penggantian terlebih dahulu.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }

    if (selectedInventoryId) {
      const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      
      if (selectedInventory && finalJumlah > selectedInventory.stock) {
        setDialogConfig({
          isOpen: true,
          title: 'Stok Tidak Mencukupi',
          message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}). Mohon meminta sesuai stok, atau buat PP biasa dengan menambahkan nama barang menjadi (STOK_${namaBarang}) jika ingin mengajukan sisa kebutuhan di luar inventory.`,
          confirmLabel: 'Mengerti',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
    }"""

submit_body_new = """    let itemsToSubmit = [...localItems];

    if (namaBarang.trim()) {
      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      if (!kegunaan.trim()) {
        setDialogConfig({
          isOpen: true,
          title: 'Formulir Tidak Valid',
          message: 'Mohon isi kegunaan untuk barang yang sedang diketik.',
          confirmLabel: 'Tutup',
          alertOnly: true,
          variant: 'warning',
          onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
        });
        return;
      }
      if (selectedInventoryId) {
        const selectedInventory = inventoryItems.find(i => i.id === selectedInventoryId);
        if (selectedInventory && finalJumlah > selectedInventory.stock) {
          setDialogConfig({
            isOpen: true,
            title: 'Stok Tidak Mencukupi',
            message: `Jumlah permintaan (${finalJumlah} ${satuan}) melebihi sisa stok di inventory (${selectedInventory.stock} ${satuan}).`,
            confirmLabel: 'Mengerti',
            alertOnly: true,
            variant: 'warning',
            onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
          });
          return;
        }
      }
      
      const newItem: GoodsRequestItem = {
        namaBarang: namaBarang.trim(),
        jumlah: finalJumlah,
        satuan,
        kegunaan: kegunaan.trim(),
        referensiLink: refLink.trim() || '',
        referensiFotoUrl: refFotoUrl || '',
        ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
      };
      itemsToSubmit.push(newItem);
    }

    if (itemsToSubmit.length === 0) {
      setDialogConfig({
        isOpen: true,
        title: 'Formulir Kosong',
        message: 'Mohon isi atau tambahkan setidaknya 1 item barang.',
        confirmLabel: 'Tutup',
        alertOnly: true,
        variant: 'warning',
        onConfirm: () => setDialogConfig(prev => ({ ...prev, isOpen: false }))
      });
      return;
    }"""

content = content.replace(submit_body_old, submit_body_new)


# 3. Modify singleItem logic inside handleSubmit to itemsList
old_new_pp = """      const finalJumlah = typeof jumlah === 'number' ? jumlah : 1;
      const singleItem: GoodsRequestItem = {
        namaBarang: namaBarang.trim(),
        jumlah: finalJumlah,
        satuan,
        kegunaan: kegunaan.trim(),
        referensiLink: refLink.trim() || '',
        referensiFotoUrl: refFotoUrl || '',
        ...(selectedInventoryId ? { inventoryId: selectedInventoryId } : {})
      };

      const newPP: GoodsRequest = {
        id: safePpId,
        nomorPP: ppId,
        namaBarang: singleItem.namaBarang,
        jumlah: singleItem.jumlah,
        satuan: singleItem.satuan,
        kegunaan: singleItem.kegunaan,
        itemsList: [singleItem],
        diajukanOleh: currentUser.name || 'Unknown',
        divisiPengaju: currentUser.division || 'MTC',
        tanggalPengajuan: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
        companyId: currentUser.companyId || 'default',
        cabangId: currentUser.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'goods_requests', safePpId), newPP);

      // Decrement inventory stock if it's from inventory
      if (selectedInventoryId) {
        await updateDoc(doc(db, 'inventory', selectedInventoryId), {
          stock: increment(-finalJumlah)
        });"""

new_new_pp = """      const firstItem = itemsToSubmit[0];

      const newPP: GoodsRequest = {
        id: safePpId,
        nomorPP: ppId,
        namaBarang: firstItem.namaBarang,
        jumlah: firstItem.jumlah,
        satuan: firstItem.satuan,
        kegunaan: firstItem.kegunaan,
        itemsList: itemsToSubmit,
        diajukanOleh: currentUser.name || 'Unknown',
        divisiPengaju: currentUser.division || 'MTC',
        tanggalPengajuan: today,
        status: 'pending',
        createdAt: new Date().toISOString(),
        companyId: currentUser.companyId || 'default',
        cabangId: currentUser.cabangId || 'pusat'
      };

      await setDoc(doc(db, 'goods_requests', safePpId), newPP);

      // Decrement inventory stock for each item that comes from inventory
      for (const item of itemsToSubmit) {
        if (item.inventoryId) {
          await updateDoc(doc(db, 'inventory', item.inventoryId), {
            stock: increment(-item.jumlah)
          });
        }
      }"""

content = content.replace(old_new_pp, new_new_pp)


# 4. Modify successful submission reset logic
old_reset = """      setNamaBarang('');
      setJumlah(1);
      setSatuan('Pcs');
      setKegunaan('');
      setRefLink('');
      setRefFotoUrl('');
      setSelectedInventoryId(undefined);"""

new_reset = """      setNamaBarang('');
      setJumlah(1);
      setSatuan('Pcs');
      setKegunaan('');
      setRefLink('');
      setRefFotoUrl('');
      setSelectedInventoryId(undefined);
      setLocalItems([]);"""

content = content.replace(old_reset, new_reset)

# 5. Add "Tambah Item" button and the list inside the form
form_info_old = """            {/* Info summary */}
            <div className="md:col-span-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p>💡 Tips: Isi nama barang, jumlah, satuan, alasan kegunaan, serta link atau foto referensi jika ada, lalu klik tombol "Kirim Permintaan" untuk memproses.</p>
            </div>

            <div className="md:col-span-3 border-t border-slate-100 pt-4 flex justify-end gap-2" id="pp-form-actions">"""

form_info_new = """            {/* Tambah item button */}
            <div className="md:col-span-3 flex justify-end">
              <button
                type="button"
                onClick={handleAddLocalItem}
                className="px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-lg border border-indigo-200 transition cursor-pointer flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Tambah Item ke Daftar
              </button>
            </div>

            {/* List of items */}
            {localItems.length > 0 && (
              <div className="md:col-span-3 bg-white border border-slate-200 rounded-lg overflow-hidden">
                <div className="bg-slate-50 px-4 py-2 border-b border-slate-200 flex justify-between items-center">
                  <h4 className="text-xs font-bold text-slate-700 flex items-center gap-2">
                    <List className="w-4 h-4 text-emerald-500" />
                    Daftar Barang ({localItems.length})
                  </h4>
                </div>
                <ul className="divide-y divide-slate-100">
                  {localItems.map((item, idx) => (
                    <li key={idx} className="p-3 flex items-start justify-between hover:bg-slate-50 transition">
                      <div className="flex-1 pr-4">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-800 uppercase">{item.namaBarang}</span>
                          {item.inventoryId && (
                            <span className="px-1.5 py-0.5 rounded border border-blue-200 bg-blue-50 text-blue-600 text-[8px] font-bold tracking-wider whitespace-nowrap">INVENTORY</span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-500 mt-1">
                          <span className="font-semibold text-emerald-600">{item.jumlah} {item.satuan}</span> • {item.kegunaan}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveLocalItem(idx)}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-md transition"
                        title="Hapus item"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Info summary */}
            <div className="md:col-span-3 p-3 bg-slate-50 rounded-lg border border-slate-200 text-[10px] text-slate-500 space-y-1">
              <p>💡 Tips: Anda bisa menambahkan lebih dari 1 barang dengan klik "Tambah Item ke Daftar". Jika sudah selesai, klik tombol "Kirim Permintaan" untuk memproses.</p>
            </div>

            <div className="md:col-span-3 border-t border-slate-100 pt-4 flex justify-end gap-2" id="pp-form-actions">"""

content = content.replace(form_info_old, form_info_new)

# 6. Change Form button behavior: if localItems length > 0, button handles submission
# The button already calls handleSubmit which handles everything.

with open('src/components/GoodsRequestsScreen.tsx', 'w') as f:
    f.write(content)
