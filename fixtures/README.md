# TEST FIXTURE

Files in this folder are **generated test fixtures, not market data**. They are used only by unit
tests. Any UI that ever shows them must label them "TEST FIXTURE" (CLAUDE.md §13).

- `candles.sample.csv`: 500 one-minute bars from a seeded random walk (seed 42) starting at an
  arbitrary time, with one 64-hour weekend-sized gap before row 250.
