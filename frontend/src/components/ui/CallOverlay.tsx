import React, { useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallOverlayProps {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  peerUsername: string;
  callType: 'audio' | 'video';
  onEndCall: () => void;
}

const CallOverlay: React.FC<CallOverlayProps> = ({ localStream, remoteStream, peerUsername, callType, onEndCall }) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(callType === 'audio');

  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center text-white">
      {/* Remote Video / Audio Placeholder */}
      <div className="relative w-full h-full max-w-5xl mx-auto flex items-center justify-center overflow-hidden">
        {callType === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            className="w-full h-full object-cover rounded-2xl"
          />
        ) : (
          <div className="flex flex-col items-center justify-center animate-pulse">
            <div className="w-32 h-32 bg-primary/30 rounded-full flex items-center justify-center text-5xl mb-6 shadow-[0_0_50px_rgba(var(--primary),0.5)]">
              {peerUsername[0].toUpperCase()}
            </div>
            <h2 className="text-3xl font-bold">{peerUsername}</h2>
            <p className="text-muted-foreground mt-2">Audio Call</p>
          </div>
        )}

        {/* Local Video Picture-in-Picture */}
        {callType === 'video' && (
          <div className="absolute bottom-24 right-6 w-32 md:w-48 aspect-[3/4] bg-zinc-800 rounded-xl overflow-hidden shadow-2xl border-2 border-primary/50">
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          </div>
        )}
      </div>

      {/* Control Bar */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-4 bg-zinc-900/80 p-4 rounded-full backdrop-blur-md border border-white/10 shadow-2xl">
        <Button
          variant="outline"
          size="icon"
          onClick={toggleMute}
          className={`rounded-full h-12 w-12 border-none ${isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
        >
          {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
        </Button>

        {callType === 'video' && (
          <Button
            variant="outline"
            size="icon"
            onClick={toggleVideo}
            className={`rounded-full h-12 w-12 border-none ${isVideoOff ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-white/10 hover:bg-white/20'}`}
          >
            {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
          </Button>
        )}

        <Button
          variant="destructive"
          size="icon"
          onClick={onEndCall}
          className="rounded-full h-14 w-14 hover:scale-105 transition-transform shadow-[0_0_20px_rgba(239,68,68,0.5)]"
        >
          <PhoneOff className="w-6 h-6" />
        </Button>
      </div>

      {/* Top Bar overlay */}
      <div className="absolute top-0 left-0 w-full p-6 bg-gradient-to-b from-black/80 to-transparent flex justify-between items-center">
        <div>
          <h3 className="text-xl font-bold">{peerUsername}</h3>
          <p className="text-sm text-green-400">Connected</p>
        </div>
      </div>
    </div>
  );
};

export default CallOverlay;
