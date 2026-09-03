import React from 'react';

interface JobDoneStampProps {
  className?: string;
  rotation?: number; // degrees, e.g. -15
}

export default function JobDoneStamp({ 
  className = '', 
  rotation = -15 
}: JobDoneStampProps) {
  const color = '#22c55e'; // text-green-500
  
  return (
    <div 
      className={`relative select-none pointer-events-none flex items-center justify-center opacity-85 mix-blend-multiply ${className}`} 
      style={{ transform: `rotate(${rotation}deg)` }}
    >
      <svg 
        viewBox="0 0 200 200" 
        className="w-32 h-32"
      >
        {/* Outer Grunge Border */}
        <circle 
          cx="100" cy="100" r="95" 
          fill="none" 
          stroke={color} 
          strokeWidth="6"
          strokeDasharray="140 4 80 2 30 3 150 5 40 2"
          strokeLinecap="round"
        />
        {/* Inner Grunge Border */}
        <circle 
          cx="100" cy="100" r="82" 
          fill="none" 
          stroke={color} 
          strokeWidth="2"
          strokeDasharray="120 3 40 2 90 4 30 1"
          strokeLinecap="round"
        />
        
        {/* Top Stars */}
        <path id="top-curve" d="M 30 100 A 70 70 0 0 1 170 100" fill="none" />
        <text fill={color} fontSize="20" letterSpacing="3">
          <textPath href="#top-curve" startOffset="50%" textAnchor="middle">★ ★ ★ ★ ★</textPath>
        </text>
        
        {/* Bottom Stars */}
        <path id="bottom-curve" d="M 170 100 A 70 70 0 0 1 30 100" fill="none" />
        <text fill={color} fontSize="20" letterSpacing="3">
          <textPath href="#bottom-curve" startOffset="50%" textAnchor="middle">★ ★ ★ ★ ★</textPath>
        </text>

        {/* Text Center Grunge */}
        <text 
          x="100" 
          y="110" 
          dominantBaseline="middle" 
          textAnchor="middle" 
          fill={color} 
          fontFamily="Impact, system-ui, Arial, sans-serif" 
          fontSize="48" 
          fontWeight="900" 
          transform="scale(1, 1.2) translate(0, -9)"
        >
          JOB DONE
        </text>

        {/* Grunge Overlay Paths (Scratches & Dots) */}
        {/* Center line scratch */}
        <path d="M 10 95 L 190 105" stroke="#ffffff" strokeWidth="2" strokeDasharray="5 20 15 30 2 40" opacity="0.9" />
        <path d="M 15 105 L 185 95" stroke="#ffffff" strokeWidth="2" strokeDasharray="10 30 5 15 12 25" opacity="0.9" />
        <path d="M 40 85 L 50 115" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
        <path d="M 140 80 L 135 120" stroke="#ffffff" strokeWidth="2.5" opacity="0.8" />
        
        {/* Ink splatter dots */}
        <circle cx="50" cy="50" r="2.5" fill={color} opacity="0.8" />
        <circle cx="150" cy="40" r="1.5" fill={color} opacity="0.7" />
        <circle cx="160" cy="150" r="2" fill={color} opacity="0.8" />
        <circle cx="60" cy="160" r="3" fill={color} opacity="0.8" />
        <circle cx="80" cy="120" r="1.5" fill={color} opacity="0.6" />
        <circle cx="120" cy="70" r="2" fill={color} opacity="0.7" />
        <circle cx="20" cy="110" r="2" fill={color} opacity="0.8" />
        <circle cx="180" cy="90" r="1.5" fill={color} opacity="0.7" />
      </svg>
    </div>
  );
}
