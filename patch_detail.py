import re

with open('src/components/DetailPPModal.tsx', 'r') as f:
    content = f.read()

# I will add lokasiBarang under the status tags
old_tags = """                          {item.arrivedAt && (
                            <span className="px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600 text-[8px] font-bold tracking-wider whitespace-nowrap">TELAH DATANG</span>
                          )}"""

new_tags = """                          {item.arrivedAt && (
                            <span className="px-1.5 py-0.5 rounded border border-rose-200 bg-rose-50 text-rose-600 text-[8px] font-bold tracking-wider whitespace-nowrap">TELAH DATANG</span>
                          )}
                          {item.lokasiBarang && (
                            <span className="px-1.5 py-0.5 rounded border border-purple-200 bg-purple-50 text-purple-600 text-[8px] font-bold tracking-wider whitespace-nowrap">LOKASI: {item.lokasiBarang.toUpperCase()}</span>
                          )}"""

content = content.replace(old_tags, new_tags)

with open('src/components/DetailPPModal.tsx', 'w') as f:
    f.write(content)
