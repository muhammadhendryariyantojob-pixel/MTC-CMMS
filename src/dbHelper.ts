import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  query, 
  where, 
  orderBy, 
  addDoc, 
  updateDoc, 
  deleteDoc,
  serverTimestamp,
  getDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from './firebase';
import { UserProfile, WorkRequest, WorkOrder, GoodsRequest, ForumMessage, Asset, InventoryItem } from './types';

// Convert month index (0-11) to Roman Numeral
export function getRomanMonth(monthIndex: number): string {
  const romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
  return romans[monthIndex] || 'I';
}

// Default user credentials to seed
export const DEFAULT_USERS: UserProfile[] = [
  {
    username: 'admin',
    name: 'Administrator Utama',
    pin: '1234',
    role: 'admin',
    subRole: 'System Developer',
    division: 'ICT',
    active: true,
    companyId: 'default'
  },
  {
    username: 'hse_budi',
    name: 'Budi (HSE)',
    pin: '1111',
    role: 'departemen',
    subRole: 'HSE Staff',
    division: 'HSE',
    active: true,
    companyId: 'default'
  },
  {
    username: 'prd_rudi',
    name: 'Rudi (PRD)',
    pin: '2222',
    role: 'departemen',
    subRole: 'Production Supervisor',
    division: 'PRD SMBS',
    active: true,
    companyId: 'default'
  },
  {
    username: 'ga_siti',
    name: 'Siti (GA)',
    pin: '3333',
    role: 'departemen',
    subRole: 'General Affairs Staff',
    division: 'GA',
    active: true,
    companyId: 'default'
  },
  {
    username: 'mtc_manager',
    name: 'Haryono (MTC Manager)',
    pin: '4444',
    role: 'management',
    subRole: 'MTC Manager',
    division: 'MTC',
    active: true,
    companyId: 'default'
  },
  {
    username: 'mtc_spv',
    name: 'Agus (MTC Supervisor)',
    pin: '5555',
    role: 'management',
    subRole: 'MTC Supervisor',
    division: 'MTC',
    active: true,
    companyId: 'default'
  },
  {
    username: 'tech_eko',
    name: 'Eko (Teknisi Senior)',
    pin: '6666',
    role: 'teknisi',
    subRole: 'Teknisi Listrik',
    division: 'MTC',
    active: true,
    companyId: 'default'
  },
  {
    username: 'tech_bambang',
    name: 'Bambang (Teknisi)',
    pin: '7777',
    role: 'teknisi',
    subRole: 'Teknisi Mekanik',
    division: 'MTC',
    active: true,
    companyId: 'default'
  }
];

// Seed default company
export async function seedDefaultCompany() {
  try {
    const compDocRef = doc(db, 'companies', 'default');
    const snap = await getDoc(compDocRef);
    if (!snap.exists()) {
      console.log('Seeding default company...');
      await setDoc(compDocRef, {
        id: 'default',
        name: 'PT. MTC-Control Utama',
        status: 'aktif',
        createdAt: new Date().toISOString(),
        adminUsername: 'admin'
      });
      console.log('Successfully seeded default company.');
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('Could not reach') || errMsg.includes('unavailable')) {
      console.info('Database is offline. Seeding default company skipped and will retry when connection is restored.');
    } else {
      console.info('Seeding default company skipped (operating in offline/cached mode):', errMsg);
    }
  }
}

// Seed default users if "users" collection is empty
export async function seedDefaultUsers() {
  try {
    await seedDefaultCompany();
    await seedDefaultAssets();
    await seedDefaultInventory();
    
    const usersColRef = collection(db, 'users');
    const qSnapshot = await getDocs(usersColRef);
    if (qSnapshot.empty) {
      console.log('Seeding default users to Firestore...');
      for (const u of DEFAULT_USERS) {
        await setDoc(doc(db, 'users', u.username), {
          ...u,
          createdAt: new Date().toISOString()
        });
      }
      console.log('Successfully seeded default users.');
    }
  } catch (error: any) {
    const errMsg = error?.message || String(error);
    if (errMsg.includes('offline') || errMsg.includes('Could not reach') || errMsg.includes('unavailable')) {
      console.info('Database is offline. Seeding default users skipped.');
    } else {
      console.info('Seeding users skipped (operating in offline/cached mode):', errMsg);
    }
  }
}

