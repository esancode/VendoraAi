import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getUnmappedDemands } from '../../../services/dashboardApi';
import { Loader2 } from 'lucide-react';

export const UnmappedDemandsList: React.FC = () => {
  const { data: demands, isLoading } = useQuery({
    queryKey: ['dashboard-insights', 'demands'],
    queryFn: getUnmappedDemands,
  });

  if (isLoading || !demands) {
    return (
      <div className="w-full h-[200px] border border-zinc-800 rounded-sm bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="w-full border border-zinc-800 rounded-sm bg-[#09090b] flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs text-zinc-500 tracking-wider font-sans uppercase">Oportunidades Não Mapeadas</h3>
      </div>
      <div className="p-4 flex flex-col gap-4">
        {demands.map((demand, i) => (
          <div key={i} className="flex flex-col gap-1 p-3 border border-zinc-800/50 rounded-sm bg-black/50">
            <div className="flex justify-between items-start">
              <span className="text-sm font-sans text-zinc-300">{demand.term}</span>
              <span className="text-[10px] font-medium text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded-sm border border-emerald-500/20">
                [NOVA_OPORTUNIDADE]
              </span>
            </div>
            <span className="text-xs font-medium text-zinc-500 mt-1">
              {String(demand.count).padStart(2, '0')} leads interessados
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
