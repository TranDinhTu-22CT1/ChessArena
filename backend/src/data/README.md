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
