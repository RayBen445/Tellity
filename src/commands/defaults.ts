import { BotCommandConfig } from '../types';

export const EMPTY_COMMAND: BotCommandConfig = {
  command: '',
  description: '',
  responseTemplate: ''
};

export const DEFAULT_SIM_USER = {
  username: 'tele_tester',
  firstName: 'Alex',
  lastName: 'Studio',
  chatId: 98765432
};
