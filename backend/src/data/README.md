# Chess knowledge data

## Openings

`openings-source/*.tsv` comes from the
[Lichess chess-openings repository](https://github.com/lichess-org/chess-openings)
and is distributed under CC0-1.0.

Run this command after updating the TSV files:

```bash
npm run knowledge:build
```

The command generates `chessOpenings.generated.js`, which is imported by the
server-side AI Coach route and deployed with the backend. The application does
not download the opening database while answering a chat message.

## Players

`chessPlayers.js` contains a curated, dated snapshot of notable historical and
current players. Stable biographical facts are cross-checked against
[Wikidata](https://www.wikidata.org/) and official title/rating information
should be checked against [FIDE Ratings](https://ratings.fide.com/).

Do not store an undated live rating or ranking in this file. Those values
change monthly and should always include an explicit snapshot date.

The catalog has 26 profiles. Most are the original 2026-06-12 snapshot;
`factsCheckedAt` marks only the profiles whose basic facts were checked again.
The 2026-09-21 update verifies birth year and GM title year against FIDE for
[Carlsen](https://ratings.fide.com/profile/1503014),
[Nakamura](https://ratings.fide.com/profile/2016192),
[Lê Quang Liêm](https://ratings.fide.com/profile/12401137),
[Giri](https://ratings.fide.com/profile/24116068),
[Firouzja](https://ratings.fide.com/profile/12573981), and
[Wesley So](https://ratings.fide.com/profile/5202213).
FIDE federation is not automatically a statement of nationality. Descriptions
of playing style remain editorial summaries, labelled separately from FIDE facts.

## Chat knowledge library

`coachLibrary.js` and `coachLessons.js` contain reference articles with an ID, Vietnamese text,
accent-insensitive search terms, and a source. These are maintained reference
articles, not user conversation history. Rules reference the
[FIDE Laws of Chess](https://handbook.fide.com/chapter/E012023); application
policies link to the corresponding page. Do not turn general teaching advice
into a claim about a position that has not been supplied and checked.

`coachKnowledge.js` handles player fields, user-question follow-ups, opening
aliases/ECO/PGN and article retrieval. `coachBoardAnswer.js` checks actual
positions and legal variations with Stockfish. Providers in `coachProvider.js`
may select up to two existing article IDs; provider prose, invented URLs or
unknown IDs are not displayed as facts. Unsupported questions get a request
for clarification or an explicit lack-of-data answer.

To add or revise data:

1. Check a primary source. Record the source and the date of the checked facts;
   do not advance the date for unrelated, unchecked entries.
2. Add aliases and specific search terms. Avoid broad terms such as “lỗi” that
   can misclassify a chess question as an account/payment issue.
3. Keep unknown facts absent. Never infer a GM year from a birth year or use
   a past Elo snapshot as the current rating.
4. Add a question that proves the requested detail is answered, plus an
   unsupported/ambiguous example that must not return a guessed fact.
5. Run from `backend`: `npm.cmd run knowledge:check`. It includes a real
   Stockfish check; provider requests in the unit tests are mocked and use
   no paid API keys.

## Conversational Coach update (2026-10-03)

`coachConversation.js` routes greetings, thanks, capability questions, short
requests, lesson follow-ups and clarification. Greetings attached to real
questions must not swallow the question. Topic resolution uses recent user
messages only; generated assistant text is not evidence. The UI keeps at most
40 messages in memory and sends at most 24, of which the server uses at most
12 user messages. Reset, reload and account changes clear this context.

`coachLessons.js` adds basic piece movement, trading, time management, training
plans, examples and practice prompts. `coachExercises.js` supplies six small
quizzes with fixed choices, hints and feedback. They do not change Puzzle Elo,
points or account data. Rule references remain the FIDE Laws linked above;
training plans and hypothetical examples are authored teaching material.

Responses can include up to three suggested next questions. The UI displays
them as wrapping buttons, and support links now come from the same backend
answer pipeline. Viewer names come from authenticated server context; public
owner/developer names still come from Website Settings. Position questions
use the actual FEN/PGN and Stockfish, including after a greeting.

Providers perform semantic selection over known articles for differently
phrased questions. A provider error falls through to the next configured
provider; valid empty selections stay empty. Unsupported live statistics and
private account facts are not fabricated. This expands knowledge and dialogue
routing; it does not fine-tune the weights of Gemini, Groq or OpenRouter models.

Validation:

- `npm.cmd run knowledge:check`: conversations, quizzes, factual boundaries,
  provider mocks, intent routing and a real Stockfish integration check.
- From `Frontend`: `node scripts/run-browser-tests.mjs coach-conversation.spec.js`.
- `npm.cmd run check:coach`: local greeting check.
- `npm.cmd run check:coach -- --providers`: optional live semantic-selection
  probe using a synthetic question; prints HTTP statuses and topic IDs only.
  This uses the configured provider API quota.

No SQL or new dependencies are required.

## Lists and questions outside chess (2026-10-03)

`coachPlayerLists.js` handles requests for examples of grandmasters, quantities,
supported country/gender filters, and contiguous “kể thêm” follow-ups. It uses
only deduplicated profiles with a FIDE ID and a recorded GM year. A partial
catalog is labelled as partial, never as a complete national list. Rankings,
youngest-player lists and active-player status require information the local
catalog cannot supply. Unknown conditions must not be silently discarded.
GM and WGM requests are distinguished. Example lists are not live rankings.

Birth year, federation, gender and GM year were rechecked on the FIDE profiles
of Carlsen, Nakamura, Lê Quang Liêm and
[Hou Yifan](https://ratings.fide.com/profile/8602980) on 2026-10-03. This does not
update their editorial style descriptions or add live Elo values. Other
profiles retain their earlier verification dates.

`coachScope.js` provides local responses for simple arithmetic (two operands,
no eval), introductory AI questions, study suggestions and emotional small
talk. It also routes common outside topics to honest, topic-specific limits
and next steps. It does not enable unrestricted text generation, web search,
medical diagnosis, legal conclusions, investments or arbitrary code execution.
Sensitive-data requests are intercepted before provider selection and before
multi-question splitting. This is a defence for recognized patterns, not a
claim that all possible secret formats or adversarial prompts are detectable.

Unknown non-chess biographies no longer demand a FIDE ID. Unexpected input
receives a neutral clarification instead of being asserted to concern chess.
`tests/coach-scope.test.js` is included in `knowledge:check`; it verifies list
filters/pagination, fresh-data boundaries, mixed questions, outside topics,
privacy requests and engine/provider routing. No finite set of intent rules
can guarantee a correct answer to every possible question.

## Context and general reference update (2026-10-05)

Player lists now support ordinal references (“người thứ hai”), subsequent
pronouns, quantity changes (“kể thêm hai người”), and replacing country filters.
They reconstruct results from up to 12 recent user messages, ignoring short
acknowledgements. Unknown filters, ambiguous pronouns and references after a
topic switch require clarification; assistant messages never supply names.

`coachGeneralLessons.js` adds seven short reference lessons with examples and
summary follow-ups. Web/API/HTTP/cookie concepts link to MDN; study suggestions,
AI introduction and support-message examples are authored explanations.
The provider index includes these lessons, but still accepts only existing IDs.
This is an expanded reference system, not unrestricted model generation.

Local arithmetic additionally supports percentages and conversions within
time (hours/minutes/seconds) or length (km/m/cm/mm). Inputs are bounded numeric
patterns and are never evaluated as JavaScript. Rounded results use ≈.
A small bilingual phrase dictionary handles common greetings and chess words;
it is not an arbitrary-document translator. Other outside topics continue to
receive explicit limits or requests for clarification. No live-ranking or
news service has been enabled, and no additional API keys or SQL are needed.
