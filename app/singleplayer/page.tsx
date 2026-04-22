'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { LogOut, Crown, Coins, Home, Play } from 'lucide-react';
import { generateMathQuestions, MathQuestion } from '../../lib/questionGenerator';

export default function SinglePlayerPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const kelasParam = parseInt(searchParams.get('kelas') || '1');
  const soalParam = parseInt(searchParams.get('jumlahSoal') || '10');

  const [status, setStatus] = useState<'preparing' | 'playing' | 'finished'>('preparing');
  const [questions, setQuestions] = useState<MathQuestion[]>([]);
  const [progress, setProgress] = useState(0);
  const [score, setScore] = useState(0);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [countdownTimer, setCountdownTimer] = useState<number | null>(3);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [startTimeMs, setStartTimeMs] = useState<number | null>(null);
  const [finishTimeStr, setFinishTimeStr] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);

  // Initialize
  useEffect(() => {
    const generated = generateMathQuestions(kelasParam, soalParam);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setQuestions(generated);
  }, [kelasParam, soalParam]);

  // Countdown timer logic
  useEffect(() => {
    if (status === 'preparing') {
        if (countdownTimer === null || countdownTimer <= 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStatus('playing');
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setStartTimeMs(Date.now());
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setCountdownTimer(null);
        } else {
            const timer = setTimeout(() => {
                setCountdownTimer(prev => prev! - 1);
            }, 1000);
            return () => clearTimeout(timer);
        }
    }
  }, [status, countdownTimer]);

  // Elapsed time tracker
  useEffect(() => {
    if (status === 'playing' && startTimeMs) {
      const interval = setInterval(() => {
        const ms = Date.now() - startTimeMs;
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        setElapsedTime(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [status, startTimeMs]);

  const handleLevelQuit = () => {
     router.push('/');
  };

  const handleAnswerSubmit = (selectedOptionIndex: number) => {
    if (isSubmitting || status !== 'playing') return;
    setIsSubmitting(true);

    const currentQuestion = questions[progress];
    const isCorrect = selectedOptionIndex === currentQuestion.correctOptionIndex;

    const newCorrectCount = isCorrect ? correctAnswers + 1 : correctAnswers;
    if (isCorrect) setCorrectAnswers(newCorrectCount);

    setTimeout(() => {
      if (progress + 1 >= questions.length) {
         // Finished Game Let's compute
         const finalScore = Math.round((newCorrectCount / questions.length) * 100);
         const ms = Date.now() - startTimeMs!;
         const totalSeconds = Math.floor(ms / 1000);
         const minutes = Math.floor(totalSeconds / 60);
         const seconds = totalSeconds % 60;
         const finalTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
         
         setScore(finalScore);
         setFinishTimeStr(finalTime);
         
         // Compute coins
         const baseReward = questions.length * 5;
         const multiplier = kelasParam > 3 ? 2 : 1;
         const rankBonus = finalScore >= 90 ? 200 : (finalScore >= 60 ? 50 : 0);
         const totalCoins = (baseReward * multiplier) + rankBonus;
         
         setEarnedCoins(totalCoins);

         // Save to localstorage
         const currentLocalCoins = parseInt(localStorage.getItem('eduquest_coins') || '0');
         localStorage.setItem('eduquest_coins', (currentLocalCoins + totalCoins).toString());

         setStatus('finished');
      } else {
         setProgress(progress + 1);
      }
      setIsSubmitting(false);
    }, 400);
  };

  if (status === 'finished') {
    return (
      <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8 bg-slate-50 overflow-x-hidden">
        <h1 className="text-4xl md:text-6xl font-black uppercase text-slate-900 mb-2 tracking-tighter text-center">
            Hasil <span className="text-indigo-600">Latihan</span>
        </h1>
        
        <div className="mt-8 mb-12 flex flex-col items-center gap-4 w-full max-w-sm">
           <div className="w-40 h-40 bg-indigo-600 border-4 border-slate-900 rounded-[32px] flex flex-col items-center justify-center text-white shadow-[8px_8px_0px_0px_#0f172a]">
              <span className="text-6xl font-black">{score}%</span>
              <span className="uppercase font-bold tracking-widest text-indigo-200 text-xs mt-1">Skor Akhir</span>
           </div>
           
           <div className="w-full bg-white border-4 border-slate-900 p-6 rounded-2xl shadow-[4px_4px_0px_0px_#0f172a] text-center">
              <span className="text-xs uppercase font-black text-slate-500 tracking-widest">Waktu Pengerjaan</span>
              <div className="text-3xl font-black text-slate-900">{finishTimeStr}</div>
           </div>
        </div>

        {/* Reward Box */}
        {earnedCoins !== null && (
            <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ type: 'spring', delay: 0.3 }}
               className="bg-amber-100 border-4 border-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-sm text-center shadow-[8px_8px_0px_0px_#0f172a] relative overflow-hidden mb-12"
            >
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200/50 to-transparent"></div>
               <div className="relative z-10">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-700 mb-2">Total Hadiah</h3>
                  <div className="flex items-center justify-center gap-4">
                     <Coins size={48} className="text-amber-500 drop-shadow-sm" />
                     <span className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter">+{earnedCoins}</span>
                  </div>
                  <p className="text-xs font-black uppercase text-amber-600 mt-2 tracking-widest">Koin ditambahkan ke profil</p>
               </div>
            </motion.div>
        )}

        <button 
           onClick={() => router.push('/')}
           className="px-8 py-5 bg-slate-900 border-4 border-slate-900 rounded-2xl text-white font-black text-xl uppercase tracking-widest shadow-[6px_6px_0px_0px_#0f172a] hover:translate-x-1 hover:translate-y-1 hover:shadow-none hover:bg-slate-800 transition-all flex items-center gap-3 mb-12"
        >
           <Home size={24} /> Ke Beranda
        </button>
      </main>
    );
  }

  const currentQuestion = questions[progress];

  return (
    <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8 bg-slate-50 overflow-x-hidden">
        {/* Countdown Overlay during 'preparing' */ }
        {status === 'preparing' && countdownTimer !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                <motion.div
                    key={countdownTimer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="text-[150px] md:text-[250px] font-black text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                >
                    {countdownTimer > 0 ? countdownTimer : 'STAR!'}
                </motion.div>
                <div className="absolute top-20 md:top-32 text-center text-slate-300 font-black tracking-[0.3em] uppercase text-xl">
                    Bersiaplah!
                </div>
            </div>
        )}

        {/* Realtime Compact Progress Bar */}
        <div className={`w-full max-w-2xl mb-6`}>
            <div className="flex items-center justify-between mb-3 px-2">
               <span className="text-xs font-black tracking-widest uppercase text-slate-500 bg-white px-3 py-1 rounded-md border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a]">Single Player</span>
               <div className="flex bg-white border-2 border-slate-900 px-3 py-1 rounded-md shadow-[2px_2px_0px_0px_#0f172a] items-center gap-2">
                 <span className="text-xs font-black tracking-widest text-slate-500 uppercase">⏱️ {elapsedTime}</span>
               </div>
            </div>

            <div className="bg-white border-4 border-slate-900 rounded-xl p-3 shadow-[4px_4px_0px_0px_#0f172a]">
                <div className="relative">
                    <div className="h-6 bg-slate-100 rounded-md border-2 border-slate-900/10 w-full overflow-hidden relative">
                       <div className="h-full bg-indigo-50 border-r-2 border-slate-900" style={{ width: `${(progress / soalParam) * 100}%` }}></div>
                    </div>
                    <motion.div
                       className="absolute top-1/2 -translate-y-1/2 bg-amber-400 border-2 border-slate-900 text-slate-900 px-3 py-0.5 rounded-full text-[10px] font-black uppercase shadow-sm z-10 whitespace-nowrap"
                       animate={{ left: `max(0%, min(100%, ${(progress / soalParam) * 100}%))` }}
                       transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                       style={{ translateX: '-50%' }}
                    >
                       Kamu
                    </motion.div>
                </div>
            </div>
        </div>

        {/* Action Header */}
        <header className="w-full max-w-2xl flex justify-between items-center mb-6 px-2">
            <button 
                onClick={handleLevelQuit}
                className="px-4 py-2 border-2 border-slate-900 rounded-lg text-slate-900 font-black uppercase text-xs tracking-widest shadow-[2px_2px_0px_0px_#0f172a] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none transition-all flex items-center gap-2 bg-white"
            >
                <LogOut size={14} strokeWidth={3} /> Akhiri Sesi
            </button>
            <div className="text-sm font-black text-slate-500 uppercase tracking-widest bg-white border-2 border-slate-900 px-3 py-1.5 rounded-lg shadow-[2px_2px_0px_0px_#0f172a]">
               Soal {progress + 1} / {soalParam}
            </div>
        </header>

        {/* Gameplay Area */}
        {status === 'playing' && currentQuestion && (
            <motion.div 
               key={progress} 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="w-full max-w-2xl"
            >
               <div className="bg-white border-4 border-slate-900 rounded-[32px] p-8 md:p-12 mb-6 shadow-[8px_8px_0px_0px_#0f172a]">
                  <h3 className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter text-center leading-tight">
                     {currentQuestion.text}
                  </h3>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {currentQuestion.options.map((option, idx) => (
                     <motion.button
                        key={idx}
                        disabled={isSubmitting}
                        whileHover={isSubmitting ? {} : { y: -2, x: -2, boxShadow: "8px 8px 0px 0px #0f172a" }}
                        whileTap={isSubmitting ? {} : { scale: 0.98, y: 2, x: 2, boxShadow: "2px 2px 0px 0px #0f172a" }}
                        onClick={() => handleAnswerSubmit(idx)}
                        className={`w-full bg-white border-4 border-slate-900 p-6 rounded-2xl text-2xl md:text-3xl font-black text-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:bg-slate-50 transition-all text-center ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                     >
                        {option}
                     </motion.button>
                  ))}
               </div>
            </motion.div>
        )}
    </main>
  );
}
