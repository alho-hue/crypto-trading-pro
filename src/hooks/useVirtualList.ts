/**
 * 📜 Hook useVirtualList
 * Virtualisation des listes longues pour performance optimale
 * N'affiche que les éléments visibles + buffer
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';

interface VirtualListOptions<T> {
  items: T[];
  itemHeight: number;
  overscan?: number; // Nombre d'éléments à rendre en dehors du viewport
  containerHeight: number;
  getItemKey?: (item: T, index: number) => string;
}

interface VirtualItem<T> {
  item: T;
  index: number;
  key: string;
  style: {
    position: 'absolute';
    top: number;
    height: number;
    width: '100%';
  };
}

interface VirtualListReturn<T> {
  virtualItems: VirtualItem<T>[];
  totalHeight: number;
  startIndex: number;
  endIndex: number;
  containerRef: React.RefObject<HTMLDivElement | null>;
  onScroll: (event: React.UIEvent<HTMLDivElement>) => void;
  scrollToIndex: (index: number, behavior?: ScrollBehavior) => void;
  isScrolling: boolean;
}

export function useVirtualList<T>(options: VirtualListOptions<T>): VirtualListReturn<T> {
  const {
    items,
    itemHeight,
    overscan = 5,
    containerHeight,
    getItemKey = (_, index) => index.toString()
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calcul des indices visibles
  const { virtualItems, totalHeight, startIndex, endIndex } = useMemo(() => {
    const totalItems = items.length;
    const totalHeight = totalItems * itemHeight;

    // Indices de début et fin visibles
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const endIndex = Math.min(totalItems - 1, startIndex + visibleCount + overscan * 2);

    // Générer les items virtuels
    const virtualItems: VirtualItem<T>[] = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < totalItems) {
        virtualItems.push({
          item: items[i],
          index: i,
          key: getItemKey(items[i], i),
          style: {
            position: 'absolute',
            top: i * itemHeight,
            height: itemHeight,
            width: '100%'
          }
        });
      }
    }

    return { virtualItems, totalHeight, startIndex, endIndex };
  }, [items, itemHeight, scrollTop, containerHeight, overscan, getItemKey]);

  // Gestionnaire de scroll
  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setIsScrolling(true);

    // Détecter fin du scroll
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Scroll vers un index spécifique
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current) {
      const scrollTop = index * itemHeight;
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior
      });
    }
  }, [itemHeight]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    containerRef,
    onScroll,
    scrollToIndex,
    isScrolling
  };
}

/**
 * Hook useDynamicVirtualList - Pour listes avec hauteurs variables
 */
interface DynamicVirtualListOptions<T> {
  items: T[];
  getItemHeight: (item: T, index: number) => number;
  overscan?: number;
  containerHeight: number;
  getItemKey?: (item: T, index: number) => string;
}

export function useDynamicVirtualList<T>(options: DynamicVirtualListOptions<T>) {
  const {
    items,
    getItemHeight,
    overscan = 3,
    containerHeight,
    getItemKey = (_, index) => index.toString()
  } = options;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const heightsRef = useRef<Map<number, number>>(new Map());
  const scrollTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Calculer les positions cumulées
  const { virtualItems, totalHeight, startIndex, endIndex } = useMemo(() => {
    const totalItems = items.length;
    
    // Calculer les positions de chaque item
    let currentTop = 0;
    const positions: { top: number; height: number }[] = [];
    
    for (let i = 0; i < totalItems; i++) {
      const height = heightsRef.current.get(i) || getItemHeight(items[i], i);
      positions.push({ top: currentTop, height });
      currentTop += height;
    }

    const totalHeight = currentTop;

    // Trouver l'index de début
    let startIndex = 0;
    for (let i = 0; i < positions.length; i++) {
      if (positions[i].top + positions[i].height >= scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
    }

    // Trouver l'index de fin
    let endIndex = positions.length - 1;
    for (let i = startIndex; i < positions.length; i++) {
      if (positions[i].top > scrollTop + containerHeight) {
        endIndex = Math.min(positions.length - 1, i + overscan);
        break;
      }
    }

    // Générer les items virtuels
    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      virtualItems.push({
        item: items[i],
        index: i,
        key: getItemKey(items[i], i),
        style: {
          position: 'absolute' as const,
          top: positions[i].top,
          height: positions[i].height,
          width: '100%'
        }
      });
    }

    return { virtualItems, totalHeight, startIndex, endIndex };
  }, [items, getItemHeight, scrollTop, containerHeight, overscan, getItemKey]);

  // Gestionnaire de scroll
  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setIsScrolling(true);

    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current);
    }

    scrollTimeoutRef.current = setTimeout(() => {
      setIsScrolling(false);
    }, 150);
  }, []);

  // Scroll vers un index
  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = 'smooth') => {
    if (containerRef.current && heightsRef.current.has(index)) {
      let scrollTop = 0;
      for (let i = 0; i < index; i++) {
        scrollTop += heightsRef.current.get(i) || 0;
      }
      
      containerRef.current.scrollTo({
        top: scrollTop,
        behavior
      });
    }
  }, []);

  // Mesurer et mettre à jour la hauteur d'un item
  const measureItem = useCallback((index: number, height: number) => {
    heightsRef.current.set(index, height);
  }, []);

  useEffect(() => {
    return () => {
      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, []);

  return {
    virtualItems,
    totalHeight,
    startIndex,
    endIndex,
    containerRef,
    onScroll,
    scrollToIndex,
    measureItem,
    isScrolling
  };
}

/**
 * Hook useWindowVirtualizer - Virtualisation basée sur la fenêtre (infinite scroll)
 */
interface WindowVirtualizerOptions<T> {
  items: T[];
  itemHeight: number;
  loadMore?: () => void;
  hasMore?: boolean;
  overscan?: number;
}

export function useWindowVirtualizer<T>(options: WindowVirtualizerOptions<T>) {
  const {
    items,
    itemHeight,
    loadMore,
    hasMore = false,
    overscan = 5
  } = options;

  const [scrollTop, setScrollTop] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);
  const loadingRef = useRef(false);

  // Mettre à jour la taille de la fenêtre
  useEffect(() => {
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gestion du scroll
  useEffect(() => {
    const handleScroll = () => {
      setScrollTop(window.scrollY);

      // Infinite scroll
      if (hasMore && loadMore && !loadingRef.current) {
        const scrollBottom = window.scrollY + windowHeight;
        const totalHeight = items.length * itemHeight;
        
        if (scrollBottom >= totalHeight - windowHeight * 2) {
          loadingRef.current = true;
          loadMore();
          setTimeout(() => {
            loadingRef.current = false;
          }, 500);
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items.length, itemHeight, windowHeight, hasMore, loadMore]);

  // Calcul des items visibles
  const { virtualItems, totalHeight } = useMemo(() => {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(windowHeight / itemHeight);
    const endIndex = Math.min(
      items.length - 1,
      startIndex + visibleCount + overscan * 2
    );

    const virtualItems = [];
    for (let i = startIndex; i <= endIndex; i++) {
      if (i >= 0 && i < items.length) {
        virtualItems.push({
          item: items[i],
          index: i,
          style: {
            position: 'absolute' as const,
            top: i * itemHeight,
            height: itemHeight,
            left: 0,
            right: 0
          }
        });
      }
    }

    return {
      virtualItems,
      totalHeight: items.length * itemHeight
    };
  }, [items, itemHeight, scrollTop, windowHeight, overscan]);

  return {
    virtualItems,
    totalHeight,
    scrollTop
  };
}
