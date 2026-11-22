import React from 'react';

interface PanankayamBridgeBannerProps {
  serviceAreaLabel?: string;
}

export const PanankayamBridgeBanner: React.FC<PanankayamBridgeBannerProps> = ({
  serviceAreaLabel = 'പനങ്കയം പാലത്തിനരികെ · 679334',
}) => {
  return (
    <div className="relative w-full h-36 sm:h-48 overflow-hidden select-none bg-[#F1D9B0]">
      <svg
        viewBox="0 0 400 180"
        preserveAspectRatio="xMidYMid slice"
        className="w-full h-full block"
        aria-label="Illustration of Panankayam bridge, hills, coconut palms, and river"
        role="img"
      >
        {/* Warm morning sky */}
        <rect width="400" height="180" fill="#F1D9B0" />

        {/* Warm sun */}
        <circle cx="295" cy="48" r="22" fill="#DE8E3E" />

        {/* Back mountain range */}
        <path
          d="M0 112 L55 72 L115 102 L175 60 L235 98 L305 64 L365 92 L400 76 L400 130 L0 130 Z"
          fill="#6B9884"
        />

        {/* Closer mountain silhouettes */}
        <path
          d="M0 120 L48 92 L110 112 L162 84 L225 114 L288 86 L348 108 L400 94 L400 132 L0 132 Z"
          fill="#3E7363"
        />

        {/* River water */}
        <rect x="0" y="124" width="400" height="56" fill="#468C83" />
        {/* Subtle water reflections */}
        <rect x="30" y="138" width="52" height="3" rx="1.5" fill="#5CA39A" opacity="0.65" />
        <rect x="260" y="150" width="68" height="3" rx="1.5" fill="#5CA39A" opacity="0.55" />

        {/* Bridge piers */}
        <g fill="#B6BFB8">
          <rect x="24" y="114" width="11" height="40" />
          <rect x="78" y="114" width="11" height="44" />
          <rect x="132" y="114" width="11" height="46" />
          <rect x="186" y="114" width="11" height="46" />
          <rect x="240" y="114" width="11" height="46" />
          <rect x="294" y="114" width="11" height="44" />
          <rect x="348" y="114" width="11" height="40" />
        </g>

        {/* Pier shadow reflections */}
        <g fill="#2C5E58" opacity="0.5">
          <rect x="24" y="148" width="11" height="12" />
          <rect x="78" y="148" width="11" height="14" />
          <rect x="132" y="148" width="11" height="16" />
          <rect x="186" y="148" width="11" height="16" />
          <rect x="240" y="148" width="11" height="16" />
          <rect x="294" y="148" width="11" height="14" />
          <rect x="348" y="148" width="11" height="12" />
        </g>

        {/* Bridge deck & railings */}
        <rect x="0" y="108" width="400" height="8" fill="#E6EAE3" />
        <rect x="0" y="102" width="400" height="2" fill="#D2D9D0" />
        <g fill="#D2D9D0">
          <rect x="10" y="102" width="3" height="6" />
          <rect x="35" y="102" width="3" height="6" />
          <rect x="60" y="102" width="3" height="6" />
          <rect x="85" y="102" width="3" height="6" />
          <rect x="110" y="102" width="3" height="6" />
          <rect x="135" y="102" width="3" height="6" />
          <rect x="160" y="102" width="3" height="6" />
          <rect x="185" y="102" width="3" height="6" />
          <rect x="210" y="102" width="3" height="6" />
          <rect x="235" y="102" width="3" height="6" />
          <rect x="260" y="102" width="3" height="6" />
          <rect x="285" y="102" width="3" height="6" />
          <rect x="310" y="102" width="3" height="6" />
          <rect x="335" y="102" width="3" height="6" />
          <rect x="360" y="102" width="3" height="6" />
          <rect x="385" y="102" width="3" height="6" />
        </g>

        {/* Left coconut palm */}
        <path d="M18 148 Q26 105 22 72" stroke="#1E4A3E" strokeWidth="4" fill="none" />
        <g fill="#1E4A3E">
          <path d="M22 72 Q5 65 -4 78 Q10 74 22 74 Z" />
          <path d="M22 72 Q6 56 2 62 Q14 66 22 72 Z" />
          <path d="M22 72 Q30 52 44 60 Q32 65 22 72 Z" />
          <path d="M22 72 Q40 66 48 80 Q33 74 22 72 Z" />
          <path d="M22 72 Q22 86 14 96 Q20 84 22 72 Z" />
        </g>

        {/* Right coconut palm */}
        <path d="M382 148 Q374 106 378 74" stroke="#1E4A3E" strokeWidth="4" fill="none" />
        <g fill="#1E4A3E">
          <path d="M378 74 Q360 66 350 78 Q366 74 378 74 Z" />
          <path d="M378 74 Q362 56 356 62 Q368 66 378 74 Z" />
          <path d="M378 74 Q388 54 402 62 Q390 67 378 74 Z" />
          <path d="M378 74 Q395 68 405 82 Q390 76 378 74 Z" />
          <path d="M378 74 Q378 88 370 98 Q376 86 378 74 Z" />
        </g>

        {/* Small country boat on river */}
        <path d="M188 158 Q200 163 214 158 L209 162 L193 162 Z" fill="#6F4327" />
        <line x1="201" y1="158" x2="207" y2="146" stroke="#6F4327" strokeWidth="1.5" />
      </svg>

      {/* Dark green translucent location overlay matching mockup */}
      <div className="absolute inset-x-0 bottom-3 flex justify-center px-4">
        <span className="px-3.5 py-1.5 rounded-lg bg-[#143D33]/90 text-white text-xs font-medium tracking-tight shadow-xs">
          {serviceAreaLabel}
        </span>
      </div>
    </div>
  );
};
