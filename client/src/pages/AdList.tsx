import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Gift, Clock, Film, Tv, Target, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_10013974: (type?: string | { type: string; inAppSettings: any }) => Promise<void>;
    showAdexora: () => Promise<void>;
    Adsgram: {
      init: (config: { blockId: string }) => {
        show: () => Promise<void>;
      };
    };
  }
}

interface AdProvider {
  id: string;
  name: string;
  description: string;
  expectedReward: string;
  icon: React.ReactNode;
  iconBg: string;
}

const adProviders: AdProvider[] = [
  {
    id: "monetag",
    name: "Monetag Ads",
    description: "Watch video ads to earn rewards",
    expectedReward: "500-1000 PAD",
    icon: <Film className="w-5 h-5 text-purple-400" />,
    iconBg: "bg-purple-500/20"
  },
  {
    id: "adsgram",
    name: "Adsgram",
    description: "Interactive ad experiences",
    expectedReward: "300-800 PAD",
    icon: <Tv className="w-5 h-5 text-blue-400" />,
    iconBg: "bg-blue-500/20"
  },
  {
    id: "adexora",
    name: "Adexora",
    description: "Premium brand advertisements",
    expectedReward: "400-900 PAD",
    icon: <Target className="w-5 h-5 text-green-400" />,
    iconBg: "bg-green-500/20"
  },
  {
    id: "adextra",
    name: "AdExtra",
    description: "Bonus reward advertisements",
    expectedReward: "200-600 PAD",
    icon: <Star className="w-5 h-5 text-yellow-400" />,
    iconBg: "bg-yellow-500/20"
  }
];

