import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  Send,
  Loader2,
  HelpCircle,
  Settings,
  Bot,
  Trash2,
} from 'lucide-react';
import { useTTS, TTSToggle } from '../components/TTSOutput';
import type { Intent, ActionResult, ClawdbotMessage } from '../types/electron.d';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  intent?: Intent;
  action?: ActionResult;
  usedClaudeCode?: boolean;
}

interface CommandCategory {
  category: string;
  examples: string[];
}

export default function Clawdbot() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [availableCommands, setAvailableCommands] = useState<CommandCategory[]>([]);

  // TTS hook
  const { speak, stop: stopSpeaking, isSpeaking } = useTTS({
    enabled: ttsEnabled,
    rate: 1.0,
    pitch: 1.0,
  });

  // Speech recognition
  const [recognition, setRecognition] = useState<SpeechRecognition | null>(null);
  const [interimTranscript, setInterimTranscript] = useState('');

  // Initialize speech recognition
  useEffect(() => {
    const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognitionAPI) {
      const rec = new SpeechRecognitionAPI();
      rec.continuous = false;
      rec.interimResults = true;
      rec.lang = 'en-US';

      rec.onresult = (event: SpeechRecognitionEvent) => {
        let interim = '';
        let final = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        setInterimTranscript(interim);

        if (final) {
          setInputText(final);
          setInterimTranscript('');
          // Auto-submit after voice input
          setTimeout(() => handleSubmit(final), 100);
        }
      };

      rec.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error('Speech recognition error:', event.error);
        setIsListening(false);
      };

      rec.onend = () => {
        setIsListening(false);
      };

      setRecognition(rec);
    }

    // Load available commands
    window.electronAPI?.getAvailableCommands?.().then(setAvailableCommands);

    // Load persisted messages or add initial greeting
    window.electronAPI?.getClawdbotMessages?.().then((persistedMessages: ClawdbotMessage[] | undefined) => {
      if (persistedMessages && persistedMessages.length > 0) {
        // Convert persisted messages to local format
        const converted = persistedMessages.map((m: ClawdbotMessage) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          timestamp: new Date(m.timestamp),
          usedClaudeCode: m.usedClaudeCode,
        }));
        setMessages(converted);
      } else {
        // Add initial greeting
        const greeting = getGreeting();
        const greetingMessage = {
          id: '1',
          role: 'assistant' as const,
          content: greeting,
          timestamp: new Date(),
        };
        setMessages([greetingMessage]);
        // Persist the greeting
        window.electronAPI?.addClawdbotMessage?.({
          role: 'assistant',
          content: greeting,
        });
      }
    }).catch(() => {
      // Fallback if API not available
      const greeting = getGreeting();
      setMessages([{
        id: '1',
        role: 'assistant',
        content: greeting,
        timestamp: new Date(),
      }]);
    });
  }, []);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Parse intent mutation
  const parseIntentMutation = useMutation({
    mutationFn: async (text: string) => {
      const intent = await window.electronAPI?.parseIntent?.(text);
      return intent;
    },
  });

  // Dispatch action mutation
  const dispatchActionMutation = useMutation({
    mutationFn: async (intent: Intent) => {
      const result = await window.electronAPI?.dispatchAction?.(intent);
      return result;
    },
    onSuccess: (result) => {
      if (result?.navigate) {
        // Delay navigation to let user see the response
        setTimeout(() => navigate(result.navigate!), 1000);
      }

      // Handle controller actions
      if (result?.data?.controllerAction) {
        const action = result.data.controllerAction as string;
        switch (action) {
          case 'pause':
            window.electronAPI?.pauseController();
            break;
          case 'resume':
            window.electronAPI?.resumeController();
            break;
          case 'activate':
            window.electronAPI?.activateController();
            break;
          case 'deactivate':
            window.electronAPI?.deactivateController();
            break;
        }
        queryClient.invalidateQueries({ queryKey: ['controller-state'] });
      }

      // Handle task execution
      if (result?.data?.executeTaskId) {
        window.electronAPI?.sendTaskToClaude(result.data.executeTaskId as string);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      }

      // Handle settings changes
      if (result?.data?.settingAction === 'theme') {
        window.electronAPI?.setSetting('theme', result.data.value as 'dark' | 'light' | 'system');
        queryClient.invalidateQueries({ queryKey: ['settings'] });
      }

      // Handle confirmation required
      if (result?.requiresConfirmation) {
        setPendingConfirmation(result.confirmationMessage || null);
      }
    },
  });

  // Handle submit
  const handleSubmit = useCallback(async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText) return;

    // Clear input
    setInputText('');
    stopSpeaking();

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Persist user message
    window.electronAPI?.addClawdbotMessage?.({
      role: 'user',
      content: messageText,
    });

    // Check for confirmation response
    if (pendingConfirmation) {
      const isYes = /^(yes|yeah|yep|ok|okay|sure|confirm|do it)$/i.test(messageText);
      const isNo = /^(no|nope|cancel|never mind|don't)$/i.test(messageText);

      if (isYes) {
        const result = await window.electronAPI?.executeConfirmedAction?.(pendingConfirmation);
        const response = result?.response || 'Done.';
        addAssistantMessage(response, undefined, false);
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
      } else if (isNo) {
        addAssistantMessage('Cancelled.', undefined, false);
      } else {
        addAssistantMessage('Please say yes or no to confirm.', undefined, false);
        return;
      }
      setPendingConfirmation(null);
      return;
    }

    // Parse intent
    try {
      const intent = await parseIntentMutation.mutateAsync(messageText);

      if (intent) {
        userMessage.intent = intent;

        // Dispatch action - handles both known and unknown intents
        // Unknown intents are now routed to Claude Code
        const result = await dispatchActionMutation.mutateAsync(intent);
        if (result) {
          const usedClaude = result.data?.usedClaudeCode === true;
          addAssistantMessage(result.response, result, usedClaude);
        }
      }
    } catch (error) {
      console.error('Error processing command:', error);
      addAssistantMessage("Sorry, I encountered an error processing your request.", undefined, false);
    }
  }, [inputText, pendingConfirmation, parseIntentMutation, dispatchActionMutation, queryClient, stopSpeaking]);

  // Add assistant message
  const addAssistantMessage = (content: string, action?: ActionResult, usedClaudeCode?: boolean) => {
    const message: Message = {
      id: Date.now().toString(),
      role: 'assistant',
      content,
      timestamp: new Date(),
      action,
      usedClaudeCode,
    };
    setMessages(prev => [...prev, message]);

    // Persist the message
    window.electronAPI?.addClawdbotMessage?.({
      role: 'assistant',
      content,
      usedClaudeCode,
    });

    // Speak if TTS enabled
    if (ttsEnabled) {
      speak(content);
    }
  };

  // Clear conversation
  const clearConversation = () => {
    window.electronAPI?.clearClawdbotMessages?.();
    const greeting = getGreeting();
    setMessages([{
      id: '1',
      role: 'assistant',
      content: greeting,
      timestamp: new Date(),
    }]);
    window.electronAPI?.addClawdbotMessage?.({
      role: 'assistant',
      content: greeting,
    });
  };

  // Toggle listening
  const toggleListening = () => {
    if (isListening) {
      recognition?.stop();
      setIsListening(false);
      setInterimTranscript('');
    } else {
      recognition?.start();
      setIsListening(true);
    }
  };

  // Get greeting based on time of day
  function getGreeting(): string {
    const hour = new Date().getHours();
    let timeGreeting = 'Hello';
    if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    return `${timeGreeting}! I'm Clawdbot, your AI assistant. I can help you navigate the app, manage tasks, and more. Try saying "Go to tasks" or "What's the status?" You can also say "help" to see all available commands.`;
  }

  // Handle key press
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const isProcessing = parseIntentMutation.isPending || dispatchActionMutation.isPending;

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-xl">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Clawdbot</h2>
            <p className="text-sm text-slate-400">Voice-enabled AI Assistant</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <TTSToggle enabled={ttsEnabled} onToggle={setTtsEnabled} />
          <button
            onClick={clearConversation}
            className="p-2 rounded-lg bg-slate-700 text-slate-400 hover:text-red-400 transition-colors"
            title="Clear conversation"
          >
            <Trash2 size={20} />
          </button>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className={`p-2 rounded-lg transition-colors ${
              showHelp ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-700 text-slate-400 hover:text-white'
            }`}
            title="Show available commands"
          >
            <HelpCircle size={20} />
          </button>
          <button
            onClick={() => navigate('/clawdbot')}
            className="p-2 rounded-lg bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="Clawdbot Settings"
          >
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Help Panel */}
      {showHelp && (
        <div className="mb-4 p-4 bg-slate-800 rounded-lg border border-slate-700 max-h-64 overflow-y-auto">
          <h3 className="font-semibold text-white mb-3">Available Commands</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {availableCommands.map((cat) => (
              <div key={cat.category}>
                <h4 className="text-sm font-medium text-cyan-400 mb-2">{cat.category}</h4>
                <ul className="space-y-1">
                  {cat.examples.map((example, i) => (
                    <li
                      key={i}
                      className="text-sm text-slate-300 cursor-pointer hover:text-white"
                      onClick={() => {
                        setInputText(example);
                        inputRef.current?.focus();
                      }}
                    >
                      "{example}"
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto bg-slate-800/50 rounded-lg border border-slate-700 p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Bot size={16} className="text-white" />
              </div>
            )}
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === 'user'
                  ? 'bg-cyan-500 text-white'
                  : message.usedClaudeCode
                    ? 'bg-slate-700 text-slate-200 border border-purple-500/30'
                    : 'bg-slate-700 text-slate-200'
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs opacity-60">
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {message.usedClaudeCode && (
                  <span className="text-xs text-purple-400">via Claude Code</span>
                )}
              </div>
            </div>
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center">
                <span className="text-sm text-white">You</span>
              </div>
            )}
          </div>
        ))}

        {/* Interim transcript while listening */}
        {isListening && interimTranscript && (
          <div className="flex gap-3 justify-end">
            <div className="max-w-[80%] rounded-lg px-4 py-2 bg-cyan-500/50 text-white italic">
              {interimTranscript}...
            </div>
          </div>
        )}

        {/* Processing indicator */}
        {isProcessing && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Bot size={16} className="text-white" />
            </div>
            <div className="bg-slate-700 rounded-lg px-4 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="mt-4 flex items-center gap-2">
        {/* Voice Input Button */}
        <button
          onClick={toggleListening}
          disabled={!recognition}
          className={`p-3 rounded-lg transition-all ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse'
              : 'bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title={isListening ? 'Stop listening' : 'Start voice input'}
        >
          {isListening ? <Mic size={20} className="animate-pulse" /> : <MicOff size={20} />}
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <input
            ref={inputRef}
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={
              pendingConfirmation
                ? 'Say yes or no to confirm...'
                : isListening
                ? 'Listening...'
                : 'Type a command or question...'
            }
            disabled={isProcessing}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 pr-12 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-cyan-500 disabled:opacity-50"
          />
          {isSpeaking && (
            <div className="absolute right-12 top-1/2 -translate-y-1/2">
              <Volume2 size={18} className="text-cyan-400 animate-pulse" />
            </div>
          )}
        </div>

        {/* Send Button */}
        <button
          onClick={() => handleSubmit()}
          disabled={!inputText.trim() || isProcessing}
          className="p-3 bg-cyan-500 hover:bg-cyan-600 disabled:bg-slate-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
        >
          {isProcessing ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      </div>

      {/* Status Bar */}
      <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <span className={isListening ? 'text-red-400' : ''}>
            {isListening ? 'Listening...' : recognition ? 'Voice ready' : 'Voice not available'}
          </span>
          <span className={ttsEnabled ? 'text-cyan-400' : ''}>
            {ttsEnabled ? 'Voice output on' : 'Voice output off'}
          </span>
        </div>
        {pendingConfirmation && (
          <span className="text-yellow-400">Awaiting confirmation...</span>
        )}
      </div>
    </div>
  );
}

// TypeScript declarations for Web Speech API
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => unknown) | null;
  onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => unknown) | null;
  onend: ((this: SpeechRecognition, ev: Event) => unknown) | null;
  onstart: ((this: SpeechRecognition, ev: Event) => unknown) | null;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}
