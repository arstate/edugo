'use client';

import { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Volume2, VolumeX, PhoneIncoming } from 'lucide-react';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;

export default function VoiceChat({ roomCode }: { roomCode: string }) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isSpeakerOff, setIsSpeakerOff] = useState(false);
  
  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const joinVoiceChat = async () => {
    if (!APP_ID) return;

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
  };

  const toggleMic = () => {
    if (localAudioTrack.current) {
      localAudioTrack.current.setMuted(!isMicMuted);
      setIsMicMuted(!isMicMuted);
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
          className="z-50 flex items-center gap-3 px-6 py-4 bg-emerald-500 text-white font-black uppercase tracking-widest rounded-full border-4 border-slate-900 shadow-[6px_6px_0px_0px_#0f172a] hover:bg-emerald-400 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none"
        >
          <PhoneIncoming size={24} /> Gabung Voice Chat
        </button>
      ) : (
        <div className="fixed bottom-4 left-4 z-50 flex gap-2">
          <button
            onClick={toggleMic}
            className={`p-4 rounded-full ${!isMicMuted ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-[4px_4px_0px_0px_#0f172a] border-2 border-slate-900`}
          >
            {!isMicMuted ? <Mic size={24} /> : <MicOff size={24} />}
          </button>
          <button
            onClick={toggleSpeaker}
            className={`p-4 rounded-full ${!isSpeakerOff ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-[4px_4px_0px_0px_#0f172a] border-2 border-slate-900`}
          >
            {!isSpeakerOff ? <Volume2 size={24} /> : <VolumeX size={24} />}
          </button>
        </div>
      )}
    </>
  );
}
