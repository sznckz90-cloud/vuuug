import { useEffect, useState } from 'react';

interface NumberCountingSpinnerProps {
  isSpinning: boolean;
  finalValue?: string;
  onComplete?: () => void;
}

export function NumberCountingSpinner({ isSpinning, finalValue, onComplete }: NumberCountingSpinnerProps) {
  const [displayValue, setDisplayValue] = useState('0');

  useEffect(() => {
    if (!isSpinning) {
      if (!finalValue) {
        setDisplayValue('0');
      }
      return;
    }

    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    // Phase 1: Fast counting with larger decimals (10.5, 8.3, etc) - 0-1000ms
    interval = setInterval(() => {
      const randomValue = (Math.random() * 100 + 1).toFixed(1);
      setDisplayValue(randomValue);
    }, 50);

    // Phase 2: Slow down with smaller decimals (0.9, 0.5, etc) - 1000-2000ms
    timeout = setTimeout(() => {
      clearInterval(interval);
      
      interval = setInterval(() => {
        const randomValue = (Math.random() * 10).toFixed(2);
        setDisplayValue(randomValue);
      }, 100);

      // Phase 3: Very slow with tiny decimals (0.002, 0.001, etc) - 2000-2800ms
      timeout = setTimeout(() => {
        clearInterval(interval);
        
        interval = setInterval(() => {
          const randomValue = (Math.random() * 0.1).toFixed(3);
          setDisplayValue(randomValue);
        }, 150);

        // Phase 4: Stop and show final value - 2800-3000ms
        timeout = setTimeout(() => {
          clearInterval(interval);
          
          if (finalValue) {
            setDisplayValue(finalValue);
            setTimeout(() => {
              if (onComplete) onComplete();
            }, 500);
          }
        }, 800);
      }, 1000);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, finalValue, onComplete]);

  return (
    <div className="flex items-center justify-center py-8">
      <div className="relative">
        <div className="text-center">
          <div className={`text-6xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent transition-all duration-300 ${
            isSpinning ? 'scale-110 animate-pulse' : 'scale-100'
          }`}>
            {displayValue}
          </div>
        </div>
      </div>
    </div>
  );
}
