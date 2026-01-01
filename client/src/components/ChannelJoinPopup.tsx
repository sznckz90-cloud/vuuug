import { useState, useEffect } from "react";

interface MembershipStatus {
  channelMember: boolean;
  groupMember: boolean;
  channelUrl: string;
  groupUrl: string;
  channelName: string;
  groupName: string;
}

interface ChannelJoinPopupProps {
  telegramId: string;
  onVerified: () => void;
}

export default function ChannelJoinPopup({ telegramId, onVerified }: ChannelJoinPopupProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);

  const checkMembership = async (isInitialCheck = false) => {
    if (isChecking) return;
    
    setIsChecking(true);
    setError(null);
    
    try {
      const headers: Record<string, string> = {};
      const tg = window.Telegram?.WebApp;
      if (tg?.initData) {
        headers['x-telegram-data'] = tg.initData;
      }
      
      // Use the specific membership check endpoint that verifies with Telegram
      const response = await fetch('/api/membership/check', { headers });
      const data = await response.json();
      
      if (data.success && data.isVerified) {
        onVerified();
        return;
      }
      
      if (data.success) {
        setMembershipStatus({
          channelMember: data.channelMember || false,
          groupMember: data.groupMember || false,
          channelUrl: data.channelUrl || "https://t.me/MoneyAdz",
          groupUrl: data.groupUrl || "https://t.me/MoneyAdzChat",
          channelName: data.channelName || "Money adz",
          groupName: data.groupName || "Money adz community"
        });
      } else if (!isInitialCheck) {
        setError(data.message || "Failed to verify membership.");
      }
    } catch (err) {
      console.error("Membership check error:", err);
      if (!isInitialCheck) {
        setError("Failed to check membership. Please try again.");
      }
    } finally {
      setIsChecking(false);
      setHasInitialized(true);
    }
  };

  useEffect(() => {
    if (!hasInitialized) {
      checkMembership(true);
    }
  }, [telegramId, hasInitialized]);

  const openChannel = () => {
    const url = membershipStatus?.channelUrl || "https://t.me/MoneyAdz";
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const openGroup = () => {
    const url = membershipStatus?.groupUrl || "https://t.me/MoneyAdzChat";
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const handleContinue = () => {
    checkMembership(false);
  };

  const bothJoined = membershipStatus?.channelMember && membershipStatus?.groupMember;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[#121212] border border-white/10 rounded-2xl p-6 relative">
        
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-gradient-to-br from-[#4cd3ff]/20 to-[#4cd3ff]/5 border border-[#4cd3ff]/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-[#4cd3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          
          <h2 className="text-xl font-semibold text-white mb-2">
            Join Our Community
          </h2>
          <p className="text-white/50 text-sm mb-6">
            Join our channel and group to continue
          </p>

          {error && (
            <div className="mb-4 py-2 px-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* Channel Join Button */}
          <button
            onClick={openChannel}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all mb-3 ${
              membershipStatus?.channelMember
                ? "bg-[#4cd3ff]/10 border-[#4cd3ff]/30"
                : "bg-white/5 border-white/10 hover:border-[#4cd3ff]/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4cd3ff]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#4cd3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Join Channel</p>
                <p className="text-white/40 text-xs">{membershipStatus?.channelName || "Money adz"}</p>
              </div>
            </div>
            {membershipStatus?.channelMember ? (
              <svg className="w-5 h-5 text-[#4cd3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-[#4cd3ff] text-xs font-medium">JOIN</span>
            )}
          </button>

          {/* Group Join Button */}
          <button
            onClick={openGroup}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all mb-4 ${
              membershipStatus?.groupMember
                ? "bg-[#4cd3ff]/10 border-[#4cd3ff]/30"
                : "bg-white/5 border-white/10 hover:border-[#4cd3ff]/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#4cd3ff]/10 flex items-center justify-center">
                <svg className="w-5 h-5 text-[#4cd3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Join Group</p>
                <p className="text-white/40 text-xs">{membershipStatus?.groupName || "Money adz community"}</p>
              </div>
            </div>
            {membershipStatus?.groupMember ? (
              <svg className="w-5 h-5 text-[#4cd3ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-[#4cd3ff] text-xs font-medium">JOIN</span>
            )}
          </button>

          <button
            onClick={handleContinue}
            disabled={isChecking}
            className="w-full py-3 px-4 bg-[#4cd3ff] text-black font-semibold rounded-xl transition-all hover:bg-[#4cd3ff]/90 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isChecking ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </span>
            ) : bothJoined ? (
              "Continue"
            ) : (
              "I've Joined Both"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
