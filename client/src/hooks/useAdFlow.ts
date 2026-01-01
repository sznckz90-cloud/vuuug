import { useState, useRef, useCallback } from 'react';

declare global {
  interface Window {
    show_10401872: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
  }
}

interface AdFlowResult {
  success: boolean;
  monetagWatched: boolean;
}

export function useAdFlow() {
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [adStep, setAdStep] = useState<'idle' | 'monetag' | 'complete'>('idle');
  const monetagStartTimeRef = useRef<number>(0);

  const showMonetagAd = useCallback((): Promise<{ success: boolean; watchedFully: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10401872 === 'function') {
        monetagStartTimeRef.current = Date.now();
        window.show_10401872()
          .then(() => {
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            const watchedAtLeast3Seconds = watchDuration >= 3000;
            resolve({ success: true, watchedFully: watchedAtLeast3Seconds, unavailable: false });
          })
          .catch((error) => {
            console.error('Monetag ad error:', error);
            const watchDuration = Date.now() - monetagStartTimeRef.current;
            const watchedAtLeast3Seconds = watchDuration >= 3000;
            resolve({ success: false, watchedFully: watchedAtLeast3Seconds, unavailable: false });
          });
      } else {
        resolve({ success: false, watchedFully: false, unavailable: true });
      }
    });
  }, []);

  const runAdFlow = useCallback(async (): Promise<AdFlowResult> => {
    setIsShowingAds(true);
    
    try {
      setAdStep('monetag');
      const monetagResult = await showMonetagAd();
      
      if (monetagResult.unavailable) {
        setAdStep('idle');
        return { success: false, monetagWatched: false };
      }
      
      if (!monetagResult.watchedFully) {
        setAdStep('idle');
        return { success: false, monetagWatched: false };
      }
      
      setAdStep('complete');
      
      return { 
        success: true, 
        monetagWatched: true
      };
    } finally {
      setIsShowingAds(false);
      setAdStep('idle');
    }
  }, [showMonetagAd]);

  return {
    isShowingAds,
    adStep,
    runAdFlow,
    showMonetagAd,
  };
}
