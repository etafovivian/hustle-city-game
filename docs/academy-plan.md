# Hustle Academy: learning in Hustle City

Owner's idea (2026-10-12): players go to school in the game. The owner uploads courses; people who **really finish**
get a virtual certificate in the game and can get a **real certificate** from the owner's training institute, with an
Akure tech hub as partner.

Why it fits the game: it gives players a reason to come back every day, turns the city into somewhere you grow, and
gives three income lines (paid certificates, sponsored courses, partner share) plus something people love to share:
a certificate with their name on it.

## What players see

- **Schools on the map.** A school building in each area (Stitch batch 19 has one), and the partner's campus at
  Tech Mile ("The Hub" building we already have). Tap it: the course list, like a venue card.
- **Academy app on the phone.** My courses, progress, certificates.
- **A course** is modules → lessons (video, text, downloadable files) → a quiz per module → a final assessment.
- **Finishing** gives: XP and City Coins, a badge on the profile and shop, and the **virtual certificate**
  (a page with the player's name, course, date and a verify link).
- **Real certificate** (optional, from the institute): a PDF with a unique number and a public verify page
  (`/verify/<number>`), co-branded with the partner where the course is theirs.
- **Share**: "I just finished Web Basics at Hustle Academy": WhatsApp, LinkedIn, X, with a link back to the game.
- **Marketplace tie-in**: artisans who finish a trade course get a "Trained" badge on their listing (trust, more jobs).

## "Really finish": how we know

1. Every lesson must be opened and stayed on long enough (videos: watched to near the end; the server records time,
   not the browser alone).
2. Module quizzes: questions drawn from a bank, shuffled, pass mark (e.g. 70%), limited attempts with a wait between.
3. Final assessment: a timed quiz, and for real certificates a **project** (file or link) that the owner or a tutor
   reviews and approves.
4. Real certificates need a verified email and the full legal name as it should print; the owner approves each one
   (or approves a batch).
5. Certificates are permanent records: never edited, only revoked with a reason (same append-only pattern as quotes).

## What the owner gets (admin)

- Course builder: create course, modules, lessons (paste a video link or upload a file, write text), quiz questions.
- Learners: who is enrolled, progress, stuck points, quiz scores.
- Reviews: approve or return final projects with a comment.
- Certificates: issue, see, revoke; download the PDF.
- Partner view (later): the Akure hub sees its own courses and learners.

## Money

- Courses free to take (they bring players in); **the real certificate is paid** (price set by the owner).
- **Sponsored courses**: a bank or tech company pays to put its course in the Academy (like billboards).
- **Partner share**: the hub's courses and certificates split revenue as agreed.
- Later: cohort classes with live sessions, job board for graduates (employers pay).

## Data (new tables)

`courses`, `course_modules`, `lessons`, `quiz_questions`, `enrolments`, `lesson_progress`, `quiz_attempts`,
`submissions`, `certificates` (append-only; `certificate_revocations` for revoking), `partners`.

## Build in three steps

| Step | Scope |
|---|---|
| A | Admin course builder (text, video link, quiz); learner progress; module quizzes; virtual certificate and verify page; XP and coins; Academy phone app |
| B | Final project upload and review; real certificate PDF with number; payment for the real certificate; partner co-branding |
| C | Schools on the map with classroom interiors; cohort classes; share cards; "Trained" badge on artisan listings; partner dashboard |

## Care points

- The certificate must name the issuer (the owner's institute, and the partner where theirs) and must not suggest
  government accreditation unless the institute has it.
- Learner data falls under the Nigeria Data Protection Act 2023: say what we keep (name, progress, results), why, and
  for how long; let people delete their account.
- Video hosting: big videos are costly to serve from the lab server; unlisted YouTube/Vimeo links are cheapest at the
  start, own storage later.
- A written agreement with the partner hub (who issues, who reviews, revenue split, use of their name and logo).

## Owner's answers (2026-10-12)

- Issuer: **Lampnet Institute of Technology**. Partner: **AkureTechHub** (managed by Lampnet; logo use being finalised, so
  certificates show names only for now).
- Virtual certificate: **free**. Physical certificate: **₦5,000**. Professional training (Microsoft, AWS, DevOps,
  DevSecOps and similar): **₦500,000–₦800,000** per course; other tracks (software, cyber) at lower prices.
- Videos: **unlisted YouTube links** for now; own hosting later.
- Final projects: reviewed by **a real person** (the institute), maybe AI-assisted later.
- First courses: **tech**. A starter draft, "Web Basics: Your First Web Page", is seeded for the owner to add videos to.

Step A is built: course builder (admin), catalogue, server-timed lessons, module quizzes (answers stay on the server,
pass mark, retry wait, daily limit), free virtual certificate with public verify page (`/?verify=<number>`) and
share links, completion reward in City Coins and XP. Vendor-named courses (AWS, Microsoft) should say they prepare
learners for the vendor's own exam and that Lampnet isn't the vendor, unless Lampnet is an official partner.
