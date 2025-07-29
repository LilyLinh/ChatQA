export default function ChatBubble({ role, content }) {
    const isUser = role === "user";
  
    return (
      <>
        <div
          className={`bubble ${isUser ? "userBubble" : "assistantBubble"}`}
          role={isUser ? "article" : "note"}
          aria-label={isUser ? "User message" : "Assistant message"}
        >
          <p className="message">{content}</p>
        </div>
  
        <style jsx>{`
          .bubble {
            max-width: 75%;
            padding: 14px 18px;
            margin-bottom: 12px;
            border-radius: 18px;
            word-break: break-word;
            line-height: 1.5;
            font-size: 1rem;
            box-shadow: 0 2px 5px rgb(0 0 0 / 0.05);
            display: flex;
          }
          .userBubble {
            background-color: #4f46e5;
            color: white;
            align-self: flex-end;
            border-bottom-right-radius: 4px;
            justify-content: flex-end;
          }
          .assistantBubble {
            background-color: #e0e7ff;
            color: #1e293b;
            align-self: flex-start;
            border-bottom-left-radius: 4px;
            justify-content: flex-start;
          }
          .message {
            margin: 0;
          }
        `}</style>
      </>
    );
  }
  