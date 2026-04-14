import { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

export default function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowBanner(true);
      setTimeout(() => setShowBanner(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowBanner(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check initial state
    if (!navigator.onLine) {
      setShowBanner(true);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    window.location.reload();
  };

  if (!showBanner) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 p-3 ${
      isOnline ? 'bg-green-500/90' : 'bg-red-500/90'
    } backdrop-blur-sm`}>
      <div className="flex items-center justify-center gap-3 text-white">
        {isOnline ? (
          <>
            <Wifi className="w-5 h-5" />
            <span className="font-medium">Connexion restaurée !</span>
          </>
        ) : (
          <>
            <WifiOff className="w-5 h-5" />
            <span className="font-medium">Mode hors-ligne - Données en cache</span>
            <button
              onClick={handleRefresh}
              className="ml-2 p-1.5 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
