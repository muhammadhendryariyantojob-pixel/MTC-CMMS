import re

with open('src/components/GoodsRequestsScreen.tsx', 'r') as f:
    content = f.read()

bad_block = """      if (allArrived) {
        updates.status = 'telah_datang';
        updates.arrivedAt = nowStr;
        updates.arrivedOleh = currentUser.name;
        if (arrivalLokasiInput.trim()) {
           updates.lokasiBarang = arrivalLokasiInput.trim();
        }
      }"""

good_block = """      if (allArrived) {
        updates.status = 'telah_datang';
        updates.arrivedAt = nowStr;
        updates.arrivedOleh = currentUser.name;
      }"""

content = content.replace(bad_block, good_block)

with open('src/components/GoodsRequestsScreen.tsx', 'w') as f:
    f.write(content)
