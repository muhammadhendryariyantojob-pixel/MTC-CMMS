import re

with open('src/components/GoodsRequestsScreen.tsx', 'r') as f:
    content = f.read()

# I need to fix the dangling log block. Let's find it.
bad_block = """      // Decrement inventory stock for each item that comes from inventory
      for (const item of itemsToSubmit) {
        if (item.inventoryId) {
          await updateDoc(doc(db, 'inventory', item.inventoryId), {
            stock: increment(-item.jumlah)
          });
        }
      }

        const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
        await setDoc(doc(db, 'inventory_logs', logId), {
          id: logId,
          inventoryId: selectedInventoryId,
          ppId: ppId,
          change: -finalJumlah,
          reason: `Permintaan Barang (PP): ${ppId}`,
          createdAt: new Date().toISOString(),
          createdBy: currentUser.name
        });
      }"""

good_block = """      // Decrement inventory stock for each item that comes from inventory
      for (const item of itemsToSubmit) {
        if (item.inventoryId) {
          await updateDoc(doc(db, 'inventory', item.inventoryId), {
            stock: increment(-item.jumlah)
          });
          
          const logId = Date.now().toString() + Math.floor(Math.random() * 1000);
          await setDoc(doc(db, 'inventory_logs', logId), {
            id: logId,
            inventoryId: item.inventoryId,
            ppId: ppId,
            change: -item.jumlah,
            reason: `Permintaan Barang (PP): ${ppId}`,
            createdAt: new Date().toISOString(),
            createdBy: currentUser.name
          });
        }
      }"""

content = content.replace(bad_block, good_block)

# Also fix the duplicate setLocalItems([]) that was generated
content = content.replace("setLocalItems([]);\n      setLocalItems([]);", "setLocalItems([]);")

with open('src/components/GoodsRequestsScreen.tsx', 'w') as f:
    f.write(content)
