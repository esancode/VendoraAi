import { api } from '../../../services/api';
import type { Message } from '../types';

import { MessageSender } from '../types';

export const getMessagesByLeadId = async (leadId: string): Promise<Message[]> => {
  try {
    const { data } = await api.get<Message[]>(`/agent/messages/${leadId}`);
    if (data && data.length > 0) return data;
  } catch (error) {
    console.warn('Usando dados mockados de mensagens.');
  }

  // Mock messages based on leadId
  if (leadId === 'mock-lead-1') {
    return [
      { id: 'msg-1', leadId, content: 'Olá! Gostaria de agendar uma demonstração.', sender: MessageSender.LEAD, createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString() },
      { id: 'msg-2', leadId, content: 'Olá Maria! Claro, posso te ajudar com isso. Qual seria o melhor horário para você?', sender: MessageSender.SYSTEM, createdAt: new Date(Date.now() - 1000 * 60 * 44).toISOString() }
    ];
  }
  if (leadId === 'mock-lead-2') {
    return [
      { id: 'msg-3', leadId, content: 'Bom dia, qual o valor da implementação?', sender: MessageSender.LEAD, createdAt: new Date(Date.now() - 1000 * 60 * 65).toISOString() },
      { id: 'msg-4', leadId, content: 'Bom dia Carlos! O valor da implementação varia conforme o plano. Você precisa de integração com ERP?', sender: MessageSender.SYSTEM, createdAt: new Date(Date.now() - 1000 * 60 * 60).toISOString() },
      { id: 'msg-5', leadId, content: 'Sim, usamos o Bling.', sender: MessageSender.LEAD, createdAt: new Date(Date.now() - 1000 * 60 * 20).toISOString() }
    ];
  }

  return [];
};

export const sendReplyToLead = async (leadId: string, content: string): Promise<Message> => {
  try {
    const { data } = await api.post<Message>('/agent/reply', { leadId, content });
    return data;
  } catch (error) {
    console.warn('Simulando envio de mensagem (API falhou).');
    return {
      id: `msg-mock-${Date.now()}`,
      leadId,
      content,
      sender: MessageSender.USER,
      createdAt: new Date().toISOString()
    };
  }
};

export const toggleLeadAutonomy = async (leadId: string, isManualInterventionRequired: boolean): Promise<void> => {
  try {
    await api.patch(`/agent/autonomy/${leadId}`, { isManualInterventionRequired });
  } catch (error) {
    console.warn('Simulando toggle de autonomia (API falhou).');
  }
};
