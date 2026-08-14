import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { BagPreview, PackagePreview } from "../components/PackagePreview";
import { openPackage } from "../services/packageService";
import type { CafePackage, PublicPackage } from "../types";
import { formatDuration } from "../utils/receipt";

export function OpenPage() {
  const { slug = "" } = useParams();
  const [gift, setGift] = useState<PublicPackage | null>(null);
  const [error, setError] = useState("");
  const [opened, setOpened] = useState(false);

  useEffect(() => {
    let active = true;
    openPackage(slug)
      .then((value) => active && setGift(value))
      .catch((cause) => active && setError(cause instanceof Error ? cause.message : "This blind box could not be opened."));
    return () => {
      active = false;
    };
  }, [slug]);

  if (error) {
    return <section className="empty-state"><p className="kicker">hmm...</p><h1>That box is hiding</h1><p>{error}</p></section>;
  }
  if (!gift) {
    return <section className="empty-state"><div className="loader-flower" /><h1>Finding your blind box...</h1></section>;
  }

  const bagState = {
    ...gift,
    startedAt: gift.receipt.sentAt,
    activeSeconds: gift.receipt.timeSpentSeconds,
  } as CafePackage;

  return (
    <section className={`open-page ${opened ? "opened" : ""}`}>
      <header className="page-heading">
        <p className="kicker">special delivery for {gift.bag.to}</p>
        <h1>{opened ? "A tiny café made this for you" : "Your blind box is here"}</h1>
        <p>From {gift.bag.from}, made slowly for {formatDuration(gift.receipt.timeSpentSeconds)}.</p>
      </header>
      {!opened ? (
        <button className="open-bag-button" onClick={() => setOpened(true)}>
          <BagPreview state={bagState} packed />
          <span>tap to open</span>
        </button>
      ) : (
        <div className="unpacked">
          <PackagePreview selected={gift.selected} activities={gift.activities} media={gift.media} />
          <article className="recipient-note">
            <p>order note</p>
            <strong>to {gift.receipt.to}</strong>
            <span>with love from {gift.receipt.from}</span>
          </article>
        </div>
      )}
    </section>
  );
}
