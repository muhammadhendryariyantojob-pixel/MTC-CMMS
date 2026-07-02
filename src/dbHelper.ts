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
import { UserProfile, WorkRequest, WorkOrder, GoodsRequest, ForumMessage } from './types';

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
  
  let count = 0;
  if (existingRequests && existingRequests.length > 0) {
    existingRequests.forEach((r) => {
      const rCompanyId = r.companyId || 'default';
      if (r.nomorWR && r.nomorWR.includes(currentMonthPrefix) && rCompanyId === companyId) {
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
        if (data.nomorWR && data.nomorWR.includes(currentMonthPrefix) && rCompanyId === companyId) {
          count++;
        }
      });
    } catch (e) {
      console.error('Error generating fallback WR count:', e);
    }
  }

  const nextSeq = String(count + 1).padStart(3, '0');
  return `WR/${division.replace(/\s+/g, '')}/${year}/${monthRoman}/${nextSeq}`;
}

// Generate unique automatic WO Number
export async function generateWONumber(companyId: string, existingOrders?: WorkOrder[]): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = getRomanMonth(now.getMonth());
  const currentMonthPrefix = `/MNT/${year}/${monthRoman}/`;
  
  let count = 0;
  if (existingOrders && existingOrders.length > 0) {
    existingOrders.forEach((o) => {
      const oCompanyId = o.companyId || 'default';
      if (o.nomorWO && o.nomorWO.includes(currentMonthPrefix) && oCompanyId === companyId) {
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
        if (data.nomorWO && data.nomorWO.includes(currentMonthPrefix) && oCompanyId === companyId) {
          count++;
        }
      });
    } catch (e) {
      console.error('Error generating fallback WO count:', e);
    }
  }

  const nextSeq = String(count + 1).padStart(3, '0');
  return `WO/MNT/${year}/${monthRoman}/${nextSeq}`;
}

// Generate unique automatic PP Number
export async function generatePPNumber(companyId: string, existingRequests?: GoodsRequest[]): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const monthRoman = getRomanMonth(now.getMonth());
  const companyPrefix = companyId.toUpperCase().replace(/\s+/g, '');
  const currentMonthPrefix = `PP/${companyPrefix}/MNT/${year}/${monthRoman}/`;
  
  let count = 0;
  if (existingRequests && existingRequests.length > 0) {
    existingRequests.forEach((item) => {
      const itemCompanyId = item.companyId || 'default';
      if (item.nomorPP && item.nomorPP.includes(`/${year}/${monthRoman}/`) && itemCompanyId === companyId) {
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
        if (data.nomorPP && data.nomorPP.includes(`/${year}/${monthRoman}/`) && itemCompanyId === companyId) {
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
