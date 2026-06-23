import React, { useState } from 'react';
import Chatbot from './Chatbot';

interface Props { onRequestAnalysis?: () => void; }

export default function ChatbotLauncher({ onRequestAnalysis }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="chatbot-overlay">
          <Chatbot onRequestAnalysis={onRequestAnalysis} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        className={`chatbot-fab ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Open AyurSkin AI Chatbot"
      >
        {open ? '✕' : '🌿'}
        {!open && <span className="fab-label">Ask AI</span>}
      </button>
    </>
  );
}
