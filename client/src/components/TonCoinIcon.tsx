interface TonCoinIconProps {
  className?: string;
  size?: number;
}

export function TonCoinIcon({ className = "", size = 24 }: TonCoinIconProps) {
  const gradientId = `tonGradient-${Math.random().toString(36).substr(2, 9)}`;
  
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle cx="12" cy="12" r="10" fill={`url(#${gradientId})`} stroke="#0088CC" strokeWidth="1.5" />
      <path
        d="M8 9.5L12 7L16 9.5V14.5L12 17L8 14.5V9.5Z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
      <path
        d="M8 9.5L12 12L16 9.5"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M12 12V17"
        stroke="#ffffff"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <defs>
        <linearGradient id={gradientId} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0088CC" />
          <stop offset="100%" stopColor="#005A8C" />
        </linearGradient>
      </defs>
    </svg>
  );
}
