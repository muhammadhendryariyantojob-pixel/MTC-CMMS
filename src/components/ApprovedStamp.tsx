import React from 'react';

interface ApprovedStampProps {
  text?: string;
  className?: string;
  rotation?: number; // degrees, e.g. -5
  variant?: 'approved' | 'rejected';
}

export default function ApprovedStamp({ 
  text, 
  className = '', 
  rotation = -5,
  variant = 'approved'
}: ApprovedStampProps) {
  const isRejected = variant === 'rejected';
  const defaultText = isRejected ? 'REJECTED' : 'APPROVED';
  const stampText = text || defaultText;
  
  // Green for approved, Red for rejected
  const color = isRejected ? '#dc2626' : '#0c9e3f';
  const shadowColor = isRejected ? 'rgba(220,38,38,0.15)' : 'rgba(12,158,63,0.15)';

  return (
    <div 
      className={`relative select-none pointer-events-none flex items-center justify-center ${className}`} 
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg 
        viewBox="0 0 240 90" 
        className="w-36 h-14 opacity-90"
        style={{ filter: `drop-shadow(0 2px 4px ${shadowColor})` }}
      >
        {/* Outer Heavy Distressed Rounded Border */}
        <rect 
          x="4" 
          y="4" 
          width="232" 
          height="82" 
          rx="12" 
          fill="none" 
          stroke={color} 
          strokeWidth="5" 
          strokeLinecap="round" 
          strokeDasharray="180 3 10 2 40 4 2 3" 
        />
        
        {/* Inner Distressed Rounded Border */}
        <rect 
          x="12" 
          y="12" 
          width="216" 
          height="66" 
          rx="8" 
          fill="none" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeDasharray="120 2 8 2 30 2" 
        />

        {/* Text of the Stamp */}
        <text 
          x="50%" 
          y="56%" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fill={color} 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" 
          fontSize="24" 
          fontWeight="900" 
          letterSpacing="1.5"
          className="select-none"
        >
          {stampText}
        </text>

        {/* Realism: Distressed / Grunge Overlay Marks & Splatters */}
        {/* Left Edge Scratch */}
        <path d="M 6 15 L 10 24 M 8 40 L 14 36 M 12 65 L 7 70" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        
        {/* Right Edge Scratch */}
        <path d="M 230 20 L 226 30 M 232 50 L 225 45 M 228 72 L 233 66" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
        
        {/* Top/Bottom Edge Scratches */}
        <path d="M 50 6 L 60 10 M 110 5 L 105 12 M 170 7 L 165 11" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <path d="M 80 84 L 85 78 M 140 85 L 146 79 M 190 83 L 182 86" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

        {/* Grunge Splatters / Dots across the stamp */}
        <circle cx="32" cy="24" r="1.5" fill={color} opacity="0.8" />
        <circle cx="28" cy="55" r="1.2" fill={color} opacity="0.75" />
        <circle cx="48" cy="74" r="1.8" fill={color} opacity="0.85" />
        <circle cx="74" cy="18" r="1.4" fill={color} opacity="0.7" />
        <circle cx="95" cy="76" r="1.6" fill={color} opacity="0.8" />
        <circle cx="118" cy="22" r="1.3" fill={color} opacity="0.75" />
        <circle cx="135" cy="71" r="1.5" fill={color} opacity="0.8" />
        <circle cx="162" cy="19" r="1.4" fill={color} opacity="0.7" />
        <circle cx="185" cy="72" r="1.6" fill={color} opacity="0.8" />
        <circle cx="205" cy="26" r="1.2" fill={color} opacity="0.75" />
        <circle cx="212" cy="58" r="1.5" fill={color} opacity="0.8" />
        
        {/* Distressed texture paths intersecting the text */}
        <path d="M 45 42 L 52 46" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M 82 32 L 87 38" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M 125 45 L 129 41" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M 165 35 L 169 31" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        <path d="M 195 48 L 202 44" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
        
        {/* Subtle green/red ink blots inside the empty space */}
        <path d="M 38 46 Q 40 48 42 45 T 38 46" fill={color} opacity="0.7" />
        <path d="M 102 30 Q 104 33 105 31 T 102 30" fill={color} opacity="0.7" />
        <path d="M 152 58 Q 155 61 156 59 T 152 58" fill={color} opacity="0.7" />
      </svg>
    </div>
  );
}
