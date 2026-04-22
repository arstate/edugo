'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { db, auth } from '../../../lib/firebase';
import { doc, onSnapshot, updateDoc, arrayUnion, arrayRemove, collection, addDoc, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';
import { generateMathQuestions } from '../../../lib/questionGenerator';
import { motion, AnimatePresence } from 'motion/react';
import { Users, Crown, Send, CheckCircle2, XCircle, Timer, Award, Rocket, Home, Mic, MicOff, Volume2, VolumeX, MessageSquare, ChevronRight } from 'lucide-react';
import dynamic from 'next/dynamic';

// Dynamic Import for VoiceChat to avoid SSR issues with Hydra/Navigator
const VoiceChat = dynamic(() => import('../../../components/VoiceChat'), { ssr: false });

export default function RoomPage() {
  const params = useParams();
  const roomCode = params.roomCode as string;
  const router = useRouter();
  
  const [roomData, setRoomData] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [answerState, setAnswerState] = useState<'idle' | 'correct' | 'wrong'>('idle');
  const [showConsent, setShowConsent] = useState(true);
  const [voiceActive, setVoiceActive] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  // Authenticate & Join
  useEffect(() => {
    if (!auth.currentUser) {
      router.push('/');
      return;
    }

    if (showConsent) return; // Wait for consent

    const roomRef = doc(db, 'rooms', roomCode);
    const unsubscribe = onSnapshot(roomRef, (snapshot) => {
      if (!snapshot.exists()) {
        setError('Room tidak ditemukan atau sudah dihapus.');
        return;
      }
      const data = snapshot.data();
      setRoomData(data);

      const myPlayer = data.players.find((p: any) => p.uid === auth.currentUser?.uid);
      if (!myPlayer) {
        // Automatically join if not in player list
        const playerName = localStorage.getItem('playerName') || 'Pemain';
        updateDoc(roomRef, {
          players: arrayUnion({
            uid: auth.currentUser?.uid,
            name: playerName,
            progress: 0,
            score: 0,
            isFinished: false,
            finishTime: null,
            isReady: false
          })
        });
      }
    });

    return () => unsubscribe();
  }, [roomCode]);

  // Chat Listener
  useEffect(() => {
    if (showConsent) return; // Wait for consent
    const q = query(collection(db, 'rooms', roomCode, 'messages'), orderBy('createdAt', 'asc'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, [roomCode]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Game Logic
  const myPlayerData = roomData?.players.find((p: any) => p.uid === auth.currentUser?.uid);
  const isHost = roomData?.hostId === auth.currentUser?.uid;

  useEffect(() => {
    if (roomData?.status === 'playing' && myPlayerData && !myPlayerData.isFinished) {
      const qIndex = myPlayerData.progress;
      if (roomData.questions[qIndex]) {
        setCurrentQuestion(roomData.questions[qIndex]);
      }
    }
  }, [roomData?.status, myPlayerData?.progress, roomData?.questions]);

  const handleReady = async () => {
    const roomRef = doc(db, 'rooms', roomCode);
    const newPlayers = roomData.players.map((p: any) => 
      p.uid === auth.currentUser?.uid ? { ...p, isReady: !p.isReady } : p
    );
    await updateDoc(roomRef, { players: newPlayers });
  };

  const handleStartGame = async () => {
    const roomRef = doc(db, 'rooms', roomCode);
    const questions = generateMathQuestions(roomData.settings.kelas, roomData.settings.jumlahSoal);
    await updateDoc(roomRef, {
      status: 'playing',
      questions,
      startTime: serverTimestamp(),
      gameStartAtUnix: Date.now()
    });
  };

  const handleAnswer = async (selected: string) => {
    if (answerState !== 'idle') return;

    const isCorrect = selected === currentQuestion.correctAnswer;
    setAnswerState(isCorrect ? 'correct' : 'wrong');

    setTimeout(async () => {
      const roomRef = doc(db, 'rooms', roomCode);
      const isLastQuestion = myPlayerData.progress + 1 >= roomData.settings.jumlahSoal;
      
      const newPlayers = roomData.players.map((p: any) => {
        if (p.uid === auth.currentUser?.uid) {
          const newScore = isCorrect ? p.score + 10 : p.score;
          const newProgress = p.progress + 1;
          const finished = isLastQuestion;
          let finishTime = p.finishTime;
          
          if (finished && !p.isFinished) {
            const duration = (Date.now() - (roomData.gameStartAtUnix || Date.now())) / 1000;
            finishTime = duration.toFixed(2) + "s";
          }
          
          return { ...p, score: newScore, progress: newProgress, isFinished: finished, finishTime };
        }
        return p;
      });

      await updateDoc(roomRef, { players: newPlayers });
      setAnswerState('idle');
      
      // If everyone is finished, maybe move to result? (Firestore trigger or manually check)
      const allFinished = newPlayers.every((p: any) => p.isFinished);
      if (allFinished) {
        await updateDoc(roomRef, { status: 'finished' });
      }
    }, 600);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    await addDoc(collection(db, 'rooms', roomCode, 'messages'), {
      sender: myPlayerData?.name || 'Pemain',
      text: chatInput,
      createdAt: serverTimestamp(),
      uid: auth.currentUser?.uid
    });
    setChatInput('');
  };

  const handleReturnToLobby = async () => {
    if (!isHost) return;
    const roomRef = doc(db, 'rooms', roomCode);
    const resetPlayers = roomData.players.map((p: any) => ({
      ...p,
      progress: 0,
      score: 0,
      isFinished: false,
      finishTime: null,
      isReady: false
    }));
    await updateDoc(roomRef, {
      status: 'waiting',
      questions: [],
      players: resetPlayers,
      startTime: null,
      gameStartAtUnix: null
    });
  };

  if (error) return (
    <div className="min-h-screen bg-rose-50 flex flex-col items-center justify-center p-6 text-center">
      <XCircle size={64} className="text-rose-500 mb-4" />
      <h1 className="text-3xl font-black text-slate-900 mb-2">Waduh!</h1>
      <p className="text-slate-500 font-bold mb-6">{error}</p>
      <button onClick={() => router.push('/')} className="bg-slate-900 text-white px-8 py-3 rounded-xl font-black border-4 border-slate-900 shadow-[4px_4px_0px_0px_#f43f5e] hover:shadow-none transition-all">Kembali</button>
    </div>
  );

  if (!roomData) return (
    <div className="min-h-screen bg-[#FDF6E3] flex items-center justify-center p-6">
      <div className="text-slate-900 font-black text-xl animate-pulse">Menghubungkan ke Lobby...</div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#FDF6E3] font-sans selection:bg-amber-200 overflow-x-hidden pb-24 md:pb-0">
      
      {/* Consent Modal for Autoplay/Voice */}
      <AnimatePresence>
        {showConsent && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white border-4 border-slate-900 p-8 rounded-[2.5rem] shadow-[12px_12px_0px_0px_#0f172a] max-w-md w-full text-center"
            >
              <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-slate-900">
                <Mic className="text-indigo-600" size={32} />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Aktifkan Voice Chat?</h2>
              <p className="text-slate-500 font-medium mb-8">Bergabunglah dalam obrolan suara real-time untuk koordinasi yang lebih baik dengan teman setim.</p>
              
              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => { setShowConsent(false); setVoiceActive(true); }}
                  className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:bg-indigo-500 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center justify-center gap-2"
                >
                  YUK, BERGABUNG!
                </button>
                <button 
                  onClick={() => { setShowConsent(false); setVoiceActive(false); }}
                  className="w-full bg-white text-slate-400 font-black py-3 rounded-xl hover:text-slate-600 transition-colors"
                >
                  Nanti Saja
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto h-screen flex flex-col md:flex-row">
        {/* Left Side: Main Gameplay/Lobby Area */}
        <div className="flex-1 p-6 md:p-8 flex flex-col h-full overflow-y-auto">
          {/* Top Bar */}
          <div className="flex justify-between items-center mb-10">
            <div className="flex items-center gap-4">
               <button onClick={() => router.push('/')} className="bg-white border-3 border-slate-900 p-2 rounded-xl hover:bg-amber-100 transition-colors shadow-[3px_3px_0px_0px_#0f172a]">
                 <Home size={24} />
               </button>
               <div>
                  <h1 className="text-2xl font-black text-slate-900">ROOM: {roomCode}</h1>
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{roomData.players.length}/6 PEMAIN • KELAS {roomData.settings.kelas}</p>
               </div>
            </div>
            {roomData.status === 'playing' && (
              <div className="bg-amber-400 px-6 py-2 rounded-full border-3 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] flex items-center gap-2 font-black text-slate-900">
                <Timer size={18} />
                SOAL {myPlayerData?.progress + 1}/{roomData.settings.jumlahSoal}
              </div>
            )}
          </div>

          {/* Lobby Content */}
          <AnimatePresence mode="wait">
            {roomData.status === 'waiting' && (
              <motion.div 
                key="waiting"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col items-center justify-center text-center py-12"
              >
                <div className="w-24 h-24 bg-white border-4 border-slate-900 rounded-3xl shadow-[8px_8px_0px_0px_#0f172a] flex items-center justify-center mb-8 rotate-3">
                  <Users size={48} className="text-indigo-600" />
                </div>
                <h2 className="text-4xl font-black text-slate-900 mb-4 tracking-tighter">MENUNGGU PEMAIN...</h2>
                <p className="max-w-md text-slate-500 font-bold mb-10">Kirim kode <span className="text-indigo-600 bg-indigo-50 px-2 rounded">{roomCode}</span> ke temanmu untuk bertanding bersama!</p>
                
                <div className="flex flex-wrap justify-center gap-4 mb-12">
                   {roomData.players.map((player: any) => (
                     <div key={player.uid} className="relative">
                        <div className={`p-4 rounded-2xl border-4 border-slate-900 min-w-[120px] shadow-[4px_4px_0px_0px_#0f172a] ${player.isReady ? 'bg-emerald-100' : 'bg-white'}`}>
                           {player.uid === roomData.hostId && <Crown className="absolute -top-3 -right-3 text-amber-500 fill-amber-500 w-8 h-8 drop-shadow-[2px_2px_0px_#000]" />}
                           <div className="w-12 h-12 bg-slate-100 rounded-full mx-auto mb-2 border-2 border-slate-900 flex items-center justify-center">
                             <span className="font-black text-xl">{player.name[0]}</span>
                           </div>
                           <p className="font-black text-slate-900 truncate">{player.name}</p>
                           <p className={`text-[10px] font-black uppercase ${player.isReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                             {player.isReady ? 'READY' : 'BELUM READY'}
                           </p>
                        </div>
                     </div>
                   ))}
                </div>

                <div className="flex gap-4">
                   <button 
                     onClick={handleReady}
                     className={`px-10 py-5 rounded-2xl border-4 border-slate-900 font-black text-xl shadow-[8px_8px_0px_0px_#0f172a] transition-all active:shadow-none active:translate-x-[2px] active:translate-y-[2px] ${
                        myPlayerData?.isReady ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-white hover:bg-emerald-400'
                     }`}
                   >
                     {myPlayerData?.isReady ? 'BATAL READY' : 'SAYA READY!'}
                   </button>

                   {isHost && (
                     <button 
                       disabled={!roomData.players.every((p: any) => p.isReady) || roomData.players.length < 1}
                       onClick={handleStartGame}
                       className="bg-indigo-600 text-white px-10 py-5 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] font-black text-xl hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-2"
                     >
                       MULAI GAME <ChevronRight strokeWidth={4} />
                     </button>
                   )}
                </div>
              </motion.div>
            )}

            {roomData.status === 'playing' && currentQuestion && !myPlayerData?.isFinished && (
              <motion.div 
                key="playing"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col"
              >
                <div className="bg-white border-4 border-slate-900 p-10 rounded-[2.5rem] shadow-[10px_10px_0px_0px_#0f172a] mb-10 min-h-[220px] flex items-center justify-center relative overflow-hidden">
                   <div className="absolute top-0 left-0 w-full h-2 bg-slate-100">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(myPlayerData.progress / roomData.settings.jumlahSoal) * 100}%` }}
                        className="h-full bg-indigo-500 transition-all duration-300"
                      />
                   </div>
                   <h2 className="text-4xl md:text-6xl font-black text-slate-900 text-center tracking-tight">{currentQuestion.question}</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   {currentQuestion.options.map((option: string, idx: number) => (
                     <motion.button
                       key={idx}
                       whileHover={{ scale: 1.02 }}
                       whileTap={{ scale: 0.98 }}
                       onClick={() => handleAnswer(option)}
                       disabled={answerState !== 'idle'}
                       className={`p-6 rounded-[1.5rem] border-4 border-slate-900 font-black text-2xl text-left transition-all flex items-center justify-between group shadow-[6px_6px_0px_0px_#0f172a]
                         ${answerState === 'correct' && option === currentQuestion.correctAnswer ? 'bg-emerald-500 text-white scale-105 z-10' : 
                           answerState === 'wrong' && option === currentQuestion.correctAnswer ? 'bg-emerald-200 border-emerald-500 text-slate-900 opacity-60' :
                           'bg-white text-slate-900 hover:bg-indigo-50 hover:text-indigo-600'}`}
                     >
                       <span>{option}</span>
                       <div className="w-10 h-10 rounded-xl border-2 border-slate-900 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                         <span className="text-sm">ALT+{idx+1}</span>
                       </div>
                     </motion.button>
                   ))}
                </div>
              </motion.div>
            )}

            {roomData.status === 'playing' && myPlayerData?.isFinished && (
               <motion.div 
                 key="waiting-finish"
                 initial={{ opacity: 0 }}
                 animate={{ opacity: 1 }}
                 className="flex-1 flex flex-col items-center justify-center text-center"
               >
                 <div className="bg-emerald-500 text-white w-20 h-20 rounded-full flex items-center justify-center mb-6 border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a]">
                   <CheckCircle2 size={40} />
                 </div>
                 <h2 className="text-4xl font-black text-slate-900 mb-2">SELESAI!</h2>
                 <p className="text-slate-500 font-bold text-xl mb-4">Skor Kamu: <span className="text-indigo-600 text-3xl">{myPlayerData.score}</span></p>
                 <div className="bg-white border-3 border-slate-900 px-6 py-2 rounded-full font-black text-slate-900 flex items-center gap-2">
                   <Timer size={16} /> WAKTU: {myPlayerData.finishTime}
                 </div>
                 <p className="mt-8 text-slate-400 font-black uppercase tracking-widest text-xs animate-pulse">Menunggu pemain lain selesai...</p>
               </motion.div>
            )}

            {roomData.status === 'finished' && (
              <motion.div 
                key="finished"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex-1 flex flex-col items-center"
              >
                <div className="bg-amber-400 border-4 border-slate-900 p-8 rounded-[2.5rem] shadow-[10px_10px_0px_0px_#0f172a] w-full max-w-2xl mb-12 relative">
                   <Crown className="absolute -top-10 left-1/2 -translate-x-1/2 text-amber-500 w-20 h-20 fill-amber-500 drop-shadow-[4px_4px_0px_#000]" />
                   <h2 className="mt-6 text-4xl font-black text-slate-900 text-center mb-8 tracking-tighter">PAPAN SKOR FINAL</h2>
                   
                   <div className="space-y-4">
                      {roomData.players
                        .sort((a: any, b: any) => b.score - a.score || parseFloat(a.finishTime) - parseFloat(b.finishTime))
                        .map((player: any, idx: number) => (
                          <div key={player.uid} className="bg-white border-3 border-slate-900 p-4 rounded-2xl flex items-center justify-between shadow-[4px_4px_0px_0px_#0f172a]">
                             <div className="flex items-center gap-4">
                                <span className={`w-10 h-10 rounded-lg flex items-center justify-center font-black text-xl border-2 border-slate-900 ${idx === 0 ? 'bg-amber-400' : 'bg-slate-100'}`}>
                                  {idx + 1}
                                </span>
                                <span className="font-black text-lg text-slate-900">{player.name} {player.uid === auth.currentUser?.uid && '(SAYA)'}</span>
                             </div>
                             <div className="flex items-center gap-6">
                                <div className="text-right">
                                   <p className="text-[10px] font-black text-slate-400 uppercase leading-none">SCORE</p>
                                   <p className="text-2xl font-black text-indigo-600">{player.score}</p>
                                </div>
                                <div className="text-right min-w-[80px]">
                                   <p className="text-[10px] font-black text-slate-400 uppercase leading-none">TIME</p>
                                   <p className="font-black text-slate-900">{player.finishTime}</p>
                                </div>
                             </div>
                          </div>
                      ))}
                   </div>
                </div>

                {isHost && (
                   <button 
                     onClick={handleReturnToLobby}
                     className="bg-indigo-600 text-white px-10 py-5 rounded-2xl border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] font-black text-xl hover:bg-indigo-500 active:shadow-none active:translate-x-[2px] active:translate-y-[2px] transition-all flex items-center gap-3"
                   >
                     <Rocket /> MAIN LAGI (LOBBY)
                   </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right Side: Chat & Players Sidebar - Always Visible or Slideable on Mobile */}
        <div className="w-full md:w-[380px] bg-white border-l-4 border-slate-900 flex flex-col h-[400px] md:h-screen fixed bottom-0 left-0 right-0 md:relative md:bottom-auto z-40">
           {/* Player List Summary */}
           <div className="p-6 border-b-4 border-slate-900 bg-slate-50 flex justify-between items-center">
              <div className="flex items-center gap-2 font-black text-slate-900">
                <Users size={18} /> PEMAIN ({roomData.players.length})
              </div>
              <div className="flex -space-x-2">
                 {roomData.players.map((p: any) => (
                   <div key={p.uid} className="w-8 h-8 rounded-full border-2 border-slate-900 bg-white flex items-center justify-center text-[10px] font-black" title={p.name}>
                     {p.name[0]}
                   </div>
                 ))}
              </div>
           </div>

           {/* Chat Messages */}
           <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F8FAFC]">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex flex-col ${msg.uid === auth.currentUser?.uid ? 'items-end' : 'items-start'}`}>
                   <span className="text-[10px] font-black text-slate-400 uppercase px-1 mb-0.5">{msg.sender}</span>
                   <div className={`max-w-[85%] p-3 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_#0f172a] text-sm font-bold
                     ${msg.uid === auth.currentUser?.uid ? 'bg-indigo-600 text-white' : 'bg-white text-slate-900'}`}>
                      {msg.text}
                   </div>
                </div>
              ))}
              <div ref={chatEndRef} />
           </div>

           {/* Chat Input */}
           <form onSubmit={handleSendMessage} className="p-6 border-t-4 border-slate-900 bg-white">
              <div className="relative">
                 <input 
                   type="text"
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   placeholder="Ketik pesan..."
                   className="w-full bg-slate-50 border-3 border-slate-900 p-4 pr-16 rounded-xl font-bold focus:outline-none focus:bg-white transition-all shadow-[4px_4px_0px_0px_#0f172a]"
                 />
                 <button type="submit" className="absolute right-3 top-1/2 -translate-y-1/2 bg-slate-900 text-white p-2 rounded-lg hover:bg-indigo-600 transition-colors">
                    <Send size={18} />
                 </button>
              </div>
           </form>
        </div>
      </div>

      {/* Realtime Voice Chat Integration - Conditionally rendered after consent */}
      {voiceActive && (
        <VoiceChat roomCode={roomCode} appId="0ce2dd48206541a39e21cec16f843e3e" />
      )}
    </main>
  );
}
