import { useState, useRef, useEffect } from "react";
import { useLocation } from "wouter";

export default function FloatingTaskButton() {
  const [, setLocation] = useLocation();
  const [position, setPosition] = useState({ x: 20, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [hasMoved, setHasMoved] = useState(false);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const saved = localStorage.getItem('floatingTaskButtonPos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPosition(parsed);
      } catch {}
    } else {
      setPosition({ x: window.innerWidth - 145, y: window.innerHeight - 160 });
    }
  }, []);

  const handleStart = (clientX: number, clientY: number) => {
    setIsDragging(true);
    setHasMoved(false);
    dragStartPos.current = { x: clientX, y: clientY };
    initialPos.current = { ...position };
  };

  const handleMove = (clientX: number, clientY: number) => {
    if (!isDragging) return;
    
    const deltaX = clientX - dragStartPos.current.x;
    const deltaY = clientY - dragStartPos.current.y;
    
    if (Math.abs(deltaX) > 5 || Math.abs(deltaY) > 5) {
      setHasMoved(true);
    }
    
    const newX = Math.max(10, Math.min(window.innerWidth - 145, initialPos.current.x + deltaX));
    const newY = Math.max(60, Math.min(window.innerHeight - 80, initialPos.current.y + deltaY));
    
    setPosition({ x: newX, y: newY });
  };

  const handleEnd = () => {
    if (isDragging) {
      setIsDragging(false);
      localStorage.setItem('floatingTaskButtonPos', JSON.stringify(position));
    }
  };

  const handleClick = () => {
    if (!hasMoved) {
      setLocation('/task/create');
    }
    setHasMoved(false);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX, e.clientY);
    const handleMouseUp = () => handleEnd();
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) {
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };
    const handleTouchEnd = () => handleEnd();

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, position]);

  return (
    <div
      ref={buttonRef}
      className="fixed z-[100] flex items-center gap-2 px-4 py-2.5 rounded-full bg-white shadow-lg border border-gray-200 transition-transform active:scale-95 touch-none select-none cursor-grab active:cursor-grabbing"
      style={{
        left: position.x,
        top: position.y,
      }}
      onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
      onTouchStart={(e) => {
        if (e.touches.length > 0) {
          handleStart(e.touches[0].clientX, e.touches[0].clientY);
        }
      }}
      onClick={handleClick}
    >
      <div className="w-6 h-6 rounded-full bg-black flex items-center justify-center">
        <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
      </div>
      <span className="text-black font-semibold text-sm whitespace-nowrap">Create Task</span>
    </div>
  );
}
