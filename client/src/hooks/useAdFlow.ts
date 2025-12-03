import { useState, useRef, useCallback } from 'react';

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
  }
}

interface AdFlowResult {
  success: boolean;
  monetagWatched: boolean;
  adsgramWatched: boolean;
}

export function useAdFlow() {
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [adStep, setAdStep] = useState<'idle' | 'monetag' | 'adsgram' | 'complete'>('idle');
  const monetagStartTimeRef = useRef<number>(0);

  const showMonetagAd = useCallback((): Promise<{ success: boolean; watchedFully: boolean; unavailable: boolean }> => {
    return new Promise((resolve) => {
      if (typeof window.show_10013974 === 'function') {
        monetagStartTimeRef.current = Date.now();
        window.show_10013974()
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

  const showAdsgramAd = useCallback((): Promise<boolean> => {
    return new Promise(async (resolve) => {
      if (window.Adsgram) {
        try {
          await window.Adsgram.init({ blockId: "int-18225" }).show();
          resolve(true);
        } catch (error) {
          console.error('Adsgram ad error:', error);
          resolve(false);
        }
      } else {
        resolve(false);
      }
    });
  }, []);

  const runAdFlow = useCallback(async (): Promise<AdFlowResult> => {
    setIsShowingAds(true);
    
    try {
      setAdStep('monetag');
      const monetagResult = await showMonetagAd();
      
      if (monetagResult.unavailable) {
        return { success: false, monetagWatched: false, adsgramWatched: false };
      }
      
      if (!monetagResult.watchedFully) {
        return { success: false, monetagWatched: false, adsgramWatched: false };
      }
      
      setAdStep('adsgram');
      const adsgramSuccess = await showAdsgramAd();
      
      setAdStep('complete');
      
      return { 
        success: monetagResult.success && adsgramSuccess, 
        monetagWatched: monetagResult.watchedFully,
        adsgramWatched: adsgramSuccess 
      };
    } finally {
      setIsShowingAds(false);
      setAdStep('idle');
    }
  }, [showMonetagAd, showAdsgramAd]);

  return {
    isShowingAds,
    adStep,
    runAdFlow,
    showMonetagAd,
    showAdsgramAd,
  };
}
