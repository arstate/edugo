'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { Users, Play, LogOut, Loader2, Copy } from 'lucide-react';
import { auth, db } from '../../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { generateMathQuestions, MathQuestion } from '../../../lib/questionGenerator';

interface Player {
  uid: string;
  name: string;
  progress: number;
  score: number;
  isFinished: boolean;
  finishTime: string | null;
}

interface RoomData {
  roomCode: string;
  hostId: string;
  status: string;
  settings: {
    kelas: number;
    jumlahSoal: number;
  };
  players: Player[];
  questions: MathQuestion[];
  startTime: any;
}

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomCode = params.roomCode as string;

  const [roomData, setRoomData] = useState<RoomData | null>(null);
  const [currentUserOption, setCurrentUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // Not logged in, redirect to home
        router.push('/');
      } else {
        setCurrentUser(user);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!roomCode || !currentUserOption) return;

    const roomRef = doc(db, 'rooms', roomCode);
    const unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data() as RoomData;
        setRoomData(data);
        
        // Check if player is in the room
        const isInRoom = data.players.some(p => p.uid === currentUserOption.uid);
        if (!isInRoom) {
          setErrorText("Kamu tidak terdaftar di room ini.");
        }
      } else {
        setErrorText("Room tidak ditemukan.");
      }
      setIsLoading(false);
    }, (err) => {
      console.error("Room listener error:", err);
      setErrorText("Gagal memuat data room.");
      setIsLoading(false);
    });

    return () => unsubscribeRoom();
  }, [roomCode, currentUserOption]);

  const handleStartGame = async () => {
    if (!roomData || !currentUserOption || roomData.hostId !== currentUserOption.uid) return;
    
    try {
      const roomRef = doc(db, 'rooms', roomCode);
      const generatedQuestions = generateMathQuestions(roomData.settings.kelas, roomData.settings.jumlahSoal);
      
      await updateDoc(roomRef, {
        status: 'playing',
        questions: generatedQuestions,
        startTime: serverTimestamp()
      });
    } catch (error) {
      console.error("Error starting game:", error);
      alert("Gagal memulai permainan.");
    }
  };
  
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    alert("Kode room disalin: " + roomCode);
  };

  const handleAnswer = async (selectedOptionIndex: number) => {
    if (!roomData || !currentUserOption || isSubmitting) return;
    const myPlayer = roomData.players.find(p => p.uid === currentUserOption.uid);
    if (!myPlayer || myPlayer.isFinished || !roomData.questions) return;

    setIsSubmitting(true);
    const currentQ = roomData.questions[myPlayer.progress];
    const isCorrect = currentQ.options[selectedOptionIndex] === currentQ.correctAnswer;
    
    let newCorrectCount = correctAnswers;
    if (isCorrect) {
         newCorrectCount++;
         setCorrectAnswers(newCorrectCount);
    }

    const newProgress = myPlayer.progress + 1;
    const isFinishedNow = newProgress >= roomData.settings.jumlahSoal;
    
    const roomRef = doc(db, 'rooms', roomCode);

    try {
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) throw new Error("Room document does not exist!");
            const data = roomDoc.data();
            
            const updatedPlayers = data.players.map((p: any) => {
                if (p.uid === currentUserOption.uid) {
                    if (isFinishedNow) {
                        const startTimeMs = data.startTime.toMillis();
                        const finishTimeStr = ((Date.now() - startTimeMs) / 1000).toFixed(1) + "s";
                        const finalScore = Math.round((newCorrectCount / data.settings.jumlahSoal) * 100);
                        return { ...p, progress: newProgress, isFinished: true, score: finalScore, finishTime: finishTimeStr };
                    } else {
                        return { ...p, progress: newProgress };
                    }
                }
                return p;
            });
            
            transaction.update(roomRef, { players: updatedPlayers });
        });
    } catch (error) {
        console.error("Transaction failed: ", error);
        alert("Gagal mengirim jawaban, coba lagi.");
    } finally {
        setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <Loader2 className="animate-spin text-indigo-600 w-16 h-16" />
      </div>
    );
  }

  if (errorText) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 text-center">
        <h1 className="text-4xl font-black uppercase text-slate-900 mb-4">Oops!</h1>
        <p className="text-xl font-bold text-slate-500 mb-8">{errorText}</p>
        <button 
          onClick={() => router.push('/')}
          className="px-8 py-4 bg-indigo-600 border-4 border-slate-900 rounded-xl text-white font-black uppercase tracking-widest shadow-[6px_6px_0px_0px_#0f172a] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all"
        >
          Kembali ke Menu
        </button>
      </div>
    );
  }

  if (!roomData) return null;

  const isHost = currentUserOption?.uid === roomData.hostId;

  if (roomData.status === 'playing') {
    const myPlayerData = roomData.players.find(p => p.uid === currentUserOption.uid);
    const totalSoal = roomData.settings.jumlahSoal;
    const progress = myPlayerData?.progress || 0;
    const currentQuestion = roomData.questions?.[progress];
    const isFinished = myPlayerData?.isFinished || false;

    return (
      <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8 bg-slate-50">
        {/* Realtime Progress Bar for all players */}
        <div className={`w-full max-w-4xl ${isFinished ? 'mb-16' : 'mb-8'}`}>
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center justify-center gap-2">
                <Users size={16} /> Live Race Progress
            </h3>
            <div className="space-y-3">
               {roomData.players.map(p => {
                  const percent = Math.min((p.progress / totalSoal) * 100, 100);
                  const isMe = p.uid === currentUserOption.uid;
                  return (
                     <div key={p.uid} className={`flex items-center gap-3 p-3 border-4 ${isMe ? 'border-indigo-600 bg-indigo-50' : 'border-slate-900 bg-white'} rounded-2xl shadow-[4px_4px_0px_0px_#0f172a]`}>
                        <div className={`w-10 h-10 rounded-xl border-2 border-slate-900 flex shrink-0 items-center justify-center text-white font-black text-lg ${isMe ? 'bg-indigo-600' : 'bg-slate-400'}`}>
                           {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 relative h-6 bg-slate-200 rounded-full border-2 border-slate-900 overflow-hidden">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${percent}%` }}
                             transition={{ type: 'spring', bounce: 0.1, duration: 0.8 }}
                             className={`absolute top-0 left-0 h-full ${isMe ? 'bg-indigo-500' : 'bg-slate-500'}`}
                           />
                        </div>
                        <div className="shrink-0 w-12 text-center text-sm font-black text-slate-700">
                           {p.progress}/{totalSoal}
                        </div>
                     </div>
                  )
               })}
            </div>
        </div>

        {/* Gameplay Area */}
        {!isFinished && currentQuestion && (
            <motion.div 
              key={progress} // force re-animate on new question
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-3xl bg-white border-4 border-slate-900 rounded-[32px] p-8 md:p-12 shadow-[8px_8px_0px_0px_#0f172a] text-center"
            >
               <h2 className="text-[10px] md:text-xs font-black tracking-[0.2em] uppercase text-indigo-500 mb-6 drop-shadow-sm">
                  🔹 Soal {progress + 1} dari {totalSoal} 🔹
               </h2>
               <h1 className="text-5xl md:text-7xl font-black text-slate-900 mb-10 md:mb-12 tracking-tight">
                  {currentQuestion.question}
               </h1>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
                  {currentQuestion.options.map((opt, i) => (
                     <motion.button 
                        key={i}
                        whileHover={isSubmitting ? {} : { scale: 1.02, y: -4, boxShadow: "6px 6px 0px 0px #0f172a" }}
                        whileTap={isSubmitting ? {} : { scale: 0.98, x: 2, y: 2, boxShadow: "2px 2px 0px 0px #0f172a" }}
                        onClick={() => handleAnswer(i)}
                        disabled={isSubmitting}
                        className={`py-6 px-4 bg-slate-50 border-4 border-slate-900 rounded-2xl text-2xl md:text-4xl font-black text-slate-900 shadow-[4px_4px_0px_0px_#0f172a] transition-all ${isSubmitting ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-600'}`}
                     >
                       {opt}
                     </motion.button>
                  ))}
               </div>
            </motion.div>
        )}

        {/* Spectator Area */}
        {isFinished && (
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center mt-8 w-full max-w-2xl bg-white border-4 border-slate-900 p-10 rounded-[32px] shadow-[8px_8px_0px_0px_#0f172a]"
            >
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 uppercase tracking-tighter mb-4 animate-pulse">Menunggu Pemain Lain...</h2>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">
                    SKOR SEMENTARA: <span className="text-indigo-600 text-xl">{myPlayerData?.score}%</span>
                </p>
                <p className="text-slate-500 font-bold uppercase tracking-widest text-sm mt-2">
                    WAKTU: <span className="text-amber-600 text-xl">{myPlayerData?.finishTime}</span>
                </p>
            </motion.div>
        )}
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8">
      {/* Header Bar */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 md:mb-12 gap-2">
        <button 
          onClick={() => router.push('/')}
          className="px-4 py-2.5 md:px-6 md:py-3 bg-white border-2 md:border-4 border-slate-900 rounded-xl text-slate-900 font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_#0f172a] md:shadow-[4px_4px_0px_0px_#0f172a] hover:translate-x-1 hover:translate-y-1 hover:shadow-none transition-all flex items-center gap-2 text-xs md:text-sm"
        >
          <LogOut className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> 
          <span className="hidden min-[400px]:inline">Keluar</span> <span className="hidden sm:inline">Room</span>
        </button>
        
        <div className="px-4 py-2.5 md:px-6 md:py-3 bg-amber-100 border-2 md:border-4 border-slate-900 rounded-xl text-amber-700 font-black uppercase tracking-widest shadow-[3px_3px_0px_0px_#0f172a] md:shadow-[4px_4px_0px_0px_#0f172a] flex items-center gap-2 text-xs md:text-sm">
          <Users className="w-4 h-4 md:w-[18px] md:h-[18px]" strokeWidth={3} /> 
          {roomData.players.length} <span className="hidden min-[400px]:inline">/ 6</span> <span className="hidden sm:inline">Pemain</span>
        </div>
      </header>
      
      {/* Room Identity */}
      <div className="text-center mb-12 w-full max-w-2xl">
        <span className="inline-block px-4 py-1.5 bg-indigo-100 text-indigo-700 rounded-full text-sm font-black uppercase tracking-widest mb-4 border-2 border-indigo-200">
          Kode Room
        </span>
        <div 
          onClick={handleCopyCode}
          className="text-7xl md:text-9xl font-black text-slate-900 tracking-[0.2em] mb-6 flex justify-center items-center gap-4 cursor-pointer hover:text-indigo-600 transition-colors group"
        >
          {roomData.roomCode}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <Copy size={48} />
          </div>
        </div>
        
        {/* Settings Badge */}
        <div className="flex flex-wrap justify-center gap-4">
          <div className="px-6 py-2 bg-white border-2 border-slate-900 rounded-lg text-slate-600 font-bold uppercase tracking-wider text-sm shadow-[2px_2px_0px_0px_#0f172a]">
            📘 Kelas {roomData.settings.kelas} SD
          </div>
          <div className="px-6 py-2 bg-white border-2 border-slate-900 rounded-lg text-slate-600 font-bold uppercase tracking-wider text-sm shadow-[2px_2px_0px_0px_#0f172a]">
            📝 {roomData.settings.jumlahSoal} Soal
          </div>
        </div>
      </div>

      {/* Players Grid */}
      <div className="w-full max-w-5xl mb-16">
        <h3 className="text-xl font-black text-slate-900 uppercase tracking-widest mb-6 flex items-center gap-3">
          <span className="w-8 h-8 bg-slate-900 text-white flex items-center justify-center rounded-lg">👇</span>
          Pemain yang Bergabung
        </h3>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {roomData.players.map((player, idx) => (
            <motion.div 
              key={player.uid}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.1, type: 'spring' }}
              className={`p-6 border-4 border-slate-900 rounded-2xl flex items-center gap-4 bg-white shadow-[6px_6px_0px_0px_#0f172a] ${player.uid === currentUserOption?.uid ? 'ring-4 ring-indigo-500 ring-offset-4 ring-offset-[#f8fafc]' : ''}`}
            >
              <div className="w-14 h-14 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-xl border-2 border-slate-900 flex items-center justify-center text-white font-black text-2xl shrink-0">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xl font-black text-slate-900 uppercase truncate">{player.name}</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {player.uid === roomData.hostId ? '👑 Room Host' : '⚔️ Challenger'}
                </p>
              </div>
            </motion.div>
          ))}
          
          {/* Empty slots placeholders */}
          {Array.from({ length: Math.max(0, 6 - roomData.players.length) }).map((_, i) => (
            <div key={`empty-${i}`} className="p-6 border-4 border-slate-300 border-dashed rounded-2xl flex items-center justify-center bg-slate-50/50">
              <span className="text-slate-400 font-black uppercase tracking-widest text-sm">Menunggu...</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Footer */}
      <div className="w-full max-w-2xl text-center">
        {isHost ? (
          <motion.button
            whileHover={{ y: -4, x: -4, boxShadow: "12px 12px 0px 0px #0f172a" }}
            whileTap={{ scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
            onClick={handleStartGame}
            className="w-full py-6 bg-emerald-500 border-4 border-slate-900 rounded-2xl text-white font-black text-3xl uppercase tracking-widest shadow-[8px_8px_0px_0px_#0f172a] flex items-center justify-center gap-4 transition-all"
          >
            <Play fill="currentColor" size={32} /> Mulai Game
          </motion.button>
        ) : (
          <div className="py-6 border-4 border-slate-900 border-dashed rounded-2xl text-slate-500 font-black text-xl uppercase tracking-widest bg-slate-100 flex items-center justify-center gap-4">
            <Loader2 className="animate-spin" size={28} /> Menunggu Host Memulai...
          </div>
        )}
      </div>
    </main>
  );
}
