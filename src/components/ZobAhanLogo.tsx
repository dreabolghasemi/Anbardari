import React, { useState } from 'react';
import logoPng from '../assets/images.png';

interface ZobAhanLogoProps {
  className?: string;
  alt?: string;
}

/**
 * Official Logo for Esfahan Steel Company (ذوب‌آهن اصفهان)
 * Uses the uploaded images.png file with high-resolution scaling and fallback.
 */
export const ZobAhanLogo: React.FC<ZobAhanLogoProps> = ({
  className = 'w-10 h-10',
  alt = 'آرم شرکت سهامی ذوب‌آهن اصفهان',
}) => {
  const [hasError, setHasError] = useState(false);

  return (
    <img
      src={hasError ? './images.png' : logoPng}
      alt={alt}
      className={`${className} object-contain select-none`}
      onError={() => {
        if (!hasError) setHasError(true);
      }}
    />
  );
};

