import ReactMarkdown from "react-markdown";
import styles from "./ChatBubble.module.css";

export default function ChatBubble({ role, content }) {
  const isUser = role === "user";
  
  return (
    <div className={`${styles.bubble} ${isUser ? styles.userBubble : styles.assistantBubble}`}>
      <div className={styles.content}>
        {isUser ? (
          <p className={styles.message}>{content}</p>
        ) : (
          <div className={styles.markdown}>
            <ReactMarkdown
              components={{
                a: ({ href, children }) => (
                  <a href={href} target="_blank" rel="noopener noreferrer" className={styles.link}>
                    {children}
                  </a>
                ),
                h1: ({ children }) => <h1 className={styles.h1}>{children}</h1>,
                h2: ({ children }) => <h2 className={styles.h2}>{children}</h2>,
                h3: ({ children }) => <h3 className={styles.h3}>{children}</h3>,
                ul: ({ children }) => <ul className={styles.ul}>{children}</ul>,
                ol: ({ children }) => <ol className={styles.ol}>{children}</ol>,
                li: ({ children }) => <li className={styles.li}>{children}</li>,
                p: ({ children }) => <p className={styles.p}>{children}</p>,
                code: ({ children }) => <code className={styles.code}>{children}</code>,
                strong: ({ children }) => <strong className={styles.strong}>{children}</strong>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        )}
      </div>
      {!isUser && (
        <div className={styles.avatar}>
          🇮🇪
        </div>
      )}
    </div>
  );
}