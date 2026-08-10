import { api } from './api';

export interface DashboardStats {
  openLeadsCount: number;
  avgSlaMinutes: number;
  breachingSlaCount: number;
  topLossReason: string | null;
}

export interface Lead {
  id: string;
  name: string;
  status: 'OPEN' | 'CLOSED' | 'LOST';
  createdAt: string;
  slaLimitAt: string;
  lastMessage: string;
}

export const getDashboardStats = async (): Promise<DashboardStats> => {
  const { data } = await api.get<DashboardStats>('/dashboard/stats');
  return data;
};

export const getPriorityLeads = async (agentId?: string): Promise<Lead[]> => {
  try {
    const params = agentId ? { agentId } : undefined;
    const { data } = await api.get<Lead[]>('/leads/priority', { params });
    if (data && data.length > 0) return data;
  } catch (error) {
    console.warn('Usando dados mockados para leads pois a API falhou ou está vazia.');
  }

  return [
    {
      id: 'mock-lead-1',
      name: 'Maria Oliveira (Mock)',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      slaLimitAt: new Date(Date.now() + 1000 * 60 * 15).toISOString(),
      lastMessage: 'Gostaria de agendar uma demonstração.'
    },
    {
      id: 'mock-lead-2',
      name: 'Carlos Souza (Mock)',
      status: 'OPEN',
      createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString(), 
      slaLimitAt: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
      lastMessage: 'Qual o valor da implementação?'
    }
  ];
};

export interface TenantTrialStatus {
  status: 'trial_active' | 'active' | 'canceled';
  processedMessages: number;
  onboardingCompleted: boolean;
}

export interface DashboardStatusResponse {
  isChannelConnected: boolean;
  isDataAnalyzed: boolean;
  tenantStatus: TenantTrialStatus;
}

export interface NarrativeInsights {
  managerName: string;
  avgSlaMinutes: number;
  coolingLeads: number;
  topLossReason: string;
  topLossPercentage: number;
  estimatedLossBrl: number;
}

export interface LossObjection {
  category: string;
  percentage: number;
  estimatedLoss: number;
}

export interface SlaBottleneck {
  agentId: string;
  agentName: string;
  avatarUrl?: string;
  avgSlaFormatted: string;
  coolingLeadsCount: number;
  delayLossCount: number;
}

export interface UnmappedDemand {
  term: string;
  count: number;
}

export const getDashboardStatus = async (): Promise<DashboardStatusResponse> => {
  const { data } = await api.get<DashboardStatusResponse>('/dashboard/status');
  return data;
};

export const activateAudit = async (): Promise<{ success: boolean }> => {
  const { data } = await api.post<{ success: boolean }>('/dashboard/trigger-retroactive-audit');
  return data;
};

export const getNarrativeInsights = async (): Promise<NarrativeInsights> => {
  const { data } = await api.get<NarrativeInsights>('/dashboard/narrative');
  return data;
};

export const getLossObjections = async (): Promise<LossObjection[]> => {
  const { data } = await api.get<LossObjection[]>('/dashboard/objections');
  return data;
};

export const getSlaBottlenecks = async (): Promise<SlaBottleneck[]> => {
  const { data } = await api.get<SlaBottleneck[]>('/dashboard/slas');
  return data;
};

export const getUnmappedDemands = async (): Promise<UnmappedDemand[]> => {
  const { data } = await api.get<UnmappedDemand[]>('/dashboard/unmapped-demands');
  return data;
};
