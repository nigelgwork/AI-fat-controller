import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '@/api';
import {
  Bot,
  X,
  Send,
  Loader2,
  Settings,
  ChevronDown,
  Minimize2,
  MessageSquare,
  Image,
  Folder,
  Paperclip,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  useCurrentPersonality,
  useClawdbotGreeting,
  usePersonalities,
  useSetCurrentPersonality,
} from '../hooks/useClawdbot';
import { useQuery } from '@tanstack/react-query';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  images?: string[];
}

interface AttachedImage {
  path: string;
  name: string;
  preview?: string;
}

export default function FloatingAssistant() {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPersonalityPicker, setShowPersonalityPicker] = useState(false);
  const [showProjectPicker, setShowProjectPicker] = useState(false);
  const [selectedProjectPath, setSelectedProjectPath] = useState<string | null>(null);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: currentPersonality } = useCurrentPersonality();
  const { data: greeting } = useClawdbotGreeting();
  const { data: personalities = [] } = usePersonalities();
  const setCurrentPersonality = useSetCurrentPersonality();

  // Fetch projects list
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.listProjects() ?? Promise.resolve([]),
    staleTime: 30000,
  });

  // Get selected project name
  const selectedProject = projects.find(p => p.path === selectedProjectPath);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when opening
  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  // Add greeting when first opened
  useEffect(() => {
    if (isOpen && messages.length === 0 && greeting) {
      setMessages([
        {
          id: 'greeting',
          role: 'assistant',
          content: greeting,
          timestamp: new Date(),
        },
      ]);
    }
  }, [isOpen, greeting, messages.length]);

  // Handle clipboard paste for images
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (!isOpen || isMinimized) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            await handleImageFile(blob);
          }
          break;
        }
      }
    };

    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [isOpen, isMinimized]);

  const handleImageFile = async (file: File) => {
    // Read file as base64 and save to temp location via IPC
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;

      // Save to temp file via IPC
      const filename = file.name || `pasted-image-${Date.now()}.png`;
      const result = await api.saveImageToTemp(base64, filename);

      if (result?.success && result.path) {
        // Create a blob URL for preview
        const preview = URL.createObjectURL(file);

        setAttachedImages(prev => [...prev, {
          path: result.path!,
          name: filename,
          preview,
        }]);
      } else {
        console.error('Failed to save image:', result?.error);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        // In Electron, file.path contains the full path
        const filePath = (file as File & { path?: string }).path;

        if (filePath) {
          // Use the actual file path
          const preview = URL.createObjectURL(file);
          setAttachedImages(prev => [...prev, {
            path: filePath,
            name: file.name,
            preview,
          }]);
        } else {
          // Fallback: save to temp (shouldn't happen in Electron, but just in case)
          await handleImageFile(file);
        }
      }
    }

    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setAttachedImages(prev => {
      const newImages = [...prev];
      if (newImages[index].preview) {
        URL.revokeObjectURL(newImages[index].preview!);
      }
      newImages.splice(index, 1);
      return newImages;
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      if (file.type.startsWith('image/')) {
        const filePath = (file as File & { path?: string }).path;

        if (filePath) {
          const preview = URL.createObjectURL(file);
          setAttachedImages(prev => [...prev, {
            path: filePath,
            name: file.name,
            preview,
          }]);
        } else {
          // Save to temp if no path available
          await handleImageFile(file);
        }
      }
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const imagePaths = attachedImages.map(img => img.path);

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
      images: imagePaths.length > 0 ? imagePaths : undefined,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setAttachedImages([]);
    setLoading(true);

    try {
      // Pass project path and images to Claude
      const result = await api.executeClaudeCode(
        input.trim(),
        undefined,  // Use default system prompt from backend
        selectedProjectPath || undefined,
        imagePaths.length > 0 ? imagePaths : undefined
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: result?.response || result?.error || 'No response',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handlePersonalityChange = async (id: string) => {
    try {
      await setCurrentPersonality.mutateAsync(id);
      setShowPersonalityPicker(false);
    } catch (error) {
      console.error('Failed to change personality:', error);
    }
  };

  const clearChat = () => {
    setMessages([]);
    // Clean up image previews
    attachedImages.forEach(img => {
      if (img.preview) URL.revokeObjectURL(img.preview);
    });
    setAttachedImages([]);
  };

  if (!isOpen) {
    // Collapsed button
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-gradient-to-br from-cyan-500 to-purple-600 hover:from-cyan-400 hover:to-purple-500 text-white rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 z-50"
        title="Open Clawdbot Assistant"
      >
        <Bot className="w-7 h-7" />
      </button>
    );
  }

  if (isMinimized) {
    // Minimized bar
    return (
      <div className="fixed bottom-6 right-6 bg-slate-800 border border-slate-700 rounded-lg shadow-lg flex items-center gap-2 p-2 z-50">
        <Bot className="w-5 h-5 text-cyan-400" />
        <span className="text-sm text-white font-medium">Clawdbot</span>
        <button
          onClick={() => setIsMinimized(false)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
        >
          <ChevronDown className="w-4 h-4 rotate-180" />
        </button>
        <button
          onClick={() => setIsOpen(false)}
          className="p-1 text-slate-400 hover:text-white hover:bg-slate-700 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // Expanded panel
  return (
    <div
      className={`fixed bottom-6 right-6 w-96 h-[500px] bg-slate-800 border rounded-lg shadow-2xl flex flex-col z-50 ${
        isDragging ? 'border-cyan-500 border-2' : 'border-slate-700'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-slate-700">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <span className="font-medium text-white">Clawdbot</span>
          {currentPersonality && (
            <div className="relative">
              <button
                onClick={() => setShowPersonalityPicker(!showPersonalityPicker)}
                className="px-2 py-0.5 text-xs bg-slate-700 text-slate-300 rounded hover:bg-slate-600 transition-colors"
              >
                {currentPersonality.name}
                <ChevronDown className="w-3 h-3 inline ml-1" />
              </button>

              {/* Personality Picker Dropdown */}
              {showPersonalityPicker && (
                <div className="absolute top-full left-0 mt-1 w-48 bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-10">
                  {personalities.map((p: { id: string; name: string }) => (
                    <button
                      key={p.id}
                      onClick={() => handlePersonalityChange(p.id)}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors ${
                        currentPersonality.id === p.id
                          ? 'bg-cyan-500/10 text-cyan-400'
                          : 'text-slate-300'
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => navigate('/clawdbot')}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Personality Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsMinimized(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Minimize"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Project Context Selector */}
      <div className="px-3 py-2 border-b border-slate-700/50 bg-slate-800/50">
        <div className="relative">
          <button
            onClick={() => setShowProjectPicker(!showProjectPicker)}
            className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 transition-colors w-full"
          >
            <Folder className="w-3.5 h-3.5" />
            <span className="truncate flex-1 text-left">
              {selectedProject ? selectedProject.name : 'No project context (select a project)'}
            </span>
            <ChevronDown className={`w-3 h-3 transition-transform ${showProjectPicker ? 'rotate-180' : ''}`} />
          </button>

          {/* Project Picker Dropdown */}
          {showProjectPicker && (
            <div className="absolute top-full left-0 mt-1 w-full bg-slate-900 border border-slate-700 rounded-lg shadow-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
              <button
                onClick={() => {
                  setSelectedProjectPath(null);
                  setShowProjectPicker(false);
                }}
                className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors ${
                  !selectedProjectPath ? 'bg-cyan-500/10 text-cyan-400' : 'text-slate-300'
                }`}
              >
                No project context
              </button>
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    setSelectedProjectPath(project.path);
                    setShowProjectPicker(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-800 transition-colors ${
                    selectedProjectPath === project.path
                      ? 'bg-cyan-500/10 text-cyan-400'
                      : 'text-slate-300'
                  }`}
                >
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-slate-500 truncate">{project.path}</div>
                </button>
              ))}
              {projects.length === 0 && (
                <div className="px-3 py-2 text-sm text-slate-500">
                  No projects found. Add projects in the Projects page.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isDragging && (
          <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10 pointer-events-none">
            <div className="text-cyan-400 flex flex-col items-center gap-2">
              <Image className="w-10 h-10" />
              <span>Drop image here</span>
            </div>
          </div>
        )}
        {messages.length === 0 && (
          <div className="text-center text-slate-500 py-8">
            <MessageSquare className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Send a message to get started</p>
            <p className="text-xs mt-2 text-slate-600">
              Tip: Select a project above for context-aware responses
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 ${
                msg.role === 'user'
                  ? 'bg-cyan-600 text-white'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              {msg.images && msg.images.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {msg.images.map((_, i) => (
                    <div key={i} className="text-xs opacity-70 flex items-center gap-1">
                      <Image className="w-3 h-3" />
                      <span>Image attached</span>
                    </div>
                  ))}
                </div>
              )}
              <pre className="whitespace-pre-wrap font-sans text-sm break-words">
                {msg.content}
              </pre>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-slate-700 rounded-lg px-3 py-2">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Attached Images Preview */}
      {attachedImages.length > 0 && (
        <div className="px-3 py-2 border-t border-slate-700/50 bg-slate-800/50">
          <div className="flex flex-wrap gap-2">
            {attachedImages.map((img, index) => (
              <div key={index} className="relative group">
                {img.preview ? (
                  <img
                    src={img.preview}
                    alt={img.name}
                    className="w-12 h-12 object-cover rounded border border-slate-600"
                  />
                ) : (
                  <div className="w-12 h-12 bg-slate-700 rounded border border-slate-600 flex items-center justify-center">
                    <Image className="w-5 h-5 text-slate-400" />
                  </div>
                )}
                <button
                  onClick={() => removeImage(index)}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-slate-700">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*"
          multiple
          className="hidden"
        />
        <div className="flex gap-2 items-end">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors flex-shrink-0 self-end mb-0.5"
            title="Attach image (or paste from clipboard)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            placeholder="Ask Clawdbot... (Shift+Enter for new line)"
            className="flex-1 bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
            rows={1}
            disabled={loading}
            style={{ height: 'auto' }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = 'auto';
              target.style.height = Math.min(target.scrollHeight, 120) + 'px';
            }}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white px-3 py-2 rounded-lg transition-colors flex-shrink-0 self-end"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
        <div className="flex justify-between items-center mt-2">
          {messages.length > 1 && (
            <button
              type="button"
              onClick={clearChat}
              className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Clear chat
            </button>
          )}
          <span className="text-xs text-slate-600 ml-auto">
            Ctrl+V to paste images
          </span>
        </div>
      </form>
    </div>
  );
}
