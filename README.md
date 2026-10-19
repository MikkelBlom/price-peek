# Price Peek

Chrome extension that finds prices on any page and shows the converted amount as a small dark badge on the price's top-right corner. Converts to Danish kroner by default; the popup can switch to any supported currency.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick the `extension` folder.
3. Pin the extension if you want the popup one click away.

After changing any file, click the reload icon on the extension's card in `chrome://extensions`, then reload the page.

## What it detects

| Currency | Examples |
|---|---|
| KRW | `₩1,500,000`, `1,500,000원`, `150만원`, `3억 5,000만원`, `12억 5,000`, `3.5억`, `5천원`, `1조 2,000억` |
| USD | `$1,299.99`, `US$45`, `$2.5M`, `$50K`, `100 USD`, `20 dollars` |
| EUR | `€19.99`, `1.234,56 €`, `EUR 3,5 Mio.` |
| GBP, CHF | `£12`, `CHF 49.90` |
| JPY | `¥1,200`, `1,200円`, `3万円`, `1億2000万円` |
| CNY | `CN¥88`, `RMB 500`, `35元`, `100万元` |
| SEK, NOK, DKK | `499 SEK`, `NOK 1 200`, `DKK 250` (code only) |
| THB | `฿350`, `350 บาท`, `350 baht` |

Rules for ambiguous symbols: `$` is always USD (CA$, A$, HK$, NT$ are skipped), `¥` is JPY unless written `CN¥`/`RMB`/`元`, and a bare `kr` is never matched. Comma, dot and space separators all work. Prices of 0 and prices already in the target currency get no badge.

Units, metric only: `평`/`坪` and `畳`/`帖` → m², `근` → g. Imperial units are not supported.

## Behaviour

- Numbers you type into text fields get a badge too. A bare number like `500000` takes the currency named around the field (placeholder, label or nearby text, such as a "최소 ___ 원" price filter).
- At most 3 price badges (and 3 unit badges) at a time, picked from what's on screen: the biggest prices first (crossed-out old prices last), then top to bottom. Hover any other price to see its badge. "Show all prices" lifts the limit.
- Prices that appear later (infinite scroll, single-page apps) and prices inside embedded frames are picked up.
- Never changes the page text. Badges sit in a separate layer that clicks pass through.

## Popup

Target currency, on/off, on/off for the current site, show all prices, area & weight on/off, and which currencies to detect. Shows the current rate with its date and a refresh button.

## Exchange rates

Daily ECB rates from [Frankfurter](https://frankfurter.dev) (free, no key), with [ExchangeRate-API](https://open.er-api.com) as a fallback. Cached and refetched when older than 12 hours.

## Tests

```bash
node --test tests/parser.test.js
```

`tests/demo.html` (badges) and `tests/popup-demo.html` (popup) run the real scripts outside Chrome with a stubbed `chrome` API. Serve the repo root (`python -m http.server 8765`) and open them on `http://localhost:8765/tests/`. `demo.html?target=EUR` tries another target currency.

## Contributing and license

Bug reports, currency and language requests, and pull requests are welcome; see [CONTRIBUTING.md](CONTRIBUTING.md).

Price Peek is **not open source**. The code is public to read and to contribute to, but it may not be copied, redistributed or republished. See [LICENSE](LICENSE).
