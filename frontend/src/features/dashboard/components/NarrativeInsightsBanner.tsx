import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getNarrativeInsights } from '../../../services/dashboardApi';
import { Loader2 } from 'lucide-react';

export const NarrativeInsightsBanner: React.FC = () => {
  const { data: insights, isLoading } = useQuery({
    queryKey: ['dashboard-insights', 'narrative'],
    queryFn: getNarrativeInsights,
  });

  if (isLoading || !insights) {
    return (
      <div className="w-full h-[100px] border border-zinc-800 rounded-sm bg-[#09090b] flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-600" />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  return (
    <div className="w-full border border-zinc-800 rounded-sm bg-[#09090b] p-6">
      <p className="text-zinc-100 text-base md:text-lg leading-relaxed font-sans">
        Olá, <strong className="text-emerald-500 font-medium">{insights.managerName}</strong>. 
        Seu tempo médio de resposta útil hoje está em <strong className="text-emerald-500 font-medium">{insights.avgSlaMinutes} minutos</strong>. 
        Identificamos <strong className="text-emerald-500 font-medium">{insights.coolingLeads} leads esfriando</strong> sem resposta humana na fila. 
        Seu maior vazamento de faturamento esta semana são as <strong className="text-emerald-500 font-medium">{insights.topLossReason}</strong>, 
        que representam <strong className="text-emerald-500 font-medium">{insights.topLossPercentage}% das suas perdas</strong>, 
        acumulando um prejuízo estimado de <strong className="text-emerald-500 font-medium">{formatCurrency(insights.estimatedLossBrl)}</strong>.
      </p>
    </div>
  );
};
