'use client';

import { useState, useEffect, useRef } from 'react';
import AgoraRTC, { IAgoraRTCClient, IMicrophoneAudioTrack, IRemoteAudioTrack } from 'agora-rtc-sdk-ng';
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react';

const APP_ID = process.env.NEXT_PUBLIC_AGORA_APP_ID;

export default function VoiceChat({ roomCode }: { roomCode: string }) {
  const [micOn, setMicOn] = useState(true);
  const [audioOn, setAudioOn] = useState(true);
  const client = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrack = useRef<IMicrophoneAudioTrack | null>(null);
  const remoteTracks = useRef<Map<string, IRemoteAudioTrack>>(new Map());

  useEffect(() => {
    if (!APP_ID) return;

    const initAgora = async () => {
      client.current = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });

      client.current.on('user-published', async (user, mediaType) => {
        await client.current!.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          if (remoteAudioTrack) {
            remoteTracks.current.set(user.uid.toString(), remoteAudioTrack);
            if (audioOn) {
              remoteAudioTrack.play();
            } else {
              remoteAudioTrack.setEnabled(false);
            }
          }
        }
      });

      client.current.on('user-unpublished', (user) => {
        remoteTracks.current.delete(user.uid.toString());
      });

      await client.current.join(APP_ID, roomCode, null, null);
      
      localAudioTrack.current = await AgoraRTC.createMicrophoneAudioTrack();
      await client.current.publish(localAudioTrack.current);
    };

    initAgora();

    return () => {
      if (client.current) {
        client.current.leave();
      }
      if (localAudioTrack.current) {
        localAudioTrack.current.close();
      }
      remoteTracks.current.forEach(track => track.stop());
    };
  }, [roomCode]);

  useEffect(() => {
    if (localAudioTrack.current) {
      localAudioTrack.current.setEnabled(micOn);
    }
  }, [micOn]);

  useEffect(() => {
    remoteTracks.current.forEach(track => {
      track.setEnabled(audioOn);
    });
  }, [audioOn]);

  return (
    <div className="fixed bottom-4 left-4 z-50 flex gap-2">
      <button
        onClick={() => setMicOn(!micOn)}
        className={`p-3 rounded-full ${micOn ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-lg`}
      >
        {micOn ? <Mic size={24} /> : <MicOff size={24} />}
      </button>
      <button
        onClick={() => setAudioOn(!audioOn)}
        className={`p-3 rounded-full ${audioOn ? 'bg-blue-600' : 'bg-red-600'} text-white shadow-lg`}
      >
        {audioOn ? <Volume2 size={24} /> : <VolumeX size={24} />}
      </button>
    </div>
  );
}
