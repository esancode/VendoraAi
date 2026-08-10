import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { getBillingStatus } from '../../../services/billingApi';
import { UsageBars } from './UsageBars';
import { ByokCard } from './ByokCard';
import { PlanSelector } from './PlanSelector';

export const BillingDashboard: React.FC = () => {
  const { data: billing, isLoading } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
  });
  return (
    <div className="space-y-8">
      {/* Informações da Assinatura e Consumo */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-6 bg-[#09090B] border border-zinc-800 rounded-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Plano Atual</h3>
            {isLoading ? (
              <div className="h-8 w-24 bg-zinc-800 animate-pulse rounded"></div>
            ) : (
              <>
                <p className="text-2xl font-semibold text-white tracking-tight">{billing?.plan || 'STARTER'}</p>
                <p className="text-sm text-zinc-500 mt-1">Status: <span className={billing?.billingStatus === 'TRIAL' ? 'text-amber-400' : 'text-emerald-400'}>{billing?.billingStatus === 'TRIAL' ? 'TESTE GRATUITO' : 'Ativo'}</span></p>
                {billing?.billingStatus === 'TRIAL' && (
                  <p className="text-xs text-zinc-600 mt-1">
                    Expira em {billing?.daysRemaining || 0} dias
                  </p>
                )}
              </>
            )}
          </div>
          <div className="mt-6">
            <button className="text-sm px-4 py-2 bg-zinc-900 border border-zinc-700 text-zinc-300 rounded-sm hover:bg-zinc-800 transition-colors w-full sm:w-auto">
              Gerenciar no Asaas
            </button>
          </div>
        </div>

        <UsageBars />
      </section>

      {/* BYOK Configuration */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Provedor de IA Próprio (BYOK)</h2>
        <ByokCard />
      </section>

      {/* Planos */}
      <section>
        <h2 className="text-lg font-medium text-white mb-4">Opções de Upgrade</h2>
        <PlanSelector />
      </section>
    </div>
  );
};
