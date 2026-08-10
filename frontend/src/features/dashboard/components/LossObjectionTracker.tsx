import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLossObjections } from '../../../services/dashboardApi';
import { Loader2 } from 'lucide-react';

export const LossObjectionTracker: React.FC = () => {
  const { data: objections, isLoading } = useQuery({
    queryKey: ['dashboard-insights', 'objections'],
    queryFn: getLossObjections,
  });

  if (isLoading || !objections) {
    return (
      <div className="w-full h-[200px] border border-zinc-800 rounded-sm bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const highestLoss = Math.max(...objections.map(o => o.estimatedLoss));

  return (
    <div className="w-full border border-zinc-800 rounded-sm bg-[#09090b] flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs text-zinc-500 tracking-wider font-sans uppercase">Perda Semântica por Objeção</h3>
      </div>
      <div className="p-4 flex flex-col gap-4 flex-1 justify-between">
        {objections.map((obj, i) => (
          <div key={i} className="flex flex-col gap-1.5">
            <div className="flex justify-between items-end">
              <span className="text-xs font-medium text-zinc-400">{obj.category}</span>
              <span className={`text-xs font-medium ${obj.estimatedLoss === highestLoss ? 'text-rose-500' : 'text-zinc-300'}`}>
                {formatCurrency(obj.estimatedLoss)}
              </span>
            </div>
            <div className="w-full bg-black rounded-sm border border-zinc-800 overflow-hidden h-1">
              <div 
                className="h-full bg-zinc-300" 
                style={{ width: `${obj.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
