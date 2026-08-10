import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getSlaBottlenecks } from '../../../services/dashboardApi';
import { Loader2 } from 'lucide-react';

export const SlaResponseBottleneck: React.FC = () => {
  const { data: bottlenecks, isLoading } = useQuery({
    queryKey: ['dashboard-insights', 'slas'],
    queryFn: getSlaBottlenecks,
  });

  if (isLoading || !bottlenecks) {
    return (
      <div className="w-full h-[200px] border border-zinc-800 rounded-sm bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="w-full border border-zinc-800 rounded-sm bg-[#09090b] flex flex-col h-full overflow-hidden">
      <div className="p-4 border-b border-zinc-800">
        <h3 className="text-xs text-zinc-500 tracking-wider font-sans uppercase">SLA & Gargalos Humanos</h3>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs whitespace-nowrap">
          <thead className="bg-black text-zinc-500 tracking-wider">
            <tr>
              <th className="px-4 py-3 font-medium border-b border-zinc-800">VENDEDOR</th>
              <th className="px-4 py-3 font-medium border-b border-zinc-800">SLA MÉDIO ÚTIL</th>
              <th className="px-4 py-3 font-medium border-b border-zinc-800">LEADS ESFRIADOS</th>
              <th className="px-4 py-3 font-medium border-b border-zinc-800">PERDAS POR DEMORA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
            {bottlenecks.map((b) => (
              <tr key={b.agentId} className="hover:bg-zinc-900/50 transition-colors">
                <td className="px-4 py-3 flex items-center gap-3">
                  {b.avatarUrl ? (
                    <img src={b.avatarUrl} alt={b.agentName} className="w-6 h-6 rounded-full grayscale" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center text-[10px]">
                      {b.agentName.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="font-sans text-sm">{b.agentName}</span>
                </td>
                <td className="px-4 py-3 text-zinc-400">{b.avgSlaFormatted}</td>
                <td className="px-4 py-3">
                  <span className={b.coolingLeadsCount > 10 ? 'text-rose-500' : 'text-zinc-400'}>
                    {String(b.coolingLeadsCount).padStart(2, '0')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span className={b.delayLossCount > 0 ? 'text-rose-500' : 'text-zinc-400'}>
                    {String(b.delayLossCount).padStart(2, '0')}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
