import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../../services/api';
import { getBillingStatus } from '../../../services/billingApi';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';

const plansData = [
  {
    name: 'STARTER',
    price: 'R$ 149',
    period: '/mês',
    features: [
      'Até 3 Vendedores',
      '5.000 Mensagens/mês',
      'Sem geração de rascunhos',
      'Dashboard Básico'
    ],
  },
  {
    name: 'GROWTH',
    price: 'R$ 299',
    period: '/mês',
    features: [
      'Até 10 Vendedores',
      '25.000 Mensagens/mês',
      '1.500 Rascunhos de IA',
      'BYOK Suportado'
    ],
  },
  {
    name: 'ENTERPRISE',
    price: 'R$ 999',
    period: '/mês',
    features: [
      'Vendedores Ilimitados',
      'Mensagens Ilimitadas',
      'Rascunhos Ilimitados',
      'SLA Prioritário'
    ],
  }
];

export const PlanSelector: React.FC = () => {
  const { data: billing } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
  });
  const currentPlan = billing?.plan || 'STARTER';
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const checkoutMutation = useMutation({
    mutationFn: async (planName: string) => {
      const response = await api.post('/billing/checkout-link', { plan: planName });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.paymentLinkUrl) {
        window.open(data.paymentLinkUrl, '_blank');
      }
    },
    onError: () => {
      toast.error('Erro ao gerar link de pagamento.');
    },
    onSettled: () => {
      setLoadingPlan(null);
    }
  });

  const handleSubscribe = (planName: string) => {
    setLoadingPlan(planName);
    checkoutMutation.mutate(planName);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {plansData.map((plan) => {
        const isCurrent = currentPlan === plan.name;
        const isDisabled = isCurrent || (plan.name === 'STARTER'); // STARTER cannot be subscribed to directly

        return (
          <div 
            key={plan.name} 
            className={`flex flex-col p-6 rounded-sm border ${
              isCurrent ? 'bg-[#09090B] border-zinc-600' : 'bg-[#000000] border-zinc-800'
            }`}
          >
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">{plan.name}</h3>
            <div className="mb-6">
              <span className="text-3xl font-semibold text-white tracking-tight">{plan.price}</span>
              <span className="text-zinc-500 text-sm">{plan.period}</span>
            </div>
            
            <ul className="flex-1 space-y-3 mb-8">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start text-sm text-zinc-400">
                  <svg className="w-4 h-4 text-sifto-cobalt mr-2 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            
            <button 
              onClick={() => handleSubscribe(plan.name)}
              disabled={isDisabled || !!loadingPlan}
              className={`w-full py-2.5 px-4 text-sm font-medium rounded-sm transition-colors flex justify-center items-center ${
                isCurrent 
                  ? 'bg-zinc-800 text-zinc-400 cursor-default' 
                  : isDisabled 
                    ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                    : 'bg-white text-black hover:bg-zinc-200'
              }`}
            >
              {loadingPlan === plan.name ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isCurrent ? (
                'Plano Atual'
              ) : (
                'Assinar Plano'
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
};
