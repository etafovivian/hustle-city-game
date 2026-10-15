// Phone → Holy books: read the Bible, the Qur'an or the Bhagavad Gita (public domain, apps/web/public/texts), with
// today's verse, a book and chapter picker, text size, and (for the Qur'an) Yusuf Ali or Pickthall. Where you were
// is remembered on this device. Reading a while brings a calm mind once a day.
import { BOOKS, READ_SECONDS, dailyVerse, type BookKey } from "@hc/shared";
import { BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { api } from "../api.js";

type BibleBook = { id: string; name: string; title: string; chapters: number; testament: "old" | "new" };
type Surah = { n: number; name: string; meaning: string; verses: number; place: string };
type GitaChapter = { n: number; name: string; meaning: string };
type Place = { bible: { id: string; c: number }; quran: { n: number }; gita: { n: number } };
type Prefs = { book: BookKey; at: Place; size: number; tr: "y" | "p" };

const KEY = "hc_books";
const DEFAULTS: Prefs = { book: "bible", at: { bible: { id: "b19", c: 23 }, quran: { n: 1 }, gita: { n: 2 } }, size: 16, tr: "y" };
const loadPrefs = (): Prefs => {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? "null") as Partial<Prefs> | null) };
  } catch {
    return DEFAULTS;
  }
};
const savePrefs = (p: Prefs) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* not essential */
  }
};
/** Open the reader on a book (from a place of worship). */
export function openBook(book: BookKey) {
  savePrefs({ ...loadPrefs(), book });
  window.dispatchEvent(new CustomEvent("hc:open-phone", { detail: "books" }));
}

