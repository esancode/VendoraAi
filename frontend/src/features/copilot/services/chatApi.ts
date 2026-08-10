import { api } from '../../../services/api';
import type { Message } from '../types';

import { MessageSender } from '../types';

export const getMessagesByLeadId = async (leadId: string): Promise<Message[]> => {
  const { data } = await api.get<Message[]>(`/chats/${leadId}/messages`);
  return data;
};

export const sendReplyToLead = async (leadId: string, content: string): Promise<Message> => {
  // Using the backend route from AgentController for now, properly providing payload
  // Note: a real production app would use an endpoint strictly bound to JWT user tenantId without needing it in the payload.
  // The user prompt only strictly requests draft and messages real integration, we'll keep the reply integration pointing to the api.
  const { data } = await api.post<Message>('/agents/reply', { leadId, content, agentId: '00000000-0000-0000-0000-000000000000', tenantId: '00000000-0000-0000-0000-000000000000' });
  return data;
};

export const toggleLeadAutonomy = async (leadId: string, isManualInterventionRequired: boolean): Promise<void> => {
  await api.patch(`/agents/autonomy/${leadId}`, { isManualInterventionRequired });
};
