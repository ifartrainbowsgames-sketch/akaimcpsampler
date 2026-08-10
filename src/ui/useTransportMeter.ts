import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';

export interface TransportState {
  playing: boolean;
  recording: boolean;
}

/** Poll engine telemetry without re-rendering the whole panel every frame. */
export function useTransportMeter(speakerRef: React.RefObject<HTMLElement | null>) {
  const [transport, setTransport] = useState<TransportState>({ playing: false, recording: false });
  const transportRef = useRef(transport);

  useEffect(() => {
    let raf = 0;
    let lastFrame = 0;
    const loop = (t: number) => {
      // ~30fps is enough for meter LED + transport buttons on tablet.
      if (t - lastFrame >= 32) {
        lastFrame = t;
        const level = engine.readLevel();
        speakerRef.current?.classList.toggle('speaker--on', level > 0.05);

        const playing = engine.telemetry.playing;
        const recording = engine.telemetry.recording;
        const prev = transportRef.current;
        if (playing !== prev.playing || recording !== prev.recording) {
          const next = { playing, recording };
          transportRef.current = next;
          setTransport(next);
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [speakerRef]);

  return transport;
}
