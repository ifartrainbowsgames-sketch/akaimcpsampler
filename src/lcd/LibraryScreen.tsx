import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { LIBRARY_PRESETS } from '../library/types';
import { checkFreesoundProxy } from '../library/freesound';
import {
  getFreesoundApiKey,
  hasFreesoundApiKey,
  setFreesoundApiKey,
  usingBuiltInFreesoundKey,
} from '../storage/libraryKeys';

export function LibraryScreen() {
  const setScreen = useStore((s) => s.setScreen);
  const searchLibrary = useStore((s) => s.searchLibrary);
  const loadLibrarySound = useStore((s) => s.loadLibrarySound);
  const checkLibraryProxy = useStore((s) => s.checkLibraryProxy);
  const results = useStore((s) => s.libraryResults);
  const page = useStore((s) => s.libraryPage);
  const numPages = useStore((s) => s.libraryNumPages);
  const query = useStore((s) => s.libraryQuery);
  const error = useStore((s) => s.libraryError);
  const loading = useStore((s) => s.libraryLoading);
  const proxyReady = useStore((s) => s.libraryProxyReady);

  const [input, setInput] = useState('kick drum');
  const [apiKey, setApiKey] = useState(getFreesoundApiKey);
  const [activeFilter, setActiveFilter] = useState<string>(LIBRARY_PRESETS[0].filter);
  const [ready, setReady] = useState(hasFreesoundApiKey());
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void (async () => {
      await checkLibraryProxy();
      const canBrowse = (await checkFreesoundProxy()) || hasFreesoundApiKey();
      setReady(canBrowse);
      if (canBrowse) void searchLibrary('kick drum', LIBRARY_PRESETS[0].filter);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = (q: string, filter = activeFilter, p = 1) => {
    setInput(q);
    setActiveFilter(filter);
    void searchLibrary(q, filter, p);
  };

  const saveKeyAndSearch = () => {
    setFreesoundApiKey(apiKey);
    setReady(true);
    void checkLibraryProxy();
    void runSearch(input || 'kick drum');
  };

  const preview = (url: string) => {
    if (!previewRef.current) previewRef.current = new Audio();
    const a = previewRef.current;
    a.src = url;
    void a.play();
  };

  if (!ready) {
    return (
      <div className="lcdpanel librarypanel">
        <div className="libraryhdr">
          <span className="libbadge">Loop library · Freesound</span>
        </div>
        <div className="librarysetup">
          <p className="setuplead">
            Browse free one-shots and longer loops from Freesound. Use Loop / Beat / Song tabs for 8–90s grooves.
          </p>
          <ol className="setupsteps">
            <li>
              <a href="https://freesound.org/apiv2/apply" target="_blank" rel="noreferrer">
                Get a free API key
              </a>
              {' '}(takes ~1 min)
            </li>
            <li>Paste it below and tap CONNECT</li>
            <li>Search, preview, and LOAD to your pad</li>
          </ol>
          <input
            className="setupinput"
            type="text"
            value={apiKey}
            placeholder="Paste Freesound API key here"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            onChange={(e) => setApiKey(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && apiKey.trim() && saveKeyAndSearch()}
          />
          <button
            type="button"
            className="setupbtn"
            disabled={!apiKey.trim()}
            onClick={saveKeyAndSearch}
          >
            CONNECT
          </button>
        </div>
        <div className="lcdbtns">
          <button type="button" onClick={() => setScreen('sample')}>BACK</button>
        </div>
      </div>
    );
  }

  return (
    <div className="lcdpanel librarypanel">
      <div className="libraryhdr">
        <span className="libbadge">Loop library · Freesound</span>
        <span className="libstatus">
          {usingBuiltInFreesoundKey() ? '● connected' : proxyReady ? '● server' : '● your key'}
        </span>
      </div>

      <div className="librarysearch">
        <input
          type="search"
          value={input}
          placeholder="Search free samples…"
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch(input)}
        />
        <button type="button" onClick={() => runSearch(input)} disabled={loading}>
          GO
        </button>
      </div>

      <div className="kitfilters libpresets">
        {LIBRARY_PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            className={query === p.query ? 'on' : ''}
            onClick={() => runSearch(p.query, p.filter)}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <div className="libraryerr">{error}</div>}

      <div className="lcdlist browserlist librarylist">
        {loading && results.length === 0 && <div>Searching…</div>}
        {!loading && results.length === 0 && !error && <div>— no results —</div>}
        {results.map((s) => (
          <div key={s.id} className="libraryrow">
            <div className="librarymeta" onClick={() => preview(s.previewUrl)}>
              <b>{s.name}</b>
              <small>
                {s.duration.toFixed(1)}s
                {s.author ? ` · ${s.author}` : ''}
              </small>
            </div>
            <button
              type="button"
              className="libload"
              disabled={loading}
              onClick={() => void loadLibrarySound(s)}
            >
              LOAD
            </button>
          </div>
        ))}
      </div>

      <div className="lcdbtns">
        <button type="button" onClick={() => setScreen('sample')}>BACK</button>
        <button
          type="button"
          disabled={page <= 1 || loading}
          onClick={() => runSearch(query, activeFilter, page - 1)}
        >
          ◀
        </button>
        <span className="libpage">{page}/{numPages}</span>
        <button
          type="button"
          disabled={page >= numPages || loading}
          onClick={() => runSearch(query, activeFilter, page + 1)}
        >
          ▶
        </button>
      </div>
      <div className="hintline">
        One-shots OR tap Loop/Beat/Song · LOAD → pad · 6s+ auto-loops · For full songs use BEATS
      </div>
    </div>
  );
}
