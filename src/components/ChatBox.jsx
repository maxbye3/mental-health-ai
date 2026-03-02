import { useState, useRef, useEffect, useCallback } from 'react';
import './ChatBox.css';

const QUICK_PROMPTS = [
  'I want to find a therapist/counselor near me.',
  'I want to feel less frazzled.',
  'I want a wellness class happening today.',
  'I feel overwhelmed and need urgent support.',
  "I'm not sure what to do?"
];

export const ChatBox = ({
  onFilter,
  isLoading,
  onRememberMeRequest,
  isRememberMeEnabled = false
}) => {
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: "Hi! I'm here to help you find mental health resources near you. Just chat to me and I'll find the right resources for you.",
      sender: 'bot'
    }
  ]);
  const [input, setInput] = useState('');
  const [isInputExpanded, setIsInputExpanded] = useState(false);
  const [botStage, setBotStage] = useState('idle');
  const [streamingText, setStreamingText] = useState('');
  const messageQueueRef = useRef(Promise.resolve());
  const isMountedRef = useRef(true);
  const messagesEndRef = useRef(null);

  const sleep = (ms) => new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, botStage, streamingText, isLoading]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const playBotResponseAnimation = useCallback(async (text) => {
    setBotStage('thinking');
    setStreamingText('');

    const thinkingDelay = 2000 + Math.floor(Math.random() * 1000);
    await sleep(thinkingDelay);
    if (!isMountedRef.current) return;

    setBotStage('typing');

    for (let index = 1; index <= text.length; index += 1) {
      if (!isMountedRef.current) return;

      const partialText = text.slice(0, index);
      setStreamingText(partialText);

      const currentChar = partialText[partialText.length - 1];
      const charDelay = /[.,!?]/.test(currentChar) ? 44 : 18;
      await sleep(charDelay);
    }

    if (!isMountedRef.current) return;

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        text,
        sender: 'bot'
      }
    ]);
    setStreamingText('');
    setBotStage('idle');
  }, []);

  const handleSend = (e) => {
    e.preventDefault();
    submitUserMessage(input);
  };

  const addBotMessage = useCallback((text) => {
    if (typeof text !== 'string' || !text.trim()) {
      return Promise.resolve();
    }

    messageQueueRef.current = messageQueueRef.current
      .catch(() => {})
      .then(() => playBotResponseAnimation(text));
    return messageQueueRef.current;
  }, [playBotResponseAnimation]);

  const addUserMessage = useCallback((text) => {
    if (typeof text !== 'string' || !text.trim()) {
      return Promise.resolve();
    }

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        text: text.trim(),
        sender: 'user'
      }
    ]);

    return Promise.resolve();
  }, []);

  // Expose addBotMessage to parent if needed
  useEffect(() => {
    window.addBotMessage = addBotMessage;
    window.addUserMessage = addUserMessage;
    return () => {
      if (window.addBotMessage === addBotMessage) {
        delete window.addBotMessage;
      }
      if (window.addUserMessage === addUserMessage) {
        delete window.addUserMessage;
      }
    };
  }, [addBotMessage, addUserMessage]);

  const showThinkingMessage = botStage === 'thinking' || (isLoading && botStage === 'idle');
  const showStreamingMessage = botStage === 'typing';
  const isInputDisabled = isLoading || botStage !== 'idle';
  const hasUserMessage = messages.some((message) => message.sender === 'user');

  const submitUserMessage = useCallback((text) => {
    const trimmedText = text.trim();
    if (!trimmedText || isInputDisabled) return;

    setMessages((prev) => [
      ...prev,
      {
        id: prev.length + 1,
        text: trimmedText,
        sender: 'user'
      }
    ]);
    setInput('');
    setIsInputExpanded(false);
    onFilter(trimmedText);
  }, [isInputDisabled, onFilter]);

  const handleInputFocus = () => {
    setIsInputExpanded(true);
  };

  const handleInputBlur = () => {
    if (!input.trim()) {
      setIsInputExpanded(false);
    }
  };

  const handleInputKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submitUserMessage(input);
    }
  };

  return (
    <div className="chat-box">
      <div className="chat-header">
        <h2>What are you looking for?</h2>
      </div>

      <div className="chat-messages">
        {messages.map((msg, index) => (
          <div key={msg.id}>
            <div className={`message ${msg.sender}`}>
              <div className="message-content">
                {msg.text}
              </div>
            </div>
            {msg.sender === 'bot' && index === 0 && !hasUserMessage && (
              <div className="quick-prompts" aria-label="Suggested prompts">
                <p className="chat-helper-text quick-prompts-hint quick-prompt-line-break">
                  Use one of the prompts to get started
                </p>
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    className="quick-prompt-btn"
                    disabled={isInputDisabled}
                    onClick={() => submitUserMessage(prompt)}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
        {showThinkingMessage && (
          <div className="message bot">
            <div className="message-content">
              <span className="spinner-indicator">
                <span className="spinner-wheel"></span>
                <span className="spinner-label">Thinking...</span>
              </span>
            </div>
          </div>
        )}
        {showStreamingMessage && (
          <div className="message bot">
            <div className="message-content message-streaming">
              {streamingText}
              <span className="typing-cursor"></span>
            </div>
          </div>
        )}
        {!hasUserMessage && (
          <p className="chat-helper-text chat-start-hint">Or start chatting in this chatbox:</p>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="chat-input-form">
        {hasUserMessage && (
          <button
            type="button"
            className={`remember-me-btn ${isRememberMeEnabled ? 'is-active' : ''}`}
            aria-pressed={isRememberMeEnabled}
            onClick={onRememberMeRequest}
          >
            Remember me
          </button>
        )}
        <div className="chat-input-row">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleInputKeyDown}
            placeholder="E.g., 'Show me therapists specializing in anxiety'"
            className="chat-input chat-input-textarea"
            rows={isInputExpanded ? 4 : 1}
            data-expanded={isInputExpanded ? 'true' : 'false'}
            disabled={isInputDisabled}
          />
          <button type="submit" className="send-btn" disabled={isInputDisabled}>
            Send
          </button>
        </div>
      </form>
    </div>
  );
};
