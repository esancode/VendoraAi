import { api } from './api';

export interface BillingStatusResponse {
  plan: 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  billingStatus: 'TRIAL' | 'ACTIVE' | 'OVERDUE' | 'SUSPENDED';
  trialEndsAt: string | null;
  daysRemaining: number;
  messagesProcessedThisMonth: number;
  aiDraftsProcessedThisMonth: number;
  hasGeminiKey: boolean;
  hasOpenAiKey: boolean;
}

export const getBillingStatus = async (): Promise<BillingStatusResponse> => {
  const { data } = await api.get<BillingStatusResponse>('/billing/status');
  return data;
};

export const saveByok = async (geminiKey?: string, openaiKey?: string): Promise<{ success: boolean }> => {
  const { data } = await api.post<{ success: boolean }>('/billing/byok', {
    geminiKey,
    openaiKey
  });
  return data;
};
