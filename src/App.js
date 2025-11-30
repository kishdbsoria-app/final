import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  doc, 
  getDoc,
  setDoc,
  onSnapshot, 
  serverTimestamp, 
  writeBatch
} from 'firebase/firestore';
import { 
  Package, 
  Search, 
  Plus, 
  CheckCircle2, 
  User, 
  ShoppingBag, 
  LogOut, 
  MapPin,
  XCircle,
  Archive,
  Banknote,
  ShieldCheck,
  ChevronRight,
  History,
  AlertCircle,
  HeartHandshake,
  Pencil // Added Pencil Icon for Edit
} from 'lucide-react';

// --- Firebase Configuration & Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyDJ_dbR6it00PpQkZckxyo7-EXyanQFzE4",
  authDomain: "kishdbsoria-app.firebaseapp.com",
  projectId: "kishdbsoria-app",
  storageBucket: "kishdbsoria-app.firebasestorage.app",
  messagingSenderId: "1076257263660",
  appId: "1:1076257263660:web:281a74984c9e3fcd294189",
  measurementId: "G-D8VGN6W3B3"
}; 

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- CONSTANTS ---
const ADMIN_PIN = "041412"; 
const APP_NAME = "KishDBSoria Dropping Area"; 

// LA UNION TOWNS LIST
const LU_TOWNS = [
  "SFC",
  "Bacnotan",
  "Bangar",
  "Bauang",
  "Agoo",
  "Caba",
  "Aringay",
  "Rosario",
  "San Juan",
  "Balaoan",
  "Luna",
  "San Gabriel",
  "Naguillian",
  "Damortis / Sto Tomas",
  "Tubao",
  "Pugo"
];

