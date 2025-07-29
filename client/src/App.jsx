import { useState } from "react";

export default function App() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAsk = async () => {
    if (!question.trim()) {
      setAnswer("Please enter a question.");
      return;
    }

    setAnswer("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:5000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: question }],
          userLang: "auto",
        }),
      });

      if (!res.body) {
        setAnswer("No response body");
        setLoading(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullResponse = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        fullResponse += chunk;
        setAnswer(fullResponse);
      }
    } catch (error) {
      setAnswer("Error: " + error.message);
    }

    setLoading(false);
  };

  return (
    <div className="container" style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "Arial, sans-serif" }}>
      <header style={{ fontSize: "1.5rem", marginBottom: "1rem" }}>ChatQA Assistant</header>

      <div className="card" style={{ padding: "1rem", border: "1px solid #ccc", borderRadius: 8 }}>
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Type your question..."
          style={{ width: "100%", padding: "0.5rem", fontSize: "1rem" }}
          onKeyDown={(e) => e.key === "Enter" && handleAsk()}
          disabled={loading}
        />

        <button
          onClick={handleAsk}
          style={{
            marginTop: "1rem",
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: loading ? "not-allowed" : "pointer",
            backgroundColor: "#007bff",
            color: "#fff",
            border: "none",
            borderRadius: 4,
          }}
          disabled={loading}
        >
          {loading ? "Thinking..." : "Ask"}
        </button>

        {answer && (
          <div
            className="response"
            style={{
              marginTop: "1.5rem",
              padding: "1rem",
              backgroundColor: "#f1f1f1",
              borderRadius: 4,
              whiteSpace: "pre-wrap",
              minHeight: "80px",
            }}
          >
            {answer}
          </div>
        )}
      </div>
    </div>
  );
}
