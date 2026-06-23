import React, { useState, useEffect, useRef, useCallback } from 'react';
import { chatApi } from '../../services/api';

interface Message {
  role:    'user' | 'assistant';
  content: string;
  isLLM?:  boolean;
  action?: { type: string; payload?: string };
}
interface Props {
  onRequestAnalysis?: () => void;
  onClose:            () => void;
}

// Very simple bold/newline renderer — avoids importing markdown-it
function renderText(text: string) {
  return text
    .split('\n')
    .map((line, i) => {
      // Bold: **text**
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((p, j) => j % 2 === 1 ? <strong key={j}>{p}</strong> : p)}
          {i < text.split('\n').length - 1 && <br />}
        </span>
      );
    });
}

export default function Chatbot({ onRequestAnalysis, onClose }: Props) {
  const [messages,   setMessages]   = useState<Message[]>([]);
  const [input,      setInput]      = useState('');
  const [sessionId,  setSessionId]  = useState<string | null>(null);
  const [loading,    setLoading]    = useState(false);
  const [initDone,   setInitDone]   = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages]);

  // Initialise session on mount
  useEffect(() => {
    chatApi.createSession().then(res => {
      setSessionId(res.sessionId);
      if (res.message) {
        setMessages([{ role: 'assistant', content: res.message.content, action: res.message.action }]);
      }
      setInitDone(true);
    }).catch(() => {
      setMessages([{ role: 'assistant', content: 'Hello! I\'m AyurSkin AI. How can I help with your skin today? 🌿' }]);
      setInitDone(true);
    });
  }, []);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading || !sessionId) return;

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setLoading(true);

    try {
      const res = await chatApi.sendMessage(sessionId, text);
      const msg = res.message;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: msg.content,
        isLLM: msg.isLLM,
        action: msg.action,
      }]);

      // Handle navigation actions
      if (msg.action?.type === 'navigate' && msg.action.payload === 'analysis') {
        onRequestAnalysis?.();
      }
      if (msg.action?.type === 'open_camera') {
        onRequestAnalysis?.();
      }
    } catch {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I\'m having trouble connecting right now. Please try again.',
      }]);
    } finally { setLoading(false); }
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const clearChat = async () => {
    if (!sessionId) return;
    await chatApi.clearSession(sessionId).catch(() => {});
    // Reinitialize
    const res = await chatApi.createSession();
    setSessionId(res.sessionId);
    setMessages(res.message ? [{ role: 'assistant', content: res.message.content }] : []);
  };

  // Quick reply chips
  const QUICK_REPLIES = [
    'Why do I have acne on my cheeks?',
    'What should I eat to reduce pigmentation?',
    'How has my skin changed?',
    'Suggest my morning routine',
    'Open camera for analysis',
  ];

  return (
    <div className="chatbot-panel">
      {/* Header */}
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-avatar">🌿</div>
          <div>
            <div className="chat-name">AyurSkin AI</div>
            <div className="chat-status">Ayurvedic + AI-powered</div>
          </div>
        </div>
        <div className="chat-header-actions">
          <button className="chat-clear-btn" onClick={clearChat} title="Clear chat">🔄</button>
          <button className="chat-close-btn" onClick={onClose}>✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="chat-messages">
        {!initDone && (
          <div className="chat-loading-init">
            <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`chat-message ${msg.role}`}>
            {msg.role === 'assistant' && (
              <div className="msg-avatar">🌿</div>
            )}
            <div className={`msg-bubble ${msg.role}`}>
              <div className="msg-text">{renderText(msg.content)}</div>
              {msg.isLLM && (
                <div className="msg-ai-badge">✨ AI-powered</div>
              )}
              {msg.action?.type === 'open_camera' && (
                <button className="msg-action-btn" onClick={onRequestAnalysis}>
                  📸 Open Camera
                </button>
              )}
              {msg.action?.type === 'navigate' && (
                <button className="msg-action-btn" onClick={onRequestAnalysis}>
                  🔬 Go to Analysis
                </button>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="chat-message assistant">
            <div className="msg-avatar">🌿</div>
            <div className="msg-bubble assistant typing">
              <span className="typing-dot" /><span className="typing-dot" /><span className="typing-dot" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick replies — only show at start */}
      {messages.length <= 2 && (
        <div className="quick-replies">
          {QUICK_REPLIES.map((q, i) => (
            <button key={i} className="quick-reply-chip"
              onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}>
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="chat-input-row">
        <input
          ref={inputRef}
          className="chat-input"
          type="text"
          placeholder="Ask about your skin, remedies, diet..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          disabled={loading || !initDone}
        />
        <button className="chat-send-btn" onClick={handleSend}
          disabled={!input.trim() || loading || !initDone}>
          {loading ? <span className="spinner-sm" /> : '➤'}
        </button>
      </div>
    </div>
  );
}
