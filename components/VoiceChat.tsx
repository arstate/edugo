"use client";

import { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Volume2, VolumeX, PhoneCall, Loader2 } from 'lucide-react';
import type { IAgoraRTCClient, IMicrophoneAudioTrack } from 'agora-rtc-sdk-ng';

interface VoiceChatProps {
  roomCode: string;
  appId: string;
}

export default function VoiceChat({ roomCode, appId }: VoiceChatProps) {
  const [isJoined, setIsJoined] = useState(false);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);

  const joinVoice = async () => {
    if (!appId || !roomCode) {
      console.error("App ID or Room Code missing");
      return;
    }
    
    setIsLoading(true);
    try {
      const AgoraRTC = (await import('agora-rtc-sdk-ng')).default;
      
      client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      // Event Listeners
      client.current.on("user-published", async (user, mediaType) => {
        await client.current!.subscribe(user, mediaType);
        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.current.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "audio" && user.audioTrack) {
          user.audioTrack.stop();
        }
      });

      // Join Channel
      await client.current.join(appId, roomCode, null, null);

      // Mic Permissions & Publish
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
      await client.current.publish([localAudioTrack.current]);

      setIsJoined(true);
    } catch (error) {
      console.error("Error joining voice chat:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleMic = async () => {
    if (!localAudioTrack.current) return;
    const newMuteState = !isMicOn;
    await localAudioTrack.current.setMuted(newMuteState);
    setIsMicOn(!newMuteState);
  };

  const toggleSpeaker = () => {
    if (!client.current) return;
    const newSpeakerState = !isSpeakerOn;
    
    client.current.remoteUsers.forEach(user => {
      if (user.audioTrack) {
        user.audioTrack.setVolume(newSpeakerState ? 100 : 0);
      }
    });
    setIsSpeakerOn(newSpeakerState);
  };

  const leaveVoice = async () => {
    if (localAudioTrack.current) {
      localAudioTrack.current.stop();
      localAudioTrack.current.close();
      localAudioTrack.current = null;
    }
    if (client.current) {
      await client.current.leave();
      client.current = null;
    }
    setIsJoined(false);
  };

  useEffect(() => {
    return () => {
      leaveVoice();
    };
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex gap-2 flex-col items-end">
      {!isJoined ? (
        <button
          onClick={joinVoice}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-full shadow-[4px_4px_0px_0px_#0f172a] border-2 border-slate-900 transition-all active:translate-x-1 active:translate-y-1 active:shadow-none disabled:opacity-50 disabled:cursor-not-allowed group"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <PhoneCall className="w-5 h-5 group-hover:scale-110 transition-transform" />
          )}
          <span className="uppercase tracking-tight text-sm">
            {isLoading ? "Menghubungkan..." : "Gabung Voice"}
          </span>
        </button>
      ) : (
        <div className="flex gap-2">
          {/* Mic Toggle */}
          <button
            onClick={toggleMic}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-2 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none ${
              isMicOn ? 'bg-white text-slate-900' : 'bg-rose-500 text-white'
            }`}
            title={isMicOn ? "Matikan Mic" : "Nyalakan Mic"}
          >
            {isMicOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {/* Speaker Toggle */}
          <button
            onClick={toggleSpeaker}
            className={`w-12 h-12 flex items-center justify-center rounded-full border-2 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] transition-all active:translate-x-1 active:translate-y-1 active:shadow-none ${
              isSpeakerOn ? 'bg-white text-slate-900' : 'bg-rose-500 text-white'
            }`}
            title={isSpeakerOn ? "Matikan Suara" : "Nyalakan Suara"}
          >
            {isSpeakerOn ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
          </button>
          
          {/* Leave Button */}
          <button
            onClick={leaveVoice}
            className="px-4 bg-slate-900 text-white font-black text-[10px] uppercase rounded-full border-2 border-slate-900 shadow-[4px_4px_0px_0px_#475569] transition-all hover:bg-slate-800"
          >
            Keluar
          </button>
        </div>
      )}
    </div>
  );
}
