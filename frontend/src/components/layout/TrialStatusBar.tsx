import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { getBillingStatus } from '../../services/billingApi';

export const TrialStatusBar: React.FC = () => {
  const { data: billing, isLoading } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
  });
  
  if (isLoading) {
    return (
      <div className="w-full bg-[#000000] border-b border-zinc-800 py-2 px-4 flex justify-center items-center">
        <div className="h-4 w-64 bg-zinc-800 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!billing || billing.billingStatus !== 'TRIAL') return null;

  return (
    <div className="w-full bg-[#000000] border-b border-zinc-800 py-2 px-4 flex justify-center items-center">
      <p className="text-xs font-mono text-zinc-300">
        <span className="text-rose-500 mr-2">●</span>
        TESTE GRATUITO ATIVO: Restam {billing.daysRemaining} dias de teste.{' '}
        <Link to="/settings/billing" className="text-white hover:text-zinc-300 underline ml-2 transition-colors">
          [Fazer Upgrade de Plano]
        </Link>
      </p>
    </div>
  );
};
