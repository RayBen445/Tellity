export interface CommandContext {
  userText: string;
  lowerText: string;
  chatId: number;
  fromUser: any;
  isSimulated: boolean;
  botUsername: string | null;
  botName: string | null;
  botToken: string | null;
  addLog: (
    direction: 'incoming' | 'outgoing',
    chatId: number,
    sender: any,
    text: string,
    status: string,
    rawJson?: any
  ) => void;
  callTelegramAPI: (method: string, payload: any) => Promise<any>;
  getCommonInlineKeyboard: () => any;
}