// Generate unique automatic WR Number
export async function generateWRNumber(division: string, companyId: string, existingRequests?: WorkRequest[]): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = getRomanMonth(now.getMonth());
  const currentMonthPrefix = `/${year}/${monthRoman}/`;
  const divClean = division.toUpperCase().trim();
  
  let count = 0;
  if (existingRequests && existingRequests.length > 0) {
    existingRequests.forEach((r) => {
      const rCompanyId = r.companyId || 'default';
      const rDiv = (r.divisiPengaju || '').toUpperCase().trim();
      if (r.nomorWR && r.nomorWR.includes(currentMonthPrefix) && rCompanyId === companyId && rDiv === divClean) {
        count++;
      }
    });
  } else {
    try {
      const wrColRef = collection(db, 'work_requests');
      const qSnapshot = await getDocs(wrColRef);
      qSnapshot.forEach((doc) => {
        const data = doc.data();
        const rCompanyId = data.companyId || 'default';
        const rDiv = (data.divisiPengaju || '').toUpperCase().trim();
        if (data.nomorWR && data.nomorWR.includes(currentMonthPrefix) && rCompanyId === companyId && rDiv === divClean) {
          count++;
        }
      });
    } catch (e) {
      console.error('Error generating fallback WR count:', e);
    }
  }

  const nextSeq = String(count + 1).padStart(3, '0');
  const divCode = division.toUpperCase().replace(/\s+/g, '');
  return `WR/${divCode}/${year}/${monthRoman}/${nextSeq}`;
}

// Generate unique automatic WO Number
export async function generateWONumber(division: string, companyId: string, existingOrders?: WorkOrder[], existingRequests?: WorkRequest[], users?: UserProfile[]): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = getRomanMonth(now.getMonth());
  const divClean = division.toUpperCase().trim();
  const currentMonthPrefix = `/${year}/${monthRoman}/`;
  
  let count = 0;
  if (existingOrders && existingOrders.length > 0) {
    existingOrders.forEach((o) => {
      const oCompanyId = o.companyId || 'default';
      let oDiv = 'MTC';
      if (o.nomorWO) {
        const parts = o.nomorWO.split('/');
        if (parts.length >= 2 && parts[0] === 'WO') {
          oDiv = parts[1].toUpperCase().trim();
        }
      } else if (o.nomorWR && o.nomorWR !== 'DIRECT' && existingRequests) {
        const refWR = existingRequests.find(r => r.nomorWR === o.nomorWR || r.id === o.nomorWR);
        if (refWR && refWR.divisiPengaju) {
          oDiv = refWR.divisiPengaju.toUpperCase().trim();
        }
      } else if (users) {
        const matchedUser = users.find(u => u.name === o.diajukanOleh || u.username === o.diajukanOleh);
        if (matchedUser && matchedUser.division) {
          oDiv = matchedUser.division.toUpperCase().trim();
        }
      }
      
      if (o.nomorWO && o.nomorWO.includes(currentMonthPrefix) && oCompanyId === companyId && oDiv === divClean) {
        count++;
      }
    });
  } else {
    try {
      const woColRef = collection(db, 'work_orders');
      const qSnapshot = await getDocs(woColRef);
      qSnapshot.forEach((doc) => {
        const data = doc.data();
        const oCompanyId = data.companyId || 'default';
        let oDiv = 'MTC';
        if (data.nomorWO) {
          const parts = data.nomorWO.split('/');
          if (parts.length >= 2 && parts[0] === 'WO') {
            oDiv = parts[1].toUpperCase().trim();
          }
        }
        if (data.nomorWO && data.nomorWO.includes(currentMonthPrefix) && oCompanyId === companyId && oDiv === divClean) {
          count++;
        }
      });
    } catch (e) {
      console.error('Error generating fallback WO count:', e);
    }
  }

  const nextSeq = String(count + 1).padStart(3, '0');
  const divCode = division.toUpperCase().replace(/\s+/g, '');
  return `WO/${divCode}/${year}/${monthRoman}/${nextSeq}`;
}

// Generate unique automatic PP Number
export async function generatePPNumber(division: string, companyId: string, cabangId: string, existingRequests?: GoodsRequest[]): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = getRomanMonth(now.getMonth());
  const divClean = division.toUpperCase().trim();
  const currentMonthPrefix = `PP/${divClean}/${year}/${monthRoman}/`;
  
  let count = 0;
  if (existingRequests && existingRequests.length > 0) {
    existingRequests.forEach((item) => {
      const itemCompanyId = item.companyId || 'default';
      const itemCabangId = item.cabangId || 'pusat';
      const itemDiv = (item.divisiPengaju || '').toUpperCase().trim();
      if (item.nomorPP && item.nomorPP.includes(`/${year}/${monthRoman}/`) && itemCompanyId === companyId && itemCabangId === cabangId && itemDiv === divClean) {
        count++;
      }
    });
  } else {
    try {
      const ppColRef = collection(db, 'goods_requests');
      const qSnapshot = await getDocs(ppColRef);
      qSnapshot.forEach((doc) => {
        const data = doc.data();
        const itemCompanyId = data.companyId || 'default';
        const itemCabangId = data.cabangId || 'pusat';
        const itemDiv = (data.divisiPengaju || '').toUpperCase().trim();
        if (data.nomorPP && data.nomorPP.includes(`/${year}/${monthRoman}/`) && itemCompanyId === companyId && itemCabangId === cabangId && itemDiv === divClean) {
          count++;
        }
      });
    } catch (e) {
      console.error('Error generating fallback PP count:', e);
    }
  }

  const nextSeq = String(count + 1).padStart(3, '0');
  return `${currentMonthPrefix}${nextSeq}`;
}

