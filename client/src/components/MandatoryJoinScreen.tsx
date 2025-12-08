import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Users, MessageCircle, CheckCircle2 } from "lucide-react";

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
      // Endpoint now uses authenticated session - no need to pass telegramId
      const response = await fetch(`/api/membership/check`);
      const data = await response.json();
      
      if (data.success && data.isVerified) {
        onVerified();
        return;
      }
      
      setMembershipStatus({
        channelMember: data.channelMember || false,
        groupMember: data.groupMember || false,
        channelUrl: data.channelUrl || "https://t.me/PaidAdsNews",
        groupUrl: data.groupUrl || "https://t.me/PaidAdsCommunity",
        channelName: data.channelName || "Paid Ads News",
        groupName: data.groupName || "Paid Ads Community"
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
    const url = membershipStatus?.channelUrl || "https://t.me/PaidAdsNews";
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.openTelegramLink(url);
    } else {
      window.open(url, "_blank");
    }
  };

  const openGroup = () => {
    const url = membershipStatus?.groupUrl || "https://t.me/PaidAdsCommunity";
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
    <div className="fixed inset-0 z-[9999] bg-black/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-gradient-to-b from-gray-900 to-black rounded-2xl border border-gray-800 p-6 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center">
            <Users className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Join Required</h1>
          <p className="text-gray-400 text-sm">
            Join our Telegram Channel & Group to access the app and start earning.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 mb-4">
            <p className="text-red-400 text-sm text-center">{error}</p>
          </div>
        )}

        <div className="space-y-3 mb-6">
          <button
            onClick={openChannel}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              membershipStatus?.channelMember
                ? "bg-green-500/10 border-green-500/30"
                : "bg-gray-800/50 border-gray-700 hover:border-cyan-500/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                membershipStatus?.channelMember
                  ? "bg-green-500/20"
                  : "bg-cyan-500/20"
              }`}>
                <MessageCircle className={`w-5 h-5 ${
                  membershipStatus?.channelMember ? "text-green-400" : "text-cyan-400"
                }`} />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Join Channel</p>
                <p className="text-gray-500 text-xs">{membershipStatus?.channelName || "Paid Ads News"}</p>
              </div>
            </div>
            {membershipStatus?.channelMember ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <span className="text-cyan-400 text-xs font-medium">JOIN</span>
            )}
          </button>

          <button
            onClick={openGroup}
            className={`w-full flex items-center justify-between p-4 rounded-xl border transition-all ${
              membershipStatus?.groupMember
                ? "bg-green-500/10 border-green-500/30"
                : "bg-gray-800/50 border-gray-700 hover:border-purple-500/50"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                membershipStatus?.groupMember
                  ? "bg-green-500/20"
                  : "bg-purple-500/20"
              }`}>
                <Users className={`w-5 h-5 ${
                  membershipStatus?.groupMember ? "text-green-400" : "text-purple-400"
                }`} />
              </div>
              <div className="text-left">
                <p className="text-white font-medium text-sm">Join Group</p>
                <p className="text-gray-500 text-xs">{membershipStatus?.groupName || "Paid Ads Community"}</p>
              </div>
            </div>
            {membershipStatus?.groupMember ? (
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            ) : (
              <span className="text-purple-400 text-xs font-medium">JOIN</span>
            )}
          </button>
        </div>

        <Button
          onClick={handleContinue}
          disabled={isChecking}
          className={`w-full py-6 rounded-xl font-semibold text-base transition-all ${
            canContinue
              ? "bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
              : "bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 text-white"
          }`}
        >
          {isChecking ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Checking...
            </>
          ) : canContinue ? (
            "Continue to App"
          ) : (
            "I've Joined - Continue"
          )}
        </Button>

        <p className="text-gray-500 text-xs text-center mt-4">
          You must be a member of both the channel and group to use this app.
        </p>
      </div>
    </div>
  );
}
