import { useState, useEffect } from 'react';
import { X, Bell, Volume2, Eye, Shield, Users, Hash } from 'lucide-react';
import { notifications } from '../services/notificationService';

interface CommunitySettingsProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: { username: string } | null;
}

export default function CommunitySettings({ isOpen, onClose, currentUser }: CommunitySettingsProps) {
  const [settings, setSettings] = useState({
    notifications: true,
    soundEffects: true,
    showOnlineStatus: true,
    compactMode: false,
    autoScroll: true,
    mentionsOnly: false
  });

  // Load saved settings
  useEffect(() => {
    const saved = localStorage.getItem('community_settings');
    if (saved) {
      setSettings(JSON.parse(saved));
    }
  }, []);

  const saveSettings = () => {
    localStorage.setItem('community_settings', JSON.stringify(settings));
    notifications.success('Paramètres Sauvegardés', 'Vos préférences de communauté ont été mises à jour.');
    onClose();
  };

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings(prev => ({ ...prev, [key]: !prev[key] }));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={onClose}>
      <div 
        className="rounded-lg p-6 max-w-md w-full mx-4 shadow-2xl" 
        style={{ backgroundColor: '#2f3136', border: '1px solid #202225' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#40444b' }}>
              <Hash className="w-6 h-6" style={{ color: '#96989d' }} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Paramètres</h3>
              <p className="text-sm" style={{ color: '#96989d' }}>Communauté</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#40444b] transition-colors"
          >
            <X className="w-5 h-5" style={{ color: '#96989d' }} />
          </button>
        </div>

        {/* Settings Sections */}
        <div className="space-y-6">
          {/* Notifications */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase" style={{ color: '#96989d' }}>
              Notifications
            </h4>
            
            <div className="space-y-2">
              <div 
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
                onClick={() => toggleSetting('notifications')}
              >
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5" style={{ color: '#96989d' }} />
                  <div>
                    <div className="text-white font-medium">Notifications push</div>
                    <div className="text-xs" style={{ color: '#72767d' }}>Recevoir des alertes pour nouveaux messages</div>
                  </div>
                </div>
                <div 
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${
                    settings.notifications ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                  }`}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.notifications ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              <div 
                className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
                onClick={() => toggleSetting('mentionsOnly')}
              >
                <div className="flex items-center gap-3">
                  <Shield className="w-5 h-5" style={{ color: '#96989d' }} />
                  <div>
                    <div className="text-white font-medium">Mentions uniquement</div>
                    <div className="text-xs" style={{ color: '#72767d' }}>Seulement quand quelqu'un me mentionne</div>
                  </div>
                </div>
                <div 
                  className={`w-10 h-6 rounded-full p-1 transition-colors ${
                    settings.mentionsOnly ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                  }`}
                >
                  <div 
                    className={`w-4 h-4 rounded-full bg-white transition-transform ${
                      settings.mentionsOnly ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Audio */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase" style={{ color: '#96989d' }}>
              Audio
            </h4>
            
            <div 
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
              onClick={() => toggleSetting('soundEffects')}
            >
              <div className="flex items-center gap-3">
                <Volume2 className="w-5 h-5" style={{ color: '#96989d' }} />
                <div>
                  <div className="text-white font-medium">Effets sonores</div>
                  <div className="text-xs" style={{ color: '#72767d' }}>Son lors de l'envoi/réception de messages</div>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full p-1 transition-colors ${
                  settings.soundEffects ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.soundEffects ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Affichage */}
          <div className="space-y-3">
            <h4 className="text-sm font-semibold uppercase" style={{ color: '#96989d' }}>
              Affichage
            </h4>
            
            <div 
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
              onClick={() => toggleSetting('showOnlineStatus')}
            >
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5" style={{ color: '#96989d' }} />
                <div>
                  <div className="text-white font-medium">Statut en ligne</div>
                  <div className="text-xs" style={{ color: '#72767d' }}>Afficher mon statut aux autres membres</div>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full p-1 transition-colors ${
                  settings.showOnlineStatus ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.showOnlineStatus ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
              onClick={() => toggleSetting('compactMode')}
            >
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5" style={{ color: '#96989d' }} />
                <div>
                  <div className="text-white font-medium">Mode compact</div>
                  <div className="text-xs" style={{ color: '#72767d' }}>Messages plus condensés</div>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full p-1 transition-colors ${
                  settings.compactMode ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.compactMode ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <div 
              className="flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-[#32353b] transition-colors"
              onClick={() => toggleSetting('autoScroll')}
            >
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 flex items-center justify-center" style={{ color: '#96989d' }}>
                  <span className="text-xs">↓</span>
                </div>
                <div>
                  <div className="text-white font-medium">Défilement auto</div>
                  <div className="text-xs" style={{ color: '#72767d' }}>Scroller vers les nouveaux messages</div>
                </div>
              </div>
              <div 
                className={`w-10 h-6 rounded-full p-1 transition-colors ${
                  settings.autoScroll ? 'bg-[#5865f2]' : 'bg-[#40444b]'
                }`}
              >
                <div 
                  className={`w-4 h-4 rounded-full bg-white transition-transform ${
                    settings.autoScroll ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>
          </div>

          {/* User Info */}
          <div className="p-3 rounded-lg" style={{ backgroundColor: '#202225' }}>
            <div className="text-sm" style={{ color: '#96989d' }}>Connecté en tant que</div>
            <div className="text-white font-medium">{currentUser?.username || 'Invité'}</div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={saveSettings}
            className="flex-1 py-2.5 rounded-lg font-medium text-white transition-colors"
            style={{ backgroundColor: '#5865f2' }}
          >
            Sauvegarder
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-lg font-medium transition-colors"
            style={{ color: '#96989d', backgroundColor: '#40444b' }}
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}
