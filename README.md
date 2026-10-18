# KRW → DKK

Chrome extension that finds Korean won prices on any page and shows the amount in Danish kroner as a small dark badge on the price's top-right corner.

## Install

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Click **Load unpacked** and pick the `extension` folder.
3. Pin the extension if you want the popup one click away.

After changing any file, click the reload icon on the extension's card in `chrome://extensions`, then reload the page.

## What it does

- Detects `₩1,500,000`, `1,500,000원`, `KRW 1.500.000`, `150만원`, `3억 5,000만원`, `3억5천만`, `12억 5,000`, `3.5억`, `5천원`, `1조 2,000억`, `1.2 million won` and similar. Comma or dot separators both work. `₩0` is ignored.
- Converts `25평` to `83 m²` with the same badge.
- Shows at most 3 badges at a time, picked from the prices on screen (top to bottom). Hover any other price to see its badge. "Show all prices" in the popup lifts the limit.
- Never changes the page text. Badges sit in a separate layer that clicks pass through.

## Popup

On/off, on/off for the current site, show all prices, and the current rate with its date and a refresh button.

## Exchange rate

Daily ECB rate from [Frankfurter](https://frankfurter.dev) (free, no key), with [ExchangeRate-API](https://open.er-api.com) as a fallback. Cached and refetched when it's older than 12 hours.

## Tests

```bash
node --test tests/parser.test.js
```

`tests/demo.html` runs the content script outside Chrome with a stubbed `chrome` API. Serve the repo root (`python -m http.server 8765`) and open `http://localhost:8765/tests/demo.html`.
