import re

with open('src/components/PrintPPModal.tsx', 'r') as f:
    content = f.read()

# I will replace `pp.lokasiBarang` occurrences with `combinedLokasi`
# First, add combinedLokasi at the top of handlePrint and component render.

content = content.replace(
    "const handlePrint = () => {",
    "const combinedLokasi = pp.lokasiBarang || [...new Set((pp.itemsList || []).map(i => i.lokasiBarang).filter(Boolean))].join(', ');\n\n  const handlePrint = () => {"
)

# Fix in excel print:
content = content.replace("if (pp.lokasiBarang) {", "if (combinedLokasi) {")
content = content.replace("data.push(['LOKASI PENYIMPANAN SPAREPART', pp.lokasiBarang, 'Status: Ready / Datang']);", "data.push(['LOKASI PENYIMPANAN SPAREPART', combinedLokasi, 'Status: Ready / Datang']);")

# Fix in visual print modal:
content = content.replace("{pp.lokasiBarang && (", "{combinedLokasi && (")
content = content.replace("{pp.lokasiBarang}</span>", "{combinedLokasi}</span>")

with open('src/components/PrintPPModal.tsx', 'w') as f:
    f.write(content)