export default function AdList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [loadingProvider, setLoadingProvider] = useState<string | null>(null);
  const [adStartTime, setAdStartTime] = useState<number>(0);

  const { data: user } = useQuery<any>({
    queryKey: ['/api/auth/user'],
    retry: false,
  });

  const { data: appSettings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/app-settings");
      return response.json();
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });

  const watchAdMutation = useMutation({
    mutationFn: async (adType: string) => {
      const response = await apiRequest("POST", "/api/ads/watch", { adType });
      if (!response.ok) {
        const error = await response.json();
        throw { status: response.status, ...error };
      }
      return response.json();
    },
    onSuccess: async (data) => {
      queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
        ...old,
        balance: data.newBalance,
        adsWatchedToday: data.adsWatchedToday
      }));
      
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      showNotification(`You received ${data.rewardPAD || 1000} PAD on your balance`, "success");
      setLoadingProvider(null);
    },
    onError: (error: any) => {
      if (error.status === 429) {
        const limit = error.limit || appSettings?.dailyAdLimit || 50;
        showNotification(`Daily ad limit reached (${limit} ads/day)`, "error");
      } else if (error.status === 401 || error.status === 403) {
        showNotification("Authentication error. Please refresh the page.", "error");
      } else if (error.message) {
        showNotification(`Error: ${error.message}`, "error");
      } else {
        showNotification("Network error. Check your connection and try again.", "error");
      }
      setLoadingProvider(null);
    },
  });

  const handleWatchAd = async (providerId: string) => {
    if (loadingProvider) return;
    
    setLoadingProvider(providerId);
    const startTime = Date.now();
    setAdStartTime(startTime);
    
    const handleAdCompletion = () => {
      const watchDuration = Date.now() - startTime;
      if (watchDuration < 3000) {
        showNotification("Claiming too fast!", "error");
        setLoadingProvider(null);
        return;
      }
      watchAdMutation.mutate(providerId);
    };

    const handleAdError = (error?: any) => {
      showNotification("Ad failed to load. Please try again.", "error");
      setLoadingProvider(null);
    };
    
    try {
      switch (providerId) {
        case 'monetag':
          console.log('🎬 Attempting Monetag ad, show_10013974 exists:', typeof window.show_10013974 === 'function');
          if (typeof window.show_10013974 === 'function') {
            console.log('✅ Calling window.show_10013974()');
            window.show_10013974()
              .then(() => {
                console.log('✅ Monetag ad completed successfully');
                handleAdCompletion();
              })
              .catch((error) => {
                console.error('❌ Monetag ad error:', error);
                handleAdError(error);
              });
          } else {
            console.error('❌ window.show_10013974 is not available');
            showNotification("Monetag not available. Try again later.", "error");
            setLoadingProvider(null);
          }
          break;
          
        case 'adexora':
          console.log('🎬 Attempting Adexora ad, showAdexora exists:', typeof window.showAdexora === 'function');
          if (typeof window.showAdexora === 'function') {
            console.log('✅ Calling window.showAdexora()');
            window.showAdexora()
              .then(() => {
                console.log('✅ Adexora ad completed successfully');
                handleAdCompletion();
              })
              .catch((error) => {
                console.error('❌ Adexora ad error:', error);
                handleAdError(error);
              });
          } else {
            console.error('❌ window.showAdexora is not available, type:', typeof window.showAdexora);
            showNotification("Adexora not available. Please open in Telegram app.", "error");
            setLoadingProvider(null);
          }
          break;
          
        case 'adextra':
          const adExtraContainer = document.getElementById('353c332d4f2440f448057df79cb605e5d3d64ef0');
          if (adExtraContainer) {
            adExtraContainer.style.display = 'flex';
            adExtraContainer.style.alignItems = 'center';
            adExtraContainer.style.justifyContent = 'center';
            
            let closeBtn = document.getElementById('adextra-close-btn') as HTMLButtonElement | null;
            let skipBtn = document.getElementById('adextra-skip-btn') as HTMLButtonElement | null;
            
            if (!closeBtn) {
              closeBtn = document.createElement('button');
              closeBtn.id = 'adextra-close-btn';
              closeBtn.style.cssText = 'position:absolute;top:20px;right:20px;background:#4cd3ff;color:#000;border:none;padding:12px 24px;border-radius:8px;font-weight:bold;cursor:pointer;z-index:10000;display:none;';
              closeBtn.textContent = 'Claim Reward';
              adExtraContainer.appendChild(closeBtn);
            }
            
            if (!skipBtn) {
              skipBtn = document.createElement('button');
              skipBtn.id = 'adextra-skip-btn';
              skipBtn.style.cssText = 'position:absolute;top:20px;left:20px;background:#333;color:#fff;border:none;padding:8px 16px;border-radius:8px;cursor:pointer;z-index:10000;';
              skipBtn.textContent = 'Close';
              adExtraContainer.appendChild(skipBtn);
            }
            
            closeBtn.style.display = 'none';
            skipBtn.style.display = 'block';
            let adLoadedAndViewed = false;
            let contentCheckInterval: NodeJS.Timeout | null = null;
            
            const checkForAdContent = () => {
              const hasContent = adExtraContainer.querySelector('iframe, img, video, div[class]');
              return hasContent !== null && adExtraContainer.childElementCount > 2;
            };
            
            contentCheckInterval = setInterval(() => {
              if (checkForAdContent()) {
                clearInterval(contentCheckInterval!);
                setTimeout(() => {
                  if (closeBtn) {
                    closeBtn.style.display = 'block';
                    adLoadedAndViewed = true;
                  }
                }, 5000);
              }
            }, 500);
            
            setTimeout(() => {
              if (contentCheckInterval) clearInterval(contentCheckInterval);
              if (!adLoadedAndViewed && closeBtn) {
                closeBtn.style.display = 'none';
              }
            }, 15000);
            
            const handleClaim = () => {
              if (contentCheckInterval) clearInterval(contentCheckInterval);
              adExtraContainer.style.display = 'none';
              if (closeBtn) closeBtn.style.display = 'none';
              if (skipBtn) skipBtn.style.display = 'none';
              closeBtn?.removeEventListener('click', handleClaim);
              skipBtn?.removeEventListener('click', handleSkip);
              
              if (adLoadedAndViewed) {
                handleAdCompletion();
              } else {
                showNotification("Ad did not load properly", "error");
                setLoadingProvider(null);
              }
            };
            
            const handleSkip = () => {
              if (contentCheckInterval) clearInterval(contentCheckInterval);
              adExtraContainer.style.display = 'none';
              if (closeBtn) closeBtn.style.display = 'none';
              if (skipBtn) skipBtn.style.display = 'none';
              closeBtn?.removeEventListener('click', handleClaim);
              skipBtn?.removeEventListener('click', handleSkip);
              showNotification("Ad skipped - no reward earned", "info");
              setLoadingProvider(null);
            };
            
            closeBtn.addEventListener('click', handleClaim);
            skipBtn.addEventListener('click', handleSkip);
          } else {
            showNotification("AdExtra not available. Try again later.", "error");
            setLoadingProvider(null);
          }
          break;
          
        case 'adsgram':
          if (window.Adsgram) {
            try {
              await window.Adsgram.init({ blockId: "int-18225" }).show();
              handleAdCompletion();
            } catch (error) {
              handleAdError(error);
            }
          } else {
            showNotification("Adsgram not available. Try again later.", "error");
            setLoadingProvider(null);
          }
          break;
          
        default:
          showNotification("Unknown ad provider", "error");
          setLoadingProvider(null);
      }
    } catch (error) {
      showNotification("Ad display failed. Please try again.", "error");
      setLoadingProvider(null);
    }
  };

  const adsWatchedToday = user?.adsWatchedToday || 0;
  const dailyLimit = appSettings?.dailyAdLimit || 50;

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3 pb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button 
            onClick={() => setLocation("/")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Ad Providers</h1>
            <p className="text-xs text-[#888888]">Choose an ad to watch and earn</p>
          </div>
        </div>

        {/* Ad Counter */}
        <Card className="mb-4 minimal-card">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift className="w-4 h-4 text-[#4cd3ff]" />
                <span className="text-sm text-white font-medium">Today's Progress</span>
              </div>
              <span className="text-sm font-bold text-[#4cd3ff]">{adsWatchedToday}/{dailyLimit}</span>
            </div>
          </CardContent>
        </Card>

        {/* Ad Provider Cards */}
        <div className="space-y-2.5">
          {adProviders.map((provider) => (
            <Card 
              key={provider.id}
              className="minimal-card border-0"
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-12 h-12 rounded-lg ${provider.iconBg} border border-[#2A2A2A] flex items-center justify-center flex-shrink-0`}>
                      {provider.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-white leading-tight">{provider.name}</h3>
                      <p className="text-xs text-[#888888] mb-1.5 leading-tight">{provider.description}</p>
                      <div className="flex items-center gap-1.5">
                        <Gift className="w-3 h-3 text-[#4cd3ff] flex-shrink-0" />
                        <span className="text-xs font-semibold text-[#4cd3ff]">{provider.expectedReward}</span>
                      </div>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleWatchAd(provider.id)}
                    disabled={loadingProvider !== null || adsWatchedToday >= dailyLimit}
                    className="bg-[#4cd3ff] hover:bg-[#6ddeff] text-black font-semibold h-9 px-3 flex-shrink-0"
                    size="sm"
                  >
                    {loadingProvider === provider.id ? (
                      <Clock className="w-4 h-4 animate-spin" />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <Play className="w-4 h-4" />
                        <span>Start</span>
                      </div>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Info Text */}
        <div className="mt-4 p-3 bg-[#0F0F0F] rounded-lg border border-[#1A1A1A]">
          <p className="text-xs text-[#888888] text-center">
            Watch ads to earn PAD rewards. Complete viewing to receive your reward.
          </p>
        </div>
      </main>
    </Layout>
  );
}
