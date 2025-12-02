import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Target, 
  Share2, 
  CalendarCheck, 
  Gift, 
  Gamepad2, 
  Users, 
  Handshake, 
  ChevronRight,
  Sparkles,
  Loader2,
  Check
} from "lucide-react";
import { showNotification } from "@/components/AppNotification";
import { useState } from "react";
import { useLocation } from "wouter";

interface Task {
  id: string;
  taskType: string;
  title: string;
  link: string;
  totalClicksRequired: number;
  currentClicks: number;
  costPerClick: string;
  totalCost: string;
  status: string;
  advertiserId: string;
  createdAt: string;
  completedAt?: string;
}

interface MissionStatus {
  shareStory: { completed: boolean; claimed: boolean };
  dailyCheckin: { completed: boolean; claimed: boolean };
}

interface AppSettings {
  channelTaskReward?: number;
  botTaskReward?: number;
  partnerTaskReward?: number;
  [key: string]: any;
}

export default function Missions() {
  const { isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [clickedTasks, setClickedTasks] = useState<Set<string>>(new Set());
  const [loadingTaskId, setLoadingTaskId] = useState<string | null>(null);
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<string>>(new Set());
  const [claimReadyTasks, setClaimReadyTasks] = useState<Set<string>>(new Set());
  const [countdownTasks, setCountdownTasks] = useState<Map<string, number>>(new Map());

  const { data: missionStatus } = useQuery<{ success: boolean } & MissionStatus>({
    queryKey: ['/api/missions/status'],
    retry: false,
  });

  const { data: appSettings } = useQuery<AppSettings>({
    queryKey: ['/api/app-settings'],
    retry: false,
  });

  const { data: tasksData } = useQuery<{ success: boolean; tasks: Task[] }>({
    queryKey: ["/api/advertiser-tasks"],
    retry: false,
  });

  const shareStoryMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/missions/share-story/claim', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    },
    onSuccess: (data) => {
      showNotification(`+${data.reward} PAD!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/missions/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => showNotification(error.message, 'error'),
  });

  const dailyCheckinMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/missions/daily-checkin/claim', {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error((await response.json()).error);
      return response.json();
    },
    onSuccess: (data) => {
      showNotification(`+${data.reward} PAD!`, 'success');
      queryClient.invalidateQueries({ queryKey: ['/api/missions/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
    },
    onError: (error: Error) => showNotification(error.message, 'error'),
  });

  const clickTaskMutation = useMutation({
    mutationFn: async (taskId: string) => {
      setLoadingTaskId(taskId);
      const response = await fetch(`/api/advertiser-tasks/${taskId}/click`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.message);
      return data;
    },
    onSuccess: (data, taskId) => {
      showNotification(`+${parseInt(data.reward).toLocaleString()} PAD!`, "success");
      setCompletedTaskIds(prev => new Set(prev).add(taskId));
      setClickedTasks(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      setClaimReadyTasks(prev => { const s = new Set(prev); s.delete(taskId); return s; });
      setLoadingTaskId(null);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    },
    onError: (error: Error) => {
      showNotification(error.message, "error");
      setLoadingTaskId(null);
    },
  });

  const handleShareStory = () => {
    const tg = window.Telegram?.WebApp as any;
    if (tg?.shareToStory) {
      tg.shareToStory('https://t.me/CashWatchBot');
    }
    if (!missionStatus?.shareStory?.claimed) {
      shareStoryMutation.mutate();
    }
  };

  const handleDailyCheckin = () => {
    const channelUrl = 'https://t.me/PaidAdsNews';
    if (window.Telegram?.WebApp?.openTelegramLink) {
      window.Telegram.WebApp.openTelegramLink(channelUrl);
    } else {
      window.open(channelUrl, '_blank');
    }
    if (!missionStatus?.dailyCheckin?.claimed) {
      dailyCheckinMutation.mutate();
    }
  };

  const handleTaskClick = async (task: Task) => {
    if (!task.link || claimReadyTasks.has(task.id) || clickedTasks.has(task.id)) return;

    let linkToOpen = task.link.trim();
    if (!linkToOpen.startsWith('http')) linkToOpen = 'https://' + linkToOpen;

    if (window.Telegram?.WebApp) {
      const isTg = linkToOpen.includes('t.me/');
      if (isTg && window.Telegram.WebApp.openTelegramLink) {
        window.Telegram.WebApp.openTelegramLink(linkToOpen);
      } else if (window.Telegram.WebApp.openLink) {
        window.Telegram.WebApp.openLink(linkToOpen);
      } else {
        window.open(linkToOpen, "_blank");
      }
    } else {
      window.open(linkToOpen, "_blank");
    }

    setClickedTasks(prev => new Set(prev).add(task.id));
    setCountdownTasks(prev => new Map(prev).set(task.id, 3));

    const countdown = setInterval(() => {
      setCountdownTasks(prev => {
        const m = new Map(prev);
        const c = m.get(task.id) || 0;
        if (c <= 1) {
          clearInterval(countdown);
          m.delete(task.id);
          setClaimReadyTasks(p => new Set(p).add(task.id));
        } else {
          m.set(task.id, c - 1);
        }
        return m;
      });
    }, 1000);
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex gap-1">
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 rounded-full bg-[#4cd3ff] animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      </Layout>
    );
  }

  const allTasks = tasksData?.tasks || [];
  const gameTasks = allTasks.filter(t => t.taskType === 'bot' && !completedTaskIds.has(t.id));
  const socialTasks = allTasks.filter(t => t.taskType === 'channel' && !completedTaskIds.has(t.id));
  const partnerTasks = allTasks.filter(t => t.taskType === 'partner' && !completedTaskIds.has(t.id));

  const channelReward = appSettings?.channelTaskReward || 30;
  const botReward = appSettings?.botTaskReward || 20;
  const partnerReward = appSettings?.partnerTaskReward || 5;

  const getReward = (t: Task) => t.taskType === 'partner' ? partnerReward : t.taskType === 'channel' ? channelReward : botReward;

  const TaskItem = ({ task }: { task: Task }) => {
    const reward = getReward(task);
    const isLoading = loadingTaskId === task.id;
    const isClaimReady = claimReadyTasks.has(task.id);
    const countdown = countdownTasks.get(task.id);

    return (
      <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
        <div className="flex-1 min-w-0 pr-3">
          <p className="text-white text-sm font-medium truncate">{task.title}</p>
          <p className="text-[#4cd3ff] text-xs font-bold">+{reward} PAD</p>
        </div>
        <Button
          size="sm"
          onClick={() => isClaimReady ? clickTaskMutation.mutate(task.id) : handleTaskClick(task)}
          disabled={isLoading || (countdown !== undefined && countdown > 0)}
          className={`h-7 px-3 text-xs font-semibold rounded-lg ${
            isLoading ? 'bg-[#4cd3ff]/50' :
            countdown ? 'bg-gray-600' :
            isClaimReady ? 'bg-green-500 hover:bg-green-600' :
            'bg-[#4cd3ff] hover:bg-[#3bc3ef]'
          } text-black`}
        >
          {isLoading ? <Loader2 className="w-3 h-3 animate-spin" /> :
           countdown ? `${countdown}s` :
           isClaimReady ? 'Claim' : 'Go'}
        </Button>
      </div>
    );
  };

  return (
    <Layout>
      <main className="max-w-md mx-auto px-4 pt-3 pb-24">
        <div className="flex items-center gap-2 mb-4">
          <Target className="w-5 h-5 text-[#4cd3ff]" />
          <h1 className="text-lg font-bold text-white">Missions</h1>
        </div>

        <div 
          className="bg-[#111] rounded-xl p-3 mb-3 cursor-pointer active:scale-[0.98] transition-transform"
          onClick={() => setLocation("/task/create")}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4cd3ff] to-[#007BFF] flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm">Create My Task</h3>
              <p className="text-gray-400 text-xs">Promote your channel or bot</p>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-500" />
          </div>
        </div>

        <div className="bg-[#111] rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarCheck className="w-4 h-4 text-yellow-400" />
            <span className="text-white text-sm font-semibold">Daily Tasks</span>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between bg-[#1a1a1a] rounded-lg p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center">
                  <Share2 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Share Story</p>
                  <p className="text-pink-400 text-xs font-bold">+5 PAD</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleShareStory}
                disabled={shareStoryMutation.isPending || missionStatus?.shareStory?.claimed}
                className={`h-7 px-3 text-xs font-semibold rounded-lg ${
                  missionStatus?.shareStory?.claimed ? 'bg-green-500/20 text-green-400' : 'bg-pink-500 hover:bg-pink-600 text-white'
                }`}
              >
                {shareStoryMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                 missionStatus?.shareStory?.claimed ? <Check className="w-3 h-3" /> : 'Share'}
              </Button>
            </div>

            <div className="flex items-center justify-between bg-[#1a1a1a] rounded-lg p-2.5">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
                  <CalendarCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Daily Check-in</p>
                  <p className="text-cyan-400 text-xs font-bold">+5 PAD</p>
                </div>
              </div>
              <Button
                size="sm"
                onClick={handleDailyCheckin}
                disabled={dailyCheckinMutation.isPending || missionStatus?.dailyCheckin?.claimed}
                className={`h-7 px-3 text-xs font-semibold rounded-lg ${
                  missionStatus?.dailyCheckin?.claimed ? 'bg-green-500/20 text-green-400' : 'bg-cyan-500 hover:bg-cyan-600 text-black'
                }`}
              >
                {dailyCheckinMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> :
                 missionStatus?.dailyCheckin?.claimed ? <Check className="w-3 h-3" /> : 'Go'}
              </Button>
            </div>

            <div 
              className="flex items-center justify-between bg-[#1a1a1a] rounded-lg p-2.5 cursor-pointer active:scale-[0.98] transition-transform"
              onClick={() => setLocation('/free-spin')}
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500 flex items-center justify-center">
                  <Gift className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">Free Spin</p>
                  <p className="text-yellow-400 text-xs font-bold">Win up to 10K PAD!</p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
          </div>
        </div>

        <div className="bg-[#111] rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Gamepad2 className="w-4 h-4 text-purple-400" />
            <span className="text-white text-sm font-semibold">Game Tasks</span>
            <span className="text-gray-500 text-xs ml-auto">+{botReward} PAD</span>
          </div>
          <div className="px-1">
            {gameTasks.length > 0 ? (
              gameTasks.map(t => <TaskItem key={t.id} task={t} />)
            ) : (
              <p className="text-gray-500 text-xs py-2 text-center">No tasks available</p>
            )}
          </div>
        </div>

        <div className="bg-[#111] rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-white text-sm font-semibold">Social Tasks</span>
            <span className="text-gray-500 text-xs ml-auto">+{channelReward} PAD</span>
          </div>
          <div className="px-1">
            {socialTasks.length > 0 ? (
              socialTasks.map(t => <TaskItem key={t.id} task={t} />)
            ) : (
              <p className="text-gray-500 text-xs py-2 text-center">No tasks available</p>
            )}
          </div>
        </div>

        <div className="bg-[#111] rounded-xl p-3 mb-3">
          <div className="flex items-center gap-2 mb-2">
            <Handshake className="w-4 h-4 text-green-400" />
            <span className="text-white text-sm font-semibold">Partner Tasks</span>
            <span className="text-gray-500 text-xs ml-auto">+{partnerReward} PAD</span>
          </div>
          <div className="px-1">
            {partnerTasks.length > 0 ? (
              partnerTasks.map(t => <TaskItem key={t.id} task={t} />)
            ) : (
              <p className="text-gray-500 text-xs py-2 text-center">No tasks available</p>
            )}
          </div>
        </div>
      </main>
    </Layout>
  );
}
