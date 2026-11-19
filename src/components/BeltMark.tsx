import React from 'react';

interface BeltMarkProps {
  colorHex: string;
  beltName: string;
  size?: 'sm' | 'md' | 'lg';
}

export const BeltMark: React.FC<BeltMarkProps> = ({ colorHex, beltName, size = 'md' }) => {
  const isWhite = colorHex.toUpperCase() === '#E5E7EB' || beltName.toLowerCase().includes('white');
  const isBlack = colorHex.toUpperCase() === '#111317' || beltName.toLowerCase().includes('black');
  const dims = size === 'sm' ? 'w-7 h-3' : size === 'lg' ? 'w-14 h-5' : 'w-10 h-3.5';

  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox="0 0 64 20"
        className={`${dims} shrink-0`}
        aria-hidden="true"
      >
        <rect
          x="1"
          y="4"
          width="62"
          height="12"
          rx="2"
          fill={colorHex}
          stroke={isWhite ? '#9CA3AF' : isBlack ? '#374151' : 'rgba(0,0,0,0.2)'}
          strokeWidth="1.2"
        />
        <rect x="27" y="2.5" width="10" height="15" rx="1.5" fill={colorHex} stroke={isWhite ? '#9CA3AF' : '#111317'} strokeWidth="1" />
        {isBlack && <rect x="50" y="4.5" width="4" height="11" fill="#C59B27" />}
      </svg>
      <span className="font-medium text-[#111317] whitespace-nowrap">{beltName}</span>
    </span>
  );
};

interface AvatarProps {
  name: string;
  avatarUrl?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export const UserAvatar: React.FC<AvatarProps> = ({ name, avatarUrl, size = 'md' }) => {
  const [imgError, setImgError] = React.useState(false);

  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  const sizeClass =
    size === 'sm'
      ? 'w-8 h-8 text-xs'
      : size === 'lg'
        ? 'w-12 h-12 text-sm'
        : size === 'xl'
          ? 'w-20 h-20 text-xl'
          : 'w-9 h-9 text-xs';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover border border-[#E5E7EB] shrink-0 bg-[#111317]`}
      />
    );
  }

  return (
    <div
      className={`${sizeClass} rounded-full bg-[#111317] text-white font-display font-semibold flex items-center justify-center shrink-0 border border-[#272A30]`}
      aria-label={name}
    >
      {initials || 'TK'}
    </div>
  );
};
