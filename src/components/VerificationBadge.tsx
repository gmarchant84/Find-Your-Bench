import { CheckCircle, Clock, Users } from 'lucide-react';

interface VerificationBadgeProps {
  status: 'unverified' | 'community_confirmed' | 'verified';
  confirmationCount?: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

export default function VerificationBadge({
  status,
  confirmationCount = 0,
  size = 'md',
  showLabel = true,
}: VerificationBadgeProps) {
  const config = (() => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          label: 'Verified',
          color: 'text-green-700',
          bgColor: 'bg-green-100',
          borderColor: 'border-green-300',
          description: 'Community-verified bench',
        };
      case 'community_confirmed':
        return {
          icon: Users,
          label: 'Community Pick',
          color: 'text-blue-700',
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          description: 'Confirmed by multiple users',
        };
      default:
        return {
          icon: Clock,
          label: 'Unverified',
          color: 'text-gray-500',
          bgColor: 'bg-gray-50',
          borderColor: 'border-gray-200',
          description: 'Awaiting community confirmation',
        };
    }
  })();

  const Icon = config.icon;

  const sizeClasses = {
    sm: { container: 'px-2 py-0.5 text-xs gap-1', icon: 'w-3 h-3' },
    md: { container: 'px-2.5 py-1 text-xs gap-1.5', icon: 'w-3.5 h-3.5' },
    lg: { container: 'px-3 py-1.5 text-sm gap-2', icon: 'w-4 h-4' },
  };

  const s = sizeClasses[size];

  return (
    <div
      className={`inline-flex items-center ${s.container} rounded-full border font-semibold ${config.bgColor} ${config.borderColor} tracking-wide`}
      title={config.description}
    >
      <Icon className={`${config.color} ${s.icon} flex-shrink-0`} />
      {showLabel && (
        <span className={config.color}>
          {config.label}
          {confirmationCount > 0 && status !== 'unverified' && (
            <span className="ml-1 font-normal opacity-70">·{confirmationCount}</span>
          )}
        </span>
      )}
    </div>
  );
}
