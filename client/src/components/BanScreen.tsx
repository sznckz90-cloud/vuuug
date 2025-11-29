import { AlertTriangle } from "lucide-react";

interface BanScreenProps {
  reason?: string;
}

export default function BanScreen({ reason }: BanScreenProps) {
  const handleContactSupport = () => {
    window.open('https://t.me/PaidAdsCommunity', '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-black via-[#0a0a0a] to-black">
      <div className="max-w-md w-full">
        <div className="bg-gradient-to-br from-red-950/20 to-black border border-red-900/30 rounded-2xl p-8 shadow-2xl">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center border-2 border-red-500/30">
              <AlertTriangle className="w-10 h-10 text-red-500" />
            </div>

            <div className="space-y-2">
              <h1 className="text-xl font-bold text-red-500 leading-tight">
                Your account has been banned due to suspicious multi-account activity
              </h1>

              {reason && (
                <div className="mt-4 p-3 bg-red-950/20 border border-red-900/30 rounded-lg">
                  <p className="text-xs font-semibold text-red-400/70 mb-1">
                    Details:
                  </p>
                  <p className="text-xs text-gray-400">
                    {reason}
                  </p>
                </div>
              )}

              <p className="text-gray-400 text-sm mt-4">
                All features are disabled. If you believe this is a mistake, please contact our support team.
              </p>
            </div>

            <button
              onClick={handleContactSupport}
              className="w-full py-3 px-6 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
