
import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = "w-10 h-10" }) => {
  return (
    <div className={`${className} relative flex items-center justify-center`}>
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-[0_0_8px_rgba(99,102,241,0.3)]">
        <defs>
          <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#3b82f6" />
          </linearGradient>
          <linearGradient id="accentGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#60a5fa" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>

        {/* Outer Hexagon Background (Subtle) */}
        <path 
          d="M50 5 L89 27.5 V72.5 L50 95 L11 72.5 V27.5 L50 5Z" 
          fill="#111827" 
          stroke="#1f2937" 
          strokeWidth="1" 
        />

        {/* The "Q" Main Body */}
        <path 
          d="M50 20 C33.4315 20 20 33.4315 20 50 C20 66.5685 33.4315 80 50 80 C55.3 80 60.3 78.6 64.6 76.2 L78 89.6 L86.5 81.1 L73.1 67.7 C77.4 62.9 80 56.7 80 50 C80 33.4315 66.5685 20 50 20ZM50 71 C38.402 71 29 61.598 29 50 C29 38.402 38.402 29 50 29 C61.598 29 71 38.402 71 50 C71 61.598 61.598 71 50 71Z" 
          fill="url(#logoGradient)" 
        />

        {/* The Integrated "1" (One) */}
        <path 
          d="M47 38 L47 62 H54 V38 H47Z" 
          fill="white" 
          opacity="0.9"
        />
        <path 
          d="M47 38 L41 43 L43 46 L47 42 V38Z" 
          fill="white" 
          opacity="0.9"
        />
        
        {/* Modern Accent Bar at bottom of 1 */}
        <rect x="44" y="60" width="13" height="3" rx="1.5" fill="white" opacity="0.9" />

        {/* Cyber Scanning Line Detail */}
        <rect x="25" y="48" width="50" height="4" rx="2" fill="#60a5fa" opacity="0.2" className="animate-pulse" />
        
        {/* Core Dot (Center of Intelligence) */}
        <circle cx="50" cy="50" r="3" fill="white" className="animate-ping" style={{ animationDuration: '3s' }} />
        <circle cx="50" cy="50" r="2" fill="url(#accentGradient)" />
      </svg>
    </div>
  );
};

export default Logo;
