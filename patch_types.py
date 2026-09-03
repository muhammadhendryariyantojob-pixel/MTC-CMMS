import re

with open('src/types.ts', 'r') as f:
    content = f.read()

content = content.replace("referensiFotoUrl?: string;", "referensiFotoUrl?: string;\n  lokasiBarang?: string;")

with open('src/types.ts', 'w') as f:
    f.write(content)
