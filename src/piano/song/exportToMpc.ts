import { TICKS_PER_16TH } from '../../audio/types'
import { engine } from '../../audio/engine'
import { useStore } from '../../state/store'
import { history } from '../../state/undo'
import { writeSample } from '../../storage/opfs'
import { generateFactoryKit } from '../../audio/factory/kits'
import { FACTORY_KITS, factoryKitPadDefaults } from '../../audio/factory/catalog'
import type { PianoSong } from './types'
import { songToSeqEvents, totalSongBars } from './mapping'

const DEFAULT_MELODY_KIT = 'melodic-keys-01'

/** Write piano song arrangement into an MPC sequence slot (melodic keys kit). */
export async function exportPianoSongToMpc(
  song: PianoSong,
  bank: number,
  slot: number,
  kitId = DEFAULT_MELODY_KIT,
): Promise<boolean> {
  if (!engine.ctx) await engine.init()
  const ctx = engine.ctx
  if (!ctx) return false

  const events = songToSeqEvents(song.patterns, song.arrangement)
  if (events.length === 0) return false

  const bars = totalSongBars(song.patterns, song.arrangement)
  const store = useStore.getState()
  history.push(store.project)

  const kit = await generateFactoryKit(ctx, kitId)
  if (!kit) return false
  const meta = FACTORY_KITS.find((k) => k.id === kitId)
  const padDefaults = meta ? factoryKitPadDefaults(meta) : null

  let project = store.project
  const bankPads = project.banks[bank].map((pad) => ({ ...pad }))
  for (let i = 0; i < 16; i++) {
    const buffer = kit.buffers[i]
    const id = crypto.randomUUID()
    engine.putBuffer(id, buffer)
    const wav = await engine.bufferToWav(buffer).arrayBuffer()
    await writeSample(id, wav)
    const label = meta?.padNames[i] ?? `Pad ${i + 1}`
    const loopStart = padDefaults?.loop
      ? Math.floor(buffer.length * padDefaults.loopStartRatio)
      : 0
    bankPads[i] = {
      ...bankPads[i],
      sampleId: id,
      sampleName: `${meta?.name ?? kit.name}-${label}`.slice(0, 24),
      start: 0,
      end: buffer.length,
      loopStart,
      loop: padDefaults?.loop ?? false,
      slices: [],
      gain: meta?.defaultGain ?? 0,
      polyphony: padDefaults?.polyphony ?? 'mono',
    }
  }

  const sequences = project.sequences.map((row, bi) =>
    bi === bank
      ? row.map((seq, si) =>
          si === slot
            ? {
                ...seq,
                name: song.name.slice(0, 16),
                bars: Math.max(1, bars),
                events,
                bpm: song.bpm,
              }
            : seq,
        )
      : row,
  )

  const next = {
    ...project,
    bpm: song.bpm,
    banks: project.banks.map((b, bi) => (bi === bank ? bankPads : b)),
    sequences,
  }

  engine.setProject(next)
  engine.setBank(bank)
  engine.setSequenceSlot(slot)
  engine.selectedPad = 0
  useStore.setState({
    project: next,
    bank,
    seqSlot: slot,
    selectedPad: 0,
    screen: 'seq',
    queuedSeqSlot: null,
  })
  store.play(false)
  return true
}

/** 16th-note step duration in ms at given BPM. */
export function stepMs(bpm: number): number {
  return (60_000 / bpm) / 4
}

export { TICKS_PER_16TH }
