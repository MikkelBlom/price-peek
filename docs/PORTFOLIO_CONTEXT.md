# Price Peek – context for the portfolio

Background for whoever writes the portfolio entry. This is context, not the entry itself.

## What it is

Price Peek is a Chrome extension that finds prices on any web page and shows the amount in the user's own currency (Danish kroner by default) as a small dark badge on the price's top-right corner. It never changes the page itself. It is a personal project, published on the Chrome Web Store.

## Why it exists

Mikkel is planning an exchange semester in Korea (5th semester) and has been researching prices there: housing, groceries and everyday costs, to build a budget. Every price meant copying it, searching "xx KRW to DKK" on Google, waiting, and reading the result. Each lookup is only a few seconds, but doing it constantly is tiring.

Housing was the worst case: he'd fall for a place from its photos, open the listing, and only then find out it was over budget. With the price in kroner at a glance, that's visible before clicking at all.

## What it does

- Detects prices in 11 currencies: Korean won, US dollar, euro, British pound, Japanese yen, Chinese yuan, Swedish and Norwegian krone, Swiss franc, Thai baht and Danish krone. It converts to any of them (DKK by default).
- Reads prices the way locals write them, e.g. Korean 3억 5,000만원 and 12억 5,000, Japanese 3万円, European 1.234,56 €, and $2.5M. Comma, dot and space separators all work.
- Converts Asian area and weight units to metric: 평/坪 and 畳 to m², 근 to grams.
- Also converts numbers typed into price filters.
- Shows at most 3 badges at a time, favouring the main prices on screen. Hovering any other price shows its badge.
- Uses the daily European Central Bank exchange rates (free, no account needed).

## How it was built

- Plain JavaScript Chrome extension (Manifest V3), with no framework and no build step.
- A parser with its own test suite turns price text into amounts, including Korean and Japanese unit systems and ambiguous separators.
- The extension reads the page's text without touching it, and draws badges in a separate layer. Prices split across several elements (common on Korean shopping sites) are joined before parsing.
- Tested on real sites (Coupang, Apple's regional stores, Homes.co.jp, Google), and fixed the problems that showed up there.
- The visual style was chosen by comparing several design directions before building. Logo and store images were made for the Chrome Web Store listing.

## Links

- Code: https://github.com/MikkelBlom/price-peek
- Chrome Web Store: not live yet (in review)

## Files worth using

Paths are relative to the repo root (local copy: `C:\Users\mikke\Desktop\Projects\KRW-Extension`).

| File | What it is |
|---|---|
| `store/marquee.png` | 1400×560 banner: "Every price, in your currency." |
| `store/screenshot-1.png` | Prices from Seoul, New York, Berlin, Tokyo, London and Bangkok with badges |
| `store/screenshot-2.png` | Shop page mock-up with a badge on the price |
| `store/screenshot-3.png` | One price shown in four target currencies, next to the popup |
| `store/screenshot-4.png` | Badges on numbers typed into a price filter |
| `store/promo-tile.png` | 440×280 tile |
| `store/video/price-peek-promo.mp4` | 30-second promo video |
| `extension/icons/icon128.png` | App icon (the badge shape with "kr.") |
| `README.md` | Feature overview and install steps |
| `extension/src/parser.js` | The price parser, the most interesting code |
| `tests/parser.test.js` | Parser tests, which double as a list of supported formats |
