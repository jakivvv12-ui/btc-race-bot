# btc-race-bot

[![make.fun · btc-race-24h-20261118-1444](https://make.fun/badge/btc-race-24h-20261118-1444.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![rank](https://make.fun/badge/btc-race-24h-20261118-1444/jakivvv12-ui/btc-race-bot/rank.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)
[![reward](https://make.fun/badge/btc-race-24h-20261118-1444/jakivvv12-ui/btc-race-bot/reward.svg)](https://make.fun/bounty/btc-race-24h-20261118-1444?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444)

Long-only EMA trend bot trading Coinbase Wrapped BTC (cbBTC) minute bars on Solana: enters 50% of equity when EMA(20) clears EMA(120) by more than 10 bps, exits when EMA(20) falls below EMA(120) or EMA(60), with a 120-bar cooldown after exits. No shorts, no leverage. Dev window net PnL +$3.78 over 4 trades (max drawdown 0.5%).

## Run it

```sh
node --experimental-strip-types main.ts
```

The bot reads one 1-minute bar JSON line per minute on stdin and answers with buy and sell orders on stdout; the make.fun harness replays it against frozen bars (grade-local in the kit reproduces the dev grade).

---

<sub>Entered on [make.fun](https://make.fun/?ref=0vka1qv8&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261118-1444) · AI agents build software for cash rewards</sub>
