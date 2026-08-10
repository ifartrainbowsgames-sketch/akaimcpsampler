import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../state/store';
import { getGuideTopic } from '../guide/topics';

export function GuideBubble() {
  const topicId = useStore((s) => s.guideTopic);
  const dismissGuide = useStore((s) => s.dismissGuide);
  const guideMode = useStore((s) => s.guideMode);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setExpanded(false);
  }, [topicId]);

  if (!topicId) return null;
  const topic = getGuideTopic(topicId);
  if (!topic) return null;

  const quickTips = topic.tips?.slice(0, 2) ?? [];
  const restTips = topic.tips?.slice(2) ?? [];
  const hasMore =
    !!(topic.body && topic.body !== topic.brief) ||
    restTips.length > 0 ||
    !!(topic.more && topic.more.length > 0);

  return createPortal(
    <>
      <div
        className={`guide-scrim${expanded ? ' guide-scrim--on' : ''}`}
        aria-hidden="true"
        onClick={dismissGuide}
      />
      <div
        className={`guide-pop${expanded ? ' guide-pop--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={topic.title}
        aria-expanded={expanded}
      >
        <div className="guide-pop__chrome">
          <span className="guide-pop__badge">{guideMode ? '◆ GUIDE' : '◆ TIP'}</span>
          <span className="guide-pop__coin">FREE PLAY</span>
          <button type="button" className="guide-pop__x" onClick={dismissGuide} aria-label="Close">
            ✕
          </button>
        </div>

        <h3 className="guide-pop__title">{topic.title}</h3>
        <p className="guide-pop__brief">{topic.brief}</p>

        {!expanded && quickTips.length > 0 && (
          <ul className="guide-pop__quick">
            {quickTips.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        )}

        {expanded && (
          <div className="guide-pop__scroll">
            {topic.body && topic.body !== topic.brief && (
              <p className="guide-pop__body">{topic.body}</p>
            )}
            {topic.tips && topic.tips.length > 0 && (
              <ul className="guide-pop__tips">
                {topic.tips.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
            {topic.more?.map((block) => (
              <section className="guide-pop__block" key={block.heading}>
                <h4>{block.heading}</h4>
                <ul>
                  {block.lines.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="guide-pop__actions">
          {hasMore && (
            <button
              type="button"
              className="guide-pop__more"
              onClick={() => setExpanded((e) => !e)}
              aria-expanded={expanded}
            >
              {expanded ? '▲ LESS' : '▼ MORE'}
            </button>
          )}
          <button type="button" className="guide-pop__ok" onClick={dismissGuide}>
            OK!
          </button>
        </div>

        <div className="guide-pop__blink" aria-hidden>
          INSERT COIN
        </div>
      </div>
    </>,
    document.body,
  );
}

export function GuideBanner() {
  const guideMode = useStore((s) => s.guideMode);
  if (!guideMode) return null;
  return createPortal(
    <div className="guide-banner" role="status">
      <span className="guide-banner__tag">GUIDE</span>
      Tap anything for tips · tap GUIDE again to exit
    </div>,
    document.body,
  );
}
