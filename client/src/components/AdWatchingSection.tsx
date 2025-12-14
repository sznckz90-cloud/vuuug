import { useState, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Play, Clock, Shield } from "lucide-react";
import { showNotification } from "@/components/AppNotification";

declare global {
  interface Window {
    show_10306459: () => Promise<void>;
  }
}

interface AdWatchingSectionProps {
  user: any;
}

export default function AdWatchingSection({ user }: AdWatchingSectionProps) {
  const queryClient = useQueryClient();
  const [isShowingAds, setIsShowingAds] = useState(false);
  const [currentAdStep, setCurrentAdStep] =
    useState<"idle" | "monetag" | "verifying">("idle");

  const sessionRewardedRef = useRef(false);
  const monetagStartTimeRef = useRef<number>(0);

  const { data: appSettings } = useQuery({
    queryKey: ["/api/app-settings"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/app-settings");
      return res.json();
    },
    staleTime: 30000,
  });

  const watchAdMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ads/watch", {
        adType: "monetag",
      });
      if (!res.ok) throw await res.json();
      return res.json();
    },
    onSuccess: (data) => {
      const reward = data?.rewardPAD || appSettings?.rewardPerAd || 2;
      showNotification(`+${reward} PAD earned!`, "success");

      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user/stats"] });
    },
    onError: (err: any) => {
      sessionRewardedRef.current = false;
      showNotification(err?.message || "Ad failed, try again", "error");
    },
  });

  const showMonetagAd = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (typeof window.show_10306459 !== "function") {
        resolve(false);
        return;
      }

      monetagStartTimeRef.current = Date.now();

      window
        .show_10306459()
        .then(() => {
          const watched =
            Date.now() - monetagStartTimeRef.current >= 3000;
          resolve(watched);
        })
        .catch(() => {
          const watched =
            Date.now() - monetagStartTimeRef.current >= 3000;
          resolve(watched);
        });
    });
  };

  const handleStartEarning = async () => {
    if (isShowingAds) return;

    setIsShowingAds(true);
    sessionRewardedRef.current = false;

    try {
      setCurrentAdStep("monetag");
      const watched = await showMonetagAd();

      if (!watched) {
        showNotification("Claimed too fast!", "error");
        return;
      }

      setCurrentAdStep("verifying");

      if (!sessionRewardedRef.current) {
        sessionRewardedRef.current = true;

        const reward = appSettings?.rewardPerAd || 2;

        queryClient.setQueryData(["/api/auth/user"], (old: any) => ({
          ...old,
          balance: String(Number(old?.balance || 0) + reward),
          adsWatchedToday: (old?.adsWatchedToday || 0) + 1,
        }));

        watchAdMutation.mutate();
      }
    } finally {
      setCurrentAdStep("idle");
      setIsShowingAds(false);
    }
  };

  const adsWatchedToday = user?.adsWatchedToday || 0;
  const dailyLimit = appSettings?.dailyAdLimit || 50;

  return (
    <Card className="rounded-2xl minimal-card mb-3">
      <CardContent className="p-4 text-center">
        <h2 className="text-base font-bold text-white">Viewing ads</h2>
        <p className="text-xs text-[#AAAAAA] mb-3">
          Watch ads & earn PAD
        </p>

        <button
          onClick={handleStartEarning}
          disabled={isShowingAds || adsWatchedToday >= dailyLimit}
          className="btn-primary px-6 py-3 flex items-center gap-2 mx-auto disabled:opacity-50"
        >
          {isShowingAds ? (
            <>
              {currentAdStep === "verifying" ? (
                <Shield size={16} className="animate-pulse text-green-400" />
              ) : (
                <Clock size={16} className="animate-spin" />
              )}
              <span className="text-sm font-semibold">
                {currentAdStep === "monetag"
                  ? "Monetag..."
                  : "Verifying..."}
              </span>
            </>
          ) : (
            <>
              <Play size={16} />
              <span className="text-sm font-semibold">
                Start Earning
              </span>
            </>
          )}
        </button>

        <p className="text-xs text-muted-foreground mt-2">
          Watched: {adsWatchedToday}/{dailyLimit}
        </p>
      </CardContent>
    </Card>
  );
}