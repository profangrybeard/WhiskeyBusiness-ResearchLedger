# Research filing

How material gets into the research ledger (this repo). The nightly filing run follows this file, and so does any session filing by hand. The ledger is thesis material, so every rule here is about traceability: a reader should be able to follow any claim back to its source and see who wrote what.

## The files

- `catalogue.json` is the source of truth for sources. One entry per source.
- `questions.json` holds Tim's research questions, in his words.
- `ai-log.json` is the AI use record, in the AI 201 ESF format.
- `filed.json` lists every email already looked at. Check it first so nothing is filed twice.
- The page (`index.html`, `ledger.js`, `ledger.css`) reads all four. No build step. GitHub Pages serves the repo root.

## Keeping the originals

- Every email from Cheryl gets the Gmail label **Whiskey Business/Research**. The label keeps the original text and any attachments, including PDF clippings the connector can't download.
- Every web source gets an archived copy in `cite.archive` (a Wayback Machine snapshot URL). Until a snapshot exists, the field stays empty and the page shows "No archived copy yet."
- No PDFs, scans or article text go in the repo. The repo is public on Pages.

## Filing an email from Cheryl

1. Skip any message id already in `filed.json`.
2. Apply the Gmail label.
3. Read the whole email. Separate what Cheryl wrote from what she pasted. Pasted AI search answers are common and are trust `ai` until checked.
4. Open every link with WebFetch. Summarize what the page actually says. If it says less than the email claims, write that down.
5. If the source is already in the catalogue (same URL or same clipping), add to that entry instead of making a new one.
6. Otherwise add a new entry with the next id, zero padded to three digits.
7. Record the message in `filed.json`: `filed` or `merged` with the entry id, or `skipped` with a reason.

## Filing a question from Tim

Tim captures questions two ways: in a chat with Claude, or by emailing himself with **WB Q** at the start of the subject.

- Copy his words exactly. Fix nothing, not even typos. Never draft, merge or reword a question.
- When Tim asks for a cleanup, change only capitalization, spelling and grammar. Move the captured wording to `original` and note the date in `edited`.
- Add it to `questions.json` as `{ "id": "Q001", "captured": "YYYY-MM-DD", "via": "chat" or "email", "text": "...", "sources": [], "status": "open" }`. `sources` lists entry ids only when Tim names them.
- An email question also gets the Gmail label **Whiskey Business/Questions**, and its message id goes in `filed.json`.

## Entry rules

- **Citation.** Fill `cite` for MLA 9: author ("Last, First"), title, container, place (for a local paper, in brackets), publisher (only when it differs from the container), date, pages, database (Newspapers.com for clippings), url, accessed (the date the page was read), archive. Email sources use `type: "email"`, the subject as title, and `recipient: "Tim Lindsey"`. Take metadata from the page itself, never from memory.
- **AI provenance.** Every summary records `ai.summarized_by` (the model), `ai.summarized_on`, and `ai.from` (what it was summarized from). `ai.checked_by_tim` and `ai.checked_on` stay empty until Tim checks the summary against the original himself. An unchecked summary is a lead, not evidence.
- **Bears on.** The primary question is Tim's: how to make a player feel OUTLAW, and secondarily PRIDE in the product. Tag each source in `bears_on` with `outlaw` and/or `pride`, one entry per piece of material, each with a one-line pointer to what in the source touches that feeling. Outlaw means the rule-breaker with a code, any gender: on the wrong side of the law, square with their own people. Pride means pride in the product, the liquor and the craft of making it, not a person's reputation. Point at the material only. Never write what the game should do with it. That goes in the use line, which is Tim's. Trust is the second pillar, working name, and the third lens: how far a family, the county, then the state, then the federal government will go for the player or against them. Families are the early game: rivals and allies whose judgment can differ from the county's. Tag it `trust`, add `scale` (`family`, `county`, `state` or `federal`), and add `willingness` when the source shows one of Tim's five: `assign`, `hide`, `harbor`, `ignore`, `condone`. Leave `willingness` empty for enforcement material, such as a federal indictment, that shows the scale but no cover. Leave `bears_on` empty when nothing fits.
- **Paraphrase.** Summaries are notes in plain words, never copied text. At most one short quote per entry, under fifteen words.
- **Trust.** `primary` for anything written at the time (newspapers, court records, census). `secondary` for later histories, articles and museum pages. `scholarship` is a kind, for academic books and papers. `family` for Cheryl's own memory or family research. `ai` for pasted AI summaries. `unread` when the source couldn't be opened.
- **Tim's fields.** `use`, `design`, every question, and every `why` in the AI log are Tim's alone. Leave them empty. Never edit them.
- **Real people.** Research may name real people from public sources and ancestors. Living relatives stay out. Describe them by role ("a cousin nearby").
- **Sent by** is the sender's name as she signs. Never an email address.
- **Leads and verify.** Anything to chase goes in `leads`. Anything that contradicts another entry, or rests only on lore or an AI summary, goes in `verify`, with the specific conflict named.
- Plain writing, no em-dashes, short sentences.

## Reading notes from books

Tim reads with a private capture page, Reading Notes (https://claude.ai/artifact/EwkRRtJNV8UpvkiZpdjM7j). Its data lives in that artifact's database under `data/users/me/reading`: `books` (title, author last name, ledger number) and `notes` (book, page, quote, Tim's note, lenses).

- Quote text never leaves that page. It stays private, per Tim's rule that book text stays out of the repo.
- Copy each note's page, Tim's note (his words, unchanged), and lenses into the matching entry's `reading` array, with `quote_on_file: true` when a quote exists. Match by the book's ledger number. Add a new note once; update it if Tim edits it; remove it if he deletes it.
- A book with no ledger number yet gets a new catalogue entry first, with its citation checked against the publisher.
- Never write to the Reading Notes database except to add a book Tim names.

## The AI log

Each filing run, and each working session on the ledger, adds one Direction Log entry to `ai-log.json`: what was asked, what the AI produced, the outcome (`kept`, `changed` or `rejected`), and the commit ids. When Tim rejects or significantly revises AI output, that is a Record of Resistance: what the AI produced, what was done instead, and his reason in his own words, quoted. The `why` field holds only Tim's words. Leave it blank until he gives one.

Commit messages say why, not just what. The git history doubles as AI use documentation.

## What a run can't do

The email connector can't download attachments. A PDF clipping gets an `unread` entry with its file name and subject, and Tim drops the PDF into chat to have it read. Newspapers.com links that need a login are also `unread` until Tim sends the file.

Saving new Wayback snapshots is blocked from these sessions. Archive fields stay empty until Tim saves a snapshot or one is found already archived.

## After filing

Set `meta.updated` in the catalogue to today, bump the last number of the version line in README.md and set its date to today, commit as `research: filed N from Cheryl` (and `M questions` when there are any), and push to `main`.
