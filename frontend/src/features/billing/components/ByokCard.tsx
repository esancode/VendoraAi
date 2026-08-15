import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getBillingStatus, saveByok } from '../../../services/billingApi';

export const ByokCard: React.FC = () => {
  const queryClient = useQueryClient();
  const { data: billing } = useQuery({
    queryKey: ['billingStatus'],
    queryFn: getBillingStatus,
  });

  const hasKey = billing?.hasGeminiKey || false;
  const [geminiKey, setGeminiKey] = useState('');
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    if (hasKey) {
      setGeminiKey('••••••••••••••••');
    }
  }, [hasKey]);

  const mutation = useMutation({
    mutationFn: (key: string) => saveByok(key, undefined),
    onSuccess: () => {
      setIsSaved(true);
      queryClient.invalidateQueries({ queryKey: ['billingStatus'] });
      setTimeout(() => setIsSaved(false), 3000);
    }
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (geminiKey.trim() && geminiKey !== '••••••••••••••••') {
      mutation.mutate(geminiKey);
    }
  };

  return (
    <div className="p-6 bg-[#09090B] border border-zinc-800 rounded-sm">
      <div className="flex flex-col sm:flex-row gap-8">
        <div className="sm:w-1/3">
          <h3 className="text-sm font-medium text-white mb-2">[PROVEDOR_DE_IA_PROPRIO]</h3>
          <p className="text-sm text-zinc-400">
            Traga sua própria chave de API (BYOK) para pular os limites de cota do seu plano e pagar os custos de IA diretamente ao provedor (ex: Google).
          </p>
        </div>
        
        <div className="sm:w-2/3">
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="geminiKey" className="block text-xs uppercase tracking-wider text-zinc-500 mb-2">Gemini API Key</label>
              <input
                id="geminiKey"
                type="password"
                value={geminiKey}
                onChange={(e) => setGeminiKey(e.target.value)}
                placeholder="AIzaSy..."
                className="w-full bg-[#000000] border border-zinc-800 rounded-sm px-4 py-2.5 text-zinc-300 font-mono text-sm focus:outline-none focus:border-zinc-500 transition-colors"
              />
            </div>
            
            <div className="flex items-center justify-between mt-4">
              <div className="flex items-center">
                {hasKey || isSaved ? (
                  <span className="text-xs text-sifto-cobalt-light flex items-center gap-1.5 bg-sifto-cobalt-light/10 px-2 py-1 border border-sifto-cobalt-light/20 rounded-sm">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    ✓ Chave Ativa e Criptografada no PostgreSQL
                  </span>
                ) : (
                  <span className="text-xs text-zinc-600">As chaves são salvas usando criptografia AES-256-GCM.</span>
                )}
              </div>
              <button 
                type="submit" 
                disabled={mutation.isPending}
                className="text-sm px-4 py-2 bg-white text-black font-medium rounded-sm hover:bg-zinc-200 transition-colors"
              >
                Salvar Chave
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
