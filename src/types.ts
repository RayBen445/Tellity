export interface BotCommandConfig {
  command: string;
  description: string;
  responseTemplate: string;
}

export interface BotConfig {
  botUsername: string | null;
  botName: string | null;
  webhookUrl: string | null;
  isWebhookActive: boolean;
  commands: BotCommandConfig[];
  longPollingActive?: boolean;
  targetChatId?: string | null;
}

export interface MessageLog {
  id: string;
  timestamp: number;
  direction: 'incoming' | 'outgoing';
  chatId: number;
  sender: {
    id: number;
    username?: string;
    firstName?: string;
    lastName?: string;
  };
  text: string;
  status: string;
  rawJson?: any;
}

export interface BotStatusResponse {
  isConnected: boolean;
  config: BotConfig;
  appUrl: string;
}

export interface UserSessionSettings {
  language: string;
  voiceSpeed: number;
  voiceAccent: string;
  autoTranslate: boolean;
  targetLang: string;
}

export interface BotReminder {
  id: string;
  chatId: number;
  fromUser: {
    id: number;
    first_name: string;
    username?: string;
  };
  message: string;
  createdAt: number;
  dueTime: number;
  triggered: boolean;
}
