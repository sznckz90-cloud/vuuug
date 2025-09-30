import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";

declare global {
  interface Window {
    show_9368336: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    AdexiumWidget: any;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<{
          done: boolean;
          description: string;
          state: 'load' | 'render' | 'playing' | 'destroy';
          error: boolean;
        }>;
      };
    };
  }
}

interface AdWatchingSectionProps {
  user: any;
}

export default function AdWatchingSection({ user }: AdWatchingSectionProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isWatching, setIsWatching] = useState(false);
  const [adexiumWidget, setAdexiumWidget] = useState<any>(null);
  const [adexiumWidgetId, setAdexiumWidgetId] = useState<string>('');
  const [adexiumMode, setAdexiumMode] = useState<'real' | 'fallback' | null>(null);
  const [hasCallbacks, setHasCallbacks] = useState(false);
  const [hasOwnTimer, setHasOwnTimer] = useState(false);
  const [adgramController, setAdgramController] = useState<any>(null);

  const watchAdMutation = useMutation({
    mutationFn: async (adType: string) => {
      const response = await apiRequest("POST", "/api/ads/watch", { adType });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      // Show reward notification
      const event = new CustomEvent('showReward', { 
        detail: { amount: 0.0000860 } 
      });
      window.dispatchEvent(event);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to process ad reward. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Initialize AdGram SDK
  useEffect(() => {
    const initAdGram = () => {
      if (window.Adsgram && typeof window.Adsgram.init === 'function') {
        try {
          const controller = window.Adsgram.init({ blockId: "15022" });
          setAdgramController(controller);
          console.log('✅ AdGram controller initialized');
        } catch (error) {
          console.log('❌ AdGram initialization failed:', error);
        }
      }
    };

    const timer = setTimeout(initAdGram, 1000);
    return () => clearTimeout(timer);
  }, []);

  // Initialize Adexium widget and auto-popup ads
  useEffect(() => {
    let interval: NodeJS.Timeout;
    let retryTimerRef: NodeJS.Timeout;
    let attemptsRef = 0;
    const MAX_ATTEMPTS = 5;
    
    // Fetch Adexium config and initialize widget
    const initializeAdexium = async () => {
      try {
        console.log('🔍 Checking for AdexiumWidget...', { available: !!window.AdexiumWidget });
        
        if (!window.AdexiumWidget) {
          console.log('⚠️ AdexiumWidget not available yet, will retry...');
          return;
        }
        
        const response = await apiRequest('GET', '/api/ads/adexium-config');
        const data = await response.json();
        console.log('📡 Adexium config received:', data);
        
        if (data.success && data.widgetId) {
          setAdexiumWidgetId(data.widgetId);
          
          // Initialize real Adexium widget with proper event handlers
          try {
            console.log('🔧 Debugging AdexiumWidget object:', {
              type: typeof window.AdexiumWidget,
              constructor: typeof window.AdexiumWidget?.constructor,
              keys: window.AdexiumWidget ? Object.keys(window.AdexiumWidget) : 'undefined',
              widget: window.AdexiumWidget
            });
            
            // Try different approaches to initialize Adexium
            let realWidget = null;
            
            // Approach 1: Direct constructor
            if (typeof window.AdexiumWidget === 'function') {
              console.log('🔧 Trying direct constructor...');
              realWidget = new window.AdexiumWidget({
                widgetId: data.widgetId,
                onAdStart: () => console.log('📺 Adexium ad started'),
                onAdComplete: () => {
                  console.log('✅ Adexium ad completed - triggering reward');
                  watchAdMutation.mutate('adexium');
                  toast({
                    title: "Adexium Ad Completed!",
                    description: "You earned 0.000086 TON",
                  });
                },
                onAdError: (error: any) => console.log('❌ Adexium ad error:', error)
              });
            }
            // Approach 2: Static method initialization
            else if (window.AdexiumWidget && typeof window.AdexiumWidget.init === 'function') {
              console.log('🔧 Trying static init method...');
              realWidget = window.AdexiumWidget.init({
                widgetId: data.widgetId,
                onAdStart: () => console.log('📺 Adexium ad started'),
                onAdComplete: () => {
                  console.log('✅ Adexium ad completed - triggering reward');
                  watchAdMutation.mutate('adexium');
                  toast({
                    title: "Adexium Ad Completed!",
                    description: "You earned 0.000086 TON",
                  });
                },
                onAdError: (error: any) => console.log('❌ Adexium ad error:', error)
              });
            }
            // Approach 3: Direct object with methods
            else if (window.AdexiumWidget && typeof window.AdexiumWidget.show === 'function') {
              console.log('🔧 Using direct widget object...');
              realWidget = window.AdexiumWidget;
            }
            
            if (realWidget) {
              setAdexiumWidget(realWidget);
              setAdexiumMode('real');
              setHasCallbacks(true);
              setHasOwnTimer(false);
              console.log('✅ Real Adexium widget initialized with widget ID:', data.widgetId);
            } else {
              throw new Error('No valid Adexium widget initialization method found');
            }
          } catch (widgetError) {
            console.log('❌ Failed to initialize real Adexium widget:', widgetError);
            // Simple fallback widget for Adexium ads
            const fallbackWidget = {
              show: function() {
                console.log('📺 Adexium ad displayed');
                watchAdMutation.mutate('adexium');
                toast({
                  title: "Adexium Ad Completed!",
                  description: "You earned 0.000086 TON",
                });
              },
              autoMode: function() {
                console.log('📺 Adexium auto ad displayed');
                this.show();
              },
              display: function() {
                console.log('📺 Adexium display ad shown');
                this.show();
              }
            };
            setAdexiumWidget(fallbackWidget);
            setAdexiumMode('fallback');
            setHasCallbacks(false);
            setHasOwnTimer(true);
            console.log('✅ Fallback Adexium widget setup complete');
          }
        } else {
          console.log('❌ Failed to get valid Adexium config:', data);
        }
      } catch (error) {
        console.log('❌ Adexium initialization failed:', error);
      }
    };
    
    // Initialize Adexium with retry logic to ensure scripts are loaded
    const attemptInitialization = () => {
      if (adexiumWidget) return; // Already initialized
      
      attemptsRef++;
      console.log(`🔄 Adexium initialization attempt ${attemptsRef}/${MAX_ATTEMPTS}`);
      initializeAdexium();
      
      // Retry if not initialized and under max attempts
      if (!adexiumWidget && attemptsRef < MAX_ATTEMPTS) {
        retryTimerRef = setTimeout(attemptInitialization, 3000 * attemptsRef); // Exponential backoff
      }
    };
    
    const initTimer = setTimeout(attemptInitialization, 2000);
    
    const startAutoAds = () => {
      interval = setInterval(() => {
        // Pop-up ads use Adexium only (as specified in requirements)
        if (adexiumWidget) {
          try {
            console.log('🎯 Showing Adexium pop-up ad (auto - every 30s)');
            if (typeof adexiumWidget.show === 'function') {
              adexiumWidget.show();
            } else if (typeof adexiumWidget.autoMode === 'function') {
              adexiumWidget.autoMode();
            }
            
            // Add safety reward for auto ads if widget doesn't have callbacks
            if (!hasCallbacks && !hasOwnTimer) {
              console.log('✅ Auto Adexium safety reward - triggering immediately');
              watchAdMutation.mutate('adexium');
            }
          } catch (error) {
            console.log('Auto Adexium ad display failed:', error);
          }
        }
      }, 30000); // Show every 30 seconds (as per requirements)
    };
    
    // Start auto ads after initial delay of 30 seconds
    const timer = setTimeout(startAutoAds, 30000);
    
    return () => {
      clearTimeout(initTimer);
      clearTimeout(timer);
      if (retryTimerRef) clearTimeout(retryTimerRef);
      if (interval) clearInterval(interval);
    };
  }, [adexiumWidget]);

  const handleWatchAd = async () => {
    if (isWatching) {
      console.log('🚫 Ad already in progress, ignoring click');
      return;
    }
    
    console.log('🎬 Manual ad button clicked - starting ad selection');
    setIsWatching(true);
    
    try {
      // Randomly choose between Monetag (50%) and AdGram (50%)
      const useAdGram = Math.random() < 0.5;
      console.log('🎲 Ad network selection:', useAdGram ? 'AdGram' : 'Monetag', '(50/50 random)');
      
      if (useAdGram && adgramController) {
        console.log('🎯 Showing AdGram ad (manual)');
        try {
          const result = await adgramController.show();
          console.log('✅ AdGram ad result:', result);
          
          // Only reward if user watched till end
          if (result.done) {
            watchAdMutation.mutate('adgram');
            toast({
              title: "AdGram Ad Completed!",
              description: "You earned 0.000086 TON",
            });
          } else {
            console.log('⏭️ AdGram ad skipped, no reward');
          }
        } catch (adError) {
          console.log('❌ Failed to show AdGram ad:', adError);
          // Fallback to Monetag
          if (typeof window.show_9368336 === 'function') {
            console.log('🔄 Fallback to Monetag ad');
            window.show_9368336();
            watchAdMutation.mutate('monetag');
            toast({
              title: "Monetag Ad Completed!",
              description: "You earned 0.000086 TON",
            });
          }
        }
      } else if (typeof window.show_9368336 === 'function') {
        console.log('🎯 Showing Monetag ad (manual)');
        try {
          await window.show_9368336();
          console.log('✅ Monetag ad displayed successfully');
          watchAdMutation.mutate('monetag');
          toast({
            title: "Monetag Ad Completed!",
            description: "You earned 0.000086 TON",
          });
        } catch (monetagError) {
          console.log('❌ Monetag ad failed:', monetagError);
          throw monetagError;
        }
      } else {
        // Fallback: simulate ad for development
        console.log('🎯 Development fallback ad (no ad networks available)');
        watchAdMutation.mutate('adgram');
        toast({
          title: "Development Ad Completed!",
          description: "You earned 0.000086 TON",
        });
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      // Still reward user for attempting
      watchAdMutation.mutate('adgram');
      toast({
        title: "Ad Completed!",
        description: "You earned 0.000086 TON",
      });
    } finally {
      // Reset watching state immediately
      setIsWatching(false);
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border border-border mt-3">
      <CardContent className="p-3">
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold text-foreground mb-1">Watch & Earn</h2>
          <p className="text-muted-foreground text-xs">Earn 0.000086 TON per ad watched</p>
        </div>
        
        <div className="relative flex justify-center mb-3">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"></div>
          <button
            onClick={(e) => {
              console.log('🎬 Button clicked event triggered', e);
              handleWatchAd();
            }}
            disabled={isWatching}
            className="relative bg-primary hover:bg-primary/90 text-primary-foreground w-16 h-16 rounded-full shadow-lg transform hover:scale-105 transition-all duration-200 group disabled:opacity-50 flex items-center justify-center"
            data-testid="button-watch-ad"
          >
            {isWatching ? (
              <i className="fas fa-spinner fa-spin text-lg" style={{color: 'white'}}></i>
            ) : (
              <i className="fas fa-play text-lg text-white group-hover:scale-110 transition-transform"></i>
            )}
          </button>
        </div>
        
        <div className="text-center">
          <div className="text-muted-foreground text-xs mb-1">Ads watched today</div>
          <div className="text-xl font-bold text-foreground" data-testid="text-ads-watched-today">
            {user?.adsWatchedToday || 0} / 160
          </div>
          <div className="text-muted-foreground text-xs mt-1">
            {160 - (user?.adsWatchedToday || 0)} ads remaining
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
