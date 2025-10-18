interface DiamondIconProps {
  className?: string;
  size?: number;
  withGlow?: boolean;
}

export function DiamondIcon({ className = "", size = 24, withGlow = false }: DiamondIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} ${withGlow ? 'sparkle' : ''}`}
    >
      <path
        d="M12 2L4 8L12 22L20 8L12 2Z"
        fill="url(#diamondGradient)"
        stroke="#4cd3ff"
        strokeWidth="1.5"
        strokeLinejoin="miter"
      />
      <path
        d="M4 8L12 10L20 8"
        stroke="#4cd3ff"
        strokeWidth="1"
        opacity="0.6"
      />
      <path
        d="M12 2L12 22"
        stroke="#4cd3ff"
        strokeWidth="0.5"
        opacity="0.4"
      />
      <path
        d="M7 5L12 10L17 5"
        stroke="#b8b8b8"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <defs>
        <linearGradient id="diamondGradient" x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#666666" />
          <stop offset="50%" stopColor="#333333" />
          <stop offset="100%" stopColor="#999999" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function SparkleIcon({ className = "", size = 16 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${className} sparkle`}
    >
      <path
        d="M8 0L9 7L16 8L9 9L8 16L7 9L0 8L7 7L8 0Z"
        fill="#4cd3ff"
        opacity="0.8"
      />
    </svg>
  );
}