const cache = new Map<string, Promise<unknown>>();
function text<T>(path: string): Promise<T> {
  if (!cache.has(path))
    cache.set(
      path,
      fetch(`/texts/${path}`).then((r) => {
        if (!r.ok) throw new Error("Couldn't load that chapter. Check your connection.");
        return r.json();
      }),
    );
  return cache.get(path) as Promise<T>;
}
function useText<T>(path: string | null): T | null {
  // Kept with its path: right after switching book or chapter the old text isn't shown as the new one.
  const [v, setV] = useState<{ path: string; data: T } | null>(null);
  useEffect(() => {
    if (!path) return;
    let live = true;
    text<T>(path)
      .then((data) => live && setV({ path, data }))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [path]);
  return v && v.path === path ? v.data : null;
}
const lagosDay = () => Math.floor((Date.now() + 3_600_000) / 86_400_000);

export function BooksApp({ notify }: { notify: (m: string) => void }) {
  const [prefs, setPrefsState] = useState<Prefs>(loadPrefs);
  const setPrefs = (p: Prefs) => {
    setPrefsState(p);
    savePrefs(p);
  };
  const [picking, setPicking] = useState(false);
  const bible = useText<BibleBook[]>("bible/index.json");
  const quran = useText<Surah[]>("quran/index.json");
  const gita = useText<GitaChapter[]>("gita/index.json");
  const book = prefs.book;
  const at = prefs.at;

  // Where you are, and the chapter's file.
  const bBook = bible?.find((b) => b.id === at.bible.id);
  const path = book === "bible" ? `bible/${at.bible.id}-${at.bible.c}.json` : book === "quran" ? `quran/${at.quran.n}.json` : `gita/${at.gita.n}.json`;
  const chapter = useText<[number, string, string?][] | string[]>(path);
  const title =
    book === "bible"
      ? `${bBook?.name ?? ""} ${at.bible.c}`
      : book === "quran"
        ? (() => {
            const s = quran?.find((x) => x.n === at.quran.n);
            return s ? `${s.n}. ${s.name}${s.meaning && s.meaning !== s.name ? ` (${s.meaning})` : ""}` : `Surah ${at.quran.n}`;
          })()
        : (() => {
            const g = gita?.find((x) => x.n === at.gita.n);
            return g ? `Chapter ${g.n}: ${g.name}` : `Chapter ${at.gita.n}`;
          })();

  // Next and previous chapter.
  const step = (d: 1 | -1) => {
    if (book === "bible" && bible) {
      const i = bible.findIndex((b) => b.id === at.bible.id);
      let c = at.bible.c + d;
      let bi = i;
      if (c < 1) {
        bi = Math.max(0, i - 1);
        c = bi === i ? 1 : bible[bi]!.chapters;
      } else if (c > bible[i]!.chapters) {
        bi = Math.min(bible.length - 1, i + 1);
        c = bi === i ? bible[i]!.chapters : 1;
      }
      setPrefs({ ...prefs, at: { ...at, bible: { id: bible[bi]!.id, c } } });
    } else if (book === "quran") setPrefs({ ...prefs, at: { ...at, quran: { n: Math.min(114, Math.max(1, at.quran.n + d)) } } });
    else setPrefs({ ...prefs, at: { ...at, gita: { n: Math.min(18, Math.max(1, at.gita.n + d)) } } });
    document.querySelector(".books-reader")?.scrollTo({ top: 0 });
  };

  // A calm mind: after reading a while (once a day; the server checks).
  const counted = useRef<string | null>(null);
  useEffect(() => {
    const t = window.setTimeout(() => {
      const day = String(lagosDay());
      if (counted.current === day) return;
      counted.current = day;
      void api<{ calm: boolean }>("POST", "/api/game/read", { book })
        .then((r) => r.calm && notify("📖 A calm mind. +Energy +Fun"))
        .catch(() => undefined);
    }, READ_SECONDS * 1000);
    return () => window.clearTimeout(t);
  }, [path]);

  return (
    <div className="stack books">
      <h2 style={{ fontSize: 20 }}>
        <BookOpen size={20} aria-hidden="true" /> Holy books
      </h2>
      <div className="row" style={{ gap: 6, flexWrap: "wrap" }} role="tablist" aria-label="Book">
        {BOOKS.map((b) => (
          <button key={b.key} type="button" role="tab" className="chip" aria-selected={book === b.key} aria-pressed={book === b.key} onClick={() => (setPicking(false), setPrefs({ ...prefs, book: b.key }))}>
            {b.icon} {b.label}
          </button>
        ))}
      </div>
      <TodayVerse book={book} tr={prefs.tr} bible={bible} quran={quran} gita={gita} onOpen={(at2) => (setPicking(false), setPrefs({ ...prefs, at: { ...at, ...at2 } }))} />
      <div className="row books-bar">
        <button type="button" className="btn sm" onClick={() => step(-1)} aria-label="Previous chapter">
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <button type="button" className="btn sm books-title" onClick={() => setPicking((x) => !x)} aria-expanded={picking}>
          {title} ▾
        </button>
        <button type="button" className="btn sm" onClick={() => step(1)} aria-label="Next chapter">
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="row" style={{ gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <button type="button" className="chip" onClick={() => setPrefs({ ...prefs, size: Math.max(13, prefs.size - 1) })} aria-label="Smaller text">
          A−
        </button>
        <button type="button" className="chip" onClick={() => setPrefs({ ...prefs, size: Math.min(24, prefs.size + 1) })} aria-label="Bigger text">
          A+
        </button>
        {book === "quran" && (
          <>
            <button type="button" className="chip" aria-pressed={prefs.tr === "y"} onClick={() => setPrefs({ ...prefs, tr: "y" })}>
              Yusuf Ali
            </button>
            <button type="button" className="chip" aria-pressed={prefs.tr === "p"} onClick={() => setPrefs({ ...prefs, tr: "p" })}>
              Pickthall
            </button>
          </>
        )}
      </div>
      {picking ? (
        <Picker book={book} at={at} bible={bible} quran={quran} gita={gita} onPick={(at2) => (setPicking(false), setPrefs({ ...prefs, at: { ...at, ...at2 } }))} />
      ) : (
        <div className="books-reader" style={{ fontSize: prefs.size }}>
          {!chapter ? (
            <p className="small muted">Loading…</p>
          ) : book === "gita" ? (
            (chapter as string[]).map((st, i) => (
              <p key={i} className="books-stanza">
                {st}
              </p>
            ))
          ) : (
            (chapter as [number, string, string?][]).map(([v, a, b]) => (
              <p key={v} className="books-verse">
                <sup>{v}</sup> {book === "quran" && prefs.tr === "p" ? b : a}
              </p>
            ))
          )}
        </div>
      )}
      <p className="tiny muted">
        {BOOKS.find((b) => b.key === book)!.translation}. Public-domain texts from Project Gutenberg.
      </p>
    </div>
  );
}

function TodayVerse({ book, tr, bible, quran, gita, onOpen }: { book: BookKey; tr: "y" | "p"; bible: BibleBook[] | null; quran: Surah[] | null; gita: GitaChapter[] | null; onOpen: (at: Partial<Place>) => void }) {
  const [id, c, v] = dailyVerse(book, lagosDay());
  const path = book === "bible" ? `bible/${id}-${c}.json` : book === "quran" ? `quran/${c}.json` : `gita/${c}.json`;
  const ch = useText<[number, string, string?][] | string[]>(path);
  if (!ch) return null;
  const words = book === "gita" ? (ch as string[]).find((s) => s.split("\n").length >= 3) : (() => {
    const row = (ch as [number, string, string?][]).find((r) => r[0] === v);
    return row ? (book === "quran" && tr === "p" ? row[2] : row[1]) : null;
  })();
  if (!words) return null;
  const ref = book === "bible" ? `${bible?.find((b) => b.id === id)?.name ?? ""} ${c}:${v}` : book === "quran" ? `${quran?.find((s) => s.n === c)?.name ?? "Surah"} ${c}:${v}` : `Gita, chapter ${c}${gita ? `: ${gita.find((g) => g.n === c)?.name ?? ""}` : ""}`;
  return (
    <button type="button" className="books-today" onClick={() => onOpen(book === "bible" ? { bible: { id, c } } : book === "quran" ? { quran: { n: c } } : { gita: { n: c } })}>
      <span className="tiny muted">Today's verse</span>
      <span className="small books-today-text">“{words.split("\n").slice(0, 6).join(" ")}”</span>
      <strong className="tiny">{ref}</strong>
    </button>
  );
}

function Picker({ book, at, bible, quran, gita, onPick }: { book: BookKey; at: Place; bible: BibleBook[] | null; quran: Surah[] | null; gita: GitaChapter[] | null; onPick: (at: Partial<Place>) => void }) {
  const [bookId, setBookId] = useState<string | null>(null);
  if (book === "bible" && bible) {
    const b = bookId ? bible.find((x) => x.id === bookId) : null;
    if (b)
      return (
        <div className="stack" style={{ gap: 6 }}>
          <button type="button" className="btn sm quiet" style={{ justifySelf: "start" }} onClick={() => setBookId(null)}>
            ‹ All books
          </button>
          <strong className="small">{b.name}</strong>
          <div className="books-grid">
            {Array.from({ length: b.chapters }, (_, i) => (
              <button key={i} type="button" className="chip" aria-pressed={at.bible.id === b.id && at.bible.c === i + 1} onClick={() => onPick({ bible: { id: b.id, c: i + 1 } })}>
                {i + 1}
              </button>
            ))}
          </div>
        </div>
      );
    return (
      <div className="stack" style={{ gap: 6 }}>
        {(["old", "new"] as const).map((t) => (
          <div key={t} className="stack" style={{ gap: 4 }}>
            <strong className="tiny muted">{t === "old" ? "Old Testament" : "New Testament"}</strong>
            <div className="books-list">
              {bible
                .filter((x) => x.testament === t)
                .map((x) => (
                  <button key={x.id} type="button" className="chip" aria-pressed={at.bible.id === x.id} onClick={() => (x.chapters === 1 ? onPick({ bible: { id: x.id, c: 1 } }) : setBookId(x.id))}>
                    {x.name}
                  </button>
                ))}
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (book === "quran" && quran)
    return (
      <div className="books-rows">
        {quran.map((s) => (
          <button key={s.n} type="button" className="books-row" aria-pressed={at.quran.n === s.n} onClick={() => onPick({ quran: { n: s.n } })}>
            <span className="books-num">{s.n}</span>
            <span>
              <strong className="small">{s.name}</strong> <span className="tiny muted">{s.meaning} · {s.verses} verses</span>
            </span>
          </button>
        ))}
      </div>
    );
  if (book === "gita" && gita)
    return (
      <div className="books-rows">
        {gita.map((g) => (
          <button key={g.n} type="button" className="books-row" aria-pressed={at.gita.n === g.n} onClick={() => onPick({ gita: { n: g.n } })}>
            <span className="books-num">{g.n}</span>
            <span>
              <strong className="small">{g.name}</strong> <span className="tiny muted">{g.meaning}</span>
            </span>
          </button>
        ))}
      </div>
    );
  return <p className="small muted">Loading…</p>;
}
