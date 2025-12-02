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
  deleteDoc, 
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
  Users, 
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
  Pencil,
  CalendarCheck,
  KeyRound, 
  Trash2, 
  UserPlus,
  RotateCcw,
  Check,
  PackageMinus,
  ChevronLeft, 
  ArrowUpDown, 
  ListFilter,
  FileDown 
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
  const [sellerList, setSellerList] = useState([]); 
  const [loading, setLoading] = useState(true);
  
  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); 
  const [isFormOpen, setIsFormOpen] = useState(false);
  
  // PAGINATION & SORTING STATE (MAIN LIST)
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [sortBy, setSortBy] = useState('date'); 
  const [sortOrder, setSortOrder] = useState('desc'); 

  // MASS ACTION STATE
  const [selectedItems, setSelectedItems] = useState(new Set()); 

  // EDIT MODAL STATE
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [isCashOutModalOpen, setIsCashOutModalOpen] = useState(false);
  const [isUserMgmtOpen, setIsUserMgmtOpen] = useState(false); 
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccessMsg, setShowSuccessMsg] = useState(false); 

  // CASH OUT SEARCH & PAGINATION (NEW)
  const [cashOutSearchTerm, setCashOutSearchTerm] = useState('');
  const [cashOutPage, setCashOutPage] = useState(1);
  const CASH_OUT_ITEMS_PER_PAGE = 10;

  // Login UI State
  const [loginMode, setLoginMode] = useState('menu'); 
  const [loginInputName, setLoginInputName] = useState('');
  const [loginInputPass, setLoginInputPass] = useState('');
  const [loginError, setLoginError] = useState('');
  
  // Admin Add User State
  const [newSellerName, setNewSellerName] = useState('');
  const [newSellerPass, setNewSellerPass] = useState('');

  // Form State for New Item
  const [newItemItem, setNewItemItem] = useState('');
  const [newItemBuyer, setNewItemBuyer] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemTransferFee, setNewItemTransferFee] = useState(''); 
  const [newItemLocation, setNewItemLocation] = useState('SFC');
  const [newItemSeller, setNewItemSeller] = useState(''); 

  // Cash Out Selection State (For Admin)
  const [selectedSellerForCashout, setSelectedSellerForCashout] = useState(null);

  // --- HELPER: DATE FORMATTER (MM/DD/YY) ---
  const formatDate = (date) => {
    if (!date) return '';
    return date.toLocaleDateString('en-US', {
      month: '2-digit',
      day: '2-digit',
      year: '2-digit'
    });
  };

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
        // NEW: If they are a buyer, auto-populate the search term on refresh/load
        if (savedRole === 'buyer') {
          setSearchTerm(savedName);
        }
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
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        claimedAt: doc.data().claimedAt?.toDate() || null
      }));
      // Default sort on load is irrelevant as we re-sort in UI
      loadedItems.sort((a, b) => b.createdAt - a.createdAt);
      setItems(loadedItems);
      setLoading(false);
    }, (error) => {
      console.error("Data fetch error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (role === 'admin') {
       const sellersRef = collection(db, 'artifacts', appId, 'public', 'data', 'sellers');
       const unsubscribe = onSnapshot(sellersRef, (snapshot) => {
          const users = snapshot.docs.map(doc => ({
             id: doc.id,
             ...doc.data()
          }));
          users.sort((a, b) => a.displayName.localeCompare(b.displayName));
          setSellerList(users);
       });
       return () => unsubscribe();
    }
  }, [role]);

  // --- Mass Action Handlers ---

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      // Select all currently filtered items
      const allIds = sortedItems.map(i => i.id); 
      setSelectedItems(new Set(allIds));
    } else {
      setSelectedItems(new Set());
    }
  };

  const handleSelectItem = (id) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedItems(newSelected);
  };

  const handleMassDelete = async () => {
    if (selectedItems.size === 0) return;
    
    const pin = prompt(`⚠️ DANGER ZONE ⚠️\n\nYou are about to PERMANENTLY DELETE ${selectedItems.size} items.\n\nThis cannot be undone. Please enter the Admin PIN to confirm:`);
    
    if (pin !== ADMIN_PIN) {
        alert("Incorrect PIN. Deletion cancelled.");
        return;
    }

    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      selectedItems.forEach(id => {
        const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'dropping_items', id);
        batch.delete(itemRef);
      });
      await batch.commit();
      
      setSelectedItems(new Set()); 
      alert("Selected items deleted successfully.");
    } catch (error) {
      console.error("Error deleting items:", error);
      alert("Error deleting items: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // NEW: EXPORT TO CSV HANDLER
  const handleExportCSV = () => {
    if (selectedItems.size === 0) return;

    // Get the actual item objects from the IDs
    const exportData = items.filter(item => selectedItems.has(item.id));

    // Define CSV Headers
    const headers = ["Date Added", "Item Name", "Buyer", "Seller", "Location", "Price", "Transfer Fee", "Status", "Claimed Date", "Paid Externally?"];

    // Convert Data to CSV Format
    const csvRows = [
      headers.join(','), // Header Row
      ...exportData.map(item => {
        // Helper to escape commas in text (e.g. "Dress, White")
        const escape = (text) => `"${String(text || '').replace(/"/g, '""')}"`;
        
        return [
          escape(formatDate(item.createdAt)),
          escape(item.itemName),
          escape(item.buyerName),
          escape(item.sellerName),
          escape(item.location),
          escape(item.price),
          escape(item.transferFee || '0'),
          escape(item.status),
          escape(formatDate(item.claimedAt)),
          escape(item.isPaidExternally ? 'Yes' : 'No')
        ].join(',');
      })
    ];

    // Create Blob and Link
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `KishDBSoria_Export_${new Date().toLocaleDateString().replace(/\//g, '-')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };


  // --- Login Handlers ---

  const handleAdminLogin = () => {
    if (loginInputPass === ADMIN_PIN) {
      completeLogin('admin', 'Administrator');
    } else {
      setLoginError('Incorrect Admin PIN');
    }
  };

  const handleSellerLogin = async () => {
    if (!loginInputName.trim() || !loginInputPass.trim()) {
      setLoginError('Please enter name and password');
      return;
    }

    const safeId = loginInputName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'sellers', safeId);
    
    try {
      const userSnap = await getDoc(userRef);
      
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.password === loginInputPass) {
          completeLogin('seller', userData.displayName);
        } else {
          setLoginError('Incorrect password');
        }
      } else {
        setLoginError('Account not found. Please ask Admin to create your account.');
      }
    } catch (err) {
      console.error("Auth Error:", err);
      setLoginError('Error: ' + err.message);
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
    
    // NEW: If buyer, auto-populate the search term so they don't have to type it again
    if (newRole === 'buyer') {
      setSearchTerm(newName);
    }

    setLoginMode('menu');
    setLoginInputName('');
    setLoginInputPass('');
    setLoginError('');
  };

  const handleLogout = () => {
    setRole(null);
    setUserName('');
    localStorage.removeItem('la_union_role');
    localStorage.removeItem('la_union_name');
    setLoginMode('menu');
    setSelectedSellerForCashout(null);
    setIsUserMgmtOpen(false);
    setSelectedItems(new Set()); 
    // Clear search term on logout so next user starts fresh
    setSearchTerm(''); 
    // Reset pagination states
    setCashOutSearchTerm('');
    setCashOutPage(1);
  };

  // --- Data Handlers ---

  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newItemItem || !newItemBuyer) return;

    const actualSeller = role === 'admin' ? newItemSeller : userName;

    if (!actualSeller) {
        alert("Please select a Seller.");
        return;
    }

    try {
      const itemsRef = collection(db, 'artifacts', appId, 'public', 'data', 'dropping_items');
      await addDoc(itemsRef, {
        itemName: newItemItem,
        buyerName: newItemBuyer,
        sellerName: actualSeller, 
        location: newItemLocation,
        price: newItemPrice || '0',
        transferFee: newItemTransferFee || '0', 
        status: 'dropped',
        isPaidExternally: false, 
        createdAt: serverTimestamp()
      });
      
      setNewItemItem('');
      setNewItemBuyer('');
      setNewItemPrice('');
      setNewItemTransferFee(''); 
      
      setShowSuccessMsg(true);
      setTimeout(() => setShowSuccessMsg(false), 2000);

    } catch (error) {
      console.error("Error adding item:", error);
      alert("Error adding item: " + error.message);
    }
  };

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      const itemRef = doc(db, 'artifacts', appId, 'public', 'data', 'dropping_items', itemId);
      
      const updates = { status: newStatus };
      if (newStatus === 'claimed') {
        updates.claimedAt = serverTimestamp();
      } else if (newStatus === 'dropped') {
        updates.claimedAt = null; 
      } 

      await updateDoc(itemRef, updates);
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Error updating status: " + error.message);
    }
  };

  // --- User Management Handlers (Admin) ---

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newSellerName || !newSellerPass) return;

    const safeId = newSellerName.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const userRef = doc(db, 'artifacts', appId, 'public', 'data', 'sellers', safeId);

    try {
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            alert("Error: A seller with this name (or similar) already exists.");
            return;
        }

        await setDoc(userRef, {
            displayName: newSellerName,
            password: newSellerPass,
            role: 'seller',
            createdAt: serverTimestamp()
        });

        alert(`Success! Account created for ${newSellerName}`);
        setNewSellerName('');
        setNewSellerPass('');
    } catch (error) {
        alert("Error creating user: " + error.message);
    }
  };

  const handleResetPassword = async (sellerId, sellerName) => {
    const newPass = prompt(`Enter new password for ${sellerName}:`);
    if (!newPass) return;
    
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sellers', sellerId), {
        password: newPass
      });
      alert("Password updated successfully.");
    } catch (error) {
      alert("Error updating password: " + error.message);
    }
  };

  const handleDeleteUser = async (sellerId, sellerName) => {
    // SECURITY CHECK: REQUIRE ADMIN PIN
    const pin = prompt(`⚠️ WARNING ⚠️\n\nYou are about to remove access for ${sellerName}.\n\nPlease enter the Admin PIN to confirm:`);
    
    if (pin !== ADMIN_PIN) {
        alert("Incorrect PIN. Action cancelled.");
        return;
    }
    
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'sellers', sellerId));
      alert(`User ${sellerName} has been removed.`);
    } catch (error) {
      alert("Error removing user: " + error.message);
    }
  };

  // --- Edit Logic (For Admin) ---

  const handleEditClick = (item) => {
    setEditingItem({ transferFee: '0', ...item }); 
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
        transferFee: editingItem.transferFee,
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
      if (item.status === 'claimed') {
        const seller = item.sellerName || 'Unknown';
        if (!groups[seller]) {
          groups[seller] = { name: seller, items: [], total: 0 };
        }
        groups[seller].items.push(item);
        
        if (!item.isPaidExternally) {
          const price = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
          const fee = parseFloat(item.transferFee?.replace(/[^0-9.]/g, '') || '0') || 0;
          groups[seller].total += (price + fee);
        }
      }
    });
    // Sort by name alphabetically by default
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [items, role]);

  // Filter & Paginate Cash Out List
  const filteredCashOutSellers = useMemo(() => {
    let result = sellersWithBalance;

    // Filter by search term
    if (cashOutSearchTerm.trim()) {
      const lowerTerm = cashOutSearchTerm.toLowerCase();
      result = result.filter(seller => seller.name.toLowerCase().includes(lowerTerm));
    }
    
    return result;
  }, [sellersWithBalance, cashOutSearchTerm]);

  const paginatedCashOutSellers = useMemo(() => {
    const startIndex = (cashOutPage - 1) * CASH_OUT_ITEMS_PER_PAGE;
    return filteredCashOutSellers.slice(startIndex, startIndex + CASH_OUT_ITEMS_PER_PAGE);
  }, [filteredCashOutSellers, cashOutPage]);

  const totalCashOutPages = Math.ceil(filteredCashOutSellers.length / CASH_OUT_ITEMS_PER_PAGE);

  // Reset cash out page when search changes
  useEffect(() => {
    if (isCashOutModalOpen) {
        setCashOutPage(1);
    }
  }, [cashOutSearchTerm, isCashOutModalOpen]);

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

  // --- FILTERING, SORTING & PAGINATION LOGIC ---

  // 1. Filter
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
          matchesSearch = 
            item.buyerName.toLowerCase().includes(searchLower) || 
            (item.location && item.location.toLowerCase().includes(searchLower));
      } else {
          matchesSearch = 
            item.itemName.toLowerCase().includes(searchLower) ||
            item.buyerName.toLowerCase().includes(searchLower) ||
            item.sellerName.toLowerCase().includes(searchLower) ||
            (item.location && item.location.toLowerCase().includes(searchLower));
      }

      let matchesStatus = true;
      if (statusFilter === 'all') {
         if (item.status === 'cashed_out' || item.status === 'pulled_out') {
             matchesStatus = false;
         }
      } else if (statusFilter === 'cashed_out') {
         matchesStatus = item.status === 'cashed_out' || item.status === 'pulled_out';
      } else {
         matchesStatus = item.status === statusFilter;
      }

      return matchesSearch && matchesStatus;
    });
  }, [items, searchTerm, statusFilter, role, userName]);

  // 2. Sort
  const sortedItems = useMemo(() => {
    const sortable = [...filteredItems];
    
    sortable.sort((a, b) => {
      let valA, valB;
      
      switch(sortBy) {
        case 'name':
          valA = a.itemName.toLowerCase();
          valB = b.itemName.toLowerCase();
          break;
        case 'location':
          valA = (a.location || '').toLowerCase();
          valB = (b.location || '').toLowerCase();
          break;
        default: // date
          valA = a.createdAt;
          valB = b.createdAt;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return sortable;
  }, [filteredItems, sortBy, sortOrder]);

  // 3. Paginate
  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return sortedItems.slice(startIndex, startIndex + itemsPerPage);
  }, [sortedItems, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(sortedItems.length / itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, sortBy, sortOrder, itemsPerPage]);


  const stats = useMemo(() => {
    let viewableItems = items;
    if (role === 'seller') {
        viewableItems = items.filter(i => i.sellerName === userName);
    } else if (role === 'buyer') {
        viewableItems = []; 
    }
    
    // NEW: Calculate Balance for Sellers (Claimed + Not Paid Externally)
    let availableBalance = 0;
    if (role === 'seller') {
        availableBalance = viewableItems.reduce((sum, item) => {
            if (item.status === 'claimed' && !item.isPaidExternally) {
                 const price = parseFloat(item.price.replace(/[^0-9.]/g, '')) || 0;
                 const fee = parseFloat(item.transferFee?.replace(/[^0-9.]/g, '') || '0') || 0;
                 return sum + price + fee;
            }
            return sum;
        }, 0);
    }
    
    return {
      total: viewableItems.length,
      dropped: viewableItems.filter(i => i.status === 'dropped').length,
      claimed: viewableItems.filter(i => i.status === 'claimed').length,
      cashed_out: viewableItems.filter(i => i.status === 'cashed_out' || i.status === 'pulled_out').length,
      balance: availableBalance // Added balance to stats
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

          {loginMode === 'menu' && (
            <div className="space-y-3">
              <button onClick={() => { setLoginMode('seller'); }} className="w-full flex items-center p-4 bg-white border-2 border-pink-100 rounded-xl hover:border-pink-500 hover:bg-pink-50 transition-all group">
                <div className="bg-pink-100 p-2 rounded-lg mr-4 group-hover:bg-pink-200"><ShoppingBag className="text-pink-600 w-6 h-6" /></div>
                <div className="text-left"><div className="font-bold text-slate-700">Seller Login</div><div className="text-xs text-slate-400">Drop items, track sales</div></div>
                <ChevronRight className="ml-auto text-slate-300 group-hover:text-pink-500" />
              </button>
              <button onClick={() => setLoginMode('buyer')} className="w-full flex items-center p-4 bg-white border-2 border-purple-100 rounded-xl hover:border-purple-500 hover:bg-purple-50 transition-all group">
                <div className="bg-purple-100 p-2 rounded-lg mr-4 group-hover:bg-purple-200"><User className="text-purple-600 w-6 h-6" /></div>
                <div className="text-left"><div className="font-bold text-slate-700">Buyer Login</div><div className="text-xs text-slate-400">Check for your packages</div></div>
                <ChevronRight className="ml-auto text-slate-300 group-hover:text-purple-500" />
              </button>
              <button onClick={() => setLoginMode('admin')} className="w-full flex items-center p-4 bg-white border-2 border-slate-100 rounded-xl hover:border-slate-800 hover:bg-slate-50 transition-all group">
                <div className="bg-slate-100 p-2 rounded-lg mr-4 group-hover:bg-slate-200"><ShieldCheck className="text-slate-600 w-6 h-6" /></div>
                <div className="text-left"><div className="font-bold text-slate-700">Admin</div><div className="text-xs text-slate-400">Manage center</div></div>
              </button>
            </div>
          )}

          {loginMode === 'admin' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Admin Access</h2>
              <input type="password" placeholder="Enter PIN" value={loginInputPass} onChange={(e) => setLoginInputPass(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none text-center tracking-widest text-xl" />
              {loginError && <p className="text-red-500 text-sm mb-4 text-center">{loginError}</p>}
              <button onClick={handleAdminLogin} className="w-full bg-purple-800 text-white py-3 rounded-lg font-semibold hover:bg-purple-900 mb-3">Login</button>
              <button onClick={() => { setLoginMode('menu'); setLoginError(''); }} className="w-full text-slate-500 text-sm hover:underline">Back</button>
            </div>
          )}

          {loginMode === 'seller' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-2">Seller Login</h2>
              <div className="space-y-3">
                <input type="text" placeholder="Shop Name / Username" value={loginInputName} onChange={(e) => setLoginInputName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
                <input type="password" placeholder="Password" value={loginInputPass} onChange={(e) => setLoginInputPass(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
              </div>
              {loginError && <p className="text-red-500 text-sm mt-3 text-center">{loginError}</p>}
              <button onClick={handleSellerLogin} className="w-full bg-pink-600 text-white py-3 rounded-lg font-semibold hover:bg-pink-700 mt-4 mb-2 shadow-md shadow-pink-200">Login</button>
              <div className="text-center mb-4"><p className="text-xs text-slate-400">Don't have an account? Please contact Admin.</p></div>
              <button onClick={() => { setLoginMode('menu'); setLoginError(''); }} className="w-full text-slate-500 text-sm hover:underline">Back to Menu</button>
            </div>
          )}

          {loginMode === 'buyer' && (
            <div className="animate-in slide-in-from-right fade-in duration-300">
              <h2 className="text-lg font-bold text-slate-800 mb-4">Buyer Access</h2>
              <input type="text" placeholder="Enter your Name or Town" value={loginInputName} onChange={(e) => setLoginInputName(e.target.value)} className="w-full px-4 py-3 border border-slate-300 rounded-lg mb-4 focus:ring-2 focus:ring-purple-500 outline-none" />
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
    <div className="min-h-screen bg-fuchsia-50 pb-20">

      {/* Navbar */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <img src="/logo.png" alt="Logo" className="w-8 h-8 object-contain" />
              <div>
                <h1 className="text-xl font-bold text-slate-800 hidden sm:block">{APP_NAME}</h1>
                <h1 className="text-xl font-bold text-slate-800 sm:hidden">KishDBSoria App</h1>
                <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${role === 'admin' ? 'bg-purple-800 text-white' : role === 'seller' ? 'bg-pink-100 text-pink-800' : 'bg-purple-100 text-purple-800'}`}>{role}</span>
                    <span className="text-xs text-slate-500">{userName}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
                {/* NEW: USER MANAGEMENT BUTTON (Admin Only) */}
                {role === 'admin' && (
                    <button 
                        onClick={() => setIsUserMgmtOpen(true)}
                        className="p-2 rounded-lg text-slate-600 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                        title="Manage Users"
                    >
                        <Users className="w-5 h-5" />
                    </button>
                )}

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
            <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100"><div className="text-pink-500 text-xs font-semibold uppercase">Ready to Pickup</div><div className="text-2xl font-bold text-pink-600">{stats.dropped}</div></div>
            <div className="bg-white p-4 rounded-xl shadow-sm border border-purple-100"><div className="text-purple-500 text-xs font-semibold uppercase">Claimed (Unpaid)</div><div className="text-2xl font-bold text-purple-600">{stats.claimed}</div></div>
            
            {/* NEW DROP BUTTON: ADMIN ONLY NOW */}
            {role === 'admin' && (
              <div className="bg-pink-50 p-4 rounded-xl shadow-sm border border-pink-200 flex items-center justify-between">
                <div><div className="text-pink-700 text-xs font-semibold uppercase">New Drop</div><div className="text-xs text-pink-600">Add package</div></div>
                <button onClick={() => setIsFormOpen(true)} className="bg-pink-600 text-white p-2 rounded-lg hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"><Plus className="w-5 h-5" /></button>
              </div>
            )}

            {/* SELLER BALANCE CARD */}
            {role === 'seller' && (
              <div className="bg-emerald-50 p-4 rounded-xl shadow-sm border border-emerald-200">
                <div className="text-emerald-700 text-xs font-semibold uppercase">Available for Cash Out</div>
                <div className="text-2xl font-bold text-emerald-600">₱{stats.balance.toLocaleString()}</div>
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-pink-100 mb-6 flex flex-col gap-4">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
                    <input type="text" placeholder={role === 'seller' ? "Search my items..." : (role === 'buyer' ? "Type YOUR NAME or TOWN..." : "Search items, buyers, or sellers...")} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"/>
                </div>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    {role === 'admin' && selectedItems.size > 0 && (
                        <div className="flex gap-2">
                           {/* EXPORT BUTTON (Green) */}
                           <button 
                             onClick={handleExportCSV} 
                             className="px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap bg-green-100 text-green-700 hover:bg-green-200 flex items-center gap-2 animate-in fade-in slide-in-from-right-5"
                           >
                              <FileDown className="w-4 h-4" /> Export ({selectedItems.size})
                           </button>
                           
                           {/* DELETE BUTTON (Red) */}
                           <button onClick={handleMassDelete} className="px-4 py-2 rounded-lg text-sm font-bold whitespace-nowrap bg-red-100 text-red-600 hover:bg-red-200 flex items-center gap-2 animate-in fade-in slide-in-from-right-5"><Trash2 className="w-4 h-4" /> Delete ({selectedItems.size})</button>
                        </div>
                    )}
                    <button onClick={() => setStatusFilter('all')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'all' ? 'bg-purple-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>All Active</button>
                    <button onClick={() => setStatusFilter('dropped')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'dropped' ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-700 hover:bg-pink-100'}`}>Ready</button>
                    <button onClick={() => setStatusFilter('claimed')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${statusFilter === 'claimed' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100'}`}>Claimed</button>
                    {(role === 'admin' || role === 'seller') && (
                        <button onClick={() => setStatusFilter('cashed_out')} className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap flex items-center gap-1 ${statusFilter === 'cashed_out' ? 'bg-slate-700 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>{role === 'seller' ? <History className="w-3 h-3" /> : <Archive className="w-3 h-3" />} {role === 'seller' ? 'My History' : 'Archive'}</button>
                    )}
                </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-center border-t border-slate-100 pt-4">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                   <ListFilter className="w-4 h-4" />
                   <span className="hidden sm:inline">Sort By:</span>
                   <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pink-500">
                      <option value="date">Date Added</option>
                      <option value="name">Item Name</option>
                      <option value="location">Location</option>
                   </select>
                   <button onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')} className="p-1 hover:bg-slate-100 rounded" title={sortOrder === 'asc' ? "Ascending (A-Z)" : "Descending (Z-A)"}>
                      <ArrowUpDown className="w-4 h-4" />
                   </button>
                </div>

                <div className="flex items-center gap-4">
                   <div className="text-sm text-slate-500 flex items-center gap-2">
                      <span>Show:</span>
                      <select value={itemsPerPage} onChange={(e) => setItemsPerPage(Number(e.target.value))} className="bg-slate-50 border border-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-pink-500">
                         <option value="5">5</option>
                         <option value="10">10</option>
                         <option value="20">20</option>
                         <option value="50">50</option>
                      </select>
                   </div>
                </div>
            </div>
        </div>

        {/* LIST VIEW */}
        <div className="bg-white rounded-xl shadow-sm border border-pink-100 overflow-hidden mb-6">
          <div className="hidden md:grid grid-cols-8 gap-4 p-4 bg-fuchsia-50/50 border-b border-pink-100 text-xs font-semibold text-purple-800 uppercase tracking-wider items-center">
            <div className="col-span-1">{role === 'admin' && <input type="checkbox" onChange={handleSelectAll} className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"/>}</div>
            <div className="col-span-1">Date</div><div className="col-span-2">Item</div><div className="col-span-1">Location</div><div className="col-span-1">Buyer</div><div className="col-span-1">Seller</div><div className="col-span-1 text-right">Status</div>
          </div>

          <div className="divide-y divide-pink-50">
            {paginatedItems.map((item) => (
              <div 
                key={item.id} 
                className={`group hover:bg-fuchsia-50 transition-colors ${role === 'admin' ? 'cursor-pointer' : ''}`}
                onClick={() => role === 'admin' && handleEditClick(item)}
              >
                <div className="hidden md:grid grid-cols-8 gap-4 p-4 items-center">
                  <div className="col-span-1">{role === 'admin' && <input type="checkbox" checked={selectedItems.has(item.id)} onClick={(e) => e.stopPropagation()} onChange={() => handleSelectItem(item.id)} className="w-4 h-4 text-pink-600 rounded border-gray-300 focus:ring-pink-500"/>}</div>
                  <div className="col-span-1 text-sm text-slate-500">{formatDate(item.createdAt)}<div className="text-xs text-slate-400">{item.createdAt.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div></div>
                  <div className="col-span-2"><div className="text-sm font-medium text-slate-800">{item.itemName}</div>{role !== 'buyer' && <div><div className={`text-xs ${item.isPaidExternally ? 'text-gray-400 line-through' : 'text-slate-500'}`}>{item.isPaidExternally ? `(${item.price})` : `Price: ${item.price}`}</div>{item.transferFee && item.transferFee !== '0' && <div className="text-xs text-pink-500">Fee: {item.transferFee}</div>}</div>}</div>
                  <div className="col-span-1 text-sm text-slate-600 flex items-center gap-1"><MapPin className="w-3 h-3 text-slate-400" /> {item.location || '-'}</div>
                  <div className="col-span-1 text-sm text-slate-600">{item.buyerName}</div>
                  <div className="col-span-1 text-sm text-slate-600">{item.sellerName}</div>
                  <div className="col-span-1 text-right flex items-center justify-end gap-2">
                    {role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleEditClick(item); }} className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Edit Item"><Pencil className="w-4 h-4" /></button>}
                    {item.status === 'dropped' ? (
                      <><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">Ready</span>
                        {role === 'admin' && (
                            <div className="flex gap-1">
                              <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'claimed'); }} className="p-1 hover:bg-purple-100 rounded text-purple-600" title="Admin: Mark Claimed"><CheckCircle2 className="w-5 h-5" /></button>
                              <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'pulled_out'); }} className="p-1 hover:bg-orange-100 rounded text-orange-600" title="Admin: Pull Out Item"><PackageMinus className="w-5 h-5" /></button>
                            </div>
                        )}
                      </>) : item.status === 'claimed' ? (
                      <div className="flex flex-col items-end"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Claimed</span>{item.claimedAt && <span className="text-[10px] text-slate-400 mt-1 flex items-center gap-1"><CalendarCheck className="w-3 h-3" /> {formatDate(item.claimedAt)}</span>}{role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'dropped'); }} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline mt-1 flex items-center gap-1" title="Undo / Revert to Ready"><RotateCcw className="w-3 h-3" /> Undo</button>}</div>
                    ) : item.status === 'pulled_out' ? (
                        <div className="flex flex-col items-end"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pulled Out</span>{role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'dropped'); }} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline mt-1 flex items-center gap-1" title="Undo / Revert to Ready"><RotateCcw className="w-3 h-3" /> Undo</button>}</div>
                    ) : item.status === 'cashed_out' ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Cashed Out</span>) : (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800">Cancelled</span>)}
                  </div>
                </div>
                <div 
                  className={`md:hidden p-4 flex gap-3 ${role === 'admin' ? 'cursor-pointer' : ''}`}
                  onClick={() => role === 'admin' && handleEditClick(item)}
                >
                   {role === 'admin' && <div className="pt-1"><input type="checkbox" checked={selectedItems.has(item.id)} onClick={(e) => e.stopPropagation()} onChange={() => handleSelectItem(item.id)} className="w-5 h-5 text-pink-600 rounded border-gray-300 focus:ring-pink-500"/></div>}
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                        <div><h4 className="font-semibold text-slate-800">{item.itemName}</h4><p className="text-sm text-slate-500">Buyer: <span className="text-slate-700 font-medium">{item.buyerName}</span></p></div>
                        {item.status === 'dropped' ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">Ready</span>) : item.status === 'claimed' ? (<div className="text-right"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">Claimed</span>{item.claimedAt && <div className="text-[10px] text-slate-400 mt-1">{formatDate(item.claimedAt)}</div>}{role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'dropped'); }} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline mt-1 flex items-center justify-end gap-1 w-full"><RotateCcw className="w-3 h-3" /> Undo</button>}</div>) : item.status === 'pulled_out' ? (<div className="text-right"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">Pulled Out</span>{role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'dropped'); }} className="text-[10px] text-slate-400 hover:text-red-500 hover:underline mt-1 flex items-center justify-end gap-1 w-full"><RotateCcw className="w-3 h-3" /> Undo</button>}</div>) : item.status === 'cashed_out' ? (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">Done</span>) : (<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-800">Cancelled</span>)}
                    </div>
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="text-xs text-slate-500 flex items-center gap-1"><User className="w-3 h-3" /> Seller: {item.sellerName}</div>
                        <div className="text-xs text-slate-500 flex items-center gap-1"><MapPin className="w-3 h-3" /> {item.location || '-'}</div>
                    </div>
                    <div className="flex justify-between items-end border-t border-pink-50 pt-2">
                        <div className="text-xs text-slate-400">{formatDate(item.createdAt)}</div>
                        <div className="flex items-center gap-2">
                        {role === 'admin' && <button onClick={(e) => { e.stopPropagation(); handleEditClick(item); }} className="p-1 mr-2 text-slate-400"><Pencil className="w-4 h-4" /></button>}
                        {role !== 'buyer' && (<div className="text-right mr-2"><span className={`text-sm font-semibold ${item.isPaidExternally ? 'text-gray-400 line-through' : 'text-purple-700'}`}>{item.isPaidExternally ? `(₱${item.price})` : `₱${item.price}`}</span>{item.transferFee && item.transferFee !== '0' && <div className="text-[10px] text-pink-500">Fee: {item.transferFee}</div>}</div>)}
                        {item.status === 'dropped' && role === 'admin' && (<div className="flex gap-2"><button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'claimed'); }} className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-purple-700">Mark Claimed</button><button onClick={(e) => { e.stopPropagation(); handleStatusChange(item.id, 'pulled_out'); }} className="bg-orange-100 text-orange-600 px-2 py-1.5 rounded-lg text-xs font-medium hover:bg-orange-200"><PackageMinus className="w-4 h-4" /></button></div>)}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredItems.length === 0 && (
              <div className="p-12 text-center text-slate-400">{role === 'buyer' && !searchTerm ? (<><Search className="w-12 h-12 mx-auto mb-3 opacity-20 text-pink-400" /><p className="font-semibold text-purple-700">Enter your name above</p><p className="text-sm text-pink-500">Type your name to find your packages.</p></>) : (<><Package className="w-12 h-12 mx-auto mb-3 opacity-20 text-pink-400" /><p className="text-pink-500">No items found.</p></>)}</div>
            )}
          </div>
        </div>

        {/* PAGINATION CONTROLS */}
        {sortedItems.length > itemsPerPage && (
            <div className="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-pink-100">
                <button 
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-purple-700"
                >
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <span className="text-sm text-slate-600 font-medium">Page {currentPage} of {totalPages}</span>
                <button 
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-purple-700"
                >
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>
        )}
      </main>

      {/* --- MODAL: DROP ITEM (ADMIN ONLY NOW) --- */}
      {isFormOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-slate-800">Drop New Item</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-400 hover:text-pink-600"><XCircle className="w-6 h-6" /></button>
            </div>
            
            {/* SUCCESS MESSAGE (RAPID ENTRY) */}
            {showSuccessMsg && (
                <div className="mb-4 bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                    <Check className="w-4 h-4" /> Item added successfully!
                </div>
            )}

            <form onSubmit={handleAddItem} className="space-y-4">
              
              {/* NEW: SELLER SELECTION (ADMIN ONLY) */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Select Seller</label>
                <select 
                  value={newItemSeller}
                  onChange={(e) => setNewItemSeller(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none bg-white"
                >
                  <option value="">-- Choose Seller --</option>
                  {sellerList.map(seller => (
                    <option key={seller.id} value={seller.displayName}>{seller.displayName}</option>
                  ))}
                </select>
              </div>

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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transfer Fee</label>
                    <input type="text" placeholder="e.g. 10" value={newItemTransferFee} onChange={(e) => setNewItemTransferFee(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-pink-500 outline-none" />
                  </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Location</label>
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
              
              <div className="flex gap-2">
                  <button type="submit" className="flex-1 py-3 bg-pink-600 text-white rounded-lg font-semibold hover:bg-pink-700 shadow-md shadow-pink-200">Confirm Drop</button>
                  <button type="button" onClick={() => setIsFormOpen(false)} className="px-4 py-3 bg-slate-100 text-slate-600 rounded-lg font-semibold hover:bg-slate-200">Done / Close</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL: EDIT ITEM --- */}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Transfer Fee</label>
                    <input 
                      type="text" 
                      value={editingItem.transferFee || '0'} 
                      onChange={(e) => setEditingItem({...editingItem, transferFee: e.target.value})} 
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 outline-none" 
                    />
                  </div>
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

      {/* --- MODAL: USER MANAGEMENT (ADMIN ONLY) --- */}
      {isUserMgmtOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl my-8">
            <div className="p-6 border-b border-pink-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Users className="text-purple-800 w-6 h-6" />
                    <div>
                      <h3 className="text-xl font-bold text-slate-800">Manage Users</h3>
                      <p className="text-sm text-slate-500">Reset passwords or remove inactive sellers</p>
                    </div>
                </div>
                <button onClick={() => setIsUserMgmtOpen(false)} className="text-slate-400 hover:text-pink-600"><XCircle className="w-6 h-6" /></button>
            </div>

            {/* NEW: ADD SELLER FORM INSIDE MODAL */}
            <div className="p-6 bg-pink-50 border-b border-pink-100">
               <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
                  <UserPlus className="w-4 h-4" /> Add New Seller
               </h4>
               <form onSubmit={handleCreateUser} className="flex flex-col sm:flex-row gap-3">
                  <input 
                    type="text" 
                    placeholder="Shop Name" 
                    value={newSellerName}
                    onChange={(e) => setNewSellerName(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <input 
                    type="text" 
                    placeholder="Initial Password" 
                    value={newSellerPass}
                    onChange={(e) => setNewSellerPass(e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                  <button 
                    type="submit"
                    className="bg-purple-800 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-purple-900 transition-colors"
                  >
                    Add Seller
                  </button>
               </form>
            </div>

            <div className="p-6">
               <div className="text-xs font-semibold text-slate-400 uppercase mb-3">Registered Sellers</div>
               <div className="space-y-2">
                   {sellerList.length === 0 ? (
                       <div className="text-center py-10 text-slate-400">No sellers found.</div>
                   ) : (
                       sellerList.map((seller) => (
                           <div 
                             key={seller.id} 
                             className="w-full flex justify-between items-center p-4 bg-white hover:bg-pink-50 rounded-xl border border-pink-100 transition-colors group"
                           >
                               <div className="flex items-center gap-3">
                                   <div className="bg-pink-100 p-2 rounded-full text-pink-600 font-bold w-10 h-10 flex items-center justify-center group-hover:bg-pink-200">
                                      <User className="w-5 h-5" />
                                   </div>
                                   <div className="text-left">
                                       <div className="font-bold text-slate-800">{seller.displayName}</div>
                                       <div className="text-xs text-slate-500">ID: {seller.id}</div>
                                   </div>
                               </div>
                               
                               <div className="flex items-center gap-2">
                                  <button 
                                    onClick={() => handleResetPassword(seller.id, seller.displayName)}
                                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    title="Reset Password"
                                  >
                                    <KeyRound className="w-5 h-5" />
                                  </button>
                                  <button 
                                    onClick={() => handleDeleteUser(seller.id, seller.displayName)}
                                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    title="Remove Access"
                                  >
                                    <Trash2 className="w-5 h-5" />
                                  </button>
                               </div>
                           </div>
                       ))
                   )}
               </div>
            </div>
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
                   <div className="flex items-center gap-4 mb-4">
                     <div className="relative flex-1">
                       <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                       <input 
                         type="text" 
                         placeholder="Search seller..." 
                         value={cashOutSearchTerm}
                         onChange={(e) => setCashOutSearchTerm(e.target.value)}
                         className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                       />
                     </div>
                   </div>
                   
                   <div className="space-y-2">
                       {paginatedCashOutSellers.length === 0 ? (
                           <div className="text-center py-10 text-slate-400">No pending balances found.</div>
                       ) : (
                           paginatedCashOutSellers.map((seller, idx) => (
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

                   {/* Cash Out Pagination */}
                   {filteredCashOutSellers.length > CASH_OUT_ITEMS_PER_PAGE && (
                      <div className="flex justify-between items-center mt-4 pt-4 border-t border-slate-100">
                        <button 
                          onClick={() => setCashOutPage(p => Math.max(1, p - 1))}
                          disabled={cashOutPage === 1}
                          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-purple-700"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                        <span className="text-xs text-slate-500 font-medium">Page {cashOutPage} of {totalCashOutPages}</span>
                        <button 
                          onClick={() => setCashOutPage(p => Math.min(totalCashOutPages, p + 1))}
                          disabled={cashOutPage === totalCashOutPages}
                          className="p-2 rounded-lg hover:bg-slate-100 disabled:opacity-50 disabled:cursor-not-allowed text-purple-700"
                        >
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                   )}
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
                            <tr className="border-b-2 border-pink-100 text-left"><th className="py-2 text-slate-500">Item</th><th className="py-2 text-slate-500">Buyer</th><th className="py-2 text-slate-500 text-right">Fee</th><th className="py-2 text-slate-500 text-right">Price</th></tr>
                        </thead>
                        <tbody className="divide-y divide-pink-50">
                            {selectedSellerForCashout.items.map(item => (
                                <tr key={item.id}>
                                    <td className="py-2 text-slate-700">{item.itemName}</td>
                                    <td className="py-2 text-slate-500">{item.buyerName}</td>
                                    <td className="py-2 text-right text-pink-500 text-xs">{item.transferFee}</td>
                                    <td className="py-2 text-right font-medium text-purple-700">
                                        {item.isPaidExternally ? <span className="text-gray-400 line-through decoration-double">({item.price})</span> : `₱${item.price}`}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-2 border-slate-800">
                                <td colSpan="3" className="py-4 font-bold text-slate-800 text-right pr-4">TOTAL PAYOUT:</td>
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
