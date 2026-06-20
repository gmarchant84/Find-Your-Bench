import { TrendingUp, Award } from 'lucide-react';

interface CredibilityScoreProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

export default function CredibilityScore({ score, size = 'md' }: CredibilityScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    if (score >= 40) return 'text-yellow-600';
    if (score >= 20) return 'text-orange-600';
    return 'text-gray-500';
  };

  const getScoreBg = () => {
    if (score >= 80) return 'bg-green-100';
    if (score >= 60) return 'bg-blue-100';
    if (score >= 40) return 'bg-yellow-100';
    if (score >= 20) return 'bg-orange-100';
    return 'bg-gray-100';
  };

  const getScoreLabel = () => {
    if (score >= 80) return 'Highly Trusted';
    if (score >= 60) return 'Trusted';
    if (score >= 40) return 'Moderately Trusted';
    if (score >= 20) return 'Low Trust';
    return 'New Listing';
  };

  const sizeClasses = {
    sm: {
      container: 'text-xs',
      icon: 'w-3 h-3',
      score: 'text-sm'
    },
    md: {
      container: 'text-sm',
      icon: 'w-4 h-4',
      score: 'text-base'
    },
    lg: {
      container: 'text-base',
      icon: 'w-5 h-5',
      score: 'text-lg'
    }
  };

  return (
    <div className={`flex items-center gap-2 ${sizeClasses[size].container}`}>
      <div className={`p-2 rounded-lg ${getScoreBg()}`}>
        <Award className={`${getScoreColor()} ${sizeClasses[size].icon}`} />
      </div>
      <div>
        <p className={`font-bold ${getScoreColor()} ${sizeClasses[size].score}`}>
          {Math.round(score)}/100
        </p>
        <p className="text-xs text-gray-600">{getScoreLabel()}</p>
      </div>
    </div>
  );
}
