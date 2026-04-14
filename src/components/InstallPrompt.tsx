import { useState, useEffect } from 'react';
import { Download, X, Smartphone } from 'lucide-react';

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || 
        (window as any).navigator.standalone === true) {
      setIsInstalled(true);
      return;
    }

    // Detect iOS
    const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(isIOSDevice);

    // Listen for install prompt (Chrome/Edge/Android)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowPrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // For iOS, show prompt after a delay
    if (isIOSDevice) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (isIOS) {
      // iOS requires manual install
      return;
    }

    if (!deferredPrompt) return;

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      setIsInstalled(true);
    }
    setDeferredPrompt(null);
    setShowPrompt(false);
  };

  const dismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('install_prompt_dismissed', Date.now().toString());
  };

  // Don't show if already installed or dismissed recently
  if (isInstalled) return null;
  
  const dismissed = localStorage.getItem('install_prompt_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 24 * 60 * 60 * 1000) {
    return null;
  }

  if (!showPrompt) return null;

  return (
    <div className="fixed top-4 right-4 z-50 animate-fade-in">
      {isIOS ? (
        // iOS Instructions
        <div className="bg-crypto-card border border-crypto-border rounded-xl p-4 shadow-2xl max-w-xs">
          <div className="flex items-start justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 bg-crypto-blue/20 rounded-full flex items-center justify-center">
                <Smartphone className="w-5 h-5 text-crypto-blue" />
              </div>
              <div>
                <h3 className="font-semibold text-sm">Installer l'app</h3>
                <p className="text-xs text-gray-400">iPhone & iPad</p>
              </div>
            </div>
            <button onClick={dismiss} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-300 mb-3">
            Tape <span className="font-semibold text-crypto-blue">Partager</span> puis{' '}
            <span className="font-semibold text-crypto-blue">"Sur l'écran d'accueil"</span>
          </p>
          <div className="flex gap-2">
            <div className="flex-1 h-8 bg-crypto-dark rounded flex items-center justify-center">
              <span className="text-xs">📤 Partager</span>
            </div>
            <div className="flex-1 h-8 bg-crypto-dark rounded flex items-center justify-center">
              <span className="text-xs">➕ Ajouter</span>
            </div>
          </div>
        </div>
      ) : (
        // Android/Chrome Install Button
        <button
          onClick={handleInstall}
          className="group flex items-center gap-2 bg-gradient-to-r from-crypto-blue to-crypto-accent 
                     text-white px-4 py-3 rounded-full shadow-2xl shadow-crypto-blue/30
                     hover:shadow-crypto-blue/50 transition-all duration-300 
                     hover:scale-105 active:scale-95"
        >
          <Download className="w-5 h-5 animate-bounce" />
          <span className="font-semibold text-sm">Installer l'app</span>
          <div 
            onClick={(e) => { e.stopPropagation(); dismiss(); }}
            className="ml-2 p-1 rounded-full hover:bg-white/20 transition-colors"
          >
            <X className="w-4 h-4" />
          </div>
        </button>
      )}
    </div>
  );
}
