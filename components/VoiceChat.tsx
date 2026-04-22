'use client';

import { useEffect, useState, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack, IAgoraRTCRemoteUser } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface VoiceChatProps {
  roomCode: string;
  appId: string;
}

export default function VoiceChat({ roomCode, appId }: VoiceChatProps) {
  const [isMicOn, setIsMicOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteTracksRef = useRef<Map<string, IRemoteAudioTrack>>(new Map());

  useEffect(() => {
    let mounted = true;

    const initAgora = async () => {
      try {
        clientRef.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

        clientRef.current.on('user-published', async (user: IAgoraRTCRemoteUser, mediaType: 'audio' | 'video') => {
          if (mediaType === 'audio') {
            const remoteTrack = await clientRef.current!.subscribe(user, mediaType);
            remoteTracksRef.current.set(user.uid.toString(), remoteTrack);
            if (isSpeakerOn) {
              remoteTrack.play();
            }
          }
        });

        clientRef.current.on('user-unpublished', (user: IAgoraRTCRemoteUser) => {
          const remoteTrack = remoteTracksRef.current.get(user.uid.toString());
          if (remoteTrack) {
            remoteTrack.stop();
            remoteTracksRef.current.delete(user.uid.toString());
          }
        });

        await clientRef.current.join(appId, roomCode, null, null);

        const localTrack = await AgoraRTC.createMicrophoneAudioTrack();
        localTrackRef.current = localTrack;
        await localTrack.setMuted(!isMicOn);
        await clientRef.current.publish(localTrack);

        if (mounted) {
          setJoined(true);
        }
      } catch (err: any) {
        console.error('Agora Init Error:', err);
        if (mounted) {
          setError(err.message || 'Microphone access denied or connection error');
        }
      }
    };

    initAgora();

    return () => {
      mounted = false;
      const cleanup = async () => {
        if (localTrackRef.current) {
          localTrackRef.current.stop();
          localTrackRef.current.close();
          localTrackRef.current = null;
        }
        if (clientRef.current) {
          clientRef.current.removeAllListeners();
          await clientRef.current.leave();
          clientRef.current = null;
        }
        remoteTracksRef.current.clear();
      };
      cleanup();
    };
  }, [roomCode, appId]);

  const toggleMic = async () => {
    if (localTrackRef.current) {
      const nextState = !isMicOn;
      await localTrackRef.current.setMuted(!nextState);
      setIsMicOn(nextState);
    }
  };

  const toggleSpeaker = () => {
    const nextState = !isSpeakerOn;
    remoteTracksRef.current.forEach((track) => {
      if (nextState) {
        track.play();
      } else {
        track.stop();
      }
    });
    setIsSpeakerOn(nextState);
  };

  if (error) {
    return (
      <div className="fixed bottom-4 right-4 z-50 bg-rose-500 text-white p-3 rounded-xl border-2 border-slate-900 shadow-[4px_4px_0px_0px_#0f172a] text-[10px] font-black uppercase">
        Voice Error: {error}
      </div>
    );
  }

  if (!joined) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex gap-3 pointer-events-auto">
      <motion.button
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleMic}
        className={`w-14 h-14 rounded-2xl border-4 border-slate-900 flex items-center justify-center shadow-[4px_4px_0px_0px_#0f172a] transition-colors ${
          isMicOn ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
        }`}
      >
        {isMicOn ? <Mic size={24} strokeWidth={3} /> : <MicOff size={24} strokeWidth={3} />}
      </motion.button>

      <motion.button
        whileHover={{ scale: 1.1, y: -2 }}
        whileTap={{ scale: 0.9 }}
        onClick={toggleSpeaker}
        className={`w-14 h-14 rounded-2xl border-4 border-slate-900 flex items-center justify-center shadow-[4px_4px_0px_0px_#0f172a] transition-colors ${
          isSpeakerOn ? 'bg-indigo-500 text-white' : 'bg-slate-400 text-slate-900'
        }`}
      >
        {isSpeakerOn ? <Volume2 size={24} strokeWidth={3} /> : <VolumeX size={24} strokeWidth={3} />}
      </motion.button>
    </div>
  );
}
