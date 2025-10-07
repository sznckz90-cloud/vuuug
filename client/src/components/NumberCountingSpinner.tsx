import { useEffect, useState } from 'react';

interface NumberCountingSpinnerProps {
  isSpinning: boolean;
  finalValue?: string;
  onComplete?: () => void;
}

export function NumberCountingSpinner({ isSpinning, finalValue, onComplete }: NumberCountingSpinnerProps) {
  const [displayValue, setDisplayValue] = useState('0.000000');
  const [animationPhase, setAnimationPhase] = useState<'fast' | 'slow' | 'done'>('fast');

  useEffect(() => {
    if (!isSpinning) {
      setDisplayValue('0.000000');
      setAnimationPhase('fast');
      return;
    }

    let interval: NodeJS.Timeout;
    let timeout: NodeJS.Timeout;

    // Phase 1: Fast counting (0-1000ms)
    setAnimationPhase('fast');
    interval = setInterval(() => {
      const randomValue = (Math.random() * 10).toFixed(6);
      setDisplayValue(randomValue);
    }, 50);

    // Phase 2: Slow down after 1000ms
    timeout = setTimeout(() => {
      clearInterval(interval);
      setAnimationPhase('slow');
      
      interval = setInterval(() => {
        const randomValue = (Math.random() * 1).toFixed(6);
        setDisplayValue(randomValue);
      }, 150);

      // Phase 3: Stop and show final value after 2000ms total
      timeout = setTimeout(() => {
        clearInterval(interval);
        setAnimationPhase('done');
        
        if (finalValue) {
          setDisplayValue(finalValue);
          setTimeout(() => {
            if (onComplete) onComplete();
          }, 500);
        }
      }, 1000);
    }, 1000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [isSpinning, finalValue, onComplete]);

  return (
    <div className="flex flex-col items-center justify-center py-12">
      <div className="relative">
        <div className={`text-6xl font-bold text-primary transition-all duration-300 ${
          isSpinning ? 'scale-110' : 'scale-100'
        }`}>
          {displayValue}
        </div>
        <div className="text-center text-2xl font-semibold text-muted-foreground mt-2">
          TON
        </div>
      </div>
      
      {animationPhase === 'fast' && (
        <div className="mt-4 text-sm text-muted-foreground animate-pulse">
          Spinning...
        </div>
      )}
      
      {animationPhase === 'done' && finalValue && (
        <div className="mt-4 text-lg font-semibold text-green-500 animate-bounce">
          🎉 You won!
        </div>
      )}
    </div>
  );
}
