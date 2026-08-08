import { useEffect, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { LIBRARY_PRESETS } from '../library/types';
import { getFreesoundApiKey, setFreesoundApiKey } from '../storage/libraryKeys';

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

  const [input, setInput] = useState(query);
  const [apiKey, setApiKey] = useState(getFreesoundApiKey);
  const [showKey, setShowKey] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>(LIBRARY_PRESETS[0].filter);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    void checkLibraryProxy();
    void searchLibrary('kick drum', LIBRARY_PRESETS[0].filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runSearch = (q: string, filter = activeFilter, p = 1) => {
    setInput(q);
    setActiveFilter(filter);
    void searchLibrary(q, filter, p);
  };

  const preview = (url: string) => {
    if (!previewRef.current) previewRef.current = new Audio();
    const a = previewRef.current;
    a.src = url;
    void a.play();
  };

  return (
    <div className="lcdpanel librarypanel">
      <div className="libraryhdr">
        <span className="libbadge">Freesound.org</span>
        <span className="libstatus">
          {proxyReady ? '● server' : '○ add API key'}
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

      <div className="kitfilters">
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

      {!proxyReady && (
        <div className="librarykey">
          <button type="button" className="keytoggle" onClick={() => setShowKey(!showKey)}>
            {showKey ? 'Hide' : 'Add'} Freesound API key
          </button>
          {showKey && (
            <>
              <input
                type="password"
                value={apiKey}
                placeholder="Paste API key"
                onChange={(e) => setApiKey(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  setFreesoundApiKey(apiKey);
                  void runSearch(input || 'kick drum');
                }}
              >
                SAVE
              </button>
              <a
                className="keylink"
                href="https://freesound.org/apiv2/apply"
                target="_blank"
                rel="noreferrer"
              >
                Get free key →
              </a>
            </>
          )}
        </div>
      )}

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
        Tap name to preview · LOAD assigns to current pad. CC-licensed previews from Freesound.
      </div>
    </div>
  );
}
