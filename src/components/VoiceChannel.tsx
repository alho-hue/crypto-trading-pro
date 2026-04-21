import { useState, useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Volume2, Users } from 'lucide-react';
import { notifications } from '../services/notificationService';

interface VoiceUser {
  id: string;
  username: string;
  isSpeaking: boolean;
  isMuted: boolean;
}

interface VoiceChannelProps {
  channelName: string;
  currentUser: { username: string } | null;
  onClose: () => void;
}

export default function VoiceChannel({ channelName, currentUser, onClose }: VoiceChannelProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [voiceUsers, setVoiceUsers] = useState<VoiceUser[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Simuler des utilisateurs en vocal
  useEffect(() => {
    if (isConnected) {
      // Ajouter l'utilisateur actuel
      const current: VoiceUser = {
        id: 'me',
        username: currentUser?.username || 'Anonyme',
        isSpeaking: false,
        isMuted: isMuted
      };
      
      // PAS D'UTILISATEURS SIMULÉS - Seulement l'utilisateur courant
      setVoiceUsers([current]);
    } else {
      setVoiceUsers([]);
    }
  }, [isConnected, currentUser, isMuted]);

  const connect = async () => {
    if (!currentUser) {
      notifications.warning('Connexion Requise', 'Connectez-vous pour rejoindre le canal vocal.');
      return;
    }
    
    setIsConnecting(true);
    
    try {
      // Demander accès au micro
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Créer l'audio pour le monitoring
      const audio = new Audio();
      audioRef.current = audio;
      
      // Simuler la connexion
      setTimeout(() => {
        setIsConnected(true);
        setIsConnecting(false);
      }, 1000);
      
    } catch (error) {
      console.error('Micro access denied:', error);
      notifications.error('Permission Microphone', 'Vous devez autoriser l\'accès au microphone pour utiliser le vocal.');
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    // Arrêter tous les streams audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    setIsConnected(false);
    setVoiceUsers([]);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    setVoiceUsers(users => 
      users.map(u => 
        u.id === 'me' ? { ...u, isMuted: !isMuted } : u
      )
    );
  };

  if (!isConnected) {
    return (
      <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-crypto-card rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <Phone className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Salon Vocal: {channelName}</h3>
            <p className="text-gray-400 mb-6">
              Rejoignez le salon vocal pour discuter en temps réel avec les autres traders.
            </p>
            <div className="flex gap-3">
              <button
                onClick={connect}
                disabled={isConnecting}
                className="flex-1 py-3 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium flex items-center justify-center gap-2"
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
                className="py-3 px-6 text-gray-400 hover:text-white"
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
      <div className="bg-crypto-card rounded-lg p-4 shadow-2xl border border-crypto-border w-72">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Volume2 className="w-5 h-5 text-green-500" />
            <span className="font-medium">{channelName}</span>
          </div>
          <button
            onClick={disconnect}
            className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
          >
            <PhoneOff className="w-4 h-4" />
          </button>
        </div>

        {/* Users */}
        <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
          {voiceUsers.map((user) => (
            <div
              key={user.id}
              className={`flex items-center gap-3 p-2 rounded-lg ${
                user.isSpeaking ? 'bg-green-500/20' : 'bg-crypto-dark'
              }`}
            >
              <div className="relative">
                <div className="w-8 h-8 rounded-full bg-crypto-blue flex items-center justify-center font-bold text-sm">
                  {(user.username || '?')[0].toUpperCase()}
                </div>
                {user.isSpeaking && (
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-crypto-card" />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{user.username}</div>
                <div className="text-xs text-gray-400">
                  {user.isMuted ? 'Muet' : user.isSpeaking ? 'Parle...' : 'En ligne'}
                </div>
              </div>
              {user.isMuted && <MicOff className="w-4 h-4 text-gray-400" />}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={toggleMute}
            className={`flex-1 py-2 rounded-lg font-medium flex items-center justify-center gap-2 ${
              isMuted
                ? 'bg-red-500/20 text-red-400'
                : 'bg-crypto-dark hover:bg-crypto-border'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            {isMuted ? 'Muet' : 'Actif'}
          </button>
          <div className="px-3 py-2 bg-crypto-dark rounded-lg flex items-center gap-2">
            <Users className="w-4 h-4 text-gray-400" />
            <span className="text-sm">{voiceUsers.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
