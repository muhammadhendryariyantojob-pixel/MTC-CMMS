import re

with open('src/components/GoodsRequestsScreen.tsx', 'r') as f:
    content = f.read()

# 1. Change arrivalLokasiInput to arrivalLokasiInputs
content = content.replace(
    "const [arrivalLokasiInput, setArrivalLokasiInput] = useState('');",
    "const [arrivalLokasiInputs, setArrivalLokasiInputs] = useState<Record<number, string>>({});"
)

content = content.replace("setArrivalLokasiInput('');", "setArrivalLokasiInputs({});")

# 2. Modify submitArrival block
old_submit = """      // Mark selected items as arrived
      selectedItemIndexes.forEach(idx => {
        if (!updatedItems[idx].arrivedAt) {
          updatedItems[idx].arrivedAt = nowStr;
          updatedItems[idx].arrivedOleh = currentUser.name;
        }
      });
      
      // Check if all items have arrived
      let allArrived = true;
      updatedItems.forEach(item => {
        if (!item.arrivedAt) allArrived = false;
      });
      
      const updates: any = {
        status: allArrived ? 'telah_datang' : 'parsial_datang',
        itemsList: updatedItems
      };
      
      if (allArrived) {
        updates.status = 'telah_datang';
        updates.arrivedAt = nowStr;
        updates.arrivedOleh = currentUser.name;
        if (arrivalLokasiInput.trim()) {
           updates.lokasiBarang = arrivalLokasiInput.trim();
        }
      }"""

new_submit = """      // Mark selected items as arrived
      selectedItemIndexes.forEach(idx => {
        if (!updatedItems[idx].arrivedAt) {
          updatedItems[idx].arrivedAt = nowStr;
          updatedItems[idx].arrivedOleh = currentUser.name;
          if (arrivalLokasiInputs[idx] && arrivalLokasiInputs[idx].trim() !== '') {
            updatedItems[idx].lokasiBarang = arrivalLokasiInputs[idx].trim();
          }
        }
      });
      
      // Check if all items have arrived
      let allArrived = true;
      updatedItems.forEach(item => {
        if (!item.arrivedAt) allArrived = false;
      });
      
      const updates: any = {
        status: allArrived ? 'telah_datang' : 'parsial_datang',
        itemsList: updatedItems
      };
      
      if (allArrived) {
        updates.status = 'telah_datang';
        updates.arrivedAt = nowStr;
        updates.arrivedOleh = currentUser.name;
      }"""

content = content.replace(old_submit, new_submit)

# 3. Modify the modal JSX
old_jsx_item = """                        {isAlreadyArrived && item.arrivedOleh && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-medium bg-emerald-50 inline-block px-1.5 py-0.5 rounded">
                            Telah tiba (Diterima {item.arrivedOleh})
                          </p>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>

              {((activeArrivalPP.itemsList || [{}]).filter((item: any) => !item.arrivedAt).length === selectedItemIndexes.length && selectedItemIndexes.length > 0) && (
                <div className="space-y-2 animate-fadeIn bg-rose-50/50 p-4 rounded-lg border border-rose-100">
                  <label className="block text-xs font-bold text-rose-800 uppercase">Input Lokasi Penyimpanan Barang (Opsional):</label>
                  <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false" 
                    type="text" 
                    placeholder="Contoh: Rak B3, Meja HSE, Gudang MTC"
                    value={arrivalLokasiInput}
                    onChange={(e) => setArrivalLokasiInput(e.target.value)}
                    className="w-full bg-white px-3 py-2 border border-rose-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                  />
                  <p className="text-[10px] text-slate-500 italic">Karena semua item sudah tiba, status PP akan otomatis berubah menjadi "Telah Datang".</p>
                </div>
              )}"""


new_jsx_item = """                        {isAlreadyArrived && item.arrivedOleh && (
                          <p className="text-[10px] text-emerald-600 mt-1 font-medium bg-emerald-50 inline-block px-1.5 py-0.5 rounded">
                            Telah tiba (Diterima {item.arrivedOleh}) {item.lokasiBarang ? `di ${item.lokasiBarang}` : ''}
                          </p>
                        )}
                        {!isAlreadyArrived && selectedItemIndexes.includes(idx) && (
                          <div className="mt-2" onClick={(e) => e.preventDefault()}>
                            <input autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck="false"
                              type="text"
                              placeholder="Lokasi (Opsional, ex: Rak B3)"
                              value={arrivalLokasiInputs[idx] || ''}
                              onChange={(e) => setArrivalLokasiInputs({...arrivalLokasiInputs, [idx]: e.target.value})}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full bg-white px-2 py-1.5 border border-rose-300 rounded text-xs focus:outline-none focus:border-rose-500"
                            />
                          </div>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>"""

content = content.replace(old_jsx_item, new_jsx_item)

# Ensure reset inside modal open (if not covered)
# Look for setShowArrivalModal(true) and add setArrivalLokasiInputs({}) there
content = re.sub(r'setShowArrivalModal\(true\);', r'setShowArrivalModal(true);\n    setArrivalLokasiInputs({});', content)

with open('src/components/GoodsRequestsScreen.tsx', 'w') as f:
    f.write(content)
