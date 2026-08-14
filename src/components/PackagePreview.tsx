import { asset, cupAssets, toastAsset, toppingAssets } from "../data/assets";
import type { ActivityKey, CafePackage, PackageActivities } from "../types";

interface PackagePreviewProps {
  selected: ActivityKey[];
  activities: PackageActivities;
  compact?: boolean;
  media?: Partial<Record<ActivityKey, string>>;
}

export function PackagePreview({
  selected,
  activities,
  compact = false,
  media,
}: PackagePreviewProps) {
  return (
    <div className={`package-preview ${compact ? "compact" : ""}`}>
      {selected.map((key) => (
        <article className="preview-card" key={key}>
          <h3>{key === "nameTag" ? "name tag" : key}</h3>
          {key === "latte" && (
            <img src={media?.latte ?? activities.latte.snapshot ?? cupAssets[activities.latte.drink]} alt={`${activities.latte.drink} latte art`} />
          )}
          {key === "tart" && (
            <div className="mini-tart">
              <img src={asset("tart/plain-custard-tart.png")} alt="Decorated tart" />
              {activities.tart.toppings.map((item) => (
                <img
                  key={item.id}
                  className="placed-topping"
                  src={toppingAssets[item.kind]}
                  alt=""
                  style={{
                    left: `${item.x * 100}%`,
                    top: `${item.y * 100}%`,
                    transform: `translate(-50%, -50%) rotate(${item.rotation ?? 0}deg) scale(${item.scale ?? 1})`,
                  }}
                />
              ))}
            </div>
          )}
          {key === "toast" && (
            <img
              className={activities.toast.filling === "egg" && activities.toast.toasted ? "toasted-egg" : ""}
              src={toastAsset(activities.toast.shape, activities.toast.filling, activities.toast.toasted)}
              alt={`${activities.toast.shape} toast`}
            />
          )}
          {key === "letter" && <div className="mini-letter">{activities.letter.body}</div>}
          {key === "watercolor" && activities.watercolor.snapshot && <img src={media?.watercolor ?? activities.watercolor.snapshot} alt="Watercolor painting" />}
          {key === "nameTag" && (
            <div className={`hand-tag hand-tag--${activities.nameTag.style} preview-tag`}>
              <span>for:</span>
              {activities.nameTag.snapshot && <img src={media?.nameTag ?? activities.nameTag.snapshot} alt="Handwritten name tag" />}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}

export function BagPreview({ state, packed = false }: { state: CafePackage; packed?: boolean }) {
  return (
    <div className={`bag-preview bag-${state.bag.color} ${packed ? "packed" : ""}`}>
      <div className="bag-items">
        {state.selected.slice(0, 4).map((key, index) => (
          <span key={key} style={{ "--item": index } as React.CSSProperties}>{key}</span>
        ))}
      </div>
      <img src={asset("packaging/paper-bag-brown.png")} alt={`${state.bag.color} paper bag`} />
      {state.selected.includes("nameTag") && (
        <div className={`bag-tag hand-tag--${state.activities.nameTag.style}`}>
          {state.activities.nameTag.snapshot && <img src={state.activities.nameTag.snapshot} alt="" />}
        </div>
      )}
    </div>
  );
}
