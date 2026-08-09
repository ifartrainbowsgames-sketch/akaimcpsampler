/** Vertical volume and pan meters flanking the sample waveform (MPC Sample LCD). */

function volHeight(gainDb: number): number {
  if (gainDb <= -74) return 0;
  return Math.max(0, Math.min(100, ((gainDb + 74) / 80) * 100));
}

function panMarker(pan: number): number {
  return Math.max(0, Math.min(100, ((pan + 1) / 2) * 100));
}

export function VolumeMeter({ gain }: { gain: number }) {
  const vol = volHeight(gain);
  return (
    <div className="lcdmeters lcdmeters--side" aria-hidden>
      <div className="lcdmeter" title="Volume">
        <div className="lcdmeter__track">
          <i style={{ height: `${vol}%` }} />
        </div>
        <span>VOL</span>
      </div>
    </div>
  );
}

export function PanMeter({ pan }: { pan: number }) {
  const panPos = panMarker(pan);
  return (
    <div className="lcdmeters lcdmeters--side" aria-hidden>
      <div className="lcdmeter" title="Pan">
        <div className="lcdmeter__track lcdmeter__track--pan">
          <i className="lcdmeter__center" />
          <i className="lcdmeter__pan" style={{ bottom: `${panPos}%` }} />
        </div>
        <span>PAN</span>
      </div>
    </div>
  );
}
