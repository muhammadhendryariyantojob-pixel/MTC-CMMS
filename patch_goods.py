import re

with open('src/components/GoodsRequestsScreen.tsx', 'r') as f:
    content = f.read()

# 1. Update the table and grid variables
content = content.replace(
    "const isArrived = pp.status === 'telah_datang';",
    "const isArrived = pp.status === 'telah_datang';\n                  const hasUncollectedArrivedItems = (pp.itemsList || []).some((item: any) => item.arrivedAt && !item.collectedAt);"
)

# 2. Update table actions
content = content.replace(
    "{isArrived && (\n                                <button\n                                  onClick={() => {\n                                    setActiveCollectionPP(pp);",
    "{(isArrived || hasUncollectedArrivedItems) && (\n                                <button\n                                  onClick={() => {\n                                    setActiveCollectionPP(pp);"
)

# 3. Update grid actions
content = content.replace(
    "{isArrived && (\n                            <button\n                              onClick={() => {\n                                setActiveCollectionPP(pp);",
    "{(isArrived || hasUncollectedArrivedItems) && (\n                            <button\n                              onClick={() => {\n                                setActiveCollectionPP(pp);"
)

# 4. Collection Modal Render modifications
collection_modal_search = """                {(activeCollectionPP.itemsList || [{
                  namaBarang: activeCollectionPP.namaBarang,
                  jumlah: activeCollectionPP.jumlah,
                  satuan: activeCollectionPP.satuan
                }]).map((item, idx) => {
                  const isAlreadyCollected = !!item.collectedAt;
                  const isSelected = selectedItemIndexes.includes(idx);"""

collection_modal_replace = """                {(activeCollectionPP.itemsList || [{
                  namaBarang: activeCollectionPP.namaBarang,
                  jumlah: activeCollectionPP.jumlah,
                  satuan: activeCollectionPP.satuan
                }]).map((item: any, idx: number) => {
                  const isAlreadyCollected = !!item.collectedAt;
                  const isItemArrived = !!item.arrivedAt;
                  const canBeCollected = isItemArrived && !isAlreadyCollected;
                  const isSelected = selectedItemIndexes.includes(idx);"""

content = content.replace(collection_modal_search, collection_modal_replace)

content = content.replace(
    "disabled={isAlreadyCollected}",
    "disabled={!canBeCollected}"
)

# Check if item has not arrived
content = content.replace(
    "{isAlreadyCollected && item.namaPengambil && (",
    "{!isAlreadyCollected && !isItemArrived && (\n                            <p className=\"text-[10px] text-amber-600 font-medium bg-amber-100 inline-block px-1.5 py-0.5 rounded mt-1\">\n                              Belum Datang\n                            </p>\n                          )}\n                          {isAlreadyCollected && item.namaPengambil && ("
)

with open('src/components/GoodsRequestsScreen.tsx', 'w') as f:
    f.write(content)
