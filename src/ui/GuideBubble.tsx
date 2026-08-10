import { useStore } from '../state/store';
import { getGuideTopic } from '../guide/topics';

export function GuideBubble() {
  const topicId = useStore((s) => s.guideTopic);
  const dismissGuide = useStore((s) => s.dismissGuide);
  const guideMode = useStore((s) => s.guideMode);

  if (!topicId) return null;
  const topic = getGuideTopic(topicId);
  if (!topic) return null;

  return (
    <div
      className="guide-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={topic.title}
      onClick={dismissGuide}
    >
      <div className="guide-card" onClick={(e) => e.stopPropagation()}>
        <div className="guide-card__hdr">
          <span className="guide-badge">{guideMode ? 'GUIDE' : 'TIP'}</span>
          <button type="button" className="guide-close" onClick={dismissGuide} aria-label="Close">
            ×
          </button>
        </div>
        <h3 className="guide-card__title">{topic.title}</h3>
        <p className="guide-card__body">{topic.body}</p>
        {topic.tips && topic.tips.length > 0 && (
          <ul className="guide-card__tips">
            {topic.tips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}
        <button type="button" className="guide-ok" onClick={dismissGuide}>
          Got it
        </button>
      </div>
    </div>
  );
}

export function GuideBanner() {
  const guideMode = useStore((s) => s.guideMode);
  if (!guideMode) return null;
  return (
    <div className="guide-banner" role="status">
      Guide on — tap any control for help. Tap GUIDE again to play normally.
    </div>
  );
}
