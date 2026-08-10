export interface LibrarySound {
  id: string;
  name: string;
  duration: number;
  provider: string;
  author?: string;
  license?: string;
  previewUrl: string;
}

export interface LibraryProvider {
  id: string;
  name: string;
  description: string;
  /** Whether the site proxy has a key configured (checked at runtime). */
  needsUserKey?: boolean;
}

export interface LibrarySearchResult {
  sounds: LibrarySound[];
  page: number;
  numPages: number;
  count: number;
}

export const LIBRARY_PRESETS = [
  { label: 'Kick', query: 'kick drum', filter: 'tag:drum duration:[0 TO 3]' },
  { label: 'Snare', query: 'snare', filter: 'tag:drum duration:[0 TO 3]' },
  { label: 'Hi-Hat', query: 'hi hat', filter: 'tag:drum duration:[0 TO 2]' },
  { label: 'Clap', query: 'clap', filter: 'duration:[0 TO 2]' },
  { label: '808 Bass', query: '808 bass', filter: 'duration:[0 TO 4]' },
  { label: 'Perc', query: 'percussion loop', filter: 'duration:[0 TO 5]' },
  { label: 'FX', query: 'sound effect', filter: 'duration:[0 TO 5]' },
  { label: 'Vocal', query: 'vocal chop', filter: 'duration:[0 TO 5]' },
  { label: 'Loop', query: 'drum loop', filter: 'duration:[8 TO 20]' },
  { label: 'Beat', query: 'hip hop beat loop', filter: 'duration:[15 TO 45]' },
  { label: 'Song', query: 'instrumental music loop', filter: 'duration:[30 TO 90]' },
] as const;
