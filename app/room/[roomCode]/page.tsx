'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
import { Users, Play, LogOut, Loader2, Copy, Crown, Medal, Award, Coins, Home, MessageSquare, X, Send, RotateCcw } from 'lucide-react';
import { auth, db } from '../../../lib/firebase';
import { doc, onSnapshot, updateDoc, serverTimestamp, runTransaction, increment, deleteDoc, collection, addDoc, query, orderBy } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import { generateMathQuestions, MathQuestion } from '../../../lib/questionGenerator';

const VoiceChat = dynamic(() => import('../../../components/VoiceChat'), { 
  ssr: false,
  loading: () => null
});

interface Player {
  uid: string;
  name: string;
  progress: number;
  score: number;
  isFinished: boolean;
  finishTime: string | null;
  isReady: boolean;
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
  gameStartAtUnix: number | null;
}

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
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
  const [earnedCoins, setEarnedCoins] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState('00:00');
  const [countdownTimer, setCountdownTimer] = useState<number | null>(null);

  // Chat variables
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [seenMessagesCount, setSeenMessagesCount] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const initialMessagesCount = useRef(-1);

  // Unread logic
  const unreadCount = Math.max(0, messages.length - seenMessagesCount);

  useEffect(() => {
     if (isChatOpen) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setSeenMessagesCount(messages.length);
     }
  }, [isChatOpen, messages.length]);

  useEffect(() => {
     if (isChatOpen) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
     }
  }, [messages, isChatOpen]);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/');
      } else {
        setCurrentUser(user);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  // Chat Subscription Effect
  useEffect(() => {
     if (!roomCode) return;
     const q = query(collection(db, 'rooms', roomCode, 'messages'), orderBy('createdAt', 'asc'));
     const unsubscribeChat = onSnapshot(q, (snapshot) => {
        const newMessages = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ChatMessage));
        if (initialMessagesCount.current === -1) {
            initialMessagesCount.current = newMessages.length;
            setSeenMessagesCount(newMessages.length);
        }
        setMessages(newMessages);
     }, (err) => {
        console.error("Chat listener error:", err);
     });
     return () => unsubscribeChat();
  }, [roomCode]);

  const handleSendMessage = async (e: React.FormEvent) => {
     e.preventDefault();
     if (!chatInput.trim() || !currentUserOption || !roomData) return;
     const msg = chatInput.trim();
     setChatInput('');
     
     const myPlayerData = roomData.players.find(p => p.uid === currentUserOption.uid);
     const senderName = myPlayerData ? myPlayerData.name : 'Unknown';

     try {
        await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
           text: msg,
           senderId: currentUserOption.uid,
           senderName: senderName,
           createdAt: serverTimestamp()
        });
     } catch(e) {
        console.error("Error sending message", e);
     }
  };

  const handleLeaveRoom = async () => {
    if (!roomCode || !currentUserOption) return;
    try {
        const roomRef = doc(db, 'rooms', roomCode);
        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);
            if (!roomDoc.exists()) return;
            const data = roomDoc.data();
            const updatedPlayers = data.players.filter((p: any) => p.uid !== currentUserOption.uid);
            
            if (updatedPlayers.length === 0) {
                transaction.delete(roomRef);
            } else {
                transaction.update(roomRef, { players: updatedPlayers });
            }
        });
    } catch(e) {
        console.error("Error leaving room", e);
    }
  };

  useEffect(() => {
    const handleBeforeUnload = () => {
       handleLeaveRoom();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
       window.removeEventListener('beforeunload', handleBeforeUnload);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomCode, currentUserOption]);

  // General auto-finish (Any alive player can trigger this if all are finished)
  useEffect(() => {
    if (roomData?.status === 'playing') {
      const allFinished = roomData.players.every(p => p.isFinished);
      if (allFinished && roomData.players.length > 0) {
        updateDoc(doc(db, 'rooms', roomCode), { status: 'finished' }).catch(console.error);
      }
    }
  }, [roomData, roomCode]);

  // Countdown overlay timer logic
  useEffect(() => {
     if (roomData?.status === 'playing' && roomData.gameStartAtUnix) {
        const checkTime = () => {
           const remaining = Math.ceil((roomData.gameStartAtUnix! - Date.now()) / 1000);
           if (remaining > 0) {
               setCountdownTimer(remaining);
           } else {
               setCountdownTimer(null);
           }
        };
        checkTime();
        const intv = setInterval(checkTime, 500);
        return () => clearInterval(intv);
     } else {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setCountdownTimer(null);
     }
  }, [roomData?.status, roomData?.gameStartAtUnix]);

  // Sync to Preparing state constraint
  useEffect(() => {
    if (roomData?.status === 'preparing' && currentUserOption) {
        const myPlayer = roomData.players.find(p => p.uid === currentUserOption.uid);
        // Only force ready if they weren't already ready
        if (myPlayer && !myPlayer.isReady) {
            const roomRef = doc(db, 'rooms', roomCode);
            runTransaction(db, async (t) => {
                const docSnap = await t.get(roomRef);
                if (!docSnap.exists()) return;
                const data = docSnap.data();
                const newPlayers = data.players.map((p: any) => 
                    p.uid === currentUserOption.uid ? { ...p, isReady: true } : p
                );
                t.update(roomRef, { players: newPlayers });
            }).catch(console.error);
        }
    }
  }, [roomData?.status, currentUserOption, roomCode]);

  // Host triggers final game start after all players ready
  useEffect(() => {
    if (roomData?.status === 'preparing' && roomData.hostId === currentUserOption?.uid) {
        const allReady = roomData.players.every(p => p.isReady);
        if (allReady && roomData.players.length > 0) {
            const roomRef = doc(db, 'rooms', roomCode);
            updateDoc(roomRef, {
                status: 'playing',
                gameStartAtUnix: Date.now() + 5000,
                startTime: serverTimestamp()
            }).catch(console.error);
        }
    }
  }, [roomData?.status, roomData?.players, roomData?.hostId, currentUserOption?.uid, roomCode]);

  // Sub-timer for elapsedTime

  useEffect(() => {
    if (roomData?.status === 'playing' && roomData?.startTime) {
      const interval = setInterval(() => {
         const startMs = roomData.startTime.toMillis ? roomData.startTime.toMillis() : Date.now();
         const diff = Math.floor((Date.now() - startMs) / 1000);
         if (diff >= 0) {
           const m = Math.floor(diff / 60).toString().padStart(2, '0');
           const s = (diff % 60).toString().padStart(2, '0');
           setElapsedTime(`${m}:${s}`);
         }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomData?.status, roomData?.startTime]);

  // Reward calculation and claim
  useEffect(() => {
    if (roomData?.status === 'finished' && currentUserOption) {
      const claimedList = JSON.parse(localStorage.getItem('claimed_rewards') || '[]');
      
      const sortedPlayers = [...roomData.players].sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const aTime = parseFloat(a.finishTime || "9999");
        const bTime = parseFloat(b.finishTime || "9999");
        return aTime - bTime;
      });

      const myRank = sortedPlayers.findIndex(p => p.uid === currentUserOption.uid) + 1;
      const myPlayerData = roomData.players.find(p => p.uid === currentUserOption.uid);

      if (myPlayerData && earnedCoins === null) {
        const correctAnswersCount = Math.round((myPlayerData.score / 100) * roomData.settings.jumlahSoal);
        
        let multiplier = 1 + ((roomData.settings.kelas - 1) * 0.2);
        if (roomData.settings.kelas >= 7 && roomData.settings.kelas <= 9) multiplier = 3;
        if (roomData.settings.kelas >= 10) multiplier = 5;

        const baseCoin = Math.round(correctAnswersCount * 5 * multiplier);
        const bonus = myRank === 1 ? 500 : myRank === 2 ? 200 : myRank === 3 ? 100 : 0;
        const totalReward = baseCoin + bonus;
        
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setEarnedCoins(totalReward);

        if (!claimedList.includes(roomCode)) {
          // Sync to Firestore
          const playerRef = doc(db, 'players', currentUserOption.uid);
          updateDoc(playerRef, {
            coins: increment(totalReward),
            updatedAt: serverTimestamp()
          }).catch(console.error);

          claimedList.push(roomCode);
          localStorage.setItem('claimed_rewards', JSON.stringify(claimedList));
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomData?.status, currentUserOption, roomCode]);

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
        status: 'preparing',
        questions: generatedQuestions
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

  const handleReturnToLobby = async () => {
    if (!roomCode || !roomData || isSubmitting) return;
    setIsSubmitting(true);
    
    try {
        const roomRef = doc(db, 'rooms', roomCode);
        await updateDoc(roomRef, {
            status: 'waiting',
            questions: [],
            startTime: null,
            gameStartAtUnix: null,
            players: roomData.players.map(p => ({
                ...p,
                progress: 0,
                isReady: false,
                isFinished: false,
                score: 0,
                finishTime: ""
            }))
        });
    } catch (error) {
        console.error("Error returning to lobby:", error);
        alert("Gagal kembali ke lobby.");
    } finally {
        setIsSubmitting(false);
    }
  };

  const handleReadyClick = async () => {
    if (!roomCode || !currentUserOption || isSubmitting) return;
    setIsSubmitting(true);
    try {
        const roomRef = doc(db, 'rooms', roomCode);
        await runTransaction(db, async (t) => {
            const docSnap = await t.get(roomRef);
            if (!docSnap.exists()) return;
            const data = docSnap.data();
            const updatedPlayers = data.players.map((p: any) =>
               p.uid === currentUserOption.uid ? { ...p, isReady: true } : p
            );
            t.update(roomRef, { players: updatedPlayers });
        });
    } catch(e) {
        console.error("Error setting ready", e);
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

  if (roomData.status === 'preparing' || roomData.status === 'playing') {
    const myPlayerData = roomData.players.find(p => p.uid === currentUserOption.uid);
    const totalSoal = roomData.settings.jumlahSoal;
    const progress = myPlayerData?.progress || 0;
    const currentQuestion = roomData.questions?.[progress];
    const isFinished = myPlayerData?.isFinished || false;

    return (
      <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8 bg-slate-50 overflow-x-hidden">
        {/* Countdown Overlay during 'playing' */ }
        {countdownTimer !== null && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 backdrop-blur-sm">
                <motion.div
                    key={countdownTimer}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 1.5, opacity: 0 }}
                    className="text-[150px] md:text-[250px] font-black text-white drop-shadow-[0_10px_20px_rgba(0,0,0,0.5)]"
                >
                    {countdownTimer}
                </motion.div>
                <div className="absolute top-20 md:top-32 text-center text-slate-300 font-black tracking-[0.3em] uppercase text-xl">
                    Semua Pemain Siap!
                </div>
            </div>
        )}

        {/* Realtime Compact Progress Bar for all players */}
        <div className={`w-full max-w-2xl ${isFinished ? 'mb-12' : 'mb-6'}`}>
            <div className="flex items-center justify-between mb-3 px-2">
               <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                   <Users size={14} /> Live Race
               </h3>
               <div className="text-xs font-black text-indigo-500 tracking-widest flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md border-2 border-indigo-200">
                   ⏱️ {elapsedTime}
               </div>
            </div>
            
            <div className="space-y-2">
               {roomData.players.map(p => {
                  const percent = Math.min((p.progress / totalSoal) * 100, 100);
                  const isMe = p.uid === currentUserOption.uid;
                  return (
                     <div key={p.uid} className={`flex items-center gap-2 p-1.5 border-2 ${isMe ? 'border-indigo-600 bg-indigo-50' : 'border-slate-800 bg-white'} rounded-xl shadow-[2px_2px_0px_0px_#0f172a]`}>
                        <div className="flex-1 relative h-6 bg-slate-200 rounded-lg border-2 border-slate-900 overflow-hidden flex items-center">
                           <motion.div 
                             initial={{ width: 0 }}
                             animate={{ width: `${percent}%` }}
                             transition={{ type: 'spring', bounce: 0.1, duration: 0.8 }}
                             className={`absolute top-0 left-0 h-full ${isMe ? 'bg-indigo-400' : 'bg-slate-300'} border-r-2 border-slate-900`}
                           />
                           <div className="relative z-10 px-3 text-[10px] sm:text-xs font-black text-slate-900 truncate uppercase w-full">
                               {p.name} {isMe && <span className="text-indigo-700 opacity-80 ml-1">(Kamu)</span>}
                           </div>
                        </div>
                        <div className="shrink-0 w-12 text-center text-[10px] sm:text-xs font-black text-slate-700 bg-white border-2 border-slate-900 rounded-md py-0.5">
                           {p.progress}/{totalSoal}
                        </div>
                     </div>
                  )
               })}
            </div>
        </div>

        {/* Gameplay Area */}
        {roomData.status === 'preparing' && (
            <motion.div 
               initial={{ opacity: 0, scale: 0.9 }}
               animate={{ opacity: 1, scale: 1 }}
               className="text-center mt-8 w-full max-w-2xl bg-white border-4 border-slate-900 p-10 rounded-[32px] shadow-[8px_8px_0px_0px_#0f172a]"
            >
               <Loader2 className="animate-spin text-indigo-600 w-16 h-16 mx-auto mb-6" />
               <h2 className="text-2xl md:text-3xl font-black text-slate-900 uppercase tracking-tighter mb-2">Sinkronisasi Pemain</h2>
               <p className="text-slate-500 font-bold uppercase tracking-widest text-sm">Menunggu seluruh pembalap bersiap...</p>
            </motion.div>
        )}

        {roomData.status === 'playing' && !isFinished && currentQuestion && (
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

  if (roomData.status === 'finished') {
    const sortedPlayers = [...roomData.players].sort((a, b) => {
        if (a.score !== b.score) return b.score - a.score;
        const aT = parseFloat(a.finishTime || "9999");
        const bT = parseFloat(b.finishTime || "9999");
        return aT - bT;
    });

    const rank1 = sortedPlayers[0];
    const rank2 = sortedPlayers[1];
    const rank3 = sortedPlayers[2];

    return (
      <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8 bg-slate-50 overflow-x-hidden">
        <h1 className="text-4xl md:text-6xl font-black uppercase text-slate-900 mb-2 tracking-tighter text-center">
            Hasil <span className="text-indigo-600">Pertandingan</span>
        </h1>
        <p className="text-xs md:text-sm font-black text-slate-500 uppercase tracking-widest mb-12">
            Kode Room: {roomCode}
        </p>

        {/* Podium Layout */}
        <div className="flex justify-center items-end h-48 md:h-64 gap-2 md:gap-4 mb-16 w-full max-w-3xl">
            {/* Rank 2 */}
            {rank2 ? (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }} className="w-24 md:w-32 h-36 md:h-48 bg-slate-200 border-4 border-slate-900 rounded-t-2xl shadow-[4px_4px_0px_0px_#0f172a] relative flex flex-col items-center justify-start pt-4 md:pt-6">
                    <div className="absolute -top-10 md:-top-12 w-14 h-14 md:w-16 md:h-16 bg-white border-4 border-slate-900 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm z-10">
                        {rank2.name.charAt(0)}
                    </div>
                    <Medal className="text-slate-400 mb-1 md:mb-2 w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
                    <span className="text-2xl md:text-3xl font-black text-slate-500 leading-none">2</span>
                    <div className="mt-auto pb-4 text-center">
                        <p className="text-[10px] md:text-xs font-bold text-slate-600 uppercase tracking-wider">{rank2.score}%</p>
                    </div>
                </motion.div>
            ) : <div className="w-24 md:w-32" />}

            {/* Rank 1 */}
            {rank1 && (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }} className="w-28 md:w-40 h-48 md:h-64 bg-amber-400 border-4 border-slate-900 rounded-t-2xl shadow-[4px_4px_0px_0px_#0f172a] relative flex flex-col items-center justify-start pt-4 md:pt-6 z-10">
                    <div className="absolute -top-12 md:-top-16 w-16 h-16 md:w-20 md:h-20 bg-white border-4 border-slate-900 rounded-3xl flex items-center justify-center font-black text-3xl md:text-4xl shadow-sm z-10 text-indigo-600">
                        {rank1.name.charAt(0)}
                    </div>
                    <Crown className="text-white mb-1 md:mb-2 w-8 h-8 md:w-10 md:h-10 drop-shadow-md" strokeWidth={2.5} />
                    <span className="text-3xl md:text-5xl font-black text-white leading-none drop-shadow-md">1</span>
                    <div className="mt-auto pb-4 text-center text-slate-900">
                        <p className="text-[10px] md:text-xs font-black uppercase tracking-wider">{rank1.score}% / {rank1.finishTime}</p>
                    </div>
                </motion.div>
            )}

            {/* Rank 3 */}
            {rank3 ? (
                <motion.div initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }} className="w-24 md:w-32 h-28 md:h-36 bg-orange-700 border-4 border-slate-900 rounded-t-2xl shadow-[4px_4px_0px_0px_#0f172a] relative flex flex-col items-center justify-start pt-4 md:pt-6">
                    <div className="absolute -top-10 md:-top-12 w-14 h-14 md:w-16 md:h-16 bg-white border-4 border-slate-900 rounded-2xl flex items-center justify-center font-black text-2xl shadow-sm z-10">
                        {rank3.name.charAt(0)}
                    </div>
                    <Award className="text-white/80 mb-1 md:mb-2 w-6 h-6 md:w-8 md:h-8" strokeWidth={2.5} />
                    <span className="text-2xl md:text-3xl font-black text-white/50 leading-none">3</span>
                    <div className="mt-auto pb-4 text-center">
                        <p className="text-[10px] md:text-xs font-bold text-white uppercase tracking-wider">{rank3.score}%</p>
                    </div>
                </motion.div>
            ) : <div className="w-24 md:w-32" />}
        </div>

        {/* Players List */}
        <div className="w-full max-w-3xl flex flex-col gap-3 mb-10">
            {sortedPlayers.map((player, index) => (
                <motion.div 
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.6 + (index * 0.1) }}
                    key={player.uid} 
                    className={`flex items-center p-4 border-4 border-slate-900 rounded-2xl ${player.uid === currentUserOption?.uid ? 'bg-indigo-50 border-indigo-600 ring-2 ring-indigo-200' : 'bg-white'} shadow-[4px_4px_0px_0px_#0f172a]`}
                >
                    <div className="w-8 md:w-10 font-black text-lg md:text-xl text-slate-400">
                        #{index + 1}
                    </div>
                    <div className="font-black text-slate-900 text-lg md:text-xl flex-1 truncate uppercase">
                        {player.name} {player.uid === currentUserOption?.uid && <span className="text-[10px] tracking-widest text-indigo-500 ml-2">(KAMU)</span>}
                    </div>
                    <div className="text-right">
                        <div className="font-black text-slate-900 text-lg md:text-xl">{player.score}%</div>
                        <div className="font-bold text-slate-500 text-[10px] md:text-xs">WAKTU: {player.finishTime}</div>
                    </div>
                </motion.div>
            ))}
        </div>

        {/* Reward Box */}
        {earnedCoins !== null && (
            <motion.div 
               initial={{ scale: 0.8, opacity: 0 }}
               animate={{ scale: 1, opacity: 1 }}
               transition={{ type: 'spring', delay: 1.5 }}
               className="bg-amber-100 border-4 border-slate-900 p-6 md:p-8 rounded-3xl w-full max-w-3xl text-center shadow-[8px_8px_0px_0px_#0f172a] relative overflow-hidden mb-12"
            >
               <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-200/50 to-transparent"></div>
               <div className="relative z-10">
                  <h3 className="text-sm font-black uppercase tracking-[0.2em] text-amber-700 mb-2">Total Hadiah</h3>
                  <div className="flex items-center justify-center gap-4">
                     <Coins size={48} className="text-amber-500 drop-shadow-sm" />
                     <span className="text-5xl md:text-7xl font-black text-slate-900 tracking-tighter">+{earnedCoins}</span>
                  </div>
                  <div className="mt-2 flex flex-col items-center">
                    <p className="text-xs font-black uppercase text-amber-600 tracking-widest">Koin ditambahkan ke profil</p>
                    {roomData.settings.kelas >= 7 && (
                      <span className="mt-1 inline-block px-3 py-1 bg-amber-500 text-white rounded-lg text-xs font-black uppercase tracking-[0.1em] animate-bounce">
                        Bonus Kesulitan: {roomData.settings.kelas >= 10 ? '5x' : '3x'}
                      </span>
                    )}
                    {roomData.settings.kelas < 7 && roomData.settings.kelas > 1 && (
                       <span className="mt-1 text-[10px] font-black uppercase text-amber-500 opacity-60">
                        Multiplier SD: {(1 + (roomData.settings.kelas - 1) * 0.2).toFixed(1)}x
                       </span>
                    )}
                  </div>
               </div>
            </motion.div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 mb-12 w-full max-w-xl">
           <button 
              onClick={handleReturnToLobby}
              disabled={isSubmitting}
              className="flex-1 px-8 py-5 bg-indigo-600 border-4 border-slate-900 rounded-2xl text-white font-black text-lg md:text-xl uppercase tracking-widest shadow-[6px_6px_0px_0px_#0f172a] hover:translate-x-1 hover:translate-y-1 hover:shadow-none hover:bg-indigo-500 transition-all flex items-center justify-center gap-3 disabled:bg-slate-400 disabled:shadow-none disabled:translate-y-1 disabled:translate-x-1"
           >
              <RotateCcw size={24} strokeWidth={3} /> {isSubmitting ? 'MEMPROSES...' : 'REMATCH / LOBBY'}
           </button>

           <button 
              onClick={() => router.push('/')}
              className="flex-1 px-8 py-5 bg-slate-900 border-4 border-slate-900 rounded-2xl text-white font-black text-lg md:text-xl uppercase tracking-widest shadow-[6px_6px_0px_0px_#0f172a] hover:translate-x-1 hover:translate-y-1 hover:shadow-none hover:bg-slate-800 transition-all flex items-center justify-center gap-3"
           >
              <Home size={24} /> Ke Beranda
           </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col items-center py-8 md:py-12 px-4 lg:px-8">
      {/* Header Bar */}
      <header className="w-full max-w-5xl flex justify-between items-center mb-8 md:mb-12 gap-2">
        <button 
          onClick={async () => {
             await handleLeaveRoom();
             router.push('/');
          }}
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
          className="text-7xl md:text-9xl font-black text-slate-900 tracking-[0.2em] mb-6 flex justify-center items-center cursor-pointer hover:text-indigo-600 transition-colors"
        >
          {roomData.roomCode}
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
              <div className="w-14 h-14 bg-gradient-to-tr from-pink-500 to-rose-400 rounded-xl border-2 border-slate-900 flex items-center justify-center text-white font-black text-2xl shrink-0 relative">
                {player.name.charAt(0).toUpperCase()}
                {player.isReady && !isHost && (
                   <div className="absolute -bottom-2 -right-2 bg-emerald-500 border-2 border-slate-900 rounded-full w-6 h-6 flex items-center justify-center text-[10px]">
                      ✅
                   </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xl font-black text-slate-900 uppercase truncate">{player.name}</h4>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                  {player.uid === roomData.hostId ? '👑 Room Host' : (player.isReady ? '✅ Selesai Persiapan' : '⚔️ Challenger')}
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
          <div className="space-y-4">
             {roomData.players.length > 1 && (() => {
                const nonHostPlayers = roomData.players.filter(p => p.uid !== roomData.hostId);
                const allReady = nonHostPlayers.every(p => p.isReady);
                
                if (!allReady) {
                   return (
                      <div className="py-6 border-4 border-slate-900 border-dashed rounded-2xl text-slate-500 font-black text-xl uppercase tracking-widest bg-slate-100 flex flex-col items-center justify-center gap-2">
                        <Loader2 className="animate-spin mb-2" size={32} /> 
                        <span className="text-center">Menunggu semua pemain <br className="sm:hidden" /> klik &quot;SIAP!&quot;...</span>
                        <span className="text-[10px] sm:text-xs text-rose-500">Host tidak dapat memulai game sebelum semua peserta siap.</span>
                      </div>
                   );
                }
                
                return (
                   <motion.button
                     whileHover={{ y: -4, x: -4, boxShadow: "12px 12px 0px 0px #0f172a" }}
                     whileTap={{ scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
                     onClick={handleStartGame}
                     className="w-full py-6 bg-emerald-500 border-4 border-slate-900 rounded-2xl text-white font-black text-3xl uppercase tracking-widest shadow-[8px_8px_0px_0px_#0f172a] flex items-center justify-center gap-4 transition-all"
                   >
                     <Play fill="currentColor" size={32} /> Mulai Game
                   </motion.button>
                );
             })()}
             
             {/* If only host in room */}
             {roomData.players.length === 1 && (
                <div className="py-6 border-4 border-slate-900 border-dashed rounded-2xl text-slate-500 font-black text-xl uppercase tracking-widest bg-slate-100 flex items-center justify-center gap-4 text-center">
                  <span className="text-sm">Silakan tunggu kawan <br className="sm:hidden"/> atau bagikan kode room!</span>
                </div>
             )}
          </div>
        ) : (
          roomData.players.find(p => p.uid === currentUserOption?.uid)?.isReady ? (
            <div className="py-6 border-4 border-slate-900 border-dashed rounded-2xl text-slate-500 font-black text-xl uppercase tracking-widest bg-slate-100 flex items-center justify-center gap-4">
              <Loader2 className="animate-spin" size={28} /> Menunggu Host Memulai...
            </div>
          ) : (
            <motion.button
              whileHover={isSubmitting ? {} : { y: -4, x: -4, boxShadow: "12px 12px 0px 0px #0f172a" }}
              whileTap={isSubmitting ? {} : { scale: 0.98, x: 4, y: 4, boxShadow: "4px 4px 0px 0px #0f172a" }}
              onClick={handleReadyClick}
              disabled={isSubmitting}
              className={`w-full py-6 border-4 border-slate-900 rounded-2xl text-white font-black text-3xl uppercase tracking-widest transition-all ${isSubmitting ? 'bg-slate-400 shadow-none translate-x-1 translate-y-1' : 'bg-indigo-600 shadow-[8px_8px_0px_0px_#0f172a]'}`}
            >
              {isSubmitting ? 'MEMPROSES...' : 'SIAP!'}
            </motion.button>
          )
        )}
      </div>

      {/* Floating Chat UI for Lobby/Preparing */}
      {(roomData.status === 'waiting' || roomData.status === 'preparing') && (
         <>
            <div className="fixed bottom-6 right-6 z-40">
               {!isChatOpen && (
                  <button 
                     onClick={() => setIsChatOpen(true)} 
                     className="relative bg-indigo-600 text-white p-4 rounded-full shadow-[4px_4px_0px_0px_#0f172a] hover:translate-y-[-2px] border-4 border-slate-900 transition-all flex items-center justify-center"
                  >
                     <MessageSquare size={28} />
                     {unreadCount > 0 && (
                        <span className="absolute -top-2 -right-2 bg-rose-500 text-white text-xs font-black min-w-[28px] h-7 flex items-center justify-center rounded-full border-2 border-slate-900">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                     )}
                  </button>
               )}
            </div>

            {isChatOpen && (
               <motion.div 
                   initial={{ y: 20, opacity: 0, scale: 0.9 }} 
                   animate={{ y: 0, opacity: 1, scale: 1 }} 
                   className="fixed bottom-6 right-6 w-[340px] max-w-[calc(100vw-32px)] h-[450px] max-h-[70vh] bg-white border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] rounded-[24px] flex flex-col z-50 overflow-hidden"
               >
                  <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center shrink-0">
                     <h3 className="font-black tracking-widest uppercase text-sm flex items-center gap-2">
                        <MessageSquare size={16} /> Live Chat
                     </h3>
                     <button onClick={() => setIsChatOpen(false)} className="hover:text-rose-400 transition-colors p-1">
                        <X size={20} className="stroke-[3px]" />
                     </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50 flex flex-col min-h-0">
                     {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-50 space-y-2 mt-auto mb-auto">
                           <MessageSquare size={32} />
                           <span className="text-xs font-bold uppercase tracking-widest text-center">Belum ada obrolan.<br/>Sapa yang lain!</span>
                        </div>
                     ) : (
                        messages.map(m => {
                           const isMe = m.senderId === currentUserOption?.uid;
                           return (
                               <div key={m.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                                   <span className="text-[10px] font-bold text-slate-500 mb-1 mx-1 uppercase tracking-wider">{m.senderName}</span>
                                   <div className={`px-4 py-2 max-w-[85%] text-sm font-bold border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] break-words ${isMe ? 'bg-indigo-500 text-white rounded-2xl rounded-tr-md' : 'bg-white text-slate-800 rounded-2xl rounded-tl-md'}`}>
                                       {m.text}
                                   </div>
                               </div>
                           );
                        })
                     )}
                     <div ref={messagesEndRef} className="shrink-0" />
                  </div>
                  
                  <div className="p-3 bg-white border-t-4 border-slate-900 shrink-0">
                     <form onSubmit={handleSendMessage} className="flex gap-2">
                        <input 
                           type="text" 
                           value={chatInput} 
                           onChange={e => setChatInput(e.target.value)} 
                           maxLength={100} 
                           placeholder="Ketik pesan..." 
                           className="flex-1 bg-slate-100 border-2 border-slate-900 rounded-xl px-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-400" 
                        />
                        <button 
                           type="submit" 
                           disabled={!chatInput.trim()} 
                           className="bg-indigo-600 text-white p-2.5 rounded-xl border-2 border-slate-900 hover:bg-indigo-500 disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed shadow-[2px_2px_0px_0px_#0f172a] disabled:shadow-[2px_2px_0px_0px_#94a3b8] active:shadow-none active:translate-x-[2px] active:translate-y-[2px] disabled:active:translate-x-0 disabled:active:translate-y-0 disabled:active:shadow-[2px_2px_0px_0px_#94a3b8] transition-all flex items-center justify-center"
                        >
                           <Send size={18} strokeWidth={2.5} className={chatInput.trim() ? "translate-x-0.5 -translate-y-0.5" : ""} />
                        </button>
                     </form>
                  </div>
               </motion.div>
            )}
         </>
      )}

      {/* Voice Chat Component */}
      <VoiceChat 
        roomCode={roomCode} 
        appId={"0ce2dd48206541a39e21cec16f843e3e"} 
      />
    </main>
  );
}
