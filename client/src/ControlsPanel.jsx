import React, { useState, useEffect } from "react";

export default function ControlsPanel({
  lang,
  onLangChange,
  onClear,
  stockName,
  stockPrice,
  onGetAdvice,
  onCancel,
  onToggleTheme,
  currentTheme,
}) {
  const [usDateTime, setUsDateTime] = useState("");
  const [ieDateTime, setIeDateTime] = useState("");

  useEffect(() => {
    function updateDateTimes() {
      const now = new Date();

      setUsDateTime(
        now.toLocaleString("en-US", {
          timeZone: "America/New_York",
          hour12: true,
        })
      );

      setIeDateTime(
        now.toLocaleString("en-IE", {
          timeZone: "Europe/Dublin",
          hour12: false,
        })
      );
    }

    updateDateTimes();
    const intervalId = setInterval(updateDateTimes, 1000);
    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="d-flex flex-wrap align-items-center p-3 bg-light rounded shadow-sm my-3 gap-3">
      <div
        className="fw-semibold"
        style={{ minWidth: 180, fontSize: "1.1rem", color: "#374151" }}
      >
        {stockName && stockPrice !== undefined && stockPrice !== null
          ? `${stockName}: $${Number(stockPrice).toFixed(2)}`
          : "No stock selected"}
      </div>

      <div>
        <label htmlFor="langSelect" className="me-2 fw-semibold">
          Language:
        </label>
        <select
          id="langSelect"
          className="form-select form-select-sm d-inline-block"
          style={{ width: 120 }}
          value={lang}
          onChange={(e) => onLangChange(e.target.value)}
        >
          <option value="auto">Auto</option>
          <option value="en">English</option>
          <option value="es">Spanish</option>
          <option value="fr">French</option>
          <option value="de">German</option>
          <option value="zh">Chinese</option>
        </select>
      </div>

      <div className="text-nowrap" style={{ minWidth: 160 }}>
        <small className="text-muted d-block">
          US Time: <strong>{usDateTime}</strong>
        </small>
        <small className="text-muted d-block">
          IE Time: <strong>{ieDateTime}</strong>
        </small>
      </div>

      <button
        type="button"
        className="btn btn-outline-danger btn-sm fw-semibold"
        onClick={onClear}
      >
        Clear Chat
      </button>

      <button
        type="button"
        className="btn btn-primary btn-sm fw-semibold"
        onClick={onGetAdvice}
      >
        Get Advice
      </button>

      <button
        type="button"
        className="btn btn-danger btn-sm fw-semibold"
        onClick={onCancel}
      >
        Cancel
      </button>
    </div>
  );
}
