interface FoundingBencherBadgeProps {
  size?: 'xs' | 'sm' | 'md';
  showLabel?: boolean;
}

export default function FoundingBencherBadge({ size = 'sm', showLabel = true }: FoundingBencherBadgeProps) {
  if (size === 'xs') {
    return (
      <span
        title="Founding Bencher — one of the first 50 members"
        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700 whitespace-nowrap"
      >
        <span className="text-xs leading-none">🪑</span>
        {showLabel && <span>Founder</span>}
      </span>
    );
  }

  if (size === 'sm') {
    return (
      <span
        title="Founding Bencher — one of the first 50 members"
        className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-amber-50 border border-amber-300 text-amber-700 whitespace-nowrap"
      >
        <span className="text-sm leading-none">🪑</span>
        {showLabel && <span>Founding Bencher</span>}
      </span>
    );
  }

  return (
    <span
      title="Founding Bencher — one of the first 50 members"
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-amber-50 border border-amber-300 text-amber-700 whitespace-nowrap"
    >
      <span className="text-base leading-none">🪑</span>
      {showLabel && <span>Founding Bencher</span>}
    </span>
  );
}
