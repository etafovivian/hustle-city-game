#!/usr/bin/env python3
"""Splits three public-domain texts from Project Gutenberg into small per-chapter JSON files for Phone -> Holy books
(apps/web/public/texts). Gutenberg's header and licence are dropped (allowed for public-domain works).

  python3 -I scripts/holy-books.py <bible.txt> <quran.txt> <gita.txt> <out dir>

  bible.txt  ebook #10     The King James Version of the Bible
  quran.txt  ebook #16955  Three translations of the Koran side by side (Yusuf Ali, Pickthall, Shakir)
  gita.txt   ebook #2388   The Song Celestial (Bhagavad Gita), Sir Edwin Arnold
"""
import json
import os
import re
import sys

BIBLE_SHORT = [
    "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth", "1 Samuel", "2 Samuel",
    "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra", "Nehemiah", "Esther", "Job", "Psalms", "Proverbs",
    "Ecclesiastes", "Song of Solomon", "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel",
    "Amos", "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah", "Malachi",
    "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians", "2 Corinthians", "Galatians", "Ephesians",
    "Philippians", "Colossians", "1 Thessalonians", "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon",
    "Hebrews", "James", "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
]


def body(path):
    text = open(path, encoding="utf-8").read().replace("\r\n", "\n")
    start = text.index("\n", text.index("*** START OF THE PROJECT GUTENBERG EBOOK")) + 1
    end = text.index("*** END OF THE PROJECT GUTENBERG EBOOK")
    return text[start:end]


def write(path, data):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))


def bible(src, out):
    lines = body(src).split("\n")
    # The contents list comes first (two testament headings, then the 66 titles); the books follow in order.
    titles = []
    i = 0
    while len(titles) < 66:
        t = lines[i].strip()
        if t and not t.startswith("The Old Testament") and not t.startswith("The New Testament"):
            titles.append(t)
        i += 1
    assert len(titles) == 66, titles
    pos = i
    index = []
    for b, title in enumerate(titles):
        start = next(k for k in range(pos, len(lines)) if lines[k].strip() == title)
        nxt = next((k for k in range(start + 1, len(lines)) if b + 1 < 66 and lines[k].strip() == titles[b + 1]), len(lines))
        pos = nxt
        verses = {}
        # Verses start at "chapter:verse", often in the middle of a line (the text wraps paragraphs, not verses).
        flat = " ".join("\n".join(lines[start + 1 : nxt]).split())
        marks = list(re.finditer(r"(?:^|(?<=\s))(\d+):(\d+)\s", flat))
        for k, m in enumerate(marks):
            end = marks[k + 1].start() if k + 1 < len(marks) else len(flat)
            verse = flat[m.end() : end].strip()
            verse = verse.split(" The New Testament of the King James Bible")[0].rstrip(" *")
            verses.setdefault(int(m.group(1)), []).append([int(m.group(2)), verse])
        slug = f"b{b + 1:02d}"
        for c, vs in verses.items():
            write(f"{out}/bible/{slug}-{c}.json", vs)
        index.append({"id": slug, "name": BIBLE_SHORT[b], "title": title, "chapters": len(verses), "testament": "old" if b < 39 else "new"})
    write(f"{out}/bible/index.json", index)
    return len(index)


def quran(src, out):
    text = body(src)
    # (A few verse labels in the source lost digits, e.g. "0.033" or "039.04": verses are numbered in order, and the
    # count checked against the surah's header.)
    # Each surah: a header (number, NAME (MEANING), verse count, where revealed), then its verses "SSS.VVV" with
    # Y: (Yusuf Ali), P: (Pickthall) and S: (Shakir) lines.
    parts = re.split(r"\n\s*Chapter (\d+):\s*\n", text)
    index = []
    for k in range(1, len(parts), 2):
        n = int(parts[k])
        chunk = parts[k + 1]
        head = re.search(r"^\s*(.+?)\s*\((.+?)\)\s*$", chunk.strip().split("\n")[0])
        meta = re.search(r"Total Verses:\s*(\d+)\s*Revealed At:\s*(\w+)", chunk)
        verses = []
        for m in re.finditer(r"(\d{1,3})\.(\d{2,3})\s*\nY:(.*?)\nP:(.*?)\nS:(.*?)(?=\n\d{1,3}\.\d{2,3}\s*\n|\n-{10,}|\Z)", chunk, re.S):
            clean = lambda s: " ".join(s.split())
            verses.append([len(verses) + 1, clean(m.group(3)), clean(m.group(4))])
        assert meta and len(verses) == int(meta.group(1)), (n, len(verses))
        write(f"{out}/quran/{n}.json", verses)
        name = head.group(1).title() if head else f"Surah {n}"
        index.append({"n": n, "name": name.replace("Al-", "Al-"), "meaning": head.group(2).title() if head else "", "verses": len(verses), "place": (meta.group(2).title() if meta else "")})
    assert len(index) == 114, len(index)
    write(f"{out}/quran/index.json", index)
    return len(index)


ROMAN = {"I": 1, "V": 5, "X": 10}


def roman(s):
    total = 0
    for a, b in zip(s, s[1:] + " "):
        v = ROMAN[a]
        total += -v if b != " " and ROMAN.get(b, 0) > v else v
    return total


def gita(src, out):
    text = body(src)
    # Footnotes are listed at the end; their markers come out of the verse.
    text = text.split("\n[FN#1] ")[0]
    text = re.sub(r"\s*\[FN#\d+\]", "", text)
    parts = re.split(r"\n\s*CHAPTER ([IVX]+)\s*\n", text)
    index = []
    for k in range(1, len(parts), 2):
        n = roman(parts[k])
        chunk = parts[k + 1]
        end = re.search(r"HERE END(?:ETH|S),? (?:WITH )?CHAPTER [IVX]+\.?(?: OF THE\s+BHAGAVAD-GITA)?,?\s*(.*?)(?:\n\s*\n|$)", chunk, re.S)
        verse = chunk[: end.start()] if end else chunk
        names = re.findall(r'"([^"]+)"', end.group(1)) if end else []
        stanzas = [s.strip("\n") for s in re.split(r"\n\s*\n", verse) if s.strip()]
        stanzas = ["\n".join(l.strip() for l in s.split("\n")) for s in stanzas]
        write(f"{out}/gita/{n}.json", stanzas)
        tidy = lambda x: x.strip().rstrip(".,")
        index.append({"n": n, "name": tidy(names[0]) if names else f"Chapter {n}", "meaning": tidy(names[1]) if len(names) > 1 else ""})
    assert len(index) == 18, len(index)
    write(f"{out}/gita/index.json", index)
    return len(index)


if __name__ == "__main__":
    b, q, g, out = sys.argv[1:5]
    print("bible books", bible(b, out))
    print("quran surahs", quran(q, out))
    print("gita chapters", gita(g, out))
