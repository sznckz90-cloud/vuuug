import { useState, useRef, useEffect } from "react";

interface SpinnerWheelProps {
  isSpinning: boolean;
  onSpinComplete?: () => void;
}

const SEGMENTS = [
  { value: "0.00007", color: "#3b82f6", label: "0.00007" },
  { value: "0.00035", color: "#8b5cf6", label: "0.00035" },
  { value: "0.005", color: "#ec4899", label: "0.005" },
  { value: "0.013", color: "#f59e0b", label: "0.013" },
  { value: "0.062", color: "#10b981", label: "0.062" },
  { value: "0.31", color: "#06b6d4", label: "0.31" },
  { value: "0.52", color: "#f97316", label: "0.52" },
  { value: "1", color: "#ef4444", label: "1.0" },
];

export default function SpinnerWheel({ isSpinning, onSpinComplete }: SpinnerWheelProps) {
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSpinning) {
      const randomSpins = 5 + Math.random() * 3;
      const randomDegrees = Math.random() * 360;
      const totalRotation = randomSpins * 360 + randomDegrees;
      
      setRotation(totalRotation);
      
      setTimeout(() => {
        if (onSpinComplete) {
          onSpinComplete();
        }
      }, 4000);
    }
  }, [isSpinning, onSpinComplete]);

  const segmentAngle = 360 / SEGMENTS.length;

  return (
    <div className="relative w-full max-w-sm mx-auto">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10">
        <div className="w-0 h-0 border-l-[15px] border-l-transparent border-r-[15px] border-r-transparent border-t-[25px] border-t-yellow-400 drop-shadow-lg" />
      </div>

      <div className="relative aspect-square">
        <div
          ref={wheelRef}
          className="w-full h-full rounded-full shadow-2xl overflow-hidden transition-transform duration-[4000ms] ease-out"
          style={{
            transform: `rotate(${rotation}deg)`,
            transitionTimingFunction: isSpinning ? 'cubic-bezier(0.17, 0.67, 0.12, 0.99)' : 'ease-out',
          }}
        >
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <defs>
              {SEGMENTS.map((segment, index) => (
                <linearGradient key={index} id={`grad-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={segment.color} stopOpacity="1" />
                  <stop offset="100%" stopColor={segment.color} stopOpacity="0.8" />
                </linearGradient>
              ))}
            </defs>

            {SEGMENTS.map((segment, index) => {
              const startAngle = (index * segmentAngle - 90) * (Math.PI / 180);
              const endAngle = ((index + 1) * segmentAngle - 90) * (Math.PI / 180);
              const largeArcFlag = segmentAngle > 180 ? 1 : 0;

              const x1 = 100 + 100 * Math.cos(startAngle);
              const y1 = 100 + 100 * Math.sin(startAngle);
              const x2 = 100 + 100 * Math.cos(endAngle);
              const y2 = 100 + 100 * Math.sin(endAngle);

              const textAngle = (index * segmentAngle + segmentAngle / 2) * (Math.PI / 180);
              const textRadius = 65;
              const textX = 100 + textRadius * Math.cos(textAngle - Math.PI / 2);
              const textY = 100 + textRadius * Math.sin(textAngle - Math.PI / 2);

              return (
                <g key={index}>
                  <path
                    d={`M 100 100 L ${x1} ${y1} A 100 100 0 ${largeArcFlag} 1 ${x2} ${y2} Z`}
                    fill={`url(#grad-${index})`}
                    stroke="white"
                    strokeWidth="1"
                  />
                  <text
                    x={textX}
                    y={textY}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fill="white"
                    fontSize="11"
                    fontWeight="bold"
                    transform={`rotate(${index * segmentAngle + segmentAngle / 2}, ${textX}, ${textY})`}
                    style={{ textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}
                  >
                    {segment.label}
                  </text>
                </g>
              );
            })}

            <circle cx="100" cy="100" r="15" fill="white" stroke="#333" strokeWidth="2" />
            <circle cx="100" cy="100" r="8" fill="#fbbf24" />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 z-10">
        <div className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-bold">
          💎 TON
        </div>
      </div>
    </div>
  );
}
