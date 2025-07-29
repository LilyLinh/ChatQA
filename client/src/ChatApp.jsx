import { useState, useEffect, useRef } from "react";
import ChatBubble from "./ChatBubble";
import FavoritesPanel from "./FavoritesPanel";
import ControlsPanel from "./ControlsPanel";
import MessageInput from "./MessageInput";
import ReportModal from "./ReportModal";

import styles from "./ChatApp.module.css";

const DEFAULT_FAVORITES = ["AAPL", "TSLA", "MSFT"];

export default function ChatApp() {
  const [chat, setChat] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("chatHistory")) || [];
    } catch {
      return [];
    }
  });
  const [message, setMessage] = useState("");
  const [lang, setLang] = useState("auto");
  const [loading, setLoading] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("favoriteStocks")) || DEFAULT_FAVORITES;
    } catch {
      return DEFAULT_FAVORITES;
    }
  });
  const [stockPrices, setStockPrices] = useState({});

  const chatContainerRef = useRef(null);

  // Scroll to bottom & save chat history on chat update
  useEffect(() => {
    try {
      localStorage.setItem("chatHistory", JSON.stringify(chat));
    } catch {}

    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chat]);

  // Save favorites to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("favoriteStocks", JSON.stringify(favorites));
    } catch {}
  }, [favorites]);

  // Fetch stock prices when favorites change
  useEffect(() => {
    if (favorites.length === 0) {
      setStockPrices({});
      return;
    }

    async function fetchPrices() {
      try {
        const prices = await Promise.all(
          favorites.map(async (symbol) => {
            const res = await fetch(`http://localhost:5000/api/stocks/${symbol}`);
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            return { symbol, price: data.currentPrice ?? null };
          })
        );

        const pricesObj = {};
        prices.forEach(({ symbol, price }) => {
          pricesObj[symbol] = price;
        });
        setStockPrices(pricesObj);
      } catch (error) {
        console.error("Error fetching stock prices:", error);
        setStockPrices({});
      }
    }

    fetchPrices();
  }, [favorites]);

  // Theme state and persistence
  const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

  useEffect(() => {
    document.body.dataset.theme = theme; // For CSS [data-theme="dark"] selectors
    try {
      localStorage.setItem("theme", theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  // Send message handler with streaming support
  const sendMessage = async (overrideMessages) => {
    const msgs = overrideMessages || chat;
    if (!message.trim() && !overrideMessages) return;

    const userMessage = overrideMessages ? null : { role: "user", content: message };
    const updatedChat = userMessage ? [...msgs, userMessage] : msgs;

    if (!overrideMessages) {
      setChat(updatedChat);
      setMessage("");
    }

    setLoading(true);

    // Add assistant placeholder for streaming text
    setChat((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updatedChat, userLang: lang }),
      });

      if (!res.body) throw new Error("ReadableStream not supported or response body empty");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantReply = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantReply += decoder.decode(value, { stream: true });

        setChat((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantReply,
          };
          return updated;
        });
      }
    } catch (err) {
      console.error("Chat API error:", err);
      setChat((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const clearChat = () => {
    setChat([]);
    try {
      localStorage.removeItem("chatHistory");
    } catch {}
  };

  const addFavorite = () => {
    const symbol = prompt("Enter stock symbol (e.g. AAPL):");
    if (symbol) {
      const formatted = symbol.trim().toUpperCase();
      if (!favorites.includes(formatted)) {
        setFavorites([...favorites, formatted]);
      } else {
        alert("Already in favorites.");
      }
    }
  };

  const removeFavorite = (symbol) => {
    setFavorites(favorites.filter((s) => s !== symbol));
  };

  const askTradeAdvice = (symbol) => {
    const price = stockPrices[symbol];
    if (!price) return alert("Price not available.");

    const prompt = `Based on the last 6 months of historical data, is the current price of ${symbol} at $${price} a good time to buy? Provide a brief analysis for an investor.`;
    sendMessage([...chat, { role: "user", content: prompt }]);
  };

  const handleReportSubmit = (reportData) => {
    console.log("Report submitted:", reportData);
    setShowReportModal(false);
  };

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1>Stock AI</h1>
        <button
          onClick={toggleTheme}
          aria-label="Toggle light/dark theme"
          className={styles.themeToggle}
          type="button"
        >
          {theme === "light" ? "🌞 Light" : "🌙 Dark"}
        </button>
      </header>

      {/* Controls */}
      <div className={styles.controls}>
       <ControlsPanel
        lang={lang}
        onLangChange={setLang}
        onClear={clearChat}
        stockName={favorites[0]}          // <-- add this
        stockPrice={stockPrices[favorites[0]]}
        onGetAdvice={() => askTradeAdvice(favorites[0])}
        onCancel={() => alert("Cancelled.")}
        loading={loading}
       />
      </div>

      {/* Main layout */}
      <main className={styles.main}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <h2>⭐ Favorites</h2>
          <FavoritesPanel
            favorites={favorites}
            stockPrices={stockPrices}
            onAdd={addFavorite}
            onRemove={removeFavorite}
            onAskAdvice={askTradeAdvice}
          />
        </aside>

        {/* Chat Section */}
        <section className={styles.chatSection}>
          <div
            ref={chatContainerRef}
            className={styles.chatContainer}
            aria-live="polite"
            aria-atomic="false"
          >
            {chat.length === 0 ? (
              <p className={styles.chatPlaceholder}>
                Ask me anything about US stocks...
              </p>
            ) : (
              chat.map(({ role, content }, idx) => (
                <ChatBubble key={idx} role={role} content={content} />
              ))
            )}
          </div>

          <div className={styles.inputSection}>
            <MessageInput
              message={message}
              onChange={(e) => setMessage(e.target.value)}
              onSend={() => sendMessage()}
              loading={loading}
            />
          </div>
        </section>
      </main>

      <footer className={styles.footer}>
        <button
          className={styles.reportButton}
          onClick={() => setShowReportModal(true)}
          type="button"
        >
          Report Issue
        </button>
      </footer>

      {showReportModal && (
        <ReportModal
          show={showReportModal}
          onClose={() => setShowReportModal(false)}
          onSubmit={handleReportSubmit}
        />
      )}
    </div>
  );
}
