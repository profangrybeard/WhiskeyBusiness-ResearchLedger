# CLAUDE.md

Read this first, every session. Then read `docs/FILING.md`, the rulebook for everything that goes into the ledger.

## What this is

The research ledger for **Whiskey Business**, Tim Lindsey's Prohibition-era moonshine game and MFA thesis work. It is its own product. It sits beside every edition of the game, starting with Mash Edition, the pre-production proof of concept, and is not part of any one of them.

The ledger is public on GitHub Pages and is thesis material. Every rule here is about traceability: any claim can be followed back to its source, and anyone can see who wrote what.

## How we work

1. **Tim's words are Tim's.** The `use` and `design` fields, every question, every reading note, and every `why` in the AI log are his alone. Claude never writes or rewords them. A cleanup Tim asks for changes only capitalization, spelling and grammar, and keeps the earlier wording on the record.
2. **Claude's work is labeled.** Every summary records the model that wrote it and stays unchecked until Tim reads the original. `bears_on` tags are Claude's, unconfirmed, and point at material only, never at what the game should do.
3. **Paraphrase.** At most one quote per entry, under fifteen words. No article text, book text, PDFs or scans in this repo. Book quotes stay in Tim's private Reading Notes page.
4. **Real people.** Research may name real people from public sources, including ancestors. Living relatives stay out. Rival families in the game are fictional.
5. **AI use is documented** in `ai-log.json`, in the AI 201 ESF format: Direction Log and Records of Resistance. Commit messages say why, not just what.
6. **Be honest.** Name contradictions between sources in `verify`. Say plainly when a source is weaker than it looks.

## Files

- `catalogue.json`: every source. The source of truth.
- `questions.json`: Tim's research questions.
- `ai-log.json`: AI use record.
- `filed.json`: emails already handled.
- `index.html`, `ledger.js`, `ledger.css`: the page. Plain ES modules, no build step.
- `docs/FILING.md`: how material gets filed.
- `docs/DECISIONS.md`: research decisions, append only.

## Writing rules

Never use em-dashes. Plain and conversational. Short paragraphs. Be specific. No hedging. Do not write in Tim's first-person voice.

## Running

Local: `npx serve .` (opening index.html directly won't load the data). Pages: pushed to `main`, root folder.
