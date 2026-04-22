'use client';

import { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Volume2, VolumeX, PhoneIncoming, Loader2 } from 'lucide-react';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;

export default function VoiceChat({ roomCode }: { roomCode: string }) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  
  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const joinVoiceChat = async () => {
    if (!APP_ID || isJoining || isJoined) return;
    setIsJoining(true);

    try {
      client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      client.current.on("user-published", async (user, mediaType) => {
        await client.current!.subscribe(user, mediaType);
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.play();
        }
      });

      await client.current.join(APP_ID, roomCode, null, null);
      
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
      await client.current.publish([localAudioTrack.current]);
      
      setIsJoined(true);
    } catch (err) {
       console.error("Agora join error:", err);
       alert("Gagal bergabung ke voice chat. Silakan periksa izin mikrofon Anda.");
    } finally {
       setIsJoining(false);
    }
  };

  const toggleMic = () => {
    if (localAudioTrack.current) {
      const nextMuted = !isMicMuted;
      localAudioTrack.current.setMuted(nextMuted);
      setIsMicMuted(nextMuted);
    }
  };

  const toggleSpeaker = () => {
    if (!client.current) return;
    
    const muted = !isSpeakerOff;
    client.current.remoteUsers.forEach(user => {
      if (user.audioTrack) {
        if (muted) {
          user.audioTrack.stop();
        } else {
          user.audioTrack.play();
        }
      }
    });
    setIsSpeakerOff(muted);
  };

  useEffect(() => {
    return () => {
      if (localAudioTrack.current) {
        localAudioTrack.current.stop();
        localAudioTrack.current.close();
      }
      if (client.current) {
        client.current.leave();
      }
    };
  }, []);

  return (
    <>
      {!isJoined ? (
        <button
          onClick={joinVoiceChat}
          disabled={isJoining}
          className="fixed bottom-32 left-1/2 -translate-x-1/2 z-[999] flex items-center gap-3 px-8 py-5 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-full border-4 border-slate-900 shadow-[8px_8px_0px_0px_#0f172a] hover:bg-emerald-400 transition-all active:translate-x-[4px] active:translate-y-[4px] active:shadow-none whitespace-nowrap disabled:opacity-75 disabled:cursor-wait"
        >
          {isJoining ? (
            <Loader2 className="animate-spin" size={28} />
          ) : (
            <PhoneIncoming size={28} />
          )}
          {isJoining ? 'Menghubungkan...' : 'Gabung Voice Chat'}
        </button>
      ) : (
        <div className="fixed bottom-4 left-4 z-[999] flex gap-3">
          <button
            onClick={toggleMic}
            className={`p-5 rounded-full ${!isMicMuted ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-[6px_6px_0px_0px_#0f172a] border-4 border-slate-900 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all`}
          >
            {!isMicMuted ? <Mic size={28} /> : <MicOff size={28} />}
          </button>
          <button
            onClick={toggleSpeaker}
            className={`p-5 rounded-full ${!isSpeakerOff ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-[6px_6px_0px_0px_#0f172a] border-4 border-slate-900 active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all`}
          >
            {!isSpeakerOff ? <Volume2 size={28} /> : <VolumeX size={28} />}
          </button>
        </div>
      )}
    </>
  );
}
