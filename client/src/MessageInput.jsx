export default function MessageInput({ message, onChange, onSend, loading }) {
    const handleKeyDown = (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!loading) onSend();
      }
    };
  
    return (
      <>
        <div className="inputWrapper">
          <textarea
            className="textarea"
            value={message}
            onChange={onChange}
            onKeyDown={handleKeyDown}
            rows={2}
            placeholder="Type your message here..."
            aria-label="Chat message input"
            disabled={loading}
          />
          <button
            className="sendButton"
            onClick={onSend}
            disabled={loading || message.trim().length === 0}
            aria-label="Send message"
            type="button"
          >
            {loading ? "Sending..." : "Send"}
          </button>
        </div>
  
        <style jsx>{`
          .inputWrapper {
            display: flex;
            gap: 12px;
            align-items: center;
          }
          .textarea {
            flex: 1;
            resize: none;
            padding: 10px 14px;
            border-radius: 10px;
            border: 1.5px solid #d1d5db;
            font-size: 1rem;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            color: #1f2937;
            transition: border-color 0.2s ease-in-out;
            min-height: 48px;
          }
          .textarea:focus {
            border-color: #4f46e5;
            outline: none;
            box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.5);
          }
          .sendButton {
            background-color: #4f46e5;
            color: white;
            border: none;
            border-radius: 10px;
            padding: 10px 20px;
            font-weight: 700;
            cursor: pointer;
            font-size: 1rem;
            transition: background-color 0.2s ease-in-out;
          }
          .sendButton:disabled {
            background-color: #a5b4fc;
            cursor: not-allowed;
          }
          .sendButton:hover:not(:disabled),
          .sendButton:focus:not(:disabled) {
            background-color: #4338ca;
            outline: none;
            box-shadow: 0 0 0 3px rgba(67, 56, 202, 0.6);
          }
        `}</style>
      </>
    );
  }
  