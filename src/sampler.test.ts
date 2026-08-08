import { describe, expect, it } from "vitest";

import { MAX_VELOCITY, PAD_COUNT, Sampler, SamplerError } from "./sampler.js";

describe("Sampler", () => {
  it("ships a default kit with a sample on every-ish pad", () => {
    const s = new Sampler();
    expect(s.listSamples().length).toBeGreaterThan(0);
    expect(s.listPads()).toHaveLength(PAD_COUNT);
    expect(s.listPads()[0].sampleId).toBe("kick");
  });

  it("triggers a pad and scales gain by velocity", () => {
    const s = new Sampler();
    const full = s.trigger(1, MAX_VELOCITY);
    expect(full.sampleId).toBe("kick");
    expect(full.effectiveGain).toBeCloseTo(0.8, 5);

    const half = s.trigger(1, Math.round(MAX_VELOCITY / 2));
    expect(half.effectiveGain).toBeLessThan(full.effectiveGain);
  });

  it("hands out monotonically increasing voice ids", () => {
    const s = new Sampler();
    const a = s.trigger(1);
    const b = s.trigger(2);
    expect(b.voiceId).toBe(a.voiceId + 1);
  });

  it("rejects invalid pad indexes and velocities", () => {
    const s = new Sampler();
    expect(() => s.trigger(0)).toThrow(SamplerError);
    expect(() => s.trigger(PAD_COUNT + 1)).toThrow(SamplerError);
    expect(() => s.trigger(1, 999)).toThrow(SamplerError);
  });

  it("refuses to trigger an empty pad", () => {
    const s = new Sampler();
    expect(() => s.trigger(PAD_COUNT)).toThrow(/empty/i);
  });

  it("adds samples and assigns them to pads", () => {
    const s = new Sampler();
    s.addSample({ id: "vox", name: "Vocal Ahh", filename: "vox.wav", durationMs: 800 });
    const pad = s.assignPad(PAD_COUNT, "vox", { gain: 0.5, tuneSemitones: 3 });
    expect(pad.sampleId).toBe("vox");
    expect(pad.gain).toBe(0.5);
    expect(pad.tuneSemitones).toBe(3);

    const event = s.trigger(PAD_COUNT, MAX_VELOCITY);
    expect(event.sampleName).toBe("Vocal Ahh");
    expect(event.tuneSemitones).toBe(3);
  });

  it("rejects duplicate sample ids and unknown assignments", () => {
    const s = new Sampler();
    expect(() => s.addSample({ id: "kick", name: "x", filename: "x.wav", durationMs: 10 })).toThrow(
      SamplerError,
    );
    expect(() => s.assignPad(1, "does-not-exist")).toThrow(SamplerError);
  });
});
