import { useState, useEffect } from "react";

interface MembershipStatus {
  channelMember: boolean;
  groupMember: boolean;
  channelUrl: string;
  groupUrl: string;
  channelName: string;
  groupName: string;
}

interface MandatoryJoinScreenProps {
  telegramId: string;
  onVerified: () => void;
}

export default function MandatoryJoinScreen({ telegramId, onVerified }: MandatoryJoinScreenProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [membershipStatus, setMembershipStatus] = useState<MembershipStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const checkMembership = async () => {
    setIsChecking(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/membership/check`);
      const data = await response.json();
      
      if (data.success && data.isVerified) {
        onVerified();
        return;
      }
      
      setMembershipStatus({
        channelMember: data.channelMember || false,
        groupMember: data.groupMember || false,
        channelUrl: data.channelUrl || "https://t.me/MoneyAdz",
        groupUrl: data.groupUrl || "https://t.me/MoneyAdzChat",
        channelName: data.channelName || "Money Adz",
        groupName: data.groupName || "Money Adz Chat"
      });
    } catch (err) {
      console.error("Membership check error:", err);
      setError("Failed to check membership. Please try again.");
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkMembership();
  }, [telegramId]);

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
    checkMembership();
  };

  const canContinue = membershipStatus?.channelMember && membershipStatus?.groupMember;

  return (
    <div className="fixed inset-0 z-[9999] bg-black flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="w-20 h-20 mx-auto mb-8 rounded-full border-2 border-white/20 flex items-center justify-center">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-semibold text-white mb-3 tracking-tight">
          Join to Continue
        </h1>
        <p className="text-white/50 text-sm mb-10">
          Join our channel and group to access the app
        </p>

        {error && (
          <div className="mb-6 py-3 px-4 bg-white/5 border border-white/10 rounded-xl">
            <p className="text-white/70 text-sm">{error}</p>
          </div>
        )}

        <div className="space-y-3 mb-10">
          <button
            onClick={openChannel}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              membershipStatus?.channelMember
                ? "bg-white/5 border-white/20"
                : "bg-white/5 border-white/10 hover:border-white/30"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Join Channel</p>
                <p className="text-white/40 text-xs">{membershipStatus?.channelName || "Paid Ads News"}</p>
              </div>
            </div>
            {membershipStatus?.channelMember ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-white/60 text-sm font-medium">JOIN</span>
            )}
          </button>

          <button
            onClick={openGroup}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              membershipStatus?.groupMember
                ? "bg-white/5 border-white/20"
                : "bg-white/5 border-white/10 hover:border-white/30"
            }`}
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="text-left">
                <p className="text-white font-medium">Join Group</p>
                <p className="text-white/40 text-xs">{membershipStatus?.groupName || "Paid Ads Community"}</p>
              </div>
            </div>
            {membershipStatus?.groupMember ? (
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <span className="text-white/60 text-sm font-medium">JOIN</span>
            )}
          </button>
        </div>

        <button
          onClick={handleContinue}
          disabled={isChecking}
          className="w-full py-4 px-6 bg-white text-black font-semibold rounded-xl transition-all hover:bg-white/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isChecking ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Checking...
            </span>
          ) : canContinue ? (
            "Continue"
          ) : (
            "I've Joined"
          )}
        </button>
      </div>
    </div>
  );
}
