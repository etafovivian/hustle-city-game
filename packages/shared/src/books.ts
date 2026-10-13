// Phone → Holy books: the Bible (KJV), the Qur'an (Yusuf Ali, Pickthall) and the Bhagavad Gita (Edwin Arnold), all
// public domain (apps/web/public/texts). Reading a while brings a calm mind once a Lagos day. Every book is treated
// the same; nothing is ranked or compared.

export type BookKey = "bible" | "quran" | "gita";
export const BOOKS: readonly { key: BookKey; label: string; icon: string; translation: string }[] = [
  { key: "bible", label: "Holy Bible", icon: "✝️", translation: "King James Version" },
  { key: "quran", label: "Holy Qur'an", icon: "☪️", translation: "English meaning: Yusuf Ali or Pickthall" },
  { key: "gita", label: "Bhagavad Gita", icon: "🕉️", translation: "The Song Celestial, Sir Edwin Arnold" },
];
export const BOOK_KEYS = BOOKS.map((b) => b.key);

/** A calm mind, once a Lagos day, after reading a while. */
export const READ_GIVES = { energy: 4, fun: 3 };
/** Seconds of reading before it counts. */
export const READ_SECONDS = 30;

/** Places of worship and the book read there. */
export const WORSHIP_BOOK: Readonly<Record<string, BookKey>> = {
  grace_chapel: "bible",
  unity_cathedral: "bible",
  central_mosque: "quran",
  unity_mosque: "quran",
};

/** "Today's verse": well-loved verses, one a day (book id or surah or chapter, chapter, verse). */
export const DAILY_VERSES: Readonly<Record<BookKey, readonly [string, number, number][]>> = {
  bible: [
    ["b19", 23, 1], ["b50", 4, 13], ["b24", 29, 11], ["b20", 3, 5], ["b23", 40, 31], ["b43", 14, 27], ["b06", 1, 9],
    ["b40", 11, 28], ["b45", 8, 28], ["b19", 46, 1], ["b46", 13, 4], ["b19", 121, 1], ["b58", 11, 1], ["b44", 20, 35],
  ],
  quran: [
    ["", 2, 286], ["", 94, 5], ["", 13, 28], ["", 2, 153], ["", 65, 3], ["", 3, 139], ["", 39, 53], ["", 2, 186],
    ["", 49, 13], ["", 2, 45], ["", 16, 128], ["", 93, 5],
  ],
  gita: [["", 2, 0], ["", 3, 0], ["", 6, 0], ["", 12, 0], ["", 18, 0]],
};
/** Today's verse for a book, by Lagos day number. */
export const dailyVerse = (book: BookKey, day: number) => {
  const list = DAILY_VERSES[book];
  return list[((day % list.length) + list.length) % list.length]!;
};
