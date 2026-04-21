import { useState, useEffect, useRef, useCallback } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Users, Headphones } from 'lucide-react';

// WebRTC configuration
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

interface VoiceUser {
  id: string;
  username: string;
  stream?: MediaStream;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface RealVoiceChannelProps {
  channelName: string;
  currentUser: { username: string; id: string } | null;
  onClose: () => void;
  socket: any; // Socket.io instance
}

export default function RealVoiceChannel({ channelName, currentUser, onClose, socket }: RealVoiceChannelProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const audioElementsRef = useRef<Map<string, HTMLAudioElement>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Initialize WebRTC connection
  const connect = async () => {
    if (!currentUser) {
      setError('Connectez-vous pour rejoindre le vocal');
      return;
    }
    
    setIsConnecting(true);
    setError(null);
    
    try {
      // Get user media (microphone)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 48000
        },
        video: false 
      });
      
      localStreamRef.current = stream;
      
      // Add self to users list
      setVoiceUsers([{
        id: currentUser.id,
        username: currentUser.username,
        stream: stream,
        isSpeaking: false,
        isMuted: false
      }]);
      
      // Join voice channel via socket
      socket.emit('join-voice', {
        channel: channelName,
        userId: currentUser.id,
        username: currentUser.username
      });
      
      setIsConnected(true);
      setIsConnecting(false);
      
