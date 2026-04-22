'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Gamepad2, Users, UserPlus, LogOut, X } from 'lucide-react';
import { auth, db } from '../lib/firebase';
import { signInAnonymously, signOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [inputName, setInputName] = useState('');
  const [coins, setCoins] = useState<number>(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  
  // Room form states
  const [formKelas, setFormKelas] = useState(3);
  const [formJumlahSoal, setFormJumlahSoal] = useState(10);
  const [joinCode, setJoinCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in, listen to their player document
        const playerRef = doc(db, 'players', user.uid);
        
        const unsubscribeDoc = onSnapshot(playerRef, (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data();
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setPlayerName(data.playerName);
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCoins(data.coins);
          } else {
            // Document doesn't exist, might be a stale anonymous auth session without player data
            // We can just sign out to clear it
            signOut(auth);
          }
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setIsLoaded(true);
        }, (err) => {
          console.error("Firestore error:", err);
          signOut(auth);
          // eslint-disable-next-line react-hooks/set-state-in-effect
          setIsLoaded(true);
        });

        return () => unsubscribeDoc();
      } else {
        // No user signed in
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setPlayerName(null);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCoins(0);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setIsLoaded(true);
      }
    });

    return () => unsubscribeAuth();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputName.trim() || isLoading) return;

    setIsLoading(true);
    const newName = inputName.trim();

    try {
      // Create Anonymous Auth Account
      const userCredential = await signInAnonymously(auth);
      const uid = userCredential.user.uid;
      
      // Save Player data to Firestore
      await setDoc(doc(db, 'players', uid), {
        playerName: newName,
        coins: 0,
        uid: uid,
        updatedAt: serverTimestamp()
      });
      
      // onSnapshot will handle setting local state automatically
    } catch (error) {
      console.error("Error signing in or saving data:", error);
      alert("Uh oh! Pastikan Anonymous Sign-In sudah diaktifkan di Firebase Console.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Single Player Variables
  const [showSinglePlayerModal, setShowSinglePlayerModal] = useState(false);
  const [singleKelas, setSingleKelas] = useState(1);
  const [singleJumlahSoal, setSingleJumlahSoal] = useState(10);

  const handleStartSinglePlayer = (e: React.FormEvent) => {
     e.preventDefault();
     router.push(`/singleplayer?kelas=${singleKelas}&jumlahSoal=${singleJumlahSoal}`);
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isConnecting || !auth.currentUser || !playerName) return;

    setIsConnecting(true);
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    let code = '';
    for (let i = 0; i < 4; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    const uid = auth.currentUser.uid;
    const roomRef = doc(db, 'rooms', code);

    // Initial player object for the host
    const hostPlayer = {
      uid: uid,
      name: playerName,
      progress: 0,
      score: 0,
      isFinished: false,
      finishTime: null,
      isReady: false
    };

    try {
      await setDoc(roomRef, {
        roomCode: code,
        hostId: uid,
        status: 'waiting',
        settings: {
          kelas: formKelas,
          jumlahSoal: formJumlahSoal
        },
        players: [hostPlayer],
        questions: [],
        startTime: null,
        gameStartAtUnix: null
      });

      router.push(`/room/${code}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("Gagal membuat room. Periksa koneksi.");
      setIsConnecting(false);
    }
  };

  const handleJoinRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.toUpperCase().trim();
    if (isConnecting || !auth.currentUser || !playerName || code.length !== 4) return;

    setIsConnecting(true);
    const uid = auth.currentUser.uid;
    const roomRef = doc(db, 'rooms', code);

    try {
      const roomSnap = await getDoc(roomRef);
      if (!roomSnap.exists()) {
        alert("Room Code tidak ditemukan!");
        setIsConnecting(false);
        return;
      }

      const roomData = roomSnap.data();
      if (roomData.status !== 'waiting') {
        alert("Maaf, room ini sudah dimulai atau sudah selesai.");
        setIsConnecting(false);
        return;
      }

      // Check if already in room to prevent array union issues or duplicates
      const isAlreadyIn = roomData.players?.some((p: any) => p.uid === uid);
      
      if (!isAlreadyIn) {
        if (roomData.players?.length >= 6) {
          alert("Room penuh! Maksimal 6 pemain.");
          setIsConnecting(false);
          return;
        }

        const newPlayer = {
          uid: uid,
          name: playerName,
          progress: 0,
          score: 0,
          isFinished: false,
          finishTime: null,
          isReady: false
        };

        await updateDoc(roomRef, {
          players: arrayUnion(newPlayer)
        });
      }

      router.push(`/room/${code}`);
    } catch (error) {
      console.error("Error joining room:", error);
      alert("Gagal masuk room. Periksa koneksi.");
      setIsConnecting(false);
    }
  };

  // Ensure content doesn't render mismatched initial server HTML by waiting for client-side load
  if (!isLoaded) return null;

  if (!playerName) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, type: 'spring', bounce: 0.4 }}
          className="bg-white border-4 border-slate-900 rounded-[28px] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#0f172a]"
        >
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center text-white font-black text-3xl shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4)]">
              EQ
            </div>
          </div>
          
          <h1 className="text-4xl font-black text-center text-slate-900 mb-2 uppercase tracking-tighter leading-none">Mulai<br/><span className="text-indigo-600">Main</span></h1>
          <p className="text-center text-[11px] font-black tracking-[0.2em] uppercase text-slate-400 mb-8 mt-4">Masukkan Nama Kamu</p>
          
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <input
                type="text"
                maxLength={15}
                value={inputName}
                onChange={(e) => setInputName(e.target.value)}
                placeholder="NAMA PLAYER"
                className="w-full px-5 py-4 rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-lg font-black text-slate-900 uppercase tracking-wide placeholder-slate-300"
                required
              />
            </div>
            <motion.button
              whileHover={isLoading ? {} : { x: -2, y: -2, boxShadow: "10px 10px 0px 0px #0f172a" }}
              whileTap={isLoading ? {} : { scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
              type="submit"
              disabled={isLoading}
              className={`w-full py-4 rounded-xl border-4 border-slate-900 text-white font-black text-xl shadow-[8px_8px_0px_0px_#0f172a] uppercase tracking-wider transition-all ${isLoading ? 'bg-slate-500 cursor-not-allowed opacity-80' : 'bg-indigo-600'}`}
            >
              {isLoading ? "Menghubungkan..." : "Gas Main"}
            </motion.button>
          </form>
        </motion.div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center overflow-x-hidden">
      {/* Header */}
      <header className="w-full max-w-5xl px-4 md:px-6 pt-8 md:pt-12 pb-4 flex justify-between items-center text-slate-900 relative z-10 gap-2">
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-2 md:gap-4 shrink-0"
        >
          <div className="w-12 h-12 md:w-16 md:h-16 bg-indigo-600 rounded-xl md:rounded-3xl flex items-center justify-center text-white font-black text-xl md:text-3xl shadow-[0_8px_20px_-4px_rgba(79,70,229,0.4)] tracking-tighter">EQ</div>
          <div className="hidden sm:block">
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter uppercase text-slate-900 leading-none">EduQuest</h1>
            <p className="text-[9px] md:text-[10px] font-black tracking-[0.3em] uppercase text-indigo-500 mt-1 md:mt-1.5">Arena Belajar & Main</p>
          </div>
        </motion.div>

        <div className="flex items-center gap-2 md:gap-4 shrink-0">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 md:gap-3 bg-white border-2 md:border-4 border-slate-900 p-1 md:p-2 pr-3 md:pr-6 rounded-full shadow-[2px_2px_0px_0px_#0f172a] md:shadow-[4px_4px_0px_0px_#0f172a]"
          >
            <div className="w-8 h-8 md:w-12 md:h-12 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-full border-2 border-slate-900 flex items-center justify-center text-white font-black text-sm md:text-xl shrink-0">
              {playerName?.charAt(0).toUpperCase()}
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] md:text-sm font-black uppercase text-slate-900 truncate max-w-[50px] sm:max-w-[80px] md:max-w-[120px]">{playerName}</span>
              <div className="flex items-center gap-1 mt-0">
                <span className="text-amber-500 drop-shadow-sm text-[10px] md:text-base">🪙</span>
                <span className="text-[8px] md:text-xs font-black text-slate-500 tracking-tighter uppercase leading-none">{coins} Koin</span>
              </div>
            </div>
          </motion.div>

          <button 
            onClick={handleLogout}
            className="w-10 h-10 md:w-12 md:h-12 flex-shrink-0 bg-white border-2 md:border-4 border-slate-900 rounded-full shadow-[2px_2px_0px_0px_#0f172a] md:shadow-[4px_4px_0px_0px_#0f172a] flex items-center justify-center text-slate-900 hover:translate-y-1 hover:translate-x-1 hover:shadow-none transition-all active:translate-y-1 active:translate-x-1"
            title="Keluar"
          >
            <LogOut className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} />
          </button>
        </div>
      </header>

      {/* Main Menu Content */}
      <div className="flex-1 w-full max-w-5xl px-6 flex flex-col justify-center pb-20 md:-mt-8 z-10 relative">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, type: "spring" }}
          className="space-y-12 md:space-y-16 w-full mt-10 md:mt-16"
        >
          <div className="text-center">
            <span className="inline-block py-1.5 md:py-2 px-4 md:px-6 bg-amber-100 text-amber-700 rounded-full text-[10px] md:text-xs font-black tracking-widest uppercase mb-4 md:mb-6 border-2 border-amber-200 shadow-sm">Selamat Datang Kembali</span>
            <h2 className="text-6xl md:text-[100px] font-black leading-[0.85] tracking-tighter text-slate-900 uppercase">Mainkan<br/><span className="text-indigo-600">Sekarang</span></h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 w-full max-w-5xl mx-auto">
            <MenuButton 
              icon="🕹️"
              title={<>Single<br className="hidden md:block" /> Player</>}
              subtitle="Latihan Mandiri"
              onClick={() => setShowSinglePlayerModal(true)}
              delay={0.1}
              hoverClass="hover:bg-emerald-50"
              iconClass="bg-emerald-100"
            />
            
            <MenuButton 
              icon="👑"
              title={<>Buat<br className="hidden md:block" /> Room</>}
              subtitle="Host Multiplayer"
              onClick={() => setShowCreateModal(true)}
              delay={0.2}
              hoverClass="hover:bg-blue-50"
              iconClass="bg-blue-100"
            />
            
            <MenuButton 
              icon="⚔️"
              title={<>Join<br className="hidden md:block" /> Room</>}
              subtitle="Cari Teman Lawan"
              onClick={() => setShowJoinModal(true)}
              delay={0.3}
              hoverClass="hover:bg-rose-50"
              iconClass="bg-rose-100"
            />
          </div>
        </motion.div>
      </div>
      
      <div className="absolute top-[10%] right-0 p-12 opacity-[0.03] pointer-events-none select-none overflow-hidden hidden lg:block z-0">
        <div className="text-[280px] font-black leading-none text-slate-900 tracking-tighter">QUEST</div>
      </div>
      
      <footer className="w-full max-w-5xl px-6 pb-8 md:pb-12 flex justify-between items-end border-t-4 border-slate-900/10 pt-8 mt-auto z-10 hidden md:flex">
        <div className="space-y-1.5">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Build 1.0.4-STABLE</p>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-300">&copy; 2024 EDUQUEST INTERACTIVE</p>
        </div>
        <div className="flex gap-12">
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Peringkat Global</p>
            <p className="text-2xl font-black text-indigo-600">#452</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Kemenangan</p>
            <p className="text-2xl font-black text-emerald-600 tracking-tighter">24</p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showSinglePlayerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
             <motion.div 
               initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
               className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
               onClick={() => setShowSinglePlayerModal(false)}
             />
             <motion.div 
               initial={{ scale: 0.9, opacity: 0, y: 20 }}
               animate={{ scale: 1, opacity: 1, y: 0 }}
               exit={{ scale: 0.9, opacity: 0, y: 20 }}
               className="bg-white border-4 border-slate-900 rounded-[28px] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#0f172a] relative z-10"
             >
               <button 
                 onClick={() => setShowSinglePlayerModal(false)}
                 className="absolute top-4 right-4 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
               >
                 <X size={20} strokeWidth={3} className="text-slate-900" />
               </button>

               <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-6">Mulai Sendiri</h2>

               <form onSubmit={handleStartSinglePlayer} className="space-y-6">
                 <div>
                   <label className="block text-[11px] font-black tracking-widest uppercase text-slate-500 mb-2">Pilih Kelas</label>
                   <select 
                     value={singleKelas} 
                     onChange={(e) => setSingleKelas(Number(e.target.value))}
                     className="w-full px-5 py-4 rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-lg font-black text-slate-900 uppercase tracking-wide appearance-none cursor-pointer"
                   >
                     {[1, 2, 3, 4, 5, 6].map(k => (
                       <option key={k} value={k}>Kelas {k} SD</option>
                     ))}
                   </select>
                 </div>
                 
                 <div>
                   <label className="block text-[11px] font-black tracking-widest uppercase text-slate-500 mb-2">Jumlah Soal</label>
                   <select 
                     value={singleJumlahSoal} 
                     onChange={(e) => setSingleJumlahSoal(Number(e.target.value))}
                     className="w-full px-5 py-4 rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-emerald-500/20 text-lg font-black text-slate-900 uppercase tracking-wide appearance-none cursor-pointer"
                   >
                     <option value={10}>10 Soal</option>
                     <option value={20}>20 Soal</option>
                     <option value={30}>30 Soal</option>
                     <option value={50}>50 Soal</option>
                   </select>
                 </div>

                 <motion.button
                   whileHover={{ x: -2, y: -2, boxShadow: "10px 10px 0px 0px #0f172a" }}
                   whileTap={{ scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
                   type="submit"
                   className="w-full mt-4 py-4 rounded-xl border-4 border-slate-900 text-white font-black text-xl shadow-[8px_8px_0px_0px_#0f172a] uppercase tracking-wider transition-all bg-emerald-500"
                 >
                   Gaskan!
                 </motion.button>
               </form>
             </motion.div>
          </div>
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowCreateModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white border-4 border-slate-900 rounded-[28px] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#0f172a] relative z-10"
            >
              <button 
                onClick={() => setShowCreateModal(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={20} strokeWidth={3} className="text-slate-900" />
              </button>
              
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-6">Buat Room</h2>
              
              <form onSubmit={handleCreateRoom} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black tracking-widest uppercase text-slate-500 mb-2">Pilih Kelas</label>
                  <select 
                    value={formKelas} 
                    onChange={(e) => setFormKelas(Number(e.target.value))}
                    className="w-full px-5 py-4 rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-lg font-black text-slate-900 uppercase tracking-wide appearance-none cursor-pointer"
                  >
                    {[1, 2, 3, 4, 5, 6].map(kelas => (
                      <option key={kelas} value={kelas}>Kelas {kelas} SD</option>
                    ))}
                  </select>
                </div>
                
                <div>
                  <label className="block text-[11px] font-black tracking-widest uppercase text-slate-500 mb-2">Jumlah Soal</label>
                  <select 
                    value={formJumlahSoal} 
                    onChange={(e) => setFormJumlahSoal(Number(e.target.value))}
                    className="w-full px-5 py-4 rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/20 text-lg font-black text-slate-900 uppercase tracking-wide appearance-none cursor-pointer"
                  >
                    <option value={10}>10 Soal</option>
                    <option value={20}>20 Soal</option>
                    <option value={30}>30 Soal</option>
                    <option value={50}>50 Soal</option>
                  </select>
                </div>

                <motion.button
                  whileHover={isConnecting ? {} : { x: -2, y: -2, boxShadow: "10px 10px 0px 0px #0f172a" }}
                  whileTap={isConnecting ? {} : { scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
                  type="submit"
                  disabled={isConnecting}
                  className={`w-full mt-4 py-4 rounded-xl border-4 border-slate-900 text-white font-black text-xl shadow-[8px_8px_0px_0px_#0f172a] uppercase tracking-wider transition-all ${isConnecting ? 'bg-slate-500 cursor-not-allowed opacity-80' : 'bg-blue-600'}`}
                >
                  {isConnecting ? "Membangun..." : "Buat Room"}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}

        {showJoinModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setShowJoinModal(false)}
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="bg-white border-4 border-slate-900 rounded-[28px] p-8 max-w-md w-full shadow-[8px_8px_0px_0px_#0f172a] relative z-10"
            >
              <button 
                onClick={() => setShowJoinModal(false)}
                className="absolute top-4 right-4 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center hover:bg-slate-200 transition-colors"
              >
                <X size={20} strokeWidth={3} className="text-slate-900" />
              </button>
              
              <h2 className="text-3xl font-black uppercase tracking-tighter text-slate-900 mb-6">Join Room</h2>
              
              <form onSubmit={handleJoinRoom} className="space-y-6">
                <div>
                  <label className="block text-[11px] font-black tracking-widest uppercase text-slate-500 mb-2">Kode Room (4 Huruf)</label>
                  <input
                    type="text"
                    maxLength={4}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="ABCD"
                    className="w-full px-5 py-4 text-center rounded-xl border-4 border-slate-900 bg-white focus:outline-none focus:ring-4 focus:ring-rose-500/20 text-3xl font-black text-slate-900 uppercase tracking-[0.5em] placeholder-slate-300"
                    required
                  />
                </div>

                <motion.button
                  whileHover={isConnecting ? {} : { x: -2, y: -2, boxShadow: "10px 10px 0px 0px #0f172a" }}
                  whileTap={isConnecting ? {} : { scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
                  type="submit"
                  disabled={isConnecting}
                  className={`w-full mt-4 py-4 rounded-xl border-4 border-slate-900 text-white font-black text-xl shadow-[8px_8px_0px_0px_#0f172a] uppercase tracking-wider transition-all ${isConnecting ? 'bg-slate-500 cursor-not-allowed opacity-80' : 'bg-rose-500'}`}
                >
                  {isConnecting ? "Mencari..." : "Masuk"}
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}

function MenuButton({ 
  title, 
  subtitle, 
  onClick, 
  icon, 
  delay = 0,
  hoverClass,
  iconClass
}: { 
  title: React.ReactNode; 
  subtitle: string; 
  onClick: () => void; 
  icon: string;
  delay?: number;
  hoverClass?: string;
  iconClass?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: delay, type: "spring", bounce: 0.5 }}
      whileHover={{ y: -4, x: -4, boxShadow: "12px 12px 0px 0px #0f172a" }}
      whileTap={{ scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
      onClick={onClick}
      className={`bg-white border-4 border-slate-900 rounded-[24px] p-6 md:p-8 shadow-[8px_8px_0px_0px_#0f172a] transition-all cursor-pointer group flex flex-row md:flex-col items-center md:items-start text-left gap-5 md:gap-0 ${hoverClass}`}
    >
      <div className={`md:mb-6 shrink-0 w-14 h-14 md:w-16 md:h-16 ${iconClass} rounded-2xl flex items-center justify-center text-3xl md:text-4xl group-hover:scale-110 transition-transform duration-300 border-2 border-transparent group-hover:border-slate-900`}>
        {icon}
      </div>
      <div className="flex-1">
        <h3 className="text-xl md:text-3xl font-black uppercase leading-[1.1] mb-1.5 md:mb-2 text-slate-900 tracking-tight">{title}</h3>
        <p className="text-[10px] md:text-[11px] text-slate-500 font-black uppercase tracking-widest">{subtitle}</p>
      </div>
    </motion.div>
  );
}
