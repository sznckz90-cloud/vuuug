import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Play, Loader2, Film, Tv, Target, Star } from "lucide-react";
import { useLocation } from "wouter";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { showNotification } from "@/components/AppNotification";
import { adSdkManager, type AdProviderId } from "@/lib/adSdkManager";

interface AdProvider {
  id: AdProviderId;
  name: string;
  icon: React.ReactNode;
  iconBg: string;
  borderColor: string;
}

const adProviders: AdProvider[] = [
  {
    id: "monetag",
    name: "Monetag",
    icon: <Film className="w-6 h-6 text-purple-400" />,
    iconBg: "bg-purple-500/20",
    borderColor: "border-purple-500/30"
  },
  {
    id: "adsgram",
    name: "AdsGram",
    icon: <Tv className="w-6 h-6 text-blue-400" />,
    iconBg: "bg-blue-500/20",
    borderColor: "border-blue-500/30"
  },
  {
    id: "adexora",
    name: "Adexora",
    icon: <Target className="w-6 h-6 text-green-400" />,
    iconBg: "bg-green-500/20",
    borderColor: "border-green-500/30"
  },
  {
    id: "adextra",
    name: "AdExtra",
    icon: <Star className="w-6 h-6 text-yellow-400" />,
    iconBg: "bg-yellow-500/20",
    borderColor: "border-yellow-500/30"
  }
];

export default function AdList() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [loadingProvider, setLoadingProvider] = useState<AdProviderId | null>(null);

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

  const getProviderSettings = (providerId: AdProviderId) => {
    const settings = appSettings?.adProviderSettings?.[providerId];
    return {
      limit: settings?.limit || 50,
      reward: settings?.reward || 2,
    };
  };

  const getProviderWatched = (providerId: AdProviderId): number => {
    if (!user) return 0;
    switch (providerId) {
      case 'monetag': return user.monetagAdsToday || 0;
      case 'adsgram': return user.adsgramAdsToday || 0;
      case 'adexora': return user.adexoraAdsToday || 0;
      case 'adextra': return user.adextraAdsToday || 0;
      default: return 0;
    }
  };

  const watchAdMutation = useMutation({
    mutationFn: async (adType: AdProviderId) => {
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
        adsWatchedToday: data.adsWatchedToday,
        monetagAdsToday: data.providerCounters?.monetag || old?.monetagAdsToday || 0,
        adsgramAdsToday: data.providerCounters?.adsgram || old?.adsgramAdsToday || 0,
        adexoraAdsToday: data.providerCounters?.adexora || old?.adexoraAdsToday || 0,
        adextraAdsToday: data.providerCounters?.adextra || old?.adextraAdsToday || 0,
      }));
      
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/earnings"] });
      
      showNotification(`+${data.rewardPAD || 2} PAD earned!`, "success");
      setLoadingProvider(null);
    },
    onError: (error: any) => {
      if (error.status === 429) {
        const providerName = error.provider ? error.provider.charAt(0).toUpperCase() + error.provider.slice(1) : 'This provider';
        showNotification(`${providerName} limit reached (${error.limit}/day)`, "error");
      } else if (error.status === 401 || error.status === 403) {
        showNotification("Authentication error. Please refresh.", "error");
      } else if (error.message) {
        showNotification(`Error: ${error.message}`, "error");
      } else {
        showNotification("Network error. Try again.", "error");
      }
      setLoadingProvider(null);
    },
  });

  const handleWatchAd = async (providerId: AdProviderId) => {
    if (loadingProvider || adSdkManager.isProviderLoading()) {
      showNotification("Please wait for the current ad to finish", "info");
      return;
    }
    
    const settings = getProviderSettings(providerId);
    const watched = getProviderWatched(providerId);
    
    if (watched >= settings.limit) {
      showNotification(`${providerId.charAt(0).toUpperCase() + providerId.slice(1)} limit reached (${settings.limit}/day)`, "error");
      return;
    }
    
    setLoadingProvider(providerId);

    const handleComplete = () => {
      watchAdMutation.mutate(providerId);
    };

    const handleError = (error: any) => {
      console.error(`${providerId} ad error:`, error);
      const errorMessage = error?.message || "Ad failed to load. Try again.";
      showNotification(errorMessage, "error");
      setLoadingProvider(null);
    };

    const handleSkip = () => {
      showNotification("Ad skipped - no reward", "info");
      setLoadingProvider(null);
    };

    try {
      await adSdkManager.showAd(providerId, handleComplete, handleError, handleSkip);
    } catch (error) {
      handleError(error);
    }
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3 pb-6">
        <div className="flex items-center gap-3 mb-5">
          <button 
            onClick={() => setLocation("/")}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-[#1A1A1A] border border-[#2A2A2A] hover:bg-[#2A2A2A] transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">Watch Ads</h1>
            <p className="text-xs text-[#888888]">Earn PAD for each ad watched</p>
          </div>
        </div>

        <div className="space-y-3">
          {adProviders.map((provider) => {
            const settings = getProviderSettings(provider.id);
            const watched = getProviderWatched(provider.id);
            const isLimitReached = watched >= settings.limit;
            const isLoading = loadingProvider === provider.id;
            
            return (
              <Card 
                key={provider.id}
                className={`rounded-xl bg-[#111111] border ${provider.borderColor} overflow-hidden`}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-12 h-12 rounded-lg ${provider.iconBg} flex items-center justify-center`}>
                        {provider.icon}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">{provider.name}</h3>
                        <div className="flex flex-col gap-0.5 mt-1">
                          <span className="text-xs text-[#888888]">
                            Watched: <span className={isLimitReached ? "text-red-400" : "text-[#4cd3ff]"}>{watched}</span> / {settings.limit}
                          </span>
                          <span className="text-xs text-[#888888]">
                            Reward: <span className="text-green-400 font-medium">{settings.reward} PAD</span>
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleWatchAd(provider.id)}
                      disabled={loadingProvider !== null || isLimitReached}
                      className={`h-10 px-5 font-semibold ${
                        isLimitReached 
                          ? 'bg-[#333] text-[#666] cursor-not-allowed' 
                          : 'bg-[#4cd3ff] hover:bg-[#6ddeff] text-black'
                      }`}
                      size="sm"
                    >
                      {isLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : isLimitReached ? (
                        <span>Done</span>
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
            );
          })}
        </div>

        <div className="mt-5 p-3 bg-[#0A0A0A] rounded-lg border border-[#1A1A1A]">
          <p className="text-xs text-[#666666] text-center">
            Each provider has its own daily limit. Watch the full ad to receive rewards.
          </p>
        </div>
      </main>
    </Layout>
  );
}
