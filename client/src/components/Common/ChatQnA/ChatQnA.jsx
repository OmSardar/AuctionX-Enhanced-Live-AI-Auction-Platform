import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import axiosWithAuth from "../../../redux/slices/axiosWithAuth";
import soundManager from "../../../utils/soundManager";
import {
  FaRobot,
  FaPaperPlane,
  FaMicrophone,
  FaExpand,
  FaCompress,
  FaTimes,
  FaVolumeUp,
  FaVolumeMute,
  FaComments,
  FaThumbsUp,
  FaThumbsDown,
  FaTrash,
  FaHistory,
  FaPlus,
  FaArrowRight,
  FaLock,
  FaSignInAlt,
  FaUserPlus,
  FaExclamationCircle,
  FaClock,
  FaRegLightbulb,
} from "react-icons/fa";

const MAX_INPUT_CHARS = 500;

const ChatQnA = () => {
  const navigate = useNavigate();

  // Auth state
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const userName = user?.name || user?.userName || user?.email?.split("@")[0] || "User";

  // UI state
  const [isOpen, setIsOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  // Chat conversation state
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [userQuery, setUserQuery] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [typingText, setTypingText] = useState("");
  const [currentTypingMessage, setCurrentTypingMessage] = useState(null);

  // Suggested topics and history list
  const [suggestedTopics, setSuggestedTopics] = useState([]);
  const [historyList, setHistoryList] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Error & rate limiting
  const [errorMessage, setErrorMessage] = useState(null);
  const [rateLimitCooldown, setRateLimitCooldown] = useState(0);

  // Speech features
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState(null);

  // Refs
  const chatRef = useRef(null);
  const buttonRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const chatBodyRef = useRef(null);
  const isNearBottomRef = useRef(true);
  const speechSynthesis = useRef(typeof window !== "undefined" ? window.speechSynthesis : null);
  const cooldownTimerRef = useRef(null);

  // Fetch suggested topics only when chat drawer is opened by the user
  useEffect(() => {
    if (!isOpen || suggestedTopics.length > 0) return;
    let isMounted = true;
    const fetchTopics = async () => {
      try {
        const res = await axiosWithAuth.get("/chat/topics");
        if (isMounted && res.data?.topics) {
          setSuggestedTopics(res.data.topics);
        }
      } catch {
        // Fallback default topics if request fails
        if (isMounted) {
          setSuggestedTopics([
            { id: "bidding", label: "How does bidding work?", icon: "🔨", query: "How do I place a bid on AuctionX?" },
            { id: "schedule", label: "Schedule a bid", icon: "⏰", query: "How can I schedule a bid in advance?" },
            { id: "payment", label: "Payments & Orders", icon: "💳", query: "How do payments work when I win an auction?" },
            { id: "selling", label: "Start selling", icon: "🏪", query: "How do I become a seller and list items?" },
            { id: "account", label: "Account & Profile", icon: "👤", query: "How do I manage my account and profile?" },
            { id: "security", label: "Security & Privacy", icon: "🔒", query: "How is my account and data protected?" },
          ]);
        }
      }
    };

    fetchTopics();
    return () => {
      isMounted = false;
    };
  }, [isOpen, suggestedTopics.length]);

  // Fetch conversation history when authenticated and drawer opens
  const fetchConversations = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingHistory(true);
    try {
      const res = await axiosWithAuth.get("/chat/history?limit=15");
      if (res.data?.conversations) {
        setHistoryList(res.data.conversations);
      }
    } catch (err) {
      console.error("Failed to fetch chat history:", err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (showHistory && isAuthenticated) {
      fetchConversations();
    }
  }, [showHistory, isAuthenticated, fetchConversations]);

  // Load a specific conversation from history
  const handleSelectConversation = async (convId) => {
    soundManager.playClick();
    try {
      setIsTyping(true);
      setShowHistory(false);
      const res = await axiosWithAuth.get(`/chat/history/${convId}`);
      if (res.data) {
        setConversationId(res.data.conversationId);
        const formattedMessages = (res.data.messages || []).map((m) => ({
          type: m.role === "assistant" ? "bot" : "user",
          text: m.content,
          actions: m.actions || [],
          feedback: m.feedback || null,
          time: res.data.updatedAt || new Date(),
        }));
        setMessages(formattedMessages);
      }
    } catch {
      setErrorMessage("Failed to load conversation history.");
    } finally {
      setIsTyping(false);
    }
  };

  // Start a new conversation
  const handleStartNewChat = () => {
    soundManager.playClick();
    setConversationId(null);
    setMessages([]);
    setUserQuery("");
    setErrorMessage(null);
    setShowHistory(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Clear all conversations
  const handleClearAllHistory = async () => {
    if (!window.confirm("Are you sure you want to clear all your chat history?")) return;
    soundManager.playClick();
    try {
      await axiosWithAuth.delete("/chat/history");
      setHistoryList([]);
      setConversationId(null);
      setMessages([]);
      setShowHistory(false);
    } catch {
      setErrorMessage("Failed to clear chat history.");
    }
  };

  // Track scroll position
  const handleScroll = () => {
    if (!chatBodyRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatBodyRef.current;
    isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
  };

  // Auto-scroll when messages update
  useEffect(() => {
    if (isNearBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, typingText]);

  // Escape key to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    setTimeout(() => inputRef.current?.focus(), 100);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        chatRef.current &&
        !chatRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Rate limit cooldown countdown timer
  useEffect(() => {
    if (rateLimitCooldown > 0) {
      cooldownTimerRef.current = setInterval(() => {
        setRateLimitCooldown((prev) => {
          if (prev <= 1) {
            clearInterval(cooldownTimerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(cooldownTimerRef.current);
  }, [rateLimitCooldown]);

  // Text-to-Speech
  const speakText = (text, messageIndex = null) => {
    if (speechSynthesis.current?.speaking) {
      speechSynthesis.current.cancel();
    }
    if (!text || typeof window === "undefined" || !window.SpeechSynthesisUtterance) return;
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.current?.getVoices() || [];
    const femaleVoice =
      voices.find(
        (voice) =>
          voice.name.toLowerCase().includes("female") ||
          voice.name.toLowerCase().includes("woman") ||
          voice.name.toLowerCase().includes("zira") ||
          voice.name.toLowerCase().includes("hazel")
      ) || voices[0];

    if (femaleVoice) utterance.voice = femaleVoice;
    utterance.rate = 0.95;
    utterance.pitch = 1.05;
    utterance.volume = 0.8;

    utterance.onstart = () => {
      setIsSpeaking(true);
      setSpeakingMessageIndex(messageIndex);
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setSpeakingMessageIndex(null);
    };

    speechSynthesis.current?.speak(utterance);
  };

  const stopSpeaking = () => {
    speechSynthesis.current?.cancel();
    setIsSpeaking(false);
    setSpeakingMessageIndex(null);
  };

  // Typing animation effect for streaming feel
  useEffect(() => {
    if (currentTypingMessage && isTyping) {
      let i = 0;
      setTypingText("");
      const fullText = currentTypingMessage.text;

      const typingInterval = setInterval(() => {
        if (i < fullText.length) {
          setTypingText(fullText.substring(0, i + 1));
          i++;
        } else {
          clearInterval(typingInterval);
          setIsTyping(false);
          setMessages((prev) => [
            ...prev,
            {
              type: "bot",
              text: fullText,
              actions: currentTypingMessage.actions || [],
              feedback: null,
              time: new Date(),
            },
          ]);
          setCurrentTypingMessage(null);
          setTypingText("");
        }
      }, 12);

      return () => clearInterval(typingInterval);
    }
  }, [currentTypingMessage, isTyping]);

  // Submit message
  const handleSendMessage = async (textToSend = null) => {
    const messageContent = (textToSend || userQuery).trim();
    if (!messageContent || isTyping || rateLimitCooldown > 0) return;

    if (!isAuthenticated) {
      setErrorMessage("Please sign in to send messages to the AI assistant.");
      return;
    }

    soundManager.playClick();
    setErrorMessage(null);

    // Add user message to UI immediately
    setMessages((prev) => [
      ...prev,
      { type: "user", text: messageContent, time: new Date() },
    ]);
    setUserQuery("");
    setIsTyping(true);

    try {
      const response = await axiosWithAuth.post("/chat/message", {
        message: messageContent,
        conversationId: conversationId || undefined,
      });

      if (response.data) {
        if (response.data.conversationId) {
          setConversationId(response.data.conversationId);
        }

        setCurrentTypingMessage({
          text: response.data.reply || "I couldn't process that. Please try asking again.",
          actions: response.data.actions || [],
        });
      }
    } catch (err) {
      setIsTyping(false);
      console.error("Chat error:", err);
      if (err.response?.status === 429) {
        const retryAfterMs = err.response?.data?.retryAfterMs || 30000;
        const seconds = Math.ceil(retryAfterMs / 1000);
        setRateLimitCooldown(seconds);
        setErrorMessage(
          err.response?.data?.error || `You've reached the message limit. Please wait ${seconds}s before sending again.`
        );
      } else if (err.response?.status === 401) {
        setErrorMessage("Your session has expired. Please log in again.");
      } else {
        const errorText =
          err.response?.data?.error || "We encountered an issue processing your question. Please try again.";
        setMessages((prev) => [
          ...prev,
          {
            type: "bot",
            text: errorText,
            actions: [{ type: "navigate", path: "/contact", label: "Contact Support" }],
            time: new Date(),
          },
        ]);
      }
    }
  };

  const handleFormSubmit = (e) => {
    if (e) e.preventDefault();
    handleSendMessage();
  };

  // Submit feedback (thumbs up / down)
  const handleFeedback = async (messageIndex, feedbackType) => {
    soundManager.playClick();
    if (!conversationId) return;

    // Optimistically update message in state
    setMessages((prev) =>
      prev.map((m, idx) => (idx === messageIndex ? { ...m, feedback: feedbackType } : m))
    );

    try {
      await axiosWithAuth.patch("/chat/feedback", {
        conversationId,
        messageIndex,
        feedback: feedbackType,
      });
    } catch (err) {
      console.error("Feedback submit error:", err);
    }
  };

  // Voice recognition
  const startListening = () => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setUserQuery(transcript);
      setTimeout(() => {
        handleSendMessage(transcript);
      }, 300);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);

    recognition.start();
  };

  const formatMessageTime = (date) => {
    if (!date) return "";
    return new Date(date).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleActionClick = (action) => {
    soundManager.playClick();
    if (action.path) {
      navigate(action.path);
      // On mobile or small screens, optionally collapse chat
      if (window.innerWidth < 640) {
        setIsOpen(false);
      }
    }
  };

  return (
    <div>
      {/* Floating Trigger Button */}
      {!isOpen && (
        <button
          ref={buttonRef}
          onClick={() => {
            soundManager.playClick();
            setIsOpen(true);
          }}
          onMouseEnter={() => soundManager.playHover()}
          aria-label="Open AI Support Chat"
          className="fixed bottom-6 right-6 z-50 p-4 rounded-full bg-action-primary text-action-primary-foreground shadow-modal hover:scale-105 active:scale-95 transition-all duration-200 flex items-center justify-center group"
        >
          <FaComments className="text-2xl" />
          <span className="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out text-sm font-semibold pl-0 group-hover:pl-2">
            AuctionX AI Assistant
          </span>
          <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-status-success rounded-full ring-2 ring-surface animate-pulse" />
        </button>
      )}

      {/* Main Chat Window */}
      {isOpen && (
        <div
          ref={chatRef}
          role="dialog"
          aria-label="AuctionX Support Chat"
          className={`fixed z-50 flex flex-col bg-surface border border-border-subtle shadow-modal transition-all duration-300 ${
            isFullscreen
              ? "inset-0 rounded-none w-full h-full"
              : "bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100vw-32px)] sm:w-[420px] h-[580px] max-h-[88vh] rounded-2xl overflow-hidden"
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-surface-raised border-b border-border-subtle shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="relative p-2 rounded-xl bg-action-primary/10 text-action-primary">
                <FaRobot className="text-xl" />
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-status-success rounded-full ring-1 ring-surface" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  AuctionX Assistant
                </h3>
                <p className="text-[11px] text-foreground-muted flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-status-success rounded-full inline-block" />
                  Context-Aware Support • 24/7
                </p>
              </div>
            </div>

            {/* Header Action Controls */}
            <div className="flex items-center gap-1">
              {/* Audio stop */}
              {isSpeaking && (
                <button
                  onClick={stopSpeaking}
                  aria-label="Stop audio readout"
                  className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost text-action-primary animate-pulse"
                  title="Stop speaking"
                >
                  <FaVolumeMute />
                </button>
              )}

              {/* New Chat Button */}
              {isAuthenticated && (
                <button
                  onClick={handleStartNewChat}
                  aria-label="Start new chat"
                  className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost text-foreground-muted hover:text-foreground"
                  title="New Conversation"
                >
                  <FaPlus className="text-xs" />
                </button>
              )}

              {/* History Toggle */}
              {isAuthenticated && (
                <button
                  onClick={() => {
                    soundManager.playClick();
                    setShowHistory(!showHistory);
                  }}
                  aria-label="Toggle chat history"
                  className={`btn-canonical btn-canonical-icon-sm btn-canonical-ghost ${
                    showHistory ? "text-action-primary bg-action-primary/10" : "text-foreground-muted hover:text-foreground"
                  }`}
                  title="Chat History"
                >
                  <FaHistory className="text-xs" />
                </button>
              )}

              {/* Fullscreen Toggle */}
              <button
                onClick={() => {
                  soundManager.playClick();
                  setIsFullscreen(!isFullscreen);
                }}
                aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost text-foreground-muted hover:text-foreground"
                title={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
              >
                {isFullscreen ? <FaCompress /> : <FaExpand />}
              </button>

              {/* Close Button */}
              <button
                onClick={() => {
                  soundManager.playClick();
                  setIsOpen(false);
                }}
                aria-label="Close chat"
                className="btn-canonical btn-canonical-icon-sm btn-canonical-ghost text-foreground-muted hover:text-foreground"
                title="Close (Esc)"
              >
                <FaTimes />
              </button>
            </div>
          </div>

          {/* History Drawer Overlay */}
          {showHistory && (
            <div className="absolute inset-x-0 top-[57px] bottom-0 z-20 bg-surface/95 backdrop-blur-md p-4 flex flex-col border-b border-border-subtle animate-fadeIn">
              <div className="flex items-center justify-between pb-3 border-b border-border-subtle">
                <span className="text-xs font-semibold uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
                  <FaHistory className="text-xs" /> Past Conversations
                </span>
                <div className="flex items-center gap-2">
                  {historyList.length > 0 && (
                    <button
                      onClick={handleClearAllHistory}
                      className="text-[11px] text-status-danger hover:underline flex items-center gap-1"
                    >
                      <FaTrash className="text-[10px]" /> Clear All
                    </button>
                  )}
                  <button
                    onClick={() => setShowHistory(false)}
                    className="p-1 rounded text-foreground-muted hover:text-foreground"
                  >
                    <FaTimes className="text-xs" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto py-2 space-y-1.5">
                {isLoadingHistory ? (
                  <div className="py-8 text-center text-xs text-foreground-muted">
                    Loading conversations...
                  </div>
                ) : historyList.length === 0 ? (
                  <div className="py-8 text-center text-xs text-foreground-muted">
                    No past conversations found.
                  </div>
                ) : (
                  historyList.map((conv) => (
                    <button
                      key={conv.conversationId}
                      onClick={() => handleSelectConversation(conv.conversationId)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${
                        conv.conversationId === conversationId
                          ? "bg-action-primary/10 border-action-primary/30 text-foreground"
                          : "bg-surface-raised border-border-subtle hover:border-border-default text-foreground-secondary hover:text-foreground"
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-medium">
                        <span className="truncate pr-2">{conv.title || "Conversation"}</span>
                        <span className="text-[10px] text-foreground-muted shrink-0">
                          {new Date(conv.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                      {conv.lastMessage && (
                        <p className="text-[11px] text-foreground-muted truncate mt-0.5">
                          {conv.lastMessage.preview}
                        </p>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Chat Body */}
          <div
            ref={chatBodyRef}
            onScroll={handleScroll}
            className="flex-1 p-4 overflow-y-auto space-y-4 bg-canvas/40 text-foreground"
          >
            {/* 1. AUTH GATE: When user is not logged in */}
            {!isAuthenticated ? (
              <div className="py-6 px-4 flex flex-col items-center text-center space-y-4 animate-fadeIn">
                <div className="p-4 rounded-2xl bg-action-primary/10 text-action-primary ring-1 ring-action-primary/20">
                  <FaLock className="text-3xl" />
                </div>
                <div className="space-y-1.5 max-w-xs">
                  <h4 className="text-base font-bold text-foreground">Sign In for AI Support</h4>
                  <p className="text-xs text-foreground-secondary leading-relaxed">
                    Authenticate to unlock personalized assistance for your bids, orders, wallet, and account settings.
                  </p>
                </div>

                <div className="flex flex-col w-full gap-2 pt-2 max-w-xs">
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setIsOpen(false);
                      navigate("/login");
                    }}
                    className="w-full py-2.5 px-4 rounded-xl bg-action-primary text-action-primary-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all flex items-center justify-center gap-2 shadow-xs"
                  >
                    <FaSignInAlt className="text-sm" /> Sign In to AuctionX
                  </button>
                  <button
                    onClick={() => {
                      soundManager.playClick();
                      setIsOpen(false);
                      navigate("/login");
                    }}
                    className="w-full py-2.5 px-4 rounded-xl border border-border-default hover:bg-surface-raised text-foreground text-xs font-semibold active:scale-95 transition-all flex items-center justify-center gap-2"
                  >
                    <FaUserPlus className="text-sm" /> Create Account
                  </button>
                </div>

                {/* Popular Topics Preview for Unauthenticated Guests */}
                <div className="w-full pt-4 border-t border-border-subtle text-left space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-muted flex items-center gap-1.5">
                    <FaRegLightbulb className="text-xs text-action-primary" /> Supported Topics
                  </span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {suggestedTopics.slice(0, 4).map((topic) => (
                      <div
                        key={topic.id}
                        className="p-2 rounded-lg bg-surface border border-border-subtle text-[11px] text-foreground-secondary flex items-center gap-1.5"
                      >
                        <span>{topic.icon}</span>
                        <span className="truncate">{topic.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Initial Welcome message */}
                <div className="flex items-start gap-2.5">
                  <div className="p-1.5 rounded-lg bg-action-primary/10 text-action-primary shrink-0 mt-0.5">
                    <FaRobot className="text-sm" />
                  </div>
                  <div className="bg-surface border border-border-subtle rounded-2xl rounded-tl-xs p-3.5 shadow-xs max-w-[88%] text-xs sm:text-sm leading-relaxed">
                    <p className="font-semibold text-foreground mb-1">
                      Hello, {userName}! How can I assist you with AuctionX?
                    </p>
                    <p className="text-foreground-secondary text-xs">
                      Ask about live auctions, scheduled bids, payment settlements, seller tools, or explore suggested topics below.
                    </p>
                  </div>
                </div>

                {/* Suggested Topic Chips (shown when no messages yet) */}
                {messages.length === 0 && (
                  <div className="pt-2 space-y-2">
                    <p className="text-[11px] font-semibold text-foreground-muted uppercase tracking-wider px-1 flex items-center gap-1.5">
                      <FaRegLightbulb className="text-action-primary text-xs" /> Suggested Topics
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {suggestedTopics.map((topic) => (
                        <button
                          key={topic.id}
                          onClick={() => handleSendMessage(topic.query)}
                          className="flex items-center gap-2 p-2.5 rounded-xl border border-border-subtle bg-surface hover:bg-surface-raised hover:border-action-primary/40 text-left transition-all group"
                        >
                          <span className="text-base group-hover:scale-110 transition-transform">
                            {topic.icon}
                          </span>
                          <span className="text-xs font-medium text-foreground group-hover:text-action-primary truncate">
                            {topic.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conversation Messages */}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex flex-col ${
                      msg.type === "user" ? "items-end" : "items-start"
                    }`}
                  >
                    <div
                      className={`flex items-end gap-2 max-w-[88%] ${
                        msg.type === "user" ? "flex-row-reverse" : "flex-row"
                      }`}
                    >
                      {msg.type === "bot" && (
                        <div className="p-1.5 rounded-lg bg-action-primary/10 text-action-primary shrink-0 mb-1">
                          <FaRobot className="text-xs" />
                        </div>
                      )}

                      <div
                        className={`p-3.5 rounded-2xl shadow-xs text-xs sm:text-sm leading-relaxed break-words ${
                          msg.type === "user"
                            ? "bg-action-primary text-action-primary-foreground rounded-br-xs"
                            : "bg-surface border border-border-subtle text-foreground rounded-bl-xs"
                        }`}
                      >
                        <p>{msg.text}</p>

                        {/* Navigation Action Buttons if present */}
                        {msg.type === "bot" && msg.actions && msg.actions.length > 0 && (
                          <div className="mt-3 pt-2.5 border-t border-border-subtle flex flex-wrap gap-1.5">
                            {msg.actions.map((act, actIdx) => (
                              <button
                                key={actIdx}
                                onClick={() => handleActionClick(act)}
                                className="px-3 py-1.5 rounded-lg bg-action-primary/10 hover:bg-action-primary text-action-primary hover:text-action-primary-foreground text-xs font-medium transition-all flex items-center gap-1.5 shadow-2xs group"
                              >
                                <span>{act.label}</span>
                                <FaArrowRight className="text-[10px] group-hover:translate-x-0.5 transition-transform" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Message Footer: Timestamp, TTS, Feedback */}
                    <div
                      className={`flex items-center gap-3 mt-1 px-1 text-[10px] text-foreground-muted ${
                        msg.type === "user" ? "justify-end" : "justify-start pl-8"
                      }`}
                    >
                      <span>{formatMessageTime(msg.time)}</span>

                      {msg.type === "bot" && (
                        <>
                          {/* Speak Button */}
                          <button
                            onClick={() => speakText(msg.text, idx)}
                            aria-label="Read message aloud"
                            className={`hover:text-action-primary transition-colors flex items-center gap-1 ${
                              speakingMessageIndex === idx
                                ? "text-action-primary font-semibold"
                                : ""
                            }`}
                          >
                            <FaVolumeUp className="text-[10px]" />
                            <span>{speakingMessageIndex === idx ? "Speaking..." : "Read"}</span>
                          </button>

                          {/* Feedback Thumbs */}
                          <div className="flex items-center gap-1.5 border-l border-border-subtle pl-2">
                            <button
                              onClick={() => handleFeedback(idx, "positive")}
                              aria-label="Helpful"
                              title="Helpful"
                              className={`p-0.5 rounded hover:text-status-success transition-colors ${
                                msg.feedback === "positive"
                                  ? "text-status-success font-bold"
                                  : "text-foreground-muted"
                              }`}
                            >
                              <FaThumbsUp className="text-[10px]" />
                            </button>
                            <button
                              onClick={() => handleFeedback(idx, "negative")}
                              aria-label="Not helpful"
                              title="Not helpful"
                              className={`p-0.5 rounded hover:text-status-danger transition-colors ${
                                msg.feedback === "negative"
                                  ? "text-status-danger font-bold"
                                  : "text-foreground-muted"
                              }`}
                            >
                              <FaThumbsDown className="text-[10px]" />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}

                {/* Real-time typing bubble */}
                {isTyping && (
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-action-primary/10 text-action-primary shrink-0 mt-0.5">
                      <FaRobot className="text-sm" />
                    </div>
                    <div className="bg-surface border border-border-subtle rounded-2xl rounded-tl-xs p-3.5 shadow-xs max-w-[88%] text-xs sm:text-sm leading-relaxed">
                      {typingText ? (
                        <span>{typingText}</span>
                      ) : (
                        <div className="flex items-center gap-1.5 py-1">
                          <span
                            className="w-2 h-2 rounded-full bg-action-primary/60 animate-bounce"
                            style={{ animationDelay: "0ms" }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-action-primary/60 animate-bounce"
                            style={{ animationDelay: "150ms" }}
                          />
                          <span
                            className="w-2 h-2 rounded-full bg-action-primary/60 animate-bounce"
                            style={{ animationDelay: "300ms" }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Cooldown / Error Notice */}
                {rateLimitCooldown > 0 && (
                  <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <FaClock className="text-sm shrink-0 animate-spin" />
                    <span>Rate limit active. Please wait {rateLimitCooldown}s before next query.</span>
                  </div>
                )}

                {errorMessage && rateLimitCooldown === 0 && (
                  <div className="p-3 rounded-xl bg-status-danger/10 border border-status-danger/30 text-status-danger text-xs flex items-center gap-2">
                    <FaExclamationCircle className="text-sm shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area (Only active if authenticated) */}
          {isAuthenticated && (
            <form
              onSubmit={handleFormSubmit}
              className="p-3 bg-surface-raised border-t border-border-subtle shrink-0"
            >
              <div className="flex items-center gap-2">
                <div className="flex-1 relative">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userQuery}
                    maxLength={MAX_INPUT_CHARS}
                    onChange={(e) => setUserQuery(e.target.value)}
                    placeholder={
                      rateLimitCooldown > 0
                        ? `Cooldown active (${rateLimitCooldown}s)...`
                        : "Ask about auctions, bidding, payments..."
                    }
                    disabled={isTyping || rateLimitCooldown > 0}
                    className="w-full px-3.5 py-2.5 pr-14 rounded-xl bg-surface border border-border-default text-xs sm:text-sm text-foreground placeholder:text-foreground-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                  />
                  {userQuery.length > 300 && (
                    <span
                      className={`absolute right-3 top-1/2 -translate-y-1/2 text-[10px] ${
                        userQuery.length >= MAX_INPUT_CHARS ? "text-status-danger font-bold" : "text-foreground-muted"
                      }`}
                    >
                      {MAX_INPUT_CHARS - userQuery.length}
                    </span>
                  )}
                </div>

                {/* Voice Input */}
                <button
                  type="button"
                  onClick={startListening}
                  disabled={isTyping || rateLimitCooldown > 0}
                  aria-label="Voice input"
                  title="Voice input"
                  className={`p-2.5 rounded-xl border border-border-subtle transition-colors shrink-0 ${
                    isListening
                      ? "bg-status-danger text-white animate-pulse"
                      : "bg-surface hover:bg-surface-raised text-foreground-muted hover:text-foreground disabled:opacity-50"
                  }`}
                >
                  <FaMicrophone className="text-sm" />
                </button>

                {/* Send Button */}
                <button
                  type="submit"
                  disabled={!userQuery.trim() || isTyping || rateLimitCooldown > 0}
                  aria-label="Send message"
                  className={`p-2.5 rounded-xl bg-action-primary text-action-primary-foreground shadow-xs transition-opacity shrink-0 ${
                    !userQuery.trim() || isTyping || rateLimitCooldown > 0
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:opacity-90 active:scale-95"
                  }`}
                >
                  <FaPaperPlane className="text-sm" />
                </button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
};

export default ChatQnA;
