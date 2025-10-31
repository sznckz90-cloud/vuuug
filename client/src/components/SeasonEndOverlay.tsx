import { useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface SeasonEndOverlayProps {
  onClose: () => void;
}

export default function SeasonEndOverlay({ onClose }: SeasonEndOverlayProps) {
  const [isClosing, setIsClosing] = useState(false);

  const handleClose = () => {
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
        <div className="bg-gradient-to-br from-orange-500 to-yellow-500 rounded-3xl p-8 shadow-2xl">
          <div className="text-center">
            <div className="mb-6">
              <div className="text-6xl mb-4">⚠️</div>
              <h1 className="text-3xl font-bold text-white mb-2">
                Season 1 Airdrop Ended
              </h1>
              <p className="text-xl text-white/90 font-semibold">
                Season 2 is Coming Soon!
              </p>
            </div>

            <div className="bg-white/20 backdrop-blur-sm rounded-2xl p-6 mb-6">
              <p className="text-white text-sm leading-relaxed">
                Thank you for participating in Season 1! We're preparing exciting new features and rewards for Season 2. Stay tuned for announcements!
              </p>
            </div>

            <Button
              onClick={handleClose}
              className="w-full bg-white text-orange-600 hover:bg-white/90 font-bold text-lg py-6 rounded-xl shadow-lg"
            >
              Got It!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
