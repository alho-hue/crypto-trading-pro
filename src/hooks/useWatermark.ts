import { useEffect, useState, useCallback, useRef } from 'react';

// =============================================================================
// NEUROVEST WATERMARK HOOK
// Hook personnalisé pour faciliter l'intégration des watermarks
// =============================================================================

interface UserInfo {
  username: string;
  userId: string;
}

interface WatermarkOptions {
  /** Activer le mode dynamique (changement de position toutes les 30s) */
  dynamic?: boolean;
  /** Texte personnalisé à afficher */
  customText?: string;
  /** Opacité de la watermark (0.01 - 0.1) */
  opacity?: number;
  /** Rotation en degrés */
  rotation?: number;
  /** Position sur l'écran */
  position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  /** Mode chart : watermark plus discrète */
  chartMode?: boolean;
}

interface WatermarkState {
  userInfo: UserInfo | null;
  currentTime: Date;
  position: { x: number; y: number };
  opacity: number;
  watermarkText: string;
  userWatermarkText: string;
}

// Positions dynamiques pour le mode PRO
const DYNAMIC_POSITIONS = [
  { x: 50, y: 50 },
  { x: 45, y: 48 },
  { x: 55, y: 52 },
  { x: 48, y: 55 },
  { x: 52, y: 45 },
  { x: 40, y: 50 },
  { x: 60, y: 50 },
] as const;

/**
 * Hook pour récupérer les informations utilisateur depuis localStorage
 */
export function useUserInfo(): UserInfo | null {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  useEffect(() => {
    const loadUserInfo = () => {
      try {
        const userData = localStorage.getItem('user');
        if (userData) {
          const parsed = JSON.parse(userData);
          setUserInfo({
            username: parsed.username || parsed.name || 'guest',
            userId: parsed.id || parsed._id || 'unknown',
          });
        } else {
          setUserInfo({ username: 'guest', userId: 'unknown' });
        }
      } catch {
        setUserInfo({ username: 'guest', userId: 'unknown' });
      }
    };

    loadUserInfo();

    // Écouter les changements de localStorage
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'user') {
        loadUserInfo();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return userInfo;
}

/**
 * Hook pour la position dynamique (change toutes les 30 secondes)
 */
export function useDynamicPosition(enabled: boolean = false) {
  const [positionIndex, setPositionIndex] = useState(0);

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => {
      setPositionIndex((prev) => (prev + 1) % DYNAMIC_POSITIONS.length);
    }, 30000);

    return () => clearInterval(interval);
  }, [enabled]);

  return DYNAMIC_POSITIONS[positionIndex];
}

/**
 * Hook pour l'opacité pulsante subtile
 */
export function usePulsatingOpacity(enabled: boolean = false, baseOpacity: number = 0.03) {
  const [opacity, setOpacity] = useState(baseOpacity);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) {
      setOpacity(baseOpacity);
      return;
    }

    let startTime: number | null = null;
    const duration = 5000; // 5 secondes pour un cycle

    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = (timestamp - startTime) % duration;
      const variation = Math.sin((progress / duration) * Math.PI * 2) * 0.01;
      
      setOpacity(Math.max(0.02, Math.min(0.05, baseOpacity + variation)));
      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [enabled, baseOpacity]);

  return opacity;
}

/**
 * Hook principal pour la gestion complète des watermarks
 */
export function useWatermark(options: WatermarkOptions = {}): WatermarkState {
  const {
    dynamic = false,
    customText,
    opacity: baseOpacity = 0.03,
    chartMode = false,
  } = options;

  const userInfo = useUserInfo();
  const [currentTime, setCurrentTime] = useState(new Date());
  const dynamicPosition = useDynamicPosition(dynamic);
  const pulsatingOpacity = usePulsatingOpacity(dynamic, baseOpacity);

  // Mise à jour de l'heure toutes les minutes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Génération du texte de watermark
  const watermarkText = customText || 'NEUROVEST';
  
  const userWatermarkText = userInfo
    ? `NEUROVEST • ${userInfo.username} • ${currentTime.getFullYear()}`
    : 'NEUROVEST';

  return {
    userInfo,
    currentTime,
    position: dynamic ? dynamicPosition : { x: 50, y: 50 },
    opacity: chartMode ? 0.035 : pulsatingOpacity,
    watermarkText,
    userWatermarkText,
  };
}

/**
 * Hook pour détecter si on est sur mobile
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}

/**
 * Hook pour générer un watermark de capture d'écran
 */
export function useScreenshotWatermark() {
  const userInfo = useUserInfo();
  
  const generateWatermark = useCallback(() => {
    const timestamp = new Date().toISOString();
    const username = userInfo?.username || 'guest';
    return {
      text: 'NEUROVEST',
      meta: `Generated by NEUROVEST • ${username} • ${timestamp}`,
      hash: btoa(`${username}-${timestamp}`).slice(0, 16),
    };
  }, [userInfo]);

  return generateWatermark;
}

/**
 * Hook pour les exports (PDF, CSV, etc.)
 */
export function useExportWatermark() {
  const userInfo = useUserInfo();

  const getExportText = useCallback((type: 'pdf' | 'csv' | 'json' = 'pdf') => {
    const date = new Date().toLocaleDateString();
    const username = userInfo?.username || 'User';
    
    switch (type) {
      case 'pdf':
        return `Generated by NEUROVEST • ${username} • ${date} • CONFIDENTIAL`;
      case 'csv':
        return `NEUROVEST Export - ${username} - ${date}`;
      case 'json':
        return { source: 'NEUROVEST', user: username, date, confidential: true };
      default:
        return `NEUROVEST • ${username}`;
    }
  }, [userInfo]);

  return getExportText;
}

// Export par défaut
export default useWatermark;
