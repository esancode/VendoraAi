import React, { useEffect, useState } from 'react';
import type { Lead } from '../../../services/dashboardApi';
import { differenceInSeconds, parseISO } from 'date-fns';
import { cn } from '../../../utils/cn';

interface LeadCardProps {
  lead: Lead;
  isActive?: boolean;
  onClick?: (lead: Lead) => void;
}

export const LeadCard: React.FC<LeadCardProps> = ({ lead, isActive, onClick }) => {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  const slaLimitAt = parseISO(lead.slaLimitAt);
  const remainingSeconds = differenceInSeconds(slaLimitAt, now);
  const isBreached = remainingSeconds < 0;

  let timerColor = 'text-sifto-sla-success';
  if (remainingSeconds < 5 * 60) {
    timerColor = 'text-rose-500';
  } else if (remainingSeconds < 15 * 60) {
    timerColor = 'text-amber-500';
  }

  const formatTime = (seconds: number) => {
    const absSeconds = Math.abs(seconds);
    const m = Math.floor(absSeconds / 60);
    const s = absSeconds % 60;
    const sign = seconds < 0 ? '-' : '';
    return `${sign}${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const channelName = lead.status === 'OPEN' ? 'channel-vendas-sp' : 'channel-suporte-rj';

  return (
    <div 
      onClick={() => onClick?.(lead)}
      className={cn(
        "flex items-center justify-between p-3 rounded-sm border border-zinc-800 bg-black transition-colors",
        onClick && "cursor-pointer hover:border-zinc-600",
        isActive && "border-zinc-500 bg-zinc-900",
        isBreached && !isActive && "animate-[pulse_2s_ease-in-out_infinite] border-rose-900/50 bg-rose-950/10"
      )}
    >
      <div className="flex flex-col">
        <span className="text-base font-medium text-zinc-300 truncate max-w-[160px]">{lead.name}</span>
        <span className="text-xs text-zinc-600">{channelName}</span>
      </div>
      <div className="flex flex-col items-end">
        <span className={cn("font-bold text-base", timerColor)}>
          {formatTime(remainingSeconds)}
        </span>
        <span className="text-xs text-zinc-600">SLA LIMIT</span>
      </div>
    </div>
  );
};
