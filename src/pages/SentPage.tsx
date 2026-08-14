import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { sendPackage } from "../services/packageService";
import { useCafe } from "../state/CafeState";
import { formatDuration, makeReceipt } from "../utils/receipt";

export function SentPage() {
  const { state, dispatch } = useCafe();
  const navigate = useNavigate();
  const [sending, setSending] = useState(false);
  const [torn, setTorn] = useState(Boolean(state.publicSlug));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const receipt = useMemo(() => state.receipt ?? makeReceipt(state), [state]);

  if (state.status === "draft") return <Navigate to="/seal" />;
  const link = state.publicSlug
    ? `${window.location.origin}/open/${state.publicSlug}`
    : "";

  const send = async () => {
    if (sending) return;
    setSending(true);
    setError("");
    try {
      const packageId = state.packageId ?? crypto.randomUUID();
      const result = await sendPackage(state, packageId, receipt);
      dispatch({ type: "receipt", value: receipt });
      dispatch({ type: "remote", packageId, publicSlug: result.publicSlug });
      dispatch({ type: "status", value: "sent" });
      setTorn(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The package could not be sent.");
    } finally {
      setSending(false);
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const share = async () => {
    if (navigator.share) {
      await navigator.share({ title: "A Concept Café blind box for you", url: link });
    } else await copy();
  };

  return (
    <section className="sent-page">
      <header className="page-heading">
        <p className="kicker">{state.publicSlug ? "ready to share" : "one last step"}</p>
        <h1>{state.publicSlug ? "Your blind box is sent" : "Send the little order"}</h1>
        <p>Tear off the receipt and pass the secret link to your friend.</p>
      </header>

      <div className={`receipt-wrap ${torn ? "torn" : ""}`}>
        <article className="receipt" aria-label="Blind box receipt">
          <div className="receipt-brand">CONCEPT CAFÉ</div>
          <div className="receipt-rule">order note · blind box</div>
          <dl>
            <div><dt>to</dt><dd>{receipt.to}</dd></div>
            <div><dt>from</dt><dd>{receipt.from}</dd></div>
          </dl>
          <ul>{receipt.lines.map((line) => <li key={line}><span>{line}</span><span>♡</span></li>)}</ul>
          <div className="receipt-rule" />
          <p>made with care for {formatDuration(receipt.timeSpentSeconds)}</p>
          <time>{new Date(receipt.sentAt).toLocaleString()}</time>
          <div className="barcode" aria-hidden="true" />
        </article>
        {!torn && <button className="tear-handle" onClick={send} disabled={sending}>{sending ? "sending..." : "tear here to send"}</button>}
      </div>

      {error && <p className="error-note">{error}</p>}
      {link && (
        <div className="share-panel">
          <label>secret link<input readOnly value={link} onFocus={(event) => event.currentTarget.select()} /></label>
          <div className="choice-row">
            <button className="primary-button" onClick={copy}>{copied ? "copied!" : "copy link"}</button>
            <button className="secondary-button" onClick={share}>share</button>
            <button className="secondary-button" onClick={() => navigate(`/open/${state.publicSlug}`)}>open it</button>
          </div>
        </div>
      )}
    </section>
  );
}
