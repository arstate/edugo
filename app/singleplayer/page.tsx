'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { db, auth } from '../../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { generateMathQuestions } from '../../lib/questionGenerator';
import { motion, AnimatePresence } from 'motion/react';
import { Trophy, Timer, CheckCircle2, XCircle, Home, Rocket, Coins, ArrowRight, Brain } from 'lucide-react';

export default function SingleplayerPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'lobby' | 'playing' | 'finished'>('lobby');
  const [tier, setTier] = useState('SD');
  const [kelas, setKelas] = useState(1);
  const [questions, setQuestions] = useState<any[]>([]);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [startTime, setStartTime] = useState<number>(0);
  const [finishTime, setFinishTime] = useState("");
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [playerData, setPlayerData] = useState<any>(null);

  useEffect(() => {
    const fetchPlayer = async () => {
      if (auth.currentUser) {
        const pRef = doc(db, 'players', auth.currentUser.uid);
        const pSnap = await getDoc(pRef);
        if (pSnap.exists()) setPlayerData(pSnap.data());
      }
    };
    fetchPlayer();
  }, []);

  const startSoloGame = () => {
    const q = generateMathQuestions(kelas, 10);
    setQuestions(q);
    setProgress(0);
    setScore(0);
    setStartTime(Date.now());
    setStatus('playing');
  };

  const handleAnswer = (selected: string) => {
    if (answerState !== 'idle') return;

    const isCorrect = selected === questions[progress].correctAnswer;
    if (isCorrect) setScore(s => s + 1);
    setAnswerState(isCorrect ? 'correct' : 'wrong');

    setTimeout(() => {
      if (progress + 1 < questions.length) {
        setProgress(p => p + 1);
        setAnswerState('idle');
      } else {
        const time = ((Date.now() - startTime) / 1000).toFixed(2) + "s";
        setFinishTime(time);
        setStatus('finished');
        updatePermanentStats(score + (isCorrect ? 1 : 0));
      }
    }, 600);
  };

  const updatePermanentStats = async (finalScore: number) => {
    if (!auth.currentUser) return;
    
    // Multiplier logic
    let multiplier = 1;
    if (tier === 'SMP') multiplier = 2;
    if (tier === 'SMA') multiplier = 3;
    
    const coinsEarned = finalScore * multiplier;
    
    const pRef = doc(db, 'players', auth.currentUser.uid);
    const pSnap = await getDoc(pRef);
    
    if (pSnap.exists()) {
      const current = pSnap.data().coins || 0;
      await updateDoc(pRef, { 
        coins: current + coinsEarned,
        updatedAt: new Date()
      });
      setPlayerData({ ...pSnap.data(), coins: current + coinsEarned });
    } else {
      await updateDoc(pRef, {
        playerName: localStorage.getItem('playerName') || 'Pemain',
        uid: auth.currentUser.uid,
        coins: coinsEarned,
        updatedAt: new Date()
      });
    }
  };

  return (
    <main className="min-h-screen bg-[#FDF6E3] p-6 font-sans">
      <div className="max-w-xl mx-auto">
        <header className="flex justify-between items-center mb-12">
           <button onClick={() => router.push('/')} className="bg-white border-3 border-slate-900 p-3 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] hover:bg-amber-100 transition-colors">
              <Home size={24} />
           </button>
           {playerData && (
             <div className="bg-amber-400 border-3 border-slate-900 px-6 py-2 rounded-full shadow-[4px_4px_0px_0px_#0f172a] flex items-center gap-2 font-black">
                <Coins size={20} className="text-white drop-shadow-[1px_1px_0px_#000]" />
                {playerData.coins} KOIN
             </div>
           )}
        </header>

        <AnimatePresence mode="wait">
          {status === 'lobby' && (
            <motion.div 
               key="lobby"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white border-4 border-slate-900 p-8 rounded-[2.5rem] shadow-[10px_10px_0px_0px_#0f172a]"
            >
               <div className="w-20 h-20 bg-indigo-100 rounded-3xl mx-auto mb-6 flex items-center justify-center border-4 border-slate-900 rotate-6 shadow-[6px_6px_0px_0px_#4f46e5]">
                  <Brain className="text-indigo-600" size={40} />
               </div>
               <h1 className="text-3xl font-black text-slate-900 text-center mb-8 tracking-tighter">MODE LATIHAN SOLO</h1>
               
               <div className="space-y-6 mb-10">
                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Pilih Tier</label>
                    <div className="grid grid-cols-3 gap-3">
                       {['SD', 'SMP', 'SMA'].map(t => (
                         <button 
                           key={t}
                           onClick={() => {
                             setTier(t);
                             setKelas(t === 'SD' ? 1 : t === 'SMP' ? 7 : 10);
                           }}
                           className={`py-4 rounded-2xl border-4 border-slate-900 font-black transition-all ${tier === t ? 'bg-amber-400 text-slate-900 shadow-[4px_4px_0px_0px_#0f172a]' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}
                         >
                           {t}
                         </button>
                       ))}
                    </div>
                  </div>

                  <div>
                     <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 text-center">Kelas</label>
                     <select 
                       value={kelas}
                       onChange={(e) => setKelas(Number(e.target.value))}
                       className="w-full bg-slate-50 border-3 border-slate-900 p-4 rounded-xl font-black focus:outline-none focus:border-amber-500"
                     >
                       {tier === 'SD' && [1,2,3,4,5,6].map(k => <option key={k} value={k}>Kelas {k}</option>)}
                       {tier === 'SMP' && [7,8,9].map(k => <option key={k} value={k}>Kelas {k}</option>)}
                       {tier === 'SMA' && [10,11,12].map(k => <option key={k} value={k}>Kelas {k}</option>)}
                     </select>
                  </div>
               </div>

               <button 
                 onClick={startSoloGame}
                 className="w-full bg-emerald-500 text-white font-black py-5 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] hover:bg-emerald-400 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all text-xl flex items-center justify-center gap-3"
               >
                 MULAI LATIHAN <ArrowRight />
               </button>
            </motion.div>
          )}

          {status === 'playing' && questions[progress] && (
            <motion.div 
               key="playing"
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="flex flex-col"
            >
               <div className="flex justify-between items-center mb-6">
                  <div className="bg-white border-2 border-slate-900 px-4 py-2 rounded-xl font-bold flex items-center gap-2">
                    <Timer size={18} /> {((Date.now() - startTime)/1000).toFixed(0)}s
                  </div>
                  <div className="bg-indigo-600 text-white border-2 border-slate-900 px-4 py-2 rounded-xl font-bold">
                    SOAL {progress + 1}/10
                  </div>
               </div>

               <div className="bg-white border-4 border-slate-900 p-12 rounded-[2.5rem] shadow-[10px_10px_0px_0px_#0f172a] mb-8 min-h-[180px] flex items-center justify-center">
                  <h2 className="text-4xl md:text-5xl font-black text-slate-900 text-center tracking-tight">{questions[progress].question}</h2>
               </div>

               <div className="grid grid-cols-1 gap-4">
                  {questions[progress].options.map((opt: string, i: number) => (
                    <button
                      key={i}
                      disabled={answerState !== 'idle'}
                      onClick={() => handleAnswer(opt)}
                      className={`p-6 rounded-2xl border-4 border-slate-900 font-black text-2xl text-left transition-all shadow-[6px_6px_0px_0px_#0f172a]
                        ${answerState === 'correct' && opt === questions[progress].correctAnswer ? 'bg-emerald-500 text-white' : 
                          answerState === 'wrong' && opt === questions[progress].correctAnswer ? 'bg-emerald-200 border-emerald-500' :
                          'bg-white text-slate-900 hover:bg-indigo-50'}`}
                    >
                      {opt}
                    </button>
                  ))}
               </div>
            </motion.div>
          )}

          {status === 'finished' && (
            <motion.div 
              key="finished"
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="bg-white border-4 border-slate-900 p-10 rounded-[2.5rem] shadow-[10px_10px_0px_0px_#0f172a] text-center"
            >
               <div className="w-20 h-20 bg-amber-400 rounded-full mx-auto mb-6 flex items-center justify-center border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]">
                  <Trophy className="text-white drop-shadow-[2px_2px_0px_#000]" size={40} />
               </div>
               <h2 className="text-4xl font-black text-slate-900 mb-2">LATIHAN SELESAI</h2>
               <p className="text-slate-500 font-bold text-xl mb-10 tracking-widest uppercase">HASIL KAMU</p>
               
               <div className="grid grid-cols-2 gap-6 mb-12">
                  <div className="bg-slate-50 p-6 rounded-3xl border-3 border-slate-900 h-full">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Skor Akhir</p>
                     <p className="text-5xl font-black text-indigo-600 leading-none">{score * 10}</p>
                  </div>
                  <div className="bg-slate-50 p-6 rounded-3xl border-3 border-slate-900 h-full">
                     <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Waktu Total</p>
                     <p className="text-4xl font-black text-slate-900 leading-none">{finishTime}</p>
                  </div>
               </div>

               <div className="bg-amber-50 p-6 rounded-3xl border-4 border-amber-500 border-dashed mb-10">
                  <p className="text-amber-600 font-black mb-2 flex items-center justify-center gap-2">
                    <Coins /> KOIN DIDAPATKAN
                  </p>
                  <p className="text-4xl font-black text-slate-900">+{score * (tier === 'SD' ? 1 : tier === 'SMP' ? 2 : 3)}</p>
                  <p className="text-[10px] font-black text-amber-600 mt-2">MULTIPLIKER TIER {tier}: x{tier === 'SD' ? 1 : tier === 'SMP' ? 2 : 3}</p>
               </div>

               <div className="flex flex-col gap-4">
                  <button 
                    onClick={startSoloGame}
                    className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#334155] hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
                  >
                    COBA LAGI <Rocket />
                  </button>
                  <button 
                    onClick={() => router.push('/')}
                    className="w-full bg-white text-slate-900 font-black py-4 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] hover:bg-slate-50 transition-all"
                  >
                    KEMBALI KE MENU
                  </button>
               </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