// --- Main Application Component ---
export default function App() {
  const [user, setUser] = useState(null);
  
  // Auth State
  const [role, setRole] = useState(null); 
  const [userName, setUserName] = useState('');
  
  // Data State
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // EDIT MODAL STATE
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // Login UI State
  const [loginMode, setLoginMode] = useState('menu'); 
  const [loginInputName, setLoginInputName] = useState('');
  const [loginInputPass, setLoginInputPass] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);

  // Form State for New Item
  const [newItemItem, setNewItemItem] = useState('');
  const [newItemBuyer, setNewItemBuyer] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemLocation, setNewItemLocation] = useState('SFC'); // Default to SFC

  // Cash Out Selection State (For Admin)
  const [selectedSellerForCashout, setSelectedSellerForCashout] = useState(null);

  // --- Auth & Data Effects ---

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (error) {
        console.error("Auth failed", error);
      }
    };
    initAuth();

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      const savedRole = localStorage.getItem('la_union_role');
      const savedName = localStorage.getItem('la_union_name');
      if (savedRole && savedName) {
        setRole(savedRole);
        setUserName(savedName);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'dropping_items');
    
    const unsubscribe = onSnapshot(itemsRef, (snapshot) => {
      const loadedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date()
      }));
      loadedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(loadedItems);
      setLoading(false);
    }, (error) => {
      console.error("Data fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Login Handlers ---

  const handleAdminLogin = () => {
    if (loginInputPass === ADMIN_PIN) {
      completeLogin('admin', 'Administrator');
    } else {
      setLoginError('Incorrect Admin PIN');
    }
  };

  const handleSellerAuth = async () => {
    if (!loginInputName.trim() || !loginInputPass.trim()) {
      setLoginError('Please enter name and password');
      return;
    }

    const safeId = loginInputName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'sellers', safeId);
    
    try {
      const userSnap = await getDoc(userRef);
      
      if (isRegistering) {
        if (userSnap.exists()) {
          setLoginError('Shop name already exists. Please login instead.');
        } else {
           await setDoc(userRef, {
            displayName: loginInputName,
            password: loginInputPass,
            role: 'seller',
            createdAt: serverTimestamp()
          });
          completeLogin('seller', loginInputName);
        }
      } else {
        if (userSnap.exists()) {
          const userData = userSnap.data();
          if (userData.password === loginInputPass) {
            completeLogin('seller', userData.displayName);
          } else {
            setLoginError('Incorrect password');
          }
        } else {
          setLoginError('Shop not found. Please register first.');
        }
      }
    } catch (err) {
      console.error("Auth Error:", err);
      if (err.code === 'permission-denied') {
         setLoginError('Database Permission Denied. Please check Firestore Rules.');
      } else {
         setLoginError('Error: ' + err.message);
      }
    }
  };

  const handleBuyerLogin = () => {
    if (!loginInputName.trim()) return;
    completeLogin('buyer', loginInputName);
  };

  const completeLogin = (newRole, newName) => {
    setRole(newRole);
    setUserName(newName);
    localStorage.setItem('la_union_role', newRole);
    localStorage.setItem('la_union_name', newName);
    setLoginMode('menu');
    setLoginInputName('');
    setLoginInputPass('');
    setLoginError('');
    setIsRegistering(false);
  };

  const handleLogout = () => {
    setRole(null);
    setUserName('');
    localStorage.removeItem('la_union_role');
    localStorage.removeItem('la_union_name');
    setLoginMode('menu');
    setSelectedSellerForCashout(null);
  };

  // --- Data Handlers ---

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemItem || !newItemBuyer) return;

    try {
      const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'dropping_items');
      await addDoc(itemsRef, {
        itemName: newItemItem,
        buyerName: newItemBuyer,
        sellerName: userName, 
        location: newItemLocation,
        price: newItemPrice || '0',
        status: 'dropped',
        isPaidExternally: false, // Default: Not paid externally
        createdAt: serverTimestamp()
      });
      
      setNewItemItem('');
      setNewItemBuyer('');
      setNewItemPrice('');
      // Keep previous location selected for faster entry of multiple items
      setIsFormOpen(false);
    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error adding item: " + error.message);
    }
  };

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'dropping_items', itemId);
      await updateDoc(itemRef, { status: newStatus });
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error updating status: " + error.message);
    }
  };

  // --- Edit Logic (For Admin) ---

  const handleEditClick = (item) => {
    setEditingItem({ ...item }); // Create copy
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (e) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'dropping_items', editingItem.id);
      await updateDoc(itemRef, {
        itemName: editingItem.itemName,
        buyerName: editingItem.buyerName,
        price: editingItem.price,
        location: editingItem.location,
        isPaidExternally: editingItem.isPaidExternally || false
      });
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      alert("Error updating item: " + error.message);
    }
  };

  // --- Admin Cash Out Logic ---

  const sellersWithBalance = useMemo(() => {
    if (role !== 'admin') return [];
    
    const groups = {};
    items.forEach(item => {
      // Only include items that are 'claimed' and NOT marked as 'isPaidExternally'
      if (item.status === 'claimed') {
        const seller = item.sellerName || 'Unknown';
        if (!groups[seller]) {
          groups[seller] = { name: seller, items: [], total: 0 };
        }
        groups[seller].items.push(item);
        
        // Only add to total if NOT paid externally
        if (!item.isPaidExternally) {
          const price = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
          groups[seller].total += price;
        }
      }
    });
    return Object.values(groups);
  }, [items, role]);

  const confirmCashOutForSeller = async () => {
    if (!selectedSellerForCashout) return;
    if (isProcessing) return;
    
    const itemsToProcess = selectedSellerForCashout.items.map(i => i.id);
    const sellerName = selectedSellerForCashout.name;

    setIsProcessing(true);

    try {
      const batchSize = 250; 
      
      for (let i = 0; i < itemsToProcess.length; i += batchSize) {
        const chunk = itemsToProcess.slice(i, i + batchSize);
        const batch = writeBatch(db);
        
        chunk.forEach(id => {
            const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'dropping_items', id);
            batch.update(itemRef, { status: 'cashed_out' });
        });

        await batch.commit();
      }
      
      setTimeout(() => {
          alert(`Success! Payout recorded for ${sellerName}. Items moved to Archive.`);
          setSelectedSellerForCashout(null);
          setIsProcessing(false);
      }, 500);

    } catch (error) {
      console.error("Cash out error", error);
      alert("System Error: " + error.message);
      setIsProcessing(false);
    }
  };

  // --- Filtering (Strict Privacy Logic) ---

  const filteredItems = useMemo(() => {
    if (role === 'buyer' && !searchTerm.trim()) {
        return [];
    }

    return items.filter(item => {
      if (role === 'seller' && item.sellerName !== userName) {
        return false;
      }

      const searchLower = searchTerm.toLowerCase();
      let matchesSearch = false;
      
      if (role === 'buyer') {
          matchesSearch = item.buyerName.toLowerCase().includes(searchLower);
      } else {
          matchesSearch = 
            item.itemName.toLowerCase().includes(searchLower) ||
            item.buyerName.toLowerCase().includes(searchLower) ||
            item.sellerName.toLowerCase().includes(searchLower) ||
            (item.location && item.location.toLowerCase().includes(searchLower));
      }

      let matchesStatus = true;
      if (statusFilter !== 'all') {
        matchesStatus = item.status === statusFilter;
      }
      
      if (statusFilter === 'all' && item.status === 'cashed_out') {
        matchesStatus = false;
      }

      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter, role, userName]);

  const stats = useMemo(() => {
    let viewableItems = items;
    
    if (role === 'seller') {
        viewableItems = items.filter(i => i.sellerName === userName);
    } else if (role === 'buyer') {
        viewableItems = []; 
    }
    
    return {
      total: viewableItems.length,
      dropped: viewableItems.filter(i => i.status === 'dropped').length,
      claimed: viewableItems.filter(i => i.status === 'claimed').length,
      cashed_out: viewableItems.filter(i => i.status === 'cashed_out').length
    };
  }, [items, role, userName]);


  // --- RENDER ---

  if (loading) {
    return (
      <div className="min-h-screen bg-fuchsia-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600"></div>
      </div>
    );
  }

  // --- LOGIN SCREENS ---
  if (!role) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full relative overflow-hidden">
          
          <div className="text-center mb-8">
            <div className="mx-auto mb-6 flex justify-center">
              <img src="/logo.png" alt="KishDBSoria Logo" className="h-24 w-auto object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{APP_NAME}</h1>
            <p className="text-pink-500 font-medium">Logistics & Tracking</p>
          </div>

          {/* MAIN MENU */}
          {loginMode === 'menu' && (
            <div className="space-y-3">
              <button 
                onClick={() => { setLoginMode('seller'); setIsRegistering(false); }}
                className="w-full flex items-center p-4 bg-white border-2 border-pink-100 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all group"
              >
                <div className="bg-pink-100 p-2 rounded-lg mr-4 group-hover:bg-pink-200"><ShoppingBag className="text-pink-600 w-6 h-6" /></div>
                <div className="text-left">
                  <div className="font-bold text-slate-700">Seller Login</div>
                  <div className="text-xs text-slate-400">Drop items, track sales</div>
                </div>
                <ChevronRight className="ml-auto text-slate-300 group-hover:text-pink-500" />
              </button>

              <button 
                onClick={() => setLoginMode('buyer')}
                className="w-full flex items-center p-4 bg-white border-2 border-purple-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group"
              >
                <div className="bg-purple-100 p-2 rounded-lg mr-4 group-hover:bg-purple-200"><User className="text-purple-600 w-6 h-6" /></div>
                <div className="text-left">
                  <div className="font-bold text-slate-700">Buyer Login</div>
                  <div className="text-xs text-slate-400">Check for your packages</div>
                </div>
                <ChevronRight className="ml-auto text-slate-300 group-hover:text-purple-500" />
              </button>

              <button 
                onClick={() => setLoginMode('admin')}
                className="w-full flex items-center p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-slate-800 hover:bg-slate-50 transition-all group"
              >
                <div className="bg-slate-100 p-2 rounded-lg mr-4 group-hover:bg-slate-200"><ShieldCheck className="text-slate-600 w-6 h-6" /></div>
                <div className="text-left">
                  <div className="font-bold text-slate-700">Admin</div>
                  <div className="text-xs text-slate-400">Manage center</div>
                </div>
              </button>
            </div>
          )}

          {/* ADMIN FORM */}
          {loginMode === 'admin' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Admin Access</h2>
              <input 
                type="password" 
                placeholder="Enter PIN"
                value={loginInputPass}
                onChange={(e) => setLoginInputPass(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none text-center tracking-widest text-xl"
              />
              {loginError && <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>}
              <button onClick={handleAdminLogin} className="w-full bg-purple-800 text-white py-3 rounded-lg font-semibold hover:bg-purple-900 mb-3">Login</button>
              <button onClick={() => { setLoginMode('menu'); setLoginError(''); }} className="w-full text-slate-500 text-sm hover:underline">Back</button>
            </div>
          )}

          {/* SELLER FORM */}
          {loginMode === 'seller' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-2">
                {isRegistering ? 'Register New Shop' : 'Seller Login'}
              </h2>
              <div className="space-y-3">
                <input 
                  type="text" 
                  placeholder="Shop Name / Username"
                  value={loginInputName}
                  onChange={(e) => setLoginInputName(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                />
                <input 
                  type="password" 
                  placeholder={isRegistering ? "Create Password" : "Password"}
                  value={loginInputPass}
                  onChange={(e) => setLoginInputPass(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none"
                />
              </div>
              
              {loginError && <p className="text-red-500 text-sm mt-3 text-center">{loginError}</p>}
              
              <button 
                onClick={handleSellerAuth} 
                className="w-full bg-pink-600 text-white py-3 rounded-lg font-semibold hover:bg-pink-700 mt-4 mb-2 shadow-md shadow-pink-200"
              >
                {isRegistering ? 'Create Account' : 'Login'}
              </button>
              
              <div className="text-center mb-4">
                 <button 
                    onClick={() => { setIsRegistering(!isRegistering); setLoginError(''); }}
                    className="text-sm text-pink-600 hover:text-pink-800 font-medium"
                 >
                    {isRegistering ? 'Already have an account? Login' : 'New Seller? Register Here'}
                 </button>
              </div>

              <button onClick={() => { setLoginMode('menu'); setLoginError(''); }} className="w-full text-slate-500 text-sm hover:underline">Back to Menu</button>
            </div>
          )}

          {/* BUYER FORM */}
          {loginMode === 'buyer' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Buyer Access</h2>
              <input 
                type="text" 
                placeholder="Enter your Name"
                value={loginInputName}
                onChange={(e) => setLoginInputName(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none"
              />
              <button onClick={handleBuyerLogin} className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 mb-3">Check My Items</button>
              <button onClick={() => setLoginMode('menu')} className="w-full text-slate-500 text-sm hover:underline">Back</button>
            </div>
          )}

        </div>
      </div>
    );
  }

  // --- MAIN APP RENDER ---
  return (
    <div className="min-h-screen bg-fuchsia-50">

      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{APP_NAME}</h1>
                <h1 className="text-xl font-bold text-slate-800 sm:hidden">KDS Dropping</h1>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        role === 'admin' ? 'bg-purple-800 text-white' :
                        role === 'seller' ? 'bg-pink-100 text-pink-800' : 'bg-purple-100 text-purple-800'
                    }`}>
                        {role}
                    </span>
                    <span className="text-xs text-slate-500">{userName}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
                {role === 'admin' && (
                    <button 
                        onClick={() => setIsCashOutModalOpen(true)}
                        className="flex items-center gap-1 bg-purple-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-purple-900 transition-colors shadow-sm"
                    >
                        <Banknote className="w-4 h-4" />
                        <span className="hidden sm:inline">Admin Cash Out</span>
                    </button>
                )}
                <button 
                onClick={handleLogout}
                className="text-slate-400 hover:text-pink-600 transition-colors p-2"
                title="Logout"
                >
                <LogOut className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        
        {/* Quick Actions / Stats */}
        {role !== 'buyer' && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100">
              {role === 'seller' ? (
                  <>
                      <div className="text-pink-500 text-xs font-semibold uppercase">My Active Items</div>
                      <div className="text-2xl font-bold text-slate-800">{stats.dropped + stats.claimed}</div>
                  </>
              ) : (
                  <>
                      <div className="text-slate-500 text-xs font-semibold uppercase">Total Database</div>
                      <div className="text-2xl font-bold text-slate-800">{items.length}</div>
                  </>
              )}
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100">
              <div className="text-pink-500 text-xs font-semibold uppercase">Ready to Pickup</div>
              <div className="text-2xl font-bold text-pink-600">{stats.dropped}</div>
            </div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100">
              <div className="text-purple-500 text-xs font-semibold uppercase">Claimed (Unpaid)</div>
              <div className="text-2xl font-bold text-purple-600">{stats.claimed}</div>
            </div>
            
            <div className="bg-pink-50 p-4 rounded-xl shadow-sm border border-pink-200 flex items-center justify-between">
              <div>
                <div className="text-pink-700 text-xs font-semibold uppercase">New Drop</div>
                <div className="text-xs text-pink-600">Add package</div>
              </div>
              {(role === 'seller' || role === 'admin') && (
                <button 
                  onClick={() => setIsFormOpen(true)}
                  className="bg-pink-600 text-white p-2 rounded-lg hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"
                >
                  <Plus className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100 mb-6 flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                <input 
                type="text" 
                placeholder={role === 'seller' ? "Search my items..." : (role === 'buyer' ? "Type YOUR NAME to find packages..." : "Search items, buyers, or sellers...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
            </div>
            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'all' ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All Active</button>
                <button onClick={() => setStatusFilter('dropped')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'dropped' ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'}`}>Ready</button>
                <button onClick={() => setStatusFilter('claimed')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'claimed' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>Claimed</button>
                {(role === 'admin' || role === 'seller') && (
                    <button onClick={() => setStatusFilter('cashed_out')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${statusFilter === 'cashed_out' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                        {role === 'seller' ? <History className="w-3 h-3" /> : <Archive className="w-3 h-3" />} 
                        {role === 'seller' ? 'My History' : 'Archive'}
                    </button>
                )}
            </div>
        </div>

        {/* LIST VIEW */}
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 overflow-hidden">
          <div className="hidden md:grid grid-cols-7 gap-4 p-4 bg-fuchsia-50/50 border-b border-pink-100 text-xs font-semibold text-purple-800 uppercase tracking-wider">
            <div className="col-span-1">Date</div>
            <div className="col-span-2">Item</div>
            <div className="col-span-1">Location</div>
            <div className="col-span-1">Buyer</div>
            <div className="col-span-1">Seller</div>
            <div className="col-span-1 text-right">Status</div>
          </div>

          <div className="divide-y divide-pink-50">
            {filteredItems.map((item) => (
              <div key={item.id} className="group hover:bg-fuchsia-50 transition-colors">
                
                {/* Desktop */}
                <div className="hidden md:grid grid-cols-7 gap-4 p-4 items-center">
                  <div className="text-sm text-slate-500">
                    {item.createdAt.toLocaleDateString()}
                    <div className="text-xs text-slate-400">{item.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-sm font-medium text-slate-800">{item.itemName}</div>
                    {/* Price Logic: Hide for buyers, show 'Paid Externally' style if needed */}
                    {role !== 'buyer' && (
                      <div className={`text-xs ${item.isPaidExternally ? 'text-gray-400 line-through' : 'text-slate-500'}`}>
                        {item.isPaidExternally ? `(${item.price})` : `Price: ${item.price}`}
                      </div>
                    )}
                  </div>
                  <div className="col-span-1 text-sm text-slate-600 flex items-center gap-1">
                     <MapPin className="w-3 h-3 text-slate-400" /> {item.location || '-'}
                  </div>
                  <div className="text-sm text-slate-600">{item.buyerName}</div>
                  <div className="text-sm text-slate-600">{item.sellerName}</div>
                  <div className="text-right flex items-center justify-end gap-2">
                    
                    {/* Admin Edit Button */}
                    {role === 'admin' && (
                        <button 
                          onClick={() => handleEditClick(item)} 
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Edit Item"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                    )}

                    {item.status === 'dropped' ? (
                      <>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">Ready</span>
                        {role === 'admin' && (
                            <button 
                            onClick={() => handleStatusChange(item.id, 'claimed')}
                            className="ml-2 p-1 hover:bg-purple-100 rounded text-purple-600"
                            title="Admin: Mark Claimed"
                            >
                            <CheckCircle2 className="w-5 h-5" />
                            </button>
                        )}
                        {(role === 'admin' || (role === 'seller' && item.sellerName === userName)) && (
                            <button 
                                onClick={() => handleStatusChange(item.id, 'cancelled')}
                                className="text-xs text-red-400 hover:text-red-600 hover:underline ml-2"
                            >
                                Cancel
                            </button>
                        )}
                      </>
                    ) : item.status === 'claimed' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Claimed</span>
                    ) : item.status === 'cashed_out' ? (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Cashed Out</span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800">Cancelled</span>
                    )}
                  </div>
                </div>

                {/* Mobile */}
                <div className="md:hidden p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h4 className="font-semibold text-slate-800">{item.itemName}</h4>
                      <p className="text-sm text-slate-500">Buyer: <span className="text-slate-700 font-medium">{item.buyerName}</span></p>
                    </div>
                    {item.status === 'dropped' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">Ready</span>
                    ) : item.status === 'claimed' ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Claimed</span>
                    ) : item.status === 'cashed_out' ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Done</span>
                    ) : (
                       <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800">Cancelled</span>
                    )}
                  </div>
                  
                  <div className="flex flex-col gap-1 mb-2">
                       <div className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Seller: {item.sellerName}</div>
                  </div>

                  <div className="flex justify-between items-end border-t border-pink-50 pt-2">
                    <div className="text-xs text-slate-400">{item.createdAt.toLocaleDateString()}</div>
                    <div className="flex items-center gap-2">
                       
                       {/* Admin Edit on Mobile */}
                       {role === 'admin' && (
                          <button onClick={() => handleEditClick(item)} className="p-1 mr-2 text-slate-400">
                             <Pencil className="w-4 h-4" />
                          </button>
                       )}

                       {/* HIDE PRICE FROM BUYER IN MOBILE VIEW */}
                       {role !== 'buyer' && (
                          <span className={`text-sm font-semibold mr-2 ${item.isPaidExternally ? 'text-gray-400 line-through' : 'text-purple-700'}`}>
                            {item.isPaidExternally ? `(₱${item.price})` : `₱${item.price}`}
                          </span>
                       )}
                       {item.status === 'dropped' && role === 'admin' && (
                         <button onClick={() => handleStatusChange(item.id, 'claimed')} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700">Mark Claimed</button>
                       )}
                    </div>
                  </div>
                </div>

              </div>
            ))}

            {filteredItems.length === 0 && (
              <div className="p-12 text-center text-slate-400">
                {role === 'buyer' && !searchTerm ? (
                   <>
                     <Search className="w-12 h-12 mx-auto mb-3 opacity-20 text-pink-400" />
                     <p className="font-semibold text-purple-700">Enter your name above</p>
                     <p className="text-sm text-pink-500">Type your name to find your packages.</p>
                   </>
                ) : (
                   <>
                     <Package className="w-12 h-12 mx-auto mb-3 opacity-20 text-pink-400" />
                     <p className="text-pink-500">No items found.</p>
                   </>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* --- MODAL: DROP ITEM --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Drop New Item</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-pink-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleAddItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input required type="text" placeholder="e.g. White Dress" value={newItemItem} onChange={(e) => setNewItemItem(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Name</label>
                <input required type="text" placeholder="e.g. Maria Cruz" value={newItemBuyer} onChange={(e) => setNewItemBuyer(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                    <input type="text" placeholder="e.g. 500" value={newItemPrice} onChange={(e) => setNewItemPrice(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    {/* UPDATED: LOCATION DROPDOWN */}
                    <select 
                      value={newItemLocation}
                      onChange={(e) => setNewItemLocation(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                    >
                      {LU_TOWNS.map(town => (
                        <option key={town} value={town}>{town}</option>
                      ))}
                    </select>
                  </div>
              </div>
              <button type="submit" className="w-full py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 shadow-md shadow-pink-200">Confirm Drop</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT ITEM (ADMIN ONLY) --- */}
      {isEditModalOpen && editingItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Edit Item</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-pink-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input 
                  type="text" 
                  value={editingItem.itemName} 
                  onChange={(e) => setEditingItem({...editingItem, itemName: e.target.value})} 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Buyer Name</label>
                <input 
                  type="text" 
                  value={editingItem.buyerName} 
                  onChange={(e) => setEditingItem({...editingItem, buyerName: e.target.value})} 
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Price</label>
                    <input 
                      type="text" 
                      value={editingItem.price} 
                      onChange={(e) => setEditingItem({...editingItem, price: e.target.value})} 
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
                    <select 
                      value={editingItem.location || 'SFC'}
                      onChange={(e) => setEditingItem({...editingItem, location: e.target.value})}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none bg-white"
                    >
                      {LU_TOWNS.map(town => (
                        <option key={town} value={town}>{town}</option>
                      ))}
                    </select>
                  </div>
              </div>

              {/* NEW: MARK AS PAID EXTERNALLY */}
              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl flex items-center justify-between">
                 <div>
                    <div className="font-semibold text-yellow-800 text-sm">Payment Received Outside?</div>
                    <div className="text-xs text-yellow-600">Toggle this if buyer paid directly.</div>
                 </div>
                 <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      className="sr-only peer"
                      checked={editingItem.isPaidExternally || false}
                      onChange={(e) => setEditingItem({...editingItem, isPaidExternally: e.target.checked})}
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                 </label>
              </div>

              <button type="submit" className="w-full py-3 bg-purple-800 text-white rounded-lg font-semibold hover:bg-purple-900 shadow-md">Update Item</button>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: ADMIN CASH OUT --- */}
      {isCashOutModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl my-8">
            <div className="p-6 border-b border-pink-100 flex justify-between items-center">
                <div>
                    <h3 className="text-xl font-bold text-slate-800">Admin Cash Out</h3>
                    <p className="text-sm text-slate-500">{selectedSellerForCashout ? `Invoice for ${selectedSellerForCashout.name}` : 'Select a seller to pay out'}</p>
                </div>
                <button onClick={() => { setIsCashOutModalOpen(false); setSelectedSellerForCashout(null); }} className="text-slate-400 hover:text-pink-600"><XCircle className="w-6 h-6" /></button>
            </div>

            {!selectedSellerForCashout && (
                <div className="p-6">
                   <div className="space-y-2">
                       {sellersWithBalance.length === 0 ? (
                           <div className="text-center py-10 text-slate-400">No pending balances found.</div>
                       ) : (
                           sellersWithBalance.map((seller, idx) => (
                               <button 
                                 key={idx} 
                                 onClick={() => setSelectedSellerForCashout(seller)}
                                 className="w-full flex justify-between items-center p-4 bg-white hover:bg-pink-50 rounded-xl border border-pink-100 transition-colors group"
                               >
                                   <div className="flex items-center gap-3">
                                       <div className="bg-pink-100 p-2 rounded-full text-pink-600 font-bold w-10 h-10 flex items-center justify-center group-hover:bg-pink-200">₱</div>
                                       <div className="text-left">
                                           <div className="font-bold text-slate-800">{seller.name}</div>
                                           <div className="text-xs text-slate-500">{seller.items.length} items to claim</div>
                                       </div>
                                   </div>
                                   <div className="font-bold text-lg text-purple-600">₱{seller.total}</div>
                               </button>
                           ))
                       )}
                   </div>
                </div>
            )}

            {selectedSellerForCashout && (
                <div className="p-8">
                    <div className="text-center mb-8">
                        <h1 className="text-2xl font-bold text-purple-800">{APP_NAME}</h1>
                        <p className="text-sm text-pink-600">Cash Out Receipt / Invoice</p>
                        <p className="text-xs text-slate-500 mt-1">Date: {new Date().toLocaleDateString()}</p>
                    </div>

                    <div className="bg-fuchsia-50 p-4 rounded-lg border border-pink-100 mb-6">
                        <div className="flex justify-between mb-2">
                            <span className="text-slate-500">Seller Name:</span>
                            <span className="font-bold text-lg text-slate-800">{selectedSellerForCashout.name}</span>
                        </div>
                        <div className="flex justify-between">
                             <span className="text-slate-500">Transaction ID:</span>
                             <span className="font-mono text-xs text-purple-600">{selectedSellerForCashout.items[0]?.id.substring(0,8).toUpperCase()}...</span>
                        </div>
                    </div>

                    <table className="w-full mb-6 text-sm">
                        <thead>
                            <tr className="border-b-2 border-pink-100 text-left"><th className="py-2 text-slate-500">Item</th><th className="py-2 text-slate-500">Buyer</th><th className="py-2 text-slate-500 text-right">Price</th></tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                            {selectedSellerForCashout.items.map(item => (
                                <tr key={item.id}>
                                    <td className="py-2 text-slate-700">{item.itemName}</td>
                                    <td className="py-2 text-slate-500">{item.buyerName}</td>
                                    <td className="py-2 text-right font-medium text-purple-700">
                                        {/* Updated Invoice Display Logic */}
                                        {item.isPaidExternally ? <span className="text-gray-400 line-through decoration-double">({item.price})</span> : `₱${item.price}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-800">
                                <td colSpan="2" className="py-4 font-bold text-slate-800 text-right pr-4">TOTAL PAYOUT:</td>
                                <td className="py-4 font-bold text-xl text-purple-600 text-right">₱{selectedSellerForCashout.total}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="flex gap-3 justify-end mt-6 border-t border-pink-100 pt-6">
                         <button onClick={() => setSelectedSellerForCashout(null)} className="px-4 py-2 text-slate-500 hover:text-pink-600">Back</button>
                         <button 
                            onClick={confirmCashOutForSeller} 
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 shadow-md shadow-purple-200"
                         >
                            <CheckCircle2 className="w-4 h-4" /> 
                            {isProcessing ? 'Processing...' : 'Confirm & Archive'}
                         </button>
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