      // Start audio level monitoring for speaking indicator
      startAudioLevelMonitoring();
      
    } catch (err: any) {
      console.error('Microphone access error:', err);
      setError(err.name === 'NotAllowedError' 
        ? 'Vous devez autoriser l\'accès au microphone'
        : 'Erreur d\'accès au microphone'
      );
      setIsConnecting(false);
    }
  };

  // Disconnect from voice channel
  const disconnect = useCallback(() => {
    // Stop audio level monitoring
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    
    // Stop local stream
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    // Close all peer connections
    peerConnectionsRef.current.forEach((pc, userId) => {
      pc.close();
      const audioEl = audioElementsRef.current.get(userId);
      if (audioEl) {
        audioEl.remove();
        audioElementsRef.current.delete(userId);
      }
    });
    peerConnectionsRef.current.clear();
    
    // Leave voice channel
    socket.emit('leave-voice', {
      channel: channelName,
      userId: currentUser?.id
    });
    
    setIsConnected(false);
    setVoiceUsers([]);
  }, [channelName, currentUser?.id, socket]);

  // Create peer connection for new user
  const createPeerConnection = useCallback((userId: string, username: string) => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    
    // Add local stream tracks to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Handle incoming stream
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      
      // Create audio element for remote user
      const audioEl = new Audio();
      audioEl.srcObject = remoteStream;
      audioEl.autoplay = true;
      audioEl.id = `audio-${userId}`;
      document.body.appendChild(audioEl);
      audioElementsRef.current.set(userId, audioEl);
      
      setVoiceUsers(prev => {
        const exists = prev.find(u => u.id === userId);
        if (exists) {
          return prev.map(u => u.id === userId ? { ...u, stream: remoteStream } : u);
        }
        return [...prev, { id: userId, username, stream: remoteStream, isSpeaking: false, isMuted: false }];
      });
    };
    
    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice-candidate', {
          channel: channelName,
          targetUserId: userId,
          candidate: event.candidate
        });
      }
    };
    
    peerConnectionsRef.current.set(userId, pc);
    return pc;
  }, [channelName, socket]);

  // WebSocket event handlers
  useEffect(() => {
    if (!isConnected) return;
    
    // User joined voice channel
    const handleUserJoined = async ({ userId, username }: { userId: string; username: string }) => {
      if (userId === currentUser?.id) return;
      
      const pc = createPeerConnection(userId, username);
      
      // Create and send offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      socket.emit('voice-offer', {
        channel: channelName,
        targetUserId: userId,
        offer: offer
      });
    };
    
    // Receive offer
    const handleOffer = async ({ userId, username, offer }: any) => {
      if (userId === currentUser?.id) return;
      
      const pc = createPeerConnection(userId, username);
      await pc.setRemoteDescription(offer);
      
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      socket.emit('voice-answer', {
        channel: channelName,
        targetUserId: userId,
        answer: answer
      });
    };
    
    // Receive answer
    const handleAnswer = async ({ userId, answer }: any) => {
      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        await pc.setRemoteDescription(answer);
      }
    };
    
    // Receive ICE candidate
    const handleIceCandidate = async ({ userId, candidate }: any) => {
      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    };
    
    // User left
    const handleUserLeft = ({ userId }: { userId: string }) => {
      const pc = peerConnectionsRef.current.get(userId);
      if (pc) {
        pc.close();
        peerConnectionsRef.current.delete(userId);
      }
      
      const audioEl = audioElementsRef.current.get(userId);
      if (audioEl) {
        audioEl.remove();
        audioElementsRef.current.delete(userId);
      }
      
      setVoiceUsers(prev => prev.filter(u => u.id !== userId));
    };
    
    socket.on('voice-user-joined', handleUserJoined);
    socket.on('voice-offer', handleOffer);
    socket.on('voice-answer', handleAnswer);
    socket.on('ice-candidate', handleIceCandidate);
    socket.on('voice-user-left', handleUserLeft);
    
    return () => {
      socket.off('voice-user-joined', handleUserJoined);
      socket.off('voice-offer', handleOffer);
      socket.off('voice-answer', handleAnswer);
      socket.off('ice-candidate', handleIceCandidate);
      socket.off('voice-user-left', handleUserLeft);
    };
  }, [isConnected, channelName, currentUser?.id, socket, createPeerConnection]);

  // Start audio level monitoring
  const startAudioLevelMonitoring = () => {
    if (!localStreamRef.current) return;
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    const source = audioContext.createMediaStreamSource(localStreamRef.current);
    source.connect(analyser);
    
    audioContextRef.current = audioContext;
    analyserRef.current = analyser;
    
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    
    const checkAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
      const isSpeaking = average > 20; // Threshold for speaking
      
      setVoiceUsers(users => 
        users.map(u => 
          u.id === currentUser?.id ? { ...u, isSpeaking } : u
        )
      );
      
      // Notify others of speaking state change
      socket.emit('voice-speaking', {
        channel: channelName,
        userId: currentUser?.id,
        isSpeaking
      });
      
      animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
    };
    
    checkAudioLevel();
  };

  // Toggle mute
  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        
        setVoiceUsers(users => 
          users.map(u => 
            u.id === currentUser?.id ? { ...u, isMuted: !audioTrack.enabled, isSpeaking: false } : u
          )
        );
        
        // Notify others
        socket.emit('voice-mute', {
          channel: channelName,
          userId: currentUser?.id,
          isMuted: !audioTrack.enabled
        });
      }
    }
  };

  // Handle speaking updates from other users
  useEffect(() => {
    if (!isConnected) return;
    
    const handleSpeaking = ({ userId, isSpeaking }: { userId: string; isSpeaking: boolean }) => {
      setVoiceUsers(prev => 
        prev.map(u => 
          u.id === userId ? { ...u, isSpeaking } : u
        )
      );
    };
    
    socket.on('voice-speaking', handleSpeaking);
    return () => {
      socket.off('voice-speaking', handleSpeaking);
    };
  }, [isConnected, socket]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  if (!isConnected) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-gradient-to-br from-[#2f3136] to-[#1a1b1e] rounded-xl p-8 max-w-md w-full mx-4 border border-[#40444b] shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/20">
              <Headphones className="w-10 h-10 text-white" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-2">Salon Vocal</h3>
            <p className="text-[#96989d] mb-2">{channelName}</p>
            <p className="text-sm text-[#72767d] mb-8">
              Connexion audio en temps réel via WebRTC
            </p>
            
            {error && (
              <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={connect}
                disabled={isConnecting}
                className="flex-1 py-3.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-500/20"
              >
                {isConnecting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Connexion...
                  </>
                ) : (
                  <>
                    <Phone className="w-5 h-5" />
                    Rejoindre
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-6 py-3.5 text-[#96989d] hover:text-white hover:bg-[#40444b] rounded-lg transition-all"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-gradient-to-br from-[#2f3136] to-[#1a1b1e] rounded-xl p-4 shadow-2xl border border-[#40444b] w-80">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center">
              <Volume2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="font-semibold text-white">{channelName}</div>
              <div className="text-xs text-green-400 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                Connecté
              </div>
            </div>
          </div>
          <button
            onClick={disconnect}
            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
          >
            <PhoneOff className="w-5 h-5" />
          </button>
        </div>

        {/* Users in voice */}
        <div className="space-y-2 mb-4 max-h-56 overflow-y-auto">
          {voiceUsers.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                user.isSpeaking 
                  ? 'bg-green-500/10 border border-green-500/30' 
                  : 'bg-[#1a1b1e]'
              }`}
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-crypto-blue to-purple-600 flex items-center justify-center font-bold text-sm text-white">
                  {(user.username || '?')[0].toUpperCase()}
                </div>
                {user.isSpeaking && (
                  <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-[#2f3136]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-white truncate">
                  {user.username}
                  {user.id === currentUser?.id && (
                    <span className="ml-2 text-xs text-crypto-blue">(vous)</span>
                  )}
                </div>
                <div className="text-xs text-[#72767d]">
                  {user.isMuted ? 'Muet' : user.isSpeaking ? 'En parle...' : 'Connecté'}
                </div>
              </div>
              {user.isMuted && <MicOff className="w-4 h-4 text-[#72767d]" />}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className={`flex-1 py-2.5 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
              isMuted
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'bg-[#40444b] text-white hover:bg-[#4a4d52]'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isMuted ? 'Muet' : 'Actif'}
          </button>
          <div className="px-4 py-2.5 bg-[#1a1b1e] rounded-lg flex items-center gap-2 border border-[#40444b]">
            <Users className="w-4 h-4 text-[#72767d]" />
            <span className="text-sm font-medium">{voiceUsers.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
