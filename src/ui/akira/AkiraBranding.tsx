import { forwardRef } from 'react';

type Variant = 'header' | 'deck' | 'boot';

/** Layer 3 — MPC SAMPLE + Japanese title treatment. */
export const AkiraBranding = forwardRef<
  HTMLDivElement,
  { variant?: Variant; className?: string }
>(function AkiraBranding({ variant = 'header', className }, ref) {
  if (variant === 'boot') {
    return (
      <div ref={ref} className={`akira-brand akira-brand--boot ${className ?? ''}`}>
        <h1 className="akira-brand__title">
          <span className="akira-brand__en">MPC SAMPLE</span>
          <span className="akira-brand__jp">エムピーシー・サンプラー</span>
        </h1>
        <p className="akira-brand__tag">ネオ東京 · NEO-TOKYO 1988</p>
      </div>
    );
  }

  if (variant === 'deck') {
    return (
      <div ref={ref} className={`akira-brand akira-brand--deck ${className ?? ''}`} aria-label="MPC SAMPLE">
        <span className="akira-brand__en">MPC</span>
        <span className="akira-brand__en akira-brand__en--sample">SAMPLE</span>
        <span className="akira-brand__jp">サンプラー</span>
      </div>
    );
  }

  return (
    <header ref={ref} className={`akira-brand akira-brand--${variant} ${className ?? ''}`}>
      <div className="akira-brand__bg-kanji" aria-hidden>東京</div>
      <h1 className="akira-brand__title">
        <span className="akira-brand__en">MPC SAMPLE</span>
        <span className="akira-brand__jp">エムピーシー・サンプラー</span>
      </h1>
      <p className="akira-brand__tag">NEO-TOKYO · 1988</p>
    </header>
  );
});
