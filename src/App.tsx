import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Send,
  Terminal,
  Settings,
  ShieldCheck,
  ShieldX,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Play,
  Users,
  Sliders,
  Copy,
  Check,
  Code,
  Sparkles,
  ArrowRightLeft,
  XCircle,
  CheckCircle2,
  Lock,
  MessageSquare,
  AlertTriangle,
  Info,
  Volume2,
  Clock,
  Calendar,
  Image,
  Download,
  Timer,
  Bell,
  Notebook,
  Edit,
  FileText
} from 'lucide-react';
import { BotConfig, BotCommandConfig, MessageLog } from './types';

export default function App() {
  // Primary configuration state
  const [sessionToken, setSessionToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [userIdInput, setUserIdInput] = useState('');
  const [botConfig, setBotConfig] = useState<BotConfig>({
    botUsername: null,
    botName: null,
    webhookUrl: null,
    isWebhookActive: false,
    commands: [],
    targetChatId: null
  });
  const [appUrl, setAppUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<MessageLog[]>([]);
  const [activeTab, setActiveTab] = useState<'console' | 'commands' | 'diagnostics'>('console');

  // Loading and action state
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [activeLogJson, setActiveLogJson] = useState<string | null>(null);

  // Command Editing state
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [tempCommand, setTempCommand] = useState<BotCommandConfig>({
    command: '',
    description: '',
    responseTemplate: ''
  });
  const [showAddCommandForm, setShowAddCommandForm] = useState(false);

  // Simulator Input Form state
  const [simText, setSimText] = useState('/start');
  const [simUser, setSimUser] = useState({
    username: 'tele_tester',
    firstName: 'Alex',
    lastName: 'Studio',
    chatId: 98765432
  });

  // Manual Dispatch state
  const [manualReply, setManualReply] = useState({
    chatId: '',
    text: '',
    sending: false,
    success: false,
    error: null as string | null
  });

  // Premium UI style state: Custom Font pairing
  const [selectedFont, setSelectedFont] = useState<'sans' | 'space' | 'outfit' | 'playfair' | 'mono'>('sans');

  // Notepad states
  const [notepadContent, setNotepadContent] = useState('');
  const [notepadList, setNotepadList] = useState<any[]>([]);
  const [notepadEditId, setNotepadEditId] = useState<number | null>(null);
  const [notepadEditText, setNotepadEditText] = useState('');

  // Reminders & Alarm status state
  const [reminders, setReminders] = useState<any[]>([]);
  const [newReminderText, setNewReminderText] = useState('');
  const [newReminderSeconds, setNewReminderSeconds] = useState('10');
  const [newReminderChatId, setNewReminderChatId] = useState(String(simUser.chatId));

  // Premium Image Card Builder State
  const [cardText, setCardText] = useState('Build elegant applications with modern visual elements and seamless user journeys.');
  const [selectedGradient, setSelectedGradient] = useState<'midnight' | 'sunrise' | 'emerald' | 'amethyst' | 'slate'>('midnight');

  // Backend session settings state
  const [sessionSettings, setSessionSettings] = useState({
    language: 'English',
    voiceSpeed: 1.0,
    voiceAccent: 'en-US',
    autoTranslate: false,
    targetLang: 'English'
  });

  const fetchSessionSettings = async (chatId: number) => {
    try {
      const res = await fetch(`/api/user-settings?chatId=${chatId}`);
      const data = await res.json();
      if (data.success && data.settings) {
        setSessionSettings(data.settings);
      }
    } catch (e) {
      console.error('Failed to load user session settings:', e);
    }
  };

  const updateSessionSettings = async (updates: Partial<typeof sessionSettings>) => {
    const nextSettings = { ...sessionSettings, ...updates };
    setSessionSettings(nextSettings);
    
    try {
      await fetch('/api/user-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: simUser.chatId,
          ...nextSettings
        })
      });
      fetchUpdates();
    } catch (e) {
      console.error('Failed to persist session settings:', e);
    }
  };

  const handleFontChange = (font: typeof selectedFont) => {
    setSelectedFont(font);
    localStorage.setItem('telegram_bot_font', font);
  };

  const fetchReminders = async () => {
    try {
      const res = await fetch('/api/reminders');
      const data = await res.json();
      if (data.success && data.reminders) {
        setReminders(data.reminders);
      }
    } catch (e) {
      console.error('Failed to load reminders:', e);
    }
  };

  const handleAddReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReminderText.trim()) return;
    try {
      const res = await fetch('/api/reminders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: parseInt(newReminderChatId, 10) || simUser.chatId,
          seconds: parseInt(newReminderSeconds, 10) || 10,
          message: newReminderText.trim(),
          fromUser: {
            id: simUser.chatId,
            first_name: simUser.firstName,
            username: simUser.username
          }
        })
      });
      const data = await res.json();
      if (data.success) {
        setReminders(data.reminders);
        setNewReminderText('');
        fetchUpdates();
      }
    } catch (e) {
      console.error('Failed to create reminder:', e);
    }
  };

  const handleDeleteReminder = async (id: string) => {
    try {
      const res = await fetch(`/api/reminders/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setReminders(data.reminders);
      }
    } catch (e) {
      console.error('Failed to delete reminder:', e);
    }
  };

  const fetchNotepad = async (chatId: number) => {
    try {
      const res = await fetch(`/api/notepad?chatId=${chatId}`);
      const data = await res.json();
      if (data.success && data.notes) {
        setNotepadList(data.notes);
      }
    } catch (e) {
      console.error('Failed to load notepad notes:', e);
    }
  };

  const handleAddNotepadNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notepadContent.trim()) return;
    try {
      const res = await fetch('/api/notepad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: simUser.chatId,
          content: notepadContent.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotepadList(data.notes);
        setNotepadContent('');
        fetchUpdates();
      }
    } catch (e) {
      console.error('Failed to add notepad entry:', e);
    }
  };

  const handleSaveEditNotepadNote = async (id: number) => {
    if (!notepadEditText.trim()) return;
    try {
      const res = await fetch('/api/notepad', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: simUser.chatId,
          id,
          content: notepadEditText.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setNotepadList(data.notes);
        setNotepadEditId(null);
        setNotepadEditText('');
        fetchUpdates();
      }
    } catch (e) {
      console.error('Failed to update notepad note:', e);
    }
  };

  const handleDeleteNotepadNote = async (id: number) => {
    try {
      const res = await fetch(`/api/notepad?chatId=${simUser.chatId}&id=${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setNotepadList(data.notes);
        fetchUpdates();
      }
    } catch (e) {
      console.error('Failed to delete notepad note:', e);
    }
  };

  // Load configuration on mount
  useEffect(() => {
    fetchConfig();
    fetchUpdates();
    fetchSessionSettings(simUser.chatId);
    fetchReminders();
    fetchNotepad(simUser.chatId);

    const savedFont = localStorage.getItem('telegram_bot_font');
    if (savedFont) {
      setSelectedFont(savedFont as any);
    }
    
    // Set up rapid polling for new interaction logs (runs every 2 seconds)
    const logInterval = setInterval(() => {
      fetchUpdates();
      fetchReminders();
      fetchNotepad(simUser.chatId);
    }, 2000);

    return () => clearInterval(logInterval);
  }, []);

  // Fetch settings dynamically whenever the tester's simulated chat ID changes
  useEffect(() => {
    if (simUser.chatId) {
      fetchSessionSettings(simUser.chatId);
      setNewReminderChatId(String(simUser.chatId));
    }
  }, [simUser.chatId]);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/config');
      const data = await res.json();
      setIsConnected(data.isConnected);
      if (data.config) {
        setBotConfig(data.config);
        if (data.config.targetChatId) {
          setUserIdInput(data.config.targetChatId);
        }
      }
      if (data.appUrl) {
        setAppUrl(data.appUrl);
      }
    } catch (err) {
      console.error('Failed to retrieve bot config:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchUpdates = async () => {
    try {
      const res = await fetch('/api/updates');
      const data = await res.json();
      if (data.logs) {
        setLogs(prev => {
          // Only update if logs count or content differs to avoid unnecessary redraws
          if (JSON.stringify(prev) !== JSON.stringify(data.logs)) {
            return data.logs;
          }
          return prev;
        });
      }
    } catch (err) {
      console.error('Failed to poll logs stream:', err);
    }
  };

  const handleUpdateConfig = async (tokenSubmit?: string, providedChatId?: string) => {
    setActionLoading(true);
    try {
      const payload: { token?: string; commands?: BotCommandConfig[]; targetChatId?: string } = {
        commands: botConfig.commands,
        targetChatId: providedChatId !== undefined ? providedChatId : userIdInput
      };
      
      if (tokenSubmit !== undefined) {
        payload.token = tokenSubmit;
      }

      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      setIsConnected(data.isConnected);
      setBotConfig({
        botUsername: data.botUsername,
        botName: data.botName,
        webhookUrl: data.webhookUrl,
        isWebhookActive: data.isWebhookActive,
        commands: data.commands,
        longPollingActive: data.longPollingActive,
        targetChatId: data.targetChatId
      });

      if (data.targetChatId) {
        setUserIdInput(data.targetChatId);
      }

      if (tokenSubmit) {
        // Clear token inputs after connection attempts
        setSessionToken('');
      }
    } catch (err) {
      console.error('Error submitting bot update:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Webhook control APIs
  const handleToggleWebhook = async () => {
    setActionLoading(true);
    const endpoint = botConfig.isWebhookActive ? '/api/delete-webhook' : '/api/register-webhook';
    try {
      const res = await fetch(endpoint, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setBotConfig(p => ({
          ...p,
          isWebhookActive: data.isWebhookActive,
          webhookUrl: data.webhookUrl,
          longPollingActive: false // If we register/delete webhook, polling turns off by default
        }));
      } else {
        alert(data.error || 'Failed to modify webhook parameters.');
      }
    } catch (err) {
      console.error('Webhook error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleTogglePolling = async () => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/polling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !botConfig.longPollingActive })
      });
      const data = await res.json();
      if (data.success) {
        setBotConfig(p => ({
          ...p,
          longPollingActive: data.active,
          isWebhookActive: data.isWebhookActive,
          webhookUrl: data.webhookUrl
        }));
      } else {
        alert('Failed to modify polling parameters.');
      }
    } catch (err) {
      console.error('Polling error:', err);
    } finally {
      setActionLoading(false);
    }
  };

  // Add / Edit Commands Handlers
  const handleSaveCommandEdit = async () => {
    if (!tempCommand.command.trim() || !tempCommand.responseTemplate.trim()) {
      return;
    }

    let updatedList = [...botConfig.commands];
    
    // Command validation: prefix with '/' if not already
    let cmdString = tempCommand.command.trim();
    if (!cmdString.startsWith('/')) {
      cmdString = '/' + cmdString;
    }

    const commandObj = {
      command: cmdString,
      description: tempCommand.description || 'Custom command handler',
      responseTemplate: tempCommand.responseTemplate
    };

    if (editingIndex !== null) {
      updatedList[editingIndex] = commandObj;
    } else {
      updatedList.push(commandObj);
    }

    setBotConfig(p => ({ ...p, commands: updatedList }));
    setEditingIndex(null);
    setShowAddCommandForm(false);
    setTempCommand({ command: '', description: '', responseTemplate: '' });

    // Sync edited commands with backend
    setTimeout(async () => {
      // Inline sync
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commands: updatedList })
      });
    }, 100);
  };

  const handleDeleteCommand = async (indexToDelete: number) => {
    const updatedList = botConfig.commands.filter((_, idx) => idx !== indexToDelete);
    setBotConfig(p => ({ ...p, commands: updatedList }));
    
    await fetch('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commands: updatedList })
    });
  };

  // Bot Simulator Submission
  const handleSimulateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simText.trim()) return;

    try {
      const res = await fetch('/api/simulate-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: simText,
          username: simUser.username,
          firstName: simUser.firstName,
          lastName: simUser.lastName,
          chatId: simUser.chatId
        })
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to trigger simulator:', err);
    }
  };

  const handleSimulateDirectly = async (cmdText: string) => {
    if (!cmdText.trim()) return;

    try {
      const res = await fetch('/api/simulate-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: cmdText,
          username: simUser.username,
          firstName: simUser.firstName,
          lastName: simUser.lastName,
          chatId: simUser.chatId
        })
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('Failed to trigger simulator directly:', err);
    }
  };

  // Direct Send Message via Bot API
  const handleManualSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualReply.chatId || !manualReply.text) return;

    setManualReply(prev => ({ ...prev, sending: true, error: null, success: false }));
    try {
      const res = await fetch('/api/send-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chatId: parseInt(manualReply.chatId, 10),
          text: manualReply.text
        })
      });
      const data = await res.json();
      if (data.success) {
        setManualReply(p => ({ ...p, sending: false, success: true, text: '' }));
        fetchUpdates();
        setTimeout(() => {
          setManualReply(p => ({ ...p, success: false }));
        }, 3000);
      } else {
        setManualReply(p => ({ ...p, sending: false, error: data.error || 'Failed to dispatch' }));
      }
    } catch (err: any) {
      setManualReply(p => ({ ...p, sending: false, error: err.message }));
    }
  };

  // Formatting timestamp
  const formatTime = (ts: number): string => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setIsCopying(true);
    setTimeout(() => setIsCopying(false), 2000);
  };

  return (
    <div className={`min-h-screen bg-[#090b0e] text-gray-100 flex flex-col ${selectedFont === 'sans' ? 'font-sans' : selectedFont === 'space' ? 'font-space' : selectedFont === 'outfit' ? 'font-outfit' : selectedFont === 'playfair' ? 'font-playfair' : 'font-mono'} transition-all duration-300`}>
      
      {/* 🚀 ELITE HEADER BAR */}
      <header className="border-b border-[#1b2230] bg-[#0c0f16]/95 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-tr from-violet-600 via-indigo-600 to-cyan-500 rounded-xl shadow-lg shadow-indigo-500/10">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-white via-gray-100 to-indigo-200 bg-clip-text text-transparent tracking-tight">
              Telegram Bot Hub
            </h1>
            <p className="text-xs text-gray-400 font-mono">Real-Time Command Server & Diagnostics</p>
          </div>
        </div>

        {/* Dynamic connection and system meta badges */}
        <div className="flex flex-wrap items-center gap-2.5">
          {isConnected ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-950/45 border border-emerald-800/40 rounded-lg text-xs font-semibold text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>CONNECTED • {botConfig.botUsername || botConfig.botName}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-rose-950/45 border border-rose-800/40 rounded-lg text-xs font-semibold text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>UNLINKED • Check Token</span>
            </div>
          )}

          {botConfig.isWebhookActive ? (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/45 border border-cyan-800/40 rounded-lg text-xs font-semibold text-cyan-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>WEBHOOK LIVE</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-950/45 border border-amber-800/40 rounded-lg text-xs font-semibold text-amber-400">
              <ShieldX className="w-3.5 h-3.5" />
              <span>WEBHOOK DEACTIVATED</span>
            </div>
          )}

          <button 
            onClick={() => { fetchConfig(); fetchUpdates(); }}
            className="p-1.5 rounded-lg bg-gray-800/60 hover:bg-gray-800 border border-gray-700/60 transition text-gray-400 hover:text-white"
            title="Refresh Server Context"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COMPONENT: CONFIGURATION, HANDLERS, SYSTEM SETTINGS (5 COLS) */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          
          {/* BOT IDENTITY & INTEGRATION MANAGER */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Settings className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Bot Credentials</h2>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-gray-800/50 border border-gray-700/50 text-gray-400">SECURE SHELL</span>
            </div>

            <div className="p-5 flex flex-col gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">BOT TOKEN (FROM BOTFATHER)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                      <Lock className="w-3.5 h-3.5" />
                    </span>
                    <input
                      type={showToken ? 'text' : 'password'}
                      value={sessionToken}
                      onChange={(e) => setSessionToken(e.target.value)}
                      placeholder={isConnected ? "•••••••••••••••••••••••••••••••••" : "123456789:ABCdefGhIJKlMnOpQRsTUVwX..."}
                      className="w-full bg-[#090b0e] border border-gray-800 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-10 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white transition"
                    >
                      {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => handleUpdateConfig(sessionToken)}
                    disabled={actionLoading || !sessionToken.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:from-indigo-900 disabled:to-violet-950 disabled:text-gray-500 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-1.5"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Connect'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-500 mt-1.5 flex items-center gap-1">
                  <Info className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                  <span>Connects your bot dynamically. Key remains fully server-side.</span>
                </p>
              </div>

              {/* Live Target Chat ID Configuration */}
              <div className="border-t border-gray-800/55 pt-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">TELEGRAM CHAT ID / USER ID (RECOMMENDED)</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                      <Terminal className="w-3.5 h-3.5 text-indigo-400" />
                    </span>
                    <input
                      type="text"
                      value={userIdInput}
                      onChange={(e) => setUserIdInput(e.target.value)}
                      placeholder={botConfig.targetChatId ? botConfig.targetChatId : "e.g. 173950294"}
                      className="w-full bg-[#090b0e] border border-gray-800 focus:border-indigo-500 rounded-xl py-2 pl-9 pr-3 text-xs font-mono text-white focus:outline-none focus:ring-1 focus:ring-indigo-500/20"
                    />
                  </div>
                  <button
                    onClick={() => handleUpdateConfig(undefined, userIdInput)}
                    disabled={actionLoading || !userIdInput.trim()}
                    className="px-4 py-2 bg-indigo-950/45 border border-indigo-800/40 text-indigo-300 hover:bg-indigo-950/85 disabled:text-gray-500 hover:text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-1.5"
                  >
                    {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save ID'}
                  </button>
                </div>
                <div className="text-[10.5px] text-gray-500 mt-2 flex flex-col gap-1.5 bg-[#090b0e]/40 p-2.5 rounded-xl border border-gray-800/40">
                  <span className="flex items-start gap-1">
                    <Sparkles className="w-3 h-3 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>Every time you connect or click <strong>Save ID</strong>, the bot will automatically try to deliver a real-time <strong>Welcome verification notification</strong>!</span>
                  </span>
                  <span className="text-gray-500 leading-normal border-t border-gray-800/40 pt-1.5">
                    💡 **Don&apos;t know your ID?** Talk to <a href="https://t.me/userinfobot" target="_blank" rel="noreferrer" className="text-indigo-400 underline hover:text-indigo-300">@userinfobot</a> inside Telegram, copy the numeric ID, and paste it here. Make sure to first send at least one message or <span className="font-semibold text-gray-300">/start</span> to your bot so Telegram allows delivery!
                  </span>
                </div>
              </div>

              {/* Connected Metadata Details */}
              {isConnected && (
                <div className="p-3.5 bg-indigo-950/10 border border-indigo-900/30 rounded-xl flex gap-3.5">
                  <div className="p-2 bg-indigo-500/10 border border-indigo-400/20 rounded-lg h-fit">
                    <Bot className="w-5 h-5 text-indigo-400" />
                  </div>
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="font-bold text-gray-200 truncate">{botConfig.botName}</div>
                    <div className="text-indigo-400 font-mono select-all text-[11px] truncate mt-0.5">
                      {botConfig.botUsername}
                    </div>
                    
                    {/* Connection Mode Status Alerts */}
                    <div className="mt-3.5 pt-3 border-t border-gray-800/60 flex flex-col gap-3">
                      
                      {/* Connection Strategy Selector */}
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-mono font-medium uppercase text-indigo-300">Connection Mode Selector</span>
                        <p className="text-[10px] text-gray-400 leading-tight">
                          Select the strategy to fetch incoming messages from Telegram's servers.
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 bg-[#090b0e] p-1 border border-gray-800 rounded-xl">
                        <button
                          type="button"
                          onClick={() => { if (botConfig.longPollingActive) handleTogglePolling(); }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold transition ${
                            !botConfig.longPollingActive
                              ? 'bg-indigo-650/20 text-indigo-300 border border-indigo-805/40 font-bold'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                          }`}
                        >
                          Webhook Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => { if (!botConfig.longPollingActive) handleTogglePolling(); }}
                          className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold transition ${
                            botConfig.longPollingActive
                              ? 'bg-emerald-650/20 text-emerald-300 border border-emerald-805/40 font-bold'
                              : 'text-gray-400 hover:text-white hover:bg-gray-800/40'
                          }`}
                        >
                          Server Polling (Safe)
                        </button>
                      </div>

                      {/* Webhook Configuration Subpanel */}
                      {!botConfig.longPollingActive ? (
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>Webhook Gateway</span>
                            <div className="flex items-center gap-1">
                              <span className={`w-1.5 h-1.5 rounded-full ${botConfig.isWebhookActive ? 'bg-cyan-400 animate-pulse' : 'bg-gray-600'}`} />
                              <span className="font-mono text-[10px]">{botConfig.isWebhookActive ? 'ACTIVE' : 'INACTIVE'}</span>
                            </div>
                          </div>

                          {appUrl ? (
                            <div className="flex items-center gap-1 bg-[#090b0e] border border-gray-800 rounded-lg px-2.5 py-1 text-[10px] font-mono select-all overflow-hidden truncate">
                              <span className="text-gray-500 truncate flex-1">{appUrl}/api/telegram-webhook</span>
                              <button
                                onClick={() => {
                                  const path = `${appUrl}/api/telegram-webhook`;
                                  copyToClipboard(path);
                                }}
                                className="text-gray-400 hover:text-white ml-1 p-0.5 hover:bg-gray-800 rounded transition"
                              >
                                {isCopying ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <span className="text-gray-500 text-[10px] italic">App URL unconfigured on server boot</span>
                          )}

                          <button
                            onClick={handleToggleWebhook}
                            disabled={actionLoading}
                            className={`w-full py-1.5 rounded-lg text-[11px] font-semibold transition flex items-center justify-center gap-1 border ${
                              botConfig.isWebhookActive
                                ? 'bg-rose-950/20 border-rose-800/40 hover:bg-rose-950/40 text-rose-300'
                                : 'bg-indigo-950/25 border-indigo-800/40 hover:bg-indigo-950/50 text-indigo-300'
                            }`}
                          >
                            {actionLoading ? <RefreshCw className="w-3 h-3 animate-spin animate-duration-1000" /> : null}
                            {botConfig.isWebhookActive ? 'Deregister Webhook' : 'Register Webhook'}
                          </button>
                          
                          <p className="text-[10px] text-gray-500 text-center leading-normal">
                            ⚠️ In restricted preview sandbox accounts, choose <span className="font-semibold text-gray-400">Server Polling</span> if messages do not deliver.
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 mt-1">
                          <div className="flex items-center justify-between text-[11px] text-gray-400">
                            <span>Polling Outbound status</span>
                            <div className="flex items-center gap-1 bg-emerald-900/20 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-mono text-[9px] text-emerald-400 font-bold">POLLING MAINLINE</span>
                            </div>
                          </div>
                          
                          <div className="bg-[#10161d] border border-emerald-950/40 p-2.5 rounded-lg text-[10.5px] text-emerald-300/90 leading-normal flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span>
                              <strong>Polling mode is active!</strong> Direct outbound requests are bypassing sandbox firewall restrictions completely. Send messages to your bot on Telegram now!
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* PREMIUM CONFIGURATION PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Volume2 className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-250">Premium Settings & Configuration</h2>
              </div>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-950/30 border border-cyan-800/30 text-cyan-400 font-semibold text-xs tracking-wider">Active Sync</span>
            </div>

            <div className="p-5 flex flex-col gap-5">
              {/* FONTS FACES SECTION */}
              <div>
                <label className="block text-xs font-semibold text-gray-400 mb-2">INTERFACE TYPOGRAPHY CUSTOMIZER</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'sans', name: 'Inter', desc: 'Swiss Modern' },
                    { id: 'space', name: 'Space G', desc: 'Cyber Tech' },
                    { id: 'outfit', name: 'Outfit', desc: 'Polished' },
                    { id: 'playfair', name: 'Playfair', desc: 'Elegant Serif' },
                    { id: 'mono', name: 'JB Mono', desc: 'Terminal' }
                  ].map((fontObj) => (
                    <button
                      key={fontObj.id}
                      onClick={() => handleFontChange(fontObj.id as any)}
                      className={`py-2 px-2.5 rounded-xl border text-left transition ${
                        selectedFont === fontObj.id
                          ? 'bg-cyan-500/10 border-cyan-500/80 text-cyan-300'
                          : 'bg-[#090b0e] border-gray-800 text-gray-400 hover:text-white hover:border-gray-700'
                      }`}
                    >
                      <div className="text-xs font-bold leading-tight">{fontObj.name}</div>
                      <div className="text-[9px] text-gray-500 font-mono mt-0.5">{fontObj.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* VOICE MULTIPLIERS */}
              <div className="border-t border-gray-800/55 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-400">VOICE SYNTHESIS SPEED (TTS)</label>
                  <span className="text-[10px] font-mono text-cyan-400 font-bold bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-900/30">
                    {sessionSettings.voiceSpeed === 1.0 ? 'Normal speed' : `${sessionSettings.voiceSpeed}x speed`}
                  </span>
                </div>
                <div className="grid grid-cols-5 gap-1.5 bg-[#090b0e] p-1 border border-gray-800 rounded-xl">
                  {[0.65, 0.85, 1.0, 1.2, 1.45].map((speed) => (
                    <button
                      key={speed}
                      onClick={() => updateSessionSettings({ voiceSpeed: speed })}
                      className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                        sessionSettings.voiceSpeed === speed
                          ? 'bg-cyan-500/15 text-cyan-300 font-bold border border-cyan-500/30'
                          : 'text-gray-400 hover:text-white hover:bg-gray-850/45'
                      }`}
                    >
                      {speed}x
                    </button>
                  ))}
                </div>
              </div>

              {/* VOCAL ACCENT SELECTION */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-800/55 pt-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">VOCAL ACCENT STYLE</label>
                  <select
                    value={sessionSettings.voiceAccent}
                    onChange={(e) => updateSessionSettings({ voiceAccent: e.target.value })}
                    className="w-full bg-[#090b0e] border border-gray-800 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                  >
                    <option value="en-US">American Accent (en-US)</option>
                    <option value="en-GB">British Vocal Premium (en-GB)</option>
                    <option value="en-AU">Australian Aesthetic (en-AU)</option>
                    <option value="fr-FR">Parisian French (fr-FR)</option>
                    <option value="es-ES">Castilian Spanish (es-ES)</option>
                    <option value="ja-JP">Japanese Vocal (ja-JP)</option>
                    <option value="yo">Yoruba Dialect (yo)</option>
                    <option value="sw">Swahili Standard (sw)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-400 mb-1.5">RESPONSE DIALECT / LANG</label>
                  <select
                    value={sessionSettings.language}
                    onChange={(e) => updateSessionSettings({ language: e.target.value })}
                    className="w-full bg-[#090b0e] border border-gray-800 focus:border-cyan-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                  >
                    <option value="English">English (en-US)</option>
                    <option value="Spanish">Spanish (es-ES)</option>
                    <option value="French">French (fr-FR)</option>
                    <option value="German">German (de-DE)</option>
                    <option value="Italian">Italian (it-IT)</option>
                    <option value="Japanese">Japanese (ja-JP)</option>
                    <option value="Yoruba">Yoruba (yo)</option>
                    <option value="Hausa">Hausa (ha)</option>
                    <option value="Igbo">Igbo (ig)</option>
                    <option value="Swahili">Swahili (sw)</option>
                  </select>
                </div>
              </div>

              {/* TRANSLATION SECTION */}
              <div className="border-t border-gray-800/55 pt-4 bg-gradient-to-r from-[#0d141d]/10 to-[#122430]/10 p-3 rounded-xl border border-[#212f3f]/10">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-cyan-400" />
                    <span className="text-xs font-semibold text-gray-300">Auto-Translate Conversations</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={sessionSettings.autoTranslate}
                      onChange={(e) => updateSessionSettings({ autoTranslate: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-gray-850 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-gray-400 after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-cyan-500 peer-checked:after:bg-white" />
                  </label>
                </div>
                
                <p className="text-[10px] text-gray-500 leading-normal mb-3">
                  When active, non-command messages from simulated users will be translated in real-time before replying.
                </p>

                {sessionSettings.autoTranslate && (
                  <div>
                    <label className="block text-[10px] font-mono text-cyan-400 uppercase mb-1">Target Language For Real-Time Translate</label>
                    <select
                      value={sessionSettings.targetLang}
                      onChange={(e) => updateSessionSettings({ targetLang: e.target.value })}
                      className="w-full bg-[#090b0e] border border-gray-800 focus:border-cyan-500 rounded-lg py-1.5 px-2.5 text-xs text-white focus:outline-none"
                    >
                      <option value="English">English</option>
                      <option value="Spanish">Spanish</option>
                      <option value="French">French</option>
                      <option value="German">German</option>
                      <option value="Italian">Italian</option>
                      <option value="Japanese">Japanese</option>
                      <option value="Yoruba">Yoruba</option>
                      <option value="Hausa">Hausa</option>
                      <option value="Igbo">Igbo</option>
                      <option value="Swahili">Swahili</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* DYNAMIC COMMAND COMMANDS CONTROLLER */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40 flex-1 flex flex-col min-h-[380px]">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Sliders className="w-4 h-4 text-violet-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Custom Trigger Triggers</h2>
              </div>
              <button
                onClick={() => {
                  setEditingIndex(null);
                  setTempCommand({ command: '', description: '', responseTemplate: '' });
                  setShowAddCommandForm(true);
                }}
                className="px-2.5 py-1.5 hover:bg-violet-950/40 hover:border-violet-700 bg-violet-650/10 border border-violet-850/50 rounded-xl text-[11px] font-semibold text-violet-300 transition flex items-center gap-1"
              >
                <Plus className="w-3 h-3" />
                <span>Add Command</span>
              </button>
            </div>

            {/* Editing and creating layouts */}
            <div className="p-5 flex-1 flex flex-col">
              {showAddCommandForm || editingIndex !== null ? (
                <div className="bg-[#121620] border border-[#212a3d] p-4 rounded-xl flex flex-col gap-3.5 mb-4">
                  <div className="flex items-center justify-between border-b border-[#212a3d] pb-2">
                    <span className="text-xs font-bold text-violet-300 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5" />
                      {editingIndex !== null ? 'Modify Command' : 'Develop Custom Command'}
                    </span>
                    <button
                      onClick={() => {
                        setEditingIndex(null);
                        setShowAddCommandForm(false);
                      }}
                      className="text-gray-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-gray-800 transition"
                    >
                      Cancel
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Command Trigger</label>
                      <input
                        type="text"
                        value={tempCommand.command}
                        onChange={(e) => setTempCommand({ ...tempCommand, command: e.target.value })}
                        placeholder="/hello"
                        className="w-full bg-[#090b0e] border border-gray-800 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1">Description (Help Text)</label>
                      <input
                        type="text"
                        value={tempCommand.description}
                        onChange={(e) => setTempCommand({ ...tempCommand, description: e.target.value })}
                        placeholder="Say hello helper"
                        className="w-full bg-[#090b0e] border border-gray-800 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs text-white focus:outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-mono text-gray-400 uppercase">Markdown Response Template</label>
                      <span className="text-[9px] text-[#8e99b0] italic">Variable tags supported</span>
                    </div>
                    <textarea
                      value={tempCommand.responseTemplate}
                      onChange={(e) => setTempCommand({ ...tempCommand, responseTemplate: e.target.value })}
                      placeholder="Hi {first_name}! Welcome to my testing channel!"
                      rows={4}
                      className="w-full bg-[#090b0e] border border-gray-800 focus:border-violet-500 rounded-lg py-1.5 px-3 text-xs font-mono text-white focus:outline-none resize-none"
                    />
                    
                    {/* Tag Helper Quick Clicks */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['{first_name}', '{last_name}', '{username}', '{chat_id}', '{time}'].map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => {
                            setTempCommand(prev => ({
                              ...prev,
                              responseTemplate: prev.responseTemplate + tag
                            }));
                          }}
                          className="px-2 py-0.5 bg-[#090b0e] border border-gray-800 text-[10px] font-mono text-violet-300 hover:border-violet-600 rounded transition"
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSaveCommandEdit}
                    disabled={!tempCommand.command.trim() || !tempCommand.responseTemplate.trim()}
                    className="w-full py-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:from-violet-950 text-white rounded-xl text-xs font-bold shadow-md transition"
                  >
                    {editingIndex !== null ? 'Save Changes' : 'Install Trigger'}
                  </button>
                </div>
              ) : null}

              {/* Roster of Commands */}
              <div className="flex-1 overflow-y-auto max-h-[300px] flex flex-col gap-2">
                {botConfig.commands.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center p-6 text-center border-2 border-dashed border-gray-800 rounded-xl bg-gray-900/10">
                    <Code className="w-8 h-8 text-gray-600 mb-2" />
                    <p className="text-xs text-gray-400 font-medium">No commands configured yet</p>
                    <p className="text-[10px] text-gray-500 mt-1">Configure `/start` or trigger messages to run</p>
                  </div>
                ) : (
                  botConfig.commands.map((cmd, index) => (
                    <div
                      key={cmd.command}
                      className={`group border ${editingIndex === index ? 'border-violet-500 bg-[#121620]/80' : 'border-[#1b2230] hover:border-gray-700 bg-gray-950/30'} p-3 rounded-xl transition flex flex-col gap-1.5`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-white bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded font-mono">
                            {cmd.command}
                          </span>
                          <span className="text-[10px] text-gray-400 max-w-[150px] truncate">
                            — {cmd.description}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                          <button
                            onClick={() => {
                              setEditingIndex(index);
                              setTempCommand({ ...cmd });
                              setShowAddCommandForm(false);
                            }}
                            className="p-1 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition"
                            title="Edit"
                          >
                            <Settings className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteCommand(index)}
                            className="p-1 text-gray-500 hover:text-rose-400 hover:bg-rose-950/20 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-[11px] text-gray-400 line-clamp-2 bg-[#090b0e]/30 p-2 rounded border border-gray-900 font-mono whitespace-pre-wrap select-text">
                        {cmd.responseTemplate}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </section>

        {/* RIGHT COMPONENT: SANDBOX WORKSPACE AND LIVE COMMUNICATIONS TERMINAL (7 COLS) */}
        <section className="lg:col-span-7 flex flex-col gap-6">
          
          {/* BOT DEPLOYMENT SIMULATOR PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Play className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Interactive Sandbox Simulator</h2>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                <span className="text-[10px] font-mono text-cyan-400">Offline-Safe Testing Terminal</span>
              </div>
            </div>

            <form onSubmit={handleSimulateUpdate} className="p-5 flex flex-col gap-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#11151f] p-3 rounded-xl border border-[#1b2230]">
                <div>
                  <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Test Chat ID</label>
                  <input
                    type="number"
                    value={simUser.chatId}
                    onChange={(e) => setSimUser({ ...simUser, chatId: parseInt(e.target.value, 10) || 0 })}
                    className="w-full bg-[#090b0e] border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Username</label>
                  <input
                    type="text"
                    value={simUser.username}
                    onChange={(e) => setSimUser({ ...simUser, username: e.target.value })}
                    className="w-full bg-[#090b0e] border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">First Name</label>
                  <input
                    type="text"
                    value={simUser.firstName}
                    onChange={(e) => setSimUser({ ...simUser, firstName: e.target.value })}
                    className="w-full bg-[#090b0e] border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Last Name</label>
                  <input
                    type="text"
                    value={simUser.lastName}
                    onChange={(e) => setSimUser({ ...simUser, lastName: e.target.value })}
                    className="w-full bg-[#090b0e] border border-gray-800 rounded px-2 py-1 text-xs font-mono text-gray-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5 flex items-center justify-between">
                  <span>SEND TRIGGER OR MESSAGE UPDATE</span>
                  <span className="text-[10px] text-gray-500">Includes simulate payload routing</span>
                </label>
                
                <div className="flex gap-2.5">
                  <input
                    type="text"
                    value={simText}
                    onChange={(e) => setSimText(e.target.value)}
                    placeholder="Type a command (e.g. /start) or chat text to run webhooks locally..."
                    className="flex-1 bg-[#090b0e] border border-gray-800 focus:border-cyan-500 rounded-xl py-2 px-3.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-cyan-500/10"
                  />
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-cyan-950/30"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Run Trigger</span>
                  </button>
                </div>

                {/* Interactive Command Selection Box */}
                <div className="mt-4 p-4 border border-[#1b2230] rounded-xl bg-[#090d16]/60 backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3 border-b border-[#1b2230]/40 pb-2">
                    <span className="text-[11px] font-bold text-gray-300 tracking-wider flex items-center gap-1.5 uppercase font-mono">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                      Interactive Command Box (Click to run)
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1 bg-[#111624] px-2 py-0.5 rounded border border-gray-800">
                      Supports typing <code className="text-cyan-300 font-mono text-[9px] bg-black/60 px-1 py-0.5 rounded">/id</code> & button selectors
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { cmd: '/start', title: '🚀 /start', desc: 'Greeting' },
                      { cmd: '/help', title: 'ℹ️ /help', desc: 'Purpose & list' },
                      { cmd: '/settings French', title: '⚙️ /settings', desc: 'Response language' },
                      { cmd: '/settings speed 1.35', title: '⚙️ /settings speed', desc: 'Configure voice speed' },
                      { cmd: '/echo Hello World', title: '🗣️ /echo', desc: 'Voice translation' },
                      { cmd: '/status', title: '🟢 /status', desc: 'Server health' },
                      { cmd: '/ping', title: '⚡ /ping', desc: 'Speed check' },
                      { cmd: '/id', title: '🆔 /id', desc: 'Your identity' },
                      { cmd: `/id ${simUser.username}`, title: '🔍 /id other', desc: 'Target lookup' },
                      { cmd: '/reminder 10 seconds task checkpoint', title: '⏳ /reminder', desc: 'Automation timer' },
                      { cmd: '/image Elegance & Negative Space', title: '🎨 /image', desc: 'Premium vector card' },
                      { cmd: '/poll 20 What flavor?|Vanilla|Strawberry|Choc', title: '📊 /poll', desc: 'Interactive opinion poll' },
                      { cmd: '/translate Spanish Beautiful design workspace', title: '🔄 /translate', desc: 'Translate text' },
                      { cmd: '/calculate (1200 * 1.15) - 350', title: '🧮 /calculate', desc: 'Math evaluator' },
                      { cmd: '/weather Lagos', title: '🌤️ /weather', desc: 'Live atmospheric stats' },
                      { cmd: '/broadcast Sandbox maintenance check completed 🟢', title: '📢 /broadcast', desc: 'Broadcast alert to all sessions' }
                    ].map((item) => (
                      <button
                        key={item.cmd}
                        type="button"
                        onClick={() => {
                          setSimText(item.cmd);
                          handleSimulateDirectly(item.cmd);
                        }}
                        className={`group relative flex flex-col text-left p-2.5 rounded-xl border transition duration-200 overflow-hidden shadow-md ${
                          simText === item.cmd
                            ? 'bg-gradient-to-br from-cyan-950/40 to-blue-950/40 border-cyan-500/80 shadow-cyan-950/40 text-cyan-200'
                            : 'border-gray-800/80 bg-gradient-to-br from-[#0c101a] to-[#121624] hover:from-[#131b31] hover:to-[#1a2542] hover:border-cyan-500/50'
                        }`}
                      >
                        {/* Glow effect on hover */}
                        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/0 via-cyan-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        
                        <div className="flex items-center justify-between w-full mb-1 z-10">
                          <span className={`text-xs font-semibold font-mono transition duration-155 ${
                            simText === item.cmd ? 'text-cyan-300' : 'text-white group-hover:text-cyan-300'
                          }`}>
                            {item.title}
                          </span>
                          <span className={`text-[8.5px] font-bold px-1.5 py-0.2 rounded font-mono transition duration-155 ${
                            simText === item.cmd ? 'bg-cyan-500/20 text-cyan-300' : 'bg-[#1a2336] text-cyan-400 group-hover:bg-cyan-950/80'
                          }`}>
                            RUN
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-400 truncate w-full z-10 font-sans group-hover:text-gray-300 transition">
                          {item.desc}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* ACTIVE LOGSTREAM CONSOLE PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40 flex-1 flex flex-col min-h-[400px]">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Terminal Log stream</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                </span>
                <span className="text-[10px] font-mono text-emerald-400">LOGGING STREAM ACTIVE</span>
              </div>
            </div>

            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Dynamic scroll frame for conversation audits */}
              <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {logs.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6 bg-gray-900/5 rounded-xl border border-dashed border-gray-800/40">
                    <ArrowRightLeft className="w-8 h-8 text-gray-700 mb-2 animate-pulse" />
                    <p className="text-xs text-gray-400 font-medium">Monitoring Link Activity</p>
                    <p className="text-[10px] text-gray-500 mt-1">Simulate updates or send Telegram commands to capture traces</p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const isIncoming = log.direction === 'incoming';
                    const hasSelected = activeLogJson === log.id;
                    return (
                      <div
                        key={log.id}
                        className={`border rounded-xl transition ${
                          isIncoming
                            ? 'bg-blue-950/10 border-blue-900/20 hover:border-blue-800/40'
                            : 'bg-emerald-950/10 border-emerald-900/20 hover:border-emerald-800/40'
                        }`}
                      >
                        <div className="p-3.5 flex flex-col sm:flex-row gap-3 sm:items-start justify-between">
                          <div className="flex items-start gap-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono ${
                              isIncoming
                                ? 'bg-blue-950/80 border border-blue-800/30 text-blue-400'
                                : 'bg-emerald-950/80 border border-emerald-800/30 text-emerald-400'
                            }`}>
                              {isIncoming ? 'IN' : 'OUT'}
                            </span>
                            
                            <div className="flex-1 min-w-0 text-xs">
                              <div className="flex flex-wrap items-center gap-1.5 text-gray-300">
                                <span className="font-bold text-gray-100">
                                  {isIncoming
                                    ? (log.sender.firstName || log.sender.username || `User ${log.chatId}`)
                                    : (botConfig.botName || 'Custom Bot')}
                                </span>
                                {log.sender.username && (
                                  <span className="text-gray-500 font-mono text-[10px] font-medium select-all">
                                    @{log.sender.username}
                                  </span>
                                )}
                                <span className="text-gray-600">•</span>
                                <span className="text-[10px] text-gray-500 font-mono">
                                  ID: {log.chatId}
                                </span>
                              </div>

                              <div className="mt-1.5 text-xs text-white whitespace-pre-wrap select-text font-medium leading-relaxed font-sans">
                                {log.text}
                              </div>

                              {(() => {
                                const voiceMatch = log.text.match(/🎙️ \[(?:Voice echo|Voice echo translated to [a-zA-Z\s]+): "([\s\S]*?)"\]/);
                                if (voiceMatch) {
                                  const textToSpeak = voiceMatch[1];
                                  const langAccent = sessionSettings.voiceAccent || 'en';
                                  const speakSpeed = sessionSettings.voiceSpeed || 1.0;
                                  const ttsUrl = `/api/tts?text=${encodeURIComponent(textToSpeak)}&lang=${encodeURIComponent(langAccent)}&speed=${speakSpeed}`;
                                  return (
                                    <div className="mt-2.5 p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 max-w-sm" id={`voice-${log.id}`}>
                                      <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-lg animate-pulse shadow-indigo-500/10 flex-shrink-0">
                                          <Volume2 className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                          <div className="text-[9px] font-bold text-indigo-300 font-mono uppercase tracking-wider">Play Voice Echo</div>
                                          <div className="text-[11px] text-gray-300 truncate max-w-[180px] mt-0.5 font-medium">&ldquo;{textToSpeak}&rdquo;</div>
                                        </div>
                                      </div>
                                      
                                      <audio
                                        controls
                                        src={ttsUrl}
                                        className="h-7 max-w-[130px] rounded focus:outline-none opacity-85 hover:opacity-100 transition"
                                        style={{ filter: 'invert(1) hue-rotate(180deg)' }}
                                      />
                                    </div>
                                  );
                                }

                                const cardMatch = log.text.match(/🎨 \[Card generated: "([\s\S]*?)"\]/);
                                if (cardMatch) {
                                  const cardContent = cardMatch[1];
                                  const encodedText = encodeURIComponent(cardContent);
                                  const viewTheme = selectedGradient || 'midnight';
                                  const renderUrl = `/api/render-card?text=${encodedText}&theme=${viewTheme}`;
                                  return (
                                    <div className="mt-3 p-4 bg-indigo-950/20 border border-[#1b2230] rounded-2xl flex flex-col gap-3.5 max-w-md">
                                      <div className="flex items-center justify-between border-b border-[#1b2230] pb-2">
                                        <div className="flex items-center gap-1.5 text-cyan-400">
                                          <Sparkles className="w-3.5 h-3.5" />
                                          <span className="text-[10px] font-bold font-mono tracking-wider uppercase">Simulated Text Card Preview</span>
                                        </div>
                                        <a
                                          href={renderUrl}
                                          download="premium_card.png"
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-[9px] hover:underline font-mono text-gray-400 flex items-center gap-1"
                                        >
                                          <Download className="w-3 h-3" />
                                          <span>Download PNG</span>
                                        </a>
                                      </div>
                                      
                                      <div className="border border-slate-800 rounded-xl overflow-hidden shadow-lg shadow-black/50 bg-black/40">
                                        <img
                                          src={renderUrl}
                                          alt="Visual Text Card"
                                          className="w-full h-auto block"
                                          referrerPolicy="no-referrer"
                                        />
                                      </div>
                                    </div>
                                  );
                                }
                                return null;
                              })()}

                              <div className="mt-2 text-[10px] text-gray-400 font-mono flex items-center gap-1 bg-[#090b0e]/30 px-2 py-1 rounded w-fit italic">
                                <span>Status:</span>
                                <span className={isIncoming ? 'text-blue-300' : 'text-emerald-300'}>{log.status}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 self-end sm:self-start">
                            <span className="text-[10px] text-gray-500 font-mono whitespace-nowrap">
                              {formatTime(log.timestamp)}
                            </span>
                            {isIncoming && (
                              <button
                                onClick={() => {
                                  setManualReply(p => ({ ...p, chatId: log.chatId.toString() }));
                                }}
                                className="p-1 px-2 border border-indigo-900/60 hover:bg-indigo-950/30 text-[10px] font-semibold text-indigo-300 rounded transition"
                                title="Reply directly via Bot"
                              >
                                Reply
                              </button>
                            )}
                            {log.rawJson && (
                              <button
                                onClick={() => setActiveLogJson(hasSelected ? null : log.id)}
                                className={`p-1.5 border rounded-lg transition ${
                                  hasSelected
                                    ? 'bg-gray-800 border-gray-700 text-white'
                                    : 'border-gray-800 text-gray-500 hover:text-white hover:bg-gray-800'
                                }`}
                                title="Inspect Trace JSON"
                              >
                                <Code className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Expandable Trace Frame */}
                        {hasSelected && log.rawJson && (
                          <div className="border-t border-gray-800/80 bg-[#06080b] p-3 text-[10px] font-mono text-gray-400 overflow-x-auto select-all rounded-b-xl border-indigo-950">
                            <span className="text-[9px] uppercase font-bold text-gray-500 block mb-2">Telegram JSON Payload Response:</span>
                            <pre>{JSON.stringify(log.rawJson, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>

              {/* MANUAL REPLY DRAWER (Fires directly to chat ID) */}
              {manualReply.chatId && (
                <div className="border-t border-[#1b2230] bg-[#10141f] p-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono text-indigo-300 uppercase font-semibold flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Dispatching Direct Message to Telegram Client Chat ID: {manualReply.chatId}
                    </span>
                    <button
                      onClick={() => setManualReply(p => ({ ...p, chatId: '', text: '' }))}
                      className="p-1 text-gray-400 hover:text-white hover:bg-gray-850 rounded"
                    >
                      <XCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <form onSubmit={handleManualSend} className="flex gap-2.5">
                    <input
                      type="text"
                      value={manualReply.text}
                      onChange={(e) => setManualReply({ ...manualReply, text: e.target.value })}
                      placeholder="Type a real-time message to deliver on Telegram..."
                      className="flex-1 bg-[#090b0e] border border-gray-800 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={manualReply.sending || !manualReply.text.trim()}
                      className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white rounded-xl text-xs font-bold transition flex items-center gap-1"
                    >
                      {manualReply.sending ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>Dispatch</span>
                    </button>
                  </form>
                  
                  {manualReply.success && (
                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>Message successfully dispatched onto Telegram network. See log stream.</span>
                    </div>
                  )}
                  {manualReply.error && (
                    <div className="flex items-center gap-1.5 text-[10px] text-rose-400 font-medium bg-rose-950/20 p-2 border border-rose-900/30 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      <span>Delivery Failed: {manualReply.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* REMINDERS AND ALARMS HUB PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Bell className="w-4 h-4 text-purple-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Background Reminders & Alarms</h2>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-purple-400">
                <Timer className="w-3.5 h-3.5 animate-pulse" />
                <span>Active Ticker Sync</span>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <form onSubmit={handleAddReminder} className="flex flex-col gap-3 p-4 bg-[#11151f] rounded-xl border border-[#1b2230]">
                <div className="text-xs font-bold text-gray-300 mb-1 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-purple-400" />
                  <span>Schedule Dynamic Countdown Alarm</span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Trigger Delay (seconds)</label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={newReminderSeconds}
                      onChange={(e) => setNewReminderSeconds(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full bg-[#090b0e] border border-gray-800 rounded px-3 py-1.5 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Target Chat ID</label>
                    <input
                      type="number"
                      required
                      value={newReminderChatId}
                      onChange={(e) => setNewReminderChatId(e.target.value)}
                      placeholder="e.g. 98765432"
                      className="w-full bg-[#090b0e] border border-gray-800 rounded px-3 py-1.5 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-purple-500 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-gray-400 uppercase mb-1">Reminder Alert Message</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        required
                        value={newReminderText}
                        onChange={(e) => setNewReminderText(e.target.value)}
                        placeholder="e.g. Refresh the workspace"
                        className="flex-1 bg-[#090b0e] border border-gray-800 rounded px-3 py-1.5 text-xs text-white placeholder-gray-650 focus:outline-none focus:border-purple-500"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded font-semibold text-xs transition duration-200"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </div>
              </form>

              {/* Reminders list structure */}
              <div className="flex flex-col gap-2.5">
                <div className="text-xs font-semibold text-gray-400">Roster of Active Reminders Register</div>
                
                {reminders.length === 0 ? (
                  <div className="text-center py-7 border border-dashed border-[#1b2230] rounded-xl bg-[#0a0d14]/40 text-xs text-gray-500 flex flex-col items-center gap-1.5">
                    <Clock className="w-6 h-6 text-gray-700 stroke-[1.5]" />
                    <span>No reminders queued inside this session dashboard</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
                    {reminders.map((rem) => {
                      const remainSec = Math.max(0, Math.round((rem.dueTime - Date.now()) / 1000));
                      return (
                        <div
                          key={rem.id}
                          className={`p-3 rounded-xl border flex items-center justify-between gap-3 text-xs transition duration-150 ${
                            rem.triggered
                              ? 'bg-purple-950/5 border-purple-900/10 text-gray-500'
                              : 'bg-indigo-950/10 border-[#1b2230] text-gray-200'
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${rem.triggered ? 'bg-gray-600' : 'bg-purple-400 animate-pulse'}`} />
                            <div className="min-w-0">
                              <p className="font-semibold text-xs break-all leading-normal">
                                {rem.message}
                              </p>
                              <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1 text-[10px] text-gray-500 font-mono">
                                <span>Chat: <strong className="text-gray-400">{rem.chatId}</strong></span>
                                <span>•</span>
                                <span>Created: {new Date(rem.createdAt).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-3 flex-shrink-0">
                            {rem.triggered ? (
                              <span className="text-[10px] font-bold text-gray-600 bg-gray-900 px-2 py-0.5 rounded font-mono uppercase tracking-wider">FIRED</span>
                            ) : (
                              <span className="text-[10px] font-bold text-purple-400 bg-purple-950/40 px-2 py-0.5 rounded border border-purple-800/20 font-mono">
                                {remainSec}s LEFT
                              </span>
                            )}
                            
                            <button
                              onClick={() => handleDeleteReminder(rem.id)}
                              className="text-gray-500 hover:text-rose-400 p-1 rounded-lg transition"
                              title="Delete Reminder"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* HIGH-CONTRAST CARD EXPORTER PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Image className="w-4 h-4 text-emerald-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Text to Card Image Exporter</h2>
              </div>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block animate-pulse" />
                <span className="text-[10px] font-mono text-emerald-400">Premium Output Engine</span>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1.5">Card Text Content</label>
                    <textarea
                      rows={3}
                      value={cardText}
                      onChange={(e) => setCardText(e.target.value)}
                      placeholder="Compose anything to export as a gorgeous graphical typography card..."
                      className="w-full bg-[#090b0e] border border-gray-800 focus:border-emerald-500 rounded-xl p-3 text-xs text-white focus:outline-none transition leading-relaxed placeholder-gray-600"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-mono text-gray-400 uppercase mb-1.5">Premium Color Gradient</label>
                    <div className="flex flex-wrap gap-2">
                       {[
                        { id: 'midnight', name: 'Midnight Blue', class: 'from-slate-900 via-indigo-955 to-purple-900 text-cyan-400' },
                        { id: 'sunrise', name: 'Sunrise Red', class: 'from-orange-950 via-red-955 to-rose-900 text-orange-400' },
                        { id: 'emerald', name: 'Emerald Forest', class: 'from-emerald-950 via-teal-955 to-cyan-900 text-teal-400' },
                        { id: 'amethyst', name: 'Amethyst Velvet', class: 'from-purple-955 via-violet-955 to-fuchsia-900 text-pink-400' },
                        { id: 'slate', name: 'Carbon Slate', class: 'from-neutral-900 via-zinc-850 to-stone-800 text-stone-300' }
                      ].map((grad) => (
                        <button
                          key={grad.id}
                          onClick={() => setSelectedGradient(grad.id as any)}
                          className={`px-3 py-1.5 rounded-full text-[10px] font-medium border transition flex items-center gap-1.5 ${
                            selectedGradient === grad.id
                              ? 'bg-emerald-950/30 border-emerald-400 text-emerald-300'
                              : 'bg-[#11151f] border-gray-800 hover:border-gray-700 text-gray-400'
                          }`}
                        >
                          <span className={`w-2 h-2 rounded-full bg-gradient-to-tr ${grad.class}`} />
                          {grad.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  <a
                    href={`/api/render-card?text=${encodeURIComponent(cardText)}&theme=${selectedGradient}`}
                    download="visual_card.png"
                    target="_blank"
                    rel="noreferrer"
                    className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-950/20"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Generate Premium PNG Card File</span>
                  </a>
                </div>

                {/* VISUAL LAYOUT CARD PREVIEW CONTAINER */}
                <div className="flex flex-col gap-2">
                  <div className="text-[10px] font-mono text-gray-450 uppercase tracking-widest flex items-center justify-between">
                    <span>Instantly Updated Design Canvas</span>
                    <span className="text-[9px] text-emerald-400 font-bold">HQ Raster</span>
                  </div>
                  
                  {/* Custom interactive replica of the SVG for gorgeous real-time user preview representation */}
                  <div className={`overflow-hidden border border-[#2d3748]/30 rounded-2xl relative aspect-[3/2] flex flex-col p-6 text-white justify-between select-none shadow-xl shadow-black/40 bg-gradient-to-br ${
                    selectedGradient === 'midnight' ? 'from-[#0f172a] via-[#1e1b4b] to-[#581c87]' :
                    selectedGradient === 'sunrise' ? 'from-[#7c2d12] via-[#9a3412] to-[#b91c1c]' :
                    selectedGradient === 'emerald' ? 'from-[#064e3b] via-[#115e59] to-[#0f766e]' :
                    selectedGradient === 'amethyst' ? 'from-[#3b0764] via-[#4c1d95] to-[#6d28d9]' :
                    'from-[#18181b] via-[#27272a] to-[#3f3f46]'
                  }`}>
                    {/* Glowing radial flares */}
                    <div className="absolute top-0 left-0 w-36 h-36 rounded-full bg-[#38bdf8] opacity-10 filter blur-2xl pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-36 h-36 rounded-full bg-[#a855f7] opacity-10 filter blur-2xl pointer-events-none" />

                    {/* Translucency inner layer */}
                    <div className="absolute inset-2.5 rounded-xl border border-white/5 bg-[#030712]/45 pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-2 pointer-events-none">
                      <div className="w-5 h-4 rounded border border-[#22d3ee]/80 flex items-center justify-center">
                        <span className="block w-2.5 h-[1.5px] bg-[#22d3ee]" />
                      </div>
                      <span className="text-[10px] font-extrabold tracking-widest text-[#38bdf8] uppercase font-sans">
                        EXPORTED IMAGE CARD
                      </span>
                    </div>

                    <div className="relative z-10 my-auto text-xs sm:text-sm font-semibold leading-relaxed tracking-wide text-white break-words pr-4 line-clamp-5">
                      {cardText || 'Your styled lines here...'}
                    </div>

                    <div className="relative z-10 flex items-center gap-2 text-[8px] font-mono text-[#94a3b8] tracking-wider uppercase pointer-events-none">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping" />
                      <span>VERIFIED GRADIENT EXPORTER ONLINE • PREMIUM</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* WORKSPACE NOTEBOOK MANAGER PANEL */}
          <div className="bg-[#0e121a] border border-[#1b2230] rounded-2xl overflow-hidden shadow-xl shadow-black/40 mt-6">
            <div className="px-5 py-4 border-b border-[#1b2230] bg-[#121722]/50 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Notebook className="w-4 h-4 text-cyan-400" />
                <h2 className="font-semibold text-sm tracking-wide text-gray-200">Workspace Notepad Ledger</h2>
              </div>
              <div className="flex items-center gap-1.5 font-mono text-[10px] text-cyan-400">
                <FileText className="w-3.5 h-3.5" />
                <span>Local & Cloud Core Sync</span>
              </div>
            </div>

            <div className="p-5 flex flex-col gap-5">
              <form onSubmit={handleAddNotepadNote} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={notepadContent}
                  onChange={(e) => setNotepadContent(e.target.value)}
                  placeholder="Type a new persistent workspace note..."
                  className="flex-1 bg-[#090b0e] border border-gray-850 rounded-xl px-4 py-2 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white rounded-xl font-semibold text-xs transition duration-200"
                >
                  Save Note
                </button>
              </form>

              {/* Notes list */}
              <div className="flex flex-col gap-2.5">
                <div className="text-xs font-semibold text-gray-400 flex items-center justify-between">
                  <span>List of Logged Notepad Items</span>
                  <span className="text-[10px] font-mono font-bold text-cyan-400">Chat ID: {simUser.chatId}</span>
                </div>

                {notepadList.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-[#1b2230] rounded-xl bg-[#0a0d14]/40 text-xs text-gray-500 flex flex-col items-center gap-1.5">
                    <Notebook className="w-6 h-6 text-gray-700 stroke-[1.5]" />
                    <span>Your digital workspace notebook is empty.</span>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2.5 max-h-64 overflow-y-auto pr-1">
                    {notepadList.map((note) => (
                      <div
                        key={note.id}
                        className="p-3 bg-slate-950/25 border border-[#1b2230] rounded-xl flex items-center justify-between gap-3 text-xs"
                      >
                        <div className="flex-1 min-w-0">
                          {notepadEditId === note.id ? (
                            <div className="flex gap-2">
                              <input
                                type="text"
                                value={notepadEditText}
                                onChange={(e) => setNotepadEditText(e.target.value)}
                                className="flex-1 bg-[#090b0e] border border-cyan-500 rounded px-2.5 py-1 text-xs text-white focus:outline-none"
                              />
                              <button
                                onClick={() => handleSaveEditNotepadNote(note.id)}
                                className="px-2.5 py-1 bg-cyan-700 text-white rounded text-[10px] font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setNotepadEditId(null)}
                                className="px-2.5 py-1 bg-gray-800 text-gray-400 rounded text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div>
                              <p className="text-gray-200 leading-normal break-words pr-2">
                                {note.content}
                              </p>
                              <div className="flex gap-2 mt-1 text-[9px] text-gray-500 font-mono">
                                <span>ID: <strong className="text-gray-400">{note.id}</strong></span>
                                <span>•</span>
                                <span>Modified: {new Date(note.timestamp).toLocaleTimeString()}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {notepadEditId !== note.id && (
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              onClick={() => {
                                setNotepadEditId(note.id);
                                setNotepadEditText(note.content);
                              }}
                              className="text-gray-400 hover:text-cyan-400 p-1.5 rounded transition"
                              title="Edit post"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteNotepadNote(note.id)}
                              className="text-gray-400 hover:text-rose-400 p-1.5 rounded transition"
                              title="Delete note"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

        </section>

      </main>
    </div>
  );
}
