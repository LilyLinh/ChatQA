import styles from "./MessageInput.module.css";

export default function MessageInput({ message, onChange, onSend, loading }) {
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!loading) onSend();
    }
  };

  const handleSuggestionClick = (suggestionText) => {
    onChange({ target: { value: suggestionText } });
    // Auto-focus the textarea
    setTimeout(() => {
      const textarea = document.querySelector('textarea[aria-label="Chat message input"]');
      if (textarea) {
        textarea.focus();
      }
    }, 100);
  };

  return (
    <div className={styles.inputContainer}>
      <div className={styles.inputWrapper}>
        <textarea
          className={styles.textarea}
          value={message}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          rows={3}
          placeholder="Ask me about hotels, restaurants, attractions, or anything else about traveling in Ireland..."
          aria-label="Chat message input"
          disabled={loading}
        />
        <div className={styles.actions}>
          <button
            className={styles.suggestionBtn}
            type="button"
            onClick={() => handleSuggestionClick("Show me a romantic 2-day itinerary")}
            disabled={loading}
          >
            💑 Romantic trip
          </button>
          <button
            className={styles.suggestionBtn}
            type="button"
            onClick={() => handleSuggestionClick("Best pubs with live traditional music")}
            disabled={loading}
          >
            🎵 Traditional music
          </button>
          <button
            className={styles.sendBtn}
            onClick={onSend}
            disabled={loading || message.trim().length === 0}
            aria-label="Send message"
            type="button"
          >
            {loading ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Sending...
              </span>
            ) : (
              <span>Send ✈️</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}