export const DEFAULT_ASSETS: Asset[] = [
  {
    id: 'comp_ga75',
    code: 'AST-MTC-UTL-001',
    name: 'Compressor Utama GA-75',
    category: 'Utilitas',
    location: 'Ruang Kompresor 1',
    status: 'running',
    criticality: 'critical',
    lastMaintenance: '2026-06-15',
    nextMaintenance: '2026-07-15',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'chiller_york_01',
    code: 'AST-MTC-UTL-002',
    name: 'Chiller Centrifugal York 500TR',
    category: 'Utilitas',
    location: 'Ruang Chiller',
    status: 'down',
    criticality: 'critical',
    lastMaintenance: '2026-05-10',
    nextMaintenance: '2026-07-10',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inj_nissei_03',
    code: 'AST-MTC-PRD-012',
    name: 'Injection Molding Nissei 180T',
    category: 'Produksi',
    location: 'Area Produksi Line A',
    status: 'running',
    criticality: 'high',
    lastMaintenance: '2026-06-20',
    nextMaintenance: '2026-07-20',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'boiler_yosh_02',
    code: 'AST-MTC-UTL-005',
    name: 'Boiler Steam Yoshimine 6 T/H',
    category: 'Utilitas',
    location: 'Gedung Boiler',
    status: 'running',
    criticality: 'critical',
    lastMaintenance: '2026-06-01',
    nextMaintenance: '2026-08-01',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'conv_pack_l3',
    code: 'AST-MTC-PRD-044',
    name: 'Conveyor Line 3 Packaging',
    category: 'Produksi',
    location: 'Area Packing Line B',
    status: 'down',
    criticality: 'medium',
    lastMaintenance: '2026-06-28',
    nextMaintenance: '2026-07-28',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'genset_cat_1000',
    code: 'AST-MTC-ELC-001',
    name: 'Genset Caterpillar 1000 kVA',
    category: 'Kelistrikan',
    location: 'Power House',
    status: 'running',
    criticality: 'high',
    lastMaintenance: '2026-06-10',
    nextMaintenance: '2026-07-10',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  }
];

export const DEFAULT_INVENTORY: InventoryItem[] = [
  {
    id: 'inv_bearing_skf_6204',
    code: 'INV-MCH-001',
    name: 'Bearing SKF 6204-ZZ',
    stock: 12,
    minStock: 15,
    unit: 'Pcs',
    location: 'Gudang MTC Rak A1',
    price: 45000,
    category: 'Mechanical',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv_vbelt_opti_b54',
    code: 'INV-MCH-002',
    name: 'V-Belt Optibelt B-54',
    stock: 4,
    minStock: 10,
    unit: 'Pcs',
    location: 'Gudang MTC Rak A3',
    price: 65000,
    category: 'Mechanical',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv_mcb_schneider_3p16',
    code: 'INV-ELC-045',
    name: 'MCB Schneider 3P 16A',
    stock: 25,
    minStock: 5,
    unit: 'Pcs',
    location: 'Gudang MTC Rak B2',
    price: 185000,
    category: 'Electrical',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv_solenoid_smc_24v',
    code: 'INV-PNM-012',
    name: 'Solenoid Valve SMC 24VDC',
    stock: 3,
    minStock: 8,
    unit: 'Pcs',
    location: 'Gudang MTC Rak C1',
    price: 320000,
    category: 'Pneumatic',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv_oil_shell_tellus_68',
    code: 'INV-CNS-004',
    name: 'Hydraulic Oil Shell Tellus 68',
    stock: 4,
    minStock: 2,
    unit: 'Drum',
    location: 'Gedung Oli & Pelumas',
    price: 3800000,
    category: 'Consumables',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  },
  {
    id: 'inv_grease_exxon_n3',
    code: 'INV-CNS-009',
    name: 'Grease Exxon Mobil Unirex N3',
    stock: 15,
    minStock: 10,
    unit: 'Can',
    location: 'Gudang MTC Rak D2',
    price: 125000,
    category: 'Consumables',
    companyId: 'default',
    cabangId: 'pusat',
    createdAt: new Date().toISOString()
  }
];

export async function seedDefaultAssets() {
  try {
    const colRef = collection(db, 'assets');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('Seeding default assets to Firestore...');
      for (const ast of DEFAULT_ASSETS) {
        await setDoc(doc(db, 'assets', ast.id), ast);
      }
      console.log('Successfully seeded default assets.');
    }
  } catch (error: any) {
    console.error('Error seeding default assets:', error);
  }
}

export async function seedDefaultInventory() {
  try {
    const colRef = collection(db, 'inventory');
    const snap = await getDocs(colRef);
    if (snap.empty) {
      console.log('Seeding default inventory items to Firestore...');
      for (const item of DEFAULT_INVENTORY) {
        await setDoc(doc(db, 'inventory', item.id), item);
      }
      console.log('Successfully seeded default inventory.');
    }
  } catch (error: any) {
    console.error('Error seeding default inventory:', error);
  }
}

