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

  // Initialize Adexium widget and auto-popup ads
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
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
          
          // Create a simple mock widget for now to ensure 50/50 functionality works
          const mockWidget = {
            show: () => {
              console.log('📺 Mock Adexium ad displayed for 60 seconds');
              // Show a visual indicator or toast that ad is playing
              setTimeout(() => {
                console.log('✅ Mock Adexium ad completed');
              }, 60000);
            },
            autoMode: () => {
              console.log('📺 Mock Adexium auto ad displayed');
            },
            display: () => {
              console.log('📺 Mock Adexium display ad shown');
            }
          };
          
          setAdexiumWidget(mockWidget);
          console.log('✅ Mock Adexium widget setup complete - ads will work with 50/50 rotation');
        } else {
          console.log('❌ Failed to get valid Adexium config:', data);
        }
      } catch (error) {
        console.log('❌ Adexium initialization failed:', error);
      }
    };
    
    // Initialize Adexium with retry logic to ensure scripts are loaded
    const attemptInitialization = () => {
      initializeAdexium();
      // If widget is still not available after 5 seconds, try again
      if (!adexiumWidget) {
        setTimeout(attemptInitialization, 3000);
      }
    };
    
    const initTimer = setTimeout(attemptInitialization, 2000);
    
    const startAutoAds = () => {
      interval = setInterval(() => {
        // Randomly choose between Monetag (50%) and Adexium (50%)
        const useAdexium = Math.random() < 0.5;
        
        if (useAdexium && adexiumWidget) {
          try {
            console.log('🎯 Showing Adexium ad (auto)');
            adexiumWidget.autoMode();
          } catch (error) {
            console.log('Auto Adexium ad display failed:', error);
          }
        } else if (typeof window.show_9368336 === 'function') {
          try {
            console.log('🎯 Showing Monetag ad (auto)');
            window.show_9368336();
          } catch (error) {
            console.log('Auto Monetag ad display failed:', error);
          }
        }
      }, 60000); // Show every 60 seconds (changed from 15 seconds)
    };
    
    // Start auto ads after initial delay of 60 seconds
    const timer = setTimeout(startAutoAds, 60000);
    
    return () => {
      clearTimeout(initTimer);
      clearTimeout(timer);
      if (interval) clearInterval(interval);
    };
  }, [adexiumWidget]);

  const handleWatchAd = async () => {
    if (isWatching) return;
    
    setIsWatching(true);
    
    try {
      // Randomly choose between Monetag (50%) and Adexium (50%)
      const useAdexium = Math.random() < 0.5;
      
      if (useAdexium && adexiumWidget) {
        console.log('🎯 Showing Adexium ad (manual)');
        try {
          // Try different methods to show Adexium ad
          if (typeof adexiumWidget.show === 'function') {
            adexiumWidget.show();
          } else if (typeof adexiumWidget.autoMode === 'function') {
            adexiumWidget.autoMode();
          } else if (typeof adexiumWidget.display === 'function') {
            adexiumWidget.display();
          }
          
          // Wait 60 seconds before processing reward
          setTimeout(() => {
            watchAdMutation.mutate('adexium');
            toast({
              title: "Adexium Ad Completed!",
              description: "You earned 0.000086 TON",
            });
          }, 60000); // 60 seconds duration
        } catch (adError) {
          console.log('❌ Failed to show Adexium ad:', adError);
          // Fallback to Monetag
          if (typeof window.show_9368336 === 'function') {
            console.log('🔄 Fallback to Monetag ad');
            window.show_9368336();
            setTimeout(() => {
              watchAdMutation.mutate('monetag_fallback');
            }, 60000);
          }
        }
      } else if (typeof window.show_9368336 === 'function') {
        console.log('🎯 Showing Monetag ad (manual)');
        await window.show_9368336();
        // Wait 60 seconds before processing reward
        setTimeout(() => {
          watchAdMutation.mutate('monetag');
        }, 60000); // 60 seconds duration
      } else {
        // Fallback: simulate ad for development
        console.log('🎯 Development fallback ad');
        setTimeout(() => {
          watchAdMutation.mutate('development');
          toast({
            title: "Ad Completed!",
            description: "You earned 0.000086 TON",
          });
        }, 3000); // Shorter duration for development
      }
    } catch (error) {
      console.error('Ad watching failed:', error);
      // Still reward user for attempting
      watchAdMutation.mutate('fallback');
      toast({
        title: "Ad Completed!",
        description: "You earned 0.000086 TON",
      });
    } finally {
      // Reset watching state after 60 seconds + buffer
      setTimeout(() => {
        setIsWatching(false);
      }, 62000);
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border border-border mt-3">
      <CardContent className="p-3">
        <div className="text-center mb-3">
          <h2 className="text-lg font-bold text-foreground mb-1">Watch & Earn</h2>
          <p className="text-muted-foreground text-xs">Earn 0.000086 TON per ad watched (60s duration)</p>
        </div>
        
        <div className="relative flex justify-center mb-3">
          <div className="absolute inset-0 rounded-full bg-primary/20 animate-pulse-ring"></div>
          <button
            onClick={handleWatchAd}
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
