export const MessageSender = {
  USER: 'USER',
  LEAD: 'LEAD',
  SYSTEM: 'SYSTEM',
} as const;

export type MessageSender = (typeof MessageSender)[keyof typeof MessageSender];

export interface Message {
  id: string;
  leadId: string;
  content: string;
  sender: MessageSender;
  createdAt: string;
}

export interface DraftEvent {
  leadId: string;
  draftContent: string;
}

export interface LeadAutonomy {
  leadId: string;
  isManualInterventionRequired: boolean;
}
