import React from 'react';
import { BillingDashboard } from '../features/billing/components/BillingDashboard';

export const BillingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-[#000000] text-zinc-300 font-sans">
      <div className="max-w-5xl mx-auto py-12 px-6">
        <h1 className="text-2xl font-semibold text-white tracking-tight mb-8">
          Faturamento & Assinatura
        </h1>
        <BillingDashboard />
      </div>
    </div>
  );
};
