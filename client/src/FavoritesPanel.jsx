import React, { useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

export default function FavoritesPanel({
  favorites = [],
  stockPrices = {},
  onAdd,
  onRemove,
  onAskAdvice,
}) {
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [favorites]);

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-3">
       
        <button className="btn btn-primary btn-sm" onClick={onAdd}>
          + Add Stock
        </button>
      </div>

      <div
        ref={scrollRef}
        style={{
          maxHeight: 300,
          overflowY: "auto",
          border: "1px solid #ddd",
          borderRadius: 4,
          padding: "0.25rem",
          width: "100%",
        }}
      >
        <ul className="list-group mb-0">
          {favorites.map((symbol) => (
            <li
              key={symbol}
              className="list-group-item d-flex justify-content-between align-items-center flex-wrap"
              style={{ padding: "0.5rem 1rem" }}
            >
              {/* Removed symbol name div */}
              {/* <div
                style={{
                  flexBasis: "30%",
                  fontWeight: "700",
                  color: "#0d6efd",
                  marginBottom: "0.25rem",
                }}
              >
                {symbol}
              </div> */}

              {/* Instead, maybe show the symbol and price in one div for space */}
              <div style={{ flexBasis: "60%", marginBottom: "0.25rem", fontWeight: "700", color: "#0d6efd" }}>
                {symbol} — {stockPrices[symbol] ? `$${Number(stockPrices[symbol]).toFixed(2)}` : "Loading..."}
              </div>

              <div
                style={{
                  flexBasis: "40%",
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "0.5rem",
                  marginBottom: "0.25rem",
                }}
              >
                <button
                  className="btn btn-sm btn-info text-white"
                  onClick={() => onAskAdvice(symbol)}
                >
                  Advice
                </button>
                <button
                  className="btn btn-sm btn-danger"
                  onClick={() => onRemove(symbol)}
                >
                  &times;
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
