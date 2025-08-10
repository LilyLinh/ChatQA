import { useState, useEffect } from "react";
import styles from "./ReportModal.module.css";

export default function ReportModal({ show, onClose, onSubmit }) {
  const [reportText, setReportText] = useState("");

  useEffect(() => {
    if (show) setReportText("");
  }, [show]);

  if (!show) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (reportText.trim().length === 0) return alert("Please enter details.");
    onSubmit(reportText.trim());
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h3>Report an Issue</h3>
          <button
            type="button"
            className={styles.closeBtn}
            aria-label="Close"
            onClick={onClose}
          >
            ×
          </button>
        </div>
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formBody}>
            <textarea
              className={styles.textarea}
              rows={5}
              value={reportText}
              onChange={(e) => setReportText(e.target.value)}
              placeholder="Describe the issue or provide feedback here..."
              required
            />
          </div>
          <div className={styles.formFooter}>
            <button
              type="button"
              className={styles.secondaryBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className={styles.primaryBtn}>
              Submit Report
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}