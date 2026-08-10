import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBillingStatus } from '../../../services/billingApi';

interface ProgressBarProps {
  label: string;
  current: number;
  max: number;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ label, current, max }) => {
  const percentage = Math.min((current / max) * 100, 100);
  
  let barColor = 'bg-zinc-500';
  if (percentage >= 100) {
    barColor = 'bg-rose-500';
  } else if (percentage >= 80) {
    barColor = 'bg-amber-500';
  }

  return (
    <div className="mb-4 last:mb-0">
      <div className="flex justify-between text-xs mb-2">
        <span className="text-zinc-400 uppercase tracking-wider">{label}</span>
        <span className="font-mono text-zinc-300">
          {current.toLocaleString('pt-BR')} / {max.toLocaleString('pt-BR')}
        </span>
      </div>
      <div className="w-full h-1 bg-zinc-800 overflow-hidden rounded-none">
        <div 
          className={`h-full transition-all duration-500 ${barColor}`} 
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
};

export const UsageBars: React.FC = () => {
  const { data: billing, isLoading } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
  });

  if (isLoading) {
    return (
      <div className="p-6 bg-[#09090B] border border-zinc-800 rounded-sm">
        <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-6">Uso da Cota (Ciclo Atual)</h3>
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-zinc-800 rounded w-full"></div>
          <div className="h-6 bg-zinc-800 rounded w-full"></div>
          <div className="h-6 bg-zinc-800 rounded w-full"></div>
        </div>
      </div>
    );
  }

  const isStarter = billing?.plan === 'STARTER';
  const isTrial = billing?.billingStatus === 'TRIAL';
  
  const msgLimit = isTrial ? 1000 : isStarter ? 1000 : billing?.plan === 'GROWTH' ? 25000 : 999999;
  const draftLimit = isTrial ? 30 : isStarter ? 1500 : billing?.plan === 'GROWTH' ? 1500 : 999999;
  const seatsLimit = isStarter ? 3 : billing?.plan === 'GROWTH' ? 10 : 999;

  return (
    <div className="p-6 bg-[#09090B] border border-zinc-800 rounded-sm">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-6">Uso da Cota (Ciclo Atual)</h3>
      
      <ProgressBar label="Mensagens Recebidas" current={billing?.messagesProcessedThisMonth || 0} max={msgLimit} />
      <ProgressBar label="Rascunhos de IA (Copiloto)" current={billing?.aiDraftsProcessedThisMonth || 0} max={draftLimit} />
      <ProgressBar label="Usuários (Seats)" current={1} max={seatsLimit} />
    </div>
  );
};
