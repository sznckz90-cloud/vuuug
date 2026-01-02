import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X, Lock, Wrench, Clock, AlertCircle } from "lucide-react";

interface SeasonEndOverlayProps {
  onClose: () => void;
  isLocked?: boolean;
}

export default function SeasonEndOverlay({ onClose, isLocked = false }: SeasonEndOverlayProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
    if (isLocked) {
      return;
    }
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md transition-opacity duration-300 ${
        isClosing ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className={`relative max-w-md w-full mx-4 transition-all duration-300 ${
        isClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100'
      }`}>
        <div className="bg-gradient-to-br from-[#4cd3ff] via-[#0095cc] to-[#1a1a1a] rounded-3xl p-1 shadow-2xl">
          <div className="bg-[#0d0d0d] rounded-3xl p-8">
            <div className="text-center">
              {/* Icon */}
              <div className="mb-6 flex justify-center">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#4cd3ff]/30 to-[#0095cc]/30 flex items-center justify-center">
                  <Wrench className="w-10 h-10 text-[#4cd3ff] animate-pulse" />
                </div>
              </div>

              {/* Title */}
              <h1 className="text-3xl font-bold text-white mb-2">
                App Maintenance
              </h1>
              <p className="text-lg text-[#4cd3ff] font-semibold mb-6">
                We're upgrading our platform!
              </p>

              {/* Details Section */}
              <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-[#4cd3ff]/30 rounded-2xl p-6 mb-6 space-y-4">
                {/* What's happening */}
                <div className="flex gap-3 items-start">
                  <AlertCircle className="w-5 h-5 text-[#4cd3ff] flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold mb-1">What's Happening?</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      We're performing scheduled maintenance to bring you exciting new features and improved security updates.
                    </p>
                  </div>
                </div>

                {/* Duration */}
                <div className="flex gap-3 items-start">
                  <Clock className="w-5 h-5 text-[#4cd3ff] flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold mb-1">Expected Duration</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      The maintenance should be completed within the next 24-48 hours. We appreciate your patience.
                    </p>
                  </div>
                </div>

                {/* During maintenance */}
                <div className="flex gap-3 items-start">
                  <Wrench className="w-5 h-5 text-[#ADFF2F] flex-shrink-0 mt-1" />
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold mb-1">During Maintenance</p>
                    <p className="text-gray-300 text-xs leading-relaxed">
                      • User accounts remain secure • All balances are preserved • No data will be lost
                    </p>
                  </div>
                </div>
              </div>

              {/* Status Info */}
              <div className="bg-[#1a1a1a] border border-[#ADFF2F]/30 rounded-xl p-4 mb-6">
                <p className="text-xs text-gray-400 mb-2">MAINTENANCE STATUS</p>
                <div className="flex items-center gap-2 justify-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-400 animate-pulse"></div>
                  <p className="text-white font-semibold">In Progress - Check back soon!</p>
                </div>
              </div>

              {/* Button */}
              <Button
                onClick={handleClose}
                className="w-full bg-gradient-to-r from-[#4cd3ff] to-[#0095cc] hover:from-[#5ce6ff] hover:to-[#00b5e5] text-black font-bold text-lg py-6 rounded-xl shadow-lg hover:shadow-[#4cd3ff]/50 transition-all"
              >
                Understood
              </Button>

              {/* Footer Info */}
              <p className="text-gray-500 text-xs mt-4">
                Need help? Contact us @CashWatchBot
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
