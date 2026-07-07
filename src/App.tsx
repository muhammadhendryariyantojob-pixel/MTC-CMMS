import React, { useState, useEffect } from 'react';
import { db } from './firebase';
import { collection, query, orderBy, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { UserProfile, WorkRequest, WorkOrder, GoodsRequest, Company, CompanyBranch, Project, PreventiveMaintenance, Asset, InventoryItem } from './types';
import { seedDefaultUsers, DEFAULT_USERS, generateWONumber } from './dbHelper';

// Screens
import LoginScreen from './components/LoginScreen';
import DashboardScreen from './components/DashboardScreen';
import WorkRequestsScreen from './components/WorkRequestsScreen';
import WorkOrdersScreen from './components/WorkOrdersScreen';
import GoodsRequestsScreen from './components/GoodsRequestsScreen';
import UserManagementScreen from './components/UserManagementScreen';
import ForumScreen from './components/ForumScreen';
import CompaniesScreen from './components/CompaniesScreen';
import SettingsScreen from './components/SettingsScreen';
import ProjectManagementScreen from './components/ProjectManagementScreen';
import PreventiveMaintenanceScreen from './components/PreventiveMaintenanceScreen';
import KelistrikanScreen from './components/KelistrikanScreen';
import ConfirmModal from './components/ConfirmModal';
import NotificationsPanel from './components/NotificationsPanel';
import AssetsScreen from './components/AssetsScreen';
import InventoryScreen from './components/InventoryScreen';
import ReportsScreen from './components/ReportsScreen';

// Icons
import { 
  HardHat, 
  Shield, 
  Activity, 
  Users, 
  LogOut, 
  LayoutDashboard, 
  FileText, 
  Wrench, 
  Package, 
  MessageSquare,
  Menu,
  X,
  User as UserIcon,
  Building,
  Settings,
  Briefcase,
  ShieldCheck,
  Zap,
  BarChart3
} from 'lucide-react';

// Helper to get all descendant branch IDs recursively (including parent)
const getDescendantBranchIds = (parentBranchId: string, allBranches: CompanyBranch[]): string[] => {
  const ids: string[] = [parentBranchId];
  const queue: string[] = [parentBranchId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const children = allBranches.filter(b => b.parentId === current);
    for (const child of children) {
      if (!ids.includes(child.id)) {
        ids.push(child.id);
        queue.push(child.id);
      }
    }
  }
  return ids;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Firestore Real-Time Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [requests, setRequests] = useState<WorkRequest[]>([]);
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [goodsRequests, setGoodsRequests] = useState<GoodsRequest[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [pmSchedules, setPmSchedules] = useState<PreventiveMaintenance[]>([]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [tabOrder, setTabOrder] = useState<string[]>([]);

  // Selected Branch filtering state (for company admins/management)
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('all');

  // Convert workflow trigger state
  const [pendingConvertWR, setPendingConvertWR] = useState<WorkRequest | null>(null);

  // Run on mount: Seed defaults & Subscribe to Firestore collections
  useEffect(() => {
    // Seed Firestore users collection if empty
    seedDefaultUsers();

    // Subscribe Tab Order Settings
    const tabOrderUnsub = onSnapshot(doc(db, 'settings', 'navigation'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (Array.isArray(data.tabOrder)) {
          setTabOrder(data.tabOrder);
        }
      }
    });

    // Subscribe Users
    const usersUnsub = onSnapshot(collection(db, 'users'), (snapshot) => {
      const uList: UserProfile[] = [];
      snapshot.forEach((doc) => {
        uList.push(doc.data() as UserProfile);
      });
      setUsers(uList);
    });

    // Subscribe Companies
    const companiesUnsub = onSnapshot(collection(db, 'companies'), (snapshot) => {
      const cList: Company[] = [];
      snapshot.forEach((doc) => {
        cList.push(doc.data() as Company);
      });
      setCompanies(cList);
    });

    // Subscribe Company Branches
    const branchesUnsub = onSnapshot(collection(db, 'branches'), (snapshot) => {
      const bList: CompanyBranch[] = [];
      snapshot.forEach((doc) => {
        bList.push(doc.data() as CompanyBranch);
      });
      setBranches(bList);
    });

    // Subscribe Work Requests
    const wrQuery = query(collection(db, 'work_requests'), orderBy('createdAt', 'desc'));
    const wrUnsub = onSnapshot(wrQuery, (snapshot) => {
      const wrList: WorkRequest[] = [];
      snapshot.forEach((doc) => {
        wrList.push({ id: doc.id, ...doc.data() } as WorkRequest);
      });
      setRequests(wrList);
    });

    // Subscribe Work Orders
    const woQuery = query(collection(db, 'work_orders'), orderBy('createdAt', 'desc'));
    const woUnsub = onSnapshot(woQuery, (snapshot) => {
      const woList: WorkOrder[] = [];
      snapshot.forEach((doc) => {
        woList.push({ id: doc.id, ...doc.data() } as WorkOrder);
      });
      setOrders(woList);
    });

    // Subscribe Goods/Sparepart Requests (PP)
    const ppQuery = query(collection(db, 'goods_requests'), orderBy('createdAt', 'desc'));
    const ppUnsub = onSnapshot(ppQuery, (snapshot) => {
      const ppList: GoodsRequest[] = [];
      snapshot.forEach((doc) => {
        ppList.push({ id: doc.id, ...doc.data() } as GoodsRequest);
      });
      setGoodsRequests(ppList);
    });

    // Subscribe Projects
    const projectsQuery = query(collection(db, 'projects'), orderBy('createdAt', 'desc'));
    const projectsUnsub = onSnapshot(projectsQuery, (snapshot) => {
      const projList: Project[] = [];
      snapshot.forEach((doc) => {
        projList.push({ id: doc.id, ...doc.data() } as Project);
      });
      setProjects(projList);
    });

    // Subscribe Preventive Maintenance
    const pmQuery = query(collection(db, 'preventive_maintenance'), orderBy('createdAt', 'desc'));
    const pmUnsub = onSnapshot(pmQuery, (snapshot) => {
      const pmList: PreventiveMaintenance[] = [];
      snapshot.forEach((doc) => {
        pmList.push({ id: doc.id, ...doc.data() } as PreventiveMaintenance);
      });
      setPmSchedules(pmList);
    });

    // Subscribe Assets
    const assetsUnsub = onSnapshot(collection(db, 'assets'), (snapshot) => {
      const astList: Asset[] = [];
      snapshot.forEach((doc) => {
        astList.push({ id: doc.id, ...doc.data() } as Asset);
      });
      setAssets(astList);
    });

    // Subscribe Inventory
    const inventoryUnsub = onSnapshot(collection(db, 'inventory'), (snapshot) => {
      const invList: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        invList.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setInventory(invList);
    });

    return () => {
      usersUnsub();
      companiesUnsub();
      branchesUnsub();
      wrUnsub();
      woUnsub();
      ppUnsub();
      projectsUnsub();
      pmUnsub();
      assetsUnsub();
      inventoryUnsub();
      tabOrderUnsub();
    };
  }, []);

  // Automated 'Preventive' Work Order Generation 3 days before due date
  useEffect(() => {
    if (pmSchedules.length === 0 || orders.length === 0) return;

    const todayStr = new Date().toISOString().split('T')[0];
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const generatePreventiveWO = async (pm: PreventiveMaintenance) => {
      try {
        const refId = `PM-${pm.id}-${pm.tanggalBerikutnyaPengecekan}`;
        
        // Double-check if already generated in local state first to prevent race condition
        const exists = orders.some(o => o.nomorWR === refId);
        if (exists) return;

        // Generate a beautiful new Work Order
        const woId = `WO-PM-${pm.id}-${Date.now()}`;
        const companyId = pm.companyId || 'default';
        const nomorWO = await generateWONumber('MTC', companyId, orders, requests, users);

        const newWO: WorkOrder = {
          id: woId,
          nomorWO,
          nomorWR: refId, // Store the reference ID
          tanggalWO: todayStr,
          area: pm.lokasi || 'Lokasi Terdaftar',
          namaMesin: pm.namaAlat,
          jenisTindakan: 'perawatan',
          uraianPekerjaan: `[PM PREVENTIVE AUTO-GENERATED] Perawatan preventif terjadwal untuk alat: ${pm.namaAlat}. Frekuensi: ${pm.frekuensi}. Deskripsi: ${pm.deskripsi || 'Pengecekan standar'}`,
          tipePenugasan: 'teknisi',
          namaVendor: '',
          teknisiDitugaskan: [], // Unassigned, Supervisor can assign
          diajukanOleh: 'Sistem PM Otomatis',
          status: 'pending',
          createdAt: new Date().toISOString(),
          prioritas: 'sedang',
          companyId,
          cabangId: pm.cabangId || 'pusat',
          dueDate: pm.tanggalBerikutnyaPengecekan
        };

        const cleanObj = (obj: any): any => {
          const copy = { ...obj };
          Object.keys(copy).forEach(key => {
            if (copy[key] === undefined || (typeof copy[key] === 'number' && isNaN(copy[key]))) {
              delete copy[key];
            }
          });
          return copy;
        };

        await setDoc(doc(db, 'work_orders', woId), cleanObj(newWO));
        console.log(`Successfully generated auto PM Work Order ${nomorWO} for asset: ${pm.namaAlat}`);
      } catch (err) {
        console.error('Error generating automatic PM Work Order:', err);
      }
    };

    pmSchedules.forEach((pm) => {
      if (pm.status !== 'aktif' || !pm.tanggalBerikutnyaPengecekan || pm.otomatisWR === false) return;

      const nextDate = new Date(pm.tanggalBerikutnyaPengecekan);
      nextDate.setHours(0, 0, 0, 0);
      const diffTime = nextDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // If due date is 3 days or fewer from today (and is in the future or today/slightly past)
      if (diffDays >= -1 && diffDays <= 3) {
        const refId = `PM-${pm.id}-${pm.tanggalBerikutnyaPengecekan}`;
        const exists = orders.some(o => o.nomorWR === refId);
        if (!exists) {
          generatePreventiveWO(pm);
        }
      }
    });
  }, [pmSchedules, orders, requests, users]);

  const handleLoginSuccess = (user: UserProfile) => {
    setCurrentUser(user);
    setActiveTab('dashboard');
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const handleConvertToWO = (wr: WorkRequest) => {
    setPendingConvertWR(wr);
    setActiveTab('wo');
  };

  // Sync currentUser with real-time updates from users state
  const activeUser = currentUser ? (users.find(u => u.username === currentUser.username) || currentUser) : null;

  // Apply saved settings for currentUser when user changes
  useEffect(() => {
    if (activeUser) {
      const savedFontSize = localStorage.getItem(`settings_${activeUser.username}_fontSize`) || 'medium';
      const savedThemeMode = localStorage.getItem(`settings_${activeUser.username}_themeMode`) || 'light';
      
      // Font size application
      const root = document.getElementById('app-root-container');
      if (root) {
        if (savedFontSize === 'small') {
          root.style.fontSize = '13px';
        } else if (savedFontSize === 'medium') {
          root.style.fontSize = '15px';
        } else if (savedFontSize === 'large') {
          root.style.fontSize = '17px';
        } else if (savedFontSize === 'xlarge') {
          root.style.fontSize = '19px';
        }
      }

      // Theme application
      const body = document.body;
      if (savedThemeMode === 'dark') {
        body.classList.add('dark');
        const rootContainer = document.getElementById('app-root-container');
        if (rootContainer) rootContainer.classList.add('dark');
      } else {
        body.classList.remove('dark');
        const rootContainer = document.getElementById('app-root-container');
        if (rootContainer) rootContainer.classList.remove('dark');
      }
    }
  }, [activeUser]);

  // Redirect to dashboard if a non-admin tries to access settings
  useEffect(() => {
    const body = document.body;
    if (sidebarCollapsed) {
      body.classList.add('sidebar-collapsed');
    } else {
      body.classList.remove('sidebar-collapsed');
    }
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (activeUser && activeUser.role !== 'admin' && activeTab === 'settings') {
      setActiveTab('dashboard');
    }
  }, [activeUser, activeTab]);

  // Check if current user's company is revoked/suspended, then log them out
  useEffect(() => {
    if (activeUser && activeUser.username !== 'admin') {
      const userCompId = activeUser.companyId || 'default';
      const myCompany = companies.find(c => c.id === userCompId);
      // If companies are loaded and myCompany is suspended/nonaktif
      if (companies.length > 0 && myCompany && myCompany.status === 'nonaktif') {
        alert(`Akses ditangguhkan: Izin aplikasi untuk perusahaan Anda (${myCompany.name}) telah dinonaktifkan oleh Administrator Utama.`);
        setCurrentUser(null);
        setActiveTab('dashboard');
      }
    }
  }, [currentUser, companies, users]);

  // Extract companyId of the logged-in user (default to 'default')
  const userCompanyId = activeUser?.companyId || 'default';

  // Filter branches of the active user's company
  const filteredBranches = branches.filter(b => b.companyId === userCompanyId);

  // Check branch hierarchy for active user
  const userBranchId = activeUser?.cabangId || 'pusat';
  const myBranch = branches.find(b => b.id === userBranchId);
  const isHq = userBranchId === 'pusat';
  const isAnakPerusahaan = myBranch?.type === 'anak_perusahaan';

  // Determine allowed branch IDs for current user (recursively)
  const allowedBranchIds = React.useMemo(() => {
    if (!activeUser) return [];
    if (activeUser.username === 'admin') {
      return branches.map(b => b.id).concat(['pusat']);
    }
    const myBranches = branches.filter(b => b.companyId === userCompanyId);
    if (isHq) {
      return myBranches.map(b => b.id).concat(['pusat']);
    }
    if (isAnakPerusahaan) {
      return getDescendantBranchIds(userBranchId, myBranches);
    }
    // Standard branch can ONLY see self
    return [userBranchId];
  }, [activeUser, branches, userCompanyId, isHq, isAnakPerusahaan, userBranchId]);

  // Determine active branch filter: Admin & Management of HQ or Sub-Company can select; others are forced to their assigned branch
  const canFilterBranches = (activeUser?.role === 'admin' || activeUser?.role === 'management') && (isHq || isAnakPerusahaan);

  const activeBranch = canFilterBranches
    ? selectedBranchFilter
    : userBranchId;

  // Filter all collections based on companyId & branchId (for isolation)
  const filteredUsers = users.filter(u => {
    const isOfSameCompany = (u.companyId || 'default') === userCompanyId;
    const isAnyCompanyAdmin = u.role === 'admin';
    const isItcAdmin = activeUser?.username === 'admin';

    if (isItcAdmin) {
      if (isOfSameCompany || isAnyCompanyAdmin) {
        if (activeBranch === 'all') return true;
        if (activeBranch === 'pusat') {
          return !u.cabangId || u.cabangId === 'pusat';
        }
        return u.cabangId === activeBranch;
      }
      return false;
    }

    if (!isOfSameCompany) return false;

    if (activeBranch === 'all') {
      if (isHq) return true;
      return u.cabangId && allowedBranchIds.includes(u.cabangId);
    }

    if (activeBranch === 'pusat') {
      return !u.cabangId || u.cabangId === 'pusat';
    }
    return u.cabangId === activeBranch;
  });

  const filteredRequests = requests.filter(r => {
    if (activeUser?.username === 'admin') return true;
    if ((r.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return r.cabangId && allowedBranchIds.includes(r.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !r.cabangId || r.cabangId === 'pusat';
    }
    return r.cabangId === activeBranch;
  });

  const filteredOrders = orders.filter(o => {
    if (activeUser?.username === 'admin') return true;
    if ((o.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return o.cabangId && allowedBranchIds.includes(o.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !o.cabangId || o.cabangId === 'pusat';
    }
    return o.cabangId === activeBranch;
  });

  const filteredGoodsRequests = goodsRequests.filter(g => {
    if (activeUser?.username === 'admin') return true;
    if ((g.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return g.cabangId && allowedBranchIds.includes(g.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !g.cabangId || g.cabangId === 'pusat';
    }
    return g.cabangId === activeBranch;
  });

  const filteredProjects = projects.filter(p => {
    if (activeUser?.username === 'admin') return true;
    if ((p.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return p.cabangId && allowedBranchIds.includes(p.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !p.cabangId || p.cabangId === 'pusat';
    }
    return p.cabangId === activeBranch;
  });

  const filteredPmSchedules = pmSchedules.filter(pm => {
    if (activeUser?.username === 'admin') return true;
    if ((pm.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return pm.cabangId && allowedBranchIds.includes(pm.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !pm.cabangId || pm.cabangId === 'pusat';
    }
    return pm.cabangId === activeBranch;
  });

  const filteredAssets = assets.filter(ast => {
    if (activeUser?.username === 'admin') return true;
    if ((ast.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return ast.cabangId && allowedBranchIds.includes(ast.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !ast.cabangId || ast.cabangId === 'pusat';
    }
    return ast.cabangId === activeBranch;
  });

  const filteredInventory = inventory.filter(inv => {
    if (activeUser?.username === 'admin') return true;
    if ((inv.companyId || 'default') !== userCompanyId) return false;
    if (activeBranch === 'all') {
      if (isHq) return true;
      return inv.cabangId && allowedBranchIds.includes(inv.cabangId);
    }
    if (activeBranch === 'pusat') {
      return !inv.cabangId || inv.cabangId === 'pusat';
    }
    return inv.cabangId === activeBranch;
  });

  // Extract branches allowed for management/editing in UserManagementScreen
  const allowedBranchesForManagement = React.useMemo(() => {
    if (activeUser?.username === 'admin') return branches;
    const myBranches = branches.filter(b => b.companyId === userCompanyId);
    if (isHq) return myBranches;
    return myBranches.filter(b => allowedBranchIds.includes(b.id));
  }, [activeUser, branches, userCompanyId, isHq, allowedBranchIds]);

  // Extract all technicians for WO assignment (from filtered company users)
  const techniciansList = filteredUsers.filter(u => u.role === 'teknisi' && u.active);

  // Render current tab component
  const renderTabContent = () => {
    if (!activeUser) return null;

    switch (activeTab) {
      case 'dashboard':
        return (
          <DashboardScreen 
            requests={filteredRequests}
            orders={filteredOrders}
            items={filteredGoodsRequests}
            currentUser={activeUser}
            companies={companies}
            branches={filteredBranches}
            onNavigateToTab={(tab) => {
              if (pendingConvertWR) {
                alert('Konversi WR ke WO sedang aktif. Anda wajib menerbitkan WO terlebih dahulu.');
                return;
              }
              setActiveTab(tab);
            }}
            projects={filteredProjects}
            assets={filteredAssets}
            inventory={filteredInventory}
            pmSchedules={filteredPmSchedules}
          />
        );
      case 'assets':
        if (activeUser?.canShowTabAssets === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <AssetsScreen 
            assets={filteredAssets}
            currentUser={activeUser}
            branches={filteredBranches}
            orders={filteredOrders}
            pmSchedules={pmSchedules}
          />
        );
      case 'inventory':
        if (activeUser?.canShowTabInventory === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <InventoryScreen 
            inventory={filteredInventory}
            currentUser={activeUser}
          />
        );
      case 'reports':
        if (activeUser?.canShowTabReports === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <ReportsScreen 
            orders={filteredOrders}
            assets={filteredAssets}
            inventory={filteredInventory}
            currentUser={activeUser}
          />
        );
      case 'wr':
        if (activeUser?.canShowTabWR === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <WorkRequestsScreen 
            requests={filteredRequests}
            orders={filteredOrders}
            currentUser={activeUser}
            branches={filteredBranches}
            companies={companies}
            onConvertToWO={handleConvertToWO}
            onRefresh={() => {}}
          />
        );
      case 'wo':
        if (activeUser?.canShowTabWO === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <WorkOrdersScreen 
            orders={filteredOrders}
            requests={filteredRequests}
            users={filteredUsers}
            technicians={techniciansList}
            currentUser={activeUser}
            branches={filteredBranches}
            companies={companies}
            pendingConvertWR={pendingConvertWR}
            onCancelConvert={() => setPendingConvertWR(null)}
            onRefresh={() => {}}
            assets={filteredAssets}
            inventory={filteredInventory}
          />
        );
      case 'pp':
        if (activeUser?.canShowTabPP === false) return <div className="p-6 bg-white rounded-xl border border-slate-200 text-slate-800">Akses Ditolak</div>;
        return (
          <GoodsRequestsScreen 
            items={filteredGoodsRequests}
            currentUser={activeUser}
            branches={filteredBranches}
            companies={companies}
            onRefresh={() => {}}
          />
        );
      case 'users':
        if (activeUser.role !== 'admin') return <div className="text-slate-800 p-6 bg-white rounded-xl border border-slate-200">Akses Ditolak</div>;
        return (
          <UserManagementScreen 
            users={filteredUsers}
            currentUser={activeUser}
            branches={allowedBranchesForManagement}
            companies={companies}
            onRefresh={() => {}}
          />
        );
      case 'companies':
        if (activeUser.username !== 'admin') return <div className="text-slate-800 p-6 bg-white rounded-xl border border-slate-200">Akses Ditolak</div>;
        return (
          <CompaniesScreen 
            companies={companies}
            currentUser={activeUser}
            onRefresh={() => {}}
          />
        );
      case 'forum':
        return (
          <ForumScreen 
            currentUser={activeUser}
          />
        );
      case 'projects':
        if (activeUser?.canShowTabProjects === false) return <div className="text-slate-800 p-6 bg-white rounded-xl border border-slate-200">Akses Ditolak</div>;
        return (
          <ProjectManagementScreen 
            projects={filteredProjects}
            currentUser={activeUser}
            technicians={techniciansList}
            allUsers={filteredUsers}
            branches={filteredBranches}
            onRefresh={() => {}}
          />
        );
      case 'pm':
        if (activeUser?.canShowTabPM === false) return <div className="text-slate-800 p-6 bg-white rounded-xl border border-slate-200">Akses Ditolak</div>;
        return (
          <PreventiveMaintenanceScreen 
            pmSchedules={filteredPmSchedules}
            currentUser={activeUser}
            branches={filteredBranches}
            assets={filteredAssets}
            onRefresh={() => {}}
          />
        );
      case 'kelistrikan':
        if (activeUser?.canShowTabKelistrikan === false) return <div className="text-slate-800 p-6 bg-white rounded-xl border border-slate-200">Akses Ditolak</div>;
        return (
          <KelistrikanScreen 
            currentUser={activeUser}
            branches={filteredBranches}
          />
        );
      case 'settings':
        return (
          <SettingsScreen 
            currentUser={activeUser}
            companies={companies}
            branches={branches}
          />
        );
      default:
        return <div className="text-slate-850">Halaman Tidak Ditemukan</div>;
    }
  };

  // If not logged in, show Login Screen
  if (!currentUser) {
    return (
      <LoginScreen 
        onLoginSuccess={handleLoginSuccess} 
        defaultUsers={users.length > 0 ? users : DEFAULT_USERS}
      />
    );
  }

  // Permitted navigation items based on Roles & Permissions
  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    ...(activeUser?.canShowTabWO !== false ? [{ id: 'wo', label: 'Work Orders', icon: <Wrench className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabAssets !== false ? [{ id: 'assets', label: 'Assets', icon: <Activity className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabInventory !== false ? [{ id: 'inventory', label: 'Inventory', icon: <Package className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabReports !== false ? [{ id: 'reports', label: 'Reports', icon: <BarChart3 className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabWR !== false ? [{ id: 'wr', label: 'Work Requests (WR)', icon: <FileText className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabPP !== false ? [{ id: 'pp', label: 'Permintaan Barang (PP)', icon: <Package className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabPM !== false ? [{ id: 'pm', label: 'Preventive Maintenance', icon: <ShieldCheck className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabProjects !== false ? [{ id: 'projects', label: 'Proyek & Konstruksi', icon: <Briefcase className="w-4 h-4" /> }] : []),
    ...(activeUser?.canShowTabKelistrikan !== false ? [{ id: 'kelistrikan', label: 'Monitor Kelistrikan', icon: <Zap className="w-4 h-4" /> }] : []),
    { id: 'forum', label: 'Forum Group', icon: <MessageSquare className="w-4 h-4" /> },
    ...(activeUser?.role === 'admin' ? [{ id: 'settings', label: 'Pengaturan', icon: <Settings className="w-4 h-4" /> }] : []),
  ];

  // Admin exclusive nav (Users tab requested)
  if (activeUser && activeUser.role === 'admin') {
    navItems.push({ id: 'users', label: 'Users (Kelola Pengguna)', icon: <Users className="w-4 h-4" /> });
  }

  // Super Admin exclusive nav for companies management
  if (activeUser && activeUser.username === 'admin') {
    navItems.push({ id: 'companies', label: 'Kelola Perusahaan', icon: <Building className="w-4 h-4" /> });
  }

  // Sort navItems based on custom tabOrder if available
  const sortedNavItems = [...navItems].sort((a, b) => {
    if (tabOrder.length === 0) return 0;
    const idxA = tabOrder.indexOf(a.id);
    const idxB = tabOrder.indexOf(b.id);
    if (idxA !== -1 && idxB !== -1) {
      return idxA - idxB;
    }
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const getRoleBadgeColor = (role: string) => {
    switch(role) {
      case 'admin': return 'bg-rose-50 text-rose-700 border border-rose-200';
      case 'management': return 'bg-emerald-50 text-emerald-700 border border-emerald-200';
      case 'teknisi': return 'bg-amber-50 text-amber-700 border border-amber-200';
      default: return 'bg-blue-50 text-blue-700 border border-blue-200';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col md:flex-row text-slate-800 dark:text-slate-100 font-sans" id="app-root-container">
      
      {/* Mobile Top Header */}
      <header className="sticky top-0 md:hidden flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-850 border-b border-slate-200 dark:border-slate-800 shrink-0 z-50" id="mobile-app-header">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 p-1.5 rounded-lg text-white">
            <HardHat className="w-5 h-5" />
          </div>
          <span className="font-sans font-black text-sm tracking-tight text-slate-800 dark:text-white uppercase">MTC-Control</span>
        </div>
        <button 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 transition cursor-pointer"
          id="btn-toggle-mobile-menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[50] md:hidden transition-opacity duration-200"
          onClick={() => setMobileMenuOpen(false)}
          id="mobile-sidebar-backdrop"
        />
      )}

      {/* Navigation Sidebar & Drawer */}
      <aside className={`
        fixed inset-y-0 left-0 transform md:relative transition-all duration-200 ease-in-out
        bg-white dark:bg-slate-850 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between z-[60] shrink-0 h-full md:h-screen md:sticky md:top-0
        ${sidebarCollapsed ? 'w-0 p-0 border-r-0 overflow-hidden md:hidden opacity-0 pointer-events-none' : 'w-64 p-5 md:relative'}
        ${mobileMenuOpen ? 'translate-x-0' : sidebarCollapsed ? '-translate-x-full' : '-translate-x-full md:translate-x-0'}
      `} id="app-navigation-sidebar">
        
        <div className="space-y-6 flex-1 overflow-y-auto pr-1.5 -mr-1.5 scrollbar-thin">
          {/* Logo Brand Header */}
          <div className="flex items-center justify-between px-1 pb-4 border-b border-slate-100 dark:border-slate-800" id="sidebar-logo">
            <div className="flex items-center gap-2.5">
              <div className="bg-blue-600 p-2 rounded-xl text-white shadow-sm">
                <HardHat className="w-5 h-5" />
              </div>
              <div>
                <span className="font-sans font-black text-sm tracking-tight text-slate-800 dark:text-white uppercase block">MTC-Control</span>
                <span className="text-[9px] text-slate-400 dark:text-slate-500 font-mono tracking-wider">DIVISION SYSTEM</span>
              </div>
            </div>
            {/* Close button on mobile inside the sidebar */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="md:hidden p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
              id="btn-close-sidebar-mobile"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Logged User Info Block */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-2.5" id="sidebar-user-block">
            <div className="w-9 h-9 rounded-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-500">
              <UserIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{activeUser?.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <span className={`text-[8px] font-bold font-mono px-1.5 py-0.5 rounded-full uppercase truncate ${getRoleBadgeColor(activeUser?.role || '')}`}>
                  {activeUser?.subRole}
                </span>
              </div>
            </div>
          </div>

          {/* Branch filter selector or display (for isolation support) */}
          {filteredBranches.length > 0 && canFilterBranches ? (
            <div className="px-1 space-y-1.5" id="branch-filter-block">
              <label className="block text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                Filter Struktur/Cabang:
              </label>
              <select
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                className="w-full px-2.5 py-2 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-xl text-[11px] font-bold text-slate-700 dark:text-slate-300 cursor-pointer focus:outline-none focus:border-blue-500 transition"
                id="sidebar-branch-filter-select"
              >
                {isHq ? (
                  <>
                    <option value="all" className="dark:bg-slate-900">Semua Struktur ({users.filter(u => (u.companyId || 'default') === userCompanyId).length})</option>
                    <option value="pusat" className="dark:bg-slate-900">Kantor Pusat ({users.filter(u => (u.companyId || 'default') === userCompanyId && (!u.cabangId || u.cabangId === 'pusat')).length})</option>
                    {filteredBranches.map(b => (
                      <option key={b.id} value={b.id} className="dark:bg-slate-900">
                        {b.name} ({b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Cabang'}) ({users.filter(u => (u.companyId || 'default') === userCompanyId && u.cabangId === b.id).length})
                      </option>
                    ))}
                  </>
                ) : (
                  <>
                    <option value="all" className="dark:bg-slate-900">Semua Struktur Anak ({users.filter(u => (u.companyId || 'default') === userCompanyId && u.cabangId && allowedBranchIds.includes(u.cabangId)).length})</option>
                    {filteredBranches
                      .filter(b => allowedBranchIds.includes(b.id))
                      .map(b => (
                        <option key={b.id} value={b.id} className="dark:bg-slate-900">
                          {b.name} ({b.type === 'anak_perusahaan' ? 'Anak Perusahaan' : 'Cabang'}) ({users.filter(u => (u.companyId || 'default') === userCompanyId && u.cabangId === b.id).length})
                        </option>
                      ))}
                  </>
                )}
              </select>
            </div>
          ) : (
            activeUser && activeUser.username !== 'admin' && (
              <div className="px-3 py-2 text-[10px] text-slate-500 dark:text-slate-400 flex flex-col gap-1 bg-slate-50 dark:bg-slate-900/40 rounded-xl border border-slate-200 dark:border-slate-800" id="user-branch-display">
                <span className="font-bold text-slate-400 uppercase tracking-wider text-[8px]">Unit Kerja / Cabang:</span>
                <span className="font-extrabold text-indigo-650 dark:text-indigo-400 text-xs break-words leading-tight">
                  {activeUser?.cabangId === 'pusat' || !activeUser?.cabangId 
                    ? 'Kantor Pusat' 
                    : (filteredBranches.find(b => b.id === activeUser.cabangId)?.name || 'Kantor Pusat')}
                </span>
              </div>
            )
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5" id="sidebar-nav-links">
            {sortedNavItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (pendingConvertWR) {
                      alert('Konversi WR ke WO sedang aktif. Anda wajib menerbitkan WO terlebih dahulu sebelum dapat berpindah halaman.');
                      return;
                    }
                    setActiveTab(item.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                    isActive 
                      ? 'bg-blue-600 text-white shadow-sm' 
                      : 'text-slate-600 dark:text-slate-350 hover:bg-slate-50 dark:hover:bg-slate-800/60 hover:text-slate-800 dark:hover:text-white'
                  }`}
                  id={`nav-item-${item.id}`}
                >
                  {item.icon}
                  {item.label}
                </button>
              );
            })}

            {/* Subtle Separator */}
            <div className="my-2 border-t border-slate-200/50 dark:border-slate-800/50" />

            {/* Keluar Aplikasi button directly below the other tabs */}
            <button
              onClick={() => {
                if (pendingConvertWR) {
                  alert('Konversi WR ke WO sedang aktif. Anda wajib menerbitkan WO terlebih dahulu.');
                  return;
                }
                setMobileMenuOpen(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/25 hover:text-rose-700 dark:hover:text-rose-300 transition cursor-pointer"
              id="btn-logout"
            >
              <LogOut className="w-4 h-4 text-rose-500 shrink-0" />
              <span>Keluar Aplikasi</span>
            </button>
          </nav>
        </div>

        {/* Footer System Version */}
        <div className="pt-4 border-t border-slate-100 dark:border-slate-800 text-center shrink-0" id="sidebar-footer">
          <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-bold tracking-wider">
            MTC-Control v1.5.0
          </span>
        </div>

      </aside>

      {/* Main View Port Canvas */}
      <main className="flex-1 bg-slate-50 dark:bg-slate-900 p-6 md:p-8 overflow-y-auto max-w-full flex flex-col gap-6" id="app-main-viewport">
        {/* Top Header Bar with active tab title and Notifications Bell */}
        <div className="flex justify-between items-center bg-white dark:bg-slate-850 px-5 py-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs shrink-0" id="main-viewport-header">
          <div className="flex items-center gap-4">
            {/* Desktop Sidebar Toggle Button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden md:flex items-center justify-center p-2 text-blue-600 dark:text-blue-400 hover:text-blue-500 dark:hover:text-blue-300 rounded-xl bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 transition cursor-pointer shrink-0"
              title={sidebarCollapsed ? "Tampilkan Menu Navigasi (MTC Control)" : "Sembunyikan Menu Navigasi (MTC Control)"}
              id="btn-toggle-sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <h1 className="text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider font-sans">
                {activeTab === 'dashboard' ? 'Overview Dashboard' : activeTab === 'wr' ? 'Work Requests (WR)' : activeTab === 'wo' ? 'Work Orders' : activeTab === 'pp' ? 'Permintaan Barang (PP)' : activeTab === 'assets' ? 'Asset Registry' : activeTab === 'inventory' ? 'Inventory Control' : activeTab === 'reports' ? 'Analytical Reports' : activeTab === 'forum' ? 'Forum Group Chat' : activeTab === 'users' ? 'Kelola Pengguna' : activeTab === 'settings' ? 'Pengaturan Sistem' : 'Kelola Perusahaan'}
              </h1>
              <p className="text-[10px] text-slate-400 dark:text-slate-500 font-mono font-medium mt-0.5">
                Sistem Pengawasan Pemeliharaan Mesin & Sarana {sidebarCollapsed && <span className="text-emerald-600 dark:text-emerald-400 font-bold ml-1.5 animate-pulse">[Full Screen View]</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {activeUser && (
              <NotificationsPanel 
                currentUser={activeUser}
                requests={requests}
                orders={orders}
                goodsRequests={goodsRequests}
                onNavigateToTab={(tab) => {
                  if (pendingConvertWR) {
                    alert('Konversi WR ke WO sedang aktif. Anda wajib menerbitkan WO terlebih dahulu.');
                    return;
                  }
                  setActiveTab(tab);
                }}
              />
            )}
          </div>
        </div>

        <div className="flex-1">
          {renderTabContent()}
        </div>
      </main>

      <ConfirmModal
        isOpen={showLogoutConfirm}
        title="Konfirmasi Keluar Aplikasi"
        message="Apakah Anda yakin ingin keluar dari sesi MTC-Control saat ini?"
        confirmLabel="Ya, Keluar"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={() => {
          setCurrentUser(null);
          setActiveTab('dashboard');
          setShowLogoutConfirm(false);
        }}
        onCancel={() => setShowLogoutConfirm(false)}
      />

    </div>
  );
}
