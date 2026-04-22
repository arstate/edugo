'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth, db } from '../lib/firebase';
import { signInAnonymously } from 'firebase/auth';
import { collection, doc, setDoc, getDoc } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Users, User, Rocket, Trophy, Settings, LayoutGrid } from 'lucide-react';

export default function Home() {
  const router = useRouter();
  const [playerName, setPlayerName] = useState('');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [formTier, setFormTier] = useState('SD');
  const [formKelas, setFormKelas] = useState(1);
  const [formSoal, setFormSoal] = useState(10);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const login = async () => {
      try {
        await signInAnonymously(auth);
        const savedName = localStorage.getItem('playerName');
        if (savedName) setPlayerName(savedName);
      } catch (err) {
        console.error("Auth error", err);
      } finally {
        setLoading(false);
      }
    };
    login();
  }, []);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) return alert('Masukkan nama kamu!');
    localStorage.setItem('playerName', playerName);

    const code = Math.random().toString(36).substring(2, 6).toUpperCase();
    const roomRef = doc(db, 'rooms', code);

    const initialPlayer = {
      uid: auth.currentUser?.uid,
      name: playerName,
      progress: 0,
      score: 0,
      isFinished: false,
      finishTime: null,
      isReady: true
    };

    await setDoc(roomRef, {
      roomCode: code,
      hostId: auth.currentUser?.uid,
      status: 'waiting',
      settings: {
        kelas: Number(formKelas),
        jumlahSoal: Number(formSoal)
      },
      players: [initialPlayer],
      questions: [],
      startTime: null,
      gameStartAtUnix: null
    });

    router.push(`/room/${code}`);
  };

  const handleJoinRoom = async () => {
    if (!roomCodeInput.trim()) return alert('Masukkan kode room!');
    if (!playerName.trim()) return alert('Masukkan nama kamu!');
    localStorage.setItem('playerName', playerName);
    
    const code = roomCodeInput.toUpperCase();
    router.push(`/room/${code}`);
  };

  if (loading) return (
    <div className="min-h-screen bg-amber-50 flex items-center justify-center font-sans">
      <div className="animate-bounce text-amber-600 font-black text-4xl">EDUQ!</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#FDF6E3] p-6 md:p-12 font-sans selection:bg-amber-200">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-16">
          <motion.div 
            initial={{ x: -50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="flex items-center gap-4"
          >
            <div className="w-16 h-16 bg-amber-500 rounded-2xl border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] flex items-center justify-center">
              <Rocket className="text-white" size={32} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight leading-none">EDUQUEST</h1>
              <p className="text-slate-500 font-bold uppercase tracking-widest text-xs mt-1">Battle of Minds</p>
            </div>
          </motion.div>

          {/* Player Name Input */}
          <motion.div 
            initial={{ x: 50, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="w-full md:w-72"
          >
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-1">Nama Pemain</label>
            <div className="relative">
              <input 
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Ex: Si Pintar"
                className="w-full bg-white border-4 border-slate-900 p-4 rounded-2xl font-bold text-slate-900 focus:outline-none focus:ring-0 focus:shadow-[8px_8px_0px_0px_#0f172a] transition-all shadow-[4px_4px_0px_0px_#0f172a]"
              />
              <User className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
            </div>
          </motion.div>
        </header>

        {/* Main Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Join Room Card */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-white border-4 border-slate-900 p-8 rounded-[2rem] shadow-[8px_8px_0px_0px_#0f172a]"
          >
            <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-6 border-2 border-slate-900">
              <Users className="text-indigo-600" size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Join Multiplayer</h2>
            <p className="text-slate-500 font-medium mb-8">Masuk ke room temanmu dan tunjukkan kemampuanmu!</p>
            
            <div className="flex gap-2">
              <input 
                type="text"
                maxLength={4}
                value={roomCodeInput}
                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                placeholder="KODE"
                className="flex-1 bg-slate-50 border-3 border-slate-900 p-4 rounded-xl font-black text-center text-xl tracking-[0.5em] focus:outline-none focus:bg-indigo-50 transition-all uppercase"
              />
              <button 
                onClick={handleJoinRoom}
                className="bg-indigo-600 text-white font-black px-6 rounded-xl border-3 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-indigo-500 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all"
              >
                JOIN
              </button>
            </div>
          </motion.div>

          {/* Create Room Card */}
          <motion.div 
            whileHover={{ y: -5 }}
            className="bg-amber-100 border-4 border-slate-900 p-8 rounded-[2rem] shadow-[8px_8px_0px_0px_#0f172a]"
          >
            <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center mb-6 border-2 border-slate-900">
              <LayoutGrid className="text-amber-600" size={24} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Buat Room Baru</h2>
            <p className="text-slate-500 font-medium mb-8">Jadilah host dan atur tingkat kesulitanmu sendiri.</p>
            
            <button 
              onClick={() => setIsCreating(true)}
              className="w-full bg-amber-500 text-white font-black py-4 rounded-xl border-3 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] hover:bg-amber-400 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2"
            >
              MULAI SEKARANG
            </button>
          </motion.div>
        </div>

        {/* Footer Shortcut */}
        <div className="mt-12 flex justify-center">
          <button 
            onClick={() => router.push('/singleplayer')}
            className="flex items-center gap-3 bg-white border-3 border-slate-900 px-6 py-3 rounded-full font-black text-slate-600 hover:text-amber-600 transition-all shadow-[4px_4px_0px_0px_#0f172a] active:shadow-none"
          >
            <Trophy size={18} />
            KEJAR SKOR TERTINGGI (SINGLEPLAYER)
          </button>
        </div>
      </div>

      {/* Create Room Modal */}
      <AnimatePresence>
        {isCreating && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreating(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              className="relative w-full max-w-lg bg-white border-4 border-slate-900 rounded-[2.5rem] shadow-[12px_12px_0px_0px_#0f172a] overflow-hidden"
            >
              <div className="bg-amber-400 p-6 border-b-4 border-slate-900 flex justify-between items-center">
                <h3 className="text-2xl font-black text-slate-900">PENGATURAN GAME</h3>
                <button onClick={() => setIsCreating(false)} className="bg-white border-2 border-slate-900 w-8 h-8 rounded-lg font-black flex items-center justify-center hover:bg-rose-500 hover:text-white transition-colors">X</button>
              </div>
              
              <div className="p-8 space-y-6">
                <div>
                  <label className="block font-black text-slate-900 uppercase text-xs tracking-widest mb-3 flex items-center gap-2">
                    <Trophy size={14} /> Pilih Tier Sekolah
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {['SD', 'SMP', 'SMA'].map((tier) => (
                      <button
                        key={tier}
                        onClick={() => {
                          setFormTier(tier);
                          if (tier === 'SMP') setFormKelas(7);
                          else if (tier === 'SMA') setFormKelas(10);
                          else setFormKelas(1);
                        }}
                        className={`py-3 rounded-xl border-3 border-slate-900 font-bold transition-all ${
                          formTier === tier ? 'bg-amber-400 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {tier}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-black text-slate-900 uppercase text-xs tracking-widest mb-3">Tingkat Kelas</label>
                  <select 
                    value={formKelas}
                    onChange={(e) => setFormKelas(Number(e.target.value))}
                    className="w-full bg-slate-50 border-3 border-slate-900 p-4 rounded-xl font-bold focus:outline-none"
                  >
                    {formTier === 'SD' && [1,2,3,4,5,6].map(k => <option key={k} value={k}>Kelas {k} (Sekolah Dasar)</option>)}
                    {formTier === 'SMP' && [7,8,9].map(k => <option key={k} value={k}>Kelas {k} (SMP)</option>)}
                    {formTier === 'SMA' && [10,11,12].map(k => <option key={k} value={k}>Kelas {k} (SMA/SMK)</option>)}
                  </select>
                </div>

                <div>
                  <label className="block font-black text-slate-900 uppercase text-xs tracking-widest mb-3">Jumlah Pertanyaan</label>
                  <div className="grid grid-cols-4 gap-2">
                    {[10, 20, 30, 50].map((num) => (
                      <button
                        key={num}
                        onClick={() => setFormSoal(num)}
                        className={`py-3 rounded-xl border-3 border-slate-900 font-bold transition-all ${
                          formSoal === num ? 'bg-indigo-600 text-white shadow-[4px_4px_0px_0px_#0f172a]' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleCreateRoom}
                    className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] hover:bg-emerald-400 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all text-xl"
                  >
                    BUAT LOBBY SEKARANG!
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
