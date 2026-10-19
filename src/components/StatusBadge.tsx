import React from 'react';
import { Course } from '../types';
import { Badge } from './ui/badge';

interface StatusBadgeProps {
  status: Course['status'];
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  showDot?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  title?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  size = 'md',
  showDot = true,
  className = '',
  onClick,
  title,
}) => {
  const configs = {
    active: {
      label: 'Active',
      variant: 'active' as const,
      dotColor: 'bg-blue-500 dark:bg-blue-400',
      pingColor: 'bg-blue-400',
    },
    completed: {
      label: 'Passed',
      variant: 'passed' as const,
      dotColor: 'bg-emerald-500 dark:bg-emerald-400',
      pingColor: null,
    },
    planned: {
      label: 'Planned',
      variant: 'planned' as const,
      dotColor: 'bg-amber-500 dark:bg-amber-400',
      pingColor: null,
    },
  };

  const cfg = configs[status] || configs.active;
  const dotSize = size === 'lg' ? 'h-2 w-2' : 'h-1.5 w-1.5';
  const badgeSize = size === 'sm' ? 'sm' : size === 'lg' ? 'lg' : 'default';

  return (
    <Badge
      variant={cfg.variant}
      size={badgeSize}
      onClick={onClick}
      title={title}
      className={`inline-flex items-center gap-1.5 transition-transform hover:scale-[1.02] ${className}`}
    >
      {showDot && (
        <span className={`relative flex ${dotSize} shrink-0`}>
          {cfg.pingColor && (
            <span
              className={`animate-ping absolute inline-flex h-full w-full rounded-full ${cfg.pingColor} opacity-75`}
            />
          )}
          <span
            className={`relative inline-flex rounded-full ${dotSize} ${cfg.dotColor}`}
          />
        </span>
      )}
      <span className="leading-none font-semibold">{cfg.label}</span>
    </Badge>
  );
};
